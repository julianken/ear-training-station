import { DIGIT_LABELS, type DigitLabel } from './keyword-spotter';

export function digitLabelToNumber(label: DigitLabel): number {
  const idx = DIGIT_LABELS.indexOf(label);
  if (idx < 0) throw new Error(`Unknown digit label: "${label}"`);
  return idx + 1;
}
