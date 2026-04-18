import { describe, expect, it, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { createSessionController } from './session-controller.svelte';
import type { Item, Session } from '@ear-training/core/types/domain';
import type { RoundState } from '@ear-training/core/round/state';
import { allItems, consecutiveNullCount, degradationState } from '$lib/shell/stores';

/** Flush all pending microtasks so async fire-and-forget dispatches complete. */
async function flushPromises(): Promise<void> {
  // Multiple ticks to drain chained awaits (recorder.stop, append, put)
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
  }
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
    // Simulate persistence having run for this round:
    // #pitchPasses and #labelPasses are updated when graded transition fires.
    // _forceState bypasses dispatch, so we advance the running counters manually.
    ctrl._forceRunningCounters(16, 19); // 15+1 pitch pass, 18+1 label pass

    await ctrl.next();

    expect(ctrl.state.kind).toBe('idle');
    expect(ctrl.currentItem).toBeNull();
    expect(ctrl.session?.ended_at).not.toBeNull();
    expect(ctrl.session?.completed_items).toBe(30);
    expect(deps.sessionsRepo.complete).toHaveBeenCalledWith(
      'sess-1',
      expect.objectContaining({
        completed_items: 30,
        pitch_pass_count: 16, // running counter (15 + 1 from this round)
        label_pass_count: 19, // running counter (18 + 1 from this round)
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

describe('SessionController — attempt persistence on graded transition', () => {
  beforeEach(() => {
    // Reset allItems store between tests to prevent cross-test leakage.
    allItems.set([]);
  });

  // Helper: build a CAPTURE_COMPLETE-like graded state via _checkCaptureEnd.
  // Uses _forceState to set up the listening state, then calls _checkCaptureEnd
  // to trigger the real graded transition including persistence.
  function setupListening(ctrl: ReturnType<typeof createSessionController>) {
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
  }

  it('calls attemptsRepo.append exactly once on graded transition', async () => {
    const deps = makeDeps();
    const ctrl = createSessionController(deps);

    setupListening(ctrl);
    ctrl._checkCaptureEnd();

    // #dispatch is async fire-and-forget; flush all pending microtasks.
    await flushPromises();

    expect(deps.attemptsRepo.append).toHaveBeenCalledOnce();
  });

  it('calls itemsRepo.put exactly once with the updated item', async () => {
    const deps = makeDeps();
    const ctrl = createSessionController(deps);

    setupListening(ctrl);
    ctrl._checkCaptureEnd();
    await flushPromises();

    expect(deps.itemsRepo.put).toHaveBeenCalledOnce();
    const putArg = (deps.itemsRepo.put as ReturnType<typeof vi.fn>).mock.calls[0]![0] as Item;
    expect(putArg.id).toBe(baseItem.id);
    expect(putArg.attempts).toBe(1);
    // new → learning on first pass (pitch+label both pass above threshold)
    expect(putArg.box).toBe('learning');
  });

  it('attempt has correct session_id, item_id, and graded shape', async () => {
    const deps = makeDeps();
    const ctrl = createSessionController(deps);

    setupListening(ctrl);
    ctrl._checkCaptureEnd();
    await flushPromises();

    const appendArg = (deps.attemptsRepo.append as ReturnType<typeof vi.fn>).mock.calls[0]![0] as {
      session_id: string;
      item_id: string;
      graded: { pitch: boolean; label: boolean; pass: boolean };
    };
    expect(appendArg.session_id).toBe('sess-1');
    expect(appendArg.item_id).toBe(baseItem.id);
    // Both pitch and label pass (hz=392 ≈ G4 = degree 5 of C major; digit=5 = degree 5)
    expect(appendArg.graded.pass).toBe(true);
  });

  it('updates allItems store with the new item state after successful persistence', async () => {
    const deps = makeDeps();
    const ctrl = createSessionController(deps);

    // Seed the store with the base item so the update path (not append path) is exercised.
    allItems.set([baseItem]);

    setupListening(ctrl);
    ctrl._checkCaptureEnd();
    await flushPromises();

    const stored = get(allItems);
    expect(stored).toHaveLength(1);
    const updatedInStore = stored.find((i) => i.id === baseItem.id);
    expect(updatedInStore).toBeDefined();
    // After a pass the box should have advanced and attempts should be incremented.
    expect(updatedInStore!.attempts).toBe(1);
    expect(updatedInStore!.box).toBe('learning');
  });

  it('appends to allItems store when item id is not already present', async () => {
    const deps = makeDeps();
    const ctrl = createSessionController(deps);

    // Store is empty — the updated item should be appended.
    allItems.set([]);

    setupListening(ctrl);
    ctrl._checkCaptureEnd();
    await flushPromises();

    const stored = get(allItems);
    expect(stored).toHaveLength(1);
    expect(stored[0]!.id).toBe(baseItem.id);
    expect(stored[0]!.attempts).toBe(1);
  });

  it('does not update allItems store when persistence fails', async () => {
    const deps = makeDeps();
    deps.itemsRepo.put = vi.fn(async () => { throw new Error('quota exceeded'); });
    const ctrl = createSessionController(deps);

    allItems.set([baseItem]);

    setupListening(ctrl);
    ctrl._checkCaptureEnd();
    await flushPromises();

    // put threw — allItems must remain at the original (pre-round) state.
    const stored = get(allItems);
    expect(stored).toHaveLength(1);
    expect(stored[0]!.attempts).toBe(0); // unchanged
  });

  it('running #pitchPasses / #labelPasses are reflected in session completion', async () => {
    const deps = makeDeps();
    deps.itemsRepo.findDue = vi.fn(async () => []);
    const session: Session = {
      ...baseSession,
      completed_items: 5,
      target_items: 30,
      pitch_pass_count: 3,
      label_pass_count: 2,
    };
    const ctrl = createSessionController({ ...deps, session, firstItem: baseItem });

    // Transition through real graded path (not _forceState bypass)
    setupListening(ctrl);
    ctrl._checkCaptureEnd();
    // Flush all async persistence work before calling next()
    await flushPromises();

    // Now next() should see the updated running counters
    await ctrl.next();

    // pitch_pass_count: 3 (init) + 1 (this round pitch pass) = 4
    // label_pass_count: 2 (init) + 1 (this round label pass) = 3
    expect(deps.sessionsRepo.complete).toHaveBeenCalledWith(
      'sess-1',
      expect.objectContaining({
        pitch_pass_count: 4,
        label_pass_count: 3,
      }),
    );
  });
});

describe('SessionController — persistence failure counter consistency', () => {
  // Helper shared with the persistence suite above.
  function setupListening(ctrl: ReturnType<typeof createSessionController>) {
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
  }

  beforeEach(() => {
    degradationState.set({
      kwsUnavailable: false,
      persistenceFailing: false,
      micPermissionDenied: false,
      micLost: false,
    });
  });

  it('sets degradationState.persistenceFailing when itemsRepo.put rejects', async () => {
    const deps = makeDeps();
    deps.itemsRepo.put = vi.fn(async () => { throw new Error('quota exceeded'); });
    const ctrl = createSessionController(deps);

    setupListening(ctrl);
    ctrl._checkCaptureEnd();
    await flushPromises();

    expect(get(degradationState).persistenceFailing).toBe(true);
  });

  it('sets degradationState.persistenceFailing when attemptsRepo.append rejects', async () => {
    const deps = makeDeps();
    deps.attemptsRepo.append = vi.fn(async () => { throw new Error('db closed'); });
    const ctrl = createSessionController(deps);

    setupListening(ctrl);
    ctrl._checkCaptureEnd();
    await flushPromises();

    expect(get(degradationState).persistenceFailing).toBe(true);
  });

  it('does not advance counters when itemsRepo.put rejects', async () => {
    const deps = makeDeps();
    // append succeeds; put fails — simulates quota-exceeded on the second write.
    deps.itemsRepo.put = vi.fn(async () => { throw new Error('quota exceeded'); });
    const ctrl = createSessionController(deps);

    // Verify counters start at the session baseline.
    expect(ctrl._getRunningCounters()).toEqual({ pitch: 0, label: 0, roundIndex: 0 });

    setupListening(ctrl);
    ctrl._checkCaptureEnd();
    // Flush all async microtasks so the try/catch inside #dispatch completes.
    await flushPromises();

    // append was called (partial failure path confirmed).
    expect(deps.attemptsRepo.append).toHaveBeenCalledOnce();
    // put threw — counters must remain at pre-round values.
    expect(ctrl._getRunningCounters()).toEqual({ pitch: 0, label: 0, roundIndex: 0 });
  });

  it('does not advance counters when attemptsRepo.append rejects', async () => {
    const deps = makeDeps();
    deps.attemptsRepo.append = vi.fn(async () => { throw new Error('db closed'); });
    const ctrl = createSessionController(deps);

    setupListening(ctrl);
    ctrl._checkCaptureEnd();
    await flushPromises();

    expect(deps.itemsRepo.put).not.toHaveBeenCalled();
    expect(ctrl._getRunningCounters()).toEqual({ pitch: 0, label: 0, roundIndex: 0 });
  });

  it('advances counters normally when both writes succeed', async () => {
    const deps = makeDeps();
    const ctrl = createSessionController(deps);

    setupListening(ctrl);
    ctrl._checkCaptureEnd();
    await flushPromises();

    // pitch and label both pass (hz≈392 = G4 = degree 5 of C major; digit=5).
    expect(ctrl._getRunningCounters()).toEqual({ pitch: 1, label: 1, roundIndex: 1 });
  });
});

describe('SessionController — consecutiveNullCount store', () => {
  beforeEach(() => {
    // Reset store between tests to avoid leakage.
    consecutiveNullCount.set(0);
  });

  it('increments consecutiveNullCount when a low-confidence frame arrives', () => {
    const ctrl = createSessionController(makeDeps());
    ctrl._onPitchFrame({ hz: 0, confidence: 0 });
    expect(get(consecutiveNullCount)).toBe(1);
    ctrl._onPitchFrame({ hz: 440, confidence: 0.3 });
    expect(get(consecutiveNullCount)).toBe(2);
  });

  it('resets consecutiveNullCount to 0 when a high-confidence frame arrives', () => {
    const ctrl = createSessionController(makeDeps());
    // Seed the store to a non-zero value.
    consecutiveNullCount.set(5);
    ctrl._onPitchFrame({ hz: 440, confidence: 0.95 });
    expect(get(consecutiveNullCount)).toBe(0);
  });

  it('resets consecutiveNullCount to 0 when next() is called', async () => {
    const ctrl = createSessionController(makeDeps());
    consecutiveNullCount.set(4);
    ctrl._forceState(gradedState);
    await ctrl.next();
    expect(get(consecutiveNullCount)).toBe(0);
  });
});

describe('SessionController — AudioContext lifecycle (GitHub #104 / Plan C2 Task 1)', () => {
  // Build a mock AudioContext with a `close` spy so we can assert lifecycle.
  function makeMockContext() {
    const close = vi.fn(async () => undefined);
    const ctx = new (class {
      currentTime = 0;
      sampleRate = 48000;
      audioWorklet = { addModule: vi.fn(async () => undefined) };
      createBuffer() { return {} as AudioBuffer; }
      createMediaStreamSource() { return { connect: vi.fn(), disconnect: vi.fn() }; }
      close = close;
    })() as unknown as AudioContext;
    return { ctx, close };
  }

  it('startRound() calls getAudioContext() at most once across multiple rounds', async () => {
    const { ctx } = makeMockContext();
    const getAudioContext = vi.fn(() => ctx);
    const deps = { ...makeDeps(), getAudioContext };
    const ctrl = createSessionController(deps);

    // startRound() pulls in web-platform modules that touch browser APIs the
    // jsdom env doesn't provide; the call will reject partway through. We only
    // care that getAudioContext was consulted on the way in.
    await ctrl.startRound().catch(() => {});

    // Drive the controller back to idle so a second startRound() would pass
    // its own kind-guard. _forceState bypasses the normal flow.
    ctrl._forceState({ kind: 'idle' } as never);
    await ctrl.startRound().catch(() => {});

    // Even across two startRound attempts, only one AudioContext is created.
    expect(getAudioContext).toHaveBeenCalledTimes(1);
  });

  it('dispose() closes the cached AudioContext', async () => {
    const { ctx, close } = makeMockContext();
    const getAudioContext = vi.fn(() => ctx);
    const deps = { ...makeDeps(), getAudioContext };
    const ctrl = createSessionController(deps);

    await ctrl.startRound().catch(() => {});
    expect(getAudioContext).toHaveBeenCalled();

    ctrl.dispose();

    expect(close).toHaveBeenCalledTimes(1);
  });

  it('dispose() is safe when no round ever ran and no context was created', () => {
    const { close } = makeMockContext();
    const getAudioContext = vi.fn(() => makeMockContext().ctx);
    const deps = { ...makeDeps(), getAudioContext };
    const ctrl = createSessionController(deps);

    // No startRound() → no context created → dispose() must not try to close
    // anything and must not throw.
    expect(() => ctrl.dispose()).not.toThrow();
    expect(getAudioContext).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
  });

  it('dispose() is idempotent and only closes the context once', async () => {
    const { ctx, close } = makeMockContext();
    const getAudioContext = vi.fn(() => ctx);
    const deps = { ...makeDeps(), getAudioContext };
    const ctrl = createSessionController(deps);

    await ctrl.startRound().catch(() => {});

    ctrl.dispose();
    ctrl.dispose();

    expect(close).toHaveBeenCalledTimes(1);
  });
});

describe('SessionController — startRound() rejection propagation (GitHub #106 / Plan C2 Task 3)', () => {
  // The controller does not wrap its own async failures — it propagates them so
  // the caller (ActiveRound.svelte) can surface a user-visible error. These
  // tests pin that contract: without propagation, the UI can't show an error,
  // and the failure is silent (which is exactly what #106 fixed at the UI seam).

  it('startRound() rejects when getMicStream() rejects with a permission error', async () => {
    const deps = makeDeps();
    const micError = Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' });
    deps.getMicStream = vi.fn(async () => { throw micError; });
    const ctrl = createSessionController(deps);

    await expect(ctrl.startRound()).rejects.toBe(micError);
  });

  it('startRound() rejects when getAudioContext() throws synchronously', async () => {
    const deps = makeDeps();
    const audioError = new Error('AudioContext creation failed');
    deps.getAudioContext = vi.fn(() => { throw audioError; });
    const ctrl = createSessionController(deps);

    await expect(ctrl.startRound()).rejects.toBe(audioError);
  });

  it('getMicStream() is invoked as part of startRound(), wiring up the mic-error path', async () => {
    const deps = makeDeps();
    const getMicStream = vi.fn(async () => ({} as MediaStream));
    deps.getMicStream = getMicStream;
    const ctrl = createSessionController(deps);

    // startRound() pulls in web-platform modules that require real browser APIs
    // (AudioWorklet, etc.) which jsdom doesn't provide, so the promise rejects
    // partway through. We only care that getMicStream was consulted — that
    // proves mic-permission errors would propagate, since that's where the
    // NotAllowedError surfaces in production.
    await ctrl.startRound().catch(() => {});

    expect(getMicStream).toHaveBeenCalled();
  });

  it('state remains idle when startRound() rejects on getMicStream()', async () => {
    // Regression pin: before #106 the UI silently stayed in idle with no
    // feedback. The fix is at the call site (ActiveRound.svelte), so the
    // controller-level contract we rely on is that the state does NOT
    // advance past idle when the mic acquisition step fails.
    const deps = makeDeps();
    deps.getMicStream = vi.fn(async () => {
      throw Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' });
    });
    const ctrl = createSessionController(deps);

    await ctrl.startRound().catch(() => {});

    expect(ctrl.state.kind).toBe('idle');
  });
});
