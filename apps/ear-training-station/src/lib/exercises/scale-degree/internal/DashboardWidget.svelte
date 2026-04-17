<script lang="ts">
  import { derived } from 'svelte/store';
  import { allItems } from '$lib/shell/stores';
  import { leitnerCounts } from '@ear-training/core/analytics/rollups';

  const boxes = derived(allItems, ($items) => leitnerCounts($items));
</script>

<div class="widget">
  <div class="stat">
    <span class="value">{$boxes.mastered}</span>
    <span class="label">mastered</span>
  </div>
  <div class="stat">
    <span class="value">{$boxes.reviewing}</span>
    <span class="label">reviewing</span>
  </div>
  <div class="stat">
    <span class="value">{$boxes.learning}</span>
    <span class="label">learning</span>
  </div>
</div>

<style>
  .widget { display: flex; gap: 12px; margin-top: 12px; }
  .stat { display: flex; flex-direction: column; }
  .value { font-variant-numeric: tabular-nums; font-size: 14px; font-weight: 600; color: var(--cyan); }
  .label { font-size: 9px; color: var(--muted); text-transform: uppercase; }
</style>
