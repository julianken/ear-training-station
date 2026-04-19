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
    });

    const after = await repo.get('s1');
    expect(after?.ended_at).toBe(200);
    expect(after?.completed_items).toBe(30);
    expect(after?.pitch_pass_count).toBe(24);
  });

  describe('advance (mid-session progress)', () => {
    it('updates counters in place and leaves ended_at null', async () => {
      const db = await openTestDB();
      const repo = createSessionsRepo(db);

      await repo.start({ id: 's1', target_items: 15, started_at: 100 });

      await repo.advance('s1', {
        completed_items: 3,
        pitch_pass_count: 2,
        label_pass_count: 3,
      });

      const after = await repo.get('s1');
      expect(after?.completed_items).toBe(3);
      expect(after?.pitch_pass_count).toBe(2);
      expect(after?.label_pass_count).toBe(3);
      expect(after?.ended_at).toBeNull();
      expect(after?.started_at).toBe(100); // unchanged
      expect(after?.target_items).toBe(15); // unchanged
    });

    it('multiple advance() calls overwrite the same row (no new rows)', async () => {
      const db = await openTestDB();
      const repo = createSessionsRepo(db);

      await repo.start({ id: 's1', target_items: 15, started_at: 100 });
      await repo.advance('s1', { completed_items: 1, pitch_pass_count: 1, label_pass_count: 1 });
      await repo.advance('s1', { completed_items: 2, pitch_pass_count: 1, label_pass_count: 2 });
      await repo.advance('s1', { completed_items: 3, pitch_pass_count: 2, label_pass_count: 3 });

      const all = await repo.findRecent(10);
      expect(all).toHaveLength(1);
      expect(all[0]?.completed_items).toBe(3);
      expect(all[0]?.pitch_pass_count).toBe(2);
      expect(all[0]?.label_pass_count).toBe(3);
      expect(all[0]?.ended_at).toBeNull();
    });

    it('advance() then complete() produces both updated counters and ended_at', async () => {
      const db = await openTestDB();
      const repo = createSessionsRepo(db);

      await repo.start({ id: 's1', target_items: 15, started_at: 100 });
      await repo.advance('s1', { completed_items: 14, pitch_pass_count: 10, label_pass_count: 12 });
      await repo.complete('s1', {
        ended_at: 500,
        completed_items: 15,
        pitch_pass_count: 11,
        label_pass_count: 13,
      });

      const after = await repo.get('s1');
      expect(after?.ended_at).toBe(500);
      expect(after?.completed_items).toBe(15);
      expect(after?.pitch_pass_count).toBe(11);
      expect(after?.label_pass_count).toBe(13);
    });

    it('is a silent no-op on unknown id (matches complete() shape)', async () => {
      // The repo is a dumb writer. If a caller advances an id that was never
      // started, that indicates a controller bug upstream; silently ignoring
      // keeps the surface consistent with `complete()`, which does the same.
      const db = await openTestDB();
      const repo = createSessionsRepo(db);

      await expect(
        repo.advance('nonexistent', { completed_items: 1, pitch_pass_count: 0, label_pass_count: 1 }),
      ).resolves.toBeUndefined();
      expect(await repo.get('nonexistent')).toBeUndefined();
    });

    it('preserves tz_offset_ms across advance()', async () => {
      const db = await openTestDB();
      const repo = createSessionsRepo(db);

      await repo.start({ id: 's1', target_items: 15, started_at: 100, tz_offset_ms: -14_400_000 });
      await repo.advance('s1', { completed_items: 5, pitch_pass_count: 3, label_pass_count: 4 });

      const after = await repo.get('s1');
      expect(after?.tz_offset_ms).toBe(-14_400_000);
    });
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
