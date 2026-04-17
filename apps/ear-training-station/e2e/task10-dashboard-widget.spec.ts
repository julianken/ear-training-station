/**
 * Screenshot capture for Task 10 — DashboardWidget on the station picker card.
 * Seeds items across all Leitner boxes so the counts are non-trivial.
 */
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

async function seedWithItems(page: Page): Promise<void> {
  await page.addInitScript(() => {
    return new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('ear-training', 1);

      req.onupgradeneeded = () => {
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
        const now = Date.now();

        // Seed settings (onboarded) and items in one transaction each
        const settingsTx = db.transaction('settings', 'readwrite');
        settingsTx.objectStore('settings').put({
          function_tooltip: true,
          auto_advance_on_hit: true,
          session_length: 30,
          reduced_motion: 'auto',
          onboarded: true,
        }, 'singleton');

        const makeItem = (id: string, degree: number, tonic: string, quality: string, box: string) => ({
          id,
          degree,
          key: { tonic, quality },
          box,
          accuracy: { pitch: 0, label: 0 },
          recent: [],
          attempts: 0,
          consecutive_passes: 0,
          last_seen_at: null,
          due_at: now,
          created_at: now,
        });

        const items = [
          // 5 mastered
          makeItem('1-C-major', 1, 'C', 'major', 'mastered'),
          makeItem('5-C-major', 5, 'C', 'major', 'mastered'),
          makeItem('1-G-major', 1, 'G', 'major', 'mastered'),
          makeItem('4-C-major', 4, 'C', 'major', 'mastered'),
          makeItem('2-C-major', 2, 'C', 'major', 'mastered'),
          // 3 reviewing
          makeItem('3-C-major', 3, 'C', 'major', 'reviewing'),
          makeItem('6-C-major', 6, 'C', 'major', 'reviewing'),
          makeItem('7-C-major', 7, 'C', 'major', 'reviewing'),
          // 4 learning
          makeItem('1-F-major', 1, 'F', 'major', 'learning'),
          makeItem('5-G-major', 5, 'G', 'major', 'learning'),
          makeItem('1-D-major', 1, 'D', 'major', 'learning'),
          makeItem('3-G-major', 3, 'G', 'major', 'learning'),
        ];

        const itemsTx = db.transaction('items', 'readwrite');
        const store = itemsTx.objectStore('items');
        for (const item of items) {
          store.put(item);
        }

        itemsTx.oncomplete = () => resolve();
        itemsTx.onerror = () => reject(itemsTx.error);
      };
    });
  });
}

test('station picker shows DashboardWidget with Leitner counts', async ({ page }: { page: Page }) => {
  await seedWithItems(page);
  await page.goto('/');

  // Wait for the card to appear
  await page.waitForSelector('.card', { timeout: 5000 });

  await expect(page.locator('.station-dashboard .card')).toBeVisible();
  await expect(page.locator('.station-dashboard .card .stat')).toHaveCount(3);

  if (process.env.UPDATE_SCREENSHOTS) {
    await page.screenshot({
      path: '../../docs/screenshots/c1-3/task10-dashboard-widget/station.png',
      fullPage: true,
    });
  }
});
