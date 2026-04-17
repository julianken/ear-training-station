<script lang="ts">
  import { createSessionController, ActiveRound } from '$lib/exercises/scale-degree';
  import { getDeps } from '$lib/shell/deps';
  import { onDestroy, onMount } from 'svelte';
  import { resolve } from '$app/paths';

  let { data } = $props();

  let controller: ReturnType<typeof createSessionController> | null = $state(null);
  let noItemsDue = $state(false);

  onMount(async () => {
    if (data.session.ended_at != null) return;

    const deps = await getDeps();
    const items = await deps.items.findDue(Date.now());
    if (items.length === 0) {
      noItemsDue = true;
      return;
    }

    controller = createSessionController({
      session: data.session,
      firstItem: items[0],
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
</script>

{#if data.session.ended_at == null && controller}
  <ActiveRound {controller} />
  <!-- FeedbackPanel (Task 7) + ReplayBar (Task 8) mount here when state === 'graded' -->
{:else if data.session.ended_at == null && noItemsDue}
  <p>No items are due right now. <a href={resolve('/')}>Return to dashboard</a></p>
{:else if data.session.ended_at == null}
  <p>Loading…</p>
{:else}
  <p>Session complete (summary UI lands in Task 11). {data.attempts.length} attempts.</p>
{/if}
