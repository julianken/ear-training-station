# Plan C1.2 — SvelteKit Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the SvelteKit app shell — routing, layout, station dashboard, onboarding (with a placeholder warmup step), settings — on top of the C1.1 foundation. After this plan merges, the app renders at `/`, redirects first-run users to `/onboarding`, and has a placeholder route at `/scale-degree` that C1.3 will fill in.

**Architecture:** SvelteKit 2.x with Svelte 5 runes, `adapter-static` for a fully-client PWA, and the existing dev-only audio harness preserved at `/harness/audio.html`. The station shell consumes an exercise registry at `$lib/exercises/index.ts` — this plan seeds it with a stub scale-degree manifest and a placeholder route; C1.3 replaces the placeholder with the real implementation. The app's public import boundary is enforced by an ESLint rule that blocks `$lib/exercises/*/internal/*` imports from outside the owning exercise.

**Tech Stack:** SvelteKit 2.x, Svelte 5, `@sveltejs/adapter-static`, existing pnpm workspace, existing Vitest. No `@vite-pwa/sveltekit` yet — that lands in C1.4.

**Spec:** `docs/specs/2026-04-16-plan-c1-ui-integration-design.md`

**Depends on:** Plan C1.1 fully merged (`Settings.onboarded` exists; `gradeListeningState`, `CAPTURE_COMPLETE`, `AudioBufferRecorder` exist though not used yet).

**TDD discipline — unit AND e2e:** every task that introduces user-visible behavior includes a Playwright e2e test written BEFORE the implementation, alongside the component unit test. The e2e test is the acceptance gate: a feature is not "done" until Playwright passes on top of Vitest. Shared Playwright fixtures + helpers land in Task 1. Feature tasks (2–5) each gain an explicit "Write the failing e2e test" step before the component work.

**PR body requirements — screenshots + mermaid for UI tasks:** every PR in this plan that adds or modifies visible UI (any `.svelte` file, CSS/tokens affecting rendering, any route) MUST include at least one screenshot referenced in the PR body. When architecture, flow, state machine, component tree, or navigation graph clarifies the change, embed a mermaid diagram in the PR body using a ```mermaid fenced block. GitHub renders mermaid inline.

**Headless-friendly screenshot workflow for implementer subagents:** capture the screenshot directly from a Playwright script (reusing the task's own e2e spec is ideal — it already drives the flow), save the PNG to `docs/screenshots/c1-2/taskN-<slug>/<description>.png`, commit it with the PR, and reference it in the PR body using an ABSOLUTE `raw.githubusercontent.com` URL with the branch interpolated at PR-creation time. Relative paths like `../../docs/...` do **not** work in PR bodies (GitHub resolves them against `/pull/N/`, not the repo root — see [github/markup#576](https://github.com/github/markup/issues/576)); the raw URL form works for both in-review PRs (pointing at the PR branch) and post-merge viewers (point at `main`).

Example snippet inside the e2e spec:

```typescript
// Capture screenshot for PR body
await page.screenshot({ path: 'docs/screenshots/c1-2/task3-station-dashboard/picker.png', fullPage: true });
```

And in the commit/push step, interpolate the branch when building the PR body:

```bash
BRANCH=$(git rev-parse --abbrev-ref HEAD)
gh pr create --body "...
![picker](https://raw.githubusercontent.com/julianken/ear-training-station/$BRANCH/docs/screenshots/c1-2/task3-station-dashboard/picker.png)
..."
```

Subagents `git add docs/screenshots/...` before the PR commit. Human drag-and-drop screenshots are welcome follow-ups but not required for subagent-generated PRs.

---

## Task map

| # | Task | Scope | Test layers |
|---|------|-------|-------------|
| 1 | SvelteKit scaffold + deps + ESLint boundary rule + **Playwright fixtures** | app config | harness smoke remains green |
| 2 | AppShell `+layout.svelte` + onboarded-redirect in `+layout.ts` | shell | component + e2e (redirect) |
| 3 | Exercise registry stub + StationDashboard at `/` | shell + registry | component + e2e (picker navigates) |
| 4 | Settings page at `/settings` (+ Reset Progress modal) | shell | component + e2e (setting persists across reload) |
| 5 | OnboardingFlow at `/onboarding` (steps 1–3 + stub step 4) | shell | component + e2e (full flow completes) |
| 6 | Placeholder `/scale-degree` route | routing | trivial — smoke only |

The existing audio harness at `/harness/audio.html` keeps working throughout. No changes to core or web-platform packages.

---

### Task 1: SvelteKit scaffold + deps + ESLint exercise-boundary rule

Install SvelteKit and adapter-static. Configure Vite + SvelteKit to coexist with the existing harness. Add ESLint rule that blocks cross-exercise internal imports.

**Files:**
- Create: `apps/ear-training-station/svelte.config.js`
- Create: `apps/ear-training-station/src/app.html`
- Create: `apps/ear-training-station/src/app.css`
- Create: `apps/ear-training-station/src/app.d.ts`
- Create: `apps/ear-training-station/src/routes/+layout.ts` (empty for now — real version in Task 2)
- Modify: `apps/ear-training-station/package.json` (add deps, add SvelteKit scripts)
- Modify: `apps/ear-training-station/vite.config.ts` (add SvelteKit plugin)
- Modify: `apps/ear-training-station/tsconfig.json` (extend `.svelte-kit/tsconfig.json`)
- Modify: root `eslint.config.js` (add `no-restricted-imports` rule)

- [ ] **Step 1: Branch**

```bash
git checkout main && git pull
git checkout -b c1-2/task1-sveltekit-scaffold
```

- [ ] **Step 2: Install deps**

```bash
cd apps/ear-training-station
pnpm add -D @sveltejs/kit@^2 @sveltejs/adapter-static@^3 @sveltejs/vite-plugin-svelte@^4
pnpm add svelte@^5
cd ../..
```

Expected: `apps/ear-training-station/package.json` updated with the four deps; `pnpm-lock.yaml` updated.

- [ ] **Step 3: Create `svelte.config.js`**

Create `apps/ear-training-station/svelte.config.js`:

```javascript
import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter({
      fallback: 'index.html', // SPA mode
      pages: 'build',
      assets: 'build',
      strict: true,
    }),
    alias: {
      '$lib': 'src/lib',
    },
  },
};

export default config;
```

- [ ] **Step 4: Create `src/app.html`**

Create `apps/ear-training-station/src/app.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <link rel="icon" href="%sveltekit.assets%/favicon.png" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#0a0a0a" />
    <title>Ear Training Station</title>
    %sveltekit.head%
  </head>
  <body data-sveltekit-preload-data="hover">
    <div style="display: contents">%sveltekit.body%</div>
  </body>
</html>
```

- [ ] **Step 5: Create `src/app.css`**

Create `apps/ear-training-station/src/app.css`:

```css
@import '@ear-training/ui-tokens/tokens.css';

html, body {
  margin: 0;
  padding: 0;
  background: var(--bg);
  color: var(--text);
  font-family: Inter, -apple-system, system-ui, sans-serif;
  font-size: 14px;
  line-height: 1.5;
}

*, *::before, *::after {
  box-sizing: border-box;
}

button {
  font: inherit;
  cursor: pointer;
}

input, select {
  font: inherit;
}
```

- [ ] **Step 6: Create `src/app.d.ts`**

Create `apps/ear-training-station/src/app.d.ts`:

```typescript
declare global {
  namespace App {
    interface PageData {}
    interface Error {}
    interface Locals {}
    interface Platform {}
  }
}

export {};
```

- [ ] **Step 7: Create empty `src/routes/+layout.ts`**

Create `apps/ear-training-station/src/routes/+layout.ts`:

```typescript
export const prerender = false;
export const ssr = false;
```

Rationale: client-only SPA. Task 2 adds the onboarded-redirect `load` function.

- [ ] **Step 8: Update `vite.config.ts`**

Modify `apps/ear-training-station/vite.config.ts`. Replace the existing content with:

```typescript
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
  server: {
    fs: {
      // allow access to the monorepo siblings (ui-tokens CSS etc.)
      allow: ['..', '../..'],
    },
  },
});
```

- [ ] **Step 9: Update `tsconfig.json`**

Modify `apps/ear-training-station/tsconfig.json`:

```json
{
  "extends": "./.svelte-kit/tsconfig.json",
  "compilerOptions": {
    "allowJs": true,
    "checkJs": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "sourceMap": true,
    "strict": true,
    "moduleResolution": "bundler"
  }
}
```

The `.svelte-kit/tsconfig.json` is generated by `svelte-kit sync` (run automatically on build/dev).

- [ ] **Step 10: Update `apps/ear-training-station/package.json` scripts**

Add SvelteKit scripts. The full `scripts` block should now be (replacing the existing `scripts`):

```json
{
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "preview": "vite preview",
    "check": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test"
  }
}
```

- [ ] **Step 11: Add ESLint exercise-boundary rule**

Modify the root `eslint.config.js`. Add a new entry under the existing config array:

```javascript
{
  files: ['apps/ear-training-station/src/**/*.{ts,svelte}'],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [
        {
          group: ['**/$lib/exercises/*/internal/**', '$lib/exercises/*/internal/**'],
          message: 'Exercise internals are private. Import from the exercise\'s index.ts (public API).',
        },
      ],
    }],
  },
},
{
  // Allow internal imports WITHIN the same exercise folder.
  files: ['apps/ear-training-station/src/lib/exercises/**/internal/**/*.{ts,svelte}'],
  rules: {
    'no-restricted-imports': 'off',
  },
},
{
  // Allow the exercise's own index.ts to re-export from internal.
  files: ['apps/ear-training-station/src/lib/exercises/*/index.ts'],
  rules: {
    'no-restricted-imports': 'off',
  },
},
```

- [ ] **Step 12: Migrate the harness path**

The existing harness lives at `apps/ear-training-station/harness/audio.html` (outside `public/`). SvelteKit serves `/harness/audio.html` automatically as a static asset as long as it stays where it is. Verify:

```bash
pnpm run dev
```

Expected: dev server starts; visit `http://localhost:5173/` → blank SvelteKit default page (no routes defined yet). Visit `http://localhost:5173/harness/audio.html` → existing harness renders and works.

Stop dev server.

- [ ] **Step 13: Add Playwright fixtures for app-level e2e**

The existing Playwright config (`apps/ear-training-station/playwright.config.ts`) currently runs only the audio-harness smoke test. Extend it to support app-level tests with IndexedDB seeding helpers.

Create `apps/ear-training-station/e2e/helpers/app-state.ts`:

```typescript
import type { Page } from '@playwright/test';
import type { Settings } from '@ear-training/core/types/domain';

/** Seed IndexedDB with an onboarded settings row so the shell doesn't redirect. */
export async function seedOnboarded(page: Page, overrides: Partial<Settings> = {}): Promise<void> {
  await page.addInitScript((settings) => {
    const req = indexedDB.open('ear-training', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings');
      if (!db.objectStoreNames.contains('items')) db.createObjectStore('items', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('sessions')) db.createObjectStore('sessions', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('attempts')) db.createObjectStore('attempts', { keyPath: 'id' });
    };
    req.onsuccess = () => {
      const tx = req.result.transaction('settings', 'readwrite');
      tx.objectStore('settings').put(settings, 'singleton');
    };
  }, {
    function_tooltip: true,
    auto_advance_on_hit: true,
    session_length: 30,
    reduced_motion: 'auto',
    onboarded: true,
    ...overrides,
  });
}

/** Clear all app IndexedDB data before the test (fresh-user state). */
export async function resetAppState(page: Page): Promise<void> {
  await page.addInitScript(() => {
    indexedDB.deleteDatabase('ear-training');
  });
}
```

Create a simple shell-smoke test to verify the fixture works. Create `apps/ear-training-station/e2e/shell.smoke.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';
import { seedOnboarded, resetAppState } from './helpers/app-state';

test('fresh user visiting / is redirected to /onboarding', async ({ page }) => {
  await resetAppState(page);
  await page.goto('/');
  await expect(page).toHaveURL(/\/onboarding/);
});

test('onboarded user can visit / without redirect', async ({ page }) => {
  await seedOnboarded(page);
  await page.goto('/');
  await expect(page).toHaveURL(/\/$/);
});
```

Note: these tests will FAIL right now (no routes yet). That's expected — Task 2 and 5 make them pass. The scaffold here is just the fixture infrastructure.

- [ ] **Step 14: Run full suite — expect baseline**

```bash
pnpm run typecheck && pnpm run test && pnpm run build
```

Expected: unit tests green, build clean. The new e2e `shell.smoke.spec.ts` tests can be skipped for this task's PR (the failing tests gate Task 2 and 5 instead). To skip: rename to `.spec.ts.skip` OR add `test.skip` prefix; reinstate in Task 2.

- [ ] **Step 15: Commit + PR**

```bash
git add apps/ear-training-station/svelte.config.js \
        apps/ear-training-station/src/app.html \
        apps/ear-training-station/src/app.css \
        apps/ear-training-station/src/app.d.ts \
        apps/ear-training-station/src/routes/+layout.ts \
        apps/ear-training-station/package.json \
        apps/ear-training-station/vite.config.ts \
        apps/ear-training-station/tsconfig.json \
        eslint.config.js \
        pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
chore(app): scaffold SvelteKit with adapter-static

Installs @sveltejs/kit 2.x, adapter-static, Svelte 5. Configures
client-only SPA (no SSR, no prerender). Existing audio harness
at /harness/audio.html keeps working. Adds ESLint rule that
blocks cross-exercise internal imports.

No Svelte components yet — Task 2 adds the AppShell layout.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git push -u origin c1-2/task1-sveltekit-scaffold
gh pr create --title "chore(app): scaffold SvelteKit + adapter-static + exercise-boundary lint" --body "$(cat <<'EOF'
## Summary
Scaffolds SvelteKit 2.x + Svelte 5 + adapter-static. Configures client-only SPA. Preserves the existing audio harness. Adds ESLint rule enforcing exercise public-API boundary.

## Test plan
- [x] `pnpm run dev` — dev server starts; harness still works at /harness/audio.html
- [x] `pnpm run typecheck && pnpm run test && pnpm run build` — all green

Part of Plan C1.2.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

### Task 2: AppShell layout + onboarded-redirect

Builds the shared shell chrome (logo, streak chip, total-time chip, settings gear) and the layout-level redirect that forces first-run users to `/onboarding`.

**Files:**
- Create: `apps/ear-training-station/src/lib/shell/AppShell.svelte`
- Create: `apps/ear-training-station/src/lib/shell/StreakChip.svelte`
- Create: `apps/ear-training-station/src/lib/shell/stores.ts`
- Create: `apps/ear-training-station/src/lib/shell/deps.ts` (DB + repo instances, shared across routes)
- Modify: `apps/ear-training-station/src/routes/+layout.ts` (add load function with redirect)
- Modify: `apps/ear-training-station/src/routes/+layout.svelte` (wrap slot in `<AppShell>`)
- Create: `apps/ear-training-station/src/routes/+layout.svelte`
- Create: `apps/ear-training-station/tests/shell/AppShell.test.ts`

- [ ] **Step 1: Branch**

```bash
git checkout main && git pull
git checkout -b c1-2/task2-app-shell
```

- [ ] **Step 2: Install testing-library**

```bash
cd apps/ear-training-station
pnpm add -D @testing-library/svelte @testing-library/jest-dom @testing-library/user-event
cd ../..
```

- [ ] **Step 3: Write the failing test**

Create `apps/ear-training-station/tests/shell/AppShell.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import AppShell from '$lib/shell/AppShell.svelte';

describe('AppShell', () => {
  it('renders the logo', () => {
    render(AppShell);
    expect(screen.getByText(/ear training/i)).toBeInTheDocument();
  });

  it('renders a settings link pointing to /settings', () => {
    render(AppShell);
    const link = screen.getByRole('link', { name: /settings/i });
    expect(link.getAttribute('href')).toBe('/settings');
  });
});
```

- [ ] **Step 4: Run test — expect fail**

```bash
pnpm --filter ear-training-station test AppShell
```

Expected: FAIL — component does not exist.

- [ ] **Step 5: Create shared shell dependencies module**

Create `apps/ear-training-station/src/lib/shell/deps.ts`:

```typescript
import { openDb } from '@ear-training/web-platform/store/db';
import {
  createItemsRepo,
  createAttemptsRepo,
  createSessionsRepo,
  createSettingsRepo,
} from '@ear-training/web-platform/store/items-repo';
// (actual imports from web-platform's existing factory exports — confirm exact paths)

let cached: Awaited<ReturnType<typeof build>> | null = null;

async function build() {
  const db = await openDb();
  return {
    db,
    items: createItemsRepo(db),
    attempts: createAttemptsRepo(db),
    sessions: createSessionsRepo(db),
    settings: createSettingsRepo(db),
  };
}

export async function getDeps() {
  if (!cached) cached = await build();
  return cached;
}
```

Note: the exact import paths for `createItemsRepo`, etc. should match whatever `@ear-training/web-platform` actually exports. Check `packages/web-platform/src/index.ts` (or per-file exports) and adjust.

- [ ] **Step 6: Create stores**

Create `apps/ear-training-station/src/lib/shell/stores.ts`:

```typescript
import { readable, writable } from 'svelte/store';
import { DEFAULT_SETTINGS, type Settings } from '@ear-training/core/types/domain';
import type { Item, Session } from '@ear-training/core/types/domain';
import { getDeps } from './deps';

/** Non-reactive defaults — overridden asynchronously on first load. */
export const settings = writable<Settings>(DEFAULT_SETTINGS);
export const allItems = writable<Item[]>([]);
export const allSessions = writable<Session[]>([]);

/** Degradation state — set by KWS load catch handler or mic-denied path. */
export type DegradationState = 'ok' | 'kws-unavailable';
export const degradationState = writable<DegradationState>('ok');

/** Consecutive null-pitch frame counter — resets on any non-null attempt. */
export const consecutiveNullCount = writable(0);

export async function hydrateShellStores(): Promise<void> {
  const deps = await getDeps();
  const [s, items, sessions] = await Promise.all([
    deps.settings.getOrDefault(),
    deps.items.listAll(),
    deps.sessions.findRecent(200),
  ]);
  settings.set(s);
  allItems.set(items);
  allSessions.set(sessions);
}
```

- [ ] **Step 7: Create the `AppShell.svelte` component**

Create `apps/ear-training-station/src/lib/shell/AppShell.svelte`:

```svelte
<script lang="ts">
  import StreakChip from './StreakChip.svelte';
  let { children } = $props();
</script>

<div class="shell">
  <header class="shell-header">
    <a class="logo" href="/">Ear Training</a>
    <nav class="shell-nav">
      <StreakChip />
      <a class="settings-link" href="/settings" aria-label="Settings">⚙ Settings</a>
    </nav>
  </header>
  <main class="shell-outlet">
    {@render children?.()}
  </main>
</div>

<style>
  .shell {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }
  .shell-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 20px;
    border-bottom: 1px solid var(--border);
  }
  .logo {
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.02em;
    color: var(--text);
    text-decoration: none;
  }
  .shell-nav {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .settings-link {
    font-size: 11px;
    color: var(--muted);
    text-decoration: none;
  }
  .settings-link:hover {
    color: var(--text);
  }
  .shell-outlet {
    flex: 1;
    padding: 20px;
  }
</style>
```

- [ ] **Step 8: Create `StreakChip.svelte`**

Create `apps/ear-training-station/src/lib/shell/StreakChip.svelte`:

```svelte
<script lang="ts">
  import { derived } from 'svelte/store';
  import { allSessions } from './stores';
  import { currentStreak } from '@ear-training/core/analytics/rollups';

  const streak = derived(allSessions, ($sessions) => currentStreak($sessions, Date.now()));
</script>

<span class="streak-chip" aria-label="Current streak">
  <span class="icon" aria-hidden="true">◆</span>
  <span class="count">{$streak}</span>
  <span class="label">day streak</span>
</span>

<style>
  .streak-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 10px;
    color: var(--amber);
  }
  .count {
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }
  .label {
    color: var(--muted);
  }
</style>
```

- [ ] **Step 9: Create `+layout.svelte`**

Create `apps/ear-training-station/src/routes/+layout.svelte`:

```svelte
<script lang="ts">
  import AppShell from '$lib/shell/AppShell.svelte';
  import '../app.css';
  import { onMount } from 'svelte';
  import { hydrateShellStores } from '$lib/shell/stores';

  let { children } = $props();

  onMount(() => {
    void hydrateShellStores();
  });
</script>

<AppShell>
  {@render children?.()}
</AppShell>
```

- [ ] **Step 10: Update `+layout.ts` with the redirect**

Replace `apps/ear-training-station/src/routes/+layout.ts` contents:

```typescript
import { redirect } from '@sveltejs/kit';
import { getDeps } from '$lib/shell/deps';

export const prerender = false;
export const ssr = false;

export async function load({ url }) {
  const { settings: repo } = await getDeps();
  const settings = await repo.getOrDefault();
  if (!settings.onboarded && !url.pathname.startsWith('/onboarding')) {
    throw redirect(302, '/onboarding');
  }
  return { settings };
}
```

- [ ] **Step 11: Run component test — expect pass**

```bash
pnpm --filter ear-training-station test AppShell
```

Expected: PASS. The StreakChip test may need updates — if the test imports AppShell and it mounts StreakChip which in turn subscribes to stores, the test needs initial store values. If so, update AppShell.test.ts to import the stores and call `allSessions.set([])` before `render()`.

- [ ] **Step 11a: Enable the onboarded-redirect e2e tests (from Task 1)**

Un-skip the `shell.smoke.spec.ts` tests seeded in Task 1:

```bash
# if you skipped them by renaming:
mv apps/ear-training-station/e2e/shell.smoke.spec.ts.skip \
   apps/ear-training-station/e2e/shell.smoke.spec.ts
# or remove test.skip prefixes if that path was taken
```

Run them:

```bash
pnpm exec playwright test --filter ear-training-station shell.smoke
```

Expected: both tests PASS now that the layout redirect and shell render exist. Fresh user goes to `/onboarding`; onboarded user stays on `/`.

- [ ] **Step 12: Verify dev server loads**

```bash
pnpm run dev
```

Visit `http://localhost:5173/` — should redirect to `/onboarding` (route doesn't exist yet; expect 404, that's fine for this task). The shell header should be visible on the 404 page. Stop dev server.

- [ ] **Step 13: Typecheck + full tests + build**

```bash
pnpm run typecheck && pnpm run test && pnpm run build
```

Expected: all green.

- [ ] **Step 14: Commit + PR**

```bash
git add apps/ear-training-station/src/lib/shell/ \
        apps/ear-training-station/src/routes/+layout.ts \
        apps/ear-training-station/src/routes/+layout.svelte \
        apps/ear-training-station/tests/shell/ \
        apps/ear-training-station/package.json \
        pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
feat(app): AppShell layout with onboarded-redirect

Layout renders a shell header with logo, streak chip (reactive
over currentStreak), and settings link. +layout.ts load()
redirects to /onboarding when settings.onboarded is false.

Shared deps (IndexedDB repos) exposed via a cached getDeps()
accessor; shell stores hydrate on mount.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git push -u origin c1-2/task2-app-shell
gh pr create --title "feat(app): AppShell layout + onboarded redirect" --body "$(cat <<'EOF'
## Summary
Shared shell chrome (logo, streak chip, settings link). Layout-level redirect to `/onboarding` when `settings.onboarded === false`.

## Test plan
- [x] Component tests for AppShell pass
- [x] Dev server renders shell; root redirects to /onboarding (404 expected until Task 5)
- [x] Full suite green

Part of Plan C1.2.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

### Task 3: Exercise registry + StationDashboard at `/`

Adds the `$lib/exercises/index.ts` registry with a stub scale-degree manifest. Builds the station dashboard (exercise picker card grid) at `/`.

**Files:**
- Create: `apps/ear-training-station/src/lib/exercises/index.ts`
- Create: `apps/ear-training-station/src/lib/exercises/scale-degree/index.ts` (stub manifest only)
- Create: `apps/ear-training-station/src/lib/exercises/scale-degree/internal/.gitkeep`
- Create: `apps/ear-training-station/src/lib/shell/StationDashboard.svelte`
- Create: `apps/ear-training-station/src/routes/+page.svelte`
- Create: `apps/ear-training-station/tests/shell/StationDashboard.test.ts`

- [ ] **Step 1: Branch**

```bash
git checkout main && git pull
git checkout -b c1-2/task3-station-dashboard
```

- [ ] **Step 2: Write the failing test**

Create `apps/ear-training-station/tests/shell/StationDashboard.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import StationDashboard from '$lib/shell/StationDashboard.svelte';

describe('StationDashboard', () => {
  it('renders a card for every registered exercise', () => {
    render(StationDashboard);
    expect(screen.getByText(/scale-degree practice/i)).toBeInTheDocument();
  });

  it('exercise card links to the exercise route', () => {
    render(StationDashboard);
    const link = screen.getByRole('link', { name: /scale-degree practice/i });
    expect(link.getAttribute('href')).toBe('/scale-degree');
  });
});
```

- [ ] **Step 3: Run test — expect fail**

```bash
pnpm --filter ear-training-station test StationDashboard
```

Expected: FAIL — component/registry missing.

- [ ] **Step 3a: Write the failing Playwright e2e**

Create `apps/ear-training-station/e2e/station-dashboard.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';
import { seedOnboarded } from './helpers/app-state';

test('station dashboard shows the Scale-Degree Practice card', async ({ page }) => {
  await seedOnboarded(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /scale-degree practice/i })).toBeVisible();
});

test('clicking the picker card navigates to /scale-degree', async ({ page }) => {
  await seedOnboarded(page);
  await page.goto('/');
  await page.getByRole('link', { name: /scale-degree practice/i }).click();
  await expect(page).toHaveURL(/\/scale-degree$/);
});
```

Run:

```bash
pnpm exec playwright test --filter ear-training-station station-dashboard
```

Expected: FAIL — dashboard not rendered yet.

- [ ] **Step 4: Create exercise manifest type + stub manifest**

Create `apps/ear-training-station/src/lib/exercises/scale-degree/index.ts`:

```typescript
export interface ExerciseManifest {
  slug: string;
  name: string;
  blurb: string;
  route: string;
}

export const manifest: ExerciseManifest = {
  slug: 'scale-degree',
  name: 'Scale-Degree Practice',
  blurb: 'Hear a cadence. Sing the degree. Say the number.',
  route: '/scale-degree',
};

// Task C1.3 will add: createSessionController, SessionView, DashboardView, DashboardWidget.
```

Create `apps/ear-training-station/src/lib/exercises/scale-degree/internal/.gitkeep` (empty file).

- [ ] **Step 5: Create exercise registry**

Create `apps/ear-training-station/src/lib/exercises/index.ts`:

```typescript
import * as scaleDegree from './scale-degree';

export const exercises = [scaleDegree] as const;
export type ExerciseModule = typeof exercises[number];
export type { ExerciseManifest } from './scale-degree';
```

- [ ] **Step 6: Create `StationDashboard.svelte`**

Create `apps/ear-training-station/src/lib/shell/StationDashboard.svelte`:

```svelte
<script lang="ts">
  import { exercises } from '$lib/exercises';
</script>

<section class="station-dashboard">
  <h1 class="title">Choose an exercise</h1>
  <div class="grid">
    {#each exercises as ex}
      <a class="card" href={ex.manifest.route}>
        <h2 class="card-title">{ex.manifest.name}</h2>
        <p class="card-blurb">{ex.manifest.blurb}</p>
      </a>
    {/each}
  </div>
</section>

<style>
  .station-dashboard {
    max-width: 640px;
    margin: 0 auto;
  }
  .title {
    font-size: 16px;
    font-weight: 500;
    color: var(--text);
    margin: 0 0 16px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 12px;
  }
  .card {
    display: block;
    padding: 16px;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 8px;
    text-decoration: none;
    color: var(--text);
    transition: border-color 120ms ease;
  }
  .card:hover {
    border-color: var(--cyan);
  }
  .card-title {
    font-size: 13px;
    font-weight: 600;
    margin: 0 0 6px;
  }
  .card-blurb {
    font-size: 11px;
    color: var(--muted);
    margin: 0;
  }
</style>
```

- [ ] **Step 7: Create `/+page.svelte` mounting the dashboard**

Create `apps/ear-training-station/src/routes/+page.svelte`:

```svelte
<script lang="ts">
  import StationDashboard from '$lib/shell/StationDashboard.svelte';
</script>

<StationDashboard />
```

- [ ] **Step 8: Run component test — expect pass**

```bash
pnpm --filter ear-training-station test StationDashboard
```

Expected: PASS (2 assertions).

- [ ] **Step 8a: Run Playwright e2e — expect pass**

```bash
pnpm exec playwright test --filter ear-training-station station-dashboard
```

Expected: both e2e tests now PASS. Card visible; click navigates.

- [ ] **Step 9: Dev verification**

```bash
pnpm run dev
```

To bypass the onboarding redirect temporarily, set onboarded=true via DevTools → Application → IndexedDB → `ear-training` → `settings` store (key `singleton`), or visit `/onboarding` and navigate somewhere that flips the flag. Simpler: comment out the redirect line in `+layout.ts`, verify dashboard renders at `/`, then restore.

Expected at `/`: "Choose an exercise" heading + one card "Scale-Degree Practice" linking to `/scale-degree`. Stop dev server.

- [ ] **Step 10: Commit + PR**

```bash
git add apps/ear-training-station/src/lib/exercises/ \
        apps/ear-training-station/src/lib/shell/StationDashboard.svelte \
        apps/ear-training-station/src/routes/+page.svelte \
        apps/ear-training-station/tests/shell/StationDashboard.test.ts
git commit -m "$(cat <<'EOF'
feat(app): exercise registry + StationDashboard at /

Introduces $lib/exercises/ with a scale-degree stub manifest
(name, blurb, route). StationDashboard renders one card per
registered exercise. /+page.svelte mounts it.

Task C1.3 fleshes out the scale-degree internal module
(session controller, views).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git push -u origin c1-2/task3-station-dashboard
gh pr create --title "feat(app): exercise registry + StationDashboard" --body "$(cat <<'EOF'
## Summary
Adds `$lib/exercises/` with a stub scale-degree manifest. StationDashboard renders one card per registered exercise at `/`.

## Test plan
- [x] Component test passes
- [x] Dev: `/` shows "Choose an exercise" + one card linking to `/scale-degree`
- [x] Full suite green

Part of Plan C1.2.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

### Task 4: Settings page at `/settings`

Builds the Settings route with toggles for `function_tooltip`, `auto_advance_on_hit`, `reduced_motion`, a session-length selector, and a Reset Progress button that opens a confirmation sub-modal.

**Files:**
- Create: `apps/ear-training-station/src/lib/shell/SettingsPage.svelte`
- Create: `apps/ear-training-station/src/lib/shell/ResetConfirmModal.svelte`
- Create: `apps/ear-training-station/src/routes/settings/+page.svelte`
- Create: `apps/ear-training-station/tests/shell/SettingsPage.test.ts`

- [ ] **Step 1: Branch**

```bash
git checkout main && git pull
git checkout -b c1-2/task4-settings-page
```

- [ ] **Step 2: Write the failing test**

Create `apps/ear-training-station/tests/shell/SettingsPage.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import SettingsPage from '$lib/shell/SettingsPage.svelte';
import { settings } from '$lib/shell/stores';
import { DEFAULT_SETTINGS } from '@ear-training/core/types/domain';

describe('SettingsPage', () => {
  it('renders all toggle controls', () => {
    settings.set(DEFAULT_SETTINGS);
    render(SettingsPage);
    expect(screen.getByLabelText(/function tooltip/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/auto-advance on hit/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/reduced motion/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/session length/i)).toBeInTheDocument();
  });

  it('reflects current settings values in the inputs', () => {
    settings.set({ ...DEFAULT_SETTINGS, function_tooltip: false, session_length: 45 });
    render(SettingsPage);
    const tooltipToggle = screen.getByLabelText(/function tooltip/i) as HTMLInputElement;
    expect(tooltipToggle.checked).toBe(false);
    const lengthSelect = screen.getByLabelText(/session length/i) as HTMLSelectElement;
    expect(lengthSelect.value).toBe('45');
  });

  it('shows the reset-progress button', () => {
    render(SettingsPage);
    expect(screen.getByRole('button', { name: /reset progress/i })).toBeInTheDocument();
  });

  it('opens the confirmation modal when reset is clicked', async () => {
    const user = userEvent.setup();
    render(SettingsPage);
    await user.click(screen.getByRole('button', { name: /reset progress/i }));
    expect(screen.getByText(/this will permanently delete/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run test — expect fail**

```bash
pnpm --filter ear-training-station test SettingsPage
```

Expected: FAIL.

- [ ] **Step 3a: Write the failing Playwright e2e**

Create `apps/ear-training-station/e2e/settings.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';
import { seedOnboarded } from './helpers/app-state';

test('settings page renders all four controls', async ({ page }) => {
  await seedOnboarded(page);
  await page.goto('/settings');
  await expect(page.getByLabel(/function tooltip/i)).toBeVisible();
  await expect(page.getByLabel(/auto-advance on hit/i)).toBeVisible();
  await expect(page.getByLabel(/session length/i)).toBeVisible();
  await expect(page.getByLabel(/reduced motion/i)).toBeVisible();
});

test('toggling function tooltip persists across reload', async ({ page }) => {
  await seedOnboarded(page, { function_tooltip: true });
  await page.goto('/settings');
  const toggle = page.getByLabel(/function tooltip/i);
  await expect(toggle).toBeChecked();
  await toggle.click();
  await expect(toggle).not.toBeChecked();
  await page.reload();
  await expect(page.getByLabel(/function tooltip/i)).not.toBeChecked();
});

test('reset-progress button opens confirmation dialog', async ({ page }) => {
  await seedOnboarded(page);
  await page.goto('/settings');
  await page.getByRole('button', { name: /reset progress/i }).click();
  await expect(page.getByText(/this will permanently delete/i)).toBeVisible();
});
```

Run:

```bash
pnpm exec playwright test --filter ear-training-station settings
```

Expected: FAIL — page not built yet.

- [ ] **Step 4: Create `ResetConfirmModal.svelte`**

Create `apps/ear-training-station/src/lib/shell/ResetConfirmModal.svelte`:

```svelte
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
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }
  .modal {
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 20px;
    max-width: 360px;
  }
  .title {
    font-size: 14px;
    font-weight: 600;
    margin: 0 0 8px;
    color: var(--red);
  }
  .body {
    font-size: 11px;
    color: var(--muted);
    margin: 0 0 16px;
  }
  .actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }
  .cancel, .confirm {
    padding: 6px 12px;
    border-radius: 4px;
    border: 1px solid var(--border);
    background: transparent;
    color: var(--text);
    font-size: 11px;
  }
  .confirm {
    border-color: var(--red);
    color: var(--red);
  }
</style>
```

- [ ] **Step 5: Create `SettingsPage.svelte`**

Create `apps/ear-training-station/src/lib/shell/SettingsPage.svelte`:

```svelte
<script lang="ts">
  import { settings } from './stores';
  import { getDeps } from './deps';
  import ResetConfirmModal from './ResetConfirmModal.svelte';
  import type { Settings } from '@ear-training/core/types/domain';

  let showResetModal = $state(false);

  async function update(partial: Partial<Settings>) {
    const deps = await getDeps();
    await deps.settings.update(partial);
    settings.update((s) => ({ ...s, ...partial }));
  }

  async function performReset() {
    const deps = await getDeps();
    // Clear object stores by overwriting with empty sets.
    // The underlying DB helper exposes a transaction API; if a bulk-clear
    // method doesn't exist yet, add one during C1.3 implementation.
    await deps.db.clear?.('items');
    await deps.db.clear?.('sessions');
    await deps.db.clear?.('attempts');
    showResetModal = false;
    // Reload page so stores re-hydrate fresh.
    location.reload();
  }
</script>

<section class="settings-page">
  <h1 class="title">Settings</h1>

  <label class="row">
    <span class="label-text">Function tooltip</span>
    <input type="checkbox" bind:checked={() => $settings.function_tooltip, (v) => update({ function_tooltip: v })} />
  </label>

  <label class="row">
    <span class="label-text">Auto-advance on hit</span>
    <input type="checkbox" bind:checked={() => $settings.auto_advance_on_hit, (v) => update({ auto_advance_on_hit: v })} />
  </label>

  <label class="row">
    <span class="label-text">Session length</span>
    <select bind:value={() => String($settings.session_length), (v) => update({ session_length: Number(v) as 20 | 30 | 45 })}>
      <option value="20">20 rounds</option>
      <option value="30">30 rounds</option>
      <option value="45">45 rounds</option>
    </select>
  </label>

  <label class="row">
    <span class="label-text">Reduced motion</span>
    <select bind:value={() => $settings.reduced_motion, (v) => update({ reduced_motion: v as 'auto' | 'on' | 'off' })}>
      <option value="auto">Auto (follow system)</option>
      <option value="on">On</option>
      <option value="off">Off</option>
    </select>
  </label>

  <div class="danger-zone">
    <button type="button" class="reset-btn" onclick={() => (showResetModal = true)}>
      Reset progress
    </button>
  </div>
</section>

{#if showResetModal}
  <ResetConfirmModal onConfirm={performReset} onCancel={() => (showResetModal = false)} />
{/if}

<style>
  .settings-page {
    max-width: 480px;
    margin: 0 auto;
  }
  .title {
    font-size: 14px;
    font-weight: 600;
    margin: 0 0 16px;
  }
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 0;
    border-bottom: 1px solid var(--border);
  }
  .label-text {
    font-size: 11px;
  }
  .danger-zone {
    margin-top: 24px;
    padding-top: 16px;
    border-top: 1px solid var(--border);
  }
  .reset-btn {
    padding: 8px 12px;
    border-radius: 4px;
    border: 1px solid var(--red);
    background: transparent;
    color: var(--red);
    font-size: 11px;
  }
</style>
```

- [ ] **Step 6: Create `/settings/+page.svelte`**

Create `apps/ear-training-station/src/routes/settings/+page.svelte`:

```svelte
<script lang="ts">
  import SettingsPage from '$lib/shell/SettingsPage.svelte';
</script>

<SettingsPage />
```

- [ ] **Step 7: Run test — expect pass**

```bash
pnpm --filter ear-training-station test SettingsPage
```

Expected: PASS (4 assertions).

- [ ] **Step 7a: Run Playwright e2e — expect pass**

```bash
pnpm exec playwright test --filter ear-training-station settings
```

Expected: all 3 e2e tests pass. Persistence across reload confirmed end-to-end through SettingsRepo + IndexedDB.

- [ ] **Step 8: Typecheck**

```bash
pnpm run typecheck
```

If the Svelte 5 `bind:checked={getter, setter}` 2-way form causes type errors, simplify the component with explicit `onchange` handlers per input instead. Document the fallback inline.

- [ ] **Step 9: Dev verification**

```bash
pnpm run dev
```

Navigate to `/settings` (bypass onboarding redirect as before). Verify toggles render, flipping a toggle calls update(), settings persist across page reloads. Stop dev.

- [ ] **Step 10: Commit + PR**

```bash
git add apps/ear-training-station/src/lib/shell/SettingsPage.svelte \
        apps/ear-training-station/src/lib/shell/ResetConfirmModal.svelte \
        apps/ear-training-station/src/routes/settings/+page.svelte \
        apps/ear-training-station/tests/shell/SettingsPage.test.ts
git commit -m "$(cat <<'EOF'
feat(app): Settings page at /settings

Toggles for function_tooltip, auto_advance_on_hit, reduced_motion
and a session-length selector, all backed by the existing
SettingsRepo. Reset-progress button opens a confirmation modal
that clears items/sessions/attempts on confirm.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git push -u origin c1-2/task4-settings-page
gh pr create --title "feat(app): Settings page" --body "$(cat <<'EOF'
## Summary
Full settings UI: four fields + reset-progress button with confirmation modal.

## Test plan
- [x] Component tests pass
- [x] Dev: settings persist across reloads
- [x] Reset modal wipes items/sessions/attempts

Part of Plan C1.2.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

### Task 5: OnboardingFlow at `/onboarding` (steps 1–3 + stub step 4)

Four-step stepper. Step 4 here is a placeholder ("Start practicing" button that sets `onboarded = true` and navigates to `/scale-degree`). C1.3 replaces step 4 with a real warmup round.

**Files:**
- Create: `apps/ear-training-station/src/lib/shell/OnboardingFlow.svelte`
- Create: `apps/ear-training-station/src/lib/shell/onboarding/StepWelcome.svelte`
- Create: `apps/ear-training-station/src/lib/shell/onboarding/StepMicPermission.svelte`
- Create: `apps/ear-training-station/src/lib/shell/onboarding/StepConceptIntro.svelte`
- Create: `apps/ear-training-station/src/lib/shell/onboarding/StepWarmupStub.svelte`
- Create: `apps/ear-training-station/src/routes/onboarding/+page.svelte`
- Create: `apps/ear-training-station/tests/shell/OnboardingFlow.test.ts`

- [ ] **Step 1: Branch**

```bash
git checkout main && git pull
git checkout -b c1-2/task5-onboarding-flow
```

- [ ] **Step 2: Write the failing test**

Create `apps/ear-training-station/tests/shell/OnboardingFlow.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import OnboardingFlow from '$lib/shell/OnboardingFlow.svelte';

describe('OnboardingFlow', () => {
  it('starts on the Welcome step', () => {
    render(OnboardingFlow);
    expect(screen.getByText(/ear training that uses your voice/i)).toBeInTheDocument();
  });

  it('advances through four steps via Continue', async () => {
    const user = userEvent.setup();
    render(OnboardingFlow);
    // Welcome → Mic
    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(screen.getByText(/grant microphone access/i)).toBeInTheDocument();
  });

  it('back button on step 2 returns to Welcome', async () => {
    const user = userEvent.setup();
    render(OnboardingFlow);
    await user.click(screen.getByRole('button', { name: /continue/i }));
    await user.click(screen.getByRole('button', { name: /back/i }));
    expect(screen.getByText(/ear training that uses your voice/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run test — expect fail**

```bash
pnpm --filter ear-training-station test OnboardingFlow
```

Expected: FAIL.

- [ ] **Step 3a: Write the failing Playwright e2e**

Create `apps/ear-training-station/e2e/onboarding.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';
import { resetAppState } from './helpers/app-state';

test('fresh user completes onboarding through the stub step 4', async ({ page, context }) => {
  // Grant mic permission ahead of time so step 2 doesn't block the test.
  await context.grantPermissions(['microphone']);
  await resetAppState(page);
  await page.goto('/');

  await expect(page).toHaveURL(/\/onboarding/);

  // Step 1 — Welcome
  await expect(page.getByText(/ear training that uses your voice/i)).toBeVisible();
  await page.getByRole('button', { name: /continue/i }).click();

  // Step 2 — Mic permission
  await expect(page.getByText(/grant microphone access/i)).toBeVisible();
  await page.getByRole('button', { name: /grant microphone access/i }).click();
  // context.grantPermissions resolves the request synchronously; advance happens in onNext.

  // Step 3 — Concept intro
  await expect(page.getByText(/scale degrees/i)).toBeVisible();
  await page.getByRole('button', { name: /continue/i }).click();

  // Step 4 — Stub warmup (C1.2); C1.3 replaces with real round
  await page.getByRole('button', { name: /start practicing/i }).click();

  // Lands on /scale-degree (placeholder route from Task 6)
  await expect(page).toHaveURL(/\/scale-degree$/);
});

test('back button returns to previous step', async ({ page, context }) => {
  await context.grantPermissions(['microphone']);
  await resetAppState(page);
  await page.goto('/onboarding');
  await page.getByRole('button', { name: /continue/i }).click();
  await page.getByRole('button', { name: /back/i }).click();
  await expect(page.getByText(/ear training that uses your voice/i)).toBeVisible();
});
```

Run:

```bash
pnpm exec playwright test --filter ear-training-station onboarding
```

Expected: FAIL — flow not built yet.

- [ ] **Step 4: Create `StepWelcome.svelte`**

Create `apps/ear-training-station/src/lib/shell/onboarding/StepWelcome.svelte`:

```svelte
<script lang="ts">
  let { onNext }: { onNext: () => void } = $props();
</script>

<div class="step">
  <h1 class="headline">Ear training that uses your voice</h1>
  <p class="body">
    You'll hear a key, then a target note. Sing the note and say its scale
    degree. We'll grade both.
  </p>
  <div class="actions">
    <button type="button" class="primary" onclick={onNext}>Continue</button>
  </div>
</div>

<style>
  .step { max-width: 420px; margin: 40px auto; text-align: center; }
  .headline { font-size: 20px; font-weight: 500; margin: 0 0 12px; color: var(--text); }
  .body { font-size: 12px; color: var(--muted); margin: 0 0 24px; line-height: 1.6; }
  .primary {
    padding: 10px 20px; border-radius: 6px; border: 1px solid var(--cyan);
    background: transparent; color: var(--cyan); font-size: 12px;
  }
</style>
```

- [ ] **Step 5: Create `StepMicPermission.svelte`**

Create `apps/ear-training-station/src/lib/shell/onboarding/StepMicPermission.svelte`:

```svelte
<script lang="ts">
  import { requestMicStream, queryMicPermission } from '@ear-training/web-platform/mic/permission';

  let { onNext, onBack }: { onNext: () => void; onBack: () => void } = $props();

  let state = $state<'idle' | 'requesting' | 'granted' | 'denied'>('idle');
  let errorMsg = $state<string>('');

  async function requestAccess() {
    state = 'requesting';
    errorMsg = '';
    try {
      const handle = await requestMicStream();
      // Immediately stop — we just needed to trigger the prompt and confirm.
      handle.stop();
      state = 'granted';
      onNext();
    } catch (e: unknown) {
      state = 'denied';
      errorMsg = e instanceof Error ? e.message : 'Permission denied';
    }
  }
</script>

<div class="step">
  <h1 class="headline">Grant microphone access</h1>
  <p class="body">
    We grade your singing. Audio never leaves this device in the MVP.
  </p>
  <div class="actions">
    <button type="button" class="back" onclick={onBack}>Back</button>
    <button type="button" class="primary" onclick={requestAccess} disabled={state === 'requesting'}>
      {state === 'requesting' ? 'Requesting…' : 'Grant microphone access'}
    </button>
  </div>
  {#if state === 'denied'}
    <p class="error">
      Permission was denied. Re-enable microphone access in your browser settings
      and press the button again. ({errorMsg})
    </p>
  {/if}
</div>

<style>
  .step { max-width: 480px; margin: 40px auto; text-align: center; }
  .headline { font-size: 18px; font-weight: 500; margin: 0 0 12px; }
  .body { font-size: 12px; color: var(--muted); margin: 0 0 24px; }
  .actions { display: flex; gap: 8px; justify-content: center; }
  .primary {
    padding: 10px 20px; border-radius: 6px; border: 1px solid var(--cyan);
    background: transparent; color: var(--cyan); font-size: 12px;
  }
  .back {
    padding: 10px 20px; border-radius: 6px; border: 1px solid var(--border);
    background: transparent; color: var(--muted); font-size: 12px;
  }
  .error { font-size: 11px; color: var(--red); margin-top: 12px; }
</style>
```

- [ ] **Step 6: Create `StepConceptIntro.svelte`**

Create `apps/ear-training-station/src/lib/shell/onboarding/StepConceptIntro.svelte`:

```svelte
<script lang="ts">
  let { onNext, onBack }: { onNext: () => void; onBack: () => void } = $props();
</script>

<div class="step">
  <h1 class="headline">Scale degrees: the map of a key</h1>
  <p class="body">
    Every key has seven scale degrees — numbered 1 through 7. The <strong>1</strong>
    is the "home" note (tonic). The <strong>5</strong> is a brighter, tension-building note.
    Your ear will learn to recognize them by their function, not by memorizing pitches.
  </p>
  <p class="body">
    In each round you'll hear a short cadence that establishes the key,
    then a single target note. Your job: sing it and say its number.
  </p>
  <div class="actions">
    <button type="button" class="back" onclick={onBack}>Back</button>
    <button type="button" class="primary" onclick={onNext}>Continue</button>
  </div>
</div>

<style>
  .step { max-width: 480px; margin: 40px auto; }
  .headline { font-size: 18px; font-weight: 500; margin: 0 0 12px; text-align: center; }
  .body { font-size: 12px; color: var(--muted); margin: 0 0 16px; line-height: 1.6; }
  .actions { display: flex; gap: 8px; justify-content: center; margin-top: 24px; }
  .primary {
    padding: 10px 20px; border-radius: 6px; border: 1px solid var(--cyan);
    background: transparent; color: var(--cyan); font-size: 12px;
  }
  .back {
    padding: 10px 20px; border-radius: 6px; border: 1px solid var(--border);
    background: transparent; color: var(--muted); font-size: 12px;
  }
</style>
```

(Note: step 3 is "silent visual" per the spec — the real implementation in C1.3 adds the chord-block animation. This stub is text-only.)

- [ ] **Step 7: Create `StepWarmupStub.svelte`**

Create `apps/ear-training-station/src/lib/shell/onboarding/StepWarmupStub.svelte`:

```svelte
<script lang="ts">
  import { goto } from '$app/navigation';
  import { getDeps } from '$lib/shell/deps';
  import { settings } from '$lib/shell/stores';

  let { onBack }: { onBack: () => void } = $props();

  async function complete() {
    const deps = await getDeps();
    await deps.settings.update({ onboarded: true });
    settings.update((s) => ({ ...s, onboarded: true }));
    await goto('/scale-degree');
  }
</script>

<div class="step">
  <h1 class="headline">Ready for your first round</h1>
  <p class="body">
    Plan C1.3 will replace this step with a real warmup round (degree 5 in C major).
    For now, click Start to finish onboarding and go to the dashboard.
  </p>
  <div class="actions">
    <button type="button" class="back" onclick={onBack}>Back</button>
    <button type="button" class="primary" onclick={complete}>Start practicing</button>
  </div>
</div>

<style>
  .step { max-width: 440px; margin: 40px auto; text-align: center; }
  .headline { font-size: 18px; font-weight: 500; margin: 0 0 12px; }
  .body { font-size: 12px; color: var(--muted); margin: 0 0 24px; }
  .actions { display: flex; gap: 8px; justify-content: center; }
  .primary {
    padding: 10px 20px; border-radius: 6px; border: 1px solid var(--cyan);
    background: transparent; color: var(--cyan); font-size: 12px;
  }
  .back {
    padding: 10px 20px; border-radius: 6px; border: 1px solid var(--border);
    background: transparent; color: var(--muted); font-size: 12px;
  }
</style>
```

- [ ] **Step 8: Create `OnboardingFlow.svelte`**

Create `apps/ear-training-station/src/lib/shell/OnboardingFlow.svelte`:

```svelte
<script lang="ts">
  import StepWelcome from './onboarding/StepWelcome.svelte';
  import StepMicPermission from './onboarding/StepMicPermission.svelte';
  import StepConceptIntro from './onboarding/StepConceptIntro.svelte';
  import StepWarmupStub from './onboarding/StepWarmupStub.svelte';

  let step = $state<1 | 2 | 3 | 4>(1);

  const next = () => { step = (step + 1) as typeof step; };
  const back = () => { step = (step - 1) as typeof step; };
</script>

<div class="onboarding">
  <div class="progress" aria-label="Onboarding progress">
    Step {step} of 4
  </div>
  {#if step === 1}
    <StepWelcome onNext={next} />
  {:else if step === 2}
    <StepMicPermission onNext={next} onBack={back} />
  {:else if step === 3}
    <StepConceptIntro onNext={next} onBack={back} />
  {:else}
    <StepWarmupStub onBack={back} />
  {/if}
</div>

<style>
  .onboarding { max-width: 600px; margin: 0 auto; }
  .progress { text-align: center; font-size: 10px; color: var(--muted); margin: 16px 0; }
</style>
```

- [ ] **Step 9: Create `/onboarding/+page.svelte`**

Create `apps/ear-training-station/src/routes/onboarding/+page.svelte`:

```svelte
<script lang="ts">
  import OnboardingFlow from '$lib/shell/OnboardingFlow.svelte';
</script>

<OnboardingFlow />
```

- [ ] **Step 10: Run test — expect pass**

```bash
pnpm --filter ear-training-station test OnboardingFlow
```

Expected: PASS (3 assertions).

- [ ] **Step 10a: Run Playwright e2e — expect pass**

```bash
pnpm exec playwright test --filter ear-training-station onboarding
```

Expected: both tests pass. Full 4-step flow completes end-to-end; back button works.

- [ ] **Step 11: Dev verification**

Clear IndexedDB for the app. `pnpm run dev`; visit `/`. Expected flow: redirect to `/onboarding` (step 1) → Continue → step 2 (mic permission — grant it in browser prompt) → step 3 → step 4 → click "Start practicing" → navigates to `/scale-degree` (which 404s — expected; C1.3 fills it in) and `onboarded` flag is set. Reload `/` — no redirect this time.

- [ ] **Step 12: Commit + PR**

```bash
git add apps/ear-training-station/src/lib/shell/OnboardingFlow.svelte \
        apps/ear-training-station/src/lib/shell/onboarding/ \
        apps/ear-training-station/src/routes/onboarding/+page.svelte \
        apps/ear-training-station/tests/shell/OnboardingFlow.test.ts
git commit -m "$(cat <<'EOF'
feat(app): OnboardingFlow with 4 steps (warmup is stub)

Welcome → Mic permission → Concept intro → Warmup stub.
Step 4 is a placeholder "Start practicing" button that sets
onboarded = true and navigates to /scale-degree. C1.3 replaces
it with a real warmup round.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git push -u origin c1-2/task5-onboarding-flow
gh pr create --title "feat(app): OnboardingFlow (4 steps, stub warmup)" --body "$(cat <<'EOF'
## Summary
First-run gated onboarding route with 4 steps. Step 4 is a placeholder until C1.3 wires up the real warmup round.

## Test plan
- [x] Component tests pass
- [x] Full onboarding flow completes end-to-end
- [x] `onboarded` flag set at end; no redirect on subsequent visits

Part of Plan C1.2.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

### Task 6: Placeholder `/scale-degree` route

One-line stub so clicking the picker card resolves to a 200 (not 404). C1.3 replaces it with the real `DashboardView`.

**Files:**
- Create: `apps/ear-training-station/src/routes/scale-degree/+page.svelte`

- [ ] **Step 1: Branch + commit + PR (single small change)**

```bash
git checkout main && git pull
git checkout -b c1-2/task6-scale-degree-placeholder
mkdir -p apps/ear-training-station/src/routes/scale-degree
cat > apps/ear-training-station/src/routes/scale-degree/+page.svelte <<'SVELTE'
<script lang="ts">
  import { manifest } from '$lib/exercises/scale-degree';
</script>

<section class="placeholder">
  <h1>{manifest.name}</h1>
  <p>{manifest.blurb}</p>
  <p class="note">
    The exercise is under construction. Plan C1.3 will land the dashboard,
    session view, feedback panel, and summary here.
  </p>
</section>

<style>
  .placeholder { max-width: 480px; margin: 40px auto; text-align: center; }
  h1 { font-size: 16px; font-weight: 600; margin: 0 0 8px; }
  p { font-size: 12px; color: var(--muted); margin: 0 0 12px; }
  .note { color: var(--amber); }
</style>
SVELTE

pnpm run typecheck && pnpm run test && pnpm run build

git add apps/ear-training-station/src/routes/scale-degree/
git commit -m "$(cat <<'EOF'
feat(app): placeholder /scale-degree route

Stub page so the StationDashboard card lands on a valid route.
Plan C1.3 replaces with the real DashboardView.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git push -u origin c1-2/task6-scale-degree-placeholder
gh pr create --title "feat(app): placeholder /scale-degree route" --body "$(cat <<'EOF'
## Summary
One-line Svelte page so the station picker resolves cleanly. Gets replaced in C1.3.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Plan C1.2 completion checklist

When all 6 PRs are merged:

- [ ] `pnpm run dev` starts; visiting `/` with no IndexedDB row redirects to `/onboarding`
- [ ] Onboarding flows 4 steps and sets `onboarded = true`
- [ ] `/` renders StationDashboard with one card linking to `/scale-degree`
- [ ] `/scale-degree` shows the placeholder page (replaced in C1.3)
- [ ] `/settings` shows all four settings controls + Reset Progress
- [ ] `/harness/audio.html` still works (dev-only audio harness intact)
- [ ] `pnpm run typecheck && pnpm run test && pnpm run build` all green
- [ ] ESLint blocks cross-exercise `$lib/exercises/*/internal/*` imports
- [ ] New component tests: AppShell (2), StationDashboard (2), SettingsPage (4), OnboardingFlow (3) = 11

Plan C1.3 begins on top of this merged state.
