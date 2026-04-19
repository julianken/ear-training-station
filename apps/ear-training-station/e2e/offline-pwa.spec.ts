/**
 * Offline / PWA boot tests.
 *
 * These tests run exclusively against the PRODUCTION build served by `vite preview`
 * (port 4173, via playwright.preview.config.ts). The Vite dev server does NOT
 * emit a service worker (devOptions.enabled: false in vite.config.ts), so offline
 * tests cannot work against the dev server.
 *
 * CI: the e2e-pwa job runs `pnpm run build` as a dedicated step before launching
 * `vite preview`, so the SW is present in build/.
 *
 * Local: run `pnpm run build` once, then:
 *   pnpm exec playwright test --config playwright.preview.config.ts
 *
 * ── What we test ──────────────────────────────────────────────────────────────
 * 1. SW registers, installs, and activates on first visit.
 * 2. App shell renders correctly when offline after SW has precached assets.
 * 3. SW-served JS/CSS assets are returned from cache (fromServiceWorker: true)
 *    after the SW is active.
 *
 * ── Fix confirmed ─────────────────────────────────────────────────────────────
 * The SvelteKitPWA config now uses `kit.adapterFallback: 'index.html'` and
 * `kit.spa: true`, which adds `index.html` (keyed as `{url: 'index.html', ...}`)
 * to the precache manifest with a revision derived from `_app/version.json`.
 * The `NavigationRoute(createHandlerBoundToURL('index.html'))` therefore has a
 * precache entry to resolve and can serve the HTML shell offline.
 *
 * ── Why not a full round offline? ─────────────────────────────────────────────
 * The KWS TensorFlow model shards are fetched from tfhub.dev /
 * storage.googleapis.com at runtime (CacheFirst, "tfjs-models-cache"). In a
 * headless e2e environment those requests never fire because Playwright uses
 * fake-device media streams that bypass the KWS pipeline. A full offline round
 * would hit a network error on the KWS fetch rather than testing the SW shell.
 */
import { test, expect } from '@playwright/test';
import { seedOnboarded } from './helpers/app-state';

/**
 * Wait for the service worker to activate and control the page.
 *
 * `navigator.serviceWorker.ready` resolves when SW is in `activated` state,
 * but `page.evaluate` with a long-running Promise can race against Playwright's
 * evaluate timeout. `waitForFunction` polls the condition with an explicit
 * timeout instead, which is more resilient against slow SW installs.
 */
async function waitForSWController(page: import('@playwright/test').Page): Promise<void> {
  // First, wait until the SW is active (ready resolves).
  // We set a 30s timeout to allow the SW to finish precaching all assets.
  await page.waitForFunction(
    () =>
      navigator.serviceWorker.ready.then(() => true).catch(() => false),
    { timeout: 30_000 },
  );
  // Then confirm it's controlling the page.
  await page.waitForFunction(
    () => navigator.serviceWorker.controller !== null,
    { timeout: 15_000 },
  );
}

test.describe('offline PWA boot', () => {
  test('service worker activates and controls the page', async ({ page }) => {
    await seedOnboarded(page);
    await page.goto('/');

    await waitForSWController(page);

    const isControlled = await page.evaluate(
      () => navigator.serviceWorker.controller !== null,
    );
    expect(isControlled).toBe(true);
  });

  test('app shell renders when offline', async ({ page, context }) => {
    // ── Phase 1: first visit (online) — warm the SW precache ──────────────────
    await seedOnboarded(page);
    await page.goto('/');

    // Wait for install+activate to complete so the precache is fully warm.
    await waitForSWController(page);

    // Reload once online to confirm the SW is controlling the page before going
    // offline. This also exercises the SW's asset-serving path.
    await page.reload({ waitUntil: 'networkidle', timeout: 30_000 });

    // ── Phase 2: go offline + reload — SW must serve the shell from cache ──────
    await context.setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 15_000 });

    // The navigation <nav> rendered by +layout.svelte must be visible.
    // This confirms the SW served index.html offline (NavigationRoute hit).
    await expect(page.locator('nav').first()).toBeVisible({ timeout: 10_000 });

    // ── Phase 3: restore network ───────────────────────────────────────────────
    await context.setOffline(false);
  });

  test('critical assets served from SW cache when online', async ({ page }) => {
    // After SW activation, JS and CSS immutable chunks must be served from the
    // Workbox precache (fromServiceWorker: true). This confirms the precache is
    // populated and the SW is intercepting asset requests — a prerequisite for
    // the offline scenario to work.
    await seedOnboarded(page);
    await page.goto('/');

    await waitForSWController(page);

    // Collect immutable asset responses after the SW is active.
    const assetResponses: Array<{ url: string; fromSW: boolean; status: number }> = [];
    page.on('response', (response) => {
      const url = response.url();
      if (url.includes('/_app/immutable/')) {
        assetResponses.push({
          url,
          fromSW: response.fromServiceWorker(),
          status: response.status(),
        });
      }
    });

    // Reload to trigger asset fetches while the SW is active. On the second
    // load, Workbox serves precached assets from cache rather than the network.
    await page.reload({ waitUntil: 'networkidle', timeout: 30_000 });

    // At least some immutable assets must be served by the SW.
    const swAssets = assetResponses.filter((r) => r.fromSW);
    expect(
      swAssets.length,
      `Expected at least one immutable asset to be served from SW cache. ` +
        `Got ${assetResponses.length} asset responses total, ${swAssets.length} from SW.`,
    ).toBeGreaterThan(0);

    // All SW-served assets must have a 200 status.
    const badStatus = swAssets.filter((r) => r.status !== 200);
    expect(
      badStatus,
      `SW-served assets with non-200 status: ${badStatus.map((r) => `${r.status} ${r.url}`).join(', ')}`,
    ).toHaveLength(0);
  });
});
