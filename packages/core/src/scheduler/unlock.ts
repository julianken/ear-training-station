import type { Item, LeitnerBox } from '@/types/domain';
import { itemId } from '@/types/music';
import {
  MVP_CURRICULUM,
  UNLOCK_THRESHOLD,
  type CurriculumGroup,
} from './curriculum';

const ADVANCED_BOXES: ReadonlyArray<LeitnerBox> = ['reviewing', 'mastered'];

/**
 * Compute the set of group ids currently unlocked based on item mastery.
 * A group unlocks if either:
 *   - it has no prerequisite, OR
 *   - its prerequisite group has >= UNLOCK_THRESHOLD ratio of members
 *     in box "reviewing" or "mastered".
 *
 * Groups not yet in the DB count as box="new" (0 toward the ratio).
 */
export function computeUnlockedGroupIds(
  items: ReadonlyArray<Item>,
  curriculum: ReadonlyArray<CurriculumGroup> = MVP_CURRICULUM,
): ReadonlySet<string> {
  const byId = new Map<string, Item>();
  for (const it of items) byId.set(it.id, it);

  const masteryRatio = (group: CurriculumGroup): number => {
    if (group.members.length === 0) return 0;
    let advanced = 0;
    for (const m of group.members) {
      const it = byId.get(itemId(m.degree, m.key));
      if (it && ADVANCED_BOXES.includes(it.box)) advanced++;
    }
    return advanced / group.members.length;
  };

  const unlocked = new Set<string>();
  for (const group of curriculum) {
    if (group.prerequisite === null) {
      unlocked.add(group.id);
      continue;
    }
    if (!unlocked.has(group.prerequisite)) continue;
    const prereq = curriculum.find((g) => g.id === group.prerequisite);
    if (!prereq) continue;
    if (masteryRatio(prereq) >= UNLOCK_THRESHOLD) {
      unlocked.add(group.id);
    }
  }
  return unlocked;
}

/** The set of (degree, key) pairs currently available to the learner. */
export function unlockedMembers(
  items: ReadonlyArray<Item>,
  curriculum: ReadonlyArray<CurriculumGroup> = MVP_CURRICULUM,
): ReadonlyArray<CurriculumGroup['members'][number]> {
  const unlocked = computeUnlockedGroupIds(items, curriculum);
  const out: CurriculumGroup['members'][number][] = [];
  for (const g of curriculum) {
    if (unlocked.has(g.id)) out.push(...g.members);
  }
  return out;
}
