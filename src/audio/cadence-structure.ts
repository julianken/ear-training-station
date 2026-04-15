import type { Key } from '@/types/music';
import { pitchClassToMidi } from './note-math';

/** Duration of a full I-IV-V-I cadence in seconds (nominal tempo). */
export const CADENCE_DURATION_SECONDS = 3.2;

const CHORD_DURATION_SEC = 0.7; // each chord plays for ~0.7s
const CHORD_GAP_SEC = 0.1;     // small gap between chords
// Step = 0.8s. 4 chords × 0.8s = 3.2s total.

export interface ChordEvent {
  /** MIDI numbers to play simultaneously. */
  notes: number[];
  /** When this chord starts, seconds from cadence start. */
  startSec: number;
  /** How long each pitch in this chord sounds. */
  durationSec: number;
  /** Roman-numeral label for UI / debugging ('I', 'IV', 'V', 'i', 'iv'). */
  romanNumeral: string;
}

/**
 * Build a I-IV-V-I cadence (major) or i-iv-V-i (minor, harmonic-minor-flavored
 * with a major V to establish the tonic).
 *
 * Voicings are simple root-position triads in the octave centered around middle C.
 */
export function buildCadence(key: Key): ChordEvent[] {
  const tonicMidi = pitchClassToMidi(key.tonic, 4); // octave 4 for middle voicing
  const isMajor = key.quality === 'major';

  // Semitone offsets from tonic for the three chord roots (I, IV, V):
  // Major: major triad (0, 4, 7), IV major (5 + (0, 4, 7)), V major (7 + (0, 4, 7))
  // Minor: minor triad (0, 3, 7), iv minor (5 + (0, 3, 7)), V major (7 + (0, 4, 7))
  const majorTriad = [0, 4, 7];
  const minorTriad = [0, 3, 7];

  const I_notes = isMajor ? majorTriad : minorTriad;
  const IV_notes = isMajor ? majorTriad : minorTriad;
  const V_notes = majorTriad; // V is major in both major and minor cadences for resolution

  const rootOffsets = [0, 5, 7, 0]; // I, IV, V, I
  const triads = [I_notes, IV_notes, V_notes, I_notes];
  const labels = isMajor ? ['I', 'IV', 'V', 'I'] : ['i', 'iv', 'V', 'i'];

  const events: ChordEvent[] = [];
  for (let i = 0; i < 4; i++) {
    const rootMidi = tonicMidi + rootOffsets[i]!;
    const notes = triads[i]!.map((off) => rootMidi + off);
    events.push({
      notes,
      startSec: i * (CHORD_DURATION_SEC + CHORD_GAP_SEC),
      durationSec: CHORD_DURATION_SEC,
      romanNumeral: labels[i]!,
    });
  }
  return events;
}
