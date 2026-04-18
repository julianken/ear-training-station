<script lang="ts">
  import type { SessionController } from './session-controller.svelte';
  import ChordBlocks from './ChordBlocks.svelte';
  import TargetDisplay from './TargetDisplay.svelte';
  import PitchTrace from './PitchTrace.svelte';
  import { buildCadence } from '@ear-training/core/audio/cadence-structure';
  import type { ChordEvent } from '@ear-training/core/audio/cadence-structure';
  import { degradationState } from '$lib/shell/stores';

  let { controller }: { controller: SessionController } = $props();

  // Local error state for startRound() failures. Cleared on the next attempt so
  // the user can retry by clicking the button again without a separate reset UI.
  // See GitHub #106 / Plan C2 Task 3 — previously startRound() rejections were
  // silently swallowed by the Svelte event handler, stranding the user on an
  // idle-looking UI with no feedback.
  let startError = $state<string | null>(null);

  const cadence = $derived<ChordEvent[]>(
    controller.currentItem ? buildCadence(controller.currentItem.key) : [],
  );

  // cadenceStartAcTime and getCurrentTime are stub values (AudioContext time = 0).
  // Task 6 wires real values from the playRound handle once audio is integrated.
  const cadenceStartAcTime = 0;
  const getCurrentTime = () => 0;

  // windowStartMs is the wall-clock timestamp (Date.now()-domain) of when the
  // capture window started — i.e. when the controller dispatched PLAYBACK_DONE
  // and transitioned into `listening`. We capture this on the reactive state
  // transition rather than passing a stub (0 = Unix epoch) because pitch frames
  // carry `at_ms = Date.now()`, so windowStartMs MUST be in the same domain or
  // PitchTrace's (at_ms - windowStartMs) math produces billions and every frame
  // clamps to the right edge (1.75T / 5000 * 480 ≈ billions). See GitHub #120 /
  // Plan C2 Task 7.
  //
  // We keep the captured value stable across the listening → graded transition
  // so the trace keeps showing the just-captured frames against the same time
  // origin during the feedback panel. A new `listening` window recaptures.
  let windowStartMs = $state(0);
  const getNowMs = () => Date.now();

  // Non-reactive transition tracker. Reading `controller.state.kind` inside
  // $effect registers the dependency; `prevKind` is a plain module-local so
  // writing it doesn't re-trigger the effect. We want to capture the anchor
  // ONLY on the transition INTO `listening` — not on every PITCH_FRAME that
  // arrives while already listening, which would continually reset the x-axis
  // origin to "now" and leave the trace perpetually empty.
  let prevKind: string | null = null;
  $effect(() => {
    const kind = controller.state.kind;
    if (kind === 'listening' && prevKind !== 'listening') {
      windowStartMs = Date.now();
    }
    prevKind = kind;
  });

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

  /**
   * True iff the rejection came from `getUserMedia` / mic-unavailable paths.
   * Distinguishing this lets us both show the user the actionable mic message
   * AND flip `degradationState.micPermissionDenied` so the persistent
   * DegradationBanner mirrors the condition across navigations.
   *
   * NB: We flip `micPermissionDenied`, NOT `micLost`. The mic was never
   * connected in the first place — "reconnect to continue" copy would be
   * confusing. `micLost` is reserved for a future runtime-disconnect path
   * where the mic was working and then dropped.
   *
   * DOMException names from `navigator.mediaDevices.getUserMedia`:
   * - `NotAllowedError` — user or policy denied permission
   * - `PermissionDeniedError` — legacy alias seen in older Chromium
   * - `NotFoundError` — no input device detected
   * - `NotReadableError` — hardware in use by another app / locked
   *
   * `code: 'unavailable'` is the marker attached by
   * `requestMicStream()` when the Microphone API is absent entirely
   * (older Safari, insecure context, etc.).
   */
  function isMicError(err: unknown): boolean {
    const name = err instanceof Error ? err.name : '';
    const code = (err as { code?: string } | null)?.code;
    return (
      name === 'NotAllowedError' ||
      name === 'PermissionDeniedError' ||
      name === 'NotFoundError' ||
      name === 'NotReadableError' ||
      code === 'unavailable'
    );
  }

  /**
   * Classify a `startRound()` rejection into user-visible copy. Mic failures
   * get a specific, actionable message; other failures (AudioContext creation,
   * worklet load, IDB read) fall through to a generic message — we don't want
   * to invent specific guidance the user can't act on.
   */
  function describeStartError(err: unknown): string {
    if (isMicError(err)) {
      return 'Microphone access is required to practice. Enable mic access in your browser settings and try again.';
    }
    return 'Could not start the round. Please try again.';
  }

  async function start() {
    // Clear any prior error so a retry shows a fresh attempt.
    startError = null;
    try {
      await controller.startRound();
      // Clear any stale mic-permission flag from a prior failed attempt. Without
      // this, a user who denies mic access, grants it in browser settings, and
      // then successfully starts a round would still see the "Microphone access
      // blocked" banner for the rest of the session (until page reload). The
      // update is conditional so we don't churn subscribers when the flag is
      // already false (the common path).
      degradationState.update((s) =>
        s.micPermissionDenied ? { ...s, micPermissionDenied: false } : s,
      );
    } catch (err) {
      startError = describeStartError(err);
      if (isMicError(err)) {
        degradationState.update((s) => ({ ...s, micPermissionDenied: true }));
      }
      // Diagnostics: preserves the original error shape for debugging without
      // exposing internals to the user.
      console.error('ActiveRound: startRound() failed', err);
    }
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
  {#if startError}
    <p class="start-error" role="alert" aria-live="polite">{startError}</p>
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
  .start-error {
    text-align: center;
    font-size: 11px;
    color: var(--red);
    margin: 12px auto 0;
    max-width: 400px;
  }
</style>
