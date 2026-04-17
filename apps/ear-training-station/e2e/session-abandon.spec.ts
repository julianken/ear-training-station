import { test, expect } from '@playwright/test';
import { seedOnboarded } from './helpers/app-state';

// Seed a due item so findDue() returns something for the controller.
async function seedDueItem(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    return new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('ear-training', 1);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('items', 'readwrite');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.objectStore('items').put({
          id: 'item-c-1',
          key: { tonic: 'C', quality: 'major' },
          degree: 1,
          box: 0,
          due_at: 0,
          interval_days: 0,
          ease: 2.5,
          streak: 0,
          reps: 0,
          last_attempt_id: null,
          last_at: null,
          created_at: Date.now() - 86400000,
        });
      };
    });
  });
}

test('active session (ended_at null) shows Start Round button in idle state', async ({ page }) => {
  await seedOnboarded(page);
  await seedDueItem(page);

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
          focus_item_id: null,
        });
      };
    });
  });

  await page.goto('/scale-degree/sessions/active-sess-1');

  // ActiveRound renders with a Start Round button when there are due items.
  await expect(page.getByRole('button', { name: /start round/i })).toBeVisible();

  if (process.env.UPDATE_SCREENSHOTS) {
    await page.screenshot({
      path: '../../docs/screenshots/c1-3/task5-active-round/idle.png',
      fullPage: true,
    });
  }
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
          focus_item_id: null,
        });
      };
    });
  });

  await page.goto('/scale-degree/sessions/done-sess-1');

  // Summary placeholder text until Task 11 builds real SummaryView.
  await expect(page.getByText(/session complete/i)).toBeVisible();
});
