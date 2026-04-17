<script lang="ts">
  import type { ChordEvent } from '@ear-training/core/audio/cadence-structure';
  import { onMount, onDestroy } from 'svelte';

  let {
    cadence,
    cadenceStartAcTime,
    getCurrentTime,
  }: {
    cadence: ChordEvent[];
    cadenceStartAcTime: number;
    getCurrentTime: () => number;
  } = $props();

  let now = $state(getCurrentTime());
  let rafId: number | null = null;

  function tick() {
    now = getCurrentTime();
    rafId = requestAnimationFrame(tick);
  }

  onMount(() => {
    rafId = requestAnimationFrame(tick);
  });

  onDestroy(() => {
    if (rafId != null) cancelAnimationFrame(rafId);
  });

  function isActive(chord: ChordEvent, now: number): boolean {
    const start = cadenceStartAcTime + chord.startSec;
    const end = start + chord.durationSec;
    return now >= start && now < end;
  }

  function isPlayed(chord: ChordEvent, now: number): boolean {
    return now >= cadenceStartAcTime + chord.startSec + chord.durationSec;
  }
</script>

<ul class="chord-blocks">
  {#each cadence as chord, i (i)}
    <li
      class:active={isActive(chord, now)}
      class:played={!isActive(chord, now) && isPlayed(chord, now)}
      role="listitem"
    >
      <span class="label">{chord.romanNumeral}</span>
    </li>
  {/each}
</ul>

<style>
  .chord-blocks { display: flex; gap: 8px; padding: 0; margin: 0; list-style: none; }
  li {
    flex: 1; height: 36px;
    background: var(--panel); border: 1px solid var(--border); border-radius: 6px;
    display: flex; align-items: center; justify-content: center;
    transition: all 120ms ease;
  }
  .label { font-family: 'Times New Roman', serif; font-style: italic; color: var(--muted); font-size: 14px; }
  .active { background: #0c2430; border-color: var(--cyan); }
  .active .label { color: var(--cyan); }
  .played { background: #0a1a20; }
  .played .label { color: #335060; }
</style>
