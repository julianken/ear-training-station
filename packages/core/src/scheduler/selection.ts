import type { Item, LeitnerBox } from '@/types/domain';
import { isBlocked, isBlockedSameDegree, type RoundHistoryEntry } from './interleaving';

/** Fraction of picks that come from the "keep warm" mastered pool. */
const WARMUP_SHARE = 0.3;

/** Minimum sampling weight for any eligible item, so picks are not deterministic. */
const MIN_WEIGHT = 0.05;

/**
 * Reason codes emitted when `selectNextItem` is about to return null.
 * `no-eligible`        — the eligible pool is empty even after dropping
 *                        the same-key-streak constraint.
 * `empty-items`        — `items` was empty on entry (degenerate caller).
 * `pick-returned-null` — eligibility was non-empty but the internal pool
 *                        pick returned null. Should not happen in prod;
 *                        reserved for defense-in-depth coverage.
 */
export type SelectNextItemNullReason =
  | 'no-eligible'
  | 'empty-items'
  | 'pick-returned-null';

/**
 * Diagnostic payload emitted on every null-return from `selectNextItem`.
 * Structured so the controller can `console.warn('[scheduler-null]', diag)`
 * and grep the resulting logs.
 *
 * Fields are all plain data — no reactive proxies, no function references.
 * Emission site is responsible for snapshotting history before calling.
 */
export interface SelectNextItemNullDiag {
  reason: SelectNextItemNullReason;
  items_count: number;
  items_ids: string[];
  history_len: number;
  history: RoundHistoryEntry[];
  eligible_strict_count: number;
  eligible_count: number;
  mastered_count: number;
  working_count: number;
  /** Which pool the weighted pick was taken from (when applicable). */
  pool_used?: 'working' | 'mastered';
  boxes: { new: number; learning: number; reviewing: number; mastered: number };
  due_at_range: [number, number] | null;
  now: number;
}

function countBoxes(items: ReadonlyArray<Item>): SelectNextItemNullDiag['boxes'] {
  const boxes: Record<LeitnerBox, number> = { new: 0, learning: 0, reviewing: 0, mastered: 0 };
  for (const it of items) boxes[it.box]++;
  return boxes;
}

function dueAtRange(items: ReadonlyArray<Item>): [number, number] | null {
  if (items.length === 0) return null;
  let min = Infinity;
  let max = -Infinity;
  for (const it of items) {
    if (it.due_at < min) min = it.due_at;
    if (it.due_at > max) max = it.due_at;
  }
  return [min, max];
}

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
 * @param onNull - optional callback invoked BEFORE every `return null`.
 *                 Callers use this to log diagnostics for bug #155.
 *                 Must not throw (caller is responsible for try/catch).
 *                 Keeps core pure — no console references here.
 */
export function selectNextItem(
  items: ReadonlyArray<Item>,
  history: ReadonlyArray<RoundHistoryEntry>,
  now: number,
  rng: () => number = Math.random,
  onNull?: (diag: SelectNextItemNullDiag) => void,
): Item | null {
  const eligibleStrict = items.filter((it) => !isBlocked(it, history));
  const eligible = eligibleStrict.length > 0
    ? eligibleStrict
    : items.filter((it) => !isBlockedSameDegree(it, history));

  const mastered = eligible.filter((it) => it.box === 'mastered');
  const working = eligible.filter((it) => it.box !== 'mastered');

  if (eligible.length === 0) {
    if (onNull) {
      onNull({
        reason: items.length === 0 ? 'empty-items' : 'no-eligible',
        items_count: items.length,
        items_ids: items.map((it) => it.id),
        history_len: history.length,
        history: [...history],
        eligible_strict_count: eligibleStrict.length,
        eligible_count: eligible.length,
        mastered_count: mastered.length,
        working_count: working.length,
        boxes: countBoxes(items),
        due_at_range: dueAtRange(items),
        now,
      });
    }
    return null;
  }

  if (mastered.length > 0 && rng() < WARMUP_SHARE) {
    const picked = uniformPick(mastered, rng);
    if (picked == null) {
      if (onNull) {
        onNull({
          reason: 'pick-returned-null',
          items_count: items.length,
          items_ids: items.map((it) => it.id),
          history_len: history.length,
          history: [...history],
          eligible_strict_count: eligibleStrict.length,
          eligible_count: eligible.length,
          mastered_count: mastered.length,
          working_count: working.length,
          pool_used: 'mastered',
          boxes: countBoxes(items),
          due_at_range: dueAtRange(items),
          now,
        });
      }
      return null;
    }
    return picked;
  }

  const pool = working.length > 0 ? working : mastered; // fallback
  const pickedPool: 'working' | 'mastered' = working.length > 0 ? 'working' : 'mastered';
  const picked = weightedPick(pool, now, rng);
  if (picked == null) {
    if (onNull) {
      onNull({
        reason: 'pick-returned-null',
        items_count: items.length,
        items_ids: items.map((it) => it.id),
        history_len: history.length,
        history: [...history],
        eligible_strict_count: eligibleStrict.length,
        eligible_count: eligible.length,
        mastered_count: mastered.length,
        working_count: working.length,
        pool_used: pickedPool,
        boxes: countBoxes(items),
        due_at_range: dueAtRange(items),
        now,
      });
    }
    return null;
  }
  return picked;
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
