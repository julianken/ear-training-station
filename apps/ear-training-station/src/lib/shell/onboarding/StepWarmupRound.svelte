<script lang="ts">
  import { createSessionController, ActiveRound, FeedbackPanel } from '$lib/exercises/scale-degree';
  import { getDeps } from '$lib/shell/deps';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { onMount, onDestroy } from 'svelte';
  import { settings, allItems } from '$lib/shell/stores';
  import type { Item } from '@ear-training/core/types/domain';
  import type { SessionController } from '$lib/exercises/scale-degree';
  import { buildInitialItems } from '@ear-training/core/seed/initial-items';

  let { onBack }: { onBack: () => void } = $props();

  const warmupItem: Item = {
    id: '5-C-major',
    degree: 5,
    key: { tonic: 'C', quality: 'major' },
    box: 'new',
    accuracy: { pitch: 0, label: 0 },
    recent: [],
    attempts: 0,
    consecutive_passes: 0,
    last_seen_at: null,
    due_at: 0,
    created_at: 0,
  };

  let controller = $state<SessionController | null>(null);

  onMount(async () => {
    const deps = await getDeps();
    const id = crypto.randomUUID();
    const session = await deps.sessions.start({ id, target_items: 1, started_at: Date.now() });
    controller = createSessionController({
      session,
      firstItem: warmupItem,
      itemsRepo: deps.items,
      attemptsRepo: deps.attempts,
      sessionsRepo: deps.sessions,
      settingsRepo: deps.settings,
      getAudioContext: () => new AudioContext(),
      getMicStream: async () => {
        const { requestMicStream } = await import('@ear-training/web-platform/mic/permission');
        const handle = await requestMicStream();
        return handle.stream;
      },
    });
  });

  onDestroy(() => controller?.dispose());

  async function finish() {
    if (controller) {
      await controller.next(); // completes the session since target_items === 1
    }
    const deps = await getDeps();
    // Seed the starter curriculum for the user's first real session. The warmup round
    // persists one item (5-C-major); without this, findDue() would return only that one
    // item and every round would hit the same target.
    const existing = await deps.items.listAll();
    const existingIds = new Set(existing.map((it) => it.id));
    const seeds = buildInitialItems({ now: Date.now() }).filter((s) => !existingIds.has(s.id));
    if (seeds.length > 0) {
      await deps.items.putMany(seeds);
      allItems.set([...existing, ...seeds]);
    }
    await deps.settings.update({ onboarded: true });
    settings.update((s) => ({ ...s, onboarded: true }));
    await goto(resolve('/scale-degree'));
  }
</script>

<div class="step">
  <h2 class="headline">Your first round</h2>
  <p class="body">Hear the key, then sing the target note and say its degree.</p>

  {#if controller}
    <ActiveRound {controller} />
    {#if controller.state.kind === 'graded'}
      <FeedbackPanel state={controller.state} showTooltip={true} />
      <div class="next">
        <button type="button" class="primary" onclick={finish}>Finish onboarding</button>
      </div>
    {/if}
  {:else}
    <p class="body">Preparing…</p>
  {/if}

  <div class="actions">
    <button type="button" class="back" onclick={onBack}>Back</button>
  </div>
</div>

<style>
  .step { max-width: 640px; margin: 16px auto; }
  .headline { font-size: 16px; font-weight: 500; margin: 0 0 8px; text-align: center; }
  .body { font-size: 11px; color: var(--muted); text-align: center; margin: 0 0 16px; }
  .next { display: flex; justify-content: center; margin-top: 16px; }
  .primary {
    padding: 10px 20px; border-radius: 6px; border: 1px solid var(--cyan);
    background: transparent; color: var(--cyan); font-size: 12px;
    cursor: pointer;
  }
  .actions { display: flex; justify-content: center; margin-top: 16px; }
  .back {
    padding: 8px 16px; border-radius: 6px; border: 1px solid var(--border);
    background: transparent; color: var(--muted); font-size: 11px;
    cursor: pointer;
  }
</style>
