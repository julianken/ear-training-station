<script lang="ts">
  let { onNext, onBack }: { onNext: () => void; onBack: () => void } = $props();
</script>

<div class="step">
  <h1 class="headline">Scale degrees: the map of a key</h1>
  <p class="body">
    Every key has seven scale degrees — numbered 1 through 7. The <strong>1</strong>
    is the "home" note (tonic). The <strong>5</strong> is a brighter, tension-building note.
    Your ear will learn to recognize them by their function, not by memorizing pitches.
  </p>
  <p class="body">
    In each round you'll hear a short cadence that establishes the key,
    then a single target note. Your job: sing it and say its number.
  </p>
  <div class="actions">
    <button type="button" class="back" onclick={onBack}>Back</button>
    <button type="button" class="primary" onclick={onNext}>Continue</button>
  </div>
</div>

<style>
  .step { max-width: 480px; margin: 40px auto; }
  .headline { font-size: 18px; font-weight: 500; margin: 0 0 12px; text-align: center; }
  .body { font-size: 12px; color: var(--muted); margin: 0 0 16px; line-height: 1.6; }
  .actions { display: flex; gap: 8px; justify-content: center; margin-top: 24px; }
  .primary {
    padding: 10px 20px; border-radius: 6px; border: 1px solid var(--cyan);
    background: transparent; color: var(--cyan); font-size: 12px;
  }
  .back {
    padding: 10px 20px; border-radius: 6px; border: 1px solid var(--border);
    background: transparent; color: var(--muted); font-size: 12px;
  }
</style>
