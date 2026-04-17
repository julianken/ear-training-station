<script lang="ts">
  import { createSessionController, ActiveRound, FeedbackPanel, ReplayBar, SummaryView } from '$lib/exercises/scale-degree';
  import MicDeniedGate from '$lib/shell/MicDeniedGate.svelte';
  import { getDeps } from '$lib/shell/deps';
  import { settings, pushToast } from '$lib/shell/stores';
  import { onDestroy, onMount } from 'svelte';
  import { resolve } from '$app/paths';
  import { dev } from '$app/environment';
  import { page } from '$app/state';
  import { queryMicPermission } from '@ear-training/web-platform/mic/permission';

  let { data } = $props();

  let controller: ReturnType<typeof createSessionController> | null = $state(null);
  let noItemsDue = $state(false);
  let micDenied = $state(false);

  onMount(async () => {
    if (data.session.ended_at != null) return;

    // Dev/test-only preview flag forces the denied-mic gate without real permission check.
    if (
      (dev || import.meta.env.MODE === 'test') &&
      page.url.searchParams.get('preview') === 'mic-denied'
    ) {
      micDenied = true;
      return;
    }

    const micState = await queryMicPermission();
    if (micState === 'denied') {
      micDenied = true;
      return;
    }

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

    if (dev || import.meta.env.MODE === 'test') {
      // @ts-expect-error e2e hook — not present in production bundles
      window.__sessionControllerForTest = controller;
    }
  });

  onDestroy(() => controller?.dispose());
</script>

{#if data.session.ended_at == null && micDenied}
  <MicDeniedGate onRetry={() => window.location.reload()} />
{:else if data.session.ended_at == null && controller}
  <ActiveRound {controller} />
  {#if controller.state.kind === 'graded'}
    <FeedbackPanel
      state={controller.state}
      showTooltip={$settings.function_tooltip}
      onNext={async () => {
        const c = controller;
        if (!c) return;
        try {
          await c.next();
          await c.startRound();
        } catch (err) {
          pushToast({ message: 'Could not advance. Try again.', level: 'error' });
          console.error('session advance failed:', err);
        }
      }}
    />
    <ReplayBar
      userBuffer={controller.capturedAudio}
      targetBuffer={controller.targetAudio}
    />
  {/if}
{:else if data.session.ended_at == null && noItemsDue}
  <p>No items are due right now. <a href={resolve('/')}>Return to dashboard</a></p>
{:else if data.session.ended_at == null}
  <p>Loading…</p>
{:else}
  <SummaryView session={data.session} attempts={data.attempts} />
{/if}
