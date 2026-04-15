import type { Key, Degree } from '@/types/music';
import type { Register } from '@/types/domain';
import { semitoneOffset, PITCH_CLASSES } from '@/types/music';
import { pitchClassToMidi, midiToHz } from './note-math';

export const TARGET_DURATION_SECONDS = 1.5;

export interface NoteEvent {
  midi: number;
  hz: number;
  durationSec: number;
}

/**
 * Produce a single scale-degree target note in the specified register.
 * Registers:
 *   - 'narrow': degree note sits in the octave starting at tonic4 (no below-tonic notes)
 *   - 'comfortable': same but can use next octave for degrees 6, 7 if higher feels better
 *   - 'wide': deterministic octave variation across degrees (for variety)
 */
export function buildTarget(
  key: Key,
  degree: Degree,
  register: Register,
): NoteEvent {
  const tonicIdx = PITCH_CLASSES.indexOf(key.tonic);
  const offset = semitoneOffset(degree, key.quality);
  const targetIdx = (tonicIdx + offset) % 12;
  // targetIdx is always in [0, 11] because tonicIdx ∈ [0,11] and offset ∈ [0,11].
  const targetPc = PITCH_CLASSES[targetIdx]!;

  let midi: number;

  if (register === 'wide') {
    // Interleaved-octave variation: even degrees drop to octave 3 for variety;
    // odd degrees and degrees 6-7 stay in octave 4.
    const octave = (degree === 2 || degree === 4) ? 3 : 4;
    midi = pitchClassToMidi(targetPc, octave);
  } else {
    // 'narrow' and 'comfortable' currently produce the same output: octave 4.
    // Distinguishing them is deferred — the register axis exists now in the data model;
    // concrete narrowing rules live with UI settings (Plan C).
    midi = pitchClassToMidi(targetPc, 4);
  }

  return {
    midi,
    hz: midiToHz(midi),
    durationSec: TARGET_DURATION_SECONDS,
  };
}
