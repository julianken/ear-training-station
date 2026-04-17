import type { Item, Register } from '@/types/domain';

const ADVANCED: ReadonlyArray<Item['box']> = ['reviewing', 'mastered'];

/** Minimum advanced-item counts at which each additional register unlocks. */
const UNLOCK_THRESHOLDS: ReadonlyArray<{ register: Register; minAdvanced: number }> = [
  { register: 'comfortable', minAdvanced: 0 },
  { register: 'narrow',      minAdvanced: 3 },
  { register: 'wide',        minAdvanced: 6 },
];

/**
 * The set of registers the scheduler may pick from, given current item
 * progression. Always includes 'comfortable'. 'narrow' and 'wide' unlock
 * as the learner demonstrates mastery in more items.
 */
export function availableRegisters(items: ReadonlyArray<Item>): ReadonlyArray<Register> {
  const advanced = items.filter((i) => ADVANCED.includes(i.box)).length;
  return UNLOCK_THRESHOLDS.filter((t) => advanced >= t.minAdvanced).map((t) => t.register);
}
