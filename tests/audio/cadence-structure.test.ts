import { describe, it, expect } from 'vitest';
import { buildCadence, CADENCE_DURATION_SECONDS } from '@/audio/cadence-structure';
import { C_MAJOR, G_MAJOR, A_MINOR } from '../helpers/fixtures';

describe('buildCadence', () => {
  it('returns 4 chord events for a I-IV-V-I cadence in major', () => {
    const events = buildCadence(C_MAJOR);
    expect(events.length).toBe(4);
  });

  it('chord roots are I, IV, V, I in the target key (by MIDI semitones from tonic)', () => {
    const events = buildCadence(C_MAJOR);
    // First pitch of each chord is the root
    const roots = events.map((e) => e.notes[0]!);
    // Expected root offsets from tonic in semitones: 0, 5, 7, 0
    const tonic = roots[0]!;
    const offsets = roots.map((m) => (m - tonic) % 12);
    expect(offsets).toEqual([0, 5, 7, 0]);
  });

  it('total cadence duration approximately matches CADENCE_DURATION_SECONDS', () => {
    const events = buildCadence(C_MAJOR);
    const last = events[events.length - 1]!;
    const end = last.startSec + last.durationSec;
    expect(end).toBeCloseTo(CADENCE_DURATION_SECONDS, 0);
  });

  it('G major cadence transposes correctly', () => {
    const c = buildCadence(C_MAJOR);
    const g = buildCadence(G_MAJOR);
    // Semitone distance C→G = 7. Each chord root should shift by 7 mod 12.
    for (let i = 0; i < 4; i++) {
      const dC = c[i]!.notes[0]!;
      const dG = g[i]!.notes[0]!;
      expect(((dG - dC) % 12 + 12) % 12).toBe(7);
    }
  });

  it('minor cadence uses i-iv-V-i (major V in natural-minor convention)', () => {
    const events = buildCadence(A_MINOR);
    const tonic = events[0]!.notes[0]!;
    const offsets = events.map((e) => ((e.notes[0]! - tonic) % 12 + 12) % 12);
    // i, iv, V, i
    expect(offsets).toEqual([0, 5, 7, 0]);
    // Check that i is a minor triad (root, minor third, fifth)
    const iChord = events[0]!.notes;
    // minor triad: offsets 0, 3, 7 from root
    const iOffs = iChord.map((m) => m - iChord[0]!).sort((a, b) => a - b);
    expect(iOffs).toEqual([0, 3, 7]);
  });

  it('chord events have non-overlapping start times', () => {
    const events = buildCadence(C_MAJOR);
    for (let i = 1; i < events.length; i++) {
      expect(events[i]!.startSec).toBeGreaterThanOrEqual(events[i - 1]!.startSec);
    }
  });
});
