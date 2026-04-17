import { test, expect } from '@playwright/test';
import { seedOnboarded, resetAppState } from './helpers/app-state';

test('fresh user visiting / is redirected to /onboarding', async ({ page }) => {
  await resetAppState(page);
  await page.goto('/');
  await expect(page).toHaveURL(/\/onboarding/);
});

test('onboarded user can visit / without redirect', async ({ page }) => {
  await seedOnboarded(page);
  await page.goto('/');
  await expect(page).toHaveURL(/\/$/);
  if (process.env.UPDATE_SCREENSHOTS) {
    await page.screenshot({
      path: '../../docs/screenshots/c1-2/task2-app-shell/shell-with-placeholder.png',
      fullPage: true,
    });
  }
});
