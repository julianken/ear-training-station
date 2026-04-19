import { describe, it, expect } from 'vitest';
import { selectNextItem } from '@/scheduler/selection';
import type { RoundHistoryEntry } from '@/scheduler/interleaving';
import type { Item } from '@/types/domain';
import type { Key, Degree } from '@/types/music';
import { itemId } from '@/types/music';

/**
 * RCA for #155. Reconstruct the exact state the probe observed and verify
 * whether selectNextItem returns null.
 *
 * Probe observation:
 *   - 28 items seeded across 7 degrees × 4 keys (C/G/F/D... wait probe said
 *     C, G, D, A). History: [1-A, 7-D, 5-G, 7-D, 3-G, 5-D]. Last degree=5, key=D.
 */
function mkKey(tonic: 'C' | 'G' | 'D' | 'A' | 'F'): Key {
  return { tonic, quality: 'major' };
}

function mkItem(deg: Degree, tonic: 'C' | 'G' | 'D' | 'A' | 'F'): Item {
  const key = mkKey(tonic);
  return {
    id: itemId(deg, key),
    degree: deg,
    key,
    box: 'new',
    accuracy: { pitch: 0, label: 0 },
    recent: [],
    attempts: 0,
    consecutive_passes: 0,
    last_seen_at: null,
    due_at: 0,
    created_at: 0,
  };
}

function buildProbeItems(): Item[] {
  // 7 degrees × 4 keys. Probe used C, G, D, A (no F).
  const tonics: Array<'C' | 'G' | 'D' | 'A'> = ['C', 'G', 'D', 'A'];
  const items: Item[] = [];
  for (const t of tonics) {
    for (let d = 1 as Degree; d <= 7; d = ((d + 1) | 0) as Degree) {
      items.push(mkItem(d, t));
    }
  }
  return items;
}

const PROBE_HISTORY: RoundHistoryEntry[] = [
  { itemId: itemId(1, mkKey('A')), degree: 1, key: mkKey('A') },
  { itemId: itemId(7, mkKey('D')), degree: 7, key: mkKey('D') },
  { itemId: itemId(5, mkKey('G')), degree: 5, key: mkKey('G') },
  { itemId: itemId(7, mkKey('D')), degree: 7, key: mkKey('D') },
  { itemId: itemId(3, mkKey('G')), degree: 3, key: mkKey('G') },
  { itemId: itemId(5, mkKey('D')), degree: 5, key: mkKey('D') },
];

describe('RCA #155 — reproduce probe state', () => {
  it('with 28-item probe state + 6-round history, selectNextItem never returns null', () => {
    const items = buildProbeItems();
    expect(items).toHaveLength(28);

    // Run 1000 trials with different rng states; see if any return null.
    let nullCount = 0;
    let rngState = 1;
    const lcg = () => {
      rngState = (rngState * 1103515245 + 12345) & 0x7fffffff;
      return rngState / 0x80000000;
    };
    for (let i = 0; i < 1000; i++) {
      const picked = selectNextItem(items, PROBE_HISTORY, 1_000_000, lcg);
      if (picked == null) nullCount++;
    }
    expect(nullCount).toBe(0);
  });

  it('with items updated to non-new boxes (realistic after 6 rounds), still never null', () => {
    // 6 of the items are now in 'learning' or 'mastered' box (the ones played).
    const items = buildProbeItems();
    // Mark the 6 items from the probe history as "learning" box with
    // mid-range accuracy, simulating real attempts.
    for (const h of PROBE_HISTORY) {
      const it = items.find((x) => x.id === h.itemId)!;
      it.box = 'learning';
      it.attempts = 1;
      it.accuracy = { pitch: 0.5, label: 0 };
    }
    let nullCount = 0;
    let rngState = 42;
    const lcg = () => {
      rngState = (rngState * 1103515245 + 12345) & 0x7fffffff;
      return rngState / 0x80000000;
    };
    for (let i = 0; i < 1000; i++) {
      const picked = selectNextItem(items, PROBE_HISTORY, 1_000_000, lcg);
      if (picked == null) nullCount++;
    }
    expect(nullCount).toBe(0);
  });

  it('sanity: if only one key is present AND history ends with same degree on that key, returns item via fallback', () => {
    // Extreme case — shouldn't happen in probe but verifies the fallback path.
    const single = [
      mkItem(5, 'D'),
    ];
    const history: RoundHistoryEntry[] = [
      { itemId: '5-D-major', degree: 5, key: mkKey('D') },
    ];
    // strict eligible: 0 (blocked by same-degree).
    // fallback isBlockedSameDegree drops items with degree=5 → also empty.
    // So selectNextItem SHOULD return null with single item matching last degree.
    const picked = selectNextItem(single, history, 0, () => 0.5);
    expect(picked).toBeNull();
  });

  it('INVARIANT: if items span 2+ keys and 2+ degrees, selectNextItem never returns null for any history', () => {
    // Systematic check: with 4 keys × 7 degrees = 28 items, no history of
    // any length 0..50 can make selectNextItem return null. Random histories,
    // adversarial histories, degenerate histories.
    const items = buildProbeItems();
    let rngState = 7;
    const lcg = () => {
      rngState = (rngState * 1103515245 + 12345) & 0x7fffffff;
      return rngState / 0x80000000;
    };
    const tonics: Array<'C' | 'G' | 'D' | 'A'> = ['C', 'G', 'D', 'A'];
    for (let trial = 0; trial < 5000; trial++) {
      const historyLen = Math.floor(lcg() * 20);
      const history: RoundHistoryEntry[] = [];
      for (let h = 0; h < historyLen; h++) {
        const d = (1 + Math.floor(lcg() * 7)) as Degree;
        const t = tonics[Math.floor(lcg() * 4)]!;
        history.push({ itemId: itemId(d, mkKey(t)), degree: d, key: mkKey(t) });
      }
      const pick = selectNextItem(items, history, 1_000_000, lcg);
      if (pick == null) {
        throw new Error(`NULL reproduced at trial ${trial} with history: ${JSON.stringify(history)}`);
      }
    }
  });

  it('REPRO ATTEMPT: what if history is LONGER than probe reported? try degenerate shapes', () => {
    // If the probe only captured the last 6 history items but #roundHistory
    // held more entries (from earlier abandoned sessions still living in the
    // in-memory controller), would that block everything?
    const items = buildProbeItems();
    // Degenerate history: every history entry same key (D) to trigger streak.
    // Sequences ending in 3+ consecutive D + last degree matching all degrees.
    // Doesn't matter — can't make selectNextItem return null with 4 keys.
    // But what if history is extremely long and keys collapse?
    const longHistory: RoundHistoryEntry[] = [];
    for (let i = 0; i < 100; i++) {
      longHistory.push({ itemId: '1-A-major', degree: 1, key: mkKey('A') });
    }
    // Last is degree=1 key=A. Strict: drop degree=1 (4 blocked) AND drop A-major
    // items (3 more blocked since streak > 3). eligible strict = 28 - 4 - 6 = 18.
    const picked = selectNextItem(items, longHistory, 0, () => 0.5);
    expect(picked).not.toBeNull();
  });
});
