import type { Item } from '@/types/domain';
import { itemId } from '@/types/music';
import { MVP_CURRICULUM } from '@/scheduler/curriculum';

export interface SeedOpts {
  now: number;
}

/** Build the initial set of items presented to a fresh learner. */
export function buildInitialItems(opts: SeedOpts): Item[] {
  const first = MVP_CURRICULUM[0];
  if (!first) throw new Error('Curriculum is empty');
  return first.members.map((m) => ({
    id: itemId(m.degree, m.key),
    degree: m.degree,
    key: m.key,
    box: 'new' as const,
    accuracy: { pitch: 0, label: 0 },
    recent: [],
    attempts: 0,
    consecutive_passes: 0,
    last_seen_at: null,
    due_at: opts.now,
    created_at: opts.now,
  }));
}
