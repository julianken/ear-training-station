import { redirect } from '@sveltejs/kit';
import { getDeps } from '$lib/shell/deps';

export const prerender = false;
export const ssr = false;

export async function load({ url }: { url: URL }) {
  const { settings: repo } = await getDeps();
  const settings = await repo.getOrDefault();
  if (!settings.onboarded && !url.pathname.startsWith('/onboarding')) {
    throw redirect(302, '/onboarding');
  }
  return { settings };
}
