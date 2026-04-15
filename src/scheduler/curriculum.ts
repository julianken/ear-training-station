import type { Degree, Key } from '@/types/music';

/**
 * An ordered curriculum group. A group is a coherent slice of content
 * that unlocks together when its prerequisite is sufficiently mastered.
 */
export interface CurriculumGroup {
  id: string;
  label: string;
  /** Items in this group. */
  members: ReadonlyArray<{ degree: Degree; key: Key }>;
  /** Other group id whose mastery >= UNLOCK_THRESHOLD triggers this one. */
  prerequisite: string | null;
}

/**
 * Fraction of a group's items that must be in reviewing/mastered
 * before the next group unlocks. Spec §6.5.
 */
export const UNLOCK_THRESHOLD = 0.7;

/** The MVP curriculum, ordered. */
export const MVP_CURRICULUM: ReadonlyArray<CurriculumGroup> = [
  {
    id: 'c-major-tonic-triad',
    label: 'C major · degrees 1, 3, 5',
    members: [
      { degree: 1, key: { tonic: 'C', quality: 'major' } },
      { degree: 3, key: { tonic: 'C', quality: 'major' } },
      { degree: 5, key: { tonic: 'C', quality: 'major' } },
    ],
    prerequisite: null,
  },
  {
    id: 'c-major-diatonic-full',
    label: 'C major · degrees 2, 4, 6, 7',
    members: [
      { degree: 2, key: { tonic: 'C', quality: 'major' } },
      { degree: 4, key: { tonic: 'C', quality: 'major' } },
      { degree: 6, key: { tonic: 'C', quality: 'major' } },
      { degree: 7, key: { tonic: 'C', quality: 'major' } },
    ],
    prerequisite: 'c-major-tonic-triad',
  },
  {
    id: 'g-major-full',
    label: 'G major · all degrees',
    members: [1, 2, 3, 4, 5, 6, 7].map((d) => ({
      degree: d as Degree,
      key: { tonic: 'G' as const, quality: 'major' as const },
    })),
    prerequisite: 'c-major-diatonic-full',
  },
  {
    id: 'f-major-full',
    label: 'F major · all degrees',
    members: [1, 2, 3, 4, 5, 6, 7].map((d) => ({
      degree: d as Degree,
      key: { tonic: 'F' as const, quality: 'major' as const },
    })),
    prerequisite: 'g-major-full',
  },
  {
    id: 'd-major-full',
    label: 'D major · all degrees',
    members: [1, 2, 3, 4, 5, 6, 7].map((d) => ({
      degree: d as Degree,
      key: { tonic: 'D' as const, quality: 'major' as const },
    })),
    prerequisite: 'f-major-full',
  },
];

/** Lookup: group that owns a given (degree, key). */
export function groupFor(degree: Degree, key: Key): CurriculumGroup | null {
  for (const g of MVP_CURRICULUM) {
    for (const m of g.members) {
      if (m.degree === degree && m.key.tonic === key.tonic && m.key.quality === key.quality) {
        return g;
      }
    }
  }
  return null;
}
