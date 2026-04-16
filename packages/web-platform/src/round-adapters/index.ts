import type { RoundEvent } from '@ear-training/core/round/events';
import type { Item, Register } from '@ear-training/core/types/domain';
import type { TimbreId } from '@ear-training/core/variability/pickers';
import type { PitchFrame } from '@/pitch/pitch-detector';
import type { DigitFrame } from '@/speech/keyword-spotter';
import { digitLabelToNumber } from '@/speech/digit-label';
import { systemClock, type Clock } from './clock';

export function pitchFrameToEvent(frame: PitchFrame, clock: Clock = systemClock): RoundEvent {
  return { type: 'PITCH_FRAME', at_ms: clock.now(), hz: frame.hz, confidence: frame.confidence };
}

export function digitFrameToEvent(frame: DigitFrame, clock: Clock = systemClock): RoundEvent | null {
  if (frame.digit === null) return null;
  return {
    type: 'DIGIT_HEARD',
    at_ms: clock.now(),
    digit: digitLabelToNumber(frame.digit),
    confidence: frame.confidence,
  };
}

export function targetStartedEvent(clock: Clock = systemClock): RoundEvent {
  return { type: 'TARGET_STARTED', at_ms: clock.now() };
}

export function cadenceStartedEvent(clock: Clock = systemClock): RoundEvent {
  return { type: 'CADENCE_STARTED', at_ms: clock.now() };
}

export function playbackDoneEvent(clock: Clock = systemClock): RoundEvent {
  return { type: 'PLAYBACK_DONE', at_ms: clock.now() };
}

export function roundStartedEvent(item: Item, timbre: TimbreId, register: Register, clock: Clock = systemClock): RoundEvent {
  return { type: 'ROUND_STARTED', at_ms: clock.now(), item, timbre, register };
}

export function userCanceledEvent(clock: Clock = systemClock): RoundEvent {
  return { type: 'USER_CANCELED', at_ms: clock.now() };
}
