import type { Attempt, AttemptOutcome, Item, Register } from '@/types/domain';
import type { Degree } from '@/types/music';
import { nextBoxOnPass, nextBoxOnMiss, dueAtAfter } from '@/srs/leitner';
import { weightedAccuracy, pushOutcome } from '@/srs/accuracy';

export interface BuildAttemptInput {
  item: Item;
  sessionId: string;
  /**
   * Zero-based index of this round within the session; used to construct the
   * attempt id as `${sessionId}-${roundIndex}-${item.id}`.
   */
  roundIndex: number;
  /**
   * How many times this item has already been reviewed in its current box
   * BEFORE this attempt. Caller is responsible for maintaining this counter
   * and computing the next value.
   */
  reviewsInCurrentBox: number;
  now: number;
  target: { hz: number };
  sung: { hz: number | null; cents_off: number | null; confidence: number };
  spoken: { digit: Degree | null; confidence: number };
  pitchOk: boolean;
  labelOk: boolean;
  timbre: string;
  register: Register;
}

export interface BuildAttemptResult {
  attempt: Attempt;
  updatedItem: Item;
}

/**
 * Pure, stateless helper that computes the persisted `Attempt` record and the
 * updated `Item` (Leitner box, accuracy, consecutive_passes, due_at) from a
 * single graded round.
 *
 * Does NO I/O. Callers are responsible for writing `attempt` and `updatedItem`
 * to their respective repos.
 */
export function buildAttemptPersistence(input: BuildAttemptInput): BuildAttemptResult {
  const {
    item, sessionId, roundIndex, reviewsInCurrentBox, now,
    target, sung, spoken, pitchOk, labelOk, timbre, register,
  } = input;

  const outcome: AttemptOutcome = {
    pitch: pitchOk,
    label: labelOk,
    pass: pitchOk && labelOk,
    at: now,
  };

  // Compute updated item state
  const updated: Item = {
    ...item,
    attempts: item.attempts + 1,
    consecutive_passes: outcome.pass ? item.consecutive_passes + 1 : 0,
    recent: pushOutcome(item.recent, outcome),
    last_seen_at: now,
  };
  updated.accuracy = {
    pitch: weightedAccuracy(updated.recent, 'pitch'),
    label: weightedAccuracy(updated.recent, 'label'),
  };

  const nextBox = outcome.pass
    ? nextBoxOnPass(item.box, updated.consecutive_passes)
    : nextBoxOnMiss(item.box);

  updated.box = nextBox;
  updated.due_at = dueAtAfter(nextBox, reviewsInCurrentBox, now);

  const attempt: Attempt = {
    id: `${sessionId}-${roundIndex}-${item.id}`,
    item_id: item.id,
    session_id: sessionId,
    at: now,
    target: { hz: target.hz, degree: item.degree },
    sung,
    spoken,
    graded: outcome,
    timbre,
    register,
  };

  return { attempt, updatedItem: updated };
}
