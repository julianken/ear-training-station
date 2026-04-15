import { describe, it, expect } from 'vitest';
import { createOrchestrator, type Orchestrator } from '@/session/orchestrator';
import { createItemsRepo } from '@/store/items-repo';
import { createAttemptsRepo } from '@/store/attempts-repo';
import { createSessionsRepo } from '@/store/sessions-repo';
import { openTestDB } from '../helpers/test-db';
import { buildInitialItems } from '@/seed/initial-items';

async function setup(): Promise<Orchestrator> {
  const db = await openTestDB();
  const itemsRepo = createItemsRepo(db);
  const attemptsRepo = createAttemptsRepo(db);
  const sessionsRepo = createSessionsRepo(db);
  await itemsRepo.putMany(buildInitialItems({ now: 0 }));
  return createOrchestrator({
    itemsRepo,
    attemptsRepo,
    sessionsRepo,
    now: () => 1_000,
    rng: () => 0.5,
    sessionId: 'sess-1',
  });
}

describe('orchestrator', () => {
  it('starts a session and returns a first item', async () => {
    const orch = await setup();
    await orch.startSession({ target_items: 10 });
    const first = await orch.nextItem();
    expect(first).not.toBe(null);
  });

  it('updates item state on pass (advances toward promotion)', async () => {
    const orch = await setup();
    await orch.startSession({ target_items: 10 });
    const first = await orch.nextItem();
    if (!first) throw new Error('expected item');

    await orch.recordAttempt({
      item: first,
      target: { hz: 440, degree: first.degree },
      sung: { hz: 441, cents_off: 4, confidence: 0.9 },
      spoken: { digit: first.degree, confidence: 0.95 },
      pitchOk: true,
      labelOk: true,
      timbre: 'piano',
      register: 'comfortable',
    });

    const after = await orch.peekItem(first.id);
    expect(after).toBeDefined();
    expect(after!.attempts).toBe(1);
    expect(after!.consecutive_passes).toBe(1);
    // new -> learning on first pass
    expect(after!.box).toBe('learning');
  });

  it('demotes box on miss from reviewing to learning', async () => {
    const orch = await setup();
    await orch.startSession({ target_items: 10 });
    const first = await orch.nextItem();
    if (!first) throw new Error('expected item');

    // Force a reviewing state and re-fetch so the Item reference is fresh.
    await orch.forceSetBox(first.id, 'reviewing');
    const fresh = await orch.peekItem(first.id);
    if (!fresh) throw new Error('missing item after forceSetBox');

    await orch.recordAttempt({
      item: fresh,
      target: { hz: 440, degree: fresh.degree },
      sung: { hz: 470, cents_off: 100, confidence: 0.9 },
      spoken: { digit: 7, confidence: 0.6 },
      pitchOk: false,
      labelOk: false,
      timbre: 'piano',
      register: 'comfortable',
    });

    const after = await orch.peekItem(fresh.id);
    expect(after!.box).toBe('learning');
    expect(after!.consecutive_passes).toBe(0);
  });

  it('completes a session and aggregates stats', async () => {
    const orch = await setup();
    await orch.startSession({ target_items: 2 });

    for (let i = 0; i < 2; i++) {
      const it = await orch.nextItem();
      if (!it) break;
      await orch.recordAttempt({
        item: it,
        target: { hz: 440, degree: it.degree },
        sung: { hz: 441, cents_off: 4, confidence: 0.9 },
        spoken: { digit: it.degree, confidence: 0.95 },
        pitchOk: true,
        labelOk: true,
        timbre: 'piano',
        register: 'comfortable',
      });
    }

    const summary = await orch.completeSession();
    expect(summary.completed_items).toBe(2);
    expect(summary.pitch_pass_count).toBe(2);
    expect(summary.label_pass_count).toBe(2);
  });
});
