import { DIGIT_LABELS, type DigitLabel } from './keyword-spotter';
import type { Degree } from '@ear-training/core/types/music';

export function digitLabelToNumber(label: DigitLabel): Degree {
  const idx = DIGIT_LABELS.indexOf(label);
  if (idx < 0) throw new Error(`Unknown digit label: "${label}"`);
  return (idx + 1) as Degree;
}
