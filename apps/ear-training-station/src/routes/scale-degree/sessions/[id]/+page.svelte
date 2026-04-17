<script lang="ts">
  let { data } = $props();
  // ActiveRound (Task 5) and SummaryView (Task 11) wire in later.
</script>

{#if data.session.ended_at == null}
  <p>Session in progress (active round UI lands in Task 5)</p>
{:else}
  <p>Session complete (summary UI lands in Task 11). {data.attempts.length} attempts.</p>
{/if}
