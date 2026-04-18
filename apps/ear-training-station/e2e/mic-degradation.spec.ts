import { test, expect } from '@playwright/test';
import { seedOnboarded } from './helpers/app-state';
import { seedActiveSession, seedDueItem } from './helpers/session-seed';
import { overrideGetUserMediaWith, simulateMicLoss } from '@ear-training/e2e-audio-testing/tier2';
import { waitForController, injectPitchFrame, forceState } from '@ear-training/e2e-audio-testing/tier3';
import type { RoundState } from '@ear-training/core/round/state';
import type { Item } from '@ear-training/core/types/domain';

test('consecutiveNullCount increments trigger PitchNullHint (Tier 2)', async ({ page, context }) => {
  await context.grantPermissions(['microphone']);
  await seedOnboarded(page);
  await seedActiveSession(page, { id: 'tier2-sess' });
  await seedDueItem(page);

  await overrideGetUserMediaWith(page, { kind: 'silence' });
  await page.goto('/scale-degree/sessions/tier2-sess');

  const handle = await waitForController<RoundState>(page);

  // Three null frames advance the shell's consecutiveNullCount store to 3.
  // Controller's _onPitchFrame writes: hz <= 0 || confidence < 0.5 → increment; else reset to 0.
  await injectPitchFrame(page, { hz: 0, confidence: 0.1 });
  await injectPitchFrame(page, { hz: 0, confidence: 0.1 });
  await injectPitchFrame(page, { hz: 0, confidence: 0.1 });

  // Force the controller into graded state so FeedbackPanel mounts. _forceState
  // does NOT touch consecutiveNullCount (it only replaces this.state), so the
  // null count persists at 3 across the transition — this is the invariant
  // the test relies on to render PitchNullHint via FeedbackPanel's
  // {#if $consecutiveNullCount >= 3} branch.
  const currentItem = await handle.evaluate(
    (ctrl) => (ctrl as unknown as { currentItem: Item | null }).currentItem,
  );
  if (!currentItem) {
    throw new Error('Controller shim did not expose currentItem — shim sync needed');
  }

  await forceState<RoundState>(page, {
    kind: 'graded',
    item: currentItem,
    timbre: 'piano',
    register: 'comfortable',
    outcome: { pitch: false, label: false, pass: false, at: Date.now() },
    cents_off: null,
    sungBest: null,
    digitHeard: null,
    digitConfidence: 0,
  });

  // PitchNullHint renders this text when consecutiveNullCount >= 3.
  await expect(
    page.getByText(/we're not hearing anything clearly/i),
  ).toBeVisible();
});

test('simulateMicLoss dispatches ended on synthetic audio tracks (Tier 2)', async ({ page, context }) => {
  await context.grantPermissions(['microphone']);
  await seedOnboarded(page);
  await seedActiveSession(page, { id: 'tier2-micloss' });
  await seedDueItem(page);

  await overrideGetUserMediaWith(page, { kind: 'tone', hz: 440 });
  await page.goto('/scale-degree/sessions/tier2-micloss');
  await waitForController(page);

  // The app renders a "Start round" button while the controller is in the idle state.
  // Clicking it calls startRound() → getMicStream() → getUserMedia(), which populates
  // __e2eSyntheticAudio on the page. We must trigger this before attaching the ended listener.
  await page.getByRole('button', { name: /start round/i }).click();

  // Wait for getUserMedia to be called by the app so __e2eSyntheticAudio is populated.
  // The surface is lazy-initialized on the first audio getUserMedia call.
  await page.waitForFunction(() => {
    // @ts-expect-error test-only surface
    return window.__e2eSyntheticAudio !== undefined;
  }, { timeout: 10000 });

  // Attach a counter to the synthetic track's ended event BEFORE simulating loss.
  await page.evaluate(() => {
    // @ts-expect-error window.__e2eSyntheticAudio is a test-only surface from tier2-gum-mock
    const synth = window.__e2eSyntheticAudio;
    const tracks: MediaStreamTrack[] = synth.stream.getAudioTracks();
    // @ts-expect-error ad-hoc counter on window for this test
    window.__endedCount = 0;
    for (const t of tracks) {
      t.addEventListener('ended', () => {
        // @ts-expect-error ad-hoc counter
        window.__endedCount++;
      });
    }
  });

  await simulateMicLoss(page);

  const endedCount = await page.evaluate(() => {
    // @ts-expect-error ad-hoc counter
    return window.__endedCount as number;
  });
  expect(endedCount).toBeGreaterThanOrEqual(1);
});
