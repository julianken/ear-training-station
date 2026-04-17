<script lang="ts">
  import { onDestroy } from 'svelte';

  type Mode = 'you' | 'target' | 'both';

  let {
    userBuffer,
    targetBuffer,
  }: {
    userBuffer: AudioBuffer | null;
    targetBuffer: AudioBuffer | null;
  } = $props();

  let mode = $state<Mode>('target');
  let playing = $state(false);
  let ctx: AudioContext | null = null;
  let sources: AudioBufferSourceNode[] = [];

  function ensureCtx(): AudioContext {
    if (!ctx) ctx = new AudioContext();
    return ctx;
  }

  function playBuffer(buf: AudioBuffer, destCtx: AudioContext): AudioBufferSourceNode {
    const src = destCtx.createBufferSource();
    src.buffer = buf;
    src.connect(destCtx.destination);
    src.start();
    return src;
  }

  function play() {
    if (playing) return;
    const c = ensureCtx();
    sources = [];
    if (mode === 'you' && userBuffer) sources.push(playBuffer(userBuffer, c));
    if (mode === 'target' && targetBuffer) sources.push(playBuffer(targetBuffer, c));
    if (mode === 'both') {
      if (userBuffer) sources.push(playBuffer(userBuffer, c));
      if (targetBuffer) sources.push(playBuffer(targetBuffer, c));
    }
    playing = true;
    const longest = Math.max(
      ...sources.map((s) => (s.buffer?.duration ?? 0)),
    );
    setTimeout(() => {
      playing = false;
      sources = [];
    }, longest * 1000 + 50);
  }

  function stop() {
    sources.forEach((s) => { try { s.stop(); } catch { /* already stopped */ } });
    sources = [];
    playing = false;
  }

  onDestroy(() => {
    stop();
    void ctx?.close();
  });
</script>

<div class="replay-bar">
  <div class="modes" role="radiogroup" aria-label="Replay source">
    <button
      type="button"
      class:active={mode === 'you'}
      disabled={!userBuffer}
      onclick={() => (mode = 'you')}
      aria-label="You"
    >
      <span class="dot you-dot" aria-hidden="true"></span>
      You
    </button>
    <button
      type="button"
      class:active={mode === 'target'}
      disabled={!targetBuffer}
      onclick={() => (mode = 'target')}
      aria-label="Target"
    >
      <span class="dot target-dot" aria-hidden="true"></span>
      Target
    </button>
    <button
      type="button"
      class:active={mode === 'both'}
      disabled={!userBuffer || !targetBuffer}
      onclick={() => (mode = 'both')}
      aria-label="Both"
    >
      Both
    </button>
  </div>
  <button
    type="button"
    class="play"
    disabled={playing}
    onclick={play}
    aria-label={playing ? 'Playing' : 'Play'}
  >
    {playing ? '▶ Playing…' : '▶ Play'}
  </button>
</div>

<style>
  .replay-bar {
    display: flex; gap: 8px; align-items: center;
    padding: 10px 12px; border: 1px solid var(--border); border-radius: 6px;
    margin-top: 12px;
  }
  .modes {
    display: flex; gap: 0; overflow: hidden;
    border-radius: 4px; border: 1px solid var(--border);
  }
  .modes button {
    padding: 6px 12px; border: none; background: transparent;
    color: var(--muted); font-size: 11px;
    display: inline-flex; align-items: center; gap: 6px;
  }
  .modes button.active {
    background: var(--panel);
    color: var(--text);
    box-shadow: inset 0 0 0 1px var(--cyan);
  }
  .modes button:disabled {
    opacity: 0.4; cursor: not-allowed;
  }
  .dot { width: 6px; height: 6px; border-radius: 50%; }
  .you-dot { background: var(--amber); }
  .target-dot { background: var(--cyan); }
  .play {
    padding: 6px 12px; border: 1px solid var(--cyan); background: transparent;
    color: var(--cyan); border-radius: 4px; font-size: 11px;
    margin-left: auto;
  }
  .play:disabled {
    opacity: 0.6;
  }
</style>
