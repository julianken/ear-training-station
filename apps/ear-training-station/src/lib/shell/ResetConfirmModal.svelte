<script lang="ts">
  let { onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void } = $props();
</script>

<div class="backdrop" role="dialog" aria-modal="true" aria-labelledby="reset-title">
  <div class="modal">
    <h2 id="reset-title" class="title">Reset progress?</h2>
    <p class="body">
      This will permanently delete all items, sessions, and attempts.
      Your settings will be kept. This cannot be undone.
    </p>
    <div class="actions">
      <button type="button" class="cancel" onclick={onCancel}>Cancel</button>
      <button type="button" class="confirm" onclick={onConfirm}>Reset everything</button>
    </div>
  </div>
</div>

<style>
  .backdrop {
    position: fixed; inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex; align-items: center; justify-content: center;
    z-index: 100;
  }
  .modal {
    background: var(--panel); border: 1px solid var(--border);
    border-radius: 8px; padding: 20px; max-width: 360px;
  }
  .title { font-size: 14px; font-weight: 600; margin: 0 0 8px; color: var(--red); }
  .body { font-size: 11px; color: var(--muted); margin: 0 0 16px; }
  .actions { display: flex; gap: 8px; justify-content: flex-end; }
  .cancel, .confirm {
    padding: 6px 12px; border-radius: 4px;
    border: 1px solid var(--border); background: transparent;
    color: var(--text); font-size: 11px;
  }
  .confirm { border-color: var(--red); color: var(--red); }
</style>
