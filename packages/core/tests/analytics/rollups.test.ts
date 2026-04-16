import { describe, it, expect } from 'vitest';
import { masteryByDegree, masteryByKey, leitnerCounts, currentStreak } from '@/analytics/rollups';
import { buildInitialItems } from '@/seed/initial-items';
import type { Item, Session, LeitnerBox } from '@/types/domain';
import { keyId } from '@/types/music';

const items = buildInitialItems({ now: 0 });

describe('masteryByDegree', () => {
  it('returns a Map with entries for degrees present in items', () => {
    const result = masteryByDegree(items);
    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBeGreaterThan(0);
  });

  it('computes average pitch accuracy per degree', () => {
    const tweaked: Item[] = items.map((it, i) =>
      i === 0 ? { ...it, accuracy: { pitch: 0.8, label: 0.9 } } : it,
    );
    const result = masteryByDegree(tweaked);
    expect(result.get(tweaked[0]!.degree)).toBeDefined();
  });
});

describe('masteryByKey', () => {
  it('returns a Map keyed by keyId strings', () => {
    const result = masteryByKey(items);
    expect(result).toBeInstanceOf(Map);
    for (const [k] of result) {
      expect(k).toMatch(/-/); // e.g. "C-major"
    }
  });
});

describe('leitnerCounts', () => {
  it('returns counts for all four boxes', () => {
    const result = leitnerCounts(items);
    expect(result).toHaveProperty('new');
    expect(result).toHaveProperty('learning');
    expect(result).toHaveProperty('reviewing');
    expect(result).toHaveProperty('mastered');
  });

  it('total count matches items length', () => {
    const result = leitnerCounts(items);
    const total = result.new + result.learning + result.reviewing + result.mastered;
    expect(total).toBe(items.length);
  });
});

describe('currentStreak', () => {
  const DAY = 86_400_000;

  function makeSession(startedAt: number): Session {
    return {
      id: `s-${startedAt}`,
      started_at: startedAt,
      ended_at: startedAt + 100_000,
      target_items: 10,
      completed_items: 10,
      pitch_pass_count: 8,
      label_pass_count: 9,
      focus_item_id: null,
    };
  }

  it('returns 0 for empty sessions', () => {
    expect(currentStreak([], Date.now())).toBe(0);
  });

  it('returns 1 for a single session today', () => {
    const now = Date.now();
    expect(currentStreak([makeSession(now - 3600_000)], now)).toBe(1);
  });

  it('returns 2 for consecutive days', () => {
    const now = Date.now();
    const sessions = [
      makeSession(now - DAY - 3600_000),
      makeSession(now - 3600_000),
    ];
    expect(currentStreak(sessions, now)).toBe(2);
  });

  it('breaks streak on gap day', () => {
    const now = Date.now();
    const sessions = [
      makeSession(now - 3 * DAY),
      makeSession(now - 3600_000),
    ];
    expect(currentStreak(sessions, now)).toBe(1);
  });
});
