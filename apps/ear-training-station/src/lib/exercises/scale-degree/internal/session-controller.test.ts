import { describe, expect, it, vi } from 'vitest';
import { createSessionController } from './session-controller.svelte';
import type { Item, Session } from '@ear-training/core/types/domain';

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
});
