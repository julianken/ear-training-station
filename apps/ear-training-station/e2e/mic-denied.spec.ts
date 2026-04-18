import { test, expect } from '@playwright/test';
import { seedOnboarded } from './helpers/app-state';

test('denied mic renders the MicDeniedGate', async ({ page }) => {
  await seedOnboarded(page);
  await page.addInitScript(() => {
    return new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('ear-training', 1);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const tx = req.result.transaction('sessions', 'readwrite');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.objectStore('sessions').put({
          id: 'sess-mic-denied', started_at: Date.now(), ended_at: null,
          target_items: 30, completed_items: 0,
          pitch_pass_count: 0, label_pass_count: 0,
        });
      };
    });
  });
  await page.goto('/scale-degree/sessions/sess-mic-denied?preview=mic-denied');
  await expect(page.getByRole('heading', { name: /microphone access required/i })).toBeVisible();
});
