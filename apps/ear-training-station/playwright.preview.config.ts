/**
 * Playwright config for the offline/PWA e2e tests.
 *
 * Requires a production build before running — `pnpm run build` must complete
 * successfully so that dist/ contains the compiled service worker.
 *
 * Serves the build via `vite preview` on port 4173.  The service worker is
 * only emitted during `vite build` (devOptions.enabled: false in vite.config.ts),
 * which is why these tests cannot run against the dev server used by the default
 * playwright.config.ts.
 *
 * Usage:
 *   pnpm run build
 *   pnpm exec playwright test --config playwright.preview.config.ts
 *
 * CI: see .github/workflows/e2e.yml — the e2e-pwa job runs `pnpm run build` as a
 * dedicated step, then uses this config for a non-sharded single-job run.
 *
 * Launch flags: same rationale as playwright.config.ts (autoplay, audio sandbox).
 * The fake-capture flags are retained so the audio stack initialises without
 * errors even though no audio round is attempted in the offline tests.
 */
import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const audioFile = fileURLToPath(new URL('./e2e/fixtures/a4-sine.wav', import.meta.url));

export default defineConfig({
  testDir: './e2e',
  // Only run the offline-pwa spec via this config.
  testMatch: /offline-pwa\.spec\.ts$/,
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:4173',
    launchOptions: {
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        `--use-file-for-fake-audio-capture=${audioFile}`,
        '--autoplay-policy=no-user-gesture-required',
        ...(process.platform === 'darwin' ? ['--disable-features=AudioServiceSandbox'] : []),
      ],
      ignoreDefaultArgs: ['--mute-audio'],
    },
  },
  webServer: {
    // Serves the production build (build/) which includes the compiled service worker.
    // Prerequisite: build/ must exist — run `pnpm run build` first.
    // pnpm exec vite avoids the arg-passthrough `--` issue (see CLAUDE.md).
    command: 'pnpm exec vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173/',
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
