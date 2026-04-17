import { writable } from 'svelte/store';
import { DEFAULT_SETTINGS, type Settings, type Item, type Session } from '@ear-training/core/types/domain';
import { getDeps } from './deps';

export const settings = writable<Settings>(DEFAULT_SETTINGS);
export const allItems = writable<Item[]>([]);
export const allSessions = writable<Session[]>([]);

export interface DegradationState {
  kwsUnavailable: boolean;
  persistenceFailing: boolean;
  micLost: boolean;
}
export const degradationState = writable<DegradationState>({
  kwsUnavailable: false,
  persistenceFailing: false,
  micLost: false,
});
export const consecutiveNullCount = writable(0);

export type ToastLevel = 'info' | 'warn' | 'error';
export interface Toast {
  id: string;
  message: string;
  level: ToastLevel;
  createdAt: number;
}

export const pendingToasts = writable<Toast[]>([]);

export function pushToast(input: Omit<Toast, 'id' | 'createdAt'>): string {
  const id = crypto.randomUUID();
  const toast: Toast = { id, createdAt: Date.now(), ...input };
  pendingToasts.update((ts) => [...ts, toast]);
  return id;
}

export function dismissToast(id: string): void {
  pendingToasts.update((ts) => ts.filter((t) => t.id !== id));
}

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
