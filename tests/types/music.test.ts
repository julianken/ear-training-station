import { describe, it, expect } from 'vitest';
import { itemId, keyId, semitoneOffset } from '@/types/music';
import { C_MAJOR, A_MINOR } from '../helpers/fixtures';

describe('music types', () => {
  it('keyId produces stable ids', () => {
    expect(keyId(C_MAJOR)).toBe('C-major');
    expect(keyId(A_MINOR)).toBe('A-minor');
  });

  it('itemId composes degree and key', () => {
    expect(itemId(5, C_MAJOR)).toBe('5-C-major');
    expect(itemId(3, A_MINOR)).toBe('3-A-minor');
  });

  it('semitoneOffset returns correct intervals for major', () => {
    expect(semitoneOffset(1, 'major')).toBe(0);
    expect(semitoneOffset(3, 'major')).toBe(4);
    expect(semitoneOffset(5, 'major')).toBe(7);
    expect(semitoneOffset(7, 'major')).toBe(11);
  });

  it('semitoneOffset returns correct intervals for natural minor', () => {
    expect(semitoneOffset(1, 'minor')).toBe(0);
    expect(semitoneOffset(3, 'minor')).toBe(3);
    expect(semitoneOffset(6, 'minor')).toBe(8);
    expect(semitoneOffset(7, 'minor')).toBe(10);
  });
});
