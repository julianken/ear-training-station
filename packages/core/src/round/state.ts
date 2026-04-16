import type { Item, Register, AttemptOutcome } from '@/types/domain';
import type { Degree } from '@/types/music';
import type { TimbreId } from '@/variability/pickers';
import type { RoundEvent } from './events';
import type { PitchObservation } from './grade-pitch';

export type RoundState =
  | { kind: 'idle' }
  | { kind: 'playing_cadence'; item: Item; timbre: TimbreId; register: Register; startedAt: number }
  | { kind: 'playing_target';  item: Item; timbre: TimbreId; register: Register; targetStartedAt: number; frames: PitchObservation[] }
  | { kind: 'listening';       item: Item; timbre: TimbreId; register: Register; targetStartedAt: number; frames: PitchObservation[]; digit: Degree | null; digitConfidence: number }
  | { kind: 'graded';          item: Item; timbre: TimbreId; register: Register; outcome: AttemptOutcome; sungBest: PitchObservation | null; digitHeard: Degree | null };

export function roundReducer(state: RoundState, event: RoundEvent): RoundState {
  if (event.type === 'USER_CANCELED' && state.kind !== 'idle' && state.kind !== 'graded') {
    return { kind: 'idle' };
  }

  switch (state.kind) {
    case 'idle':
      if (event.type === 'ROUND_STARTED') {
        return {
          kind: 'playing_cadence',
          item: event.item,
          timbre: event.timbre,
          register: event.register,
          startedAt: event.at_ms,
        };
      }
      return state;

    case 'playing_cadence':
      if (event.type === 'TARGET_STARTED') {
        return {
          kind: 'playing_target',
          item: state.item, timbre: state.timbre, register: state.register,
          targetStartedAt: event.at_ms,
          frames: [],
        };
      }
      return state;

    case 'playing_target':
      if (event.type === 'PITCH_FRAME') {
        return {
          ...state,
          frames: [...state.frames, { at_ms: event.at_ms, hz: event.hz, confidence: event.confidence }],
        };
      }
      if (event.type === 'PLAYBACK_DONE') {
        return {
          kind: 'listening',
          item: state.item, timbre: state.timbre, register: state.register,
          targetStartedAt: state.targetStartedAt,
          frames: state.frames,
          digit: null,
          digitConfidence: 0,
        };
      }
      return state;

    case 'listening':
      if (event.type === 'PITCH_FRAME') {
        return {
          ...state,
          frames: [...state.frames, { at_ms: event.at_ms, hz: event.hz, confidence: event.confidence }],
        };
      }
      if (event.type === 'DIGIT_HEARD') {
        if (event.confidence > state.digitConfidence) {
          return { ...state, digit: event.digit, digitConfidence: event.confidence };
        }
        return state;
      }
      return state;

    case 'graded':
      return state;
  }
}
