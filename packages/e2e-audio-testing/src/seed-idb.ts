import type { Page } from '@playwright/test';

export interface SeedOpts {
  /** Name of the IndexedDB database to open (the app must use the same name). */
  dbName: string;
  /** Schema version — must match the app's openDB version. */
  version: number;
  /** Map of store-name to an array of record objects to put into that store.
   *  Each store must already exist (schema created by the app's onupgradeneeded, or via a separate seed). */
  records: Record<string, ReadonlyArray<unknown>>;
}

/**
 * Install an init-script that opens the given IndexedDB database (or waits for it to exist)
 * and writes the given records. Must be called BEFORE `page.goto()` — uses `page.addInitScript`.
 *
 * The caller is responsible for ensuring the schema (object stores + indexes) already exists.
 * This helper does NOT create stores; it only puts records.
 *
 * Records are written inside a single readwrite transaction spanning all named stores.
 */
export async function seedIndexedDb(page: Page, opts: SeedOpts): Promise<void> {
  await page.addInitScript((seedOpts: SeedOpts) => {
    return new Promise<void>((resolve, reject) => {
      const { dbName, version, records } = seedOpts;
      const storeNames = Object.keys(records);

      const request = indexedDB.open(dbName, version);

      request.onerror = () => reject(request.error);

      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction(storeNames, 'readwrite');

        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
        tx.onabort = () => {
          db.close();
          reject(tx.error ?? new Error('seedIndexedDb transaction aborted'));
        };

        for (const storeName of storeNames) {
          const store = tx.objectStore(storeName);
          const storeRecords = records[storeName];
          if (storeRecords) {
            for (const record of storeRecords) {
              store.put(record);
            }
          }
        }
      };
    });
  }, opts);
}
