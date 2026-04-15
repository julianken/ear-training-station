import type { Item } from '@/types/domain';
import { keyId } from '@/types/music';
import type { Degree, Key } from '@/types/music';

export interface RoundHistoryEntry {
  itemId: string;
  degree: Degree;
  key: Key;
}

const SAME_KEY_MAX_CONSECUTIVE = 3;

/**
 * Only the same-degree-back-to-back constraint.
 * This is a "soft" predicate used as the fallback when strict filtering
 * yields no eligible items (e.g. single-key curriculum).
 */
export function isBlockedSameDegree(
  candidate: Item,
  history: ReadonlyArray<RoundHistoryEntry>,
): boolean {
  if (history.length === 0) return false;
  const last = history[history.length - 1]!;
  return last.degree === candidate.degree;
}

/**
 * Only the same-key-consecutive constraint.
 * Blocks an item when it would extend a same-key streak past
 * SAME_KEY_MAX_CONSECUTIVE rounds.
 */
export function isBlockedSameKeyStreak(
  candidate: Item,
  history: ReadonlyArray<RoundHistoryEntry>,
): boolean {
  if (history.length === 0) return false;
  const candidateKeyId = keyId(candidate.key);
  let consecutiveSameKey = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if (keyId(history[i]!.key) === candidateKeyId) consecutiveSameKey++;
    else break;
  }
  return consecutiveSameKey >= SAME_KEY_MAX_CONSECUTIVE;
}

/**
 * Is this item blocked from being the next-up by interleaving constraints?
 * Rules (spec §5.2):
 *   - No same scale degree back-to-back.
 *   - No same key for more than 3 consecutive rounds.
 */
export function isBlocked(
  candidate: Item,
  history: ReadonlyArray<RoundHistoryEntry>,
): boolean {
  return isBlockedSameDegree(candidate, history) || isBlockedSameKeyStreak(candidate, history);
}
