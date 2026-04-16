import type { LeitnerBox } from '@/types/domain';

export const PROMOTE_AFTER_CONSECUTIVE_PASSES = 3;

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const REVIEWING_INTERVALS = [2 * DAY, 5 * DAY, 10 * DAY] as const;

/**
 * Compute the next Leitner box after a successful attempt.
 *
 * @param current - the box the item is currently in
 * @param consecutivePassesAfterThis - consecutive passes including this one
 */
export function nextBoxOnPass(
  current: LeitnerBox,
  consecutivePassesAfterThis: number,
): LeitnerBox {
  if (current === 'new') return 'learning';
  if (current === 'mastered') return 'mastered';
  if (consecutivePassesAfterThis < PROMOTE_AFTER_CONSECUTIVE_PASSES) return current;
  if (current === 'learning') return 'reviewing';
  if (current === 'reviewing') return 'mastered';
  return current;
}

/** Compute the next box after a failed attempt. Demotes by one box, never below `learning`. */
export function nextBoxOnMiss(current: LeitnerBox): LeitnerBox {
  switch (current) {
    case 'new': return 'new';
    case 'learning': return 'learning';
    case 'reviewing': return 'learning';
    case 'mastered': return 'reviewing';
  }
}

/**
 * Interval until the next review, in ms.
 *
 * @param box - the new box after the transition
 * @param reviewsInBox - how many times this item has been reviewed in this box
 *                      (used for the `reviewing` escalation schedule)
 */
export function intervalForBox(box: LeitnerBox, reviewsInBox: number): number {
  switch (box) {
    case 'new': return 0;
    case 'learning': return DAY;
    case 'reviewing': {
      const idx = Math.min(reviewsInBox, REVIEWING_INTERVALS.length - 1);
      return REVIEWING_INTERVALS[idx]!;
    }
    case 'mastered': return 21 * DAY;
  }
}

/** Compute due_at for a given box, anchored at `now`. */
export function dueAtAfter(box: LeitnerBox, reviewsInBox: number, now: number): number {
  return now + intervalForBox(box, reviewsInBox);
}
