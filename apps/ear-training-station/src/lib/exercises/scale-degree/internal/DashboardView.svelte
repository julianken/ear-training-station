<script lang="ts">
  import { derived } from 'svelte/store';
  import { allItems } from '$lib/shell/stores';
  import { getDeps } from '$lib/shell/deps';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import {
    masteryByDegree,
    masteryByKey,
    leitnerCounts,
  } from '@ear-training/core/analytics/rollups';
  import { PITCH_CLASSES } from '@ear-training/core/types/music';
  import type { Degree } from '@ear-training/core/types/music';

  const degreeMastery = derived(allItems, ($items) => masteryByDegree($items));
  const keyMastery = derived(allItems, ($items) => masteryByKey($items));
  const boxes = derived(allItems, ($items) => leitnerCounts($items));

  async function start() {
    const deps = await getDeps();
    const id = crypto.randomUUID();
    const session = await deps.sessions.start({ id, target_items: 30, started_at: Date.now() });
    await goto(resolve(`/scale-degree/sessions/${session.id}`));
  }

  const degrees: Degree[] = [1, 2, 3, 4, 5, 6, 7];

  /** Map a 0–1 mastery value to a CSS rgba green with variable alpha. */
  function masteryColor(v: number | undefined): string {
    const m = v ?? 0;
    if (m === 0) return '#171717';
    const alpha = 0.2 + m * 0.8;
    return `rgba(34,197,94,${alpha.toFixed(2)})`;
  }
</script>

<section class="dashboard">
  <h1 class="title">Scale-Degree Practice</h1>

  <div class="start-row">
    <button type="button" class="start" onclick={start}>Start today's session</button>
  </div>

  <section class="card">
    <h2>Per-degree mastery</h2>
    <div class="bars">
      {#each degrees as d (d)}
        <div class="row">
          <span class="d-label">{d}</span>
          <div class="mastery-bar">
            <div
              class="fill"
              style="width: {Math.round(($degreeMastery.get(d) ?? 0) * 100)}%"
            ></div>
          </div>
          <span class="pct">{Math.round(($degreeMastery.get(d) ?? 0) * 100)}%</span>
        </div>
      {/each}
    </div>
  </section>

  <section class="card">
    <h2>Key heatmap</h2>
    <div class="heatmap">
      <div class="heatmap-row">
        <span class="quality-label">maj</span>
        {#each PITCH_CLASSES as pc (`${pc}-major`)}
          {@const cid = `${pc}-major`}
          <div
            class="heat-cell"
            title="{pc} major: {Math.round(($keyMastery.get(cid) ?? 0) * 100)}%"
            style="background: {masteryColor($keyMastery.get(cid))}"
          ></div>
        {/each}
      </div>
      <div class="heatmap-row">
        <span class="quality-label">min</span>
        {#each PITCH_CLASSES as pc (`${pc}-minor`)}
          {@const cid = `${pc}-minor`}
          <div
            class="heat-cell"
            title="{pc} minor: {Math.round(($keyMastery.get(cid) ?? 0) * 100)}%"
            style="background: {masteryColor($keyMastery.get(cid))}"
          ></div>
        {/each}
      </div>
      <div class="heatmap-labels">
        <span class="quality-label"></span>
        {#each PITCH_CLASSES as pc (pc)}
          <span class="key-label">{pc}</span>
        {/each}
      </div>
    </div>
  </section>

  <section class="card">
    <h2>Leitner pipeline</h2>
    <div class="leitner">
      {#each ['new', 'learning', 'reviewing', 'mastered'] as box (box)}
        <div class="box box-{box}">
          <div class="count">{$boxes[box as keyof typeof $boxes] ?? 0}</div>
          <div class="box-label">{box}</div>
        </div>
      {/each}
    </div>
  </section>
</section>

<style>
  .dashboard { max-width: 640px; margin: 0 auto; }
  .title { font-size: 16px; font-weight: 600; margin: 0 0 16px; }
  .start-row { margin: 0 0 20px; }
  .start {
    width: 100%; padding: 14px; font-size: 14px;
    border-radius: 6px; border: 1px solid var(--cyan);
    background: transparent; color: var(--cyan);
    cursor: pointer;
  }
  .start:hover { background: rgba(34,211,238,0.08); }
  .card {
    background: var(--panel); border: 1px solid var(--border);
    border-radius: 8px; padding: 12px; margin: 0 0 12px;
  }
  .card h2 {
    font-size: 11px; color: var(--muted); text-transform: uppercase;
    margin: 0 0 12px; letter-spacing: 0.04em;
  }
  /* Mastery bars */
  .bars { display: flex; flex-direction: column; gap: 6px; }
  .row { display: flex; align-items: center; gap: 8px; font-size: 10px; }
  .d-label { width: 16px; font-variant-numeric: tabular-nums; color: var(--muted); }
  .pct { width: 36px; text-align: right; font-variant-numeric: tabular-nums; color: var(--text); }
  .mastery-bar { flex: 1; height: 8px; background: #171717; border-radius: 4px; overflow: hidden; }
  .fill { height: 100%; background: var(--green); transition: width 200ms ease; }
  /* Key heatmap */
  .heatmap { display: flex; flex-direction: column; gap: 3px; }
  .heatmap-row { display: flex; align-items: center; gap: 3px; }
  .heatmap-labels { display: flex; align-items: center; gap: 3px; }
  .quality-label { width: 24px; font-size: 8px; color: var(--muted); text-transform: uppercase; flex-shrink: 0; }
  .heat-cell {
    width: 18px; height: 14px; border-radius: 2px;
    border: 1px solid rgba(255,255,255,0.05);
    transition: background 200ms ease;
    flex-shrink: 0;
  }
  .key-label { width: 18px; font-size: 7px; color: var(--muted); text-align: center; flex-shrink: 0; overflow: hidden; }
  /* Leitner pipeline */
  .leitner { display: flex; gap: 6px; }
  .box {
    flex: 1; background: #171717; border: 1px solid var(--border); border-radius: 6px;
    padding: 8px 6px; text-align: center;
  }
  .box-new .count { color: var(--muted); }
  .box-learning .count { color: var(--amber); }
  .box-reviewing .count { color: var(--cyan); }
  .box-mastered .count { color: var(--green); }
  .count { font-size: 18px; font-weight: 600; font-variant-numeric: tabular-nums; }
  .box-label { font-size: 8px; color: var(--muted); text-transform: uppercase; }
</style>
