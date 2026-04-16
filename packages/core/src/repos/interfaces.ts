import type { Item, Attempt, Session, Settings } from '@/types/domain';

export interface ItemsRepo {
  get(id: string): Promise<Item | undefined>;
  listAll(): Promise<Item[]>;
  findDue(now: number): Promise<Item[]>;
  findByBox(box: Item['box']): Promise<Item[]>;
  put(item: Item): Promise<void>;
  putMany(items: ReadonlyArray<Item>): Promise<void>;
}

export interface AttemptsRepo {
  append(attempt: Attempt): Promise<void>;
  findBySession(sessionId: string): Promise<Attempt[]>;
  findByItem(itemId: string): Promise<Attempt[]>;
}

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

export interface SettingsRepo {
  getOrDefault(): Promise<Settings>;
  update(partial: Partial<Settings>): Promise<void>;
}
