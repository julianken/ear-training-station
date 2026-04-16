import type { Item } from '@/types/domain';
import { mapHzToDegree } from '@/pitch/degree-mapping';

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
  const cents_off = mapping !== null ? mapping.cents : null;

  return { pitchOk, sungBest: best, cents_off };
}
