<script lang="ts">
  import type { Session, Attempt } from '@ear-training/core/types/domain';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';

  let {
    session,
    attempts,
  }: {
    session: Session;
    attempts: Attempt[];
  } = $props();

  const durationMin = $derived(
    session.ended_at != null
      ? Math.round((session.ended_at - session.started_at) / 60000)
      : 0
  );

  const durationLabel = $derived(durationMin < 1 ? '<1m' : `${durationMin}m`);
</script>

<section class="summary">
  <h1 class="title">Done.</h1>
  <p class="meta">{durationLabel} · {attempts.length} {attempts.length === 1 ? 'round' : 'rounds'}</p>

  <div class="stats">
    <dl class="stat">
      <dt class="stat-label">Pitch</dt>
      <dd class="n">{session.pitch_pass_count}/{attempts.length}</dd>
    </dl>
    <dl class="stat">
      <dt class="stat-label">Label</dt>
      <dd class="n">{session.label_pass_count}/{attempts.length}</dd>
    </dl>
  </div>

  <div class="actions">
    <button type="button" class="btn" onclick={() => goto(resolve('/scale-degree'))}>Dashboard</button>
    <button type="button" class="btn-primary" onclick={() => goto(resolve('/'))}>Done</button>
  </div>
</section>

<style>
  .summary { max-width: 440px; margin: 40px auto; text-align: center; }
  .title { font-size: 28px; margin: 0 0 4px; color: var(--green); }
  .meta { font-size: 11px; color: var(--muted); margin: 0 0 24px; }
  .stats { display: flex; gap: 16px; justify-content: center; margin: 0 0 24px; }
  .stat { flex: 1; padding: 16px; background: var(--panel); border: 1px solid var(--border); border-radius: 8px; display: flex; flex-direction: column-reverse; }
  .n { font-size: 28px; font-weight: 500; font-variant-numeric: tabular-nums; }
  .stat-label { font-size: 10px; color: var(--muted); text-transform: uppercase; margin-top: 4px; }
  .actions { display: flex; gap: 8px; justify-content: center; }
  .btn, .btn-primary {
    padding: 10px 20px; border-radius: 6px; font-size: 12px;
    border: 1px solid var(--border); background: transparent; color: var(--muted);
    cursor: pointer;
  }
  .btn-primary { border-color: var(--cyan); color: var(--cyan); }
</style>
