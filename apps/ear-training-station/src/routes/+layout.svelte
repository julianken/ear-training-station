<script lang="ts">
  import AppShell from '$lib/shell/AppShell.svelte';
  import '../app.css';
  import { onMount } from 'svelte';
  import { hydrateShellStores } from '$lib/shell/stores';

  let { children } = $props();

  onMount(() => {
    void hydrateShellStores();
  });
</script>

<AppShell>
  {@render children?.()}
</AppShell>
