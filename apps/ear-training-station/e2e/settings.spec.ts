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

test('toggling function tooltip persists across client-side navigation', async ({ page }) => {
  await seedOnboarded(page, { function_tooltip: true });
  await page.goto('/settings');
  const toggle = page.getByLabel(/function tooltip/i);
  await expect(toggle).toBeChecked();
  await toggle.click();
  // Wait for the toggle to visually reflect unchecked (reactive store update)
  await expect(toggle).not.toBeChecked();
  // Navigate away via client-side link (no re-seeding — addInitScript only fires on page.goto)
  await page.getByRole('link', { name: /ear training/i }).click();
  await page.waitForURL('/');
  // Navigate back via client-side link
  await page.getByRole('link', { name: /settings/i }).click();
  await page.waitForURL('/settings');
  await expect(page.getByLabel(/function tooltip/i)).not.toBeChecked();
});

test('reset-progress button opens confirmation dialog', async ({ page }) => {
  await seedOnboarded(page);
  await page.goto('/settings');
  await page.getByRole('button', { name: /reset progress/i }).click();
  await expect(page.getByText(/this will permanently delete/i)).toBeVisible();
});
