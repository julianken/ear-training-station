import { describe, it, expect } from 'vitest';
import { createItemsRepo } from '@/store/items-repo';
import { openTestDB } from '../helpers/test-db';
import type { Item } from '@/types/domain';
import { C_MAJOR } from '../helpers/fixtures';
import { itemId } from '@/types/music';

function mkItem(overrides: Partial<Item> = {}): Item {
  return {
    id: itemId(5, C_MAJOR),
    degree: 5,
    key: C_MAJOR,
    box: 'new',
    accuracy: { pitch: 0, label: 0 },
    recent: [],
    attempts: 0,
    consecutive_passes: 0,
    last_seen_at: null,
    due_at: 0,
    created_at: 1_700_000_000_000,
    ...overrides,
  };
}

describe('items-repo', () => {
  it('put + get round-trips an item', async () => {
    const db = await openTestDB();
    const repo = createItemsRepo(db);
    const it = mkItem();
    await repo.put(it);
    const fetched = await repo.get(it.id);
    expect(fetched).toEqual(it);
  });

  it('listAll returns all items', async () => {
    const db = await openTestDB();
    const repo = createItemsRepo(db);
    await repo.put(mkItem({ id: 'a', degree: 1 }));
    await repo.put(mkItem({ id: 'b', degree: 2 }));
    const all = await repo.listAll();
    expect(all.length).toBe(2);
    expect(all.map((i) => i.id).sort()).toEqual(['a', 'b']);
  });

  it('findDue returns only items with due_at <= now', async () => {
    const db = await openTestDB();
    const repo = createItemsRepo(db);
    const now = 1_700_000_000_000;
    await repo.put(mkItem({ id: 'past', due_at: now - 1000 }));
    await repo.put(mkItem({ id: 'future', due_at: now + 1000 }));
    const due = await repo.findDue(now);
    expect(due.map((i) => i.id)).toEqual(['past']);
  });

  it('putMany inserts atomically', async () => {
    const db = await openTestDB();
    const repo = createItemsRepo(db);
    const items = [mkItem({ id: 'a' }), mkItem({ id: 'b' }), mkItem({ id: 'c' })];
    await repo.putMany(items);
    const all = await repo.listAll();
    expect(all.length).toBe(3);
  });
});
