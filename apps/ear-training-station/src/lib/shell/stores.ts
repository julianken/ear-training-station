import { writable } from 'svelte/store';
import { DEFAULT_SETTINGS, type Settings, type Item, type Session } from '@ear-training/core/types/domain';
import { getDeps } from './deps';

export const settings = writable<Settings>(DEFAULT_SETTINGS);
export const allItems = writable<Item[]>([]);
export const allSessions = writable<Session[]>([]);

export type DegradationState = 'ok' | 'kws-unavailable';
export const degradationState = writable<DegradationState>('ok');
export const consecutiveNullCount = writable(0);

export async function hydrateShellStores(): Promise<void> {
  const deps = await getDeps();
  const [s, items, sessions] = await Promise.all([
    deps.settings.getOrDefault(),
    deps.items.listAll(),
    deps.sessions.findRecent(200),
  ]);
  settings.set(s);
  allItems.set(items);
  allSessions.set(sessions);
}
