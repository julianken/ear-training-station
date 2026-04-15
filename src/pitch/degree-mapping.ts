import type { Key, Degree } from '@/types/music';
import { DEGREES, semitoneOffset } from '@/types/music';
import { hzToMidi, pitchClassToMidi } from '@/audio/note-math';

export interface DegreeMapping {
  degree: Degree;
  /** Signed cents deviation from the ideal pitch of that degree in the current key. */
  cents: number;
  /** True if |cents| < IN_KEY_CENTS (the pitch sits on a diatonic degree). */
  inKey: boolean;
}

/** Pitch must be within this cents range of a diatonic degree to count as "in key". */
const IN_KEY_CENTS = 50;

/**
 * Map a detected Hz to the nearest diatonic scale degree in the given key,
 * octave-invariant. Returns null if `hz` is not positive.
 */
export function mapHzToDegree(hz: number, key: Key): DegreeMapping | null {
  if (hz <= 0) return null;

  const sungMidi = hzToMidi(hz);
  const tonicMidi = pitchClassToMidi(key.tonic, 4);
  // Pitch-class distance mod 12 from tonic. Negative rounding-safe.
  const sungPcFromTonic = ((sungMidi - tonicMidi) % 12 + 12) % 12;

  let best: { degree: Degree; cents: number } | null = null;
  for (const d of DEGREES) {
    const targetOffset = semitoneOffset(d, key.quality);
    // Compare sungPcFromTonic to targetOffset, choosing the shorter circular distance.
    let diff = sungPcFromTonic - targetOffset; // semitones
    // Normalize to [-6, 6]
    while (diff > 6) diff -= 12;
    while (diff < -6) diff += 12;
    const cents = diff * 100;
    if (best === null || Math.abs(cents) < Math.abs(best.cents)) {
      best = { degree: d, cents };
    }
  }

  // best is always non-null because DEGREES has 7 entries
  const { degree, cents } = best!;
  return { degree, cents, inKey: Math.abs(cents) < IN_KEY_CENTS };
}
