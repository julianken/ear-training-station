import { describe, it, expect } from 'vitest';
import { groupFor, MVP_CURRICULUM } from '@/scheduler/curriculum';

const C_MAJOR = { tonic: 'C' as const, quality: 'major' as const };
const G_MAJOR = { tonic: 'G' as const, quality: 'major' as const };
const A_MINOR = { tonic: 'A' as const, quality: 'minor' as const };

describe('groupFor', () => {
  it('degree 1 in C major belongs to the first group (tonic triad)', () => {
    const group = groupFor(1, C_MAJOR);
    expect(group).not.toBeNull();
    expect(group!.id).toBe('c-major-tonic-triad');
    expect(group!.prerequisite).toBeNull();
  });

  it('degree 5 in C major belongs to the first group (tonic triad)', () => {
    const group = groupFor(5, C_MAJOR);
    expect(group).not.toBeNull();
    expect(group!.id).toBe('c-major-tonic-triad');
  });

  it('degree 3 in C major belongs to the first group (tonic triad)', () => {
    const group = groupFor(3, C_MAJOR);
    expect(group).not.toBeNull();
    expect(group!.id).toBe('c-major-tonic-triad');
  });

  it('degree 7 in C major belongs to the second group (diatonic full)', () => {
    const group = groupFor(7, C_MAJOR);
    expect(group).not.toBeNull();
    expect(group!.id).toBe('c-major-diatonic-full');
    // Second group requires the first to be 70% mastered before unlocking
    expect(group!.prerequisite).toBe('c-major-tonic-triad');
  });

  it('degree 2 in C major belongs to the second group (diatonic full)', () => {
    const group = groupFor(2, C_MAJOR);
    expect(group).not.toBeNull();
    expect(group!.id).toBe('c-major-diatonic-full');
  });

  it('degree 1 in G major belongs to the g-major-full group', () => {
    const group = groupFor(1, G_MAJOR);
    expect(group).not.toBeNull();
    expect(group!.id).toBe('g-major-full');
  });

  it('returns null for a key not in the curriculum (A minor)', () => {
    const group = groupFor(1, A_MINOR);
    expect(group).toBeNull();
  });

  it('the first group has no prerequisite (it is the entry point)', () => {
    expect(MVP_CURRICULUM[0]!.prerequisite).toBeNull();
  });

  it('all subsequent groups have a prerequisite', () => {
    for (const group of MVP_CURRICULUM.slice(1)) {
      expect(group.prerequisite).not.toBeNull();
    }
  });
});
