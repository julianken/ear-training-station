import { test, expect } from '@playwright/test';
import { seedOnboarded } from './helpers/app-state';

// TODO(Task 7, Task 8): Un-skip once FeedbackPanel and ReplayBar are implemented.
// This test seeds a graded state via the _forceState hook and verifies the UI
// renders correctly. The components it expects (FeedbackPanel showing "pitch",
// ReplayBar button named "target") do not exist until Tasks 7–8 land.
test.skip('graded state renders FeedbackPanel and ReplayBar (seeded via test hook)', async ({ page, context }) => {
  await context.grantPermissions(['microphone']);
  await seedOnboarded(page);

  // Seed an active session and a due item so the session route can construct a controller.
  await page.addInitScript(() => {
    return new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('ear-training', 1);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction(['sessions', 'items'], 'readwrite');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.objectStore('sessions').put({
          id: 'test-sess',
          started_at: Date.now(),
          ended_at: null,
          target_items: 30,
          completed_items: 0,
          pitch_pass_count: 0,
          label_pass_count: 0,
          focus_item_id: null,
        });
        // Seed at least one due item so the session route can construct a controller.
        tx.objectStore('items').put({
          id: '5-C-major',
          degree: 5,
          key: { tonic: 'C', quality: 'major' },
          box: 'new',
          accuracy: { pitch: 0, label: 0 },
          recent: [],
          attempts: 0,
          consecutive_passes: 0,
          last_seen_at: null,
          due_at: Date.now() - 1000,
          created_at: 0,
        });
      };
    });
  });

  await page.goto('/scale-degree/sessions/test-sess');

  // Wait for the controller to mount (ActiveRound renders a "Start" button in idle state).
  await page.waitForFunction(() => {
    // @ts-expect-error controller is exposed on window for e2e only
    return window.__sessionControllerForTest != null;
  });

  // Force a graded state via the test hook.
  await page.evaluate(() => {
    // @ts-expect-error controller is exposed on window for e2e only
    const ctrl = window.__sessionControllerForTest;
    ctrl._forceState({
      kind: 'graded',
      item: ctrl.currentItem,
      timbre: 'piano',
      register: 'comfortable',
      outcome: { pitch: true, label: true, pass: true, at: Date.now() },
      cents_off: 4,
      sungBest: { at_ms: 0, hz: 392, confidence: 0.95 },
      digitHeard: 5,
      digitConfidence: 0.9,
    });
  });

  // FeedbackPanel (Task 7) renders pitch pass/fail info.
  await expect(page.getByText(/pitch/i)).toBeVisible();
  // ReplayBar (Task 8) renders a "Target" replay button.
  await expect(page.getByRole('button', { name: /target/i })).toBeVisible();
});
