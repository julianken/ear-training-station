// Chromium launch-flag rationale:
//
// --autoplay-policy=no-user-gesture-required
//   Lets AudioContext start in `running` state without a user gesture. Belt-and-braces:
//   Playwright's page.evaluate() is treated as a user gesture internally, but app code
//   that runs at page load (not inside evaluate) benefits from the explicit policy.
//
// ignoreDefaultArgs: ['--mute-audio']
//   Playwright adds --mute-audio by default in headless Chromium, which silences speaker
//   output. We need unmuted output for any test that plays audio through Tone.js → system
//   output (and for correctness even when we don't capture it back).
//
// --disable-features=AudioServiceSandbox (darwin only)
//   Chromium's macOS audio-service sandbox blocks --use-file-for-fake-audio-capture from
//   reading the WAV file (chromium bug 1032604 / 40662946). Disabling the sandbox for
//   that process allows fake capture to work. This flag is a no-op on Linux CI.

import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const audioFile = fileURLToPath(new URL('./e2e/fixtures/a4-sine.wav', import.meta.url));

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  // offline-pwa.spec.ts requires a production build served by `vite preview` —
  // it cannot run against the Vite dev server (SW not emitted in dev mode).
  // Run it via `pnpm exec playwright test --config playwright.preview.config.ts`.
  //
  // visual.spec.ts is a separate visual-regression suite with its own config
  // (`playwright.visual.config.ts`) — excluded here so the default `pnpm
  // exec playwright test` and sharded e2e CI runs skip it. Baselines live
  // under `e2e/visual.spec.ts-snapshots/` and must be regenerated inside
  // the Playwright Docker image to match CI font rendering.
  testIgnore: [/offline-pwa\.spec\.ts$/, /visual\.spec\.ts$/],
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:5273',
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
    // Isolated port (not 5173) so playwright tests don't collide with an engineer's local dev server.
    // pnpm run dev would inject a literal `--` that vite treats as end-of-flags (dropping the port
    // override silently); pnpm exec vite bypasses that. See CLAUDE.md for the same pnpm-arg gotcha.
    command: 'pnpm exec vite dev --port 5273 --strictPort',
    url: 'http://localhost:5273/',
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
