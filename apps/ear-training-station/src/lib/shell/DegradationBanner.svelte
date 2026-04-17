<script lang="ts">
  import { degradationState } from './stores';

  const messages = $derived([
    $degradationState.kwsUnavailable && 'Speech recognition unavailable — you can still sing the note.',
    $degradationState.persistenceFailing && 'Saving locally failed — progress may not persist.',
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
