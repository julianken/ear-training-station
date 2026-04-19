import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSessionController } from './session-controller.svelte';
import { createItemsRepo } from '@ear-training/web-platform/store/items-repo';
import { createAttemptsRepo } from '@ear-training/web-platform/store/attempts-repo';
import { openEarTrainingDB, type DB } from '@ear-training/web-platform/store/db';
import type { Item, Session } from '@ear-training/core/types/domain';
import type { Key, Degree } from '@ear-training/core/types/music';
import { itemId } from '@ear-training/core/types/music';
import { allItems, degradationState } from '$lib/shell/stores';

/**
 * RCA for #155 — drive the session controller's next() code path with the
 * exact 28-item probe state + 6-round history and verify that next() advances
 * to a real item rather than ending the session.
 */
async function flushPromises(): Promise<void> {
  for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
}

function mkKey(tonic: 'C' | 'G' | 'D' | 'A'): Key {
  return { tonic, quality: 'major' };
}

function mkItem(deg: Degree, tonic: 'C' | 'G' | 'D' | 'A'): Item {
  const key = mkKey(tonic);
  return {
    id: itemId(deg, key),
    degree: deg,
    key,
    box: 'new',
    accuracy: { pitch: 0, label: 0 },
    recent: [],
    attempts: 0,
    consecutive_passes: 0,
    last_seen_at: null,
    due_at: 0,
    created_at: 0,
  };
}

describe('SessionController next() — RCA #155 repro', () => {
  let db: DB;

  beforeEach(async () => {
    // @ts-expect-error fake-indexeddb global
    indexedDB = new IDBFactory();
    db = await openEarTrainingDB('ear-training-rca-controller');
    allItems.set([]);
    degradationState.set({
      kwsUnavailable: false,
      persistenceFailing: false,
      micPermissionDenied: false,
      micLost: false,
    });
  });

  it('with 28 items + 6-round probe history, next() does NOT end the session', async () => {
    const itemsRepo = createItemsRepo(db);
    const attemptsRepo = createAttemptsRepo(db);

    // Seed 28 items (C/G/D/A × 7 degrees).
    const tonics: Array<'C' | 'G' | 'D' | 'A'> = ['C', 'G', 'D', 'A'];
    const seeded: Item[] = [];
    for (const t of tonics) {
      for (let d = 1 as Degree; d <= 7; d = ((d + 1) | 0) as Degree) {
        const it = mkItem(d, t);
        await itemsRepo.put(it);
        seeded.push(it);
      }
    }

    const sessionRow: Session = {
      id: 'qa-session',
      started_at: 0,
      ended_at: null,
      target_items: 15,
      completed_items: 5, // 5 rounds already completed in-memory per controller state
      pitch_pass_count: 0,
      label_pass_count: 0,
    };

    const sessionsComplete = vi.fn(async () => undefined);
    const ctrl = createSessionController({
      session: sessionRow,
      firstItem: seeded[0]!,
      itemsRepo,
      attemptsRepo,
      sessionsRepo: {
        start: vi.fn(),
        complete: sessionsComplete,
        get: vi.fn(async () => sessionRow),
        findRecent: vi.fn(async () => []),
      },
      settingsRepo: {
        getOrDefault: vi.fn(async () => ({
          function_tooltip: true,
          auto_advance_on_hit: true,
          session_length: 15,
          reduced_motion: 'auto' as const,
          onboarded: true,
        })),
        update: vi.fn(),
      },
      getAudioContext: () => ({} as AudioContext),
      getMicStream: async () => ({} as MediaStream),
      rng: () => 0.5,
    });

    // Seed the 6-round history the probe reported, via the test hook.
    ctrl._seedRoundHistory([
      { itemId: itemId(1, mkKey('A')), degree: 1, key: mkKey('A') },
      { itemId: itemId(7, mkKey('D')), degree: 7, key: mkKey('D') },
      { itemId: itemId(5, mkKey('G')), degree: 5, key: mkKey('G') },
      { itemId: itemId(7, mkKey('D')), degree: 7, key: mkKey('D') },
      { itemId: itemId(3, mkKey('G')), degree: 3, key: mkKey('G') },
      { itemId: itemId(5, mkKey('D')), degree: 5, key: mkKey('D') },
    ]);

    // Force into graded state (what state.kind === 'graded' guard in next() requires).
    ctrl._forceState({
      kind: 'graded',
      item: seeded[0]!,
      timbre: 'piano',
      register: 'comfortable',
      outcome: { pitch: true, label: false, pass: false, at: 0 },
      cents_off: 0,
      sungBest: null,
      digitHeard: null,
      digitConfidence: 0,
    } as never);

    await ctrl.next();
    await flushPromises();

    // Expected: session NOT ended; a real item is now currentItem.
    expect(ctrl.session?.ended_at).toBeNull();
    expect(ctrl.session?.completed_items).toBe(6);
    expect(ctrl.currentItem).not.toBeNull();
    expect(sessionsComplete).not.toHaveBeenCalled();
  });
});
