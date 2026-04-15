import { describe, it, expect } from 'vitest';
import { buildTarget, TARGET_DURATION_SECONDS } from '@/audio/target-structure';
import { C_MAJOR, A_MINOR } from '../helpers/fixtures';
import { midiToHz } from '@/audio/note-math';

describe('buildTarget', () => {
  it('returns a single note event for a scale degree in a key', () => {
    const ev = buildTarget(C_MAJOR, 5, 'comfortable');
    expect(typeof ev.midi).toBe('number');
    expect(ev.durationSec).toBeCloseTo(TARGET_DURATION_SECONDS, 2);
  });

  it('degree 5 in C major equals G (MIDI 67) in octave 4', () => {
    const ev = buildTarget(C_MAJOR, 5, 'comfortable');
    expect(ev.midi).toBe(67);
    expect(midiToHz(ev.midi)).toBeCloseTo(391.995, 1);
  });

  it('degree 3 in A minor equals C (MIDI 60) in octave 4', () => {
    const ev = buildTarget(A_MINOR, 3, 'comfortable');
    expect(ev.midi).toBe(60);
  });

  it('narrow register stays within one octave above tonic', () => {
    for (const d of [1, 2, 3, 4, 5, 6, 7] as const) {
      const ev = buildTarget(C_MAJOR, d, 'narrow');
      // Tonic in narrow mode = C4 = 60. Max: B4 = 71.
      expect(ev.midi).toBeGreaterThanOrEqual(60);
      expect(ev.midi).toBeLessThanOrEqual(71);
    }
  });

  it('wide register can span below tonic', () => {
    // With 'wide', we expect at least one degree to fall below octave-4 tonic for some keys.
    // For C major degree 1 wide, the target may be C3 = 48 or C4 = 60. Just verify the range span.
    const picks = [1, 2, 3, 4, 5, 6, 7].map((d) =>
      buildTarget(C_MAJOR, d as 1|2|3|4|5|6|7, 'wide').midi,
    );
    const min = Math.min(...picks);
    const max = Math.max(...picks);
    expect(max - min).toBeGreaterThan(0); // non-zero range
    expect(max).toBeLessThan(84); // nothing above C6
    expect(min).toBeGreaterThan(36); // nothing below C2
  });

  it('target hz matches the midi output', () => {
    const ev = buildTarget(C_MAJOR, 5, 'comfortable');
    expect(ev.hz).toBeCloseTo(midiToHz(ev.midi), 2);
  });
});
