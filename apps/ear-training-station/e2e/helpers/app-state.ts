import type { Page } from '@playwright/test';
import type { Settings } from '@ear-training/core/types/domain';

/** Seed IndexedDB with an onboarded settings row so the shell doesn't redirect. */
export async function seedOnboarded(page: Page, overrides: Partial<Settings> = {}): Promise<void> {
  await page.addInitScript((settings) => {
    const req = indexedDB.open('ear-training', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings');
      if (!db.objectStoreNames.contains('items')) db.createObjectStore('items', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('sessions')) db.createObjectStore('sessions', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('attempts')) db.createObjectStore('attempts', { keyPath: 'id' });
    };
    req.onsuccess = () => {
      const tx = req.result.transaction('settings', 'readwrite');
      tx.objectStore('settings').put(settings, 'singleton');
    };
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
    indexedDB.deleteDatabase('ear-training');
  });
}
