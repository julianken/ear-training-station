import { describe, it, expect } from 'vitest';
import { selectNextItem } from '@/scheduler/selection';
import type { Item } from '@/types/domain';
import { C_MAJOR } from '../helpers/fixtures';
import { itemId } from '@/types/music';

function mkItem(degree: 1|2|3|4|5|6|7, overrides: Partial<Item> = {}): Item {
  return {
    id: itemId(degree, C_MAJOR),
    degree,
    key: C_MAJOR,
    box: 'learning',
    accuracy: { pitch: 0.5, label: 0.8 },
    recent: [],
    attempts: 3,
    consecutive_passes: 0,
    last_seen_at: 0,
    due_at: 0,
    created_at: 0,
    ...overrides,
  };
}

describe('selectNextItem', () => {
  it('returns null when all items are blocked by interleaving', () => {
    const items = [mkItem(5)];
    const history = [{ itemId: items[0]!.id, degree: 5 as const, key: C_MAJOR }];
    // Only one item; same-degree back-to-back → blocked.
    const result = selectNextItem(items, history, 1, () => 0.5);
    expect(result).toBe(null);
  });

  it('returns the sole non-blocked item', () => {
    const items = [mkItem(5), mkItem(3)];
    const history = [{ itemId: items[0]!.id, degree: 5 as const, key: C_MAJOR }];
    const result = selectNextItem(items, history, Date.now(), () => 0);
    expect(result).toBe(items[1]); // degree 3
  });

  it('prefers due weak items over strong ones', () => {
    const now = 1_000_000_000_000;
    const weak = mkItem(3, {
      accuracy: { pitch: 0.2, label: 0.3 },
      box: 'learning',
      due_at: now - 1000,
    });
    const strong = mkItem(5, {
      accuracy: { pitch: 0.95, label: 0.98 },
      box: 'mastered',
      due_at: now + 1_000_000,
    });
    // Run many trials; weak should dominate.
    let weakCount = 0;
    for (let i = 0; i < 1000; i++) {
      const pick = selectNextItem([weak, strong], [], now, Math.random);
      if (pick === weak) weakCount++;
    }
    expect(weakCount).toBeGreaterThan(600);
  });

  it('still occasionally serves mastered items (keeps them warm)', () => {
    const now = 1_000_000_000_000;
    const weak = mkItem(3, { box: 'learning', due_at: now - 1000 });
    const strong = mkItem(5, {
      box: 'mastered',
      due_at: now + 1_000_000,
    });
    let strongCount = 0;
    for (let i = 0; i < 1000; i++) {
      const pick = selectNextItem([weak, strong], [], now, Math.random);
      if (pick === strong) strongCount++;
    }
    // ~30% mastered warmup expectation from spec; allow wide band.
    expect(strongCount).toBeGreaterThan(150);
    expect(strongCount).toBeLessThan(450);
  });

  it('is deterministic given a seeded rng', () => {
    const items = [mkItem(3), mkItem(5), mkItem(6)];
    const seed = () => 0.42;
    const a = selectNextItem(items, [], 0, seed);
    const b = selectNextItem(items, [], 0, seed);
    expect(a).toBe(b);
  });

  it('falls back to soft constraints (drops same-key rule) when all items blocked', () => {
    const items = [mkItem(1), mkItem(3), mkItem(5)]; // all C_MAJOR
    // Build a history of 3 consecutive C_MAJOR rounds ending in a DIFFERENT degree
    // so that no item is blocked by same-degree-back-to-back.
    const history = [
      { itemId: items[0]!.id, degree: 1 as const, key: C_MAJOR },
      { itemId: items[1]!.id, degree: 3 as const, key: C_MAJOR },
      { itemId: items[2]!.id, degree: 5 as const, key: C_MAJOR },
    ];
    // Under strict: all blocked (same-key streak >= 3). Under soft: only degree 5 blocked (back-to-back).
    // Result: one of items[0] (degree 1) or items[1] (degree 3) returned, never null, never items[2].
    const pick = selectNextItem(items, history, Date.now(), () => 0);
    expect(pick).not.toBe(null);
    expect(pick).not.toBe(items[2]); // degree 5 still blocked (back-to-back)
  });
});
