import type { AttemptOutcome, Item, LeitnerBox, Register, Session } from '@/types/domain';
import type { Degree } from '@/types/music';
import type { ItemsRepo, AttemptsRepo, SessionsRepo } from '@/repos/interfaces';
import { selectNextItem } from '@/scheduler/selection';
import type { RoundHistoryEntry } from '@/scheduler/interleaving';
import { nextBoxOnPass, nextBoxOnMiss } from '@/srs/leitner';
import { buildAttemptPersistence } from '@/round/persistence';

export interface OrchestratorDeps {
  itemsRepo: ItemsRepo;
  attemptsRepo: AttemptsRepo;
  sessionsRepo: SessionsRepo;
  now: () => number;
  rng: () => number;
}

export interface StartSessionInput {
  sessionId: string;
  target_items: number;
}

export interface RecordAttemptInput {
  item: Item;
  target: { hz: number };
  sung: { hz: number | null; cents_off: number | null; confidence: number };
  spoken: { digit: Degree | null; confidence: number };
  pitchOk: boolean;
  labelOk: boolean;
  timbre: string;
  register: Register;
}

export interface Orchestrator {
  startSession(input: StartSessionInput): Promise<Session>;
  nextItem(): Promise<Item | null>;
  recordAttempt(input: RecordAttemptInput): Promise<AttemptOutcome>;
  completeSession(): Promise<Session>;

  // test-only hooks
  peekItem(id: string): Promise<Item | undefined>;
  forceSetBox(id: string, box: LeitnerBox): Promise<void>;
}

export function createOrchestrator(deps: OrchestratorDeps): Orchestrator {
  let started = false;
  let currentSessionId: string | null = null;
  const history: RoundHistoryEntry[] = [];
  let completedItems = 0;
  let pitchPasses = 0;
  let labelPasses = 0;
  let targetItems = 0;
  let reviewsInBox = new Map<string, number>(); // item.id → count in current box

  return {
    async startSession(input) {
      if (started) {
        throw new Error('Cannot start a new session — a session is already active. Call completeSession() first.');
      }
      started = true;
      currentSessionId = input.sessionId;
      history.length = 0;
      completedItems = 0;
      pitchPasses = 0;
      labelPasses = 0;
      targetItems = input.target_items;
      reviewsInBox = new Map();
      return deps.sessionsRepo.start({
        id: currentSessionId,
        target_items: input.target_items,
        started_at: deps.now(),
      });
    },

    async nextItem() {
      if (!started) throw new Error('session not started');
      if (completedItems >= targetItems) return null;
      const items = await deps.itemsRepo.listAll();
      return selectNextItem(items, history, deps.now(), deps.rng);
    },

    async recordAttempt(input) {
      if (!started || currentSessionId === null) throw new Error('session not started');
      const now = deps.now();

      // Pre-compute nextBox to determine reviewsInCurrentBox before calling helper
      const consecutivePassesAfter = input.pitchOk && input.labelOk
        ? input.item.consecutive_passes + 1
        : 0;
      const nextBox = input.pitchOk && input.labelOk
        ? nextBoxOnPass(input.item.box, consecutivePassesAfter)
        : nextBoxOnMiss(input.item.box);
      const reviewsInCurrentBox = nextBox === input.item.box
        ? (reviewsInBox.get(input.item.id) ?? 0) + 1
        : 0;
      reviewsInBox.set(input.item.id, reviewsInCurrentBox);

      const { attempt, updatedItem } = buildAttemptPersistence({
        ...input,
        sessionId: currentSessionId,
        roundIndex: completedItems,
        reviewsInCurrentBox,
        now,
      });

      await deps.itemsRepo.put(updatedItem);
      await deps.attemptsRepo.append(attempt);

      // Update session bookkeeping
      completedItems++;
      if (attempt.graded.pitch) pitchPasses++;
      if (attempt.graded.label) labelPasses++;

      history.push({ itemId: input.item.id, degree: input.item.degree, key: input.item.key });

      return attempt.graded;
    },

    async completeSession() {
      if (!started || currentSessionId === null) throw new Error('session not started');
      const endedAt = deps.now();
      const items = await deps.itemsRepo.listAll();
      const weakest = pickFocusItem(items);
      await deps.sessionsRepo.complete(currentSessionId, {
        ended_at: endedAt,
        completed_items: completedItems,
        pitch_pass_count: pitchPasses,
        label_pass_count: labelPasses,
        focus_item_id: weakest?.id ?? null,
      });
      const out = await deps.sessionsRepo.get(currentSessionId);
      if (!out) throw new Error('session disappeared');
      started = false;
      currentSessionId = null;
      return out;
    },

    async peekItem(id) {
      return deps.itemsRepo.get(id);
    },

    async forceSetBox(id, box) {
      const it = await deps.itemsRepo.get(id);
      if (!it) throw new Error(`forceSetBox: item '${id}' not found`);
      await deps.itemsRepo.put({ ...it, box });
    },
  };
}

/**
 * Identify the weakest item across pitch accuracy; returns null if nothing qualifies.
 * Ties broken by lowest box rank.
 */
function pickFocusItem(items: ReadonlyArray<Item>): Item | null {
  const BOX_RANK: Record<LeitnerBox, number> = {
    new: 0, learning: 1, reviewing: 2, mastered: 3,
  };
  let best: Item | null = null;
  for (const it of items) {
    if (best === null) { best = it; continue; }
    if (it.accuracy.pitch < best.accuracy.pitch) { best = it; continue; }
    if (it.accuracy.pitch === best.accuracy.pitch && BOX_RANK[it.box] < BOX_RANK[best.box]) {
      best = it;
    }
  }
  return best;
}
