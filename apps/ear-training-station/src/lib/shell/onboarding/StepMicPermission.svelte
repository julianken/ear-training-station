<script lang="ts">
  import { requestMicStream } from '@ear-training/web-platform/mic/permission';

  let { onNext, onBack }: { onNext: () => void; onBack: () => void } = $props();

  let state = $state<'idle' | 'requesting' | 'granted' | 'denied'>('idle');
  let errorMsg = $state<string>('');

  async function requestAccess() {
    state = 'requesting';
    errorMsg = '';
    try {
      const handle = await requestMicStream();
      handle.stop();
      state = 'granted';
      onNext();
    } catch (e: unknown) {
      state = 'denied';
      errorMsg = e instanceof Error ? e.message : 'Permission denied';
    }
  }
</script>

<div class="step">
  <h1 class="headline">Grant microphone access</h1>
  <p class="body">
    We grade your singing. Audio never leaves this device in the MVP.
  </p>
  <div class="actions">
    <button type="button" class="back" onclick={onBack}>Back</button>
    <button type="button" class="primary" onclick={requestAccess} disabled={state === 'requesting'}>
      {state === 'requesting' ? 'Requesting…' : 'Grant microphone access'}
    </button>
  </div>
  {#if state === 'denied'}
    <p class="error">
      Permission was denied. Re-enable microphone access in your browser settings
      and press the button again. ({errorMsg})
    </p>
  {/if}
</div>

<style>
  .step { max-width: 480px; margin: 40px auto; text-align: center; }
  .headline { font-size: 18px; font-weight: 500; margin: 0 0 12px; }
  .body { font-size: 12px; color: var(--muted); margin: 0 0 24px; }
  .actions { display: flex; gap: 8px; justify-content: center; }
  .primary {
    padding: 10px 20px; border-radius: 6px; border: 1px solid var(--cyan);
    background: transparent; color: var(--cyan); font-size: 12px;
  }
  .primary:disabled { opacity: 0.6; cursor: not-allowed; }
  .back {
    padding: 10px 20px; border-radius: 6px; border: 1px solid var(--border);
    background: transparent; color: var(--muted); font-size: 12px;
  }
  .error { font-size: 11px; color: var(--red); margin-top: 12px; }
</style>
