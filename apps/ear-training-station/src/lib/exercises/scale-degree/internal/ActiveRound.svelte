<script lang="ts">
  import type { SessionController } from './session-controller.svelte';
  import ChordBlocks from './ChordBlocks.svelte';
  import TargetDisplay from './TargetDisplay.svelte';
  import PitchTrace from './PitchTrace.svelte';
  import { buildCadence } from '@ear-training/core/audio/cadence-structure';
  import type { ChordEvent } from '@ear-training/core/audio/cadence-structure';

  let { controller }: { controller: SessionController } = $props();

  const cadence = $derived<ChordEvent[]>(
    controller.currentItem ? buildCadence(controller.currentItem.key) : [],
  );

  // cadenceStartAcTime and getCurrentTime are stub values (AudioContext time = 0).
  // Task 6 wires real values from the playRound handle once audio is integrated.
  const cadenceStartAcTime = 0;
  const getCurrentTime = () => 0;

  // windowStartMs and getNowMs are stubs — Task 6 wires real wall-clock offsets.
  const windowStartMs = 0;
  const getNowMs = () => 0;

  const targetVisible = $derived(
    controller.state.kind === 'playing_target' || controller.state.kind === 'listening',
  );

  const targetDegree = $derived(
    targetVisible ? (controller.currentItem?.degree ?? null) : null,
  );

  const showTrace = $derived(
    controller.state.kind === 'playing_target' ||
    controller.state.kind === 'listening' ||
    controller.state.kind === 'graded',
  );

  // Collect pitch frames from states that carry them.
  const pitchFrames = $derived(
    'frames' in controller.state ? controller.state.frames : [],
  );

  const traceDegree = $derived(controller.currentItem?.degree ?? 1);

  async function start() {
    await controller.startRound();
  }
</script>

<section class="active-round">
  <div class="top-zone" class:listening={controller.state.kind === 'playing_cadence'}>
    <ChordBlocks
      cadence={cadence}
      cadenceStartAcTime={cadenceStartAcTime}
      getCurrentTime={getCurrentTime}
    />
    <TargetDisplay
      degree={targetDegree}
      visible={targetVisible}
    />
  </div>

  <div class="bottom-zone" class:capturing={controller.state.kind === 'listening'}>
    {#if showTrace}
      <PitchTrace
        frames={pitchFrames}
        targetDegree={traceDegree}
        windowStartMs={windowStartMs}
        windowDurationMs={5000}
        getNowMs={getNowMs}
      />
    {/if}
  </div>

  {#if controller.state.kind === 'idle'}
    <div class="actions">
      <button type="button" class="start" onclick={start}>Start round</button>
    </div>
  {/if}
</section>

<style>
  .active-round { max-width: 520px; margin: 0 auto; }
  .top-zone, .bottom-zone {
    padding: 16px;
    border: 1px solid var(--border);
    border-radius: 8px;
    margin-bottom: 12px;
  }
  .listening { border-color: var(--cyan); }
  .capturing { border-color: var(--amber); }
  .actions { display: flex; justify-content: center; margin-top: 16px; }
  .start {
    padding: 10px 20px; border-radius: 6px;
    border: 1px solid var(--cyan); background: transparent;
    color: var(--cyan); font-size: 12px;
    cursor: pointer;
  }
</style>
