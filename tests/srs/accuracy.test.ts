import { describe, it, expect } from 'vitest';
import { weightedAccuracy, pushOutcome, ACCURACY_WINDOW } from '@/srs/accuracy';
import type { AttemptOutcome } from '@/types/domain';

function pass(at = 0): AttemptOutcome {
  return { pitch: true, label: true, pass: true, at };
}
function missPitch(at = 0): AttemptOutcome {
  return { pitch: false, label: true, pass: false, at };
}

describe('weightedAccuracy', () => {
  it('is 0 when no history', () => {
    const acc = weightedAccuracy([], 'pitch');
    expect(acc).toBe(0);
  });

  it('is 1.0 with all pass on pitch', () => {
    const history = [pass(1), pass(2), pass(3)];
    expect(weightedAccuracy(history, 'pitch')).toBe(1);
  });

  it('is 0.0 with all misses on pitch', () => {
    const history = [missPitch(1), missPitch(2), missPitch(3)];
    expect(weightedAccuracy(history, 'pitch')).toBe(0);
  });

  it('weights recent attempts more heavily', () => {
    // Older pass, newer miss — accuracy should be well below 0.5
    const history = [pass(1), missPitch(100)];
    const acc = weightedAccuracy(history, 'pitch');
    expect(acc).toBeLessThan(0.5);
  });

  it('weights recent pass higher than older miss', () => {
    const history = [missPitch(1), pass(100)];
    const acc = weightedAccuracy(history, 'pitch');
    expect(acc).toBeGreaterThan(0.5);
  });
});

describe('pushOutcome', () => {
  it('appends and caps at ACCURACY_WINDOW', () => {
    const big = Array.from({ length: ACCURACY_WINDOW + 5 }, (_, i) => pass(i));
    let hist: ReadonlyArray<AttemptOutcome> = [];
    for (const o of big) {
      hist = pushOutcome(hist, o);
    }
    expect(hist.length).toBe(ACCURACY_WINDOW);
    // oldest should be the (5th) one, since first 5 dropped
    expect(hist[0]!.at).toBe(5);
    expect(hist[hist.length - 1]!.at).toBe(big.length - 1);
  });

  it('returns a new array (immutable)', () => {
    const hist: ReadonlyArray<AttemptOutcome> = [pass(1)];
    const next = pushOutcome(hist, pass(2));
    expect(next).not.toBe(hist);
    expect(hist.length).toBe(1);
    expect(next.length).toBe(2);
  });
});
