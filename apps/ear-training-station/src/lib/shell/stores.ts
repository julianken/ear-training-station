import { writable } from 'svelte/store';
import { DEFAULT_SETTINGS, type Settings, type Item, type Session } from '@ear-training/core/types/domain';
import { getDeps } from './deps';

export const settings = writable<Settings>(DEFAULT_SETTINGS);
export const allItems = writable<Item[]>([]);
export const allSessions = writable<Session[]>([]);

export interface DegradationState {
  kwsUnavailable: boolean;
  persistenceFailing: boolean;
  /**
   * `micPermissionDenied` — user never granted mic access (or the API is
   * unavailable entirely). Distinct from `micLost`: the device was never
   * connected, so "reconnect" copy would be misleading. Set by the startRound
   * catch in `ActiveRound.svelte` when the rejection matches a permission or
   * API-availability error.
   *
   * `micLost` — the mic was working and then dropped mid-session (runtime
   * disconnect). Reserved for a future runtime-disconnect path; not currently
   * set by any production code.
   *
   * Splitting these flags lets `DegradationBanner` render copy appropriate to
   * each scenario instead of a single ambiguous "reconnect" message. See
   * GitHub #106 follow-up / Plan C2 Task 3 code review.
   */
  micPermissionDenied: boolean;
  micLost: boolean;
}
export const degradationState = writable<DegradationState>({
  kwsUnavailable: false,
  persistenceFailing: false,
  micPermissionDenied: false,
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

/**
 * Shared catch handler for `hydrateShellStores()` rejection.
 *
 * Used by `+layout.svelte` on hydration failure (Safari private mode,
 * Firefox strict privacy, quota exceeded, etc.). Extracted so tests can
 * exercise the exact code the layout runs, instead of copying the body —
 * see `tests/shell/hydrate-error.integration.test.ts` and GitHub #105.
 *
 * Logs to console.error and flips `degradationState.persistenceFailing`
 * so `DegradationBanner` renders the "Saving locally failed" message.
 */
export function handleHydrationError(err: unknown): void {
  console.error('shell: hydrateShellStores failed, persistence unavailable', err);
  degradationState.update((s) => ({ ...s, persistenceFailing: true }));
}
