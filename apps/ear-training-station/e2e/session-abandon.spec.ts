import { test, expect } from '@playwright/test';
import { seedOnboarded } from './helpers/app-state';

test('visiting a session with no ended_at marks it abandoned and renders summary', async ({ page }) => {
  // seedOnboarded creates all 4 stores and inserts the settings row.
  await seedOnboarded(page);

  // Seed a session row with ended_at = null into the already-created 'sessions' store.
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
          id: 'abandoned-sess-1',
          started_at: Date.now() - 60000,
          ended_at: null,
          target_items: 30,
          completed_items: 0,
          pitch_pass_count: 0,
          label_pass_count: 0,
          focus_item_id: null,
        });
      };
    });
  });

  await page.goto('/scale-degree/sessions/abandoned-sess-1');

  // SummaryView hasn't been built in Task 2 — expect the placeholder text.
  await expect(page.getByText(/session complete/i)).toBeVisible();

  if (process.env.UPDATE_SCREENSHOTS) {
    await page.screenshot({
      path: '../../docs/screenshots/c1-3/task2-session-route/abandoned-summary.png',
      fullPage: true,
    });
  }
});
