import { describe, it, expect } from 'vitest';
import { createOrchestrator } from '@/session/orchestrator';
import { buildInitialItems } from '@/seed/initial-items';
import {
  createStubItemsRepo,
  createStubAttemptsRepo,
  createStubSessionsRepo,
} from '../helpers/stub-repos';
import type { Item } from '@/types/domain';

function setupOrchestrator(items?: Item[]) {
  const initialItems = items ?? buildInitialItems({ now: 0 });
  const itemsRepo = createStubItemsRepo(initialItems);
  const attemptsRepo = createStubAttemptsRepo();
  const sessionsRepo = createStubSessionsRepo();
  return createOrchestrator({
    itemsRepo,
    attemptsRepo,
    sessionsRepo,
    now: () => 1000,
    rng: () => 0.5,
  });
}

describe('pickFocusItem tie-break', () => {
  it('returns a focus item when all have identical accuracy', async () => {
    const orch = setupOrchestrator();
    await orch.startSession({ sessionId: 's1', target_items: 1 });
    const item = await orch.nextItem();
    expect(item).not.toBeNull();
    if (!item) return;
    await orch.recordAttempt({
      item,
      target: { hz: 440 },
      sung: { hz: 440, cents_off: 0, confidence: 0.9 },
      spoken: { digit: item.degree, confidence: 0.9 },
      pitchOk: true,
      labelOk: true,
      timbre: 'piano',
      register: 'narrow',
    });
    const session = await orch.completeSession();
    // With at least one item in the repo, focus_item_id is always set
    expect(session.focus_item_id).not.toBeNull();
  });

  it('picks the item with lower pitch accuracy', async () => {
    const items = buildInitialItems({ now: 0 });
    // Ensure we have at least two items to differentiate
    expect(items.length).toBeGreaterThanOrEqual(2);
    // Give all items a baseline accuracy first so no item stays at 0
    for (const item of items) {
      item.accuracy = { pitch: 0.8, label: 0.8 };
    }
    // Now mark the first item as the weakest
    items[0]!.accuracy = { pitch: 0.2, label: 0.5 };

    const orch = setupOrchestrator(items);
    // target_items: 0 → nextItem returns null immediately, completeSession still runs
    await orch.startSession({ sessionId: 's1', target_items: 0 });
    const session = await orch.completeSession();
    // items[0] has the lowest pitch accuracy — it should be the focus item
    expect(session.focus_item_id).toBe(items[0]!.id);
  });
});

describe('nextItem after completeSession', () => {
  it('throws when called after completeSession without a new startSession', async () => {
    const orch = setupOrchestrator();
    await orch.startSession({ sessionId: 's1', target_items: 1 });
    await orch.completeSession();
    await expect(orch.nextItem()).rejects.toThrow();
  });
});

describe('startSession guard', () => {
  it('throws when called a second time without completing the first session', async () => {
    const orch = setupOrchestrator();
    await orch.startSession({ sessionId: 's1', target_items: 1 });
    await expect(
      orch.startSession({ sessionId: 's2', target_items: 1 }),
    ).rejects.toThrow();
  });
});

describe('session bookkeeping', () => {
  it('records completed_items, pitch_pass_count, label_pass_count accurately', async () => {
    const orch = setupOrchestrator();
    await orch.startSession({ sessionId: 's1', target_items: 1 });
    const item = await orch.nextItem();
    expect(item).not.toBeNull();
    if (!item) return;

    await orch.recordAttempt({
      item,
      target: { hz: 440 },
      sung: { hz: 440, cents_off: 0, confidence: 0.9 },
      spoken: { digit: item.degree, confidence: 0.9 },
      pitchOk: true,
      labelOk: true,
      timbre: 'piano',
      register: 'narrow',
    });

    const session = await orch.completeSession();
    expect(session.completed_items).toBe(1);
    expect(session.pitch_pass_count).toBe(1);
    expect(session.label_pass_count).toBe(1);
  });

  it('counts only passing dimensions in pass counts', async () => {
    const orch = setupOrchestrator();
    await orch.startSession({ sessionId: 's1', target_items: 1 });
    const item = await orch.nextItem();
    expect(item).not.toBeNull();
    if (!item) return;

    await orch.recordAttempt({
      item,
      target: { hz: 440 },
      sung: { hz: 400, cents_off: 90, confidence: 0.6 },
      spoken: { digit: item.degree, confidence: 0.9 },
      pitchOk: false,  // pitch missed
      labelOk: true,   // label correct
      timbre: 'piano',
      register: 'narrow',
    });

    const session = await orch.completeSession();
    expect(session.pitch_pass_count).toBe(0);
    expect(session.label_pass_count).toBe(1);
  });
});
