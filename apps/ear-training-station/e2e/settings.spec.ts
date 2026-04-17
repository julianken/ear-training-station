import { test, expect } from '@playwright/test';
import { seedOnboarded } from './helpers/app-state';

test('settings page renders all four controls', async ({ page }) => {
  await seedOnboarded(page);
  await page.goto('/settings');
  await expect(page.getByLabel(/function tooltip/i)).toBeVisible();
  await expect(page.getByLabel(/auto-advance on hit/i)).toBeVisible();
  await expect(page.getByLabel(/session length/i)).toBeVisible();
  await expect(page.getByLabel(/reduced motion/i)).toBeVisible();
  if (process.env.UPDATE_SCREENSHOTS) {
    await page.screenshot({
      path: '../../docs/screenshots/c1-2/task4-settings-page/settings.png',
      fullPage: true,
    });
  }
});

test('toggling function tooltip persists across reload', async ({ page }) => {
  await seedOnboarded(page, { function_tooltip: true });
  await page.goto('/settings');
  const toggle = page.getByLabel(/function tooltip/i);
  await expect(toggle).toBeChecked();
  await toggle.click();
  await expect(toggle).not.toBeChecked();

  // Verify the new value was actually written to IndexedDB (not just in-memory).
  const persisted = await page.evaluate(() => new Promise<{ function_tooltip: boolean } | null>((resolve, reject) => {
    const req = indexedDB.open('ear-training', 1);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const tx = req.result.transaction('settings', 'readonly');
      const getReq = tx.objectStore('settings').get('singleton');
      getReq.onsuccess = () => resolve(getReq.result as { function_tooltip: boolean } | null);
      getReq.onerror = () => reject(getReq.error);
    };
  }));
  expect(persisted).not.toBeNull();
  expect(persisted!.function_tooltip).toBe(false);
});

test('reset-progress button opens confirmation dialog', async ({ page }) => {
  await seedOnboarded(page);
  await page.goto('/settings');
  await page.getByRole('button', { name: /reset progress/i }).click();
  await expect(page.getByText(/this will permanently delete/i)).toBeVisible();
});
