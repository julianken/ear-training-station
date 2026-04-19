import type { DB } from './db';
import type { Session } from '@ear-training/core/types/domain';
import type {
  SessionsRepo as _SessionsRepo,
  StartSessionInput,
  CompleteSessionInput,
  AdvanceSessionInput,
} from '@ear-training/core/repos/interfaces';

export type {
  SessionsRepo,
  StartSessionInput,
  CompleteSessionInput,
  AdvanceSessionInput,
} from '@ear-training/core/repos/interfaces';

export function createSessionsRepo(db: DB): _SessionsRepo {
  return {
    async start(input: StartSessionInput) {
      const session: Session = {
        id: input.id,
        started_at: input.started_at,
        ended_at: null,
        target_items: input.target_items,
        completed_items: 0,
        pitch_pass_count: 0,
        label_pass_count: 0,
        ...(input.tz_offset_ms !== undefined ? { tz_offset_ms: input.tz_offset_ms } : {}),
      };
      await db.put('sessions', session);
      return session;
    },

    async advance(id: string, input: AdvanceSessionInput) {
      // Read-then-write to preserve untouched fields (started_at, ended_at,
      // target_items, tz_offset_ms). Mirrors complete()'s shape, but never
      // sets ended_at — the session stays open.
      //
      // Silent no-op on unknown id matches complete()'s behavior; see
      // AdvanceSessionInput doc in packages/core/src/repos/interfaces.ts.
      const existing = await db.get('sessions', id);
      if (!existing) return;
      const updated: Session = { ...existing, ...input };
      await db.put('sessions', updated);
    },

    async complete(id: string, input: CompleteSessionInput) {
      const existing = await db.get('sessions', id);
      if (!existing) return;
      const updated: Session = { ...existing, ...input };
      await db.put('sessions', updated);
    },

    async get(id: string) {
      return db.get('sessions', id);
    },

    async findRecent(limit: number) {
      const all = await db.getAllFromIndex('sessions', 'by-started-at');
      return all.reverse().slice(0, limit);
    },
  };
}
