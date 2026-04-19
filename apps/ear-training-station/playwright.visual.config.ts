/**
 * Playwright config for visual regression tests.
 *
 * Scoped to `e2e/visual.spec.ts` and separate from `playwright.config.ts` so:
 * - Baseline directories (`visual.spec.ts-snapshots/`) don't mingle with
 *   behavior specs.
 * - Threshold tuning (`toHaveScreenshot` options) lives in one place.
 * - The visual spec doesn't need the fake-audio capture flags (no mic/audio).
 *
 * Baselines MUST be generated inside the Playwright Docker image used by CI
 * so font rendering matches Ubuntu (host macOS/Windows rendering would cause
 * every CI run to fail with antialiasing noise). See .github/workflows/visual.yml
 * and the docker run command in the PR description.
 *
 * Usage (local, Docker):
 *   docker run --rm -v "$(pwd):/work" -w /work/apps/ear-training-station \
 *     mcr.microsoft.com/playwright:v1.59.1-jammy \
 *     sh -c "corepack enable && pnpm install --frozen-lockfile && \
 *            pnpm exec playwright test --config playwright.visual.config.ts --update-snapshots"
 */
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/visual.spec.ts',
  timeout: 60_000,
  expect: {
    toHaveScreenshot: {
      // 1% pixel tolerance absorbs minor antialiasing jitter between runs
      // inside the same Docker image. Tighten if false-negatives show up;
      // DO NOT loosen past 0.02 without written justification.
      maxDiffPixelRatio: 0,
      maxDiffPixels: 0,
      // Per-pixel color tolerance. 0.2 matches Playwright's default and is
      // conservative enough to catch token-drift regressions (e.g. a cyan
      // token changing from #22d3ee to #ff0000 still produces tens of
      // thousands of wildly-different pixels, well above both thresholds).
      threshold: 0.2,
    },
  },
  use: {
    baseURL: 'http://localhost:5273',
    // Deterministic viewport default; individual describes may override via
    // test.use({ viewport }) for mobile-sized captures.
    viewport: { width: 1280, height: 800 },
    // Disable CSS animations/transitions at capture time so opacity/transform
    // tweens don't add capture-time flake. Does NOT pause rAF callbacks, so
    // rAF-animated elements (e.g. the pitch-trace now-indicator) still need
    // the data-visual-test="ignore" mask.
  },
  webServer: {
    // Isolated port (not 5173) so visual runs don't collide with an
    // engineer's local dev server. Same rationale as playwright.config.ts.
    command: 'pnpm exec vite dev --port 5273 --strictPort',
    url: 'http://localhost:5273/',
    reuseExistingServer: true,
    timeout: 30_000,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        // The Playwright Docker image (`mcr.microsoft.com/playwright`) ships
        // the browsers bundled with @playwright/test, so `channel` is left
        // unset. CI runs inside that image; local Docker regeneration uses
        // the same image, so font rendering matches across both.
      },
    },
  ],
});
