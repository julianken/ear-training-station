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

  if (session.ended_at == null && !bypassAbandon) {
    // Refresh-abandon: roll up whatever attempts exist, mark complete.
    const attempts = await deps.attempts.findBySession(session.id);
    const rollup = rollUpAbandonedSession(attempts);
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
    focus_item_id: null,
  };
}
