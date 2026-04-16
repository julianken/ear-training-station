import { describe, it, expect } from 'vitest';
import { mapHzToDegree, IN_KEY_CENTS } from '@/pitch/degree-mapping';
import { C_MAJOR, A_MINOR } from '../helpers/fixtures';
import { midiToHz, pitchClassToMidi } from '@/audio/note-math';

describe('IN_KEY_CENTS', () => {
  it('is exported and equals 50', () => {
    expect(IN_KEY_CENTS).toBe(50);
  });
});

describe('mapHzToDegree', () => {
  it('exact C maps to degree 1 in C major', () => {
    const hz = midiToHz(pitchClassToMidi('C', 4));
    const r = mapHzToDegree(hz, C_MAJOR);
    expect(r).not.toBe(null);
    if (!r) return;
    expect(r.degree).toBe(1);
    expect(Math.abs(r.cents)).toBeLessThan(5);
    expect(r.inKey).toBe(true);
  });

  it('exact G maps to degree 5 in C major (any octave)', () => {
    const g3 = midiToHz(pitchClassToMidi('G', 3));
    const g4 = midiToHz(pitchClassToMidi('G', 4));
    const g5 = midiToHz(pitchClassToMidi('G', 5));
    for (const hz of [g3, g4, g5]) {
      const r = mapHzToDegree(hz, C_MAJOR);
      expect(r).not.toBe(null);
      if (!r) return;
      expect(r.degree).toBe(5);
      expect(r.inKey).toBe(true);
    }
  });

  it('A in A minor maps to degree 1', () => {
    const hz = midiToHz(pitchClassToMidi('A', 4));
    const r = mapHzToDegree(hz, A_MINOR);
    expect(r).not.toBe(null);
    if (!r) return;
    expect(r.degree).toBe(1);
  });

  it('C in A minor maps to degree 3 (minor third of A)', () => {
    const hz = midiToHz(pitchClassToMidi('C', 5));
    const r = mapHzToDegree(hz, A_MINOR);
    expect(r).not.toBe(null);
    if (!r) return;
    expect(r.degree).toBe(3);
  });

  it('sharp pitch reports positive cents', () => {
    const hz = midiToHz(pitchClassToMidi('G', 4)) * Math.pow(2, 20 / 1200); // +20 cents
    const r = mapHzToDegree(hz, C_MAJOR);
    expect(r).not.toBe(null);
    if (!r) return;
    expect(r.degree).toBe(5);
    expect(r.cents).toBeGreaterThan(15);
    expect(r.cents).toBeLessThan(25);
  });

  it('out-of-key pitch (F# in C major) maps to nearest degree (4 or 5) with inKey=false', () => {
    const hz = midiToHz(pitchClassToMidi('F#', 4));
    const r = mapHzToDegree(hz, C_MAJOR);
    expect(r).not.toBe(null);
    if (!r) return;
    expect([4, 5]).toContain(r.degree);
    expect(r.inKey).toBe(false);
  });

  it('returns null for non-positive hz', () => {
    expect(mapHzToDegree(0, C_MAJOR)).toBe(null);
    expect(mapHzToDegree(-1, C_MAJOR)).toBe(null);
  });
});
