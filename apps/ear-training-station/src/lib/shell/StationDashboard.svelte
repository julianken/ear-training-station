<script lang="ts">
  import { resolve } from '$app/paths';
  import { exercises } from '$lib/exercises';

  // Exercise routes are a dynamic extension point — each exercise module
  // contributes its own route at registration time. SvelteKit's resolve()
  // expects a literal from the generated RouteId union, which can't cover
  // future exercises. Cast to the resolve parameter type so the assertion
  // is honest about what we're doing (narrowing to the function's actual
  // input type) instead of smuggling in `as any` via a non-existent Route.
  type ResolveInput = Parameters<typeof resolve>[0];
</script>

<section class="station-dashboard">
  <h1 class="title">Choose an exercise</h1>
  <div class="grid">
    {#each exercises as ex (ex.manifest.slug)}
      <a class="card" href={resolve(ex.manifest.route as ResolveInput)}>
        <h2 class="card-title">{ex.manifest.name}</h2>
        <p class="card-blurb">{ex.manifest.blurb}</p>
        {#if ex.DashboardWidget}
          <ex.DashboardWidget />
        {/if}
      </a>
    {/each}
  </div>
</section>

<style>
  .station-dashboard { max-width: 640px; margin: 0 auto; }
  .title { font-size: 16px; font-weight: 500; color: var(--text); margin: 0 0 16px; }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 12px;
  }
  .card {
    display: block; padding: 16px;
    background: var(--panel); border: 1px solid var(--border); border-radius: 8px;
    text-decoration: none; color: var(--text);
    transition: border-color 120ms ease;
  }
  .card:hover { border-color: var(--cyan); }
  .card-title { font-size: 13px; font-weight: 600; margin: 0 0 6px; }
  .card-blurb { font-size: 11px; color: var(--muted); margin: 0; }
</style>
