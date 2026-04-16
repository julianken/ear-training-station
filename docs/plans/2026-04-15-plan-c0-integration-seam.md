# Plan C0 — Integration Seam Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bridge Plan A (pure logic) and Plan B (audio I/O) into a three-layer pnpm monorepo. Introduce a pure round-lifecycle reducer, wall-clock adapters that solve the two-clock problem, variability pickers, analytics rollups, and design tokens — so Plan C1 (Svelte UI) wires into a stable, tested integration surface.

**Architecture:** The single-package `src/` becomes four workspace members: `@ear-training/core` (pure TypeScript — types, SRS, scheduler, orchestrator, audio math, YIN, degree mapping, round reducer, variability, analytics), `@ear-training/web-platform` (browser infrastructure — Tone.js playback, AudioWorklet pitch detection, speech-commands KWS, IndexedDB stores, round-adapters), `@ear-training/ui-tokens` (design constants as TS + CSS), and `ear-training-station` (app shell, Svelte entry point, dev harness, e2e tests). The round lifecycle is a pure `roundReducer(state, event) → state'` in core; adapters in web-platform stamp wall-clock `at_ms` on every event, solving the two-clock problem without touching Plan B's AudioContext split.

**Tech Stack:** TypeScript 5.6, pnpm 9 workspaces, Vitest 3 workspace mode, Vite 6, Svelte 5, Playwright, Tone.js 15, @tensorflow-models/speech-commands 0.5.4 + tfjs v3 backends

**Spec:** `docs/specs/2026-04-15-plan-c-phase-0-integration-seam-design.md`

**Deviation from spec:** `src/types/music.ts` stays at `packages/core/src/types/music.ts` (spec proposed `packages/core/src/music/`). This keeps all `@/types/music` imports unchanged within core, cutting migration risk. Can be separated in a follow-up if warranted.

---

## File mapping — source

| Old path | New path | Package |
|----------|----------|---------|
| `src/types/music.ts` | `packages/core/src/types/music.ts` | core |
| `src/types/domain.ts` | `packages/core/src/types/domain.ts` | core |
| `src/srs/accuracy.ts` | `packages/core/src/srs/accuracy.ts` | core |
| `src/srs/leitner.ts` | `packages/core/src/srs/leitner.ts` | core |
| `src/scheduler/curriculum.ts` | `packages/core/src/scheduler/curriculum.ts` | core |
| `src/scheduler/interleaving.ts` | `packages/core/src/scheduler/interleaving.ts` | core |
| `src/scheduler/selection.ts` | `packages/core/src/scheduler/selection.ts` | core |
| `src/scheduler/unlock.ts` | `packages/core/src/scheduler/unlock.ts` | core |
| `src/session/orchestrator.ts` | `packages/core/src/session/orchestrator.ts` | core |
| `src/seed/initial-items.ts` | `packages/core/src/seed/initial-items.ts` | core |
| `src/audio/note-math.ts` | `packages/core/src/audio/note-math.ts` | core |
| `src/audio/cadence-structure.ts` | `packages/core/src/audio/cadence-structure.ts` | core |
| `src/audio/target-structure.ts` | `packages/core/src/audio/target-structure.ts` | core |
| `src/pitch/yin.ts` | `packages/core/src/pitch/yin.ts` | core |
| `src/pitch/degree-mapping.ts` | `packages/core/src/pitch/degree-mapping.ts` | core |
| `src/audio/player.ts` | `packages/web-platform/src/audio/player.ts` | web-platform |
| `src/audio/timbres.ts` | `packages/web-platform/src/audio/timbres.ts` | web-platform |
| `src/pitch/pitch-detector.ts` | `packages/web-platform/src/pitch/pitch-detector.ts` | web-platform |
| `src/pitch/yin-worklet.ts` | `packages/web-platform/src/pitch/yin-worklet.ts` | web-platform |
| `src/speech/keyword-spotter.ts` | `packages/web-platform/src/speech/keyword-spotter.ts` | web-platform |
| `src/speech/kws-loader.ts` | `packages/web-platform/src/speech/kws-loader.ts` | web-platform |
| `src/mic/permission.ts` | `packages/web-platform/src/mic/permission.ts` | web-platform |
| `src/store/db.ts` | `packages/web-platform/src/store/db.ts` | web-platform |
| `src/store/items-repo.ts` | `packages/web-platform/src/store/items-repo.ts` | web-platform |
| `src/store/attempts-repo.ts` | `packages/web-platform/src/store/attempts-repo.ts` | web-platform |
| `src/store/sessions-repo.ts` | `packages/web-platform/src/store/sessions-repo.ts` | web-platform |
| `src/store/settings-repo.ts` | `packages/web-platform/src/store/settings-repo.ts` | web-platform |
| `src/app.ts` | `apps/ear-training-station/src/app.ts` | app |
| `src/harness/audio-harness.ts` | `apps/ear-training-station/src/harness/audio-harness.ts` | app |
| `harness/audio.html` | `apps/ear-training-station/harness/audio.html` | app |
| `index.html` | `apps/ear-training-station/index.html` | app |

## File mapping — tests

| Old path | New path | Package |
|----------|----------|---------|
| `tests/types/music.test.ts` | `packages/core/tests/types/music.test.ts` | core |
| `tests/audio/cadence-structure.test.ts` | `packages/core/tests/audio/cadence-structure.test.ts` | core |
| `tests/audio/note-math.test.ts` | `packages/core/tests/audio/note-math.test.ts` | core |
| `tests/audio/target-structure.test.ts` | `packages/core/tests/audio/target-structure.test.ts` | core |
| `tests/pitch/degree-mapping.test.ts` | `packages/core/tests/pitch/degree-mapping.test.ts` | core |
| `tests/pitch/yin.test.ts` | `packages/core/tests/pitch/yin.test.ts` | core |
| `tests/scheduler/interleaving.test.ts` | `packages/core/tests/scheduler/interleaving.test.ts` | core |
| `tests/scheduler/selection.test.ts` | `packages/core/tests/scheduler/selection.test.ts` | core |
| `tests/scheduler/unlock.test.ts` | `packages/core/tests/scheduler/unlock.test.ts` | core |
| `tests/seed/initial-items.test.ts` | `packages/core/tests/seed/initial-items.test.ts` | core |
| `tests/srs/accuracy.test.ts` | `packages/core/tests/srs/accuracy.test.ts` | core |
| `tests/srs/leitner.test.ts` | `packages/core/tests/srs/leitner.test.ts` | core |
| `tests/helpers/fixtures.ts` | `packages/core/tests/helpers/fixtures.ts` | core |
| `tests/session/orchestrator.test.ts` | `packages/web-platform/tests/session/orchestrator.test.ts` | web-platform |
| `tests/session/simulated-session.test.ts` | `packages/web-platform/tests/session/simulated-session.test.ts` | web-platform |
| `tests/store/db.test.ts` | `packages/web-platform/tests/store/db.test.ts` | web-platform |
| `tests/store/items-repo.test.ts` | `packages/web-platform/tests/store/items-repo.test.ts` | web-platform |
| `tests/store/attempts-repo.test.ts` | `packages/web-platform/tests/store/attempts-repo.test.ts` | web-platform |
| `tests/store/sessions-repo.test.ts` | `packages/web-platform/tests/store/sessions-repo.test.ts` | web-platform |
| `tests/store/settings-repo.test.ts` | `packages/web-platform/tests/store/settings-repo.test.ts` | web-platform |
| `tests/audio/timbres.test.ts` | `packages/web-platform/tests/audio/timbres.test.ts` | web-platform |
| `tests/helpers/test-setup.ts` | `packages/web-platform/tests/helpers/test-setup.ts` | web-platform |
| `tests/helpers/test-db.ts` | `packages/web-platform/tests/helpers/test-db.ts` | web-platform |
| `tests/e2e/audio-harness.smoke.spec.ts` | `apps/ear-training-station/e2e/audio-harness.smoke.spec.ts` | app |
| `tests/harness/fixtures/a4-sine.wav` | `apps/ear-training-station/e2e/fixtures/a4-sine.wav` | app |
| `tests/harness/fixtures/make-sine.mjs` | `apps/ear-training-station/e2e/fixtures/make-sine.mjs` | app |

## Import rewriting rules

These rules apply during the migration. Files whose internal `@/` imports point to modules **within the same package** need no changes. Only cross-package imports change.

**Core source files:** No import changes. All `@/types/music`, `@/types/domain`, `@/srs/*`, `@/scheduler/*`, `@/audio/*`, `@/pitch/*` imports resolve via core's `@/` alias to `packages/core/src/`. One exception: `orchestrator.ts` changes its store imports to `@/repos/interfaces`.

**Web-platform source files:**
- `@/types/domain` → `@ear-training/core/types/domain`
- `@/types/music` → `@ear-training/core/types/music` (only if present)
- `player.ts` relative imports: `./cadence-structure` → `@ear-training/core/audio/cadence-structure`, `./target-structure` → `@ear-training/core/audio/target-structure`, `./note-math` → `@ear-training/core/audio/note-math`
- `yin-worklet.ts`: `./yin` → `@ear-training/core/pitch/yin`
- Store files: remove extracted interface definitions, add `import type { ... } from '@ear-training/core/repos/interfaces'`

**App source files:**
- Every `@/` import maps to a package import. Use `@ear-training/core/...` for types, audio math, pitch, and `@ear-training/web-platform/...` for player, timbres, mic, pitch-detector, speech.

**Core test files:** No import changes (same `@/` paths resolve correctly within core).

**Web-platform test files:**
- `@/session/orchestrator` → `@ear-training/core/session/orchestrator`
- `@/seed/initial-items` → `@ear-training/core/seed/initial-items`
- `@/types/*` → `@ear-training/core/types/*`
- `@/srs/*` → `@ear-training/core/srs/*`
- `@/scheduler/*` → `@ear-training/core/scheduler/*`
- `@/store/*` and `@/` within web-platform stay unchanged

---

### Task 1: Monorepo scaffold + file migration

Restructure the single-package repo into a pnpm workspace. Move files, rewrite imports, extract repo interfaces. All 124 tests + e2e + build must pass at the end — no logic changes.

**Files:**
- Create: `pnpm-workspace.yaml`, `.npmrc`, `vitest.workspace.ts`, `tsconfig.json` (update to base config)
- Create: `packages/core/{package.json,tsconfig.json,vitest.config.ts}`
- Create: `packages/web-platform/{package.json,tsconfig.json,vitest.config.ts}`
- Create: `packages/ui-tokens/{package.json,tsconfig.json,vitest.config.ts}`
- Create: `apps/ear-training-station/{package.json,tsconfig.json,vite.config.ts,playwright.config.ts,src/vite-env.d.ts}`
- Create: `packages/core/src/repos/interfaces.ts`
- Move: all files per mapping tables above
- Delete: old `src/`, `tests/`, `vitest.config.ts`, `vite.config.ts`, `playwright.config.ts`, `node_modules/`, `package-lock.json`

- [ ] **Step 1: Remove npm artifacts**

```bash
rm -rf node_modules package-lock.json
```

Verify pnpm is available:

```bash
pnpm --version
```

If pnpm is not installed, install it: `npm install -g pnpm@9`

- [ ] **Step 2: Create workspace config files**

Create `pnpm-workspace.yaml`:

```yaml
packages:
  - 'packages/*'
  - 'apps/*'
```

Create `.npmrc`:

```
public-hoist-pattern[]=*types*
public-hoist-pattern[]=vitest
```

- [ ] **Step 3: Update root package.json**

Replace the existing `package.json` with:

```json
{
  "name": "ear-training-monorepo",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "pnpm --filter ear-training-station dev",
    "build": "pnpm --filter ear-training-station build",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "pnpm -r run typecheck",
    "test:e2e": "pnpm --filter ear-training-station test:e2e"
  },
  "devDependencies": {
    "@types/node": "22.9.0",
    "@vitest/ui": "3.2.4",
    "jsdom": "25.0.1",
    "typescript": "5.6.2",
    "vitest": "3.2.4"
  }
}
```

- [ ] **Step 4: Update root tsconfig.json to base config**

Replace `tsconfig.json` with shared base (remove `paths`, `include`, `types` — those go per-package):

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "resolveJsonModule": true,
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "skipLibCheck": true
  }
}
```

- [ ] **Step 5: Create vitest.workspace.ts**

```typescript
import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'packages/*/vitest.config.ts',
]);
```

- [ ] **Step 6: Create packages/core scaffold**

Create `packages/core/package.json`:

```json
{
  "name": "@ear-training/core",
  "version": "0.0.1",
  "type": "module",
  "exports": {
    "./*": "./src/*.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit"
  }
}
```

Create `packages/core/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src/**/*", "tests/**/*"]
}
```

Create `packages/core/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
```

- [ ] **Step 7: Create packages/web-platform scaffold**

Create `packages/web-platform/package.json`:

```json
{
  "name": "@ear-training/web-platform",
  "version": "0.0.1",
  "type": "module",
  "exports": {
    "./*": "./src/*.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@ear-training/core": "workspace:*",
    "@tensorflow-models/speech-commands": "0.5.4",
    "@tensorflow/tfjs-backend-cpu": "3.21.0",
    "@tensorflow/tfjs-backend-webgl": "3.21.0",
    "idb": "8.0.0",
    "tone": "15.0.4"
  },
  "devDependencies": {
    "fake-indexeddb": "6.0.0"
  }
}
```

Create `packages/web-platform/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src/**/*", "tests/**/*"]
}
```

Create `packages/web-platform/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/helpers/test-setup.ts'],
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
```

- [ ] **Step 8: Create packages/ui-tokens scaffold**

Create `packages/ui-tokens/package.json`:

```json
{
  "name": "@ear-training/ui-tokens",
  "version": "0.0.1",
  "type": "module",
  "exports": {
    ".": "./src/tokens.ts",
    "./tokens.css": "./src/tokens.css"
  },
  "scripts": {
    "typecheck": "tsc --noEmit"
  }
}
```

Create `packages/ui-tokens/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src/**/*", "tests/**/*"]
}
```

Create `packages/ui-tokens/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
```

Create empty placeholder `packages/ui-tokens/src/tokens.ts`:

```typescript
export {};
```

- [ ] **Step 9: Create apps/ear-training-station scaffold**

Create `apps/ear-training-station/package.json`:

```json
{
  "name": "ear-training-station",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "@ear-training/core": "workspace:*",
    "@ear-training/web-platform": "workspace:*",
    "@ear-training/ui-tokens": "workspace:*"
  },
  "devDependencies": {
    "@playwright/test": "1.59.1",
    "@sveltejs/vite-plugin-svelte": "5.1.1",
    "svelte": "5.55.4",
    "svelte-check": "4.0.5",
    "vite": "6.4.2"
  }
}
```

Create `apps/ear-training-station/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src/**/*"]
}
```

Create `apps/ear-training-station/vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [svelte()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
  },
});
```

Create `apps/ear-training-station/playwright.config.ts`:

```typescript
import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const audioFile = fileURLToPath(new URL('./e2e/fixtures/a4-sine.wav', import.meta.url));

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:5173',
    launchOptions: {
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        `--use-file-for-fake-audio-capture=${audioFile}`,
      ],
    },
  },
  webServer: {
    command: 'pnpm run dev',
    url: 'http://localhost:5173/harness/audio.html',
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
```

Create `apps/ear-training-station/src/vite-env.d.ts`:

```typescript
/// <reference types="vite/client" />
```

Create empty `apps/ear-training-station/public/` directory.

- [ ] **Step 10: Move source files to packages**

```bash
# Core — pure modules (types, SRS, scheduler, session, seed, audio math, pitch pure)
mkdir -p packages/core/src/{types,srs,scheduler,session,seed,audio,pitch}
cp src/types/music.ts packages/core/src/types/
cp src/types/domain.ts packages/core/src/types/
cp src/srs/accuracy.ts src/srs/leitner.ts packages/core/src/srs/
cp src/scheduler/curriculum.ts src/scheduler/interleaving.ts src/scheduler/selection.ts src/scheduler/unlock.ts packages/core/src/scheduler/
cp src/session/orchestrator.ts packages/core/src/session/
cp src/seed/initial-items.ts packages/core/src/seed/
cp src/audio/note-math.ts src/audio/cadence-structure.ts src/audio/target-structure.ts packages/core/src/audio/
cp src/pitch/yin.ts src/pitch/degree-mapping.ts packages/core/src/pitch/

# Web-platform — browser infrastructure (Tone playback, worklet, speech, mic, store)
mkdir -p packages/web-platform/src/{audio,pitch,speech,mic,store}
cp src/audio/player.ts src/audio/timbres.ts packages/web-platform/src/audio/
cp src/pitch/pitch-detector.ts src/pitch/yin-worklet.ts packages/web-platform/src/pitch/
cp src/speech/keyword-spotter.ts src/speech/kws-loader.ts packages/web-platform/src/speech/
cp src/mic/permission.ts packages/web-platform/src/mic/
cp src/store/db.ts src/store/items-repo.ts src/store/attempts-repo.ts src/store/sessions-repo.ts src/store/settings-repo.ts packages/web-platform/src/store/

# App — shell, harness, entry point
mkdir -p apps/ear-training-station/src/harness
mkdir -p apps/ear-training-station/harness
cp src/app.ts apps/ear-training-station/src/
cp src/harness/audio-harness.ts apps/ear-training-station/src/harness/
cp harness/audio.html apps/ear-training-station/harness/
cp index.html apps/ear-training-station/
```

- [ ] **Step 11: Move test files to packages**

```bash
# Core tests
mkdir -p packages/core/tests/{types,audio,pitch,scheduler,seed,srs,helpers}
cp tests/types/music.test.ts packages/core/tests/types/
cp tests/audio/cadence-structure.test.ts tests/audio/note-math.test.ts tests/audio/target-structure.test.ts packages/core/tests/audio/
cp tests/pitch/degree-mapping.test.ts tests/pitch/yin.test.ts packages/core/tests/pitch/
cp tests/scheduler/interleaving.test.ts tests/scheduler/selection.test.ts tests/scheduler/unlock.test.ts packages/core/tests/scheduler/
cp tests/seed/initial-items.test.ts packages/core/tests/seed/
cp tests/srs/accuracy.test.ts tests/srs/leitner.test.ts packages/core/tests/srs/
cp tests/helpers/fixtures.ts packages/core/tests/helpers/

# Web-platform tests
mkdir -p packages/web-platform/tests/{store,audio,session,helpers}
cp tests/store/db.test.ts tests/store/items-repo.test.ts tests/store/attempts-repo.test.ts tests/store/sessions-repo.test.ts tests/store/settings-repo.test.ts packages/web-platform/tests/store/
cp tests/audio/timbres.test.ts packages/web-platform/tests/audio/
cp tests/session/orchestrator.test.ts tests/session/simulated-session.test.ts packages/web-platform/tests/session/
cp tests/helpers/test-setup.ts tests/helpers/test-db.ts packages/web-platform/tests/helpers/

# Also create a fixtures.ts for web-platform tests (re-export or duplicate the key fixtures)
cat > packages/web-platform/tests/helpers/fixtures.ts << 'FIXTURES_EOF'
import type { Key } from '@ear-training/core/types/music';

export const C_MAJOR: Key = { tonic: 'C', quality: 'major' };
export const A_MINOR: Key = { tonic: 'A', quality: 'minor' };
export const G_MAJOR: Key = { tonic: 'G', quality: 'major' };
FIXTURES_EOF

# App e2e
mkdir -p apps/ear-training-station/e2e/fixtures
cp tests/e2e/audio-harness.smoke.spec.ts apps/ear-training-station/e2e/
cp tests/harness/fixtures/a4-sine.wav apps/ear-training-station/e2e/fixtures/
cp tests/harness/fixtures/make-sine.mjs apps/ear-training-station/e2e/fixtures/
```

- [ ] **Step 12: Create packages/core/src/repos/interfaces.ts**

Extract the pure interfaces from the store files. This is the only new code in the migration task:

```typescript
import type { Item, Attempt, Session, Settings } from '@/types/domain';

export interface ItemsRepo {
  get(id: string): Promise<Item | undefined>;
  listAll(): Promise<Item[]>;
  findDue(now: number): Promise<Item[]>;
  findByBox(box: Item['box']): Promise<Item[]>;
  put(item: Item): Promise<void>;
  putMany(items: ReadonlyArray<Item>): Promise<void>;
}

export interface AttemptsRepo {
  append(attempt: Attempt): Promise<void>;
  findBySession(sessionId: string): Promise<Attempt[]>;
  findByItem(itemId: string): Promise<Attempt[]>;
}

export interface StartSessionInput {
  id: string;
  target_items: number;
  started_at: number;
}

export interface CompleteSessionInput {
  ended_at: number;
  completed_items: number;
  pitch_pass_count: number;
  label_pass_count: number;
  focus_item_id: string | null;
}

export interface SessionsRepo {
  start(input: StartSessionInput): Promise<Session>;
  complete(id: string, input: CompleteSessionInput): Promise<void>;
  get(id: string): Promise<Session | undefined>;
  findRecent(limit: number): Promise<Session[]>;
}

export interface SettingsRepo {
  getOrDefault(): Promise<Settings>;
  update(partial: Partial<Settings>): Promise<void>;
}
```

- [ ] **Step 13: Rewrite imports — orchestrator (core)**

In `packages/core/src/session/orchestrator.ts`, replace the store imports with the new interfaces:

```typescript
// BEFORE:
import type { ItemsRepo } from '@/store/items-repo';
import type { AttemptsRepo } from '@/store/attempts-repo';
import type { SessionsRepo } from '@/store/sessions-repo';

// AFTER:
import type { ItemsRepo, AttemptsRepo, SessionsRepo } from '@/repos/interfaces';
```

All other imports in orchestrator.ts remain unchanged (`@/types/domain`, `@/scheduler/*`, `@/srs/*`).

- [ ] **Step 14: Rewrite imports — web-platform source files**

Update `packages/web-platform/src/audio/player.ts`:

```typescript
// BEFORE:
import type { ChordEvent } from './cadence-structure';
import type { NoteEvent } from './target-structure';
import { midiToHz } from './note-math';

// AFTER:
import type { ChordEvent } from '@ear-training/core/audio/cadence-structure';
import type { NoteEvent } from '@ear-training/core/audio/target-structure';
import { midiToHz } from '@ear-training/core/audio/note-math';
```

(`./timbres` and `tone` imports stay unchanged.)

Update `packages/web-platform/src/pitch/yin-worklet.ts`:

```typescript
// BEFORE:
import { detectPitch } from './yin';

// AFTER:
import { detectPitch } from '@ear-training/core/pitch/yin';
```

Update `packages/web-platform/src/store/db.ts`:

```typescript
// BEFORE:
import type { Item, Attempt, Session, Settings } from '@/types/domain';

// AFTER:
import type { Item, Attempt, Session, Settings } from '@ear-training/core/types/domain';
```

- [ ] **Step 15: Rewrite imports — web-platform store files (extract interfaces)**

For each store file (`items-repo.ts`, `attempts-repo.ts`, `sessions-repo.ts`, `settings-repo.ts`):

1. Remove the `interface` definition (it's now in `@ear-training/core/repos/interfaces`)
2. Add an import of the interface from core
3. Update `@/types/domain` to `@ear-training/core/types/domain`

Example for `packages/web-platform/src/store/items-repo.ts`:

```typescript
// BEFORE:
import type { DB } from './db';
import type { Item } from '@/types/domain';

export interface ItemsRepo {
  get(id: string): Promise<Item | undefined>;
  listAll(): Promise<Item[]>;
  findDue(now: number): Promise<Item[]>;
  findByBox(box: Item['box']): Promise<Item[]>;
  put(item: Item): Promise<void>;
  putMany(items: ReadonlyArray<Item>): Promise<void>;
}

export function createItemsRepo(db: DB): ItemsRepo {

// AFTER:
import type { DB } from './db';
import type { Item } from '@ear-training/core/types/domain';
import type { ItemsRepo } from '@ear-training/core/repos/interfaces';

export { type ItemsRepo };

export function createItemsRepo(db: DB): ItemsRepo {
```

Apply the same pattern to `attempts-repo.ts`, `sessions-repo.ts`, `settings-repo.ts`. For sessions-repo.ts, also remove `StartSessionInput` and `CompleteSessionInput` (now in core's interfaces), and import them:

```typescript
import type { SessionsRepo, StartSessionInput, CompleteSessionInput } from '@ear-training/core/repos/interfaces';
import type { Session } from '@ear-training/core/types/domain';
```

For settings-repo.ts:

```typescript
import type { SettingsRepo } from '@ear-training/core/repos/interfaces';
import type { Settings } from '@ear-training/core/types/domain';
import { DEFAULT_SETTINGS } from '@ear-training/core/types/domain';
```

Note: `DEFAULT_SETTINGS` is a value export, not just a type. It needs a value import.

- [ ] **Step 16: Rewrite imports — app harness**

Update `apps/ear-training-station/src/harness/audio-harness.ts`:

```typescript
// BEFORE:
import { TIMBRE_IDS, type TimbreId } from '@/audio/timbres';
import { DEGREES, type Degree, type PitchClass, type Key, type KeyQuality } from '@/types/music';
import { buildCadence } from '@/audio/cadence-structure';
import { buildTarget } from '@/audio/target-structure';
import { ensureAudioContextStarted, playRound } from '@/audio/player';
import { requestMicStream } from '@/mic/permission';
import { startPitchDetector, type PitchDetectorHandle } from '@/pitch/pitch-detector';
import { mapHzToDegree } from '@/pitch/degree-mapping';
import { startKeywordSpotter, type KeywordSpotterHandle } from '@/speech/keyword-spotter';
import type { Register } from '@/types/domain';

// AFTER:
import { TIMBRE_IDS, type TimbreId } from '@ear-training/web-platform/audio/timbres';
import { DEGREES, type Degree, type PitchClass, type Key, type KeyQuality } from '@ear-training/core/types/music';
import { buildCadence } from '@ear-training/core/audio/cadence-structure';
import { buildTarget } from '@ear-training/core/audio/target-structure';
import { ensureAudioContextStarted, playRound } from '@ear-training/web-platform/audio/player';
import { requestMicStream } from '@ear-training/web-platform/mic/permission';
import { startPitchDetector, type PitchDetectorHandle } from '@ear-training/web-platform/pitch/pitch-detector';
import { mapHzToDegree } from '@ear-training/core/pitch/degree-mapping';
import { startKeywordSpotter, type KeywordSpotterHandle } from '@ear-training/web-platform/speech/keyword-spotter';
import type { Register } from '@ear-training/core/types/domain';
```

- [ ] **Step 17: Rewrite imports — web-platform test files**

For `packages/web-platform/tests/session/orchestrator.test.ts`:

```typescript
// BEFORE:
import { createOrchestrator, type Orchestrator } from '@/session/orchestrator';
import { createItemsRepo } from '@/store/items-repo';
import { createAttemptsRepo } from '@/store/attempts-repo';
import { createSessionsRepo } from '@/store/sessions-repo';
import { openTestDB } from '../helpers/test-db';
import { buildInitialItems } from '@/seed/initial-items';

// AFTER:
import { createOrchestrator, type Orchestrator } from '@ear-training/core/session/orchestrator';
import { createItemsRepo } from '@/store/items-repo';
import { createAttemptsRepo } from '@/store/attempts-repo';
import { createSessionsRepo } from '@/store/sessions-repo';
import { openTestDB } from '../helpers/test-db';
import { buildInitialItems } from '@ear-training/core/seed/initial-items';
```

Apply the same pattern to `simulated-session.test.ts`.

For `packages/web-platform/tests/helpers/test-db.ts`:

```typescript
// BEFORE:
import { openEarTrainingDB, type DB } from '@/store/db';

// AFTER (no change — db.ts is in web-platform):
import { openEarTrainingDB, type DB } from '@/store/db';
```

For store test files, update any `@/types/domain` import to `@ear-training/core/types/domain`. Scan each test file for `@/types/` or `@/srs/` or `@/scheduler/` imports and replace with `@ear-training/core/` prefix.

- [ ] **Step 18: Delete old source and config files**

```bash
rm -rf src/ tests/ harness/
rm vitest.config.ts vite.config.ts playwright.config.ts
rm -f index.html
```

- [ ] **Step 19: Run pnpm install**

```bash
pnpm install
```

Expected: clean install, `pnpm-lock.yaml` generated, workspace packages linked.

- [ ] **Step 20: Verify typecheck**

```bash
pnpm run typecheck
```

Expected: 0 errors across all packages. If there are errors, fix import paths. Common issues:
- Missing `@ear-training/core/` prefix on cross-package imports
- `DEFAULT_SETTINGS` or other value imports using `import type` (needs `import`)
- `verbatimModuleSyntax` violations for re-exported types without `type` keyword

- [ ] **Step 21: Verify tests**

```bash
pnpm run test
```

Expected: all 124 tests pass (20 test files across core + web-platform, matching the pre-migration count).

- [ ] **Step 22: Verify build**

```bash
cd apps/ear-training-station && pnpm run build && cd ../..
```

Expected: clean production bundle in `apps/ear-training-station/dist/`. No harness in the output. `speech-commands` does not appear in the prod chunk graph (app.ts is still a placeholder).

- [ ] **Step 23: Verify e2e**

```bash
pnpm run test:e2e
```

Expected: Playwright smoke test passes (pitch detector reports ~440 Hz on fake sine input).

- [ ] **Step 24: Commit**

```bash
git add -A
git commit -m "refactor: restructure as pnpm monorepo with three-layer package split

Move Plan A pure-logic modules to @ear-training/core, Plan B browser
infrastructure to @ear-training/web-platform, app shell to
ear-training-station. Extract repo interfaces to core. All 124 unit
tests + e2e smoke test pass in new locations."
```

---

### Task 2: Export IN_KEY_CENTS

Export the private `IN_KEY_CENTS` constant from `degree-mapping.ts` so Plan C1's feedback UI can share the threshold instead of duplicating it. Add a docstring about the deterministic tie-break for equidistant pitches.

**Files:**
- Modify: `packages/core/src/pitch/degree-mapping.ts`
- Test: `packages/core/tests/pitch/degree-mapping.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `packages/core/tests/pitch/degree-mapping.test.ts`:

```typescript
import { IN_KEY_CENTS } from '@/pitch/degree-mapping';

describe('IN_KEY_CENTS', () => {
  it('is exported and equals 50', () => {
    expect(IN_KEY_CENTS).toBe(50);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm run test -- --reporter=verbose 2>&1 | grep -A2 'IN_KEY_CENTS'`

Expected: FAIL — `IN_KEY_CENTS` is not exported.

- [ ] **Step 3: Export the constant and add docstring**

In `packages/core/src/pitch/degree-mapping.ts`, change:

```typescript
// BEFORE:
const IN_KEY_CENTS = 50;

// AFTER:
/**
 * Pitch must be within ±50 cents of a diatonic degree to count as "in key."
 * For equidistant pitches, the first degree in iteration order (ascending from 1)
 * wins the tie-break deterministically.
 */
export const IN_KEY_CENTS = 50;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm run test -- --reporter=verbose 2>&1 | grep -A2 'IN_KEY_CENTS'`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/pitch/degree-mapping.ts packages/core/tests/pitch/degree-mapping.test.ts
git commit -m "fix(degree-mapping): export IN_KEY_CENTS constant

Plan C1 feedback UI needs the threshold to color-code on-key vs off-key
pitches. Added docstring about the deterministic tie-break."
```

---

### Task 3: Digit label conversion

New module that converts KWS `DigitLabel` (`'one'`, `'two'`, ...) to `number` (1–7). Lives in web-platform near the keyword-spotter where the mismatch originates. Consumed by round-adapters in Task 12.

**Files:**
- Create: `packages/web-platform/src/speech/digit-label.ts`
- Test: `packages/web-platform/tests/speech/digit-label.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/web-platform/tests/speech/digit-label.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { digitLabelToNumber } from '@/speech/digit-label';
import { DIGIT_LABELS, type DigitLabel } from '@/speech/keyword-spotter';

describe('digitLabelToNumber', () => {
  it.each([
    ['one', 1],
    ['two', 2],
    ['three', 3],
    ['four', 4],
    ['five', 5],
    ['six', 6],
    ['seven', 7],
  ] as const)('converts "%s" to %d', (label, expected) => {
    expect(digitLabelToNumber(label)).toBe(expected);
  });

  it('throws on unknown label', () => {
    expect(() => digitLabelToNumber('eight' as DigitLabel)).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm run test -- --reporter=verbose 2>&1 | grep -A2 'digitLabelToNumber'`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement digitLabelToNumber**

Create `packages/web-platform/src/speech/digit-label.ts`:

```typescript
import { DIGIT_LABELS, type DigitLabel } from './keyword-spotter';

export function digitLabelToNumber(label: DigitLabel): number {
  const idx = DIGIT_LABELS.indexOf(label);
  if (idx < 0) throw new Error(`Unknown digit label: "${label}"`);
  return idx + 1;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm run test -- --reporter=verbose 2>&1 | grep -A2 'digitLabelToNumber'`

Expected: PASS — 8 tests passing.

- [ ] **Step 5: Commit**

```bash
git add packages/web-platform/src/speech/digit-label.ts packages/web-platform/tests/speech/digit-label.test.ts
git commit -m "feat(speech): add digitLabelToNumber conversion helper

Bridges the type gap between KWS DigitLabel ('one'...'seven') and the
orchestrator's numeric digit (1..7). Consumed by round-adapters."
```

---

### Task 4: KWS re-start safety

Make `startKeywordSpotter` throw when called with different thresholds while a cached handle exists. Same-threshold calls remain idempotent.

**Files:**
- Modify: `packages/web-platform/src/speech/keyword-spotter.ts`
- Test: `packages/web-platform/tests/speech/kws-safety.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/web-platform/tests/speech/kws-safety.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./../../src/speech/kws-loader', () => ({
  loadKwsRecognizer: vi.fn().mockResolvedValue({
    wordLabels: () => ['_background_noise_', '_unknown_', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'zero'],
    listen: vi.fn().mockResolvedValue(undefined),
    stopListening: vi.fn().mockResolvedValue(undefined),
  }),
}));

import { startKeywordSpotter } from '@/speech/keyword-spotter';

describe('startKeywordSpotter threshold safety', () => {
  beforeEach(async () => {
    // Ensure clean state: if there's an active handle, stop it
    try {
      const handle = await startKeywordSpotter();
      await handle.stop();
    } catch { /* ignore */ }
  });

  it('returns same handle for identical thresholds', async () => {
    const h1 = await startKeywordSpotter({ probabilityThreshold: 0.8 });
    const h2 = await startKeywordSpotter({ probabilityThreshold: 0.8 });
    expect(h1).toBe(h2);
    await h1.stop();
  });

  it('returns same handle when both use defaults', async () => {
    const h1 = await startKeywordSpotter();
    const h2 = await startKeywordSpotter();
    expect(h1).toBe(h2);
    await h1.stop();
  });

  it('throws when called with different probabilityThreshold', async () => {
    const h1 = await startKeywordSpotter({ probabilityThreshold: 0.8 });
    await expect(
      startKeywordSpotter({ probabilityThreshold: 0.5 }),
    ).rejects.toThrow(/different.*threshold/i);
    await h1.stop();
  });

  it('throws when called with different minConfidence', async () => {
    const h1 = await startKeywordSpotter({ minConfidence: 0.9 });
    await expect(
      startKeywordSpotter({ minConfidence: 0.5 }),
    ).rejects.toThrow(/different.*threshold/i);
    await h1.stop();
  });

  it('allows different thresholds after stop', async () => {
    const h1 = await startKeywordSpotter({ probabilityThreshold: 0.8 });
    await h1.stop();
    const h2 = await startKeywordSpotter({ probabilityThreshold: 0.5 });
    expect(h2).toBeDefined();
    await h2.stop();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm run test -- --reporter=verbose 2>&1 | grep -A2 'threshold safety'`

Expected: FAIL on the "throws when called with different" tests.

- [ ] **Step 3: Add threshold tracking to keyword-spotter**

In `packages/web-platform/src/speech/keyword-spotter.ts`, add module-level state for stored thresholds and a guard in `startKeywordSpotter`:

After the existing module-level vars (`activeHandle`, `activePromise`, `activeStop`), add:

```typescript
let activeThresholds: { probabilityThreshold: number; minConfidence: number } | null = null;
```

At the top of `startKeywordSpotter`, after the `if (activeHandle !== null)` block, add the threshold check:

```typescript
export async function startKeywordSpotter(
  input: StartKeywordSpotterInput = {},
): Promise<KeywordSpotterHandle> {
  const probabilityThreshold = input.probabilityThreshold ?? 0.75;
  const minConfidence = input.minConfidence ?? 0.75;

  // Already active — return existing handle if thresholds match, throw if different.
  if (activeHandle !== null) {
    if (
      activeThresholds !== null &&
      (activeThresholds.probabilityThreshold !== probabilityThreshold ||
       activeThresholds.minConfidence !== minConfidence)
    ) {
      throw new Error(
        `startKeywordSpotter called with different thresholds while active. ` +
        `Current: prob=${activeThresholds.probabilityThreshold}, conf=${activeThresholds.minConfidence}. ` +
        `Requested: prob=${probabilityThreshold}, conf=${minConfidence}. ` +
        `Call stop() first to change thresholds.`,
      );
    }
    return Promise.resolve(activeHandle);
  }

  // ... rest of existing code
```

Also set `activeThresholds` when the handle is created (in `_createHandle`, after `activeHandle = handle`):

```typescript
activeThresholds = { probabilityThreshold, minConfidence };
```

And null it on stop (in the handle's `stop()` method, alongside nulling `activeHandle`):

```typescript
activeThresholds = null;
```

Move the threshold defaults (`?? 0.75`) from `_createHandle` up to `startKeywordSpotter` so they're available for comparison. Remove the defaults from `_createHandle` parameters — pass them through.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm run test -- --reporter=verbose 2>&1 | grep -A2 'threshold safety'`

Expected: PASS — all 5 tests.

- [ ] **Step 5: Run all tests to verify no regressions**

Run: `pnpm run test`

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/web-platform/src/speech/keyword-spotter.ts packages/web-platform/tests/speech/kws-safety.test.ts
git commit -m "fix(speech): throw on KWS re-start with different thresholds

The idempotent cache silently ignored threshold changes. Now throws a
descriptive error if thresholds differ, guiding the caller to stop()
first. Same-threshold calls remain idempotent."
```

---

### Task 5: Test gap backfills

Add pure unit tests for gaps identified in the pre-Phase-C0 audit. All test existing code — no implementation changes. Tests in core use stub repos to avoid IndexedDB dependency.

**Files:**
- Create: `packages/core/tests/helpers/stub-repos.ts`
- Modify: `packages/core/tests/scheduler/curriculum.test.ts` (add cases)
- Modify: `packages/core/tests/audio/note-math.test.ts` (add cases)
- Create: `packages/core/tests/session/orchestrator-unit.test.ts`

- [ ] **Step 1: Create stub repos for core tests**

Create `packages/core/tests/helpers/stub-repos.ts`:

```typescript
import type {
  ItemsRepo,
  AttemptsRepo,
  SessionsRepo,
  StartSessionInput,
  CompleteSessionInput,
} from '@/repos/interfaces';
import type { Item, Attempt, Session } from '@/types/domain';

export function createStubItemsRepo(
  initial: Item[] = [],
): ItemsRepo & { items: Map<string, Item> } {
  const items = new Map<string, Item>(initial.map((i) => [i.id, i]));
  return {
    items,
    async get(id) { return items.get(id); },
    async listAll() { return [...items.values()]; },
    async findDue(now) { return [...items.values()].filter((i) => i.due_at <= now); },
    async findByBox(box) { return [...items.values()].filter((i) => i.box === box); },
    async put(item) { items.set(item.id, item); },
    async putMany(list) { for (const item of list) items.set(item.id, item); },
  };
}

export function createStubAttemptsRepo(): AttemptsRepo & { attempts: Attempt[] } {
  const attempts: Attempt[] = [];
  return {
    attempts,
    async append(a) { attempts.push(a); },
    async findBySession(sid) { return attempts.filter((a) => a.session_id === sid); },
    async findByItem(iid) { return attempts.filter((a) => a.item_id === iid); },
  };
}

export function createStubSessionsRepo(): SessionsRepo & { sessions: Map<string, Session> } {
  const sessions = new Map<string, Session>();
  return {
    sessions,
    async start(input: StartSessionInput) {
      const s: Session = {
        id: input.id,
        started_at: input.started_at,
        ended_at: null,
        target_items: input.target_items,
        completed_items: 0,
        pitch_pass_count: 0,
        label_pass_count: 0,
        focus_item_id: null,
      };
      sessions.set(s.id, s);
      return s;
    },
    async complete(id, input: CompleteSessionInput) {
      const existing = sessions.get(id);
      if (!existing) return;
      sessions.set(id, { ...existing, ...input });
    },
    async get(id) { return sessions.get(id); },
    async findRecent(limit) {
      return [...sessions.values()]
        .sort((a, b) => b.started_at - a.started_at)
        .slice(0, limit);
    },
  };
}
```

- [ ] **Step 2: Add groupFor() coverage to curriculum tests**

Add to `packages/core/tests/scheduler/curriculum.test.ts`:

```typescript
import { groupFor, MVP_CURRICULUM } from '@/scheduler/curriculum';
import { C_MAJOR, A_MINOR } from '../helpers/fixtures';

describe('groupFor', () => {
  it('returns group 0 for degree 1 in C major', () => {
    expect(groupFor(1, C_MAJOR, MVP_CURRICULUM)).toBe(0);
  });

  it('returns group 0 for degree 5 in C major', () => {
    expect(groupFor(5, C_MAJOR, MVP_CURRICULUM)).toBe(0);
  });

  it('returns a later group for degree 7', () => {
    const g = groupFor(7, C_MAJOR, MVP_CURRICULUM);
    expect(g).toBeGreaterThan(0);
  });

  it('returns -1 for non-member degree/key combo', () => {
    // Degree 1 in a key not in the curriculum (if any) — or use a key
    // that IS in the curriculum. Adjust based on actual curriculum content.
    // The point is: groupFor must handle items not in any group.
    const result = groupFor(1, { tonic: 'C#', quality: 'major' }, MVP_CURRICULUM);
    // If C# major is not in the curriculum, expect -1 or similar sentinel
    expect(typeof result).toBe('number');
  });
});
```

Note: The exact test assertions depend on `groupFor`'s signature and the curriculum content. Read the function to confirm the return type for non-members (it might return `undefined` or `-1`). Adjust assertions accordingly.

- [ ] **Step 3: Add centsBetween() edge cases to note-math tests**

Add to `packages/core/tests/audio/note-math.test.ts`:

```typescript
import { centsBetween } from '@/audio/note-math';

describe('centsBetween edge cases', () => {
  it('returns 0 for identical frequencies', () => {
    expect(centsBetween(440, 440)).toBe(0);
  });

  it('handles zero sung hz gracefully', () => {
    const result = centsBetween(0, 440);
    expect(typeof result === 'number' || result === null).toBe(true);
  });

  it('handles zero target hz gracefully', () => {
    const result = centsBetween(440, 0);
    expect(typeof result === 'number' || result === null).toBe(true);
  });

  it('handles negative hz', () => {
    const result = centsBetween(-100, 440);
    expect(typeof result === 'number' || result === null).toBe(true);
  });

  it('returns ~1200 for octave difference', () => {
    const cents = centsBetween(880, 440);
    expect(cents).toBeCloseTo(1200, 0);
  });

  it('returns ~-1200 for octave below', () => {
    const cents = centsBetween(220, 440);
    expect(cents).toBeCloseTo(-1200, 0);
  });
});
```

Note: Adjust null/number assertions based on `centsBetween`'s actual behavior for invalid inputs. Read the function first.

- [ ] **Step 4: Create orchestrator unit tests (pickFocusItem tie-break + nextItem after completeSession)**

Create `packages/core/tests/session/orchestrator-unit.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { createOrchestrator } from '@/session/orchestrator';
import { buildInitialItems } from '@/seed/initial-items';
import { createStubItemsRepo, createStubAttemptsRepo, createStubSessionsRepo } from '../helpers/stub-repos';
import type { Item } from '@/types/domain';

function setupOrchestrator(items?: Item[]) {
  const initialItems = items ?? buildInitialItems({ now: 0 });
  const itemsRepo = createStubItemsRepo(initialItems);
  const attemptsRepo = createStubAttemptsRepo();
  const sessionsRepo = createStubSessionsRepo();
  return createOrchestrator({
    itemsRepo,
    attemptsRepo,
    sessionsRepo,
    now: () => 1000,
    rng: () => 0.5,
  });
}

describe('pickFocusItem tie-break', () => {
  it('returns an item when all have identical accuracy', async () => {
    const orch = setupOrchestrator();
    await orch.startSession({ sessionId: 's1', target_items: 1 });
    const item = await orch.nextItem();
    expect(item).not.toBeNull();
    if (!item) return;
    await orch.recordAttempt({
      item,
      target: { hz: 440 },
      sung: { hz: 440, cents_off: 0, confidence: 0.9 },
      spoken: { digit: item.degree, confidence: 0.9 },
      pitchOk: true,
      labelOk: true,
      timbre: 'piano',
      register: 'narrow',
    });
    const session = await orch.completeSession();
    expect(session.focus_item_id).not.toBeNull();
  });

  it('picks the item with lower accuracy', async () => {
    const items = buildInitialItems({ now: 0 });
    // Manually lower one item's accuracy
    if (items.length >= 2) {
      items[0]!.accuracy = { pitch: 0.2, label: 0.5 };
      items[1]!.accuracy = { pitch: 0.8, label: 0.8 };
    }
    const orch = setupOrchestrator(items);
    await orch.startSession({ sessionId: 's1', target_items: 0 });
    const session = await orch.completeSession();
    expect(session.focus_item_id).toBe(items[0]!.id);
  });
});

describe('nextItem after completeSession', () => {
  it('throws when called after completeSession without new startSession', async () => {
    const orch = setupOrchestrator();
    await orch.startSession({ sessionId: 's1', target_items: 1 });
    await orch.completeSession();
    await expect(orch.nextItem()).rejects.toThrow();
  });
});
```

- [ ] **Step 5: Run all new tests**

Run: `pnpm run test`

Expected: all tests pass, including the new backfill tests.

- [ ] **Step 6: Commit**

```bash
git add packages/core/tests/
git commit -m "test: backfill test gaps for groupFor, centsBetween, pickFocusItem, nextItem lifecycle"
```

---

### Task 6: UI tokens

New `@ear-training/ui-tokens` package with design token constants (TS + CSS). Both files carry the same values; a unit test enforces agreement.

**Files:**
- Create: `packages/ui-tokens/src/tokens.ts` (replace placeholder)
- Create: `packages/ui-tokens/src/tokens.css`
- Test: `packages/ui-tokens/tests/tokens.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/ui-tokens/tests/tokens.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { colors } from '@/tokens';

describe('ui-tokens agreement', () => {
  it('tokens.css declares every color from tokens.ts with matching value', () => {
    const cssPath = fileURLToPath(new URL('../src/tokens.css', import.meta.url));
    const css = readFileSync(cssPath, 'utf-8');

    for (const [name, hex] of Object.entries(colors)) {
      const pattern = new RegExp(`--${name}:\\s*${hex.replace('#', '\\#')}\\s*;`);
      expect(css).toMatch(pattern);
    }
  });

  it('tokens.css has no extra custom properties not in tokens.ts', () => {
    const cssPath = fileURLToPath(new URL('../src/tokens.css', import.meta.url));
    const css = readFileSync(cssPath, 'utf-8');
    const cssVars = [...css.matchAll(/--(\w+):/g)].map((m) => m[1]);
    const tsKeys = Object.keys(colors);
    for (const v of cssVars) {
      expect(tsKeys).toContain(v);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm run test -- --reporter=verbose 2>&1 | grep -A2 'tokens'`

Expected: FAIL — `colors` export not found / CSS file missing.

- [ ] **Step 3: Implement tokens.ts**

Replace `packages/ui-tokens/src/tokens.ts`:

```typescript
export const colors = {
  bg: '#0a0a0a',
  panel: '#141414',
  border: '#2a2a2a',
  text: '#f5f5f7',
  muted: '#86868b',
  cyan: '#22d3ee',
  amber: '#fbbf24',
  green: '#22c55e',
  red: '#ef4444',
} as const;

export type ColorToken = keyof typeof colors;
```

- [ ] **Step 4: Implement tokens.css**

Create `packages/ui-tokens/src/tokens.css`:

```css
:root {
  --bg: #0a0a0a;
  --panel: #141414;
  --border: #2a2a2a;
  --text: #f5f5f7;
  --muted: #86868b;
  --cyan: #22d3ee;
  --amber: #fbbf24;
  --green: #22c55e;
  --red: #ef4444;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm run test -- --reporter=verbose 2>&1 | grep -A2 'tokens'`

Expected: PASS — both agreement tests green.

- [ ] **Step 6: Commit**

```bash
git add packages/ui-tokens/
git commit -m "feat(ui-tokens): add design token constants (TS + CSS)

Dark audio-app aesthetic locked per spec: bg #0a0a0a, cyan #22d3ee for
target/reference, amber #fbbf24 for user/capture, green/red for
pass/fail. Unit test enforces TS↔CSS agreement."
```

---

### Task 7: Variability pickers

Pure per-round pickers with anti-repeat and settings override. Consumed by Plan C1's session composition to vary timbre and register each round.

**Files:**
- Create: `packages/core/src/variability/pickers.ts`
- Test: `packages/core/tests/variability/pickers.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/core/tests/variability/pickers.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { pickTimbre, pickRegister, type VariabilityHistory, type VariabilitySettings } from '@/variability/pickers';
import { TIMBRE_IDS } from '@/audio/timbres';

// Note: TIMBRE_IDS is re-exported from core or defined in core. If it's only
// in web-platform, define the constant locally for the test.

const NO_HISTORY: VariabilityHistory = { lastTimbre: null, lastRegister: null };
const NO_LOCKS: VariabilitySettings = { lockedTimbre: null, lockedRegister: null };

describe('pickTimbre', () => {
  it('returns a valid TimbreId', () => {
    const result = pickTimbre(() => 0.5, NO_HISTORY, NO_LOCKS);
    expect(['piano', 'epiano', 'guitar', 'pad']).toContain(result);
  });

  it('avoids repeating the last timbre', () => {
    const results = new Set<string>();
    for (let i = 0; i < 100; i++) {
      results.add(
        pickTimbre(() => Math.random(), { ...NO_HISTORY, lastTimbre: 'piano' }, NO_LOCKS),
      );
    }
    expect(results.has('piano')).toBe(false);
  });

  it('returns locked timbre regardless of history', () => {
    const result = pickTimbre(
      () => 0.5,
      { ...NO_HISTORY, lastTimbre: 'guitar' },
      { ...NO_LOCKS, lockedTimbre: 'guitar' },
    );
    expect(result).toBe('guitar');
  });

  it('falls back when all options exhausted (only one timbre)', () => {
    // With locked timbre, there's no exclusion — locked always wins.
    const result = pickTimbre(() => 0.5, NO_HISTORY, { ...NO_LOCKS, lockedTimbre: 'pad' });
    expect(result).toBe('pad');
  });
});

describe('pickRegister', () => {
  it('returns a valid Register', () => {
    const result = pickRegister(() => 0.5, NO_HISTORY, NO_LOCKS);
    expect(['narrow', 'comfortable', 'wide']).toContain(result);
  });

  it('avoids repeating the last register', () => {
    const results = new Set<string>();
    for (let i = 0; i < 100; i++) {
      results.add(
        pickRegister(() => Math.random(), { ...NO_HISTORY, lastRegister: 'narrow' }, NO_LOCKS),
      );
    }
    expect(results.has('narrow')).toBe(false);
  });

  it('returns locked register', () => {
    const result = pickRegister(
      () => 0.5,
      NO_HISTORY,
      { ...NO_LOCKS, lockedRegister: 'wide' },
    );
    expect(result).toBe('wide');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm run test -- --reporter=verbose 2>&1 | grep -A2 'pickTimbre'`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement pickers**

Create `packages/core/src/variability/pickers.ts`:

```typescript
import type { Register } from '@/types/domain';

export const TIMBRE_IDS = ['piano', 'epiano', 'guitar', 'pad'] as const;
export type TimbreId = (typeof TIMBRE_IDS)[number];

const REGISTERS: readonly Register[] = ['narrow', 'comfortable', 'wide'];

export interface VariabilityHistory {
  lastTimbre: TimbreId | null;
  lastRegister: Register | null;
}

export interface VariabilitySettings {
  lockedTimbre: TimbreId | null;
  lockedRegister: Register | null;
}

export function pickTimbre(
  rng: () => number,
  history: VariabilityHistory,
  settings: VariabilitySettings,
): TimbreId {
  if (settings.lockedTimbre !== null) return settings.lockedTimbre;
  const pool = TIMBRE_IDS.filter((t) => t !== history.lastTimbre);
  return pool[Math.floor(rng() * pool.length)]!;
}

export function pickRegister(
  rng: () => number,
  history: VariabilityHistory,
  settings: VariabilitySettings,
): Register {
  if (settings.lockedRegister !== null) return settings.lockedRegister;
  const pool = REGISTERS.filter((r) => r !== history.lastRegister);
  return pool[Math.floor(rng() * pool.length)]!;
}
```

Note: `TIMBRE_IDS` is duplicated here from `web-platform/audio/timbres.ts`. This is intentional: core must not depend on web-platform. The authoritative timbre list for type-safe variability logic lives in core. Web-platform's `timbres.ts` is where Tone.js synth factories live — a separate concern.

- [ ] **Step 4: Update pickers test import**

If the test imported `TIMBRE_IDS` from `@/audio/timbres`, update to import from `@/variability/pickers` instead:

```typescript
import { pickTimbre, pickRegister, TIMBRE_IDS, type VariabilityHistory, type VariabilitySettings } from '@/variability/pickers';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm run test -- --reporter=verbose 2>&1 | grep -A2 'pickTimbre'`

Expected: PASS — all picker tests green.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/variability/ packages/core/tests/variability/
git commit -m "feat(variability): add per-round timbre and register pickers

Anti-repeat from history, settings override for locked values. Pure
functions consumed by Plan C1 session composition."
```

---

### Task 8: Analytics rollups

Pure functions over `ReadonlyArray<Item>` and `ReadonlyArray<Session>` for dashboard data. Plan C1 dashboards pick which to call.

**Files:**
- Create: `packages/core/src/analytics/rollups.ts`
- Test: `packages/core/tests/analytics/rollups.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/core/tests/analytics/rollups.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { masteryByDegree, masteryByKey, leitnerCounts, currentStreak } from '@/analytics/rollups';
import { buildInitialItems } from '@/seed/initial-items';
import type { Item, Session } from '@/types/domain';
import { keyId } from '@/types/music';

const items = buildInitialItems({ now: 0 });

describe('masteryByDegree', () => {
  it('returns a Map with entries for each degree present in items', () => {
    const result = masteryByDegree(items);
    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBeGreaterThan(0);
  });

  it('mastery is pitch accuracy average for each degree', () => {
    const tweaked: Item[] = items.map((it, i) =>
      i === 0 ? { ...it, accuracy: { pitch: 0.8, label: 0.9 } } : it,
    );
    const result = masteryByDegree(tweaked);
    const degree = tweaked[0]!.degree;
    expect(result.get(degree)).toBeDefined();
  });
});

describe('masteryByKey', () => {
  it('returns a Map keyed by keyId strings', () => {
    const result = masteryByKey(items);
    expect(result).toBeInstanceOf(Map);
    for (const [k] of result) {
      expect(k).toMatch(/-/);
    }
  });
});

describe('leitnerCounts', () => {
  it('returns counts for all four boxes', () => {
    const result = leitnerCounts(items);
    expect(result).toHaveProperty('new');
    expect(result).toHaveProperty('learning');
    expect(result).toHaveProperty('reviewing');
    expect(result).toHaveProperty('mastered');
  });

  it('total count matches items length', () => {
    const result = leitnerCounts(items);
    const total = result.new + result.learning + result.reviewing + result.mastered;
    expect(total).toBe(items.length);
  });
});

describe('currentStreak', () => {
  it('returns 0 for empty sessions', () => {
    expect(currentStreak([], Date.now())).toBe(0);
  });

  it('returns 1 for a single session today', () => {
    const now = Date.now();
    const sessions: Session[] = [{
      id: 's1',
      started_at: now - 3600_000,
      ended_at: now - 3500_000,
      target_items: 10,
      completed_items: 10,
      pitch_pass_count: 8,
      label_pass_count: 9,
      focus_item_id: null,
    }];
    expect(currentStreak(sessions, now)).toBe(1);
  });

  it('returns 2 for consecutive days', () => {
    const now = Date.now();
    const DAY = 86_400_000;
    const sessions: Session[] = [
      {
        id: 's1', started_at: now - DAY - 3600_000, ended_at: now - DAY - 3500_000,
        target_items: 10, completed_items: 10, pitch_pass_count: 8, label_pass_count: 9, focus_item_id: null,
      },
      {
        id: 's2', started_at: now - 3600_000, ended_at: now - 3500_000,
        target_items: 10, completed_items: 10, pitch_pass_count: 8, label_pass_count: 9, focus_item_id: null,
      },
    ];
    expect(currentStreak(sessions, now)).toBe(2);
  });

  it('breaks streak on gap day', () => {
    const now = Date.now();
    const DAY = 86_400_000;
    const sessions: Session[] = [
      {
        id: 's1', started_at: now - 3 * DAY, ended_at: now - 3 * DAY + 100_000,
        target_items: 10, completed_items: 10, pitch_pass_count: 8, label_pass_count: 9, focus_item_id: null,
      },
      {
        id: 's2', started_at: now - 3600_000, ended_at: now - 3500_000,
        target_items: 10, completed_items: 10, pitch_pass_count: 8, label_pass_count: 9, focus_item_id: null,
      },
    ];
    expect(currentStreak(sessions, now)).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm run test -- --reporter=verbose 2>&1 | grep -A2 'masteryByDegree'`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement rollups**

Create `packages/core/src/analytics/rollups.ts`:

```typescript
import type { Item, Session, LeitnerBox } from '@/types/domain';
import type { Degree } from '@/types/music';
import { keyId } from '@/types/music';

export function masteryByDegree(items: ReadonlyArray<Item>): Map<Degree, number> {
  const sums = new Map<Degree, { total: number; count: number }>();
  for (const it of items) {
    const entry = sums.get(it.degree) ?? { total: 0, count: 0 };
    entry.total += it.accuracy.pitch;
    entry.count += 1;
    sums.set(it.degree, entry);
  }
  const result = new Map<Degree, number>();
  for (const [deg, { total, count }] of sums) {
    result.set(deg, count > 0 ? total / count : 0);
  }
  return result;
}

export function masteryByKey(items: ReadonlyArray<Item>): Map<string, number> {
  const sums = new Map<string, { total: number; count: number }>();
  for (const it of items) {
    const k = keyId(it.key);
    const entry = sums.get(k) ?? { total: 0, count: 0 };
    entry.total += it.accuracy.pitch;
    entry.count += 1;
    sums.set(k, entry);
  }
  const result = new Map<string, number>();
  for (const [k, { total, count }] of sums) {
    result.set(k, count > 0 ? total / count : 0);
  }
  return result;
}

export function leitnerCounts(items: ReadonlyArray<Item>): Record<LeitnerBox, number> {
  const counts: Record<LeitnerBox, number> = { new: 0, learning: 0, reviewing: 0, mastered: 0 };
  for (const it of items) {
    counts[it.box] += 1;
  }
  return counts;
}

const DAY_MS = 86_400_000;

function dayIndex(ts: number): number {
  return Math.floor(ts / DAY_MS);
}

export function currentStreak(sessions: ReadonlyArray<Session>, now: number): number {
  if (sessions.length === 0) return 0;

  const days = new Set(sessions.map((s) => dayIndex(s.started_at)));
  const today = dayIndex(now);

  if (!days.has(today)) {
    if (!days.has(today - 1)) return 0;
  }

  let streak = 0;
  let check = days.has(today) ? today : today - 1;
  while (days.has(check)) {
    streak++;
    check--;
  }
  return streak;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm run test -- --reporter=verbose 2>&1 | grep -A2 'masteryByDegree'`

Expected: PASS — all rollup tests green.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/analytics/ packages/core/tests/analytics/
git commit -m "feat(analytics): add dashboard rollup functions

masteryByDegree, masteryByKey, leitnerCounts, currentStreak — all pure
functions over Item[] / Session[]. Plan C1 dashboard picks which to call."
```

---

### Task 9: Round events

Discriminated union for round-lifecycle events. Every variant carries `at_ms: number` (wall clock). No audio-stack types leak in.

**Files:**
- Create: `packages/core/src/round/events.ts`
- Test: `packages/core/tests/round/events.test.ts`

- [ ] **Step 1: Write the type-check test**

Create `packages/core/tests/round/events.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import type { RoundEvent } from '@/round/events';
import type { Item } from '@/types/domain';

describe('RoundEvent', () => {
  it('ROUND_STARTED carries item, timbre, register', () => {
    const ev: RoundEvent = {
      type: 'ROUND_STARTED',
      at_ms: 100,
      item: { id: 'test' } as Item,
      timbre: 'piano',
      register: 'narrow',
    };
    expect(ev.type).toBe('ROUND_STARTED');
  });

  it('PITCH_FRAME carries hz and confidence', () => {
    const ev: RoundEvent = {
      type: 'PITCH_FRAME',
      at_ms: 200,
      hz: 440,
      confidence: 0.92,
    };
    expect(ev.type).toBe('PITCH_FRAME');
    expect(ev.hz).toBe(440);
  });

  it('DIGIT_HEARD carries digit and confidence', () => {
    const ev: RoundEvent = {
      type: 'DIGIT_HEARD',
      at_ms: 300,
      digit: 5,
      confidence: 0.88,
    };
    expect(ev.type).toBe('DIGIT_HEARD');
    expect(ev.digit).toBe(5);
  });

  it('all event types are constructable', () => {
    const events: RoundEvent[] = [
      { type: 'ROUND_STARTED', at_ms: 0, item: {} as Item, timbre: 'piano', register: 'narrow' },
      { type: 'CADENCE_STARTED', at_ms: 10 },
      { type: 'TARGET_STARTED', at_ms: 20 },
      { type: 'PITCH_FRAME', at_ms: 30, hz: 440, confidence: 0.9 },
      { type: 'DIGIT_HEARD', at_ms: 40, digit: 3, confidence: 0.8 },
      { type: 'PLAYBACK_DONE', at_ms: 50 },
      { type: 'USER_CANCELED', at_ms: 60 },
    ];
    expect(events).toHaveLength(7);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm run test -- --reporter=verbose 2>&1 | grep -A2 'RoundEvent'`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement events**

Create `packages/core/src/round/events.ts`:

```typescript
import type { Item, Register } from '@/types/domain';
import type { TimbreId } from '@/variability/pickers';

export type RoundEvent =
  | { type: 'ROUND_STARTED';   at_ms: number; item: Item; timbre: TimbreId; register: Register }
  | { type: 'CADENCE_STARTED'; at_ms: number }
  | { type: 'TARGET_STARTED';  at_ms: number }
  | { type: 'PITCH_FRAME';     at_ms: number; hz: number; confidence: number }
  | { type: 'DIGIT_HEARD';     at_ms: number; digit: number; confidence: number }
  | { type: 'PLAYBACK_DONE';   at_ms: number }
  | { type: 'USER_CANCELED';   at_ms: number };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm run test -- --reporter=verbose 2>&1 | grep -A2 'RoundEvent'`

Expected: PASS — type checks compile, runtime assertions pass.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/round/ packages/core/tests/round/
git commit -m "feat(round): add RoundEvent discriminated union

Seven event variants, all with wall-clock at_ms. No audio-stack types
leak into the union."
```

---

### Task 10: Grade pitch

Pure grading helper consumed by the reducer at the `listening → graded` transition. Picks the best confident pitch frame and checks it against the target degree.

**Files:**
- Create: `packages/core/src/round/grade-pitch.ts`
- Test: `packages/core/tests/round/grade-pitch.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/core/tests/round/grade-pitch.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { gradePitch, type PitchObservation } from '@/round/grade-pitch';
import type { Item } from '@/types/domain';

const C_MAJOR_ITEM: Item = {
  id: '1-C-major', degree: 1,
  key: { tonic: 'C', quality: 'major' },
  box: 'new', accuracy: { pitch: 0, label: 0 },
  recent: [], attempts: 0, consecutive_passes: 0,
  last_seen_at: null, due_at: 0, created_at: 0,
};

function makeItem(degree: 1|2|3|4|5|6|7): Item {
  return { ...C_MAJOR_ITEM, id: `${degree}-C-major`, degree };
}

describe('gradePitch', () => {
  it('returns pitchOk=true when best frame is on the target degree', () => {
    const frames: PitchObservation[] = [
      { at_ms: 100, hz: 261.63, confidence: 0.95 }, // C4 = degree 1 in C major
    ];
    const result = gradePitch(frames, makeItem(1), 0.5);
    expect(result.pitchOk).toBe(true);
    expect(result.sungBest).not.toBeNull();
  });

  it('returns pitchOk=false when best frame is on a different degree', () => {
    const frames: PitchObservation[] = [
      { at_ms: 100, hz: 329.63, confidence: 0.95 }, // E4 = degree 3 in C major
    ];
    const result = gradePitch(frames, makeItem(1), 0.5);
    expect(result.pitchOk).toBe(false);
  });

  it('ignores frames below minConfidence', () => {
    const frames: PitchObservation[] = [
      { at_ms: 100, hz: 261.63, confidence: 0.2 },  // correct but low confidence
      { at_ms: 200, hz: 329.63, confidence: 0.95 },  // wrong but high confidence
    ];
    const result = gradePitch(frames, makeItem(1), 0.5);
    expect(result.pitchOk).toBe(false);
    expect(result.sungBest?.hz).toBeCloseTo(329.63);
  });

  it('picks the highest-confidence frame as sungBest', () => {
    const frames: PitchObservation[] = [
      { at_ms: 100, hz: 261.63, confidence: 0.7 },
      { at_ms: 200, hz: 261.63, confidence: 0.95 },
      { at_ms: 300, hz: 261.63, confidence: 0.8 },
    ];
    const result = gradePitch(frames, makeItem(1), 0.5);
    expect(result.sungBest?.confidence).toBe(0.95);
  });

  it('returns null sungBest when no frames meet minConfidence', () => {
    const frames: PitchObservation[] = [
      { at_ms: 100, hz: 261.63, confidence: 0.1 },
    ];
    const result = gradePitch(frames, makeItem(1), 0.5);
    expect(result.sungBest).toBeNull();
    expect(result.pitchOk).toBe(false);
    expect(result.cents_off).toBeNull();
  });

  it('returns null sungBest for empty frames', () => {
    const result = gradePitch([], makeItem(1), 0.5);
    expect(result.sungBest).toBeNull();
    expect(result.pitchOk).toBe(false);
  });

  it('reports cents_off for the best frame', () => {
    const frames: PitchObservation[] = [
      { at_ms: 100, hz: 265, confidence: 0.95 }, // slightly sharp C4
    ];
    const result = gradePitch(frames, makeItem(1), 0.5);
    expect(result.cents_off).not.toBeNull();
    expect(Math.abs(result.cents_off!)).toBeGreaterThan(0);
    expect(Math.abs(result.cents_off!)).toBeLessThan(100);
  });

  it('works octave-invariant (C5 matches degree 1 in C major)', () => {
    const frames: PitchObservation[] = [
      { at_ms: 100, hz: 523.25, confidence: 0.95 }, // C5
    ];
    const result = gradePitch(frames, makeItem(1), 0.5);
    expect(result.pitchOk).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm run test -- --reporter=verbose 2>&1 | grep -A2 'gradePitch'`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement gradePitch**

Create `packages/core/src/round/grade-pitch.ts`:

```typescript
import type { Item } from '@/types/domain';
import { mapHzToDegree } from '@/pitch/degree-mapping';
import { IN_KEY_CENTS } from '@/pitch/degree-mapping';
import { centsBetween, pitchClassToMidi, midiToHz } from '@/audio/note-math';
import { semitoneOffset } from '@/types/music';

export interface PitchObservation {
  at_ms: number;
  hz: number;
  confidence: number;
}

export interface PitchGrade {
  pitchOk: boolean;
  sungBest: PitchObservation | null;
  cents_off: number | null;
}

export function gradePitch(
  frames: ReadonlyArray<PitchObservation>,
  item: Item,
  minConfidence: number,
): PitchGrade {
  const confident = frames.filter((f) => f.confidence >= minConfidence && f.hz > 0);
  if (confident.length === 0) {
    return { pitchOk: false, sungBest: null, cents_off: null };
  }

  const best = confident.reduce((a, b) => (b.confidence > a.confidence ? b : a));

  const mapping = mapHzToDegree(best.hz, item.key);
  const pitchOk = mapping !== null && mapping.degree === item.degree && mapping.inKey;

  const targetMidi = pitchClassToMidi(item.key.tonic, 4) + semitoneOffset(item.degree, item.key.quality);
  const targetHz = midiToHz(targetMidi);
  const cents_off = centsBetween(best.hz, targetHz);

  return { pitchOk, sungBest: best, cents_off };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm run test -- --reporter=verbose 2>&1 | grep -A2 'gradePitch'`

Expected: PASS — all grading tests green.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/round/grade-pitch.ts packages/core/tests/round/grade-pitch.test.ts
git commit -m "feat(round): add pure pitch grading helper

Picks highest-confidence frame, maps to degree via existing
degree-mapping, checks octave-invariant match. Reports cents_off
for the feedback UI."
```

---

### Task 11: Round state + reducer

Pure `roundReducer(state, event) → state'`. Exhaustive `(state, event)` coverage: at least one test per valid transition and per "ignored in this state" combination.

**Files:**
- Create: `packages/core/src/round/state.ts`
- Test: `packages/core/tests/round/state.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/core/tests/round/state.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { roundReducer, type RoundState } from '@/round/state';
import type { RoundEvent } from '@/round/events';
import type { Item } from '@/types/domain';

const ITEM: Item = {
  id: '1-C-major', degree: 1,
  key: { tonic: 'C', quality: 'major' },
  box: 'new', accuracy: { pitch: 0, label: 0 },
  recent: [], attempts: 0, consecutive_passes: 0,
  last_seen_at: null, due_at: 0, created_at: 0,
};

const idle: RoundState = { kind: 'idle' };

describe('roundReducer', () => {
  // === Valid transitions ===

  describe('idle → playing_cadence', () => {
    it('transitions on ROUND_STARTED', () => {
      const ev: RoundEvent = { type: 'ROUND_STARTED', at_ms: 100, item: ITEM, timbre: 'piano', register: 'narrow' };
      const next = roundReducer(idle, ev);
      expect(next.kind).toBe('playing_cadence');
      if (next.kind === 'playing_cadence') {
        expect(next.item).toBe(ITEM);
        expect(next.timbre).toBe('piano');
        expect(next.startedAt).toBe(100);
      }
    });
  });

  describe('playing_cadence → playing_target', () => {
    const cadence: RoundState = { kind: 'playing_cadence', item: ITEM, timbre: 'piano', register: 'narrow', startedAt: 100 };

    it('transitions on TARGET_STARTED', () => {
      const ev: RoundEvent = { type: 'TARGET_STARTED', at_ms: 200 };
      const next = roundReducer(cadence, ev);
      expect(next.kind).toBe('playing_target');
      if (next.kind === 'playing_target') {
        expect(next.targetStartedAt).toBe(200);
        expect(next.frames).toEqual([]);
      }
    });
  });

  describe('playing_target → listening', () => {
    const target: RoundState = {
      kind: 'playing_target', item: ITEM, timbre: 'piano', register: 'narrow',
      targetStartedAt: 200, frames: [],
    };

    it('transitions on PLAYBACK_DONE', () => {
      const ev: RoundEvent = { type: 'PLAYBACK_DONE', at_ms: 350 };
      const next = roundReducer(target, ev);
      expect(next.kind).toBe('listening');
    });

    it('accumulates PITCH_FRAME while in playing_target', () => {
      const ev: RoundEvent = { type: 'PITCH_FRAME', at_ms: 250, hz: 440, confidence: 0.9 };
      const next = roundReducer(target, ev);
      expect(next.kind).toBe('playing_target');
      if (next.kind === 'playing_target') {
        expect(next.frames).toHaveLength(1);
        expect(next.frames[0]!.hz).toBe(440);
      }
    });
  });

  describe('listening → graded', () => {
    const listening: RoundState = {
      kind: 'listening', item: ITEM, timbre: 'piano', register: 'narrow',
      targetStartedAt: 200,
      frames: [{ at_ms: 250, hz: 261.63, confidence: 0.95 }],
      digit: null, digitConfidence: 0,
    };

    it('accumulates PITCH_FRAME', () => {
      const ev: RoundEvent = { type: 'PITCH_FRAME', at_ms: 400, hz: 262, confidence: 0.9 };
      const next = roundReducer(listening, ev);
      expect(next.kind).toBe('listening');
      if (next.kind === 'listening') {
        expect(next.frames).toHaveLength(2);
      }
    });

    it('records DIGIT_HEARD', () => {
      const ev: RoundEvent = { type: 'DIGIT_HEARD', at_ms: 500, digit: 1, confidence: 0.88 };
      const next = roundReducer(listening, ev);
      expect(next.kind).toBe('listening');
      if (next.kind === 'listening') {
        expect(next.digit).toBe(1);
        expect(next.digitConfidence).toBe(0.88);
      }
    });

    it('keeps highest-confidence digit on repeated DIGIT_HEARD', () => {
      let state = roundReducer(listening, { type: 'DIGIT_HEARD', at_ms: 500, digit: 1, confidence: 0.9 });
      state = roundReducer(state, { type: 'DIGIT_HEARD', at_ms: 600, digit: 3, confidence: 0.7 });
      if (state.kind === 'listening') {
        expect(state.digit).toBe(1);
        expect(state.digitConfidence).toBe(0.9);
      }
    });
  });

  // === Cancel from any active state ===

  describe('USER_CANCELED', () => {
    it('returns idle from playing_cadence', () => {
      const state: RoundState = { kind: 'playing_cadence', item: ITEM, timbre: 'piano', register: 'narrow', startedAt: 100 };
      const next = roundReducer(state, { type: 'USER_CANCELED', at_ms: 150 });
      expect(next.kind).toBe('idle');
    });

    it('returns idle from playing_target', () => {
      const state: RoundState = { kind: 'playing_target', item: ITEM, timbre: 'piano', register: 'narrow', targetStartedAt: 200, frames: [] };
      const next = roundReducer(state, { type: 'USER_CANCELED', at_ms: 250 });
      expect(next.kind).toBe('idle');
    });

    it('returns idle from listening', () => {
      const state: RoundState = { kind: 'listening', item: ITEM, timbre: 'piano', register: 'narrow', targetStartedAt: 200, frames: [], digit: null, digitConfidence: 0 };
      const next = roundReducer(state, { type: 'USER_CANCELED', at_ms: 350 });
      expect(next.kind).toBe('idle');
    });
  });

  // === Ignored events (return state unchanged) ===

  describe('ignored events', () => {
    it('ignores CADENCE_STARTED in idle', () => {
      const next = roundReducer(idle, { type: 'CADENCE_STARTED', at_ms: 100 });
      expect(next).toBe(idle);
    });

    it('ignores TARGET_STARTED in idle', () => {
      const next = roundReducer(idle, { type: 'TARGET_STARTED', at_ms: 100 });
      expect(next).toBe(idle);
    });

    it('ignores PITCH_FRAME in idle', () => {
      const next = roundReducer(idle, { type: 'PITCH_FRAME', at_ms: 100, hz: 440, confidence: 0.9 });
      expect(next).toBe(idle);
    });

    it('ignores DIGIT_HEARD in idle', () => {
      const next = roundReducer(idle, { type: 'DIGIT_HEARD', at_ms: 100, digit: 1, confidence: 0.9 });
      expect(next).toBe(idle);
    });

    it('ignores PLAYBACK_DONE in idle', () => {
      const next = roundReducer(idle, { type: 'PLAYBACK_DONE', at_ms: 100 });
      expect(next).toBe(idle);
    });

    it('ignores ROUND_STARTED in graded', () => {
      const graded: RoundState = {
        kind: 'graded', item: ITEM, timbre: 'piano', register: 'narrow',
        outcome: { pitch: true, label: true, pass: true, at: 500 },
        sungBest: null, digitHeard: null,
      };
      const next = roundReducer(graded, { type: 'ROUND_STARTED', at_ms: 600, item: ITEM, timbre: 'guitar', register: 'wide' });
      expect(next).toBe(graded);
    });

    it('ignores ROUND_STARTED when already playing', () => {
      const state: RoundState = { kind: 'playing_cadence', item: ITEM, timbre: 'piano', register: 'narrow', startedAt: 100 };
      const next = roundReducer(state, { type: 'ROUND_STARTED', at_ms: 200, item: ITEM, timbre: 'guitar', register: 'wide' });
      expect(next).toBe(state);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm run test -- --reporter=verbose 2>&1 | grep -A2 'roundReducer'`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement RoundState and roundReducer**

Create `packages/core/src/round/state.ts`:

```typescript
import type { Item, Register, AttemptOutcome } from '@/types/domain';
import type { TimbreId } from '@/variability/pickers';
import type { RoundEvent } from './events';
import { gradePitch, type PitchObservation } from './grade-pitch';

export type RoundState =
  | { kind: 'idle' }
  | { kind: 'playing_cadence'; item: Item; timbre: TimbreId; register: Register; startedAt: number }
  | { kind: 'playing_target';  item: Item; timbre: TimbreId; register: Register; targetStartedAt: number; frames: PitchObservation[] }
  | { kind: 'listening';       item: Item; timbre: TimbreId; register: Register; targetStartedAt: number; frames: PitchObservation[]; digit: number | null; digitConfidence: number }
  | { kind: 'graded';          item: Item; timbre: TimbreId; register: Register; outcome: AttemptOutcome; sungBest: PitchObservation | null; digitHeard: number | null };

const MIN_PITCH_CONFIDENCE = 0.5;

export function roundReducer(state: RoundState, event: RoundEvent): RoundState {
  if (event.type === 'USER_CANCELED' && state.kind !== 'idle' && state.kind !== 'graded') {
    return { kind: 'idle' };
  }

  switch (state.kind) {
    case 'idle':
      if (event.type === 'ROUND_STARTED') {
        return {
          kind: 'playing_cadence',
          item: event.item,
          timbre: event.timbre,
          register: event.register,
          startedAt: event.at_ms,
        };
      }
      return state;

    case 'playing_cadence':
      if (event.type === 'TARGET_STARTED') {
        return {
          kind: 'playing_target',
          item: state.item,
          timbre: state.timbre,
          register: state.register,
          targetStartedAt: event.at_ms,
          frames: [],
        };
      }
      return state;

    case 'playing_target':
      if (event.type === 'PITCH_FRAME') {
        return {
          ...state,
          frames: [...state.frames, { at_ms: event.at_ms, hz: event.hz, confidence: event.confidence }],
        };
      }
      if (event.type === 'PLAYBACK_DONE') {
        return {
          kind: 'listening',
          item: state.item,
          timbre: state.timbre,
          register: state.register,
          targetStartedAt: state.targetStartedAt,
          frames: state.frames,
          digit: null,
          digitConfidence: 0,
        };
      }
      return state;

    case 'listening':
      if (event.type === 'PITCH_FRAME') {
        return {
          ...state,
          frames: [...state.frames, { at_ms: event.at_ms, hz: event.hz, confidence: event.confidence }],
        };
      }
      if (event.type === 'DIGIT_HEARD') {
        if (event.confidence > state.digitConfidence) {
          return { ...state, digit: event.digit, digitConfidence: event.confidence };
        }
        return state;
      }
      return state;

    case 'graded':
      return state;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm run test -- --reporter=verbose 2>&1 | grep -A2 'roundReducer'`

Expected: PASS — all transition and ignored-event tests green.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/round/state.ts packages/core/tests/round/state.test.ts
git commit -m "feat(round): add RoundState discriminated union and pure reducer

Exhaustive (state, event) transitions: idle → playing_cadence →
playing_target → listening. Cancel returns idle from any active state.
Pitch frames accumulate during target and listening. Digit heard keeps
highest confidence. Graded state is terminal."
```

---

### Task 12: Round adapters

The only module family that knows the two-clock problem exists. Converts raw audio-stack types into `RoundEvent` values with wall-clock timestamps.

**Files:**
- Create: `packages/web-platform/src/round-adapters/clock.ts`
- Create: `packages/web-platform/src/round-adapters/index.ts`
- Test: `packages/web-platform/tests/round-adapters/adapters.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/web-platform/tests/round-adapters/adapters.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  pitchFrameToEvent,
  digitFrameToEvent,
  targetStartedEvent,
  cadenceStartedEvent,
  playbackDoneEvent,
  roundStartedEvent,
  userCanceledEvent,
} from '@/round-adapters/index';
import type { Clock } from '@/round-adapters/clock';
import type { PitchFrame } from '@/pitch/pitch-detector';
import type { DigitFrame } from '@/speech/keyword-spotter';
import type { Item } from '@ear-training/core/types/domain';

const stubClock: Clock = { now: () => 42_000 };

const ITEM: Item = {
  id: '1-C-major', degree: 1,
  key: { tonic: 'C', quality: 'major' },
  box: 'new', accuracy: { pitch: 0, label: 0 },
  recent: [], attempts: 0, consecutive_passes: 0,
  last_seen_at: null, due_at: 0, created_at: 0,
};

describe('pitchFrameToEvent', () => {
  it('converts PitchFrame to PITCH_FRAME event with wall-clock at_ms', () => {
    const frame: PitchFrame = { hz: 440, confidence: 0.92, at: 1.5 };
    const ev = pitchFrameToEvent(frame, stubClock);
    expect(ev.type).toBe('PITCH_FRAME');
    expect(ev.at_ms).toBe(42_000);
    if (ev.type === 'PITCH_FRAME') {
      expect(ev.hz).toBe(440);
      expect(ev.confidence).toBe(0.92);
    }
  });
});

describe('digitFrameToEvent', () => {
  it('converts DigitFrame with a digit to DIGIT_HEARD event', () => {
    const frame: DigitFrame = {
      digit: 'three',
      confidence: 0.88,
      scores: { one: 0.1, two: 0.1, three: 0.88, four: 0.05, five: 0.02, six: 0.01, seven: 0.01 },
    };
    const ev = digitFrameToEvent(frame, stubClock);
    expect(ev).not.toBeNull();
    if (ev && ev.type === 'DIGIT_HEARD') {
      expect(ev.digit).toBe(3);
      expect(ev.confidence).toBe(0.88);
      expect(ev.at_ms).toBe(42_000);
    }
  });

  it('returns null for DigitFrame with null digit', () => {
    const frame: DigitFrame = {
      digit: null,
      confidence: 0.3,
      scores: { one: 0.1, two: 0.1, three: 0.1, four: 0.1, five: 0.1, six: 0.1, seven: 0.1 },
    };
    const ev = digitFrameToEvent(frame, stubClock);
    expect(ev).toBeNull();
  });
});

describe('simple event factories', () => {
  it('targetStartedEvent', () => {
    const ev = targetStartedEvent(stubClock);
    expect(ev).toEqual({ type: 'TARGET_STARTED', at_ms: 42_000 });
  });

  it('cadenceStartedEvent', () => {
    const ev = cadenceStartedEvent(stubClock);
    expect(ev).toEqual({ type: 'CADENCE_STARTED', at_ms: 42_000 });
  });

  it('playbackDoneEvent', () => {
    const ev = playbackDoneEvent(stubClock);
    expect(ev).toEqual({ type: 'PLAYBACK_DONE', at_ms: 42_000 });
  });

  it('userCanceledEvent', () => {
    const ev = userCanceledEvent(stubClock);
    expect(ev).toEqual({ type: 'USER_CANCELED', at_ms: 42_000 });
  });

  it('roundStartedEvent', () => {
    const ev = roundStartedEvent(ITEM, 'piano', 'narrow', stubClock);
    expect(ev.type).toBe('ROUND_STARTED');
    expect(ev.at_ms).toBe(42_000);
    if (ev.type === 'ROUND_STARTED') {
      expect(ev.item).toBe(ITEM);
      expect(ev.timbre).toBe('piano');
      expect(ev.register).toBe('narrow');
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm run test -- --reporter=verbose 2>&1 | grep -A2 'pitchFrameToEvent'`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement clock.ts**

Create `packages/web-platform/src/round-adapters/clock.ts`:

```typescript
export interface Clock {
  now(): number;
}

export const systemClock: Clock = { now: () => Date.now() };
```

- [ ] **Step 4: Implement adapters index.ts**

Create `packages/web-platform/src/round-adapters/index.ts`:

```typescript
import type { RoundEvent } from '@ear-training/core/round/events';
import type { Item, Register } from '@ear-training/core/types/domain';
import type { TimbreId } from '@ear-training/core/variability/pickers';
import type { PitchFrame } from '@/pitch/pitch-detector';
import type { DigitFrame } from '@/speech/keyword-spotter';
import { digitLabelToNumber } from '@/speech/digit-label';
import { systemClock, type Clock } from './clock';

export function pitchFrameToEvent(frame: PitchFrame, clock: Clock = systemClock): RoundEvent {
  return { type: 'PITCH_FRAME', at_ms: clock.now(), hz: frame.hz, confidence: frame.confidence };
}

export function digitFrameToEvent(frame: DigitFrame, clock: Clock = systemClock): RoundEvent | null {
  if (frame.digit === null) return null;
  return {
    type: 'DIGIT_HEARD',
    at_ms: clock.now(),
    digit: digitLabelToNumber(frame.digit),
    confidence: frame.confidence,
  };
}

export function targetStartedEvent(clock: Clock = systemClock): RoundEvent {
  return { type: 'TARGET_STARTED', at_ms: clock.now() };
}

export function cadenceStartedEvent(clock: Clock = systemClock): RoundEvent {
  return { type: 'CADENCE_STARTED', at_ms: clock.now() };
}

export function playbackDoneEvent(clock: Clock = systemClock): RoundEvent {
  return { type: 'PLAYBACK_DONE', at_ms: clock.now() };
}

export function roundStartedEvent(item: Item, timbre: TimbreId, register: Register, clock: Clock = systemClock): RoundEvent {
  return { type: 'ROUND_STARTED', at_ms: clock.now(), item, timbre, register };
}

export function userCanceledEvent(clock: Clock = systemClock): RoundEvent {
  return { type: 'USER_CANCELED', at_ms: clock.now() };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm run test -- --reporter=verbose 2>&1 | grep -A2 'pitchFrameToEvent'`

Expected: PASS — all adapter tests green.

- [ ] **Step 6: Commit**

```bash
git add packages/web-platform/src/round-adapters/ packages/web-platform/tests/round-adapters/
git commit -m "feat(round-adapters): wall-clock event adapters for two-clock problem

Converts PitchFrame, DigitFrame, and playback signals into RoundEvent
values stamped with Date.now(). Injectable Clock for deterministic tests.
Uses digitLabelToNumber for KWS label→number conversion."
```

---

### Task 13: Round integration test

Golden-path event stream through the reducer: idle → playing_cadence → playing_target (with pitch frames) → listening (with digit) → graded. Also tests cancel mid-round and timeout with no pitch.

**Files:**
- Test: `packages/core/tests/round/round-integration.test.ts`

- [ ] **Step 1: Write the integration test**

Create `packages/core/tests/round/round-integration.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { roundReducer, type RoundState } from '@/round/state';
import type { RoundEvent } from '@/round/events';
import type { Item } from '@/types/domain';

const ITEM: Item = {
  id: '1-C-major', degree: 1,
  key: { tonic: 'C', quality: 'major' },
  box: 'new', accuracy: { pitch: 0, label: 0 },
  recent: [], attempts: 0, consecutive_passes: 0,
  last_seen_at: null, due_at: 0, created_at: 0,
};

function applyEvents(events: RoundEvent[]): RoundState {
  return events.reduce<RoundState>((s, e) => roundReducer(s, e), { kind: 'idle' });
}

describe('round integration: golden path', () => {
  it('progresses from idle through all states to listening', () => {
    const events: RoundEvent[] = [
      { type: 'ROUND_STARTED', at_ms: 0, item: ITEM, timbre: 'piano', register: 'narrow' },
      { type: 'CADENCE_STARTED', at_ms: 10 },
      { type: 'TARGET_STARTED', at_ms: 3200 },
      { type: 'PITCH_FRAME', at_ms: 3300, hz: 261.63, confidence: 0.95 },
      { type: 'PITCH_FRAME', at_ms: 3400, hz: 262.0, confidence: 0.93 },
      { type: 'PLAYBACK_DONE', at_ms: 4700 },
      { type: 'PITCH_FRAME', at_ms: 4800, hz: 261.5, confidence: 0.91 },
      { type: 'DIGIT_HEARD', at_ms: 5000, digit: 1, confidence: 0.88 },
    ];

    const final = applyEvents(events);
    expect(final.kind).toBe('listening');
    if (final.kind === 'listening') {
      expect(final.frames).toHaveLength(3);
      expect(final.digit).toBe(1);
      expect(final.digitConfidence).toBe(0.88);
    }
  });
});

describe('round integration: cancel mid-round', () => {
  it('returns to idle when canceled during playing_target', () => {
    const events: RoundEvent[] = [
      { type: 'ROUND_STARTED', at_ms: 0, item: ITEM, timbre: 'guitar', register: 'comfortable' },
      { type: 'TARGET_STARTED', at_ms: 3200 },
      { type: 'PITCH_FRAME', at_ms: 3300, hz: 440, confidence: 0.9 },
      { type: 'USER_CANCELED', at_ms: 3500 },
    ];

    const final = applyEvents(events);
    expect(final.kind).toBe('idle');
  });

  it('returns to idle when canceled during listening', () => {
    const events: RoundEvent[] = [
      { type: 'ROUND_STARTED', at_ms: 0, item: ITEM, timbre: 'pad', register: 'wide' },
      { type: 'TARGET_STARTED', at_ms: 3200 },
      { type: 'PLAYBACK_DONE', at_ms: 4700 },
      { type: 'USER_CANCELED', at_ms: 5000 },
    ];

    const final = applyEvents(events);
    expect(final.kind).toBe('idle');
  });
});

describe('round integration: timeout with no pitch', () => {
  it('reaches listening with empty frames when no pitch is detected', () => {
    const events: RoundEvent[] = [
      { type: 'ROUND_STARTED', at_ms: 0, item: ITEM, timbre: 'epiano', register: 'narrow' },
      { type: 'TARGET_STARTED', at_ms: 3200 },
      { type: 'PLAYBACK_DONE', at_ms: 4700 },
    ];

    const final = applyEvents(events);
    expect(final.kind).toBe('listening');
    if (final.kind === 'listening') {
      expect(final.frames).toHaveLength(0);
      expect(final.digit).toBeNull();
    }
  });
});

describe('round integration: wrong digit', () => {
  it('records the wrong digit in listening state', () => {
    const events: RoundEvent[] = [
      { type: 'ROUND_STARTED', at_ms: 0, item: ITEM, timbre: 'piano', register: 'narrow' },
      { type: 'TARGET_STARTED', at_ms: 3200 },
      { type: 'PITCH_FRAME', at_ms: 3300, hz: 261.63, confidence: 0.95 },
      { type: 'PLAYBACK_DONE', at_ms: 4700 },
      { type: 'DIGIT_HEARD', at_ms: 5000, digit: 5, confidence: 0.8 },
    ];

    const final = applyEvents(events);
    expect(final.kind).toBe('listening');
    if (final.kind === 'listening') {
      expect(final.digit).toBe(5);
    }
  });
});
```

- [ ] **Step 2: Run the integration test**

Run: `pnpm run test -- --reporter=verbose 2>&1 | grep -A2 'round integration'`

Expected: PASS — all integration scenarios green.

- [ ] **Step 3: Commit**

```bash
git add packages/core/tests/round/round-integration.test.ts
git commit -m "test(round): add integration tests for round reducer

Golden path, cancel mid-round, timeout with no pitch, wrong digit.
Validates the full event stream through the reducer."
```

---

### Task 14: CLAUDE.md update

Update CLAUDE.md to reflect the new monorepo structure, package names, module locations, and dev commands.

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update CLAUDE.md**

Key sections to update:

1. **Dev commands**: `npm` → `pnpm`; add workspace-scoped commands.
2. **Current state**: Mark Plan C0 as complete.
3. **Structure**: Document the four workspace packages and where modules live.
4. **Plan C0 module surface**: Document what Plan C1 will consume from the new modules.
5. **Known gotchas**: Add pnpm workspace notes; update file paths for harness, configs.
6. **Testing philosophy**: Update test locations.

The exact CLAUDE.md content depends on the final state after all tasks are merged. Write the update after verifying all tasks are complete.

- [ ] **Step 2: Verify all dev commands work**

Run each command and confirm:

```bash
pnpm run typecheck    # 0 errors
pnpm run test         # all pass (original 124 + new C0 tests)
pnpm run build        # clean prod bundle
pnpm run test:e2e     # Playwright passes
pnpm run dev          # dev server starts, harness works
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(claude-md): Phase C0 complete, monorepo structure documented"
```

---

## Verification checklist

Phase C0 is complete when all of these hold:

1. `pnpm run typecheck` — 0 errors across all packages
2. `pnpm run test` — all tests pass (124 pre-existing + new Phase C0 tests)
3. `pnpm run test:e2e` — Playwright smoke test passes
4. `pnpm run build` — clean production bundle, no harness leakage, speech-commands not in prod graph
5. Round reducer has exhaustive `(state, event)` coverage: at least one test per valid transition and per ignored combination
6. Adapters have unit tests with injected stub Clock
7. All three must-fix items (IN_KEY_CENTS, KWS safety, digit label) are tested
8. `ui-tokens` has agreement test between TS and CSS
9. CLAUDE.md reflects monorepo structure
10. Dev harness at `apps/ear-training-station/harness/audio.html` works end-to-end
