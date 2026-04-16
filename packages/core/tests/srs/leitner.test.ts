import { describe, it, expect } from 'vitest';
import {
  nextBoxOnPass,
  nextBoxOnMiss,
  intervalForBox,
  dueAtAfter,
  PROMOTE_AFTER_CONSECUTIVE_PASSES,
} from '@/srs/leitner';

describe('leitner box transitions', () => {
  describe('on pass', () => {
    it('stays in box until consecutive_passes threshold', () => {
      expect(nextBoxOnPass('learning', 1)).toBe('learning');
      expect(nextBoxOnPass('learning', 2)).toBe('learning');
    });

    it('promotes new → learning on first pass', () => {
      expect(nextBoxOnPass('new', 1)).toBe('learning');
    });

    it('promotes learning → reviewing after threshold', () => {
      expect(nextBoxOnPass('learning', PROMOTE_AFTER_CONSECUTIVE_PASSES)).toBe('reviewing');
    });

    it('promotes reviewing → mastered after threshold', () => {
      expect(nextBoxOnPass('reviewing', PROMOTE_AFTER_CONSECUTIVE_PASSES)).toBe('mastered');
    });

    it('stays at mastered once mastered', () => {
      expect(nextBoxOnPass('mastered', 10)).toBe('mastered');
    });
  });

  describe('on miss', () => {
    it('demotes by one box', () => {
      expect(nextBoxOnMiss('mastered')).toBe('reviewing');
      expect(nextBoxOnMiss('reviewing')).toBe('learning');
      expect(nextBoxOnMiss('learning')).toBe('learning');
      expect(nextBoxOnMiss('new')).toBe('new');
    });
  });
});

describe('leitner intervals', () => {
  const HOUR = 60 * 60 * 1000;
  const DAY = 24 * HOUR;

  it('new items are due immediately', () => {
    expect(intervalForBox('new', 0)).toBe(0);
  });

  it('learning items are due next session (tomorrow floor)', () => {
    // Approximation: 1 day; see dueAtAfter for exact semantics.
    expect(intervalForBox('learning', 0)).toBe(DAY);
  });

  it('reviewing items escalate 2d → 5d → 10d', () => {
    expect(intervalForBox('reviewing', 0)).toBe(2 * DAY);
    expect(intervalForBox('reviewing', 1)).toBe(5 * DAY);
    expect(intervalForBox('reviewing', 2)).toBe(10 * DAY);
    // repeats at 10d once top reached
    expect(intervalForBox('reviewing', 99)).toBe(10 * DAY);
  });

  it('mastered items review every 21d', () => {
    expect(intervalForBox('mastered', 0)).toBe(21 * DAY);
  });
});

describe('dueAtAfter', () => {
  it('returns now + interval for the box', () => {
    const now = 1_700_000_000_000;
    const result = dueAtAfter('reviewing', 0, now);
    expect(result).toBe(now + 2 * 24 * 60 * 60 * 1000);
  });
});
