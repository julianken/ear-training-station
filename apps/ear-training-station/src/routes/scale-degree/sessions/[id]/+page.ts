import { error } from '@sveltejs/kit';
import { getDeps } from '$lib/shell/deps';

export const ssr = false;
export const prerender = false;

export async function load({ params }) {
  const deps = await getDeps();
  const session = await deps.sessions.get(params.id);
  if (!session) throw error(404, 'session not found');

  const attempts = await deps.attempts.findBySession(session.id);
  // Active sessions (ended_at == null) are handled by ActiveRound in +page.svelte.
  // Completed sessions are shown by the summary placeholder (Task 11).
  return { session, attempts };
}
