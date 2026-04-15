import { test, expect } from '@playwright/test';

test('audio harness: pitch detector reports ~440 Hz on fake sine input', async ({ page }) => {
  await page.goto('/harness/audio.html');

  // Start pitch detection
  await page.click('#start-pitch');

  // Give the worklet time to load and a few frames to arrive
  await page.waitForFunction(
    () => {
      const el = document.getElementById('pitch-hz');
      if (!el) return false;
      const txt = el.textContent ?? '';
      const n = Number(txt);
      return Number.isFinite(n) && n > 400 && n < 480;
    },
    { timeout: 15_000 },
  );

  const hzText = await page.textContent('#pitch-hz');
  const hz = Number(hzText);
  expect(hz).toBeGreaterThan(430);
  expect(hz).toBeLessThan(450);
});
