<script lang="ts">
  import AppShell from '$lib/shell/AppShell.svelte';
  import '../app.css';
  import { onMount } from 'svelte';
  import { hydrateShellStores, degradationState } from '$lib/shell/stores';

  let { children } = $props();

  onMount(async () => {
    // Hydration failure (Safari private mode, Firefox strict privacy, quota
    // exceeded, etc.) must not silently render a blank, data-free app. Surface
    // via the same degradationState.persistenceFailing flag the session
    // controller uses for write failures — the DegradationBanner already
    // renders a visible message for that signal.
    hydrateShellStores().catch((e) => {
      console.error('shell: hydrateShellStores failed, persistence unavailable', e);
      degradationState.update((s) => ({ ...s, persistenceFailing: true }));
    });
    if (import.meta.env.MODE === 'production') {
      const { registerSW } = await import('virtual:pwa-register');
      registerSW({ immediate: true });
    }
  });
</script>

<AppShell>
  {@render children?.()}
</AppShell>
