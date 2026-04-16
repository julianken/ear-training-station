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

  describe('centsBetween edge cases', () => {
    it('octave above is +1200 cents', () => {
      // 880 Hz is A5, one octave above A4 (440 Hz)
      expect(centsBetween(880, 440)).toBeCloseTo(1200, 4);
    });

    it('octave below is -1200 cents', () => {
      // 220 Hz is A3, one octave below A4 (440 Hz)
      expect(centsBetween(220, 440)).toBeCloseTo(-1200, 4);
    });

    it('zero hz sung returns 0 (guard path)', () => {
      // centsBetween returns 0 when either argument <= 0
      expect(centsBetween(0, 440)).toBe(0);
    });

    it('zero hz target returns 0 (guard path)', () => {
      expect(centsBetween(440, 0)).toBe(0);
    });

    it('negative hz sung returns 0 (guard path)', () => {
      expect(centsBetween(-440, 440)).toBe(0);
    });

    it('negative hz target returns 0 (guard path)', () => {
      expect(centsBetween(440, -440)).toBe(0);
    });

    it('both zero returns 0 (guard path)', () => {
      expect(centsBetween(0, 0)).toBe(0);
    });
  });
});
