<script lang="ts">
  import { settings } from './stores';
  import { getDeps } from './deps';
  import ResetConfirmModal from './ResetConfirmModal.svelte';
  import type { Settings } from '@ear-training/core/types/domain';

  let showResetModal = $state(false);

  async function update(partial: Partial<Settings>) {
    const deps = await getDeps();
    await deps.settings.update(partial);
    settings.update((s) => ({ ...s, ...partial }));
  }

  async function performReset() {
    const deps = await getDeps();
    await deps.db.clear('items');
    await deps.db.clear('sessions');
    await deps.db.clear('attempts');
    showResetModal = false;
    location.reload();
  }
</script>

<section class="settings-page">
  <h1 class="title">Settings</h1>

  <label class="row">
    <span class="label-text">Function tooltip</span>
    <input
      type="checkbox"
      checked={$settings.function_tooltip}
      onchange={(e) => update({ function_tooltip: (e.currentTarget as HTMLInputElement).checked })}
    />
  </label>

  <label class="row">
    <span class="label-text">Auto-advance on hit</span>
    <input
      type="checkbox"
      checked={$settings.auto_advance_on_hit}
      onchange={(e) => update({ auto_advance_on_hit: (e.currentTarget as HTMLInputElement).checked })}
    />
  </label>

  <label class="row">
    <span class="label-text">Session length</span>
    <select
      value={String($settings.session_length)}
      onchange={(e) => update({ session_length: Number((e.currentTarget as HTMLSelectElement).value) as 20 | 30 | 45 })}
    >
      <option value="20">20 rounds</option>
      <option value="30">30 rounds</option>
      <option value="45">45 rounds</option>
    </select>
  </label>

  <label class="row">
    <span class="label-text">Reduced motion</span>
    <select
      value={$settings.reduced_motion}
      onchange={(e) => update({ reduced_motion: (e.currentTarget as HTMLSelectElement).value as 'auto' | 'on' | 'off' })}
    >
      <option value="auto">Auto (follow system)</option>
      <option value="on">On</option>
      <option value="off">Off</option>
    </select>
  </label>

  <div class="danger-zone">
    <button type="button" class="reset-btn" onclick={() => (showResetModal = true)}>
      Reset progress
    </button>
  </div>
</section>

{#if showResetModal}
  <ResetConfirmModal onConfirm={performReset} onCancel={() => (showResetModal = false)} />
{/if}

<style>
  .settings-page { max-width: 480px; margin: 0 auto; }
  .title { font-size: 14px; font-weight: 600; margin: 0 0 16px; }
  .row {
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px 0; border-bottom: 1px solid var(--border);
  }
  .label-text { font-size: 11px; }
  .danger-zone { margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--border); }
  .reset-btn {
    padding: 8px 12px; border-radius: 4px;
    border: 1px solid var(--red); background: transparent;
    color: var(--red); font-size: 11px;
  }
</style>
