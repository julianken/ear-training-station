import { test, expect } from '@playwright/test';
import { seedOnboarded } from './helpers/app-state';

test('reloading an ongoing session abandons it and shows summary', async ({ page }) => {
  await seedOnboarded(page);

  await page.addInitScript(() => {
    return new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('ear-training', 1);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('sessions', 'readwrite');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.objectStore('sessions').put({
          id: 'active-sess-1',
          started_at: Date.now() - 5000,
          ended_at: null,
          target_items: 30,
          completed_items: 0,
          pitch_pass_count: 0,
          label_pass_count: 0,
        });
      };
    });
  });

  // First navigation — fresh, session remains active (no abandon).
  await page.goto('/scale-degree/sessions/active-sess-1');

  // Reload — this triggers refresh-abandon, which sets ended_at and shows SummaryView.
  await page.reload();
  await expect(page.getByRole('heading', { name: /done/i })).toBeVisible();
});

test('completed session shows summary placeholder', async ({ page }) => {
  await seedOnboarded(page);

  await page.addInitScript(() => {
    return new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('ear-training', 1);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('sessions', 'readwrite');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.objectStore('sessions').put({
          id: 'done-sess-1',
          started_at: Date.now() - 60000,
          ended_at: Date.now() - 1000,
          target_items: 30,
          completed_items: 5,
          pitch_pass_count: 3,
          label_pass_count: 4,
        });
      };
    });
  });

  await page.goto('/scale-degree/sessions/done-sess-1');

  // SummaryView renders when ended_at is set.
  await expect(page.getByRole('heading', { name: /done/i })).toBeVisible();
});
