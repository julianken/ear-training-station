import { describe, it, expect } from 'vitest';
import { itemId, keyId, semitoneOffset, PITCH_CLASSES, DEGREES } from '@/types/music';
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

  describe('semitoneOffset (full scale coverage)', () => {
    const MAJOR: Array<[1|2|3|4|5|6|7, number]> = [
      [1, 0], [2, 2], [3, 4], [4, 5], [5, 7], [6, 9], [7, 11],
    ];
    it.each(MAJOR)('major degree %i → %i semitones', (degree, expected) => {
      expect(semitoneOffset(degree, 'major')).toBe(expected);
    });

    const MINOR: Array<[1|2|3|4|5|6|7, number]> = [
      [1, 0], [2, 2], [3, 3], [4, 5], [5, 7], [6, 8], [7, 10],
    ];
    it.each(MINOR)('minor degree %i → %i semitones', (degree, expected) => {
      expect(semitoneOffset(degree, 'minor')).toBe(expected);
    });
  });

  describe('PITCH_CLASSES', () => {
    it('has length 12', () => {
      expect(PITCH_CLASSES).toHaveLength(12);
    });

    it("starts with 'C'", () => {
      expect(PITCH_CLASSES[0]).toBe('C');
    });

    it("ends with 'B'", () => {
      expect(PITCH_CLASSES[PITCH_CLASSES.length - 1]).toBe('B');
    });
  });

  describe('DEGREES', () => {
    it('has length 7', () => {
      expect(DEGREES).toHaveLength(7);
    });

    it('equals [1, 2, 3, 4, 5, 6, 7]', () => {
      expect(DEGREES).toEqual([1, 2, 3, 4, 5, 6, 7]);
    });
  });
});
