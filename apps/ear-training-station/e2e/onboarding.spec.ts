import { test, expect } from '@playwright/test';
import { resetAppState } from './helpers/app-state';

test('fresh user reaches the warmup round step in onboarding', async ({ page, context }) => {
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

  // Step 4 — Real warmup round: assert the heading is visible and the Start Round button renders.
  // Driving the full round (grading → finish) requires the audio stack to complete under
  // Playwright's fake media, which is tested more reliably at the controller integration level.
  await expect(page.getByRole('heading', { name: /your first round/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /start round/i })).toBeVisible();
  if (process.env.UPDATE_SCREENSHOTS) {
    await page.screenshot({
      path: '../../docs/screenshots/c1-3/task12-warmup-round/default.png',
      fullPage: true,
    });
  }
});

test('back button returns to previous step', async ({ page, context }) => {
  await context.grantPermissions(['microphone']);
  await resetAppState(page);
  await page.goto('/onboarding');
  await page.getByRole('button', { name: /continue/i }).click();
  await page.getByRole('button', { name: /back/i }).click();
  await expect(page.getByText(/ear training that uses your voice/i)).toBeVisible();
});
