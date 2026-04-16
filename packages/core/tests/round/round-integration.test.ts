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

function applyEvents(events: RoundEvent[]): RoundState {
  return events.reduce<RoundState>((s, e) => roundReducer(s, e), { kind: 'idle' });
}

describe('round integration: golden path', () => {
  it('progresses from idle through all states to listening', () => {
    const events: RoundEvent[] = [
      { type: 'ROUND_STARTED', at_ms: 0, item: ITEM, timbre: 'piano', register: 'narrow' },
      { type: 'CADENCE_STARTED', at_ms: 10 },
      { type: 'TARGET_STARTED', at_ms: 3200 },
      { type: 'PITCH_FRAME', at_ms: 3300, hz: 261.63, confidence: 0.95 },
      { type: 'PITCH_FRAME', at_ms: 3400, hz: 262.0, confidence: 0.93 },
      { type: 'PLAYBACK_DONE', at_ms: 4700 },
      { type: 'PITCH_FRAME', at_ms: 4800, hz: 261.5, confidence: 0.91 },
      { type: 'DIGIT_HEARD', at_ms: 5000, digit: 1, confidence: 0.88 },
    ];

    const final = applyEvents(events);
    expect(final.kind).toBe('listening');
    if (final.kind === 'listening') {
      expect(final.frames).toHaveLength(3);
      expect(final.digit).toBe(1);
      expect(final.digitConfidence).toBe(0.88);
      expect(final.item).toBe(ITEM);
    }
  });
});

describe('round integration: cancel mid-round', () => {
  it('returns to idle when canceled during playing_target', () => {
    const events: RoundEvent[] = [
      { type: 'ROUND_STARTED', at_ms: 0, item: ITEM, timbre: 'guitar', register: 'comfortable' },
      { type: 'TARGET_STARTED', at_ms: 3200 },
      { type: 'PITCH_FRAME', at_ms: 3300, hz: 440, confidence: 0.9 },
      { type: 'USER_CANCELED', at_ms: 3500 },
    ];
    expect(applyEvents(events).kind).toBe('idle');
  });

  it('returns to idle when canceled during listening', () => {
    const events: RoundEvent[] = [
      { type: 'ROUND_STARTED', at_ms: 0, item: ITEM, timbre: 'pad', register: 'wide' },
      { type: 'TARGET_STARTED', at_ms: 3200 },
      { type: 'PLAYBACK_DONE', at_ms: 4700 },
      { type: 'USER_CANCELED', at_ms: 5000 },
    ];
    expect(applyEvents(events).kind).toBe('idle');
  });
});

describe('round integration: timeout with no pitch', () => {
  it('reaches listening with empty frames when no pitch is detected', () => {
    const events: RoundEvent[] = [
      { type: 'ROUND_STARTED', at_ms: 0, item: ITEM, timbre: 'epiano', register: 'narrow' },
      { type: 'TARGET_STARTED', at_ms: 3200 },
      { type: 'PLAYBACK_DONE', at_ms: 4700 },
    ];
    const final = applyEvents(events);
    expect(final.kind).toBe('listening');
    if (final.kind === 'listening') {
      expect(final.frames).toHaveLength(0);
      expect(final.digit).toBeNull();
    }
  });
});

describe('round integration: wrong digit', () => {
  it('records the wrong digit in listening state', () => {
    const events: RoundEvent[] = [
      { type: 'ROUND_STARTED', at_ms: 0, item: ITEM, timbre: 'piano', register: 'narrow' },
      { type: 'TARGET_STARTED', at_ms: 3200 },
      { type: 'PITCH_FRAME', at_ms: 3300, hz: 261.63, confidence: 0.95 },
      { type: 'PLAYBACK_DONE', at_ms: 4700 },
      { type: 'DIGIT_HEARD', at_ms: 5000, digit: 5, confidence: 0.8 },
    ];
    const final = applyEvents(events);
    if (final.kind === 'listening') {
      expect(final.digit).toBe(5);
    }
  });
});

describe('round integration: multiple digit attempts', () => {
  it('keeps highest confidence digit across multiple DIGIT_HEARD events', () => {
    const events: RoundEvent[] = [
      { type: 'ROUND_STARTED', at_ms: 0, item: ITEM, timbre: 'piano', register: 'narrow' },
      { type: 'TARGET_STARTED', at_ms: 3200 },
      { type: 'PLAYBACK_DONE', at_ms: 4700 },
      { type: 'DIGIT_HEARD', at_ms: 5000, digit: 3, confidence: 0.6 },
      { type: 'DIGIT_HEARD', at_ms: 5500, digit: 1, confidence: 0.92 },
      { type: 'DIGIT_HEARD', at_ms: 6000, digit: 5, confidence: 0.7 },
    ];
    const final = applyEvents(events);
    if (final.kind === 'listening') {
      expect(final.digit).toBe(1);
      expect(final.digitConfidence).toBe(0.92);
    }
  });
});
