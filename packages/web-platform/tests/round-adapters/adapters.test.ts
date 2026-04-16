import { describe, it, expect } from 'vitest';
import {
  pitchFrameToEvent,
  digitFrameToEvent,
  targetStartedEvent,
  cadenceStartedEvent,
  playbackDoneEvent,
  roundStartedEvent,
  userCanceledEvent,
} from '@/round-adapters/index';
import type { Clock } from '@/round-adapters/clock';
import type { PitchFrame } from '@/pitch/pitch-detector';
import type { DigitFrame } from '@/speech/keyword-spotter';
import type { Item } from '@ear-training/core/types/domain';

const stubClock: Clock = { now: () => 42_000 };

const ITEM: Item = {
  id: '1-C-major', degree: 1,
  key: { tonic: 'C', quality: 'major' },
  box: 'new', accuracy: { pitch: 0, label: 0 },
  recent: [], attempts: 0, consecutive_passes: 0,
  last_seen_at: null, due_at: 0, created_at: 0,
};

describe('pitchFrameToEvent', () => {
  it('converts PitchFrame to PITCH_FRAME event with wall-clock at_ms', () => {
    const frame: PitchFrame = { hz: 440, confidence: 0.92, at: 1.5 };
    const ev = pitchFrameToEvent(frame, stubClock);
    expect(ev.type).toBe('PITCH_FRAME');
    expect(ev.at_ms).toBe(42_000);
    if (ev.type === 'PITCH_FRAME') {
      expect(ev.hz).toBe(440);
      expect(ev.confidence).toBe(0.92);
    }
  });
});

describe('digitFrameToEvent', () => {
  it('converts DigitFrame with a digit to DIGIT_HEARD event', () => {
    const frame: DigitFrame = {
      digit: 'three',
      confidence: 0.88,
      scores: { one: 0.1, two: 0.1, three: 0.88, four: 0.05, five: 0.02, six: 0.01, seven: 0.01 },
    };
    const ev = digitFrameToEvent(frame, stubClock);
    expect(ev).not.toBeNull();
    if (ev && ev.type === 'DIGIT_HEARD') {
      expect(ev.digit).toBe(3);
      expect(ev.confidence).toBe(0.88);
      expect(ev.at_ms).toBe(42_000);
    }
  });

  it('returns null for DigitFrame with null digit', () => {
    const frame: DigitFrame = {
      digit: null,
      confidence: 0.3,
      scores: { one: 0.1, two: 0.1, three: 0.1, four: 0.1, five: 0.1, six: 0.1, seven: 0.1 },
    };
    expect(digitFrameToEvent(frame, stubClock)).toBeNull();
  });
});

describe('simple event factories', () => {
  it('targetStartedEvent', () => {
    expect(targetStartedEvent(stubClock)).toEqual({ type: 'TARGET_STARTED', at_ms: 42_000 });
  });
  it('cadenceStartedEvent', () => {
    expect(cadenceStartedEvent(stubClock)).toEqual({ type: 'CADENCE_STARTED', at_ms: 42_000 });
  });
  it('playbackDoneEvent', () => {
    expect(playbackDoneEvent(stubClock)).toEqual({ type: 'PLAYBACK_DONE', at_ms: 42_000 });
  });
  it('userCanceledEvent', () => {
    expect(userCanceledEvent(stubClock)).toEqual({ type: 'USER_CANCELED', at_ms: 42_000 });
  });
  it('roundStartedEvent', () => {
    const ev = roundStartedEvent(ITEM, 'piano', 'narrow', stubClock);
    expect(ev.type).toBe('ROUND_STARTED');
    expect(ev.at_ms).toBe(42_000);
    if (ev.type === 'ROUND_STARTED') {
      expect(ev.item).toBe(ITEM);
      expect(ev.timbre).toBe('piano');
      expect(ev.register).toBe('narrow');
    }
  });
});
