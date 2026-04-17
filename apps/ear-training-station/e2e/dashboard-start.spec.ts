import { test, expect } from '@playwright/test';
import { seedOnboarded } from './helpers/app-state';

test('clicking Start on the exercise dashboard creates a session and navigates', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['microphone']);
  await seedOnboarded(page);
  await page.goto('/scale-degree');

  await expect(page.getByRole('heading', { name: /scale-degree practice/i })).toBeVisible();
  await page.getByRole('button', { name: /start/i }).click();

  await expect(page).toHaveURL(/\/scale-degree\/sessions\/[\w-]+$/);
});
