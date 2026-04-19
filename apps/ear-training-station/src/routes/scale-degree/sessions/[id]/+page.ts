import { error } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { getDeps } from '$lib/shell/deps';
import type { CompleteSessionInput } from '@ear-training/core/repos/interfaces';
import type { Attempt, Session } from '@ear-training/core/types/domain';

export const ssr = false;
export const prerender = false;

export async function load({ params, url }) {
  const deps = await getDeps();
  const session = await deps.sessions.get(params.id);
  if (!session) throw error(404, 'session not found');

  const bypassAbandon =
    url.searchParams.get('preview') === 'mic-denied' &&
    (dev || import.meta.env.MODE === 'test');

  // Refresh-abandon only fires on actual browser reloads (F5 / reload button) of an
  // ongoing session. Fresh SPA navigations from the dashboard do NOT abandon — the
  // session was just created. Detected via the Navigation Timing API.
  const isReload = typeof performance !== 'undefined'
    && (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined)?.type === 'reload';

  if (session.ended_at == null && isReload && !bypassAbandon) {
    const attempts = await deps.attempts.findBySession(session.id);
    const rollup = rollUpAbandonedSession(attempts);
    // Observability for #155: this branch ends an in-progress session with
    // `completed_items = attempts.length` and sets `ended_at`, producing the
    // same terminal UI state as (a) target_items reached or (b) scheduler
    // null-return. A QA probe that hits this path without distinguishing it
    // from (b) will misattribute the symptom to a scheduler bug (see
    // docs/research/2026-04-19-scheduler-rca-155.md). Emit a loud warning so
    // the three completion paths can be told apart from console logs alone.
    // Wrapped in try so a patched/throwing console.warn cannot break load.
    try {
      console.warn('[session-abandon-on-reload]', {
        sessionId: session.id,
        completedRounds: attempts.length,
        targetItems: session.target_items,
      });
    } catch {
      /* no-op */
    }
    await deps.sessions.complete(session.id, rollup);
    const updated: Session = { ...session, ...rollup };
    return { session: updated, attempts };
  }

  const attempts = await deps.attempts.findBySession(session.id);
  return { session, attempts };
}

function rollUpAbandonedSession(attempts: Attempt[]): CompleteSessionInput {
  return {
    ended_at: Date.now(),
    completed_items: attempts.length,
    pitch_pass_count: attempts.filter((a) => a.graded.pitch).length,
    label_pass_count: attempts.filter((a) => a.graded.label).length,
  };
}
