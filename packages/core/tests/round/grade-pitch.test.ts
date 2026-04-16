import { describe, it, expect } from 'vitest';
import { gradePitch, type PitchObservation } from '@/round/grade-pitch';
import type { Item } from '@/types/domain';

const C_MAJOR_ITEM: Item = {
  id: '1-C-major', degree: 1,
  key: { tonic: 'C', quality: 'major' },
  box: 'new', accuracy: { pitch: 0, label: 0 },
  recent: [], attempts: 0, consecutive_passes: 0,
  last_seen_at: null, due_at: 0, created_at: 0,
};

function makeItem(degree: 1|2|3|4|5|6|7): Item {
  return { ...C_MAJOR_ITEM, id: `${degree}-C-major`, degree };
}

describe('gradePitch', () => {
  it('returns pitchOk=true when best frame matches target degree', () => {
    const frames: PitchObservation[] = [
      { at_ms: 100, hz: 261.63, confidence: 0.95 }, // C4 = degree 1 in C major
    ];
    const result = gradePitch(frames, makeItem(1), 0.5);
    expect(result.pitchOk).toBe(true);
    expect(result.sungBest).not.toBeNull();
  });

  it('returns pitchOk=false when best frame is a different degree', () => {
    const frames: PitchObservation[] = [
      { at_ms: 100, hz: 329.63, confidence: 0.95 }, // E4 = degree 3
    ];
    const result = gradePitch(frames, makeItem(1), 0.5);
    expect(result.pitchOk).toBe(false);
  });

  it('ignores frames below minConfidence', () => {
    const frames: PitchObservation[] = [
      { at_ms: 100, hz: 261.63, confidence: 0.2 },  // correct but low confidence
      { at_ms: 200, hz: 329.63, confidence: 0.95 },  // wrong but high confidence
    ];
    const result = gradePitch(frames, makeItem(1), 0.5);
    expect(result.pitchOk).toBe(false);
    expect(result.sungBest?.hz).toBeCloseTo(329.63);
  });

  it('picks highest-confidence frame as sungBest', () => {
    const frames: PitchObservation[] = [
      { at_ms: 100, hz: 261.63, confidence: 0.7 },
      { at_ms: 200, hz: 261.63, confidence: 0.95 },
      { at_ms: 300, hz: 261.63, confidence: 0.8 },
    ];
    const result = gradePitch(frames, makeItem(1), 0.5);
    expect(result.sungBest?.confidence).toBe(0.95);
  });

  it('returns null sungBest when no frames meet minConfidence', () => {
    const frames: PitchObservation[] = [
      { at_ms: 100, hz: 261.63, confidence: 0.1 },
    ];
    const result = gradePitch(frames, makeItem(1), 0.5);
    expect(result.sungBest).toBeNull();
    expect(result.pitchOk).toBe(false);
    expect(result.cents_off).toBeNull();
  });

  it('returns null sungBest for empty frames', () => {
    const result = gradePitch([], makeItem(1), 0.5);
    expect(result.sungBest).toBeNull();
    expect(result.pitchOk).toBe(false);
  });

  it('reports cents_off for the best frame', () => {
    const frames: PitchObservation[] = [
      { at_ms: 100, hz: 265, confidence: 0.95 }, // slightly sharp C4
    ];
    const result = gradePitch(frames, makeItem(1), 0.5);
    expect(result.cents_off).not.toBeNull();
    expect(Math.abs(result.cents_off!)).toBeGreaterThan(0);
    expect(Math.abs(result.cents_off!)).toBeLessThan(100);
  });

  it('works octave-invariant (C5 matches degree 1 in C major)', () => {
    const frames: PitchObservation[] = [
      { at_ms: 100, hz: 523.25, confidence: 0.95 }, // C5
    ];
    const result = gradePitch(frames, makeItem(1), 0.5);
    expect(result.pitchOk).toBe(true);
  });
});
