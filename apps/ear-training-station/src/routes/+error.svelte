<script lang="ts">
  import { page } from '$app/state';
  import { resolve } from '$app/paths';
</script>

<svelte:head><title>Error — Ear Training Station</title></svelte:head>

<main class="error-page">
  <div class="error-card">
    <span class="status-code">{page.status}</span>
    <h1 class="error-heading">Something went wrong</h1>
    {#if page.error?.message}
      <p class="error-detail">{page.error.message}</p>
    {/if}
    <a href={resolve('/')} class="home-link">Back to home</a>
  </div>
</main>

<style>
  .error-page {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    background: var(--bg);
    padding: 1.5rem;
  }

  .error-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    text-align: center;
    max-width: 480px;
    width: 100%;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 0.75rem;
    padding: 2.5rem 2rem;
  }

  .status-code {
    font-size: 3rem;
    font-weight: 700;
    line-height: 1;
    color: var(--red);
  }

  .error-heading {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--text);
  }

  .error-detail {
    margin: 0.25rem 0 0;
    font-size: 0.875rem;
    color: var(--muted);
  }

  .home-link {
    margin-top: 0.5rem;
    color: var(--cyan);
    text-decoration: none;
    font-size: 0.9375rem;
  }

  .home-link:hover {
    text-decoration: underline;
  }
</style>
