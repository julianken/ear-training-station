import { test, expect } from '@playwright/test';
import { seedOnboarded, resetAppState } from './helpers/app-state';

test.skip('fresh user visiting / is redirected to /onboarding', async ({ page }) => {
  await resetAppState(page);
  await page.goto('/');
  await expect(page).toHaveURL(/\/onboarding/);
});

test.skip('onboarded user can visit / without redirect', async ({ page }) => {
  await seedOnboarded(page);
  await page.goto('/');
  await expect(page).toHaveURL(/\/$/);
});
