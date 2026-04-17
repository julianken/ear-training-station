<script lang="ts">
  import { resolve } from '$app/paths';
  import StreakChip from './StreakChip.svelte';
  let { children } = $props();
</script>

<div class="shell">
  <header class="shell-header">
    <a class="logo" href={resolve('/')}>Ear Training</a>
    <nav class="shell-nav">
      <StreakChip />
      <a class="settings-link" href={resolve('/settings')} aria-label="Settings">⚙ Settings</a>
    </nav>
  </header>
  <main class="shell-outlet">
    {@render children?.()}
  </main>
</div>

<style>
  .shell { min-height: 100vh; display: flex; flex-direction: column; }
  .shell-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px 20px; border-bottom: 1px solid var(--border);
  }
  .logo {
    font-size: 13px; font-weight: 600; letter-spacing: 0.02em;
    color: var(--text); text-decoration: none;
  }
  .shell-nav { display: flex; align-items: center; gap: 16px; }
  .settings-link { font-size: 11px; color: var(--muted); text-decoration: none; }
  .settings-link:hover { color: var(--text); }
  .shell-outlet { flex: 1; padding: 20px; }
</style>
