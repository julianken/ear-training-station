import { test, expect } from '@playwright/test';
import { seedOnboarded } from './helpers/app-state';
import { seedActiveSession, seedDueItem } from './helpers/session-seed';
import { waitForController, forceState } from '@ear-training/e2e-audio-testing/tier3';
import type { RoundState } from '@ear-training/core/round/state';
import type { Item } from '@ear-training/core/types/domain';

test('graded state renders FeedbackPanel and ReplayBar (Tier 3)', async ({ page, context }) => {
  await context.grantPermissions(['microphone']);
  await seedOnboarded(page);
  await seedActiveSession(page, { id: 'tier3-sess' });
  await seedDueItem(page, { id: '5-C-major', degree: 5, key: { tonic: 'C', quality: 'major' } });

  await page.goto('/scale-degree/sessions/tier3-sess');
  const handle = await waitForController<RoundState>(page);

  // Read currentItem out of the shim — needed to build the graded RoundState.
  // The ControllerHandle type doesn't include currentItem (it's app-specific), so cast.
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
    outcome: { pitch: true, label: true, pass: true, at: Date.now() },
    cents_off: 4,
    sungBest: { at_ms: 0, hz: 392, confidence: 0.95 },
    digitHeard: 5,
    digitConfidence: 0.9,
  });

  // FeedbackPanel renders a "Pitch" label cell.
  await expect(page.getByText(/pitch/i)).toBeVisible();
  // ReplayBar renders a "Target" replay button.
  await expect(page.getByRole('button', { name: /target/i })).toBeVisible();
});
