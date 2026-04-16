import type { DB } from './db';
import type { ItemsRepo as _ItemsRepo } from '@ear-training/core/repos/interfaces';

export type { ItemsRepo } from '@ear-training/core/repos/interfaces';

export function createItemsRepo(db: DB): _ItemsRepo {
  return {
    async get(id) {
      return db.get('items', id);
    },

    async listAll() {
      return db.getAll('items');
    },

    async findDue(now) {
      const all = await db.getAllFromIndex('items', 'by-due');
      return all.filter((it) => it.due_at <= now);
    },

    async findByBox(box) {
      return db.getAllFromIndex('items', 'by-box', box);
    },

    async put(item) {
      await db.put('items', item);
    },

    async putMany(items) {
      const tx = db.transaction('items', 'readwrite');
      await Promise.all(items.map((it) => tx.store.put(it)));
      await tx.done;
    },
  };
}
