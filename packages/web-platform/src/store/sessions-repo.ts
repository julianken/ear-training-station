import type { DB } from './db';
import type { Session } from '@ear-training/core/types/domain';
import type {
  SessionsRepo as _SessionsRepo,
  StartSessionInput,
  CompleteSessionInput,
} from '@ear-training/core/repos/interfaces';

export type { SessionsRepo, StartSessionInput, CompleteSessionInput } from '@ear-training/core/repos/interfaces';

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
      };
      await db.put('sessions', session);
      return session;
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
