import type { PitchClass } from '@/types/music';
import { PITCH_CLASSES } from '@/types/music';

const A4_MIDI = 69;
const A4_HZ = 440;

/** Hz for a MIDI number. A4 = 69 → 440 Hz. */
export function midiToHz(midi: number): number {
  return A4_HZ * Math.pow(2, (midi - A4_MIDI) / 12);
}

/** Fractional MIDI number for a Hz frequency. */
export function hzToMidi(hz: number): number {
  return A4_MIDI + 12 * Math.log2(hz / A4_HZ);
}

/**
 * Convert (pitch class, octave) to a MIDI number.
 * Octave follows the scientific pitch notation: C4 = 60, middle C.
 */
export function pitchClassToMidi(pc: PitchClass, octave: number): number {
  const idx = PITCH_CLASSES.indexOf(pc);
  if (idx < 0) throw new Error(`unknown pitch class: ${pc}`);
  // C4 = MIDI 60; semitone index within an octave matches PITCH_CLASSES starting from C
  return (octave + 1) * 12 + idx;
}

/** Signed cents deviation of `hzSung` from `hzTarget`. Positive = sharp. */
export function centsBetween(hzSung: number, hzTarget: number): number {
  if (hzSung <= 0 || hzTarget <= 0) return 0;
  return 1200 * Math.log2(hzSung / hzTarget);
}

/**
 * Snap a Hz frequency to the nearest MIDI note, reporting cents off
 * the snapped note's frequency.
 */
export function nearestMidi(hz: number): { midi: number; cents: number } {
  if (hz <= 0) return { midi: 0, cents: 0 };
  const midiFloat = hzToMidi(hz);
  const midi = Math.round(midiFloat);
  const cents = centsBetween(hz, midiToHz(midi));
  return { midi, cents };
}
