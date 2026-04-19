import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { selectNextItem, type SelectNextItemNullDiag } from '@/scheduler/selection';
import type { RoundHistoryEntry } from '@/scheduler/interleaving';
import type { Item, LeitnerBox } from '@/types/domain';
import type { Degree, Key, KeyQuality, PitchClass } from '@/types/music';
import { itemId } from '@/types/music';

// In-process repro attempt for issue #155 — selectNextItem returning null
// mid-session. Intent: stress it over random items + histories and report
// any shrunk failing case alongside the `onNull` diagnostic.

const PITCH_CLASSES: readonly PitchClass[] = [
  'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
];
const DEGREES: readonly Degree[] = [1, 2, 3, 4, 5, 6, 7];
const QUALITIES: readonly KeyQuality[] = ['major', 'minor'];
const BOXES: readonly LeitnerBox[] = ['new', 'learning', 'reviewing', 'mastered'];

const keyArb: fc.Arbitrary<Key> = fc.record({
  tonic: fc.constantFrom(...PITCH_CLASSES),
  quality: fc.constantFrom(...QUALITIES),
});

const degreeArb: fc.Arbitrary<Degree> = fc.constantFrom(...DEGREES);

const itemArb: fc.Arbitrary<Item> = fc.record({
  degree: degreeArb,
  key: keyArb,
  box: fc.constantFrom(...BOXES),
  accuracy: fc.record({
    pitch: fc.double({ min: 0, max: 1, noNaN: true }),
    label: fc.double({ min: 0, max: 1, noNaN: true }),
  }),
  attempts: fc.integer({ min: 0, max: 100 }),
  consecutive_passes: fc.integer({ min: 0, max: 10 }),
  last_seen_at: fc.integer({ min: 0, max: 2_000_000_000_000 }),
  due_at: fc.integer({ min: 0, max: 2_000_000_000_000 }),
  created_at: fc.integer({ min: 0, max: 2_000_000_000_000 }),
}).map((partial) => ({
  id: itemId(partial.degree, partial.key),
  ...partial,
  recent: [],
})) as fc.Arbitrary<Item>;

/**
 * Generate a history whose entries reference items from the SAME run —
 * this matches how the controller populates `#roundHistory` (only completed
 * rounds make it in).
 */
function historyFromItemsArb(items: ReadonlyArray<Item>): fc.Arbitrary<RoundHistoryEntry[]> {
  if (items.length === 0) return fc.constant([]);
  const entryArb: fc.Arbitrary<RoundHistoryEntry> = fc.constantFrom(...items).map((it) => ({
    itemId: it.id,
    degree: it.degree,
    key: it.key,
  }));
  return fc.array(entryArb, { maxLength: 15 });
}

// Seeded-ish rng so a failing case is deterministic when replayed. fast-check
// controls its own seed via fc.assert; we just need a stable PRNG shape.
function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

describe('selectNextItem — property', () => {
  it('returns non-null for any items.length >= 5 and history.length <= 15', () => {
    // Capture any null diagnostic so a reproduced failure is actionable.
    let capturedDiag: SelectNextItemNullDiag | null = null;

    fc.assert(
      fc.property(
        fc.array(itemArb, { minLength: 5, maxLength: 28 }).chain((items) =>
          fc.tuple(
            fc.constant(items),
            historyFromItemsArb(items),
            fc.integer({ min: 0, max: 2_000_000_000_000 }),
            fc.integer({ min: 1, max: 2 ** 30 }),
          ),
        ),
        ([items, history, now, rngSeed]) => {
          const rng = mulberry32(rngSeed);
          const result = selectNextItem(items, history, now, rng, (diag) => {
            if (capturedDiag == null) capturedDiag = diag;
          });
          // Expected invariant: with >=5 items across varied degrees/keys, the
          // scheduler should always find at least one eligible pick under the
          // fallback soft-constraint tier.
          return result !== null;
        },
      ),
      { numRuns: 1000 },
    );

    // If the above assertion fails, fast-check throws and we never reach here.
    // This guard is belt-and-suspenders: if onNull fired but the property
    // still held (shouldn't happen), surface it.
    expect(capturedDiag).toBeNull();
  });
});
