import type { AttemptOutcome } from '@/types/domain';

export const ACCURACY_WINDOW = 10;

export type AccuracyAxis = 'pitch' | 'label';

/**
 * Compute recency-weighted accuracy over the history.
 * Weights follow a linear ramp: newest attempt weighted `history.length`,
 * oldest weighted 1. Empty history returns 0.
 */
export function weightedAccuracy(
  history: ReadonlyArray<AttemptOutcome>,
  axis: AccuracyAxis,
): number {
  if (history.length === 0) return 0;
  let num = 0;
  let den = 0;
  for (let i = 0; i < history.length; i++) {
    const outcome = history[i]!;
    const weight = i + 1; // oldest=1, newest=history.length
    const correct = outcome[axis] ? 1 : 0;
    num += correct * weight;
    den += weight;
  }
  return num / den;
}

/**
 * Append an outcome to the rolling window, capped at ACCURACY_WINDOW.
 * Returns a new array — does not mutate.
 */
export function pushOutcome(
  history: ReadonlyArray<AttemptOutcome>,
  outcome: AttemptOutcome,
): ReadonlyArray<AttemptOutcome> {
  const next = [...history, outcome];
  if (next.length <= ACCURACY_WINDOW) return next;
  return next.slice(next.length - ACCURACY_WINDOW);
}
