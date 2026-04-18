<script lang="ts">
  import { derived } from 'svelte/store';
  import { allSessions } from './stores';
  import { currentStreak } from '@ear-training/core/analytics/rollups';

  // Pass the viewer's current offset as the "today" anchor so the streak
  // window is computed in local wall-clock time. Per-session tz_offset_ms
  // (stamped at creation) is used by currentStreak() for placing each
  // session on the correct calendar day — the two are independent.
  const tzOffsetMs = -new Date().getTimezoneOffset() * 60_000;
  const streak = derived(allSessions, ($sessions) =>
    currentStreak($sessions, Date.now(), tzOffsetMs),
  );
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
