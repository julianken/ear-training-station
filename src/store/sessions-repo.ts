import type { DB } from './db';
import type { Session } from '@/types/domain';

export interface StartSessionInput {
  id: string;
  target_items: number;
  started_at: number;
}

export interface CompleteSessionInput {
  ended_at: number;
  completed_items: number;
  pitch_pass_count: number;
  label_pass_count: number;
  focus_item_id: string | null;
}

export interface SessionsRepo {
  start(input: StartSessionInput): Promise<Session>;
  complete(id: string, input: CompleteSessionInput): Promise<void>;
  get(id: string): Promise<Session | undefined>;
  findRecent(limit: number): Promise<Session[]>;
}

export function createSessionsRepo(db: DB): SessionsRepo {
  return {
    async start(input) {
      const session: Session = {
        id: input.id,
        started_at: input.started_at,
        ended_at: null,
        target_items: input.target_items,
        completed_items: 0,
        pitch_pass_count: 0,
        label_pass_count: 0,
        focus_item_id: null,
      };
      await db.put('sessions', session);
      return session;
    },

    async complete(id, input) {
      const existing = await db.get('sessions', id);
      if (!existing) return;
      const updated: Session = { ...existing, ...input };
      await db.put('sessions', updated);
    },

    async get(id) {
      return db.get('sessions', id);
    },

    async findRecent(limit) {
      const all = await db.getAllFromIndex('sessions', 'by-started-at');
      return all.reverse().slice(0, limit);
    },
  };
}
