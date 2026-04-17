import type { Page } from '@playwright/test';
import type { Settings } from '@ear-training/core/types/domain';

/** Seed IndexedDB with an onboarded settings row so the shell doesn't redirect. */
export async function seedOnboarded(page: Page, overrides: Partial<Settings> = {}): Promise<void> {
  await page.addInitScript((settings) => {
    return new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('ear-training', 1);

      req.onupgradeneeded = () => {
        // Schema must match packages/web-platform/src/store/db.ts:upgrade() — keep in sync.
        const db = req.result;

        if (!db.objectStoreNames.contains('items')) {
          const items = db.createObjectStore('items', { keyPath: 'id' });
          items.createIndex('by-box', 'box');
          items.createIndex('by-due', 'due_at');
        }

        if (!db.objectStoreNames.contains('attempts')) {
          const attempts = db.createObjectStore('attempts', { keyPath: 'id' });
          attempts.createIndex('by-session', 'session_id');
          attempts.createIndex('by-item', 'item_id');
          attempts.createIndex('by-at', 'at');
        }

        if (!db.objectStoreNames.contains('sessions')) {
          const sessions = db.createObjectStore('sessions', { keyPath: 'id' });
          sessions.createIndex('by-started-at', 'started_at');
        }

        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings');
        }
      };

      req.onerror = () => reject(req.error);

      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('settings', 'readwrite');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.objectStore('settings').put(settings, 'singleton');
      };
    });
  }, {
    function_tooltip: true,
    auto_advance_on_hit: true,
    session_length: 30,
    reduced_motion: 'auto',
    onboarded: true,
    ...overrides,
  });
}

/** Clear all app IndexedDB data before the test (fresh-user state). */
export async function resetAppState(page: Page): Promise<void> {
  await page.addInitScript(() => {
    return new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase('ear-training');
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('deleteDatabase blocked'));
    });
  });
}
