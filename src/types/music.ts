// Pitch classes (12 notes in an octave), using sharps for simplicity.
// Accidentals (♭) are not part of MVP item set but PitchClass must support all 12.
export type PitchClass =
  | 'C' | 'C#' | 'D' | 'D#' | 'E' | 'F'
  | 'F#' | 'G' | 'G#' | 'A' | 'A#' | 'B';

export const PITCH_CLASSES: readonly PitchClass[] = [
  'C', 'C#', 'D', 'D#', 'E', 'F',
  'F#', 'G', 'G#', 'A', 'A#', 'B',
];

export type KeyQuality = 'major' | 'minor';

export interface Key {
  tonic: PitchClass;
  quality: KeyQuality;
}

// MVP scale degrees are diatonic 1..7. No accidentals yet.
export type Degree = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const DEGREES: readonly Degree[] = [1, 2, 3, 4, 5, 6, 7];

// Stable id for a key: "C-major", "A-minor".
export function keyId(key: Key): string {
  return `${key.tonic}-${key.quality}`;
}

// Stable id for an item (degree in a key): "5-C-major".
export function itemId(degree: Degree, key: Key): string {
  return `${degree}-${keyId(key)}`;
}

// Diatonic scale offsets from tonic, in semitones.
// Major: W W H W W W H → 0, 2, 4, 5, 7, 9, 11
// Natural minor: W H W W H W W → 0, 2, 3, 5, 7, 8, 10
const MAJOR_OFFSETS: Record<Degree, number> = {
  1: 0, 2: 2, 3: 4, 4: 5, 5: 7, 6: 9, 7: 11,
};
const MINOR_OFFSETS: Record<Degree, number> = {
  1: 0, 2: 2, 3: 3, 4: 5, 5: 7, 6: 8, 7: 10,
};

/** Returns semitone offset of `degree` from the tonic in the given key. */
export function semitoneOffset(degree: Degree, quality: KeyQuality): number {
  return (quality === 'major' ? MAJOR_OFFSETS : MINOR_OFFSETS)[degree];
}
