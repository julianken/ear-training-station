<script lang="ts">
  let { onNext }: { onNext: () => void } = $props();
</script>

<div class="step">
  <h1 class="headline">Ear training that uses your voice</h1>
  <p class="body">
    You'll hear a key, then a target note. Sing the note and say its scale
    degree. We'll grade both.
  </p>
  <div class="actions">
    <button type="button" class="primary" onclick={onNext}>Continue</button>
  </div>
</div>

<style>
  .step { max-width: 420px; margin: 40px auto; text-align: center; }
  .headline { font-size: 20px; font-weight: 500; margin: 0 0 12px; color: var(--text); }
  .body { font-size: 12px; color: var(--muted); margin: 0 0 24px; line-height: 1.6; }
  .primary {
    padding: 10px 20px; border-radius: 6px; border: 1px solid var(--cyan);
    background: transparent; color: var(--cyan); font-size: 12px;
  }
</style>
