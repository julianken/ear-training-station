<script lang="ts">
  import AppShell from '$lib/shell/AppShell.svelte';
  import '../app.css';
  import { onMount } from 'svelte';
  import { hydrateShellStores } from '$lib/shell/stores';

  let { children } = $props();

  onMount(async () => {
    void hydrateShellStores();
    if (import.meta.env.MODE === 'production') {
      const { registerSW } = await import('virtual:pwa-register');
      registerSW({ immediate: true });
    }
  });
</script>

<AppShell>
  {@render children?.()}
</AppShell>
