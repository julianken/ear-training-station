<script lang="ts">
  import { derived } from 'svelte/store';
  import { allSessions } from './stores';
  import { currentStreak } from '@ear-training/core/analytics/rollups';

  const streak = derived(allSessions, ($sessions) => {
    const tzOffsetMs = -new Date().getTimezoneOffset() * 60_000;
    return currentStreak($sessions, Date.now(), tzOffsetMs);
  });
</script>

<span class="streak-chip" aria-label="Current streak">
  <span class="icon" aria-hidden="true">◆</span>
  <span class="count">{$streak}</span>
  <span class="label">day streak</span>
</span>

<style>
  .streak-chip {
    display: inline-flex; align-items: center; gap: 4px;
    font-size: 10px; color: var(--amber);
  }
  .count { font-variant-numeric: tabular-nums; font-weight: 600; }
  .label { color: var(--muted); }
</style>
