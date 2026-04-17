import { describe, expect, it, vi } from 'vitest';
import { createSessionController } from './session-controller.svelte';
import type { Item, Session } from '@ear-training/core/types/domain';
import type { RoundState } from '@ear-training/core/round/state';

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
  id: 'sess-1',
  started_at: 0,
  ended_at: null,
  target_items: 30,
  completed_items: 0,
  pitch_pass_count: 0,
  label_pass_count: 0,
  focus_item_id: null,
};

function makeDeps() {
  return {
    session: baseSession,
    firstItem: baseItem,
    itemsRepo: { get: vi.fn(), listAll: vi.fn(async () => []), findDue: vi.fn(async () => [baseItem]), findByBox: vi.fn(), put: vi.fn(), putMany: vi.fn() },
    attemptsRepo: { append: vi.fn(), findBySession: vi.fn(async () => []), findByItem: vi.fn() },
    sessionsRepo: { start: vi.fn(), complete: vi.fn(), get: vi.fn(async () => baseSession), findRecent: vi.fn() },
    settingsRepo: { getOrDefault: vi.fn(async () => ({ function_tooltip: true, auto_advance_on_hit: true, session_length: 30, reduced_motion: 'auto' as const, onboarded: true })), update: vi.fn() },
    getAudioContext: () => new (class { currentTime = 0; sampleRate = 48000; audioWorklet = { addModule: vi.fn(async () => undefined) }; createBuffer() { return {} as AudioBuffer; } createMediaStreamSource() { return { connect: vi.fn(), disconnect: vi.fn() }; } })() as unknown as AudioContext,
    getMicStream: async () => ({} as MediaStream),
  };
}

describe('SessionController', () => {
  it('starts in idle state', () => {
    const ctrl = createSessionController(makeDeps());
    expect(ctrl.state.kind).toBe('idle');
  });

  it('exposes session and currentItem', () => {
    const ctrl = createSessionController(makeDeps());
    expect(ctrl.session?.id).toBe('sess-1');
    expect(ctrl.currentItem?.id).toBe('5-C-major');
  });

  it('cancelRound() dispatches USER_CANCELED', () => {
    const ctrl = createSessionController(makeDeps());
    ctrl._forceState({ kind: 'playing_cadence', item: baseItem, timbre: 'piano', register: 'comfortable', startedAt: 0 } as never);
    ctrl.cancelRound();
    expect(ctrl.state.kind).toBe('idle');
  });

  it('dispose() is idempotent', () => {
    const ctrl = createSessionController(makeDeps());
    ctrl.dispose();
    expect(() => ctrl.dispose()).not.toThrow();
  });
});

describe('SessionController — capture-end + CAPTURE_COMPLETE', () => {
  it('auto-advances to graded when pitch + digit both confident (auto_advance_on_hit = true)', () => {
    // This is a behavioral test; the mechanism is internal. We validate it
    // by forcing a listening state with confident frames + digit and waiting
    // for the state to flip to graded.
    const ctrl = createSessionController(makeDeps());
    ctrl._forceState({
      kind: 'listening',
      item: baseItem, timbre: 'piano', register: 'comfortable',
      targetStartedAt: 0,
      frames: [{ at_ms: 100, hz: 392, confidence: 0.95 }],
      digit: 5,
      digitConfidence: 0.9,
    } as never);
    // Manually invoke the capture-end check (Task 6 exposes _checkCaptureEnd test hook)
    ctrl._checkCaptureEnd();
    expect(ctrl.state.kind).toBe('graded');
  });

  it('does not auto-advance if confidence is below threshold', () => {
    const ctrl = createSessionController(makeDeps());
    ctrl._forceState({
      kind: 'listening',
      item: baseItem, timbre: 'piano', register: 'comfortable',
      targetStartedAt: 0,
      frames: [{ at_ms: 100, hz: 392, confidence: 0.3 }],
      digit: 5,
      digitConfidence: 0.3,
    } as never);
    ctrl._checkCaptureEnd();
    expect(ctrl.state.kind).toBe('listening');
  });

  it('clears the capture-end timer when auto-advancing to graded', () => {
    vi.useFakeTimers();
    try {
      const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');

      const ctrl = createSessionController(makeDeps());

      // Plant a fake timer id to simulate a pending capture-end setTimeout
      const fakeTimerId = setTimeout(() => {}, 5000);
      ctrl._forceTimer(fakeTimerId as unknown as number);

      // Force into a listening state that will produce a passing grade
      ctrl._forceState({
        kind: 'listening',
        item: baseItem, timbre: 'piano', register: 'comfortable',
        targetStartedAt: 0,
        frames: [{ at_ms: 100, hz: 392, confidence: 0.95 }],
        digit: 5,
        digitConfidence: 0.9,
      } as never);

      ctrl._checkCaptureEnd();

      expect(ctrl.state.kind).toBe('graded');
      expect(clearTimeoutSpy).toHaveBeenCalledWith(fakeTimerId);
    } finally {
      vi.useRealTimers();
      vi.restoreAllMocks();
    }
  });
});

// A graded state fixture used by variability and next() tests.
const gradedState: RoundState = {
  kind: 'graded',
  item: baseItem,
  timbre: 'piano',
  register: 'comfortable',
  outcome: { pitch: true, label: true, pass: true, at: 100 },
  cents_off: 5,
  sungBest: { at_ms: 100, hz: 392, confidence: 0.95 },
  digitHeard: 5,
  digitConfidence: 0.9,
};

describe('SessionController — variability picker wiring', () => {
  it('avoids repeating the previous timbre across rounds', () => {
    // rng = () => 0 always picks index 0 of the filtered pool.
    // TIMBRE_IDS = ['piano', 'epiano', 'guitar', 'pad'].
    // First call: lastTimbre = null → full pool → pool[0] = 'piano'.
    // Second call: lastTimbre = 'piano' → pool excludes 'piano' → pool[0] = 'epiano'.
    const rng = () => 0;
    const ctrl = createSessionController({ ...makeDeps(), rng });
    const first = ctrl._pickVariability([]);
    const second = ctrl._pickVariability([]);
    expect(first.timbre).toBe('piano');
    expect(second.timbre).not.toBe(first.timbre);
  });

  it('returns only comfortable register when no advanced items are present', () => {
    // availableRegisters([]) = ['comfortable'] (narrow/wide need advanced items).
    // So both calls return 'comfortable' regardless of anti-repeat (pool size = 1).
    const rng = () => 0;
    const ctrl = createSessionController({ ...makeDeps(), rng });
    const first = ctrl._pickVariability([]);
    expect(first.register).toBe('comfortable');
  });
});

describe('SessionController — next()', () => {
  it('is a no-op when not in graded state', async () => {
    const ctrl = createSessionController(makeDeps());
    // idle state — next() should return silently without throwing
    await expect(ctrl.next()).resolves.toBeUndefined();
    expect(ctrl.state.kind).toBe('idle');
  });

  it('advances to idle with the next due item when more rounds remain', async () => {
    const nextItem: Item = { ...baseItem, id: '1-C-major', degree: 1 };
    const deps = makeDeps();
    // Fixture order matters: baseItem (the just-played item) is first in the
    // due queue so `dueNow[0]` would return it without the anti-repeat filter.
    // The filter must skip baseItem and return nextItem.
    deps.itemsRepo.findDue = vi.fn(async () => [baseItem, nextItem]);
    // Session with 1/30 items completed so far
    const session: Session = { ...baseSession, completed_items: 1, target_items: 30 };
    const ctrl = createSessionController({ ...deps, session, firstItem: baseItem });

    ctrl._forceState(gradedState);

    await ctrl.next();

    expect(ctrl.state.kind).toBe('idle');
    expect(ctrl.currentItem?.id).toBe(nextItem.id);
    expect(ctrl.session?.completed_items).toBe(2);
    expect(ctrl.capturedAudio).toBeNull();
    expect(ctrl.targetAudio).toBeNull();
  });

  it('completes the session when target_items is reached', async () => {
    const deps = makeDeps();
    // completed_items = 29, target_items = 30 → next() should complete
    const session: Session = {
      ...baseSession,
      completed_items: 29,
      target_items: 30,
      pitch_pass_count: 15,
      label_pass_count: 18,
    };
    const ctrl = createSessionController({ ...deps, session, firstItem: baseItem });

    ctrl._forceState(gradedState);

    await ctrl.next();

    expect(ctrl.state.kind).toBe('idle');
    expect(ctrl.currentItem).toBeNull();
    expect(ctrl.session?.ended_at).not.toBeNull();
    expect(ctrl.session?.completed_items).toBe(30);
    expect(deps.sessionsRepo.complete).toHaveBeenCalledWith(
      'sess-1',
      expect.objectContaining({
        completed_items: 30,
        pitch_pass_count: 16, // 15 + 1 for the passing outcome
        label_pass_count: 19, // 18 + 1
      }),
    );
  });

  it('completes the session when no due items remain despite target not reached', async () => {
    const deps = makeDeps();
    deps.itemsRepo.findDue = vi.fn(async () => []); // empty queue
    const session: Session = { ...baseSession, completed_items: 5, target_items: 30 };
    const ctrl = createSessionController({ ...deps, session, firstItem: baseItem });

    ctrl._forceState(gradedState);

    await ctrl.next();

    expect(ctrl.state.kind).toBe('idle');
    expect(ctrl.currentItem).toBeNull();
    expect(ctrl.session?.ended_at).not.toBeNull();
    expect(deps.sessionsRepo.complete).toHaveBeenCalledOnce();
  });

  it('does nothing after dispose()', async () => {
    const deps = makeDeps();
    const ctrl = createSessionController(deps);
    ctrl._forceState(gradedState);
    ctrl.dispose();

    await expect(ctrl.next()).resolves.toBeUndefined();
    expect(deps.sessionsRepo.complete).not.toHaveBeenCalled();
  });
});
