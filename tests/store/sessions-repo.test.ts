import { describe, it, expect } from 'vitest';
import { createSessionsRepo } from '@/store/sessions-repo';
import { openTestDB } from '../helpers/test-db';

describe('sessions-repo', () => {
  it('start + complete round-trip', async () => {
    const db = await openTestDB();
    const repo = createSessionsRepo(db);

    const session = await repo.start({ id: 's1', target_items: 30, started_at: 100 });
    expect(session.id).toBe('s1');
    expect(session.ended_at).toBe(null);
    expect(session.completed_items).toBe(0);

    await repo.complete('s1', {
      ended_at: 200,
      completed_items: 30,
      pitch_pass_count: 24,
      label_pass_count: 28,
      focus_item_id: '6-C-major',
    });

    const after = await repo.get('s1');
    expect(after?.ended_at).toBe(200);
    expect(after?.completed_items).toBe(30);
    expect(after?.focus_item_id).toBe('6-C-major');
  });

  it('findRecent returns sessions sorted newest first', async () => {
    const db = await openTestDB();
    const repo = createSessionsRepo(db);
    await repo.start({ id: 'a', target_items: 30, started_at: 1 });
    await repo.start({ id: 'b', target_items: 30, started_at: 3 });
    await repo.start({ id: 'c', target_items: 30, started_at: 2 });

    const recent = await repo.findRecent(10);
    expect(recent.map((s) => s.id)).toEqual(['b', 'c', 'a']);
  });
});
