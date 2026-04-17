import type { Item, AttemptOutcome } from '@/types/domain';
import type { Degree } from '@/types/music';
import type { RoundState } from './state';
import { gradePitch, type PitchObservation } from './grade-pitch';

export interface GradingThresholds {
  minPitchConfidence: number;
  minDigitConfidence: number;
}

export interface ListeningGrade {
  outcome: AttemptOutcome;
  cents_off: number | null;
  sungBest: PitchObservation | null;
  spokenDigit: Degree | null;
  spokenConfidence: number;
}

/**
 * Compute the full graded bundle for a listening-state snapshot.
 * Pure: same inputs → same output. Called by the session controller
 * when capture-end conditions fire (timeout, auto-hit, user "next").
 */
export function gradeListeningState(
  state: Extract<RoundState, { kind: 'listening' }>,
  item: Item,
  thresholds: GradingThresholds,
): ListeningGrade {
  const pitchGrade = gradePitch(state.frames, item, thresholds.minPitchConfidence);

  const spokenDigit = state.digitConfidence >= thresholds.minDigitConfidence ? state.digit : null;
  const labelOk = spokenDigit != null && spokenDigit === item.degree;

  const outcome: AttemptOutcome = {
    pitch: pitchGrade.pitchOk,
    label: labelOk,
    pass: pitchGrade.pitchOk && labelOk,
    at: Date.now(), // placeholder; reducer stamps at_ms on dispatch
  };

  return {
    outcome,
    cents_off: pitchGrade.cents_off,
    sungBest: pitchGrade.sungBest,
    spokenDigit,
    spokenConfidence: state.digitConfidence,
  };
}
