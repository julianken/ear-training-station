import type { Degree } from '@ear-training/core/types/music';

const MAJOR: Record<Degree, string> = {
  1: 'The 1 is home — the tonic. Everything resolves here.',
  2: 'The 2 is a subtle tension, pulling up to the 3 or down to the 1.',
  3: 'The 3 is the bright, happy note of the key.',
  4: 'The 4 wants to resolve down to the 3.',
  5: 'The 5 is the brightest tension; it pulls strongly back to the 1.',
  6: 'The 6 is a rich, melodic note that often wants to fall to the 5.',
  7: 'The 7 is the leading tone — it craves the 1.',
};

const MINOR: Record<Degree, string> = {
  1: 'The 1 is home in the minor key.',
  2: 'The 2 in minor has a distinctive tension.',
  3: 'The flat 3 gives the minor its melancholic color.',
  4: 'The 4 is a stable subdominant.',
  5: 'The 5 wants to resolve to the 1.',
  6: 'The flat 6 adds drama.',
  7: 'The 7 (usually the leading tone in harmonic minor) wants to resolve up.',
};

export function tooltipFor(degree: Degree, quality: 'major' | 'minor'): string {
  return (quality === 'major' ? MAJOR : MINOR)[degree];
}
