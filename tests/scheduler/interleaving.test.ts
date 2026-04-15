import { describe, it, expect } from 'vitest';
import { isBlocked, type RoundHistoryEntry } from '@/scheduler/interleaving';
import type { Item } from '@/types/domain';
import { C_MAJOR, G_MAJOR } from '../helpers/fixtures';

const item = (degree: 1|2|3|4|5|6|7, key = C_MAJOR): Item => ({
  id: `${degree}-${key.tonic}-${key.quality}`,
  degree,
  key,
  box: 'learning',
  accuracy: { pitch: 0.7, label: 0.9 },
  recent: [],
  attempts: 3,
  consecutive_passes: 1,
  last_seen_at: 0,
  due_at: 0,
  created_at: 0,
});

const seen = (i: Item): RoundHistoryEntry => ({
  itemId: i.id,
  degree: i.degree,
  key: i.key,
});

describe('interleaving', () => {
  it('blocks same-degree-back-to-back', () => {
    const history = [seen(item(5))];
    expect(isBlocked(item(5), history)).toBe(true);
  });

  it('allows different degree after same-degree', () => {
    const history = [seen(item(5))];
    expect(isBlocked(item(6), history)).toBe(false);
  });

  it('blocks a 4th consecutive round in the same key', () => {
    const history = [
      seen(item(1, C_MAJOR)),
      seen(item(3, C_MAJOR)),
      seen(item(5, C_MAJOR)),
    ];
    expect(isBlocked(item(2, C_MAJOR), history)).toBe(true);
  });

  it('allows C major item when last 3 rounds include a different key', () => {
    const history = [
      seen(item(1, C_MAJOR)),
      seen(item(3, G_MAJOR)),
      seen(item(5, C_MAJOR)),
    ];
    expect(isBlocked(item(2, C_MAJOR), history)).toBe(false);
  });

  it('allows G major item regardless of prior C major streak', () => {
    const history = [
      seen(item(1, C_MAJOR)),
      seen(item(3, C_MAJOR)),
      seen(item(5, C_MAJOR)),
    ];
    expect(isBlocked(item(2, G_MAJOR), history)).toBe(false);
  });

  it('empty history blocks nothing', () => {
    expect(isBlocked(item(5), [])).toBe(false);
  });
});
