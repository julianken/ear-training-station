/**
 * Visual regression spec.
 *
 * Captures pixel-level screenshots of key routes/states and diffs them against
 * committed baselines under `e2e/visual.spec.ts-snapshots/`. Failures surface
 * `*-actual.png`, `*-expected.png`, `*-diff.png` triplets in `test-results/`
 * which the `visual.yml` workflow uploads as an artifact.
 *
 * Baselines MUST be regenerated inside the Playwright Docker image
 * (`mcr.microsoft.com/playwright:v1.59.1-jammy`) — see playwright.visual.config.ts
 * header for the exact command. macOS-rendered baselines will fail every CI
 * run with antialiasing noise.
 *
 * Dynamic-content masking:
 * - StreakChip reads `Date.now()` each render → data-visual-test="ignore".
 * - PitchTrace.now-indicator animates via rAF → the whole <svg> is masked.
 *
 * Each snapshot waits for `document.fonts.ready` before capturing so the first
 * paint after an icon-font/cold-cache load never wins the race.
 */
import { test, expect, type Page } from '@playwright/test';
import { seedOnboarded, resetAppState } from './helpers/app-state';
import { seedActiveSession, seedDueItem } from './helpers/session-seed';
import { waitForController, forceState } from '@ear-training/e2e-audio-testing/tier3';
import type { RoundState } from '@ear-training/core/round/state';
import type { Item } from '@ear-training/core/types/domain';

/**
 * Shared capture hygiene: wait for fonts to finish loading and for the
 * network to be idle. `document.fonts.ready` alone is not enough — Vite's
 * dev server can still be streaming in chunks (HMR client, SvelteKit route
 * code) at the moment the test's DOM-visibility check resolves, which
 * produces a faint chrome on the first render that the second render
 * doesn't have. `networkidle` pins that down.
 */
async function stabilize(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
}

/**
 * All visual assertions share the same mask set. Adding the attribute at a
 * component boundary is the extension point — don't inline more locators here.
 */
function maskLocators(page: Page) {
  return [page.locator('[data-visual-test="ignore"]')];
}

test.describe('visual — desktop', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('station dashboard (onboarded)', async ({ page }) => {
    await seedOnboarded(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /scale-degree practice/i })).toBeVisible();
    await stabilize(page);
    await expect(page).toHaveScreenshot('station-dashboard-desktop.png', {
      mask: maskLocators(page),
      fullPage: false,
    });
  });

  test('onboarding step 1 (welcome)', async ({ page, context }) => {
    // Fresh user → redirected into /onboarding at step 1.
    await context.grantPermissions(['microphone']);
    await resetAppState(page);
    await page.goto('/');
    await expect(page).toHaveURL(/\/onboarding/);
    await expect(page.getByText(/ear training that uses your voice/i)).toBeVisible();
    await stabilize(page);
    await expect(page).toHaveScreenshot('onboarding-step1-desktop.png', {
      mask: maskLocators(page),
      fullPage: false,
    });
  });

  test('scale-degree picker/dashboard', async ({ page }) => {
    await seedOnboarded(page);
    await page.goto('/scale-degree');
    await expect(page.getByRole('heading', { name: /scale-degree practice/i })).toBeVisible();
    await stabilize(page);
    await expect(page).toHaveScreenshot('scale-degree-picker-desktop.png', {
      mask: maskLocators(page),
      fullPage: false,
    });
  });

  test('session screen — idle', async ({ page, context }) => {
    await context.grantPermissions(['microphone']);
    await seedOnboarded(page);
    await seedActiveSession(page, { id: 'visual-idle-sess' });
    await seedDueItem(page, { id: '5-C-major', degree: 5, key: { tonic: 'C', quality: 'major' } });

    await page.goto('/scale-degree/sessions/visual-idle-sess');
    // The Start Round button only renders once the controller has hydrated
    // and the round state is `idle` — a stable anchor that proves the page
    // is fully constructed.
    await expect(page.getByRole('button', { name: /start round/i })).toBeVisible();
    await stabilize(page);
    await expect(page).toHaveScreenshot('session-idle-desktop.png', {
      mask: maskLocators(page),
      fullPage: false,
    });
  });

  test('session screen — graded feedback (Tier 3 force state)', async ({ page, context }) => {
    await context.grantPermissions(['microphone']);
    await seedOnboarded(page);
    await seedActiveSession(page, { id: 'visual-graded-sess' });
    await seedDueItem(page, { id: '5-C-major', degree: 5, key: { tonic: 'C', quality: 'major' } });

    await page.goto('/scale-degree/sessions/visual-graded-sess');
    const handle = await waitForController<RoundState>(page);

    const currentItem = await handle.evaluate(
      (ctrl) => (ctrl as unknown as { currentItem: Item | null }).currentItem,
    );
    if (!currentItem) {
      throw new Error('Controller shim did not expose currentItem — shim sync needed');
    }

    // Deterministic graded state: at_ms is pinned to 0 so the PitchTrace
    // polyline geometry is constant across runs. (Its SVG is also masked
    // to absorb the rAF-animated now-indicator.)
    await forceState<RoundState>(page, {
      kind: 'graded',
      item: currentItem,
      timbre: 'piano',
      register: 'comfortable',
      outcome: { pitch: true, label: true, pass: true, at: 0 },
      cents_off: 4,
      sungBest: { at_ms: 0, hz: 392, confidence: 0.95 },
      digitHeard: 5,
      digitConfidence: 0.9,
    });

    await expect(page.getByText(/pitch/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /target/i })).toBeVisible();
    await stabilize(page);
    await expect(page).toHaveScreenshot('session-graded-desktop.png', {
      mask: maskLocators(page),
      fullPage: false,
    });
  });
});

test.describe('visual — mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('station dashboard (onboarded) — mobile', async ({ page }) => {
    await seedOnboarded(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /scale-degree practice/i })).toBeVisible();
    await stabilize(page);
    await expect(page).toHaveScreenshot('station-dashboard-mobile.png', {
      mask: maskLocators(page),
      fullPage: false,
    });
  });
});
