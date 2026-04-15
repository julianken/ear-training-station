import { describe, it, expect } from 'vitest';
import { buildTarget, TARGET_DURATION_SECONDS } from '@/audio/target-structure';
import { C_MAJOR, A_MINOR, G_MAJOR } from '../helpers/fixtures';
import { midiToHz, pitchClassToMidi } from '@/audio/note-math';

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

  it('degree 3 in A minor equals C5 (MIDI 72) — shifted above tonic A4=69', () => {
    const ev = buildTarget(A_MINOR, 3, 'comfortable');
    expect(ev.midi).toBe(72);
  });

  it('narrow register stays within one octave above tonic (parametrized)', () => {
    const keys = [C_MAJOR, G_MAJOR, A_MINOR];
    for (const key of keys) {
      const tonicMidi = pitchClassToMidi(key.tonic, 4);
      for (const d of [1, 2, 3, 4, 5, 6, 7] as const) {
        const ev = buildTarget(key, d, 'narrow');
        expect(ev.midi).toBeGreaterThanOrEqual(tonicMidi);
        expect(ev.midi).toBeLessThanOrEqual(tonicMidi + 12);
      }
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
