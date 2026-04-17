# Plan C1.4: Degradation, A11y, PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close production-readiness gaps surfaced during Plan C1.3 — failure-mode visibility (mic denied, KWS degraded, persistence errors), PWA shell, accessibility smoke, bundle-size budget, and a consolidated cleanup of deferred polish items.

**Architecture:** Shell-level observability layer. A `pendingToasts` writable store plus a mount-once `ShellToast` component give the whole app a uniform way to surface transient errors. A `degradationState` derived store (already stubbed from Plan C1.2) plus a `DegradationBanner` component handle persistent banners. Exercise-level code writes into these stores on known failure paths. PWA via `@vite-pwa/sveltekit`'s zero-config plugin. Axe-core runs alongside existing Playwright shards.

**Tech Stack:** SvelteKit 2 / Svelte 5 runes, @vite-pwa/sveltekit, @axe-core/playwright, Playwright e2e, existing Vitest + ESLint.

---

## Task 1: `ShellToast` + `pendingToasts` store

Foundational transient-notification infrastructure. Every subsequent task consumes this.

**Files:**
- Modify: `apps/ear-training-station/src/lib/shell/stores.ts` — add `pendingToasts` store + helpers
- Create: `apps/ear-training-station/src/lib/shell/ShellToast.svelte`
- Create: `apps/ear-training-station/src/lib/shell/ShellToast.test.ts`
- Modify: `apps/ear-training-station/src/lib/shell/AppShell.svelte` — mount `<ShellToast />` once

- [ ] **Step 1: Branch**

```bash
git checkout main && git pull
git checkout -b c1-4/task1-shell-toast
```

- [ ] **Step 2: Write the failing test**

Create `apps/ear-training-station/src/lib/shell/ShellToast.test.ts`:

```typescript
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/svelte';
import ShellToast from './ShellToast.svelte';
import { pendingToasts, pushToast, dismissToast } from './stores';
import { get } from 'svelte/store';

describe('ShellToast', () => {
  beforeEach(() => { pendingToasts.set([]); });

  it('renders nothing when pendingToasts is empty', () => {
    const { container } = render(ShellToast);
    expect(container.querySelector('.toast')).toBeNull();
  });

  it('renders a toast when pushed', async () => {
    render(ShellToast);
    await act(() => pushToast({ message: 'Hello', level: 'info' }));
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('auto-dismisses info toasts after the default timeout', async () => {
    vi.useFakeTimers();
    try {
      render(ShellToast);
      await act(() => pushToast({ message: 'Auto gone', level: 'info' }));
      expect(screen.getByText('Auto gone')).toBeInTheDocument();
      await act(() => vi.advanceTimersByTime(5000));
      expect(get(pendingToasts)).toHaveLength(0);
    } finally { vi.useRealTimers(); }
  });

  it('error toasts stay until dismissed', async () => {
    vi.useFakeTimers();
    try {
      render(ShellToast);
      const id = await act(() => pushToast({ message: 'Stuck', level: 'error' }));
      await act(() => vi.advanceTimersByTime(30_000));
      expect(get(pendingToasts).length).toBe(1);
      await act(() => dismissToast(id));
      expect(get(pendingToasts)).toHaveLength(0);
    } finally { vi.useRealTimers(); }
  });
});
```

- [ ] **Step 3: Add the store + helpers**

In `apps/ear-training-station/src/lib/shell/stores.ts`, append:

```typescript
export type ToastLevel = 'info' | 'warn' | 'error';
export interface Toast {
  id: string;
  message: string;
  level: ToastLevel;
  createdAt: number;
}

export const pendingToasts = writable<Toast[]>([]);

export function pushToast(input: Omit<Toast, 'id' | 'createdAt'>): string {
  const id = crypto.randomUUID();
  const toast: Toast = { id, createdAt: Date.now(), ...input };
  pendingToasts.update((ts) => [...ts, toast]);
  return id;
}

export function dismissToast(id: string): void {
  pendingToasts.update((ts) => ts.filter((t) => t.id !== id));
}
```

- [ ] **Step 4: Implement `ShellToast.svelte`**

```svelte
<script lang="ts">
  import { pendingToasts, dismissToast, type Toast } from './stores';
  import { onDestroy } from 'svelte';

  const AUTO_DISMISS_MS: Record<Toast['level'], number | null> = {
    info: 5000,
    warn: 10_000,
    error: null, // manual only
  };

  const timers = new Map<string, number>();

  function scheduleAutoDismiss(toast: Toast): void {
    const delay = AUTO_DISMISS_MS[toast.level];
    if (delay == null) return;
    if (timers.has(toast.id)) return;
    const id = setTimeout(() => {
      dismissToast(toast.id);
      timers.delete(toast.id);
    }, delay) as unknown as number;
    timers.set(toast.id, id);
  }

  $effect(() => {
    for (const t of $pendingToasts) scheduleAutoDismiss(t);
  });

  onDestroy(() => {
    for (const id of timers.values()) clearTimeout(id);
    timers.clear();
  });
</script>

<div class="toast-region" role="status" aria-live="polite" aria-atomic="false">
  {#each $pendingToasts as toast (toast.id)}
    <div class="toast toast-{toast.level}" role="alert">
      <span class="message">{toast.message}</span>
      <button
        type="button"
        class="dismiss"
        aria-label="Dismiss notification"
        onclick={() => dismissToast(toast.id)}
      >✕</button>
    </div>
  {/each}
</div>

<style>
  .toast-region {
    position: fixed; bottom: 16px; right: 16px; z-index: 1000;
    display: flex; flex-direction: column; gap: 8px;
    max-width: 360px;
  }
  .toast {
    display: flex; align-items: flex-start; gap: 8px;
    padding: 10px 12px; border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--panel);
    font-size: 11px; color: var(--text);
  }
  .toast-warn { border-color: var(--amber); }
  .toast-error { border-color: var(--red); }
  .message { flex: 1; }
  .dismiss {
    background: transparent; border: none; color: var(--muted);
    cursor: pointer; font-size: 12px; padding: 0 4px;
  }
  .dismiss:hover { color: var(--text); }
</style>
```

- [ ] **Step 5: Mount in `AppShell.svelte`**

Append `<ShellToast />` inside the shell's root container so it lives for the whole session.

- [ ] **Step 6: Run tests — expect pass**

```bash
pnpm --filter ear-training-station test ShellToast
pnpm run typecheck && pnpm run lint
```

- [ ] **Step 7: Commit + PR**

```bash
git add .
git commit -m "feat(shell): ShellToast + pendingToasts store"
git push -u origin c1-4/task1-shell-toast
gh pr create --title "feat(shell): ShellToast + pendingToasts" --body "Shell-level transient notifications. Foundation for C1.4 degradation + error surfacing."
```

---

## Task 2: `DegradationBanner`

Persistent banner for long-running failure states (KWS unavailable, storage persistently failing, mic device lost).

**Files:**
- Modify: `apps/ear-training-station/src/lib/shell/stores.ts` — wire the `degradationState` store's contents to real signals
- Create: `apps/ear-training-station/src/lib/shell/DegradationBanner.svelte`
- Create: `apps/ear-training-station/src/lib/shell/DegradationBanner.test.ts`
- Modify: `apps/ear-training-station/src/lib/shell/AppShell.svelte` — mount the banner
- Modify: `apps/ear-training-station/src/lib/exercises/scale-degree/internal/session-controller.svelte.ts` — push `persistenceError` on catch (replaces the `TODO(c1.4)` signpost)

- [ ] **Step 1: Branch**

```bash
git checkout main && git pull
git checkout -b c1-4/task2-degradation-banner
```

- [ ] **Step 2: Extend the store surface**

In `stores.ts`, the `degradationState` store already exists from C1.2 (currently `writable<'ok' | 'kws-unavailable'>('ok')`). Replace its shape with:

```typescript
export interface DegradationState {
  kwsUnavailable: boolean;
  persistenceFailing: boolean;
  micLost: boolean;
}
export const degradationState = writable<DegradationState>({
  kwsUnavailable: false,
  persistenceFailing: false,
  micLost: false,
});
```

**Ripple is zero:** verified via `git grep degradationState` — there are no consumers outside `stores.ts` itself. The shape change is safe; no follow-on edits needed in other files.

**Persistence-error test harness:** follow the existing pattern at `session-controller.test.ts:423-487`, which already exercises persistence failure via stub repos that reject `attempts.append()` / `items.put()`. Reuse that describe-block's stub shape; add an assertion on `get(degradationState).persistenceFailing === true` (using `get` from `svelte/store`). Remember to `beforeEach(() => degradationState.set({ kwsUnavailable: false, persistenceFailing: false, micLost: false }))` so prior-test state doesn't leak.

- [ ] **Step 3: Write the banner test**

```typescript
import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/svelte';
import DegradationBanner from './DegradationBanner.svelte';
import { degradationState } from './stores';

describe('DegradationBanner', () => {
  beforeEach(() => {
    degradationState.set({ kwsUnavailable: false, persistenceFailing: false, micLost: false });
  });

  it('renders nothing when no degradation is active', () => {
    const { container } = render(DegradationBanner);
    expect(container.querySelector('.degradation-banner')).toBeNull();
  });

  it('renders when KWS is unavailable', async () => {
    render(DegradationBanner);
    await act(() => degradationState.update((s) => ({ ...s, kwsUnavailable: true })));
    expect(screen.getByText(/speech recognition unavailable/i)).toBeInTheDocument();
  });

  it('lists multiple active signals', async () => {
    render(DegradationBanner);
    await act(() =>
      degradationState.set({ kwsUnavailable: true, persistenceFailing: true, micLost: false }),
    );
    expect(screen.getByText(/speech recognition unavailable/i)).toBeInTheDocument();
    expect(screen.getByText(/saving locally failed/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Implement `DegradationBanner.svelte`**

```svelte
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
```

- [ ] **Step 5: Wire `persistenceError` signal in controller**

In `session-controller.svelte.ts`, replace the `catch (e) { console.error(...) }` block's `TODO(c1.4)` with:

```typescript
import { degradationState } from '$lib/shell/stores';
// ...
} catch (e) {
  console.error('session-controller: persistence failed, round not counted', e);
  degradationState.update((s) => ({ ...s, persistenceFailing: true }));
}
```

Add a test that asserts `degradationState.persistenceFailing === true` after a persistence failure.

- [ ] **Step 6: Wire KWS-unavailable signal**

In `session-controller.svelte.ts` `startRound()`, the existing catch block around `startKeywordSpotter({})` swallows errors. Update it to set the signal:

```typescript
try {
  this.#kwsHandle = await startKeywordSpotter({});
  // ... existing wiring
} catch {
  degradationState.update((s) => ({ ...s, kwsUnavailable: true }));
}
```

- [ ] **Step 7: Mount in `AppShell.svelte`**

Render `<DegradationBanner />` above the page content slot.

- [ ] **Step 8: Run tests + commit + PR**

```bash
pnpm run typecheck && pnpm run test && pnpm run lint
git add .
git commit -m "feat(shell): DegradationBanner wired to real failure signals"
git push -u origin c1-4/task2-degradation-banner
gh pr create --title "feat(shell): DegradationBanner" --body "KWS/persistence/mic-loss degradation signals surface as a persistent shell banner."
```

---

## Task 3: `MicDeniedGate`

Blocks session start when mic permission is denied. Shows re-grant guidance.

**Files:**
- Create: `apps/ear-training-station/src/lib/shell/MicDeniedGate.svelte`
- Create: `apps/ear-training-station/src/lib/shell/MicDeniedGate.test.ts`
- Modify: `apps/ear-training-station/src/routes/scale-degree/sessions/[id]/+page.svelte` — render gate when mic is denied
- Create: `apps/ear-training-station/e2e/mic-denied.spec.ts`

- [ ] **Step 1: Branch + failing test**

```bash
git checkout main && git pull
git checkout -b c1-4/task3-mic-denied-gate
```

Create `MicDeniedGate.test.ts`:

```typescript
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import MicDeniedGate from './MicDeniedGate.svelte';

describe('MicDeniedGate', () => {
  it('renders guidance and a retry button', () => {
    render(MicDeniedGate, { onRetry: () => {} });
    expect(screen.getByText(/microphone access/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('fires onRetry when the retry button is clicked', async () => {
    const onRetry = vi.fn();
    render(MicDeniedGate, { onRetry });
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Implement `MicDeniedGate.svelte`**

```svelte
<script lang="ts">
  let { onRetry }: { onRetry: () => void } = $props();
</script>

<section class="mic-denied">
  <h2>Microphone access required</h2>
  <p>
    Practice rounds use your microphone to detect pitch and the degree you say.
    Re-allow mic access in your browser's site settings, then retry.
  </p>
  <button type="button" class="retry" onclick={onRetry}>Retry</button>
</section>

<style>
  .mic-denied {
    max-width: 440px; margin: 40px auto; padding: 20px;
    border: 1px solid var(--amber); background: #2a1e05;
    border-radius: 8px; color: var(--text);
  }
  h2 { font-size: 14px; margin: 0 0 8px; color: var(--amber); }
  p { font-size: 11px; color: var(--muted); margin: 0 0 16px; }
  .retry {
    padding: 8px 16px; border: 1px solid var(--cyan); background: transparent;
    color: var(--cyan); border-radius: 4px; font-size: 11px;
  }
</style>
```

- [ ] **Step 3: Wire into session route — onMount-time permission check**

`getMicStream()` is NOT called in `onMount` today — the callback is passed into `createSessionController(...)` and only invoked later when `startRound()` fires (see `session-controller.svelte.ts:199`). Gating at the `getMicStream` call site is too late and splits the UX across two different components.

Instead, add an explicit permission check at mount time in the route's `+page.svelte`:

```svelte
<script lang="ts">
  import { queryMicPermission } from '@ear-training/web-platform/mic/permission';
  // ...
  let micDenied = $state(false);

  onMount(async () => {
    if (data.session.ended_at != null) return;

    const micState = await queryMicPermission();
    if (micState === 'denied') {
      micDenied = true;
      return;
    }

    const deps = await getDeps();
    // ... existing controller construction below
  });
</script>

{#if data.session.ended_at == null && micDenied}
  <MicDeniedGate onRetry={() => window.location.reload()} />
{:else if data.session.ended_at == null && controller}
  <!-- existing ActiveRound + FeedbackPanel -->
{:else ...}
```

This is testable without error-type narrowing at the `getMicStream` call site, and the gate branch is reachable cleanly.

- [ ] **Step 4: e2e test — route-level `?preview=mic-denied` flag**

The session route's refresh-abandon (`+page.ts:14-21`) marks any `ended_at == null` session complete on load, which is why `round-graded.spec.ts` is `test.skip`'d. The same blocker would make a "seeded active session + denied mic" e2e render `SummaryView`, not `MicDeniedGate`.

Introduce a narrow escape hatch: an opt-in `?preview=mic-denied` query param that, when present, skips the refresh-abandon in `+page.ts` AND forces `micDenied = true` in `+page.svelte`. The flag is dev/e2e-only; gate it behind `if (dev || import.meta.env.MODE === 'test')` to prevent production leakage (same pattern as the `window.__sessionControllerForTest` hook in PR #83).

Use `addInitScript` for the session seed, following the existing `round-graded.spec.ts:14-50` pattern. `page.evaluate` cannot be used here — `seedOnboarded`'s init script hasn't fired yet at evaluate-time (it fires on navigation), so the IDB schema doesn't exist and `transaction('sessions', ...)` would throw `NotFoundError`. `addInitScript` handlers run in registration order at navigation time, so the schema is ready by the time our seed runs.

```typescript
// e2e/mic-denied.spec.ts
import { test, expect } from '@playwright/test';
import { seedOnboarded } from './helpers/app-state';

test('denied mic renders the MicDeniedGate', async ({ page, context }) => {
  await context.clearPermissions();
  await seedOnboarded(page);
  await page.addInitScript(() => {
    const req = indexedDB.open('ear-training', 1);
    req.onsuccess = () => {
      const tx = req.result.transaction('sessions', 'readwrite');
      tx.objectStore('sessions').put({
        id: 'sess-mic-denied', started_at: Date.now(), ended_at: null,
        target_items: 30, completed_items: 0,
        pitch_pass_count: 0, label_pass_count: 0, focus_item_id: null,
      });
    };
  });
  await page.goto('/scale-degree/sessions/sess-mic-denied?preview=mic-denied');
  await expect(page.getByRole('heading', { name: /microphone access required/i })).toBeVisible();
});
```

If route-flag wiring is controversial, fall back to `test.skip` with a clear comment referencing `round-graded.spec.ts`'s existing skip. The implementer can judge based on how invasive the flag ends up being.

- [ ] **Step 5: Run + commit + PR**

```bash
pnpm run typecheck && pnpm run test && pnpm run lint
git add .
git commit -m "feat(shell): MicDeniedGate for denied-permission state"
git push -u origin c1-4/task3-mic-denied-gate
gh pr create --title "feat(shell): MicDeniedGate"
```

---

## Task 4: Service worker via `@vite-pwa/sveltekit`

PWA shell. App works offline after first visit; KWS model and design tokens are cached.

**Files:**
- Modify: `apps/ear-training-station/package.json` — add `@vite-pwa/sveltekit` dev dep
- Modify: `apps/ear-training-station/vite.config.ts` — register the plugin
- Create: `apps/ear-training-station/static/manifest.webmanifest`
- Create: `apps/ear-training-station/e2e/pwa.spec.ts`

- [ ] **Step 1: Branch + install**

```bash
git checkout main && git pull
git checkout -b c1-4/task4-service-worker
pnpm --filter ear-training-station add -D @vite-pwa/sveltekit
```

- [ ] **Step 2: Configure the plugin in `vite.config.ts`**

Use `SvelteKitPWA` with:
- `registerType: 'autoUpdate'`
- Workbox runtime caching for tfjs-models CDN (`tfhub.dev`, `tfjs-models`)
- Asset precache for app shell (SvelteKit generates the precache list automatically)
- `manifest` pointing at the new webmanifest

- [ ] **Step 3: Write `manifest.webmanifest`**

Minimal PWA manifest with app name "Ear Training Station", 192/512 icons (placeholder monochrome SVG-to-PNG is fine), theme `#0a0a0a`, background `#0a0a0a`, display `standalone`, start_url `/`.

- [ ] **Step 4: e2e test**

```typescript
import { test, expect } from '@playwright/test';

test('service worker registers and app boots offline', async ({ page, context }) => {
  await page.goto('/');
  // Wait for SW registration
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, { timeout: 10_000 });

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: /choose an exercise/i })).toBeVisible();
});
```

The offline test is PWA-dev-mode sensitive; mark as `test.skip` if it flakes on CI and flag for follow-up.

- [ ] **Step 5: Run + commit + PR**

```bash
pnpm run typecheck && pnpm run test && pnpm run lint
pnpm run build  # verify SW generation in dist/
git add .
git commit -m "feat(pwa): service worker via @vite-pwa/sveltekit"
git push -u origin c1-4/task4-service-worker
gh pr create --title "feat(pwa): service worker + manifest"
```

---

## Task 5: Axe a11y smoke

One Playwright spec runs axe-core against each rendered screen; fails on any `serious` or `critical` violation.

**Files:**
- Modify: `apps/ear-training-station/package.json` — add `@axe-core/playwright`
- Create: `apps/ear-training-station/e2e/a11y.smoke.spec.ts`

- [ ] **Step 1: Branch + install**

```bash
git checkout main && git pull
git checkout -b c1-4/task5-axe-a11y
pnpm --filter ear-training-station add -D @axe-core/playwright
```

- [ ] **Step 2: Write `a11y.smoke.spec.ts`**

```typescript
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { seedOnboarded } from './helpers/app-state';

const ROUTES = ['/', '/scale-degree', '/settings'];

for (const route of ROUTES) {
  test(`a11y smoke: ${route}`, async ({ page }) => {
    await seedOnboarded(page);
    await page.goto(route);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    const serious = results.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''));
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
  });
}
```

- [ ] **Step 3: Fix any violations surfaced by the smoke**

Expected first-run issues (based on what's already in the codebase):
- Heatmap cells already have `role="img"` + `aria-label` from Task 9's fix — should pass
- Button and link contrast may need adjustment against the dark theme
- Any missing `label` associations on settings inputs

Fix each violation; don't suppress.

- [ ] **Step 4: Commit + PR**

```bash
pnpm run typecheck && pnpm run test && pnpm run lint
git add .
git commit -m "test(e2e): axe-core a11y smoke across main routes"
git push -u origin c1-4/task5-axe-a11y
gh pr create --title "test(e2e): axe-core a11y smoke"
```

---

## Task 6: Bundle-size budget

Enforce a max client-bundle size in CI. Prevents silent bundle growth.

**Files:**
- Modify: `.github/workflows/bundle-size.yml` — add budget check
- Create: `scripts/check-bundle-size.sh` (or inline shell in the workflow)

- [ ] **Step 1: Branch**

```bash
git checkout main && git pull
git checkout -b c1-4/task6-bundle-budget
```

- [ ] **Step 2: Measure current bundle**

Run `pnpm run build` and record the total size of `.svelte-kit/output/client/`:

```bash
du -sb apps/ear-training-station/.svelte-kit/output/client
```

Note the current number (e.g., 2.1 MiB). The budget should be ~20% above current to allow normal growth (e.g., 2.5 MiB).

- [ ] **Step 3: Add the check to the workflow**

In `bundle-size.yml`, after the existing size measurement, compare against a budget constant and `exit 1` if exceeded. Example:

```yaml
- name: Enforce bundle budget
  run: |
    BUDGET=2621440  # 2.5 MiB
    SIZE=$(du -sb apps/ear-training-station/.svelte-kit/output/client | awk '{print $1}')
    echo "Bundle: $SIZE bytes (budget: $BUDGET)"
    [ "$SIZE" -le "$BUDGET" ] || { echo "ABORT: bundle exceeds budget"; exit 1; }
```

Document the current size + budget in a comment at the top of the workflow.

- [ ] **Step 4: Commit + PR**

```bash
git add .
git commit -m "ci(bundle): enforce 2.5 MiB client-bundle budget"
git push -u origin c1-4/task6-bundle-budget
gh pr create --title "ci: bundle-size budget"
```

---

## Task 7: Cleanup pass — deferred polish

Consolidates remaining polish items accumulated during C1.3.

**Files (exact items pulled from accumulated PR reviews):**

From PR #86 (FeedbackPanel + consecutiveNullCount):
- Modify: `apps/ear-training-station/src/routes/scale-degree/sessions/[id]/+page.svelte` (line ~54) — onNext's `void c.next().then(() => c.startRound())` silently swallows rejections. Wrap in try/catch that calls `pushToast({ level: 'error', message: 'Could not advance. Try again.' })` on failure.
- Modify: `apps/ear-training-station/src/lib/exercises/scale-degree/internal/session-controller.svelte.ts` — `cancelRound()` and `dispose()` do NOT reset `consecutiveNullCount` (only `next()` does). Stale count leaks across controller instances after HMR or navigation-back. Reset in both.
- Modify: `apps/ear-training-station/src/lib/exercises/scale-degree/internal/FeedbackPanel.svelte` — `cents_off === 0` currently renders as "0¢ sharp" (the sign-based direction logic treats `>= 0` as sharp). Handle zero explicitly as `"in tune"` or a neutral string.

From PR #88 (test-hook production bundle leakage):
- Modify: `apps/ear-training-station/src/lib/exercises/scale-degree/internal/session-controller.svelte.ts` — extract the four TRUE test-only hooks (`_forceState`, `_forceTimer`, `_forceRunningCounters`, `_getRunningCounters`) behind a dev-only guard (e.g., conditionally attached only when `import.meta.env.MODE !== 'production'`). Keeps ~80+ bytes out of prod bundles.

**Critically, do NOT gate `_onPitchFrame` or `_checkCaptureEnd`** even though they share the `_`-prefix convention. These two are called from the production capture pipeline — `#onStateChange` invokes `_checkCaptureEnd` on every listening-state transition (`session-controller.svelte.ts:175`), and `_onPitchFrame` is the hot path for the pitch-handle subscription (`:225`). Gating them would silently stop grading rounds and dispatching pitch frames in production. Optionally rename those two to drop the misleading `_` prefix so their semantics match the naming convention; this is polish, not required for correctness.

From PR #90 (DashboardWidget):
- Modify: `apps/ear-training-station/src/lib/exercises/scale-degree/internal/DashboardWidget.svelte` — include the `new` Leitner box count as a fourth stat (muted color). Fresh users currently see "0 mastered / 0 reviewing / 0 learning" even with a full starter curriculum queued.

From PR #91 (SummaryView):
- Modify: `apps/ear-training-station/src/lib/exercises/scale-degree/internal/SummaryView.svelte` — pluralization fix: "1 rounds" → "1 round". Tiny — ternary on `attempts.length === 1`.
- Modify: same file — `.n` + `.stat-label` pair lacks semantic association for screen readers. Wrap each `.stat` in a `<dl>` / `<dt>` / `<dd>` structure, or add `aria-describedby` pointing at the label.

**Test-isolation caveat (applies across this task):** multiple suites now reset shared stores (`allItems`, `consecutiveNullCount`, `pendingToasts`, `degradationState`) in describe-scoped `beforeEach`. If a future test file imports these stores without a reset, it inherits leaked state from the previous file. Consider a `vitest.setup.ts` hook that resets ALL shell stores between test files; if scope balloons, flag as a follow-up instead of doing it here.

- [ ] **Step 1: Branch**

```bash
git checkout main && git pull
git checkout -b c1-4/task7-cleanup
```

- [ ] **Step 2: Apply fixes**

For each item above, make the smallest change that addresses the deferred note. Add tests where the change introduces new behavior (e.g., toast fires on onNext rejection).

- [ ] **Step 3: Verify everything still passes**

```bash
pnpm run typecheck && pnpm run test && pnpm run lint
```

- [ ] **Step 4: Commit + PR**

Single commit is fine; the PR description should list each addressed item and link back to the originating PR review comment for traceability.

```bash
git add .
git commit -m "chore(c1-4): cleanup pass for deferred polish"
git push -u origin c1-4/task7-cleanup
gh pr create --title "chore: C1.4 cleanup pass"
```

---

## Exit criteria

Plan C1.4 is complete when:
- All 7 PRs merged
- `pnpm run build` green; `pnpm run test` green; `pnpm run lint` green
- `pnpm exec playwright test` includes a11y smoke spec passing
- Bundle size under budget in CI
- Service worker registers in production build
- No outstanding `TODO(c1.4)` markers in the codebase
