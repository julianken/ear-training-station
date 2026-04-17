import { describe, expect, it } from 'vitest';
import { gradeListeningState } from '@/round/grade-listening';
import type { RoundState } from '@/round/state';
import type { Item } from '@/types/domain';

const item: Item = {
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

function listeningState(partial: Partial<Extract<RoundState, { kind: 'listening' }>>): Extract<RoundState, { kind: 'listening' }> {
  return {
    kind: 'listening',
    item,
    timbre: 'piano',
    register: 'comfortable',
    targetStartedAt: 0,
    frames: [],
    digit: null,
    digitConfidence: 0,
    ...partial,
  };
}

describe('gradeListeningState', () => {
  it('returns pass when pitch is on-target and the digit matches the degree', () => {
    const state = listeningState({
      frames: [
        { at_ms: 100, hz: 392, confidence: 0.95 },
        { at_ms: 150, hz: 392, confidence: 0.95 },
      ],
      digit: 5,
      digitConfidence: 0.9,
    });
    const grade = gradeListeningState(state, item, { minPitchConfidence: 0.5, minDigitConfidence: 0.5 });
    expect(grade.outcome.pitch).toBe(true);
    expect(grade.outcome.label).toBe(true);
    expect(grade.outcome.pass).toBe(true);
    expect(grade.cents_off).not.toBeNull();
    expect(Math.abs(grade.cents_off!)).toBeLessThan(10);
    expect(grade.sungBest).not.toBeNull();
    expect(grade.spokenDigit).toBe(5);
    expect(grade.spokenConfidence).toBe(0.9);
  });

  it('returns label: false when the spoken digit does not match', () => {
    const state = listeningState({
      frames: [{ at_ms: 100, hz: 392, confidence: 0.95 }],
      digit: 4,
      digitConfidence: 0.9,
    });
    const grade = gradeListeningState(state, item, { minPitchConfidence: 0.5, minDigitConfidence: 0.5 });
    expect(grade.outcome.pitch).toBe(true);
    expect(grade.outcome.label).toBe(false);
    expect(grade.outcome.pass).toBe(false);
    expect(grade.spokenDigit).toBe(4);
  });

  it('returns pitch: false when no confident frames exist', () => {
    const state = listeningState({
      frames: [{ at_ms: 100, hz: 392, confidence: 0.2 }],
      digit: 5,
      digitConfidence: 0.9,
    });
    const grade = gradeListeningState(state, item, { minPitchConfidence: 0.5, minDigitConfidence: 0.5 });
    expect(grade.outcome.pitch).toBe(false);
    expect(grade.cents_off).toBeNull();
    expect(grade.sungBest).toBeNull();
  });

  it('returns label: false when digit confidence is below threshold', () => {
    const state = listeningState({
      frames: [{ at_ms: 100, hz: 392, confidence: 0.95 }],
      digit: 5,
      digitConfidence: 0.3,
    });
    const grade = gradeListeningState(state, item, { minPitchConfidence: 0.5, minDigitConfidence: 0.5 });
    expect(grade.outcome.label).toBe(false);
  });

  it('returns label: false when no digit heard at all', () => {
    const state = listeningState({
      frames: [{ at_ms: 100, hz: 392, confidence: 0.95 }],
      digit: null,
      digitConfidence: 0,
    });
    const grade = gradeListeningState(state, item, { minPitchConfidence: 0.5, minDigitConfidence: 0.5 });
    expect(grade.outcome.label).toBe(false);
    expect(grade.spokenDigit).toBeNull();
  });
});
