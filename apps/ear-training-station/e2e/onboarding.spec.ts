import { test, expect } from '@playwright/test';
import { resetAppState } from './helpers/app-state';

test('fresh user completes onboarding through the stub step 4', async ({ page, context }) => {
  await context.grantPermissions(['microphone']);
  await resetAppState(page);
  await page.goto('/');

  await expect(page).toHaveURL(/\/onboarding/);

  // Step 1 — Welcome
  await expect(page.getByText(/ear training that uses your voice/i)).toBeVisible();
  if (process.env.UPDATE_SCREENSHOTS) {
    await page.screenshot({
      path: '../../docs/screenshots/c1-2/task5-onboarding-flow/step1-welcome.png',
      fullPage: true,
    });
  }
  await page.getByRole('button', { name: /continue/i }).click();

  // Step 2 — Mic permission
  await expect(page.getByRole('heading', { name: /grant microphone access/i })).toBeVisible();
  await page.getByRole('button', { name: /grant microphone access/i }).click();

  // Step 3 — Concept intro
  await expect(page.getByRole('heading', { name: /scale degrees/i })).toBeVisible();
  await page.getByRole('button', { name: /continue/i }).click();

  // Step 4 — Stub warmup
  await page.getByRole('button', { name: /start practicing/i }).click();

  // Lands on /scale-degree (Task 6 adds the placeholder route)
  await expect(page).toHaveURL(/\/scale-degree$/);
});

test('back button returns to previous step', async ({ page, context }) => {
  await context.grantPermissions(['microphone']);
  await resetAppState(page);
  await page.goto('/onboarding');
  await page.getByRole('button', { name: /continue/i }).click();
  await page.getByRole('button', { name: /back/i }).click();
  await expect(page.getByText(/ear training that uses your voice/i)).toBeVisible();
});
