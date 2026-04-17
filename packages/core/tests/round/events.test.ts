import { describe, it, expect } from 'vitest';
import type { RoundEvent } from '@/round/events';
import type { Item } from '@/types/domain';

describe('RoundEvent', () => {
  it('ROUND_STARTED carries item, timbre, register', () => {
    const ev: RoundEvent = {
      type: 'ROUND_STARTED',
      at_ms: 100,
      item: { id: 'test' } as Item,
      timbre: 'piano',
      register: 'narrow',
    };
    expect(ev.type).toBe('ROUND_STARTED');
  });

  it('PITCH_FRAME carries hz and confidence', () => {
    const ev: RoundEvent = { type: 'PITCH_FRAME', at_ms: 200, hz: 440, confidence: 0.92 };
    expect(ev.hz).toBe(440);
  });

  it('DIGIT_HEARD carries digit and confidence', () => {
    const ev: RoundEvent = { type: 'DIGIT_HEARD', at_ms: 300, digit: 5, confidence: 0.88 };
    expect(ev.digit).toBe(5);
  });

  it('all seven event types are constructable', () => {
    const events: RoundEvent[] = [
      { type: 'ROUND_STARTED', at_ms: 0, item: {} as Item, timbre: 'piano', register: 'narrow' },
      { type: 'CADENCE_STARTED', at_ms: 10 },
      { type: 'TARGET_STARTED', at_ms: 20 },
      { type: 'PITCH_FRAME', at_ms: 30, hz: 440, confidence: 0.9 },
      { type: 'DIGIT_HEARD', at_ms: 40, digit: 3, confidence: 0.8 },
      { type: 'PLAYBACK_DONE', at_ms: 50 },
      { type: 'USER_CANCELED', at_ms: 60 },
    ];
    expect(events).toHaveLength(7);
  });
});

describe('RoundEvent union — CAPTURE_COMPLETE', () => {
  it('accepts a CAPTURE_COMPLETE event with a ListeningGrade payload', () => {
    const event: RoundEvent = {
      type: 'CAPTURE_COMPLETE',
      at_ms: 1000,
      grade: {
        outcome: { pitch: true, label: true, pass: true, at: 1000 },
        cents_off: 5,
        sungBest: { at_ms: 500, hz: 440, confidence: 0.9 },
        spokenDigit: 5,
        spokenConfidence: 0.95,
      },
    };
    expect(event.type).toBe('CAPTURE_COMPLETE');
  });
});
