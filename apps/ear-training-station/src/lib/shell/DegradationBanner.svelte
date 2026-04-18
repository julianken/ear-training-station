<script lang="ts">
  import { degradationState } from './stores';

  // Copy is scenario-specific so the user sees actionable guidance:
  // - `micPermissionDenied` — the user never granted access; telling them to
  //   "reconnect" a device that was never connected would be misleading.
  // - `micLost` — the mic was working and then dropped mid-session; reconnect
  //   is the right action. (Reserved for a future runtime-disconnect path.)
  // If both flags happen to be true, show permission-denied first because that
  // is the blocking condition the user must resolve before reconnecting can
  // matter.
  const messages = $derived([
    $degradationState.kwsUnavailable && 'Speech recognition unavailable — you can still sing the note.',
    $degradationState.persistenceFailing && 'Saving locally failed — progress may not persist.',
    $degradationState.micPermissionDenied && 'Microphone access blocked — enable mic access in your browser settings.',
    $degradationState.micLost && 'Microphone disconnected — reconnect to continue.',
  ].filter(Boolean) as string[]);
</script>

{#if messages.length > 0}
  <aside class="degradation-banner" role="status" aria-live="polite">
    <ul>
      {#each messages as msg (msg)}
        <li>{msg}</li>
      {/each}
    </ul>
  </aside>
{/if}

<style>
  .degradation-banner {
    padding: 8px 12px;
    background: #2a1e05;
    border-bottom: 1px solid var(--amber);
    color: var(--amber);
    font-size: 11px;
  }
  ul { margin: 0; padding: 0 0 0 18px; }
  li { margin: 2px 0; }
</style>
