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
      ],
    },
  },
  webServer: {
    command: 'pnpm run dev',
    url: 'http://localhost:5173/harness/audio.html',
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
