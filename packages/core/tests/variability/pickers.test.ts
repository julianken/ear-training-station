import { describe, it, expect } from 'vitest';
import {
  pickTimbre,
  pickRegister,
  TIMBRE_IDS,
  type VariabilityHistory,
  type VariabilitySettings,
} from '@/variability/pickers';

const NO_HISTORY: VariabilityHistory = { lastTimbre: null, lastRegister: null };
const NO_LOCKS: VariabilitySettings = { lockedTimbre: null, lockedRegister: null };

describe('pickTimbre', () => {
  it('returns a valid TimbreId', () => {
    const result = pickTimbre(() => 0.5, NO_HISTORY, NO_LOCKS);
    expect(TIMBRE_IDS).toContain(result);
  });

  it('avoids repeating the last timbre', () => {
    const results = new Set<string>();
    for (let i = 0; i < 100; i++) {
      results.add(pickTimbre(() => Math.random(), { ...NO_HISTORY, lastTimbre: 'piano' }, NO_LOCKS));
    }
    expect(results.has('piano')).toBe(false);
  });

  it('returns locked timbre regardless of history', () => {
    const result = pickTimbre(
      () => 0.5,
      { ...NO_HISTORY, lastTimbre: 'guitar' },
      { ...NO_LOCKS, lockedTimbre: 'guitar' },
    );
    expect(result).toBe('guitar');
  });
});

describe('pickRegister', () => {
  it('returns a valid Register', () => {
    const result = pickRegister(() => 0.5, NO_HISTORY, NO_LOCKS);
    expect(['narrow', 'comfortable', 'wide']).toContain(result);
  });

  it('avoids repeating the last register', () => {
    const results = new Set<string>();
    for (let i = 0; i < 100; i++) {
      results.add(pickRegister(() => Math.random(), { ...NO_HISTORY, lastRegister: 'narrow' }, NO_LOCKS));
    }
    expect(results.has('narrow')).toBe(false);
  });

  it('returns locked register', () => {
    const result = pickRegister(
      () => 0.5,
      NO_HISTORY,
      { ...NO_LOCKS, lockedRegister: 'wide' },
    );
    expect(result).toBe('wide');
  });
});

describe('pickRegister — available parameter', () => {
  it('picks only from the available list when provided', () => {
    const rng = () => 0.5;
    const history = { lastTimbre: null, lastRegister: null };
    const settings = { lockedTimbre: null, lockedRegister: null };
    for (let i = 0; i < 20; i++) {
      const r = pickRegister(rng, history, settings, ['comfortable']);
      expect(r).toBe('comfortable');
    }
  });

  it('respects lockedRegister when it appears in the available list', () => {
    const rng = () => 0.5;
    const history = { lastTimbre: null, lastRegister: null };
    const settings = { lockedTimbre: null, lockedRegister: 'narrow' as const };
    expect(pickRegister(rng, history, settings, ['comfortable', 'narrow'])).toBe('narrow');
  });

  it('ignores lockedRegister when it is NOT in the available list', () => {
    const rng = () => 0.5;
    const history = { lastTimbre: null, lastRegister: null };
    const settings = { lockedTimbre: null, lockedRegister: 'wide' as const };
    expect(pickRegister(rng, history, settings, ['comfortable'])).toBe('comfortable');
  });
});
