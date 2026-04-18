import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';

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

describe('layout hydration — IDB-unavailable error path', () => {
  beforeEach(() => {
    // Fresh IDB factory per test — prevents state leak via DB contents and
    // ensures `indexedDB.open` is the real fake-indexeddb impl, not a stale
    // patch from a previous test.
    indexedDB = new IDBFactory();
    // Force-reset the deps module-level cache between tests so each run
    // re-exercises openEarTrainingDB. Without this, a cache populated by a
    // prior successful hydrate leaks between tests.
    vi.resetModules();
  });

  it('hydrateShellStores rejects when indexedDB.open throws', async () => {
    const restore = breakIndexedDBOpen();
    try {
      // Re-import after resetModules so deps.ts runs with the patched IDB.
      const { hydrateShellStores: hydrate } = await import('$lib/shell/stores');
      await expect(hydrate()).rejects.toBeDefined();
    } finally {
      restore();
    }
  });

  it('layout catch handler sets degradationState.persistenceFailing on IDB failure', async () => {
    const restore = breakIndexedDBOpen();
    try {
      const { hydrateShellStores: hydrate, degradationState: degradation } = await import(
        '$lib/shell/stores'
      );
      degradation.set({
        kwsUnavailable: false,
        persistenceFailing: false,
        micLost: false,
      });

      // This is the exact catch pattern used in apps/ear-training-station/src/routes/+layout.svelte
      // — if that call is changed, this test should track the change.
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      await hydrate().catch((e) => {
        console.error('shell: hydrateShellStores failed, persistence unavailable', e);
        degradation.update((s) => ({ ...s, persistenceFailing: true }));
      });

      expect(get(degradation).persistenceFailing).toBe(true);
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    } finally {
      restore();
    }
  });

  it('happy path leaves persistenceFailing false', async () => {
    // Sanity check: when IDB works, the catch branch does not fire.
    const { hydrateShellStores: hydrate, degradationState: degradation } = await import(
      '$lib/shell/stores'
    );
    degradation.set({
      kwsUnavailable: false,
      persistenceFailing: false,
      micLost: false,
    });

    await hydrate().catch((e) => {
      console.error('shell: hydrateShellStores failed, persistence unavailable', e);
      degradation.update((s) => ({ ...s, persistenceFailing: true }));
    });

    expect(get(degradation).persistenceFailing).toBe(false);
  });
});
