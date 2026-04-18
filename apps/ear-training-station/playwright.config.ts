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
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:5173',
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
    command: 'pnpm run dev',
    url: 'http://localhost:5173/',
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
