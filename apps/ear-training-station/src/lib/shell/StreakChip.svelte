<script lang="ts">
  import { derived } from 'svelte/store';
  import { allSessions } from './stores';
  import { currentStreak } from '@ear-training/core/analytics/rollups';

  // Each session carries its own `tz_offset_ms` (stamped at session
  // creation), so day-index is anchored to the zone the user actually
  // practiced in — even if the viewer's current offset has shifted across
  // a DST boundary or timezone. `currentStreak` per-session handles that
  // internally; no render-time offset needed here. Legacy rows without
  // the field fall back to UTC.
  const streak = derived(allSessions, ($sessions) =>
    currentStreak($sessions, Date.now()),
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
