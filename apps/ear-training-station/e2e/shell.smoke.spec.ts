import { test, expect } from '@playwright/test';
import { seedOnboarded, resetAppState } from './helpers/app-state';

// Skipped until Task 2 adds the AppShell + onboarded-redirect. Re-enable by removing .skip.
test.skip('fresh user visiting / is redirected to /onboarding', async ({ page }) => {
  await resetAppState(page);
  await page.goto('/');
  await expect(page).toHaveURL(/\/onboarding/);
});

// Skipped until Task 2 adds the AppShell. Re-enable by removing .skip.
test.skip('onboarded user can visit / without redirect', async ({ page }) => {
  await seedOnboarded(page);
  await page.goto('/');
  await expect(page).toHaveURL(/\/$/);
});
