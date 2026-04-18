import type { Page } from '@playwright/test';
import { seedIndexedDb } from '@ear-training/e2e-audio-testing/seed-idb';
import type { Session, Item } from '@ear-training/core/types/domain';
import type { Degree, Key } from '@ear-training/core/types/music';

export interface ActiveSessionSeed {
  id?: string;
  target_items?: number;
  focus_item_id?: string | null;
  started_at?: number;
}

/**
 * Seed an active (ended_at === null) session into the sessions store.
 *
 * ORDERING CONTRACT: Call after `seedOnboarded(page)` from `app-state.ts` so the
 * schema (object stores + indexes) already exists. This helper does NOT create
 * object stores — it only puts records.
 *
 * Defaults: id = 'test-session', started_at = Date.now(), target_items = 30,
 * focus_item_id = null, completed_items = 0, pitch_pass_count = 0, label_pass_count = 0.
 */
export async function seedActiveSession(page: Page, opts: ActiveSessionSeed = {}): Promise<void> {
  const session: Session = {
    id: opts.id ?? 'test-session',
    started_at: opts.started_at ?? Date.now(),
    ended_at: null,
    target_items: opts.target_items ?? 30,
    completed_items: 0,
    pitch_pass_count: 0,
    label_pass_count: 0,
    focus_item_id: opts.focus_item_id ?? null,
  };
  await seedIndexedDb(page, {
    dbName: 'ear-training',
    version: 1,
    records: { sessions: [session] },
  });
}

export interface DueItemSeed {
  id?: string;
  degree?: Degree;
  key?: Key;
  box?: Item['box'];
  due_at?: number;
}

/**
 * Seed a due item (due_at <= now) so the session route can construct a controller
 * (it calls `deps.items.findDue(Date.now())` and needs at least one result).
 *
 * ORDERING CONTRACT: Call after `seedOnboarded(page)` from `app-state.ts` so the
 * schema (object stores + indexes) already exists. This helper does NOT create
 * object stores — it only puts records.
 *
 * Defaults produce a valid '5-C-major' item due 1 second ago, in the 'new' box.
 */
export async function seedDueItem(page: Page, opts: DueItemSeed = {}): Promise<void> {
  const degree: Degree = opts.degree ?? 5;
  const key: Key = opts.key ?? { tonic: 'C', quality: 'major' };
  const id = opts.id ?? `${degree}-${key.tonic}-${key.quality}`;
  const now = Date.now();

  const item: Item = {
    id,
    degree,
    key,
    box: opts.box ?? 'new',
    accuracy: { pitch: 0, label: 0 },
    recent: [],
    attempts: 0,
    consecutive_passes: 0,
    last_seen_at: null,
    due_at: opts.due_at ?? now - 1000,
    created_at: now - 60_000,
  };
  await seedIndexedDb(page, {
    dbName: 'ear-training',
    version: 1,
    records: { items: [item] },
  });
}
