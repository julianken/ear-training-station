import { describe, it, expect } from 'vitest';
import { roundReducer, type RoundState } from '@/round/state';
import type { RoundEvent } from '@/round/events';
import type { Item } from '@/types/domain';

const ITEM: Item = {
  id: '1-C-major', degree: 1,
  key: { tonic: 'C', quality: 'major' },
  box: 'new', accuracy: { pitch: 0, label: 0 },
  recent: [], attempts: 0, consecutive_passes: 0,
  last_seen_at: null, due_at: 0, created_at: 0,
};

const idle: RoundState = { kind: 'idle' };

describe('roundReducer', () => {
  // === Valid transitions ===

  describe('idle → playing_cadence', () => {
    it('transitions on ROUND_STARTED', () => {
      const ev: RoundEvent = { type: 'ROUND_STARTED', at_ms: 100, item: ITEM, timbre: 'piano', register: 'narrow' };
      const next = roundReducer(idle, ev);
      expect(next.kind).toBe('playing_cadence');
      if (next.kind === 'playing_cadence') {
        expect(next.item).toBe(ITEM);
        expect(next.timbre).toBe('piano');
        expect(next.startedAt).toBe(100);
      }
    });
  });

  describe('playing_cadence → playing_target', () => {
    it('transitions on TARGET_STARTED', () => {
      const cadence: RoundState = { kind: 'playing_cadence', item: ITEM, timbre: 'piano', register: 'narrow', startedAt: 100 };
      const next = roundReducer(cadence, { type: 'TARGET_STARTED', at_ms: 200 });
      expect(next.kind).toBe('playing_target');
      if (next.kind === 'playing_target') {
        expect(next.targetStartedAt).toBe(200);
        expect(next.frames).toEqual([]);
      }
    });
  });

  describe('playing_target', () => {
    const target: RoundState = {
      kind: 'playing_target', item: ITEM, timbre: 'piano', register: 'narrow',
      targetStartedAt: 200, frames: [],
    };

    it('accumulates PITCH_FRAME', () => {
      const next = roundReducer(target, { type: 'PITCH_FRAME', at_ms: 250, hz: 440, confidence: 0.9 });
      expect(next.kind).toBe('playing_target');
      if (next.kind === 'playing_target') {
        expect(next.frames).toHaveLength(1);
        expect(next.frames[0]!.hz).toBe(440);
      }
    });

    it('transitions to listening on PLAYBACK_DONE', () => {
      const next = roundReducer(target, { type: 'PLAYBACK_DONE', at_ms: 350 });
      expect(next.kind).toBe('listening');
    });
  });

  describe('listening', () => {
    const listening: RoundState = {
      kind: 'listening', item: ITEM, timbre: 'piano', register: 'narrow',
      targetStartedAt: 200, frames: [{ at_ms: 250, hz: 261.63, confidence: 0.95 }],
      digit: null, digitConfidence: 0,
    };

    it('accumulates PITCH_FRAME', () => {
      const next = roundReducer(listening, { type: 'PITCH_FRAME', at_ms: 400, hz: 262, confidence: 0.9 });
      expect(next.kind).toBe('listening');
      if (next.kind === 'listening') expect(next.frames).toHaveLength(2);
    });

    it('records DIGIT_HEARD', () => {
      const next = roundReducer(listening, { type: 'DIGIT_HEARD', at_ms: 500, digit: 1, confidence: 0.88 });
      if (next.kind === 'listening') {
        expect(next.digit).toBe(1);
        expect(next.digitConfidence).toBe(0.88);
      }
    });

    it('keeps highest-confidence digit', () => {
      let state = roundReducer(listening, { type: 'DIGIT_HEARD', at_ms: 500, digit: 1, confidence: 0.9 });
      state = roundReducer(state, { type: 'DIGIT_HEARD', at_ms: 600, digit: 3, confidence: 0.7 });
      if (state.kind === 'listening') {
        expect(state.digit).toBe(1);
        expect(state.digitConfidence).toBe(0.9);
      }
    });
  });

  // === Cancel ===
  describe('USER_CANCELED', () => {
    it('returns idle from playing_cadence', () => {
      const state: RoundState = { kind: 'playing_cadence', item: ITEM, timbre: 'piano', register: 'narrow', startedAt: 100 };
      expect(roundReducer(state, { type: 'USER_CANCELED', at_ms: 150 }).kind).toBe('idle');
    });

    it('returns idle from playing_target', () => {
      const state: RoundState = { kind: 'playing_target', item: ITEM, timbre: 'piano', register: 'narrow', targetStartedAt: 200, frames: [] };
      expect(roundReducer(state, { type: 'USER_CANCELED', at_ms: 250 }).kind).toBe('idle');
    });

    it('returns idle from listening', () => {
      const state: RoundState = { kind: 'listening', item: ITEM, timbre: 'piano', register: 'narrow', targetStartedAt: 200, frames: [], digit: null, digitConfidence: 0 };
      expect(roundReducer(state, { type: 'USER_CANCELED', at_ms: 350 }).kind).toBe('idle');
    });
  });

  // === Ignored events (return state unchanged) ===
  describe('ignored events', () => {
    it('ignores CADENCE_STARTED in idle', () => {
      expect(roundReducer(idle, { type: 'CADENCE_STARTED', at_ms: 100 })).toBe(idle);
    });
    it('ignores TARGET_STARTED in idle', () => {
      expect(roundReducer(idle, { type: 'TARGET_STARTED', at_ms: 100 })).toBe(idle);
    });
    it('ignores PITCH_FRAME in idle', () => {
      expect(roundReducer(idle, { type: 'PITCH_FRAME', at_ms: 100, hz: 440, confidence: 0.9 })).toBe(idle);
    });
    it('ignores DIGIT_HEARD in idle', () => {
      expect(roundReducer(idle, { type: 'DIGIT_HEARD', at_ms: 100, digit: 1, confidence: 0.9 })).toBe(idle);
    });
    it('ignores PLAYBACK_DONE in idle', () => {
      expect(roundReducer(idle, { type: 'PLAYBACK_DONE', at_ms: 100 })).toBe(idle);
    });
    it('ignores ROUND_STARTED in playing_cadence', () => {
      const state: RoundState = { kind: 'playing_cadence', item: ITEM, timbre: 'piano', register: 'narrow', startedAt: 100 };
      expect(roundReducer(state, { type: 'ROUND_STARTED', at_ms: 200, item: ITEM, timbre: 'guitar', register: 'wide' })).toBe(state);
    });
    it('ignores all events in graded', () => {
      const graded: RoundState = {
        kind: 'graded', item: ITEM, timbre: 'piano', register: 'narrow',
        outcome: { pitch: true, label: true, pass: true, at: 500 },
        sungBest: null, digitHeard: null,
      };
      expect(roundReducer(graded, { type: 'ROUND_STARTED', at_ms: 600, item: ITEM, timbre: 'guitar', register: 'wide' })).toBe(graded);
      expect(roundReducer(graded, { type: 'USER_CANCELED', at_ms: 600 })).toBe(graded);
    });
  });
});
