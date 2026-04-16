import type { Attempt, AttemptOutcome, Item, LeitnerBox, Register, Session } from '@/types/domain';
import type { ItemsRepo, AttemptsRepo, SessionsRepo } from '@/repos/interfaces';
import { selectNextItem } from '@/scheduler/selection';
import type { RoundHistoryEntry } from '@/scheduler/interleaving';
import { nextBoxOnPass, nextBoxOnMiss, dueAtAfter } from '@/srs/leitner';
import { weightedAccuracy, pushOutcome } from '@/srs/accuracy';

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
  spoken: { digit: number | null; confidence: number };
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
      const outcome: AttemptOutcome = {
        pitch: input.pitchOk,
        label: input.labelOk,
        pass: input.pitchOk && input.labelOk,
        at: now,
      };

      // Update item
      const updated: Item = {
        ...input.item,
        attempts: input.item.attempts + 1,
        consecutive_passes: outcome.pass ? input.item.consecutive_passes + 1 : 0,
        recent: pushOutcome(input.item.recent, outcome),
        last_seen_at: now,
      };
      updated.accuracy = {
        pitch: weightedAccuracy(updated.recent, 'pitch'),
        label: weightedAccuracy(updated.recent, 'label'),
      };
      const nextBox = outcome.pass
        ? nextBoxOnPass(input.item.box, updated.consecutive_passes)
        : nextBoxOnMiss(input.item.box);
      const reviewsInCurrentBox = nextBox === input.item.box
        ? (reviewsInBox.get(input.item.id) ?? 0) + 1
        : 0;
      reviewsInBox.set(input.item.id, reviewsInCurrentBox);
      updated.box = nextBox;
      updated.due_at = dueAtAfter(nextBox, reviewsInCurrentBox, now);
      await deps.itemsRepo.put(updated);

      // Record attempt
      const attempt: Attempt = {
        id: `${currentSessionId}-${completedItems}-${input.item.id}`,
        item_id: input.item.id,
        session_id: currentSessionId,
        at: now,
        target: { hz: input.target.hz, degree: input.item.degree },
        sung: input.sung,
        spoken: input.spoken,
        graded: outcome,
        timbre: input.timbre,
        register: input.register,
      };
      await deps.attemptsRepo.append(attempt);

      // Update session bookkeeping
      completedItems++;
      if (outcome.pitch) pitchPasses++;
      if (outcome.label) labelPasses++;

      history.push({ itemId: input.item.id, degree: input.item.degree, key: input.item.key });

      return outcome;
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
