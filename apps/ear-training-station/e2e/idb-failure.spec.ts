/**
 * IDB failure path — DegradationBanner + persistenceFailing
 *
 * Verifies the app degrades gracefully when IndexedDB is unavailable or
 * write-blocked, covering GitHub issue #119 (Safari private mode / Firefox
 * strict privacy).
 *
 * Two cases:
 *
 *   Case A — `indexedDB.open` throws synchronously at module load (Safari
 *             private mode). The +layout.ts load() function calls getDeps()
 *             which calls indexedDB.open. When open() throws, the rejection
 *             is unhandled and the page renders blank.
 *
 *             BUG (tracked in #119): the page goes blank instead of showing
 *             DegradationBanner or the error boundary. The +layout.ts load()
 *             function does not catch IDB failures — it relies on the
 *             +layout.svelte onMount handleHydrationError path, which is
 *             never reached when load() itself throws. Case A is marked
 *             test.fixme() to document the expected behavior and will be
 *             enabled once the fix lands.
 *
 *   Case B — `IDBObjectStore.prototype.put` throws after the DB is open
 *             (quota exhaustion, mid-session). The session controller catches
 *             this in its try/catch and sets degradationState.persistenceFailing,
 *             which causes DegradationBanner to render "Saving locally failed".
 *             This path WORKS and is tested here without a fixme.
 *
 * Engine coverage: the Playwright config runs Chromium only (the default for
 * this project). The IDB stub provides engine-independent coverage of the
 * failure-handling logic; real Safari / Firefox verification of the original
 * probe (#119) remains as a manual task but is reduced in scope.
 */

import { test, expect } from '@playwright/test';
import { seedOnboarded } from './helpers/app-state';
import { seedActiveSession, seedDueItem } from './helpers/session-seed';
import { waitForController } from '@ear-training/e2e-audio-testing/tier3';
import type { RoundState } from '@ear-training/core/round/state';
import type { Item } from '@ear-training/core/types/domain';

// ── Case A: IDB open() throws (Safari private mode) ──────────────────────────
//
// BUG: the +layout.ts load() calls getDeps() → openEarTrainingDB() →
// indexedDB.open(). When open() throws synchronously, SvelteKit's client-side
// router receives an unhandled rejection and leaves the page blank instead of
// rendering the error boundary or DegradationBanner. The onMount
// handleHydrationError path is never reached.
//
// This test is marked fixme to document the expected behavior; enable it when
// the load() function is updated to catch IDB failures and set persistenceFailing
// (or redirect to the error page) rather than letting the rejection propagate.

test.fixme(
  'Case A: indexedDB.open throws — DegradationBanner shows "Saving locally failed"',
  async ({ page }) => {
    // Stub BEFORE any page script runs. Safari private mode (and historical
    // Firefox strict privacy) throws synchronously from indexedDB.open.
    await page.addInitScript(() => {
      /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
      (indexedDB as any).open = (..._args: unknown[]) => {
        throw new DOMException('The operation is insecure.', 'SecurityError');
      };
      /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
    });

    await page.goto('/');

    // After fix: the shell must show the persistence-failing message from
    // DegradationBanner instead of a blank page or generic error boundary.
    await expect(
      page.getByText(/saving locally failed/i),
    ).toBeVisible({ timeout: 10_000 });

    // The shell header must still render (not a blank page / error boundary).
    await expect(page.getByText(/ear training/i)).toBeVisible();
  },
);

// ── Case B: IDBObjectStore.put throws (quota exhausted mid-session) ───────────

test('Case B: IDBObjectStore.put throws during round — DegradationBanner shows "Saving locally failed"', async ({ page, context }) => {
  // Grant mic so the session controller mounts (it calls queryMicPermission on load).
  await context.grantPermissions(['microphone']);

  // Seed IDB normally so the DB opens and hydration succeeds.
  await seedOnboarded(page);
  await seedActiveSession(page, { id: 'idb-fail-sess' });
  await seedDueItem(page, { id: '5-C-major', degree: 5, key: { tonic: 'C', quality: 'major' } });

  await page.goto('/scale-degree/sessions/idb-fail-sess');

  // Wait for the session controller shim to mount (exposed in dev/test mode).
  const handle = await waitForController<RoundState>(page);

  // Read the first item the controller resolved — needed to build the listening state.
  const currentItem = await handle.evaluate(
    (ctrl) => (ctrl as unknown as { currentItem: Item | null }).currentItem,
  );
  if (!currentItem) {
    throw new Error('Controller shim did not expose currentItem — shim sync needed');
  }

  // Patch IDBObjectStore.prototype.put AFTER the DB has opened and hydration
  // succeeded. From this point any put() call (attemptsRepo.append or
  // itemsRepo.put) will throw synchronously, simulating quota-exhaustion.
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    IDBObjectStore.prototype.put = function (..._args) {
      throw new DOMException('QuotaExceededError', 'QuotaExceededError');
    };
  });

  // Drive the session controller through the listening→graded path using the
  // real #dispatch flow (not _forceState, which bypasses persistence).
  //
  // _forceState sets the state to 'listening' with a passing pitch frame + digit,
  // then _checkCaptureEnd() calls gradeListeningState() and dispatches
  // CAPTURE_COMPLETE — which triggers the try/catch persistence block that
  // catches the put() error and flips degradationState.persistenceFailing.
  await page.evaluate(
    ({ name, item }: { name: string; item: Item }) => {
      const ctrl = (window as unknown as Record<string, {
        _forceState(s: unknown): void;
        _checkCaptureEnd(): void;
      }>)[name];
      if (!ctrl?._forceState) throw new Error(`No _forceState on window.${name}`);
      if (!ctrl?._checkCaptureEnd) throw new Error(`No _checkCaptureEnd on window.${name}`);

      ctrl._forceState({
        kind: 'listening',
        item,
        timbre: 'piano',
        register: 'comfortable',
        targetStartedAt: 0,
        // G4 ≈ 392 Hz = scale degree 5 of C major — matches seeded item
        frames: [{ at_ms: 100, hz: 392, confidence: 0.95 }],
        digit: 5,
        digitConfidence: 0.9,
      });
      ctrl._checkCaptureEnd();
    },
    { name: '__sessionControllerForTest', item: currentItem },
  );

  // Wait for the async persistence catch to propagate through the microtask queue.
  // DegradationBanner reacts to the Svelte store update on the next tick.
  await expect(
    page.getByText(/saving locally failed/i),
  ).toBeVisible({ timeout: 10_000 });
});
