import type {
  ItemsRepo,
  AttemptsRepo,
  SessionsRepo,
  StartSessionInput,
  CompleteSessionInput,
} from '@/repos/interfaces';
import type { Item, Attempt, Session } from '@/types/domain';

export function createStubItemsRepo(
  initial: Item[] = [],
): ItemsRepo & { items: Map<string, Item> } {
  const items = new Map<string, Item>(initial.map((i) => [i.id, i]));
  return {
    items,
    async get(id) { return items.get(id); },
    async listAll() { return [...items.values()]; },
    async findDue(now) { return [...items.values()].filter((i) => i.due_at <= now); },
    async findByBox(box) { return [...items.values()].filter((i) => i.box === box); },
    async put(item) { items.set(item.id, item); },
    async putMany(list) { for (const item of list) items.set(item.id, item); },
  };
}

export function createStubAttemptsRepo(): AttemptsRepo & { attempts: Attempt[] } {
  const attempts: Attempt[] = [];
  return {
    attempts,
    async append(a) { attempts.push(a); },
    async findBySession(sid) { return attempts.filter((a) => a.session_id === sid); },
    async findByItem(iid) { return attempts.filter((a) => a.item_id === iid); },
  };
}

export function createStubSessionsRepo(): SessionsRepo & { sessions: Map<string, Session> } {
  const sessions = new Map<string, Session>();
  return {
    sessions,
    async start(input: StartSessionInput) {
      const s: Session = {
        id: input.id,
        started_at: input.started_at,
        ended_at: null,
        target_items: input.target_items,
        completed_items: 0,
        pitch_pass_count: 0,
        label_pass_count: 0,
        focus_item_id: null,
      };
      sessions.set(s.id, s);
      return s;
    },
    async complete(id, input: CompleteSessionInput) {
      const existing = sessions.get(id);
      if (!existing) return;
      sessions.set(id, { ...existing, ...input });
    },
    async get(id) { return sessions.get(id); },
    async findRecent(limit) {
      return [...sessions.values()]
        .sort((a, b) => b.started_at - a.started_at)
        .slice(0, limit);
    },
  };
}
