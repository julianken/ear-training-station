import { describe, it, expect } from 'vitest';
import { TIMBRE_IDS, getTimbre, type TimbreId } from '@/audio/timbres';

describe('timbres', () => {
  it('exposes exactly 4 timbre ids', () => {
    expect(TIMBRE_IDS.length).toBe(4);
  });

  it('each timbre id maps to a timbre with a label and a synth factory', () => {
    for (const id of TIMBRE_IDS) {
      const t = getTimbre(id);
      expect(t.id).toBe(id);
      expect(typeof t.label).toBe('string');
      expect(t.label.length).toBeGreaterThan(0);
      expect(typeof t.createSynth).toBe('function');
    }
  });

  it('ids are stable (piano, epiano, guitar, pad)', () => {
    const ids: TimbreId[] = ['piano', 'epiano', 'guitar', 'pad'];
    for (const id of ids) {
      expect(TIMBRE_IDS).toContain(id);
    }
  });

  it('getTimbre throws on unknown id', () => {
    // @ts-expect-error deliberately wrong
    expect(() => getTimbre('banjo')).toThrow();
  });
});
