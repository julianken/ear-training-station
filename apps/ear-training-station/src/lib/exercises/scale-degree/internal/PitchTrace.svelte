<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { PitchObservation } from '@ear-training/core/round/grade-pitch';
  import type { Degree } from '@ear-training/core/types/music';

  const MIN_CONFIDENCE = 0.5;
  const WIDTH = 480;
  const HEIGHT = 160;
  const BAND_HEIGHT_FRAC = 0.08;

  let {
    frames,
    targetDegree,
    windowStartMs,
    windowDurationMs,
    getNowMs,
  }: {
    frames: PitchObservation[];
    targetDegree: Degree;
    /** Wall-clock ms (same domain as `frames[i].at_ms` — i.e. `Date.now()`-style). */
    windowStartMs: number;
    windowDurationMs: number;
    /**
     * Returns the current time in the SAME domain as `windowStartMs` and frame
     * `at_ms` (i.e. wall-clock ms — typically `Date.now()`). If the parent is
     * sourcing from an AudioContext, it must convert: multiply seconds by 1000
     * and add the wall-clock offset captured when the context's clock was
     * anchored. Mixing AC-seconds with wall-clock ms strands the "now" cursor.
     */
    getNowMs: () => number;
  } = $props();

  let nowMs = $state(getNowMs());
  let rafId: number | null = null;

  function tick() {
    nowMs = getNowMs();
    rafId = requestAnimationFrame(tick);
  }
  onMount(() => { rafId = requestAnimationFrame(tick); });
  onDestroy(() => { if (rafId != null) cancelAnimationFrame(rafId); });

  function timeToX(at_ms: number): number {
    const t = (at_ms - windowStartMs) / windowDurationMs;
    return Math.max(0, Math.min(1, t)) * WIDTH;
  }

  function degreeToY(degree: number): number {
    const frac = (degree - 1) / 6;
    return HEIGHT - frac * HEIGHT;
  }

  // v1 visualization: plot sung pitch at the target-degree Y.
  // The target band covers ±50¢ around the target, so deviations within that
  // range visually "match". Richer rendering (actual degree from mapHzToDegree)
  // is a future iteration. For MVP, band + on-band line conveys pass/fail.
  function hzToVisualDegree(hz: number): number {
    if (hz <= 0) return targetDegree;
    return targetDegree;
  }

  const points = $derived(
    frames
      .filter((f) => f.confidence >= MIN_CONFIDENCE && f.hz > 0)
      .map((f) => `${timeToX(f.at_ms)},${degreeToY(hzToVisualDegree(f.hz))}`)
      .join(' ')
  );

  const bandY = $derived(degreeToY(targetDegree) - (HEIGHT * BAND_HEIGHT_FRAC) / 2);
  const bandH = HEIGHT * BAND_HEIGHT_FRAC;
  const nowX = $derived(timeToX(nowMs));
</script>

<svg class="pitch-trace" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width="100%" height={HEIGHT}>
  <rect class="target-band" x="0" y={bandY} width={WIDTH} height={bandH} />
  <polyline class="sung" {points} fill="none" />
  <circle class="now-indicator" cx={nowX} cy={degreeToY(targetDegree)} r="4" />
</svg>

<style>
  .pitch-trace {
    background: #06101399;
    border: 1px solid #171717;
    border-radius: 6px;
  }
  .target-band {
    fill: color-mix(in srgb, var(--cyan) 12%, transparent);
    stroke: var(--cyan);
    stroke-dasharray: 4 4;
    stroke-width: 1;
  }
  .sung {
    stroke: var(--amber);
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .now-indicator {
    fill: var(--amber);
    opacity: 0.9;
  }
</style>
