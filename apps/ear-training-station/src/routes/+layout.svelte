<script lang="ts">
  import AppShell from '$lib/shell/AppShell.svelte';
  import '../app.css';
  import { onMount } from 'svelte';
  import { hydrateShellStores, handleHydrationError } from '$lib/shell/stores';

  let { children } = $props();

  onMount(async () => {
    // Hydration failure (Safari private mode, Firefox strict privacy, quota
    // exceeded, etc.) must not silently render a blank, data-free app. Surface
    // via the same degradationState.persistenceFailing flag the session
    // controller uses for write failures — the DegradationBanner already
    // renders a visible message for that signal. The catch handler lives in
    // stores.ts (`handleHydrationError`) so the integration test can exercise
    // the exact code this layout runs, instead of duplicating the body. See
    // tests/shell/hydrate-error.integration.test.ts.
    hydrateShellStores().catch(handleHydrationError);
    if (import.meta.env.MODE === 'production') {
      const { registerSW } = await import('virtual:pwa-register');
      registerSW({ immediate: true });
    }
  });
</script>

<AppShell>
  {@render children?.()}
</AppShell>
