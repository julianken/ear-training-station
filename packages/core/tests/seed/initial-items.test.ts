import { describe, it, expect } from 'vitest';
import { buildInitialItems } from '@/seed/initial-items';

describe('buildInitialItems', () => {
  it('creates 3 items for the tonic triad in C major', () => {
    const items = buildInitialItems({ now: 1_700_000_000_000 });
    expect(items.length).toBe(3);
    const degrees = items.map((i) => i.degree).sort((a, b) => a - b);
    expect(degrees).toEqual([1, 3, 5]);
  });

  it('all starter items are in C major', () => {
    const items = buildInitialItems({ now: 0 });
    for (const it of items) {
      expect(it.key.tonic).toBe('C');
      expect(it.key.quality).toBe('major');
    }
  });

  it('all starter items start in box=new, due_at=now, empty history', () => {
    const now = 42;
    const items = buildInitialItems({ now });
    for (const it of items) {
      expect(it.box).toBe('new');
      expect(it.due_at).toBe(now);
      expect(it.recent).toEqual([]);
      expect(it.attempts).toBe(0);
      expect(it.consecutive_passes).toBe(0);
      expect(it.last_seen_at).toBe(null);
      expect(it.accuracy).toEqual({ pitch: 0, label: 0 });
      expect(it.created_at).toBe(now);
    }
  });

  it('item ids are stable and match itemId()', () => {
    const items = buildInitialItems({ now: 0 });
    const ids = items.map((i) => i.id).sort();
    expect(ids).toEqual(['1-C-major', '3-C-major', '5-C-major']);
  });
});
