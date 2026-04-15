import { describe, it, expect } from 'vitest';
import { openTestDB } from '../helpers/test-db';

describe('db open', () => {
  it('creates all object stores', async () => {
    const db = await openTestDB();
    expect(db.objectStoreNames).toContain('items');
    expect(db.objectStoreNames).toContain('attempts');
    expect(db.objectStoreNames).toContain('sessions');
    expect(db.objectStoreNames).toContain('settings');
    db.close();
  });

  it('creates expected indexes on items', async () => {
    const db = await openTestDB();
    const tx = db.transaction('items', 'readonly');
    const store = tx.objectStore('items');
    expect(store.indexNames).toContain('by-box');
    expect(store.indexNames).toContain('by-due');
    await tx.done;
    db.close();
  });
});
