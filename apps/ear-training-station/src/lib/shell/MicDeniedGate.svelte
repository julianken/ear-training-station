<script lang="ts">
  let { onRetry }: { onRetry: () => void } = $props();
</script>

<section class="mic-denied">
  <h2>Microphone access required</h2>
  <p>
    Practice rounds use your microphone to detect pitch and the degree you say.
    Re-allow mic access in your browser's site settings, then retry.
  </p>
  <button type="button" class="retry" onclick={onRetry}>Retry</button>
</section>

<style>
  .mic-denied {
    max-width: 440px; margin: 40px auto; padding: 20px;
    border: 1px solid var(--amber); background: #2a1e05;
    border-radius: 8px; color: var(--text);
  }
  h2 { font-size: 14px; margin: 0 0 8px; color: var(--amber); }
  p { font-size: 11px; color: var(--muted); margin: 0 0 16px; }
  .retry {
    padding: 8px 16px; border: 1px solid var(--cyan); background: transparent;
    color: var(--cyan); border-radius: 4px; font-size: 11px;
  }
</style>
