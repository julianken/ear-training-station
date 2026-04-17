import { describe, expect, it } from 'vitest';
import { availableRegisters } from '@/scheduler/register-gating';
import type { Item } from '@/types/domain';

function itemInBox(id: string, box: Item['box']): Item {
  return {
    id, degree: 5, key: { tonic: 'C', quality: 'major' },
    box, accuracy: { pitch: 0, label: 0 },
    recent: [], attempts: 0, consecutive_passes: 0,
    last_seen_at: null, due_at: 0, created_at: 0,
  };
}

describe('availableRegisters', () => {
  it('returns only "comfortable" when no items have advanced', () => {
    const items = [itemInBox('a', 'new'), itemInBox('b', 'learning')];
    expect(availableRegisters(items)).toEqual(['comfortable']);
  });

  it('unlocks "narrow" once ≥ 3 items are in reviewing or mastered', () => {
    const items = [
      itemInBox('a', 'reviewing'),
      itemInBox('b', 'reviewing'),
      itemInBox('c', 'reviewing'),
    ];
    expect(availableRegisters(items)).toEqual(['comfortable', 'narrow']);
  });

  it('unlocks "wide" once ≥ 6 items are in reviewing or mastered', () => {
    const items = Array.from({ length: 6 }, (_, i) => itemInBox(String(i), 'mastered'));
    expect([...availableRegisters(items)].sort()).toEqual(['comfortable', 'narrow', 'wide']);
  });

  it('returns "comfortable" only when the list is empty', () => {
    expect(availableRegisters([])).toEqual(['comfortable']);
  });
});
