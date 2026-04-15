import type { DB } from './db';
import type { Attempt } from '@/types/domain';

export interface AttemptsRepo {
  append(attempt: Attempt): Promise<void>;
  findBySession(sessionId: string): Promise<Attempt[]>;
  findByItem(itemId: string): Promise<Attempt[]>;
}

export function createAttemptsRepo(db: DB): AttemptsRepo {
  return {
    async append(attempt) {
      await db.put('attempts', attempt);
    },

    async findBySession(sessionId) {
      const all = await db.getAllFromIndex('attempts', 'by-session', sessionId);
      return all.sort((a, b) => a.at - b.at);
    },

    async findByItem(itemId) {
      const all = await db.getAllFromIndex('attempts', 'by-item', itemId);
      return all.sort((a, b) => a.at - b.at);
    },
  };
}
