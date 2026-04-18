import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { get } from 'svelte/store';
import { render } from '@testing-library/svelte';
import { tick } from 'svelte';
import Layout from '../../src/routes/+layout.svelte';
import { degradationState, handleHydrationError } from '$lib/shell/stores';

/**
 * Integration test for the layout hydration error path.
 *
 * Covers GitHub #105: `void hydrateShellStores()` silently swallowed IDB
 * rejection in Safari private mode / Firefox strict privacy / quota-exceeded.
 * The +layout.svelte onMount handler must catch the rejection and surface it
 * via `degradationState.persistenceFailing` so the DegradationBanner renders.
 *
 * Uses fake-indexeddb with `open()` patched to reject, simulating the browser
 * environments where IDB is advertised but unusable. The test exercises the
 * full chain: getDeps -> openEarTrainingDB -> indexedDB.open.
 *
 * Coverage strategy:
 * - Test 1 pins the low-level invariant (`hydrateShellStores()` rejects).
 * - Test 2 renders the real `+layout.svelte` so the component's onMount
 *   catch handler is the code under test. If someone re-introduces `void`
 *   or drops `.catch()`, this test breaks — that's the whole point of #105.
 * - Test 3 calls `handleHydrationError` directly to verify its contract.
 * - Test 4 is the happy-path sanity check.
 *
 * Tests 1 and 4 use dynamic imports + `vi.resetModules()` so each exercises
 * the `getDeps` cache from a clean slate. Tests 2 and 3 use the statically
 * imported Layout + store so the render-time bindings and the test's
 * assertions reference the same module instance.
 */

/** Patch the global `indexedDB.open` to synchronously throw, simulating a
 *  browser that disallows storage (Safari private mode historically did this).
 *  Returns a restore function. */
function breakIndexedDBOpen(): () => void {
  const original = indexedDB.open.bind(indexedDB);
  indexedDB.open = (() => {
    throw new DOMException('The operation is insecure.', 'SecurityError');
  }) as typeof indexedDB.open;
  return () => {
    indexedDB.open = original;
  };
}

function resetDegradation(): void {
  degradationState.set({
    kwsUnavailable: false,
    persistenceFailing: false,
    micPermissionDenied: false,
    micLost: false,
  });
}

describe('layout hydration — IDB-unavailable error path', () => {
  let consoleErrorSpy: MockInstance<typeof console.error>;

  beforeEach(() => {
    // Fresh IDB factory per test — prevents state leak via DB contents and
    // ensures `indexedDB.open` is the real fake-indexeddb impl, not a stale
    // patch from a previous test.
    indexedDB = new IDBFactory();
    // Silence expected console.error output during these tests; several cases
    // exercise the failure path and the handler logs by contract.
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Start each test with clean degradation state so assertions are
    // independent of execution order.
    resetDegradation();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('hydrateShellStores rejects with SecurityError when indexedDB.open throws', async () => {
    // Force-reset module cache so deps.ts re-runs with the patched IDB and
    // doesn't return a cached DB handle from a prior happy-path test.
    vi.resetModules();
    const restore = breakIndexedDBOpen();
    try {
      // Re-import after resetModules so deps.ts runs with the patched IDB.
      const { hydrateShellStores: hydrate } = await import('$lib/shell/stores');
      await expect(hydrate()).rejects.toMatchObject({ name: 'SecurityError' });
    } finally {
      restore();
    }
  });

  it('+layout.svelte onMount catches IDB failure and flips persistenceFailing', async () => {
    // Drive the real layout component so `+layout.svelte`'s onMount handler
    // is the code under test. If someone re-introduces `void hydrateShellStores()`
    // or drops the `.catch()`, this test goes red.
    //
    // NOTE: Uses the statically imported Layout + degradationState so they
    // reference the same module instance. `vi.resetModules()` is deliberately
    // NOT called here — it would detach the layout's bound `hydrateShellStores`
    // / `handleHydrationError` from the test's view of `degradationState`.
    const restore = breakIndexedDBOpen();
    try {
      render(Layout);

      // onMount schedules the hydrate promise microtask; flush the microtask
      // queue so the rejection reaches the catch handler, then tick so
      // Svelte propagates the store update.
      await Promise.resolve();
      await Promise.resolve();
      await tick();

      expect(get(degradationState).persistenceFailing).toBe(true);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'shell: hydrateShellStores failed, persistence unavailable',
        expect.objectContaining({ name: 'SecurityError' }),
      );
    } finally {
      restore();
    }
  });

  it('handleHydrationError logs and flips persistenceFailing (contract check)', () => {
    // Pins the helper's contract so that even if the layout were re-wired,
    // the shared handler still has the behavior both caller and test rely on.
    const err = new DOMException('boom', 'SecurityError');
    handleHydrationError(err);

    expect(get(degradationState).persistenceFailing).toBe(true);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'shell: hydrateShellStores failed, persistence unavailable',
      err,
    );
  });

  it('happy path leaves persistenceFailing false', async () => {
    // Sanity check: when IDB works, the catch branch does not fire.
    // Reset modules so `deps.ts` doesn't return a handle bound to a
    // previous test's (since-replaced) IDBFactory.
    vi.resetModules();
    const { hydrateShellStores: hydrate, degradationState: freshDegradation, handleHydrationError: freshHandle } =
      await import('$lib/shell/stores');
    freshDegradation.set({
      kwsUnavailable: false,
      persistenceFailing: false,
      micPermissionDenied: false,
      micLost: false,
    });

    await hydrate().catch(freshHandle);

    expect(get(freshDegradation).persistenceFailing).toBe(false);
  });
});
