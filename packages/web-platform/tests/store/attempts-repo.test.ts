import { describe, it, expect } from 'vitest';
import { createAttemptsRepo } from '@/store/attempts-repo';
import { openTestDB } from '../helpers/test-db';
import type { Attempt } from '@ear-training/core/types/domain';

function mkAttempt(overrides: Partial<Attempt> = {}): Attempt {
  return {
    id: 'att-1',
    item_id: '5-C-major',
    session_id: 'sess-1',
    at: 1,
    target: { hz: 392, degree: 5 },
    sung: { hz: 395, cents_off: +13, confidence: 0.9 },
    spoken: { digit: 5, confidence: 0.95 },
    graded: { pitch: true, label: true, pass: true, at: 1 },
    timbre: 'piano',
    register: 'comfortable',
    ...overrides,
  };
}

describe('attempts-repo', () => {
  it('append + findBySession returns attempts in order of `at`', async () => {
    const db = await openTestDB();
    const repo = createAttemptsRepo(db);
    await repo.append(mkAttempt({ id: 'b', at: 2 }));
    await repo.append(mkAttempt({ id: 'a', at: 1 }));
    await repo.append(mkAttempt({ id: 'c', at: 3 }));
    const fetched = await repo.findBySession('sess-1');
    expect(fetched.map((a) => a.id)).toEqual(['a', 'b', 'c']);
  });

  it('findByItem filters by item', async () => {
    const db = await openTestDB();
    const repo = createAttemptsRepo(db);
    await repo.append(mkAttempt({ id: 'a', item_id: 'x' }));
    await repo.append(mkAttempt({ id: 'b', item_id: 'y' }));
    const fetched = await repo.findByItem('x');
    expect(fetched.map((a) => a.id)).toEqual(['a']);
  });

  it('scoped findBySession does not return other sessions', async () => {
    const db = await openTestDB();
    const repo = createAttemptsRepo(db);
    await repo.append(mkAttempt({ id: 'a', session_id: 's1' }));
    await repo.append(mkAttempt({ id: 'b', session_id: 's2' }));
    const fetched = await repo.findBySession('s1');
    expect(fetched.map((a) => a.id)).toEqual(['a']);
  });
});
