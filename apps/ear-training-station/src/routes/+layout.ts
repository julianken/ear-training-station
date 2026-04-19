import { redirect } from '@sveltejs/kit';
import { getDeps } from '$lib/shell/deps';
import { handleHydrationError } from '$lib/shell/stores';
import { DEFAULT_SETTINGS, type Settings } from '@ear-training/core/types/domain';

export const prerender = false;
export const ssr = false;

export async function load({ url }: { url: URL }) {
  // In Safari private mode (and historical Firefox strict privacy) the very
  // first `indexedDB.open` call inside `getDeps()` throws synchronously with a
  // SecurityError. Without a try/catch here the rejection propagates past
  // SvelteKit's client-side router and the page goes completely blank — no
  // error boundary, no DegradationBanner, no `handleHydrationError` path.
  //
  // Catch IDB failures here, flip `degradationState.persistenceFailing` via
  // the shared `handleHydrationError`, and return DEFAULT_SETTINGS so the
  // shell still renders in memory-only mode. The same store flag that covers
  // write failures mid-session (Case B in the idb-failure e2e) now also
  // covers open failures at boot (Case A). See GitHub #119.
  let settings: Settings;
  try {
    const { settings: repo } = await getDeps();
    settings = await repo.getOrDefault();
  } catch (err) {
    handleHydrationError(err);
    settings = { ...DEFAULT_SETTINGS };
  }

  if (!settings.onboarded && !url.pathname.startsWith('/onboarding')) {
    throw redirect(302, '/onboarding');
  }
  return { settings };
}
