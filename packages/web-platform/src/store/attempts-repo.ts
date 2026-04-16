import type { DB } from './db';
import type { AttemptsRepo as _AttemptsRepo } from '@ear-training/core/repos/interfaces';

export type { AttemptsRepo } from '@ear-training/core/repos/interfaces';

export function createAttemptsRepo(db: DB): _AttemptsRepo {
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
