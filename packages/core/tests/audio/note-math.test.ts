import { describe, it, expect } from 'vitest';
import {
  midiToHz,
  hzToMidi,
  pitchClassToMidi,
  centsBetween,
  nearestMidi,
} from '@/audio/note-math';

describe('note-math', () => {
  it('A4 is midi 69 and 440 Hz', () => {
    expect(midiToHz(69)).toBeCloseTo(440, 2);
    expect(hzToMidi(440)).toBeCloseTo(69, 2);
  });

  it('C4 is midi 60 and ~261.63 Hz', () => {
    expect(midiToHz(60)).toBeCloseTo(261.6256, 2);
  });

  it('pitchClassToMidi places a pitch class in a specific octave', () => {
    // Octave 4 in MIDI convention: C4 = 60
    expect(pitchClassToMidi('C', 4)).toBe(60);
    expect(pitchClassToMidi('A', 4)).toBe(69);
    expect(pitchClassToMidi('G#', 4)).toBe(68);
    expect(pitchClassToMidi('B', 4)).toBe(71);
  });

  it('centsBetween returns positive when sung is sharp of target', () => {
    // 440 Hz target, 445 Hz sung → ~+20 cents
    const cents = centsBetween(445, 440);
    expect(cents).toBeGreaterThan(15);
    expect(cents).toBeLessThan(25);
  });

  it('centsBetween returns 0 for identical Hz', () => {
    expect(centsBetween(440, 440)).toBeCloseTo(0, 4);
  });

  it('nearestMidi snaps a hz to the nearest midi and reports cents off', () => {
    const result = nearestMidi(445); // slightly above A4
    expect(result.midi).toBe(69);
    expect(result.cents).toBeGreaterThan(15);
    expect(result.cents).toBeLessThan(25);
  });
});
