import { test, expect } from '@playwright/test';
import { seedOnboarded } from './helpers/app-state';

test('station dashboard shows the Scale-Degree Practice card', async ({ page }) => {
  await seedOnboarded(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /scale-degree practice/i })).toBeVisible();
  if (process.env.UPDATE_SCREENSHOTS) {
    await page.screenshot({
      path: '../../docs/screenshots/c1-2/task3-station-dashboard/picker.png',
      fullPage: true,
    });
  }
});

test('clicking the picker card navigates to /scale-degree', async ({ page }) => {
  await seedOnboarded(page);
  await page.goto('/');
  await page.getByRole('link', { name: /scale-degree practice/i }).click();
  await expect(page).toHaveURL(/\/scale-degree$/);
});
