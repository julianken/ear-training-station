import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import { createSessionController } from './session-controller.svelte';
import { createItemsRepo } from '@ear-training/web-platform/store/items-repo';
import { createAttemptsRepo } from '@ear-training/web-platform/store/attempts-repo';
import { openEarTrainingDB, type DB } from '@ear-training/web-platform/store/db';
import type { Item, Session } from '@ear-training/core/types/domain';
import { allItems, degradationState } from '$lib/shell/stores';

/** Flush microtasks AND timer macrotasks — fake-indexeddb schedules tx completion via setTimeout(0). */
async function flushPromises(): Promise<void> {
  for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
}

const baseItem: Item = {
  id: '5-C-major',
  degree: 5,
  key: { tonic: 'C', quality: 'major' },
  box: 'new',
  accuracy: { pitch: 0, label: 0 },
  recent: [],
  attempts: 0,
  consecutive_passes: 0,
  last_seen_at: null,
  due_at: 0,
  created_at: 0,
};

const baseSession: Session = {
  id: 'sess-int-1',
  started_at: 0,
  ended_at: null,
  target_items: 30,
  completed_items: 0,
  pitch_pass_count: 0,
  label_pass_count: 0,
  focus_item_id: null,
};

async function makeRealDeps(db: DB) {
  const itemsRepo = createItemsRepo(db);
  const attemptsRepo = createAttemptsRepo(db);
  await itemsRepo.put(baseItem);
  return {
    session: baseSession,
    firstItem: baseItem,
    itemsRepo,
    attemptsRepo,
    sessionsRepo: { start: vi.fn(), complete: vi.fn(), get: vi.fn(async () => baseSession), findRecent: vi.fn(async () => []) },
    settingsRepo: {
      getOrDefault: vi.fn(async () => ({ function_tooltip: true, auto_advance_on_hit: true, session_length: 30, reduced_motion: 'auto' as const, onboarded: true })),
      update: vi.fn(),
    },
    getAudioContext: () => new (class { currentTime = 0; sampleRate = 48000; audioWorklet = { addModule: vi.fn(async () => undefined) }; createBuffer() { return {} as AudioBuffer; } createMediaStreamSource() { return { connect: vi.fn(), disconnect: vi.fn() }; } })() as unknown as AudioContext,
    getMicStream: async () => ({} as MediaStream),
  };
}

describe('SessionController — persistence against real IndexedDB', () => {
  let db: DB;

  beforeEach(async () => {
    indexedDB = new IDBFactory();
    db = await openEarTrainingDB('ear-training-test');
    allItems.set([]);
    degradationState.set({
      kwsUnavailable: false,
      persistenceFailing: false,
      micPermissionDenied: false,
      micLost: false,
    });
  });

  // Regression: $state-backed RoundState exposes item/sungBest/etc as reactive
  // Proxies. IDB structured-clone rejects Proxies → every round silently failed
  // to persist. Snapshot at the IDB boundary fixes it.
  it('persists attempt and updated item without DataCloneError', async () => {
    const deps = await makeRealDeps(db);
    const ctrl = createSessionController(deps);

    ctrl._forceState({
      kind: 'listening',
      item: baseItem,
      timbre: 'piano',
      register: 'comfortable',
      targetStartedAt: 0,
      frames: [{ at_ms: 100, hz: 392, confidence: 0.95 }],
      digit: 5,
      digitConfidence: 0.9,
    } as never);
    ctrl._checkCaptureEnd();
    await flushPromises();

    expect(get(degradationState).persistenceFailing).toBe(false);

    const persistedItem = await db.get('items', baseItem.id);
    expect(persistedItem).toBeDefined();
    expect(persistedItem!.attempts).toBe(1);
    expect(persistedItem!.box).toBe('learning');

    const persistedAttempts = await db.getAllFromIndex('attempts', 'by-session', baseSession.id);
    expect(persistedAttempts).toHaveLength(1);
    expect(persistedAttempts[0]!.item_id).toBe(baseItem.id);
    expect(persistedAttempts[0]!.graded.pass).toBe(true);
  });
});
