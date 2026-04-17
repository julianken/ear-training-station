<script lang="ts">
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { getDeps } from '$lib/shell/deps';
  import { settings } from '$lib/shell/stores';

  let { onBack }: { onBack: () => void } = $props();

  async function complete() {
    const deps = await getDeps();
    await deps.settings.update({ onboarded: true });
    settings.update((s) => ({ ...s, onboarded: true }));
    await goto(resolve('/scale-degree'));
  }
</script>

<div class="step">
  <h1 class="headline">Ready for your first round</h1>
  <p class="body">
    Plan C1.3 will replace this step with a real warmup round (degree 5 in C major).
    For now, click Start to finish onboarding and go to the dashboard.
  </p>
  <div class="actions">
    <button type="button" class="back" onclick={onBack}>Back</button>
    <button type="button" class="primary" onclick={complete}>Start practicing</button>
  </div>
</div>

<style>
  .step { max-width: 440px; margin: 40px auto; text-align: center; }
  .headline { font-size: 18px; font-weight: 500; margin: 0 0 12px; }
  .body { font-size: 12px; color: var(--muted); margin: 0 0 24px; }
  .actions { display: flex; gap: 8px; justify-content: center; }
  .primary {
    padding: 10px 20px; border-radius: 6px; border: 1px solid var(--cyan);
    background: transparent; color: var(--cyan); font-size: 12px;
  }
  .back {
    padding: 10px 20px; border-radius: 6px; border: 1px solid var(--border);
    background: transparent; color: var(--muted); font-size: 12px;
  }
</style>
