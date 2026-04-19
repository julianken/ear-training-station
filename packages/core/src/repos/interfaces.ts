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
  /**
   * Optional ms-offset from UTC to local time at session creation (i.e.
   * `new Date().getTimezoneOffset() * -60_000`). Persisted on the row so
   * the day-index used by `currentStreak` is anchored in the zone the
   * user practiced in, not the viewer's current zone. See
   * `types/domain#Session.tz_offset_ms` for rationale.
   */
  tz_offset_ms?: number;
}

export interface CompleteSessionInput {
  ended_at: number;
  completed_items: number;
  pitch_pass_count: number;
  label_pass_count: number;
}

/**
 * Partial progress update written between rounds. Unlike `complete`, this
 * never sets `ended_at` — the session remains open. See issue #157: without
 * a mid-session write, a crash/reload after N rounds shows `completed_items: 0`
 * on the persisted row even though N attempts are in the attempts store.
 */
export interface AdvanceSessionInput {
  completed_items: number;
  pitch_pass_count: number;
  label_pass_count: number;
}

export interface SessionsRepo {
  start(input: StartSessionInput): Promise<Session>;
  /**
   * Persist mid-session progress without ending the session. Idempotent:
   * multiple calls overwrite the row in place (no new rows). Leaves
   * `ended_at` as-is (null for an in-flight session).
   *
   * Implementations silently no-op when the session id is unknown — matches
   * the same shape as `complete`. Callers that require strict semantics
   * should `get(id)` first.
   *
   * `completed_items` is expected to be monotonically non-decreasing in
   * normal use (the session controller only ever increments it). Regressions
   * are not rejected: the repo is a dumb writer, and a spurious decrease
   * would indicate a controller bug that should be caught there, not masked
   * here. A controller-level test guards the increment path.
   */
  advance(id: string, input: AdvanceSessionInput): Promise<void>;
  complete(id: string, input: CompleteSessionInput): Promise<void>;
  get(id: string): Promise<Session | undefined>;
  findRecent(limit: number): Promise<Session[]>;
}

export interface SettingsRepo {
  getOrDefault(): Promise<Settings>;
  update(partial: Partial<Settings>): Promise<void>;
}
