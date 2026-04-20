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

function itemArbWithDegree(degree: Degree): fc.Arbitrary<Item> {
  return fc.record({
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
    id: itemId(degree, partial.key),
    degree,
    ...partial,
    recent: [],
  })) as fc.Arbitrary<Item>;
}

/**
 * Items arbitrary that GUARANTEES ≥2 distinct degrees. This is the envelope
 * inside which `selectNextItem` is provably non-null: the fallback tier drops
 * the same-key-streak constraint but still applies `isBlockedSameDegree`,
 * which blocks at most ONE degree (the last history entry's). With ≥2
 * distinct degrees present, at least one item survives fallback filtering.
 * Anything outside this envelope is a legitimate-null corner (e.g. a
 * 5-item pool all on degree 5, last round was degree 5 → eligible is empty
 * by construction, not by bug). Narrowing the generator turns the property
 * into a real invariant rather than a distribution-dependent sampling bet.
 */
const itemsArb: fc.Arbitrary<Item[]> = fc.tuple(
  fc.uniqueArray(fc.constantFrom(...DEGREES), { minLength: 2, maxLength: 7 }),
  fc.array(fc.constantFrom(...DEGREES), { minLength: 3, maxLength: 26 }),
).chain(([required, extras]) => {
  const degrees = [...required, ...extras];
  return fc.tuple(...degrees.map(itemArbWithDegree)) as fc.Arbitrary<Item[]>;
});

function historyFromItemsArb(items: ReadonlyArray<Item>): fc.Arbitrary<RoundHistoryEntry[]> {
  const entryArb: fc.Arbitrary<RoundHistoryEntry> = fc.constantFrom(...items).map((it) => ({
    itemId: it.id,
    degree: it.degree,
    key: it.key,
  }));
  return fc.array(entryArb, { maxLength: 15 });
}

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
  it('returns non-null when items span ≥2 degrees (fallback envelope)', () => {
    let capturedDiag: SelectNextItemNullDiag | null = null;

    fc.assert(
      fc.property(
        itemsArb.chain((items) =>
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
          return result !== null;
        },
      ),
      { numRuns: 2000 },
    );

    expect(capturedDiag).toBeNull();
  });
});
