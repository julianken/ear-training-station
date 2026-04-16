import { describe, it, expect } from 'vitest';
import { digitLabelToNumber } from '@/speech/digit-label';
import { DIGIT_LABELS, type DigitLabel } from '@/speech/keyword-spotter';

describe('digitLabelToNumber', () => {
  it.each([
    ['one', 1],
    ['two', 2],
    ['three', 3],
    ['four', 4],
    ['five', 5],
    ['six', 6],
    ['seven', 7],
  ] as const)('converts "%s" to %d', (label, expected) => {
    expect(digitLabelToNumber(label)).toBe(expected);
  });

  it('throws on unknown label', () => {
    expect(() => digitLabelToNumber('eight' as DigitLabel)).toThrow();
  });
});
