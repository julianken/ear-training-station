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
 * Is this item blocked from being the next-up by interleaving constraints?
 * Rules (spec §5.2):
 *   - No same scale degree back-to-back.
 *   - No same key for more than 3 consecutive rounds.
 */
export function isBlocked(
  candidate: Item,
  history: ReadonlyArray<RoundHistoryEntry>,
): boolean {
  if (history.length === 0) return false;

  const last = history[history.length - 1]!;

  // Same degree back-to-back (any key).
  if (last.degree === candidate.degree) return true;

  // Same key, >3 consecutive: look at the tail.
  const candidateKeyId = keyId(candidate.key);
  let consecutiveSameKey = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if (keyId(history[i]!.key) === candidateKeyId) consecutiveSameKey++;
    else break;
  }
  if (consecutiveSameKey >= SAME_KEY_MAX_CONSECUTIVE) return true;

  return false;
}
