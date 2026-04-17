<script lang="ts">
  import type { Degree } from '@ear-training/core/types/music';

  let {
    degree,
    visible,
  }: {
    degree: Degree | null;
    visible: boolean;
  } = $props();
</script>

<div class="target-display" class:visible>
  {#if visible && degree != null}
    <span class="number">{degree}</span>
  {/if}
</div>

<style>
  .target-display {
    height: 72px;
    display: flex; align-items: center; justify-content: center;
  }
  .number {
    font-size: 56px; font-weight: 300;
    color: var(--cyan); font-variant-numeric: tabular-nums;
  }
</style>
