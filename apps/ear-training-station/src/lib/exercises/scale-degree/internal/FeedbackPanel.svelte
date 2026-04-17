<script lang="ts">
  import type { RoundState } from '@ear-training/core/round/state';
  import { tooltipFor } from './function-tooltips';
  import { consecutiveNullCount } from '$lib/shell/stores';
  import PitchNullHint from './PitchNullHint.svelte';

  let {
    state,
    showTooltip,
    onNext,
  }: {
    state: Extract<RoundState, { kind: 'graded' }>;
    showTooltip: boolean;
    onNext?: () => void;
  } = $props();

  const targetDegree = $derived(state.item.degree);
  const targetKey = $derived(state.item.key);

  function explanation(): string {
    const { outcome, digitHeard, cents_off } = state;
    if (outcome.pass) {
      return `Nice. You hit ${targetDegree} — ${targetKey.tonic}${targetKey.quality === 'minor' ? ' minor' : ''}.`;
    }
    if (!outcome.pitch && outcome.label) {
      return `You said ${targetDegree} but your pitch was ${cents_off ?? '?'}¢ off.`;
    }
    if (outcome.pitch && !outcome.label) {
      return `You sang ${targetDegree} but said ${digitHeard ?? '—'}.`;
    }
    return `Target was ${targetDegree}. You sang ${cents_off != null ? `${cents_off}¢ off` : 'unclear'} and said ${digitHeard ?? '—'}.`;
  }
</script>

<section class="feedback-panel">
  <div class="result-grid">
    <div class="cell">
      <div class="badge" class:pass={state.outcome.pitch} class:fail={!state.outcome.pitch}>
        {state.outcome.pitch ? '✓' : '✗'}
      </div>
      <div class="detail">
        <div class="label">Pitch</div>
        <div class="value">{state.cents_off != null ? `${Math.round(state.cents_off)}¢` : '—'}</div>
      </div>
    </div>
    <div class="cell">
      <div class="badge" class:pass={state.outcome.label} class:fail={!state.outcome.label}>
        {state.outcome.label ? '✓' : '✗'}
      </div>
      <div class="detail">
        <div class="label">Label</div>
        <div class="value">{state.digitHeard ?? '—'}</div>
      </div>
    </div>
  </div>

  <p class="explanation">{explanation()}</p>

  {#if showTooltip}
    <p class="tooltip">{tooltipFor(targetDegree, targetKey.quality)}</p>
  {/if}

  {#if $consecutiveNullCount >= 3}
    <PitchNullHint />
  {/if}

  <button type="button" class="next-btn" onclick={() => onNext?.()}>Next round</button>
</section>

<style>
  .feedback-panel {
    padding: 12px;
    border: 1px solid var(--border);
    border-radius: 8px;
    margin-top: 12px;
  }
  .result-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  .cell {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .badge {
    width: 22px; height: 22px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-weight: 700; font-size: 14px;
  }
  .pass { background: var(--green); color: #0a0a0a; }
  .fail { background: var(--red); color: #0a0a0a; }
  .label { font-size: 9px; text-transform: uppercase; color: var(--muted); }
  .value { font-variant-numeric: tabular-nums; font-size: 16px; color: var(--text); }
  .explanation { font-size: 11px; color: var(--muted); margin: 12px 0 0; }
  .tooltip { font-size: 11px; color: var(--amber); margin: 8px 0 0; padding-top: 8px; border-top: 1px dashed var(--border); }
  .next-btn {
    margin-top: 12px;
    padding: 8px 18px;
    border-radius: 6px;
    border: 1px solid var(--cyan);
    background: transparent;
    color: var(--cyan);
    font-size: 12px;
    cursor: pointer;
  }
</style>
