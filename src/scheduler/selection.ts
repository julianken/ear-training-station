import type { Item } from '@/types/domain';
import { isBlocked, type RoundHistoryEntry } from './interleaving';

/** Fraction of picks that come from the "keep warm" mastered pool. */
const WARMUP_SHARE = 0.3;

/** Minimum sampling weight for any eligible item, so picks are not deterministic. */
const MIN_WEIGHT = 0.05;

/**
 * Pick the next item to present, or null if nothing is eligible.
 *
 * Behavior:
 *   - Filter by interleaving constraints.
 *   - With probability WARMUP_SHARE, sample from the mastered pool
 *     (uniform over mastered items); if that pool is empty, fall through.
 *   - Otherwise sample from the weak/due pool, weighted by
 *     (1 - accuracy.pitch) + due-weight.
 *
 * @param rng - number in [0, 1); defaults to Math.random.
 *              Inject a seed for deterministic tests.
 */
export function selectNextItem(
  items: ReadonlyArray<Item>,
  history: ReadonlyArray<RoundHistoryEntry>,
  now: number,
  rng: () => number = Math.random,
): Item | null {
  const eligible = items.filter((it) => !isBlocked(it, history));
  if (eligible.length === 0) return null;

  const mastered = eligible.filter((it) => it.box === 'mastered');
  const working = eligible.filter((it) => it.box !== 'mastered');

  if (mastered.length > 0 && rng() < WARMUP_SHARE) {
    return uniformPick(mastered, rng);
  }

  const pool = working.length > 0 ? working : mastered; // fallback
  return weightedPick(pool, now, rng);
}

function uniformPick<T>(arr: ReadonlyArray<T>, rng: () => number): T | null {
  if (arr.length === 0) return null;
  const idx = Math.floor(rng() * arr.length);
  return arr[Math.min(idx, arr.length - 1)]!;
}

function weightForItem(item: Item, now: number): number {
  const weakness = 1 - item.accuracy.pitch; // 0..1, bigger = weaker
  const dueBonus = item.due_at <= now ? 0.5 : 0;
  const boxBonus = item.box === 'new' ? 0.7
    : item.box === 'learning' ? 0.3
    : item.box === 'reviewing' ? 0.1
    : 0;
  return Math.max(MIN_WEIGHT, weakness + dueBonus + boxBonus);
}

function weightedPick(
  arr: ReadonlyArray<Item>,
  now: number,
  rng: () => number,
): Item | null {
  if (arr.length === 0) return null;
  let total = 0;
  const weights: number[] = [];
  for (const it of arr) {
    const w = weightForItem(it, now);
    weights.push(w);
    total += w;
  }
  const target = rng() * total;
  let acc = 0;
  for (let i = 0; i < arr.length; i++) {
    acc += weights[i]!;
    if (acc >= target) return arr[i]!;
  }
  return arr[arr.length - 1]!;
}
