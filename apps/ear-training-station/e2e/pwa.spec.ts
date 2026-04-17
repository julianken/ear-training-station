/**
 * PWA service worker tests.
 *
 * NOTE: Service worker registration does not function in Vite's dev server
 * (devOptions.enabled is false in vite.config.ts to avoid SW hijacking HMR).
 * These tests require `pnpm run preview` against a production build.
 *
 * The test below is skipped in the default CI Playwright run (which uses the
 * dev server). To verify manually:
 *
 *   pnpm run build
 *   pnpm run preview
 *   # Set PW_BASE_URL=http://localhost:4173 and run the test with --no-skip
 *
 * A future task can add a separate Playwright project targeting the preview
 * server once the CI workflow has a build step before the e2e run.
 */
import { test, expect } from '@playwright/test';
import { seedOnboarded } from './helpers/app-state';

test.skip('service worker registers and app boots offline', async ({ page, context }) => {
  // This test requires a production build served via `pnpm run preview`.
  // The dev server does not register the service worker (devOptions.enabled: false).
  // See the file-level comment above.

  await seedOnboarded(page);
  await page.goto('/');

  // Wait for the service worker to be activated and controlling the page.
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, {
    timeout: 15_000,
  });

  // Now go offline and reload — the precached shell should serve the page.
  await context.setOffline(true);
  await page.reload();

  await expect(page.getByRole('heading', { name: /choose an exercise/i })).toBeVisible({
    timeout: 10_000,
  });
});

test('web manifest link is present in the HTML head', async ({ page }) => {
  await seedOnboarded(page);
  await page.goto('/');

  // The <link rel="manifest"> is injected by SvelteKitPWA's head injection.
  // In dev mode, it still injects the reference (even if SW is not active),
  // so this test is stable in both dev and production modes.
  const manifestLink = await page.evaluate(() => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    return link?.href ?? null;
  });

  expect(manifestLink).not.toBeNull();
  expect(manifestLink).toMatch(/manifest\.webmanifest/);
});
