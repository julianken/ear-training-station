<script lang="ts">
  import { pendingToasts, dismissToast, type Toast } from './stores';
  import { onDestroy } from 'svelte';

  const AUTO_DISMISS_MS: Record<Toast['level'], number | null> = {
    info: 5000,
    warn: 10_000,
    error: null, // manual only
  };

  // eslint-disable-next-line svelte/prefer-svelte-reactivity
  const timers = new Map<string, number>();

  function scheduleAutoDismiss(toast: Toast): void {
    const delay = AUTO_DISMISS_MS[toast.level];
    if (delay == null) return;
    if (timers.has(toast.id)) return;
    const id = setTimeout(() => {
      dismissToast(toast.id);
      timers.delete(toast.id);
    }, delay) as unknown as number;
    timers.set(toast.id, id);
  }

  $effect(() => {
    for (const t of $pendingToasts) scheduleAutoDismiss(t);
  });

  onDestroy(() => {
    for (const id of timers.values()) clearTimeout(id);
    timers.clear();
  });
</script>

<div class="toast-region" role="status" aria-live="polite" aria-atomic="false">
  {#each $pendingToasts as toast (toast.id)}
    <div class="toast toast-{toast.level}">
      <span class="message">{toast.message}</span>
      <button
        type="button"
        class="dismiss"
        aria-label={`Dismiss: ${toast.message}`}
        onclick={() => dismissToast(toast.id)}
      >✕</button>
    </div>
  {/each}
</div>

<style>
  .toast-region {
    position: fixed; bottom: 16px; right: 16px; z-index: 1000;
    display: flex; flex-direction: column; gap: 8px;
    max-width: 360px;
  }
  .toast {
    display: flex; align-items: flex-start; gap: 8px;
    padding: 10px 12px; border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--panel);
    font-size: 11px; color: var(--text);
  }
  .toast-warn { border-color: var(--amber); }
  .toast-error { border-color: var(--red); }
  .message { flex: 1; }
  .dismiss {
    background: transparent; border: none; color: var(--muted);
    cursor: pointer; font-size: 12px; padding: 0 4px;
  }
  .dismiss:hover { color: var(--text); }
</style>
