import { describe, it, expect } from 'vitest';
import { computeUnlockedGroupIds } from '@/scheduler/unlock';
import { MVP_CURRICULUM } from '@/scheduler/curriculum';
import type { Item } from '@/types/domain';
import { itemId } from '@/types/music';

function item(
  degree: 1|2|3|4|5|6|7,
  key: { tonic: 'C'|'G'|'F'|'D'; quality: 'major' },
  box: Item['box'],
): Item {
  return {
    id: itemId(degree, key),
    degree,
    key,
    box,
    accuracy: { pitch: 0.7, label: 0.9 },
    recent: [],
    attempts: 1,
    consecutive_passes: 0,
    last_seen_at: 0,
    due_at: 0,
    created_at: 0,
  };
}

describe('computeUnlockedGroupIds', () => {
  const C = { tonic: 'C' as const, quality: 'major' as const };
  const G = { tonic: 'G' as const, quality: 'major' as const };

  it('first group is always unlocked (no prerequisite)', () => {
    const unlocked = computeUnlockedGroupIds([], MVP_CURRICULUM);
    expect(unlocked).toContain('c-major-tonic-triad');
  });

  it('does not unlock next group when prereq < 70%', () => {
    // Tonic triad = 3 items. Only 1 in 'reviewing' (33%).
    const items = [
      item(1, C, 'reviewing'),
      item(3, C, 'learning'),
      item(5, C, 'learning'),
    ];
    const unlocked = computeUnlockedGroupIds(items, MVP_CURRICULUM);
    expect(unlocked).not.toContain('c-major-diatonic-full');
  });

  it('unlocks next group when prereq >= 70%', () => {
    // 3 of 3 (100%) in reviewing.
    const items = [
      item(1, C, 'reviewing'),
      item(3, C, 'reviewing'),
      item(5, C, 'mastered'),
    ];
    const unlocked = computeUnlockedGroupIds(items, MVP_CURRICULUM);
    expect(unlocked).toContain('c-major-diatonic-full');
  });

  it('cascades through the chain', () => {
    const all7inC = [1,2,3,4,5,6,7].map((d) =>
      item(d as 1|2|3|4|5|6|7, C, 'mastered'));
    const unlocked = computeUnlockedGroupIds(all7inC, MVP_CURRICULUM);
    expect(unlocked).toContain('c-major-tonic-triad');
    expect(unlocked).toContain('c-major-diatonic-full');
    expect(unlocked).toContain('g-major-full');
  });

  it('stops cascading when a later group is below threshold', () => {
    const all7inC = [1,2,3,4,5,6,7].map((d) =>
      item(d as 1|2|3|4|5|6|7, C, 'mastered'));
    const onlyOneInG = [item(1, G, 'reviewing')]; // 1 of 7 = 14%
    const unlocked = computeUnlockedGroupIds(
      [...all7inC, ...onlyOneInG],
      MVP_CURRICULUM,
    );
    expect(unlocked).toContain('g-major-full');
    expect(unlocked).not.toContain('f-major-full');
  });

  it('treats missing items (never introduced) as box=new for ratio purposes', () => {
    // Only one item ever recorded in tonic triad; the other two not yet in DB.
    // ratio = 0/3 -> locked.
    const items = [item(1, C, 'reviewing')];
    const unlocked = computeUnlockedGroupIds(items, MVP_CURRICULUM);
    expect(unlocked).not.toContain('c-major-diatonic-full');
  });
});
