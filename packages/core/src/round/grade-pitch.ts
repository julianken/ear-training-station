import type { Item } from '@/types/domain';
import { mapHzToDegree } from '@/pitch/degree-mapping';
import { centsBetween, pitchClassToMidi, midiToHz } from '@/audio/note-math';
import { semitoneOffset } from '@/types/music';

export interface PitchObservation {
  at_ms: number;
  hz: number;
  confidence: number;
}

export interface PitchGrade {
  pitchOk: boolean;
  sungBest: PitchObservation | null;
  cents_off: number | null;
}

export function gradePitch(
  frames: ReadonlyArray<PitchObservation>,
  item: Item,
  minConfidence: number,
): PitchGrade {
  const confident = frames.filter((f) => f.confidence >= minConfidence && f.hz > 0);
  if (confident.length === 0) {
    return { pitchOk: false, sungBest: null, cents_off: null };
  }

  const best = confident.reduce((a, b) => (b.confidence > a.confidence ? b : a));

  const mapping = mapHzToDegree(best.hz, item.key);
  const pitchOk = mapping !== null && mapping.degree === item.degree && mapping.inKey;

  const targetMidi = pitchClassToMidi(item.key.tonic, 4) + semitoneOffset(item.degree, item.key.quality);
  const targetHz = midiToHz(targetMidi);
  const cents_off = centsBetween(best.hz, targetHz);

  return { pitchOk, sungBest: best, cents_off };
}
