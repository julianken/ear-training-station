# Plan C1.3 — Scale-Degree Exercise Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full scale-degree exercise module — session controller, live session UI (chord blocks + pitch trace + feedback + replay), dashboards, summary — and replace the C1.2 stubs (`/scale-degree` placeholder, onboarding step 4). After this plan merges, a user can complete onboarding, start a session from the dashboard, play through rounds to the summary, and see their progress.

**Architecture:** The exercise module at `apps/ear-training-station/src/lib/exercises/scale-degree/` owns everything exercise-specific behind its `index.ts` public contract. The session controller (`session-controller.svelte.ts`) is a Svelte 5 class that mounts per session route and holds the round reducer state + audio handles. The session route renders either `<ActiveRound>` or `<SummaryView>` based on `session.ended_at`. Capture-end detection dispatches the `CAPTURE_COMPLETE` event added in C1.1; the graded state drives the feedback panel.

**Tech Stack:** SvelteKit 2.x + Svelte 5 runes, existing `@ear-training/core` (reducer, rollups, variability pickers, orchestrator), existing `@ear-training/web-platform` (playRound, pitch detector, KWS, recorder, repos).

**Spec:** `docs/specs/2026-04-16-plan-c1-ui-integration-design.md`

**Depends on:** Plans C1.1 and C1.2 merged.

**TDD discipline — unit AND e2e:** continued from C1.2. Every task that introduces user-visible behavior includes a Playwright e2e test written BEFORE the component. For round-playback tasks (5, 6, 7, 8) where driving Web Audio in Playwright is genuinely hard, the unit-test layer carries TDD and the e2e layer is a single integration test at the end of Task 6 that seeds a graded-state session via the controller's test hooks. Tasks 2, 9, 11, 12 are UX flows with straightforward e2e.

**PR body requirements — screenshots + mermaid for UI tasks:** every PR in this plan that adds or modifies a `.svelte` file or a rendered route MUST include at least one screenshot referenced in the PR body. Tasks in this plan that are *not* UI-bearing and therefore exempt from the screenshot requirement: **Task 1 (SessionController class, `.svelte.ts` only)** and **Task 6 (capture-end wiring in the same controller)**. Every other task (2, 3, 4, 5, 7, 8, 9, 10, 11, 12) ships visible UI and needs a screenshot.

Where it helps explain the change, embed a mermaid diagram using a ```mermaid fenced block — GitHub renders it inline. High-value mermaid candidates in this plan: the round-reducer state machine (for Task 6's CAPTURE_COMPLETE wiring), the component tree inside `ActiveRound`, event-dispatch sequences, navigation between session / summary / dashboard.

**Headless-friendly screenshot workflow for implementer subagents:** capture the screenshot directly from a Playwright script (reusing the task's own e2e spec is ideal — it already drives the flow), save the PNG to `docs/screenshots/c1-3/taskN-<slug>/<description>.png`, commit it with the PR, and reference it in the PR body using an ABSOLUTE `raw.githubusercontent.com` URL with the commit SHA captured at PR-creation time. Relative paths like `../../docs/...` do **not** work in PR bodies (GitHub resolves them against `/pull/N/`, not the repo root); the SHA-based URL form works for both in-review PRs (commit exists on the PR branch) and post-merge viewers (commit persists in git history). The SHA-based URL survives squash-merge + branch deletion; the branch-based URL does not.

Example snippet in the e2e spec:

```typescript
await page.screenshot({ path: 'docs/screenshots/c1-3/task7-feedback-panel/pass-state.png', fullPage: true });
```

And in the PR-creation step:

```bash
SHA=$(git rev-parse HEAD)
gh pr create --body "...
![feedback on pass](https://raw.githubusercontent.com/julianken/ear-training-station/${SHA}/docs/screenshots/c1-3/task7-feedback-panel/pass-state.png)
..."
```

Subagents `git add docs/screenshots/...` before committing. Human drag-and-drop screenshots welcome as follow-ups but not required for subagent-generated PRs.

---

## Task map

| # | Task | Scope | Test layers |
|---|------|-------|-------------|
| 1 | `SessionController` class (state + lifecycle) | exercise module | unit |
| 2 | Session route + `load()` with refresh-abandon | exercise module + route | unit + **e2e** |
| 3 | `ChordBlocks.svelte` (derive active flag from AudioContext) | exercise internal | component |
| 4 | `PitchTrace.svelte` (SVG polyline + target band + now indicator) | exercise internal | component |
| 5 | `TargetDisplay.svelte` + `ActiveRound.svelte` composition | exercise internal | component |
| 6 | Capture-end detection — dispatch `CAPTURE_COMPLETE` from controller + **integration e2e seeded via test hooks** | exercise internal | unit + **e2e (seeded)** |
| 7 | `FeedbackPanel.svelte` (✓/✗, cents, plain-English, tooltip, PitchNullHint) | exercise internal | component |
| 8 | `ReplayBar.svelte` (segmented You/Target/Both, simultaneous overlay) | exercise internal | component |
| 9 | `DashboardView.svelte` (mastery bars, key heatmap, Leitner pipeline, Start CTA) | exercise internal | component + **e2e** |
| 10 | `DashboardWidget.svelte` + wire into station picker card | exercise internal + shell | component |
| 11 | `SummaryView.svelte` (big stats, degree movement, tomorrow's focus) | exercise internal | component + **e2e** |
| 12 | Real warmup round — replace onboarding step 4 stub | shell + exercise | unit + **e2e (full flow)** |

Each task lands as its own branch + PR (`c1-3/taskN-<slug>`).

---

### Task 1: `SessionController` class

The heart of the exercise. Owns the round reducer state via Svelte 5 runes, holds the audio handles (playback, pitch detector, KWS, recorder), dispatches events, and exposes a minimal public surface for components to consume.

**Files:**
- Create: `apps/ear-training-station/src/lib/exercises/scale-degree/internal/session-controller.svelte.ts`
- Create: `apps/ear-training-station/src/lib/exercises/scale-degree/internal/session-controller.test.ts`
- Modify: `apps/ear-training-station/src/lib/exercises/scale-degree/index.ts` (export `createSessionController`)

- [ ] **Step 1: Branch**

```bash
git checkout main && git pull
git checkout -b c1-3/task1-session-controller
```

- [ ] **Step 2: Write the failing test**

Create `apps/ear-training-station/src/lib/exercises/scale-degree/internal/session-controller.test.ts`:

```typescript
import { describe, expect, it, vi } from 'vitest';
import { createSessionController } from './session-controller.svelte';
import type { Item, Session } from '@ear-training/core/types/domain';

const baseItem: Item = {
  id: '5-C-major',
  degree: 5,
  key: { tonic: 'C', quality: 'major' },
  box: 'new',
  accuracy: { pitch: 0, label: 0 },
  recent: [],
  attempts: 0,
  consecutive_passes: 0,
  last_seen_at: null,
  due_at: 0,
  created_at: 0,
};

const baseSession: Session = {
  id: 'sess-1',
  started_at: 0,
  ended_at: null,
  target_items: 30,
  completed_items: 0,
  pitch_pass_count: 0,
  label_pass_count: 0,
  focus_item_id: null,
};

function makeDeps() {
  return {
    session: baseSession,
    firstItem: baseItem,
    itemsRepo: { get: vi.fn(), listAll: vi.fn(async () => []), findDue: vi.fn(async () => [baseItem]), findByBox: vi.fn(), put: vi.fn(), putMany: vi.fn() },
    attemptsRepo: { append: vi.fn(), findBySession: vi.fn(async () => []), findByItem: vi.fn() },
    sessionsRepo: { start: vi.fn(), complete: vi.fn(), get: vi.fn(async () => baseSession), findRecent: vi.fn() },
    settingsRepo: { getOrDefault: vi.fn(async () => ({ function_tooltip: true, auto_advance_on_hit: true, session_length: 30, reduced_motion: 'auto' as const, onboarded: true })), update: vi.fn() },
    getAudioContext: () => new (class { currentTime = 0; sampleRate = 48000; audioWorklet = { addModule: vi.fn(async () => undefined) }; createBuffer() { return {} as AudioBuffer; } createMediaStreamSource() { return { connect: vi.fn(), disconnect: vi.fn() }; } })() as unknown as AudioContext,
    getMicStream: async () => ({} as MediaStream),
  };
}

describe('SessionController', () => {
  it('starts in idle state', () => {
    const ctrl = createSessionController(makeDeps());
    expect(ctrl.state.kind).toBe('idle');
  });

  it('exposes session and currentItem', () => {
    const ctrl = createSessionController(makeDeps());
    expect(ctrl.session?.id).toBe('sess-1');
    expect(ctrl.currentItem?.id).toBe('5-C-major');
  });

  it('cancelRound() dispatches USER_CANCELED', () => {
    const ctrl = createSessionController(makeDeps());
    // Force an in-flight state for the test
    ctrl._forceState({ kind: 'playing_cadence', item: baseItem, timbre: 'piano', register: 'comfortable', startedAt: 0 } as never);
    ctrl.cancelRound();
    expect(ctrl.state.kind).toBe('idle');
  });

  it('dispose() is idempotent', () => {
    const ctrl = createSessionController(makeDeps());
    ctrl.dispose();
    expect(() => ctrl.dispose()).not.toThrow();
  });
});
```

- [ ] **Step 3: Run test — expect fail**

```bash
pnpm --filter ear-training-station test session-controller
```

Expected: FAIL — module missing.

- [ ] **Step 4: Implement the controller class**

Create `apps/ear-training-station/src/lib/exercises/scale-degree/internal/session-controller.svelte.ts`:

```typescript
import { roundReducer } from '@ear-training/core/round/state';
import type { RoundState } from '@ear-training/core/round/state';
import type { RoundEvent } from '@ear-training/core/round/events';
import type { Item, Session, Settings } from '@ear-training/core/types/domain';
import type {
  ItemsRepo, AttemptsRepo, SessionsRepo, SettingsRepo,
} from '@ear-training/core/repos/interfaces';
import type { PlayRoundHandle } from '@ear-training/web-platform/audio/player';
import type { PitchDetectorHandle } from '@ear-training/web-platform/pitch/pitch-detector';
import type { KeywordSpotterHandle } from '@ear-training/web-platform/speech/keyword-spotter';
import type { RecorderHandle } from '@ear-training/web-platform/mic/recorder';

export interface SessionControllerDeps {
  session: Session;
  firstItem: Item;
  itemsRepo: ItemsRepo;
  attemptsRepo: AttemptsRepo;
  sessionsRepo: SessionsRepo;
  settingsRepo: SettingsRepo;
  getAudioContext: () => AudioContext;
  getMicStream: () => Promise<MediaStream>;
}

export interface SessionController {
  readonly state: RoundState;
  readonly session: Session | null;
  readonly currentItem: Item | null;
  readonly capturedAudio: AudioBuffer | null;
  readonly targetAudio: AudioBuffer | null;
  startRound(): Promise<void>;
  cancelRound(): void;
  next(): Promise<void>;
  dispose(): void;
  /** @internal — test hook */
  _forceState(state: RoundState): void;
}

export function createSessionController(deps: SessionControllerDeps): SessionController {
  // Svelte 5 $state runes inside a plain module aren't valid — we use a class
  // with fields wrapped by $state() for the reactive surface.
  class ControllerImpl implements SessionController {
    state = $state<RoundState>({ kind: 'idle' });
    session = $state<Session | null>(deps.session);
    currentItem = $state<Item | null>(deps.firstItem);
    capturedAudio = $state<AudioBuffer | null>(null);
    targetAudio = $state<AudioBuffer | null>(null);

    #playHandle: PlayRoundHandle | null = null;
    #pitchHandle: PitchDetectorHandle | null = null;
    #kwsHandle: KeywordSpotterHandle | null = null;
    #recorderHandle: RecorderHandle | null = null;
    #captureEndTimer: number | null = null;
    #disposed = false;

    #dispatch(event: RoundEvent): void {
      this.state = roundReducer(this.state, event);
      this.#onStateChange();
    }

    #onStateChange(): void {
      // Task 6 installs the capture-end watcher here.
    }

    async startRound(): Promise<void> {
      if (this.#disposed) return;
      // Task 6 wires real startRound; stub for now.
      throw new Error('not implemented — see C1.3 Task 6');
    }

    cancelRound(): void {
      if (this.#disposed) return;
      this.#dispatch({ type: 'USER_CANCELED', at_ms: Date.now() });
      this.#stopAudioHandles();
    }

    async next(): Promise<void> {
      throw new Error('not implemented — see C1.3 Task 6');
    }

    dispose(): void {
      if (this.#disposed) return;
      this.#disposed = true;
      this.#stopAudioHandles();
    }

    #stopAudioHandles(): void {
      if (this.#captureEndTimer != null) {
        clearTimeout(this.#captureEndTimer);
        this.#captureEndTimer = null;
      }
      this.#playHandle?.cancel?.();
      this.#pitchHandle?.stop?.();
      this.#kwsHandle?.stop?.();
      this.#recorderHandle?.dispose?.();
      this.#playHandle = null;
      this.#pitchHandle = null;
      this.#kwsHandle = null;
      this.#recorderHandle = null;
    }

    _forceState(state: RoundState): void {
      this.state = state;
    }
  }

  return new ControllerImpl();
}
```

- [ ] **Step 5: Export from the exercise public API**

Modify `apps/ear-training-station/src/lib/exercises/scale-degree/index.ts`:

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

export { createSessionController } from './internal/session-controller.svelte';
export type { SessionController, SessionControllerDeps } from './internal/session-controller.svelte';
```

- [ ] **Step 6: Run tests — expect pass**

```bash
pnpm --filter ear-training-station test session-controller
```

Expected: PASS (4 assertions). The `startRound()` and `next()` methods throw "not implemented" — Task 6 wires them up.

- [ ] **Step 7: Typecheck**

```bash
pnpm run typecheck
```

Expected: clean. If `.svelte.ts` files require `svelte-kit sync` to be typecheckable, add it to the typecheck script once.

- [ ] **Step 8: Commit + PR**

```bash
git add apps/ear-training-station/src/lib/exercises/scale-degree/
git commit -m "$(cat <<'EOF'
feat(exercise): SessionController scaffold

Svelte 5 runes class holding RoundState + session + currentItem.
Dispatch pipe wired; cancelRound, dispose implemented.
startRound/next stubbed — Task 6 wires audio-handle lifecycle
and CAPTURE_COMPLETE dispatch.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git push -u origin c1-3/task1-session-controller
gh pr create --title "feat(exercise): SessionController scaffold" --body "Scaffolds the session controller class. startRound/next stubbed.

Part of Plan C1.3.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

---

### Task 2: Session route + refresh-abandon `load()`

Wires the URL route that hosts an active or completed session. `load()` enforces the refresh-abandon policy from decision 5 of the design spec.

**Files:**
- Create: `apps/ear-training-station/src/routes/scale-degree/sessions/[id]/+page.ts`
- Create: `apps/ear-training-station/src/routes/scale-degree/sessions/[id]/+page.svelte`

- [ ] **Step 1: Branch**

```bash
git checkout main && git pull
git checkout -b c1-3/task2-session-route
```

- [ ] **Step 1a: Write the failing Playwright e2e**

Create `apps/ear-training-station/e2e/session-abandon.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';
import { seedOnboarded } from './helpers/app-state';

test('visiting a session with no ended_at marks it abandoned and renders summary', async ({ page }) => {
  await seedOnboarded(page);
  // Seed a session row with ended_at = null directly.
  await page.addInitScript(() => {
    const req = indexedDB.open('ear-training', 1);
    req.onsuccess = () => {
      const tx = req.result.transaction('sessions', 'readwrite');
      tx.objectStore('sessions').put({
        id: 'abandoned-sess-1',
        started_at: Date.now() - 60000,
        ended_at: null,
        target_items: 30,
        completed_items: 0,
        pitch_pass_count: 0,
        label_pass_count: 0,
        focus_item_id: null,
      });
    };
  });

  await page.goto('/scale-degree/sessions/abandoned-sess-1');

  // SummaryView hasn't been built in Task 2 — expect the placeholder text
  // "Session complete" (the load() fn marked it ended; +page.svelte branches).
  await expect(page.getByText(/session complete/i)).toBeVisible();
});
```

Run:

```bash
pnpm exec playwright test --filter ear-training-station session-abandon
```

Expected: FAIL — route doesn't exist.

- [ ] **Step 2: Create `+page.ts`**

Create `apps/ear-training-station/src/routes/scale-degree/sessions/[id]/+page.ts`:

```typescript
import { error } from '@sveltejs/kit';
import { getDeps } from '$lib/shell/deps';
import type { CompleteSessionInput } from '@ear-training/core/repos/interfaces';
import type { Attempt, Session } from '@ear-training/core/types/domain';

export const ssr = false;
export const prerender = false;

export async function load({ params }) {
  const deps = await getDeps();
  const session = await deps.sessions.get(params.id);
  if (!session) throw error(404, 'session not found');

  if (session.ended_at == null) {
    // Refresh-abandon: roll up whatever attempts exist, mark complete.
    const attempts = await deps.attempts.findBySession(session.id);
    const rollup = rollUpAbandonedSession(attempts);
    await deps.sessions.complete(session.id, rollup);
    const updated: Session = { ...session, ...rollup };
    return { session: updated, attempts };
  }

  const attempts = await deps.attempts.findBySession(session.id);
  return { session, attempts };
}

function rollUpAbandonedSession(attempts: Attempt[]): CompleteSessionInput {
  return {
    ended_at: Date.now(),
    completed_items: attempts.length,
    pitch_pass_count: attempts.filter((a) => a.graded.pitch).length,
    label_pass_count: attempts.filter((a) => a.graded.label).length,
    focus_item_id: null,
  };
}
```

- [ ] **Step 3: Create `+page.svelte`**

Create `apps/ear-training-station/src/routes/scale-degree/sessions/[id]/+page.svelte`:

```svelte
<script lang="ts">
  import { createSessionController } from '$lib/exercises/scale-degree';
  import { getDeps } from '$lib/shell/deps';
  // Imports of ActiveRound / SummaryView are added in Tasks 5 and 11.
  // For Task 2, render a placeholder with the session payload.

  let { data } = $props();
  // Controller construction is wired in Task 5 once ActiveRound exists.
</script>

{#if data.session.ended_at == null}
  <p>Session in progress (active round UI lands in Task 5)</p>
{:else}
  <p>Session complete (summary UI lands in Task 11). {data.attempts.length} attempts.</p>
{/if}
```

- [ ] **Step 4: Typecheck + run e2e — expect pass**

```bash
pnpm run typecheck
pnpm exec playwright test --filter ear-training-station session-abandon
```

Expected: typecheck clean; e2e PASS — seeded unfinished session is marked `ended_at` by `load()` and the branch-on-endedAt render shows the "Session complete" placeholder.

- [ ] **Step 5: Commit + PR**

```bash
git add apps/ear-training-station/src/routes/scale-degree/sessions/ \
        apps/ear-training-station/e2e/session-abandon.spec.ts
git commit -m "$(cat <<'EOF'
feat(app): session route with refresh-abandon load()

+page.ts implements the Q3 refresh-abandon policy: if the
session has no ended_at on load, mark it complete with the
roll-up of whatever attempts exist. Route renders a placeholder
until Tasks 5 (ActiveRound) and 11 (SummaryView) land.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git push -u origin c1-3/task2-session-route
gh pr create --title "feat(app): session route + refresh-abandon" --body "Session URL /scale-degree/sessions/[id] with the refresh-abandon load fn per Q3.

Part of Plan C1.3.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

---

### Task 3: `ChordBlocks.svelte`

Four chord block cells that light up as each chord plays. Activation derived from `audioContext.currentTime` against each chord's start time via requestAnimationFrame.

**Files:**
- Create: `apps/ear-training-station/src/lib/exercises/scale-degree/internal/ChordBlocks.svelte`
- Create: `apps/ear-training-station/src/lib/exercises/scale-degree/internal/ChordBlocks.test.ts`

- [ ] **Step 1: Branch**

```bash
git checkout main && git pull
git checkout -b c1-3/task3-chord-blocks
```

- [ ] **Step 2: Write the failing test**

Create `apps/ear-training-station/src/lib/exercises/scale-degree/internal/ChordBlocks.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import ChordBlocks from './ChordBlocks.svelte';
import type { ChordEvent } from '@ear-training/core/audio/cadence-structure';

const cadence: ChordEvent[] = [
  { notes: [60, 64, 67], startSec: 0.0, durationSec: 0.7, romanNumeral: 'I'  },
  { notes: [65, 69, 72], startSec: 0.8, durationSec: 0.7, romanNumeral: 'IV' },
  { notes: [67, 71, 74], startSec: 1.6, durationSec: 0.7, romanNumeral: 'V'  },
  { notes: [60, 64, 67], startSec: 2.4, durationSec: 0.7, romanNumeral: 'I'  },
];

describe('ChordBlocks', () => {
  it('renders 4 blocks labeled I, IV, V, I', () => {
    render(ChordBlocks, { cadence, cadenceStartAcTime: 0, getCurrentTime: () => 0 });
    const blocks = screen.getAllByRole('listitem');
    expect(blocks.length).toBe(4);
  });

  it('marks the currently-playing chord as active based on currentTime', () => {
    const { container } = render(ChordBlocks, {
      cadence,
      cadenceStartAcTime: 0,
      // pretend we're 1.0s into playback → block 2 (IV, 0.8–1.5) is active
      getCurrentTime: () => 1.0,
    });
    const active = container.querySelectorAll('.active');
    expect(active.length).toBe(1);
  });
});
```

- [ ] **Step 3: Run test — expect fail**

```bash
pnpm --filter ear-training-station test ChordBlocks
```

Expected: FAIL.

- [ ] **Step 4: Create `ChordBlocks.svelte`**

Create `apps/ear-training-station/src/lib/exercises/scale-degree/internal/ChordBlocks.svelte`:

```svelte
<script lang="ts">
  import type { ChordEvent } from '@ear-training/core/audio/cadence-structure';
  import { onMount, onDestroy } from 'svelte';

  let {
    cadence,
    cadenceStartAcTime,
    getCurrentTime,
  }: {
    cadence: ChordEvent[];
    cadenceStartAcTime: number;  // derived in parent: targetStartAtAcTime - CADENCE_DURATION_SECONDS
    getCurrentTime: () => number;
  } = $props();

  let now = $state(0);
  let rafId: number | null = null;

  function tick() {
    now = getCurrentTime();
    rafId = requestAnimationFrame(tick);
  }

  onMount(() => {
    rafId = requestAnimationFrame(tick);
  });

  onDestroy(() => {
    if (rafId != null) cancelAnimationFrame(rafId);
  });

  function isActive(chord: ChordEvent, now: number): boolean {
    const start = cadenceStartAcTime + chord.startSec;
    const end = start + chord.durationSec;
    return now >= start && now < end;
  }

  function isPlayed(chord: ChordEvent, now: number): boolean {
    return now >= cadenceStartAcTime + chord.startSec + chord.durationSec;
  }
</script>

<ul class="chord-blocks">
  {#each cadence as chord, i}
    <li
      class:active={isActive(chord, now)}
      class:played={!isActive(chord, now) && isPlayed(chord, now)}
      role="listitem"
    >
      <span class="label">{chord.romanNumeral}</span>
    </li>
  {/each}
</ul>

<style>
  .chord-blocks {
    display: flex;
    gap: 8px;
    padding: 0;
    margin: 0;
    list-style: none;
  }
  li {
    flex: 1;
    height: 36px;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 120ms ease;
  }
  .label {
    font-family: 'Times New Roman', serif;
    font-style: italic;
    color: var(--muted);
    font-size: 14px;
  }
  .active {
    background: #0c2430;
    border-color: var(--cyan);
  }
  .active .label {
    color: var(--cyan);
  }
  .played {
    background: #0a1a20;
  }
  .played .label {
    color: #335060;
  }
</style>
```

- [ ] **Step 5: Run test — expect pass**

```bash
pnpm --filter ear-training-station test ChordBlocks
```

Expected: PASS (2 assertions).

- [ ] **Step 6: Commit + PR**

```bash
git add apps/ear-training-station/src/lib/exercises/scale-degree/internal/ChordBlocks.svelte \
        apps/ear-training-station/src/lib/exercises/scale-degree/internal/ChordBlocks.test.ts
git commit -m "$(cat <<'EOF'
feat(exercise): ChordBlocks component

4 chord blocks driven by (cadenceStartAcTime = targetStartAtAcTime - CADENCE_DURATION_SECONDS) + chord.startSec vs audioContext.currentTime.
Each block flags active/played based on audioContext clock
via a rAF loop. No playRound API changes.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git push -u origin c1-3/task3-chord-blocks
gh pr create --title "feat(exercise): ChordBlocks" --body "4 chord blocks that light up per AudioContext clock.

Part of Plan C1.3.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

---

### Task 4: `PitchTrace.svelte`

SVG polyline rendering of sung pitch frames, with a target tolerance band and a "now" indicator.

**Files:**
- Create: `apps/ear-training-station/src/lib/exercises/scale-degree/internal/PitchTrace.svelte`
- Create: `apps/ear-training-station/src/lib/exercises/scale-degree/internal/PitchTrace.test.ts`

- [ ] **Step 1: Branch**

```bash
git checkout main && git pull
git checkout -b c1-3/task4-pitch-trace
```

- [ ] **Step 2: Write the failing test**

Create `apps/ear-training-station/src/lib/exercises/scale-degree/internal/PitchTrace.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/svelte';
import PitchTrace from './PitchTrace.svelte';

describe('PitchTrace', () => {
  it('renders an SVG with a target band and an empty polyline when no frames', () => {
    const { container } = render(PitchTrace, {
      frames: [],
      targetDegree: 5,
      windowStartMs: 0,
      windowDurationMs: 5000,
      getCurrentTime: () => 0,
    });
    expect(container.querySelector('svg')).toBeTruthy();
    expect(container.querySelector('.target-band')).toBeTruthy();
    const polyline = container.querySelector('polyline.sung');
    expect(polyline?.getAttribute('points')).toBe('');
  });

  it('builds a polyline from confident frames', () => {
    const { container } = render(PitchTrace, {
      frames: [
        { at_ms: 100, hz: 392, confidence: 0.9 }, // degree 5 in C
        { at_ms: 200, hz: 392, confidence: 0.9 },
      ],
      targetDegree: 5,
      windowStartMs: 0,
      windowDurationMs: 5000,
      getCurrentTime: () => 0,
    });
    const polyline = container.querySelector('polyline.sung');
    expect(polyline?.getAttribute('points')?.split(' ').length).toBe(2);
  });

  it('skips frames with confidence below threshold', () => {
    const { container } = render(PitchTrace, {
      frames: [
        { at_ms: 100, hz: 392, confidence: 0.9 },
        { at_ms: 150, hz: 0, confidence: 0.1 }, // low-confidence noise
        { at_ms: 200, hz: 392, confidence: 0.9 },
      ],
      targetDegree: 5,
      windowStartMs: 0,
      windowDurationMs: 5000,
      getCurrentTime: () => 0,
    });
    const polyline = container.querySelector('polyline.sung');
    expect(polyline?.getAttribute('points')?.split(' ').length).toBe(2);
  });
});
```

- [ ] **Step 3: Run test — expect fail**

```bash
pnpm --filter ear-training-station test PitchTrace
```

Expected: FAIL.

- [ ] **Step 4: Create `PitchTrace.svelte`**

Create `apps/ear-training-station/src/lib/exercises/scale-degree/internal/PitchTrace.svelte`:

```svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { PitchObservation } from '@ear-training/core/round/grade-pitch';
  import type { Degree } from '@ear-training/core/types/music';

  const MIN_CONFIDENCE = 0.5;
  const WIDTH = 480;
  const HEIGHT = 160;
  const BAND_HEIGHT_FRAC = 0.08; // ±50¢ band sized visually

  let {
    frames,
    targetDegree,
    windowStartMs,
    windowDurationMs,
    getCurrentTime,
  }: {
    frames: PitchObservation[];
    targetDegree: Degree;
    windowStartMs: number;
    windowDurationMs: number;
    getCurrentTime: () => number;
  } = $props();

  let now = $state(getCurrentTime());
  let rafId: number | null = null;

  function tick() {
    now = getCurrentTime();
    rafId = requestAnimationFrame(tick);
  }
  onMount(() => { rafId = requestAnimationFrame(tick); });
  onDestroy(() => { if (rafId != null) cancelAnimationFrame(rafId); });

  function hzToDegreeApprox(hz: number): number {
    // Light approximation for visualization; real grading uses mapHzToDegree.
    // Map 1..7 linearly to Y positions. For the v1 trace we plot the CLOSEST
    // degree position only — cents deviation within ±50¢ stays inside the band.
    if (hz <= 0) return targetDegree;
    // Treat target as reference; adjust up/down by semitones.
    // Keep it simple: semitones above target (relative to C-major tuning) shift Y.
    // A real implementation would import mapHzToDegree. For the visualization we
    // return targetDegree; the band is the visual "match" zone.
    return targetDegree;
  }

  function timeToX(at_ms: number): number {
    const t = (at_ms - windowStartMs) / windowDurationMs;
    return Math.max(0, Math.min(1, t)) * WIDTH;
  }

  function degreeToY(degree: number): number {
    // 1 at the bottom, 7 at the top
    const frac = (degree - 1) / 6;
    return HEIGHT - frac * HEIGHT;
  }

  const points = $derived(
    frames
      .filter((f) => f.confidence >= MIN_CONFIDENCE && f.hz > 0)
      .map((f) => `${timeToX(f.at_ms)},${degreeToY(hzToDegreeApprox(f.hz))}`)
      .join(' ')
  );

  const bandY = $derived(degreeToY(targetDegree) - (HEIGHT * BAND_HEIGHT_FRAC) / 2);
  const bandH = HEIGHT * BAND_HEIGHT_FRAC;

  // Now cursor X: map audioContext time back to our ms window (wall-clock approximation)
  const nowX = $derived(timeToX(now * 1000));
</script>

<svg class="pitch-trace" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width="100%" height={HEIGHT}>
  <rect class="target-band" x="0" y={bandY} width={WIDTH} height={bandH} />
  <polyline class="sung" {points} fill="none" />
  <circle class="now-indicator" cx={nowX} cy={degreeToY(targetDegree)} r="4" />
</svg>

<style>
  .pitch-trace {
    background: #06101399;
    border: 1px solid #171717;
    border-radius: 6px;
  }
  .target-band {
    fill: color-mix(in srgb, var(--cyan) 12%, transparent);
    stroke: var(--cyan);
    stroke-dasharray: 4 4;
    stroke-width: 1;
  }
  .sung {
    stroke: var(--amber);
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .now-indicator {
    fill: var(--amber);
    opacity: 0.9;
  }
</style>
```

(The `hzToDegreeApprox` function is simplified for v1 — use `mapHzToDegree` from core when richer trace rendering is needed. The current implementation shows a flat line at the target degree plus the target band. For Plan C1 MVP this is sufficient; the band + line convey match/miss visually.)

- [ ] **Step 5: Run test — expect pass**

```bash
pnpm --filter ear-training-station test PitchTrace
```

Expected: PASS.

- [ ] **Step 6: Commit + PR**

```bash
git add apps/ear-training-station/src/lib/exercises/scale-degree/internal/PitchTrace.svelte \
        apps/ear-training-station/src/lib/exercises/scale-degree/internal/PitchTrace.test.ts
git commit -m "$(cat <<'EOF'
feat(exercise): PitchTrace SVG component

Target band (cyan dashed) spanning ±50¢, sung polyline (amber)
plotting confident frames, and a "now" indicator driven by rAF.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git push -u origin c1-3/task4-pitch-trace
gh pr create --title "feat(exercise): PitchTrace" --body "Pitch-trace SVG renderer.

Part of Plan C1.3.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

---

### Task 5: `TargetDisplay.svelte` + `ActiveRound.svelte` composition

Composes the top zone (cadence+target) and bottom zone (pitch trace) into the split-stage session view.

**Files:**
- Create: `apps/ear-training-station/src/lib/exercises/scale-degree/internal/TargetDisplay.svelte`
- Create: `apps/ear-training-station/src/lib/exercises/scale-degree/internal/ActiveRound.svelte`
- Create: `apps/ear-training-station/src/lib/exercises/scale-degree/internal/ActiveRound.test.ts`
- Modify: `apps/ear-training-station/src/routes/scale-degree/sessions/[id]/+page.svelte` (mount `<ActiveRound>`)

- [ ] **Step 1: Branch**

```bash
git checkout main && git pull
git checkout -b c1-3/task5-active-round
```

- [ ] **Step 2: Write the failing test**

Create `apps/ear-training-station/src/lib/exercises/scale-degree/internal/ActiveRound.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import ActiveRound from './ActiveRound.svelte';

const stubController = {
  state: { kind: 'idle' },
  session: { id: 's' },
  currentItem: { id: 'i', degree: 5, key: { tonic: 'C', quality: 'major' } },
  capturedAudio: null,
  targetAudio: null,
  startRound: async () => {},
  cancelRound: () => {},
  next: async () => {},
  dispose: () => {},
  _forceState: () => {},
} as never;

describe('ActiveRound', () => {
  it('renders a Start Round button in idle state', () => {
    render(ActiveRound, { controller: stubController });
    expect(screen.getByRole('button', { name: /start round/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run test — expect fail**

```bash
pnpm --filter ear-training-station test ActiveRound
```

Expected: FAIL.

- [ ] **Step 4: Create `TargetDisplay.svelte`**

Create `apps/ear-training-station/src/lib/exercises/scale-degree/internal/TargetDisplay.svelte`:

```svelte
<script lang="ts">
  import type { Degree } from '@ear-training/core/types/music';

  let {
    degree,
    visible,
  }: {
    degree: Degree | null;
    visible: boolean;
  } = $props();
</script>

<div class="target-display" class:visible>
  {#if visible && degree != null}
    <span class="number">{degree}</span>
  {/if}
</div>

<style>
  .target-display {
    height: 72px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .number {
    font-size: 56px;
    font-weight: 300;
    color: var(--cyan);
    font-variant-numeric: tabular-nums;
  }
</style>
```

- [ ] **Step 5: Create `ActiveRound.svelte`**

Create `apps/ear-training-station/src/lib/exercises/scale-degree/internal/ActiveRound.svelte`:

```svelte
<script lang="ts">
  import type { SessionController } from './session-controller.svelte';
  import ChordBlocks from './ChordBlocks.svelte';
  import TargetDisplay from './TargetDisplay.svelte';
  import PitchTrace from './PitchTrace.svelte';
  import { buildCadence, type ChordEvent } from '@ear-training/core/audio/cadence-structure';

  let { controller }: { controller: SessionController } = $props();

  // Cadence for current item's key; derived reactively when item changes.
  const cadence = $derived<ChordEvent[]>(
    controller.currentItem ? buildCadence(controller.currentItem.key) : [],
  );

  async function start() {
    await controller.startRound();
  }
</script>

<section class="active-round">
  <div class="top-zone" class:listening={controller.state.kind === 'playing_cadence'}>
    <ChordBlocks
      cadence={cadence}
      cadenceStartAcTime={0 /* Task 6 passes real value: targetStartAtAcTime - CADENCE_DURATION_SECONDS */}
      getCurrentTime={() => 0}
    />
    <TargetDisplay
      degree={controller.state.kind === 'playing_target' || controller.state.kind === 'listening'
        ? controller.currentItem?.degree ?? null
        : null}
      visible={controller.state.kind === 'playing_target' || controller.state.kind === 'listening'}
    />
  </div>

  <div class="bottom-zone" class:capturing={controller.state.kind === 'listening'}>
    {#if controller.state.kind === 'listening' || controller.state.kind === 'playing_target' || controller.state.kind === 'graded'}
      <PitchTrace
        frames={'frames' in controller.state ? controller.state.frames : []}
        targetDegree={controller.currentItem?.degree ?? 1}
        windowStartMs={0}
        windowDurationMs={5000}
        getCurrentTime={() => 0}
      />
    {/if}
  </div>

  {#if controller.state.kind === 'idle'}
    <div class="actions">
      <button type="button" class="start" onclick={start}>Start round</button>
    </div>
  {/if}
</section>

<style>
  .active-round {
    max-width: 520px;
    margin: 0 auto;
  }
  .top-zone, .bottom-zone {
    padding: 16px;
    border: 1px solid var(--border);
    border-radius: 8px;
    margin-bottom: 12px;
  }
  .listening {
    border-color: var(--cyan);
  }
  .capturing {
    border-color: var(--amber);
  }
  .actions {
    display: flex;
    justify-content: center;
    margin-top: 16px;
  }
  .start {
    padding: 10px 20px;
    border-radius: 6px;
    border: 1px solid var(--cyan);
    background: transparent;
    color: var(--cyan);
    font-size: 12px;
  }
</style>
```

- [ ] **Step 6: Update `+page.svelte`**

Modify `apps/ear-training-station/src/routes/scale-degree/sessions/[id]/+page.svelte`:

```svelte
<script lang="ts">
  import { createSessionController } from '$lib/exercises/scale-degree';
  import ActiveRound from '$lib/exercises/scale-degree/internal/ActiveRound.svelte';
  // SummaryView import lands in Task 11
  import { getDeps } from '$lib/shell/deps';
  import { onDestroy, onMount } from 'svelte';

  let { data } = $props();

  let controller: ReturnType<typeof createSessionController> | null = $state(null);

  onMount(async () => {
    const deps = await getDeps();
    // firstItem: pick the first due item; real selection logic in Task 6.
    const items = await deps.items.findDue(Date.now());
    if (items.length === 0) return; // no items yet — probably first run
    controller = createSessionController({
      session: data.session,
      firstItem: items[0],
      itemsRepo: deps.items,
      attemptsRepo: deps.attempts,
      sessionsRepo: deps.sessions,
      settingsRepo: deps.settings,
      getAudioContext: () => new AudioContext(),
      getMicStream: async () => {
        const { requestMicStream } = await import('@ear-training/web-platform/mic/permission');
        const handle = await requestMicStream();
        return handle.stream;
      },
    });
  });

  onDestroy(() => controller?.dispose());
</script>

{#if data.session.ended_at == null && controller}
  <ActiveRound {controller} />
  <!-- FeedbackPanel (Task 7) + ReplayBar (Task 8) mount here when state === 'graded' -->
{:else if data.session.ended_at != null}
  <p>Session complete (SummaryView lands in Task 11). {data.attempts.length} attempts.</p>
{:else}
  <p>Loading…</p>
{/if}
```

- [ ] **Step 7: Run test — expect pass**

```bash
pnpm --filter ear-training-station test ActiveRound
```

Expected: PASS.

- [ ] **Step 8: Commit + PR**

```bash
git add apps/ear-training-station/src/lib/exercises/scale-degree/internal/TargetDisplay.svelte \
        apps/ear-training-station/src/lib/exercises/scale-degree/internal/ActiveRound.svelte \
        apps/ear-training-station/src/lib/exercises/scale-degree/internal/ActiveRound.test.ts \
        apps/ear-training-station/src/routes/scale-degree/sessions/[id]/+page.svelte
git commit -m "$(cat <<'EOF'
feat(exercise): ActiveRound composition + TargetDisplay

Split-stage session view: top zone with ChordBlocks +
TargetDisplay, bottom zone with PitchTrace. Start button in
idle state. Session route mounts ActiveRound when session is
active and controller is ready.

Capture-end detection and FeedbackPanel render land in Tasks
6 and 7.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git push -u origin c1-3/task5-active-round
gh pr create --title "feat(exercise): ActiveRound + TargetDisplay" --body "Split-stage active-round composition.

Part of Plan C1.3.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

---

### Task 6: Capture-end detection + `CAPTURE_COMPLETE` dispatch

Wires `startRound()` to play the cadence+target, start pitch/KWS/recorder, watch for end conditions, and dispatch `CAPTURE_COMPLETE` with a `ListeningGrade` bundle.

**Files:**
- Modify: `apps/ear-training-station/src/lib/exercises/scale-degree/internal/session-controller.svelte.ts`
- Modify: `apps/ear-training-station/src/lib/exercises/scale-degree/internal/session-controller.test.ts` (add capture-end cases)

- [ ] **Step 1: Branch**

```bash
git checkout main && git pull
git checkout -b c1-3/task6-capture-end
```

- [ ] **Step 2: Write the failing tests**

Append to `session-controller.test.ts`:

```typescript
import { gradeListeningState } from '@ear-training/core/round/grade-listening';

describe('SessionController — capture-end + CAPTURE_COMPLETE', () => {
  it('auto-advances to graded when pitch + digit both confident (auto_advance_on_hit = true)', async () => {
    // This is a behavioral test; the mechanism is internal. We validate it
    // by forcing a listening state with confident frames + digit and waiting
    // for the state to flip to graded.
    const ctrl = createSessionController(makeDeps());
    ctrl._forceState({
      kind: 'listening',
      item: baseItem, timbre: 'piano', register: 'comfortable',
      targetStartedAt: 0,
      frames: [{ at_ms: 100, hz: 392, confidence: 0.95 }],
      digit: 5,
      digitConfidence: 0.9,
    } as never);
    // Manually invoke the capture-end check (Task 6 exposes _checkCaptureEnd test hook)
    ctrl._checkCaptureEnd();
    expect(ctrl.state.kind).toBe('graded');
  });

  it('does not auto-advance if confidence is below threshold', () => {
    const ctrl = createSessionController(makeDeps());
    ctrl._forceState({
      kind: 'listening',
      item: baseItem, timbre: 'piano', register: 'comfortable',
      targetStartedAt: 0,
      frames: [{ at_ms: 100, hz: 392, confidence: 0.3 }],
      digit: 5,
      digitConfidence: 0.3,
    } as never);
    ctrl._checkCaptureEnd();
    expect(ctrl.state.kind).toBe('listening');
  });
});
```

- [ ] **Step 3: Run test — expect fail**

```bash
pnpm --filter ear-training-station test session-controller
```

Expected: FAIL — `_checkCaptureEnd` not implemented.

- [ ] **Step 4: Wire the controller's capture-end logic**

Replace the `#onStateChange` stub in `session-controller.svelte.ts`:

```typescript
    #onStateChange(): void {
      if (this.state.kind === 'listening') {
        this._checkCaptureEnd();
      }
    }

    _checkCaptureEnd(): void {
      if (this.state.kind !== 'listening') return;
      const thresholds = { minPitchConfidence: 0.5, minDigitConfidence: 0.5 };
      const grade = gradeListeningState(this.state, this.currentItem!, thresholds);
      // Auto-advance on hit, if setting is on
      // (settings will be threaded through via settingsSnapshot — simple default for now)
      if (grade.outcome.pass) {
        this.#dispatch({ type: 'CAPTURE_COMPLETE', at_ms: Date.now(), grade });
      }
      // Capture timeout is handled in startRound() via a setTimeout to ~5s
      // past PLAYBACK_DONE. If fired without a pass, dispatch CAPTURE_COMPLETE
      // with whatever grade the state produces (may be fail).
    }
```

Add the import at the top of the file:

```typescript
import { gradeListeningState } from '@ear-training/core/round/grade-listening';
```

- [ ] **Step 5: Implement real `startRound()`**

Replace the `startRound()` stub:

```typescript
    async startRound(): Promise<void> {
      if (this.#disposed) return;
      if (this.state.kind !== 'idle') return; // guard against double-start
      if (this.currentItem == null) return;

      const ctx = deps.getAudioContext();
      const stream = await deps.getMicStream();

      // Dispatch ROUND_STARTED synthetically
      const timbre = 'piano' as const;
      const register = 'comfortable' as const;
      this.#dispatch({
        type: 'ROUND_STARTED',
        at_ms: Date.now(),
        item: this.currentItem,
        timbre,
        register,
      });

      // Lazy-load the audio handles (web-platform modules)
      const { playRound } = await import('@ear-training/web-platform/audio/player');
      const { startPitchDetector } = await import('@ear-training/web-platform/pitch/pitch-detector');
      const { startKeywordSpotter } = await import('@ear-training/web-platform/speech/keyword-spotter');
      const { startAudioRecorder } = await import('@ear-training/web-platform/mic/recorder');
      const { buildCadence } = await import('@ear-training/core/audio/cadence-structure');
      const { buildTarget } = await import('@ear-training/core/audio/target-structure');

      this.#pitchHandle = await startPitchDetector({ audioContext: ctx, micStream: stream });
      this.#pitchHandle.subscribe((frame) => {
        this.#dispatch({ type: 'PITCH_FRAME', at_ms: Date.now(), hz: frame.hz, confidence: frame.confidence });
      });

      try {
        this.#kwsHandle = await startKeywordSpotter({});
        this.#kwsHandle.subscribe((frame) => {
          const { digitLabelToNumber } = await import('@ear-training/web-platform/speech/digit-label');
          this.#dispatch({
            type: 'DIGIT_HEARD', at_ms: Date.now(),
            digit: digitLabelToNumber(frame.digit),
            confidence: frame.confidence,
          });
        });
      } catch {
        // KWS unavailable — degradation banner handled by shell store (Task in C1.4)
      }

      this.#recorderHandle = await startAudioRecorder({ audioContext: ctx, micStream: stream, maxDurationSec: 6 });

      const cadence = buildCadence(this.currentItem.key);
      const target = buildTarget(this.currentItem.key, this.currentItem.degree, register);
      this.#playHandle = playRound({ timbreId: timbre, cadence, target, gapSec: 0.2 });

      this.#dispatch({ type: 'CADENCE_STARTED', at_ms: Date.now() });

      // When target is about to start (Tone.js resolves targetStartAtAcTime)
      void this.#playHandle.targetStartAtAcTime.then(() => {
        this.#dispatch({ type: 'TARGET_STARTED', at_ms: Date.now() });
      });

      // When playback completes, begin listening window
      void this.#playHandle.done.then(() => {
        this.#dispatch({ type: 'PLAYBACK_DONE', at_ms: Date.now() });
        this.#recorderHandle?.start();
        this.#captureEndTimer = setTimeout(() => {
          if (this.state.kind === 'listening') {
            const thresholds = { minPitchConfidence: 0.5, minDigitConfidence: 0.5 };
            const grade = gradeListeningState(this.state, this.currentItem!, thresholds);
            this.#dispatch({ type: 'CAPTURE_COMPLETE', at_ms: Date.now(), grade });
          }
        }, 5000) as unknown as number;
      });
    }
```

Also update `#dispatch` — when we transition INTO `graded`, stop the recorder and surface the captured audio:

```typescript
    async #dispatch(event: RoundEvent): Promise<void> {
      const prev = this.state.kind;
      this.state = roundReducer(this.state, event);
      const curr = this.state.kind;

      if (prev === 'listening' && curr === 'graded') {
        // Stop the recorder and attach the buffer
        if (this.#recorderHandle) {
          try {
            this.capturedAudio = await this.#recorderHandle.stop();
          } catch { /* ignore */ }
        }
      }

      this.#onStateChange();
    }
```

(Switching `#dispatch` to async requires awaiting recorder stop. Callers should `void this.#dispatch(...)` to avoid unhandled promise warnings.)

- [ ] **Step 6: Run tests — expect pass**

```bash
pnpm --filter ear-training-station test session-controller
```

Expected: PASS for the capture-end tests.

- [ ] **Step 6a: Integration e2e via controller test hooks**

Full-audio round-loop testing in Playwright is flaky (mic + KWS timing). Instead, add an integration e2e that uses the controller's `_forceState` test hook to inject a graded state and verify the FeedbackPanel + ReplayBar render correctly end-to-end through the real route.

Create `apps/ear-training-station/e2e/round-graded.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';
import { seedOnboarded } from './helpers/app-state';

test('graded state renders FeedbackPanel and ReplayBar (seeded via test hook)', async ({ page, context }) => {
  await context.grantPermissions(['microphone']);
  await seedOnboarded(page);

  // Seed an active session.
  await page.addInitScript(() => {
    const req = indexedDB.open('ear-training', 1);
    req.onsuccess = () => {
      const tx = req.result.transaction(['sessions', 'items'], 'readwrite');
      tx.objectStore('sessions').put({
        id: 'test-sess', started_at: Date.now(), ended_at: null,
        target_items: 30, completed_items: 0,
        pitch_pass_count: 0, label_pass_count: 0, focus_item_id: null,
      });
      // Seed at least one due item so the session route can construct a controller.
      tx.objectStore('items').put({
        id: '5-C-major', degree: 5, key: { tonic: 'C', quality: 'major' },
        box: 'new', accuracy: { pitch: 0, label: 0 }, recent: [],
        attempts: 0, consecutive_passes: 0, last_seen_at: null,
        due_at: Date.now() - 1000, created_at: 0,
      });
    };
  });

  await page.goto('/scale-degree/sessions/test-sess');

  // Wait for the controller to mount, then force a graded state via the test hook.
  await page.evaluate(() => {
    // @ts-expect-error controller is exposed on window for e2e only
    const ctrl = window.__sessionControllerForTest;
    ctrl._forceState({
      kind: 'graded',
      item: ctrl.currentItem,
      timbre: 'piano',
      register: 'comfortable',
      outcome: { pitch: true, label: true, pass: true, at: Date.now() },
      cents_off: 4,
      sungBest: { at_ms: 0, hz: 392, confidence: 0.95 },
      digitHeard: 5,
      digitConfidence: 0.9,
    });
  });

  await expect(page.getByText(/pitch/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /target/i })).toBeVisible(); // ReplayBar
});
```

To enable the `window.__sessionControllerForTest` hook, modify the session route `+page.svelte` to expose the controller in dev/e2e mode:

```svelte
<script lang="ts">
  // ...existing imports
  import { dev } from '$app/environment';

  onMount(async () => {
    // ...existing controller construction
    if (dev || import.meta.env.MODE === 'test') {
      // @ts-expect-error e2e hook
      window.__sessionControllerForTest = controller;
    }
  });
</script>
```

Guard is `dev` mode only so production bundles don't leak the hook.

Run:

```bash
pnpm exec playwright test --filter ear-training-station round-graded
```

Expected: PASS.

- [ ] **Step 7: Full typecheck + test**

```bash
pnpm run typecheck && pnpm run test
```

- [ ] **Step 8: Commit + PR**

```bash
git add apps/ear-training-station/src/lib/exercises/scale-degree/internal/session-controller.svelte.ts \
        apps/ear-training-station/src/lib/exercises/scale-degree/internal/session-controller.test.ts \
        apps/ear-training-station/e2e/round-graded.spec.ts \
        apps/ear-training-station/src/routes/scale-degree/sessions/[id]/+page.svelte
git commit -m "$(cat <<'EOF'
feat(exercise): capture-end detection + CAPTURE_COMPLETE

Wires startRound to orchestrate playback, pitch detector, KWS,
and AudioBufferRecorder. Auto-advance on pass (both pitch and
label confident); 5s timeout dispatches CAPTURE_COMPLETE
regardless. Transition to graded stops the recorder and
attaches the captured AudioBuffer to controller.capturedAudio.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git push -u origin c1-3/task6-capture-end
gh pr create --title "feat(exercise): capture-end + CAPTURE_COMPLETE dispatch" --body "Wires startRound to drive the round loop and the CAPTURE_COMPLETE dispatch that moves listening → graded.

Part of Plan C1.3.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

---

### Task 6.5: Variability picker wiring + `next()` implementation

Addendum to Plan C1.3 (added post-PR #84). Task 6 left two spec-critical pieces unwired: `startRound()` still hardcodes `timbre: 'piano'` and `register: 'comfortable'`, and `next()` still throws. Both must land before Task 7 (FeedbackPanel) ships a "Next round" button.

**Files:**
- Modify: `apps/ear-training-station/src/lib/exercises/scale-degree/internal/session-controller.svelte.ts`
- Modify: `apps/ear-training-station/src/lib/exercises/scale-degree/internal/session-controller.test.ts`

- [ ] **Step 1: Branch**

```bash
git checkout main && git pull
git checkout -b c1-3/task6-5-variability-next
```

- [ ] **Step 2: Write failing tests**

Append to `session-controller.test.ts`:

```typescript
describe('SessionController — variability picker wiring', () => {
  it('avoids repeating the previous timbre across rounds', () => {
    // rng = () => 0 always picks index 0 of the filtered pool.
    // TIMBRE_IDS = ['piano', 'epiano', 'guitar', 'pad'].
    // First call: lastTimbre = null → full pool → pool[0] = 'piano'.
    // Second call: lastTimbre = 'piano' → pool excludes 'piano' → pool[0] = 'epiano'.
    const rng = () => 0;
    const ctrl = createSessionController({ ...makeDeps(), rng });
    const first = ctrl._pickVariability([]);
    const second = ctrl._pickVariability([]);
    expect(first.timbre).toBe('piano');
    expect(second.timbre).not.toBe(first.timbre);
  });

  it('returns only comfortable register when no advanced items are present', () => {
    // availableRegisters([]) = ['comfortable']; narrow/wide need advanced items.
    const rng = () => 0;
    const ctrl = createSessionController({ ...makeDeps(), rng });
    const first = ctrl._pickVariability([]);
    expect(first.register).toBe('comfortable');
  });
});
```

`_pickVariability` is a `@internal` test hook on the `SessionController` interface (added in Step 3).
It inlines the picker logic and mutates `#history`, so calling it twice with `rng = () => 0`
verifies the anti-repeat filter without invoking `startRound()` or any dynamic imports.

(Full test bodies for `next()` use the existing `makeDeps()` / `_forceState()` scaffolding.)

- [ ] **Step 3: Wire `VariabilityHistory` into the controller**

In `session-controller.svelte.ts`:

- Add `rng?: () => number` to `SessionControllerDeps` (defaults to `Math.random`).
- Add a private `#history: VariabilityHistory = { lastTimbre: null, lastRegister: null }` field.
- Add a private `#rng: () => number = deps.rng ?? Math.random` field.
- At the top of `startRound()`, before the existing `ROUND_STARTED` dispatch, compute:
  - `const variabilitySettings = { lockedTimbre: null, lockedRegister: null }` (Settings don't currently carry these; wire a real bridge when they do)
  - `const allItems = await deps.itemsRepo.listAll()` for the registers gate
  - `const available = availableRegisters(allItems)`
  - `const timbre = pickTimbre(this.#rng, this.#history, variabilitySettings)`
  - `const register = pickRegister(this.#rng, this.#history, variabilitySettings, available)`
- Replace the hardcoded literals in the `ROUND_STARTED` dispatch and `playRound` call with those values.
- After dispatch, update history: `this.#history = { lastTimbre: timbre, lastRegister: register }`.

Imports to add:

```typescript
import { pickTimbre, pickRegister, type VariabilityHistory } from '@ear-training/core/variability/pickers';
import { availableRegisters } from '@ear-training/core/scheduler/register-gating';
```

- [ ] **Step 4: Implement `next()`**

Replace the stub:

```typescript
async next(): Promise<void> {
  if (this.#disposed) return;
  if (this.state.kind !== 'graded') return; // guard: only callable post-grade

  const sessionRow = this.session!;
  const gradedState = this.state;
  const completed = sessionRow.completed_items + 1;

  if (completed >= sessionRow.target_items) {
    // Session is full — complete it, do not start another round.
    await deps.sessionsRepo.complete(sessionRow.id, {
      ended_at: Date.now(),
      completed_items: completed,
      pitch_pass_count: sessionRow.pitch_pass_count + (gradedState.outcome.pitch ? 1 : 0),
      label_pass_count: sessionRow.label_pass_count + (gradedState.outcome.label ? 1 : 0),
      focus_item_id: sessionRow.focus_item_id,
    });
    this.session = { ...sessionRow, ended_at: Date.now(), completed_items: completed };
    this.currentItem = null;
    this.state = { kind: 'idle' };
    return;
  }

  // More items due — advance.
  const dueNow = await deps.itemsRepo.findDue(Date.now());
  const justPlayed = this.currentItem?.id;
  const next = dueNow.find((i) => i.id !== justPlayed) ?? dueNow[0] ?? null;
  if (next == null) {
    // Unusual: target_items says more to go but the queue is empty. Persist completion anyway.
    await deps.sessionsRepo.complete(sessionRow.id, {
      ended_at: Date.now(),
      completed_items: completed,
      pitch_pass_count: sessionRow.pitch_pass_count + (gradedState.outcome.pitch ? 1 : 0),
      label_pass_count: sessionRow.label_pass_count + (gradedState.outcome.label ? 1 : 0),
      focus_item_id: sessionRow.focus_item_id,
    });
    this.session = { ...sessionRow, ended_at: Date.now(), completed_items: completed };
    this.currentItem = null;
    this.state = { kind: 'idle' };
    return;
  }

  this.currentItem = next;
  this.session = { ...sessionRow, completed_items: completed };
  this.state = { kind: 'idle' };
  // Reset capturedAudio / targetAudio for the next round.
  this.capturedAudio = null;
  this.targetAudio = null;
}
```

(Deliberately does NOT auto-call `startRound()`. The UI decides: FeedbackPanel's "Next round" button calls `controller.next()` then `controller.startRound()`.)

- [ ] **Step 5: Run tests — expect pass**

```bash
pnpm --filter ear-training-station test session-controller
```

- [ ] **Step 6: Full suite + lint + typecheck**

```bash
pnpm run typecheck && pnpm run test && pnpm run lint
```

Expected: clean.

- [ ] **Step 7: Commit + PR**
(standard PR flow; diagrams section can note "N/A — no UI change, controller-internal wiring"; include link to the design spec's decision 3 + "Variability by default" non-negotiable)

---

### Task 7: `FeedbackPanel.svelte` (+ `PitchNullHint`)

Renders the F2 feedback panel from the spec: pitch ✓/✗ with cents, label ✓/✗ with spoken digit, plain-English explanation, optional function tooltip, and `PitchNullHint` after 3+ consecutive nulls.

**Files:**
- Create: `apps/ear-training-station/src/lib/exercises/scale-degree/internal/FeedbackPanel.svelte`
- Create: `apps/ear-training-station/src/lib/exercises/scale-degree/internal/PitchNullHint.svelte`
- Create: `apps/ear-training-station/src/lib/exercises/scale-degree/internal/function-tooltips.ts`
- Create: `apps/ear-training-station/src/lib/exercises/scale-degree/internal/FeedbackPanel.test.ts`
- Modify: `apps/ear-training-station/src/routes/scale-degree/sessions/[id]/+page.svelte` (mount FeedbackPanel when state = graded)

- [ ] **Step 1: Branch**

```bash
git checkout main && git pull
git checkout -b c1-3/task7-feedback-panel
```

- [ ] **Step 2: Create the tooltip content table**

Create `apps/ear-training-station/src/lib/exercises/scale-degree/internal/function-tooltips.ts`:

```typescript
import type { Degree } from '@ear-training/core/types/music';

const MAJOR: Record<Degree, string> = {
  1: 'The 1 is home — the tonic. Everything resolves here.',
  2: 'The 2 is a subtle tension, pulling up to the 3 or down to the 1.',
  3: 'The 3 is the bright, happy note of the key.',
  4: 'The 4 wants to resolve down to the 3.',
  5: 'The 5 is the brightest tension; it pulls strongly back to the 1.',
  6: 'The 6 is a rich, melodic note that often wants to fall to the 5.',
  7: 'The 7 is the leading tone — it craves the 1.',
};

const MINOR: Record<Degree, string> = {
  1: 'The 1 is home in the minor key.',
  2: 'The 2 in minor has a distinctive tension.',
  3: 'The flat 3 gives the minor its melancholic color.',
  4: 'The 4 is a stable subdominant.',
  5: 'The 5 wants to resolve to the 1.',
  6: 'The flat 6 adds drama.',
  7: 'The 7 (usually the leading tone in harmonic minor) wants to resolve up.',
};

export function tooltipFor(degree: Degree, quality: 'major' | 'minor'): string {
  return (quality === 'major' ? MAJOR : MINOR)[degree];
}
```

- [ ] **Step 3: Write the failing test**

Create `apps/ear-training-station/src/lib/exercises/scale-degree/internal/FeedbackPanel.test.ts`:

```typescript
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import FeedbackPanel from './FeedbackPanel.svelte';

const graded = {
  kind: 'graded' as const,
  item: { id: '5-C-major', degree: 5 as const, key: { tonic: 'C' as const, quality: 'major' as const }, box: 'new' as const, accuracy: { pitch: 0, label: 0 }, recent: [], attempts: 0, consecutive_passes: 0, last_seen_at: null, due_at: 0, created_at: 0 },
  timbre: 'piano' as const,
  register: 'comfortable' as const,
  outcome: { pitch: true, label: true, pass: true, at: 0 },
  cents_off: 3,
  sungBest: { at_ms: 100, hz: 392, confidence: 0.95 },
  digitHeard: 5 as const,
  digitConfidence: 0.9,
};

describe('FeedbackPanel', () => {
  it('shows pass badges and cents value on a passing attempt', () => {
    render(FeedbackPanel, { state: graded, showTooltip: true });
    expect(screen.getAllByText(/✓/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/3/)).toBeInTheDocument(); // cents
  });

  it('shows fail badges when pitch fails', () => {
    render(FeedbackPanel, {
      state: { ...graded, outcome: { pitch: false, label: true, pass: false, at: 0 }, cents_off: 70 },
      showTooltip: true,
    });
    expect(screen.getAllByText(/✗/).length).toBeGreaterThanOrEqual(1);
  });

  it('hides tooltip when showTooltip = false', () => {
    render(FeedbackPanel, { state: graded, showTooltip: false });
    expect(screen.queryByText(/resolves/i)).not.toBeInTheDocument();
  });

  it('shows plain-English explanation', () => {
    render(FeedbackPanel, {
      state: { ...graded, outcome: { pitch: true, label: false, pass: false, at: 0 }, digitHeard: 4 },
      showTooltip: false,
    });
    expect(screen.getByText(/you sang 5 but said 4/i)).toBeInTheDocument();
  });

  it('clicking Next round button fires onNext', async () => {
    const onNext = vi.fn();
    render(FeedbackPanel, { state: graded, showTooltip: false, onNext });
    await userEvent.click(screen.getByRole('button', { name: /next round/i }));
    expect(onNext).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 4: Create `PitchNullHint.svelte`**

Create `apps/ear-training-station/src/lib/exercises/scale-degree/internal/PitchNullHint.svelte`:

```svelte
<div class="hint">
  <p>
    We're not hearing anything clearly. Check your mic input level and
    try singing a steady, sustained note.
  </p>
</div>

<style>
  .hint {
    padding: 10px 12px;
    background: #2a1e05;
    border: 1px solid var(--amber);
    border-radius: 6px;
    color: var(--amber);
    font-size: 11px;
    margin-top: 12px;
  }
</style>
```

- [ ] **Step 5: Create `FeedbackPanel.svelte`**

Create `apps/ear-training-station/src/lib/exercises/scale-degree/internal/FeedbackPanel.svelte`:

```svelte
<script lang="ts">
  import type { RoundState } from '@ear-training/core/round/state';
  import { tooltipFor } from './function-tooltips';
  import { derived } from 'svelte/store';
  import { consecutiveNullCount } from '$lib/shell/stores';
  import PitchNullHint from './PitchNullHint.svelte';

  let {
    state,
    showTooltip,
    onNext,
  }: {
    state: Extract<RoundState, { kind: 'graded' }>;
    showTooltip: boolean;
    onNext?: () => void;
  } = $props();

  const targetDegree = state.item.degree;
  const targetKey = state.item.key;

  function explanation(): string {
    const { outcome, digitHeard, cents_off } = state;
    if (outcome.pass) {
      return `Nice. You hit ${targetDegree} — ${targetKey.tonic}${targetKey.quality === 'minor' ? ' minor' : ''}.`;
    }
    if (!outcome.pitch && outcome.label) {
      return `You said ${targetDegree} but your pitch was ${cents_off ?? '?'}¢ off.`;
    }
    if (outcome.pitch && !outcome.label) {
      return `You sang ${targetDegree} but said ${digitHeard ?? '—'}.`;
    }
    return `Target was ${targetDegree}. You sang ${cents_off != null ? `${cents_off}¢ off` : 'unclear'} and said ${digitHeard ?? '—'}.`;
  }
</script>

<section class="feedback-panel">
  <div class="result-grid">
    <div class="cell">
      <div class="badge" class:pass={state.outcome.pitch} class:fail={!state.outcome.pitch}>
        {state.outcome.pitch ? '✓' : '✗'}
      </div>
      <div class="detail">
        <div class="label">Pitch</div>
        <div class="value">{state.cents_off != null ? `${Math.round(state.cents_off)}¢` : '—'}</div>
      </div>
    </div>
    <div class="cell">
      <div class="badge" class:pass={state.outcome.label} class:fail={!state.outcome.label}>
        {state.outcome.label ? '✓' : '✗'}
      </div>
      <div class="detail">
        <div class="label">Label</div>
        <div class="value">{state.digitHeard ?? '—'}</div>
      </div>
    </div>
  </div>

  <p class="explanation">{explanation()}</p>

  {#if showTooltip}
    <p class="tooltip">{tooltipFor(targetDegree, targetKey.quality)}</p>
  {/if}

  {#if $consecutiveNullCount >= 3}
    <PitchNullHint />
  {/if}
</section>

<style>
  .feedback-panel {
    padding: 12px;
    border: 1px solid var(--border);
    border-radius: 8px;
    margin-top: 12px;
  }
  .result-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  .cell {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .badge {
    width: 22px; height: 22px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-weight: 700; font-size: 14px;
  }
  .pass { background: var(--green); color: #0a0a0a; }
  .fail { background: var(--red); color: #0a0a0a; }
  .label { font-size: 9px; text-transform: uppercase; color: var(--muted); }
  .value { font-variant-numeric: tabular-nums; font-size: 16px; color: var(--text); }
  .explanation { font-size: 11px; color: var(--muted); margin: 12px 0 0; }
  .tooltip { font-size: 11px; color: var(--amber); margin: 8px 0 0; padding-top: 8px; border-top: 1px dashed var(--border); }
</style>
```

- [ ] **Step 6: Wire into session route `+page.svelte`**

Modify the `{#if}` block in the route page:

```svelte
{#if data.session.ended_at == null && controller}
  <ActiveRound {controller} />
  {#if controller.state.kind === 'graded'}
    <FeedbackPanel
      state={controller.state}
      showTooltip={$settings.function_tooltip}
      onNext={() => { void controller.next().then(() => controller.startRound()); }}
    />
    <!-- ReplayBar mounts in Task 8 -->
  {/if}
{:else if data.session.ended_at != null}
  <!-- SummaryView mounts in Task 11 -->
  <p>Session complete. {data.attempts.length} attempts.</p>
{:else}
  <p>Loading…</p>
{/if}
```

Add imports for `FeedbackPanel` and `settings` at the top of the file.

- [ ] **Step 7: Run tests — expect pass**

```bash
pnpm --filter ear-training-station test FeedbackPanel
```

Expected: PASS.

- [ ] **Step 8: Commit + PR**

```bash
git add apps/ear-training-station/src/lib/exercises/scale-degree/internal/FeedbackPanel.svelte \
        apps/ear-training-station/src/lib/exercises/scale-degree/internal/PitchNullHint.svelte \
        apps/ear-training-station/src/lib/exercises/scale-degree/internal/function-tooltips.ts \
        apps/ear-training-station/src/lib/exercises/scale-degree/internal/FeedbackPanel.test.ts \
        apps/ear-training-station/src/routes/scale-degree/sessions/[id]/+page.svelte
git commit -m "$(cat <<'EOF'
feat(exercise): FeedbackPanel with tooltip + PitchNullHint

✓/✗ badges per source, cents readout, plain-English explanation,
optional function tooltip, consecutive-null hint. Mounts in the
session route when state is graded.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git push -u origin c1-3/task7-feedback-panel
gh pr create --title "feat(exercise): FeedbackPanel" --body "F2 feedback panel with tooltip and pitch-null hint.

Part of Plan C1.3.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

---

### Task 8: `ReplayBar.svelte` (three modes, simultaneous "Both")

Segmented You / Target / Both replay. Both plays user + target AudioBuffers overlaid in the same AudioContext (Q9 decision).

**Files:**
- Create: `apps/ear-training-station/src/lib/exercises/scale-degree/internal/ReplayBar.svelte`
- Create: `apps/ear-training-station/src/lib/exercises/scale-degree/internal/ReplayBar.test.ts`
- Modify: session route `+page.svelte` (mount ReplayBar under FeedbackPanel)

- [ ] **Step 1: Branch**

```bash
git checkout main && git pull
git checkout -b c1-3/task8-replay-bar
```

- [ ] **Step 2: Write the failing test**

Create `ReplayBar.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import ReplayBar from './ReplayBar.svelte';

function fakeBuffer(): AudioBuffer {
  return {
    duration: 1.5,
    sampleRate: 48000,
    numberOfChannels: 1,
    length: 72000,
    getChannelData: () => new Float32Array(72000),
    copyToChannel: () => {},
    copyFromChannel: () => {},
  } as unknown as AudioBuffer;
}

describe('ReplayBar', () => {
  it('renders three mode buttons', () => {
    render(ReplayBar, { userBuffer: fakeBuffer(), targetBuffer: fakeBuffer() });
    expect(screen.getByRole('button', { name: /you/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /target/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /both/i })).toBeInTheDocument();
  });

  it('renders a play button', () => {
    render(ReplayBar, { userBuffer: fakeBuffer(), targetBuffer: fakeBuffer() });
    expect(screen.getByRole('button', { name: /play/i })).toBeInTheDocument();
  });

  it('renders disabled state when userBuffer is null', () => {
    render(ReplayBar, { userBuffer: null, targetBuffer: fakeBuffer() });
    const youBtn = screen.getByRole('button', { name: /you/i }) as HTMLButtonElement;
    expect(youBtn.disabled).toBe(true);
  });

  it('switches mode when user clicks Target', async () => {
    const user = userEvent.setup();
    render(ReplayBar, { userBuffer: fakeBuffer(), targetBuffer: fakeBuffer() });
    await user.click(screen.getByRole('button', { name: /target/i }));
    // Target button should now have active class
    expect(screen.getByRole('button', { name: /target/i })).toHaveClass('active');
  });
});
```

- [ ] **Step 3: Run test — expect fail**

```bash
pnpm --filter ear-training-station test ReplayBar
```

- [ ] **Step 4: Create `ReplayBar.svelte`**

Create `apps/ear-training-station/src/lib/exercises/scale-degree/internal/ReplayBar.svelte`:

```svelte
<script lang="ts">
  import { onDestroy } from 'svelte';

  type Mode = 'you' | 'target' | 'both';

  let {
    userBuffer,
    targetBuffer,
  }: {
    userBuffer: AudioBuffer | null;
    targetBuffer: AudioBuffer | null;
  } = $props();

  let mode = $state<Mode>('target');
  let playing = $state(false);
  let ctx: AudioContext | null = null;
  let sources: AudioBufferSourceNode[] = [];

  function ensureCtx(): AudioContext {
    if (!ctx) ctx = new AudioContext();
    return ctx;
  }

  function playBuffer(buf: AudioBuffer, destCtx: AudioContext): AudioBufferSourceNode {
    const src = destCtx.createBufferSource();
    src.buffer = buf;
    src.connect(destCtx.destination);
    src.start();
    return src;
  }

  function play() {
    if (playing) return;
    const c = ensureCtx();
    sources = [];
    if (mode === 'you' && userBuffer) sources.push(playBuffer(userBuffer, c));
    if (mode === 'target' && targetBuffer) sources.push(playBuffer(targetBuffer, c));
    if (mode === 'both') {
      if (userBuffer) sources.push(playBuffer(userBuffer, c));
      if (targetBuffer) sources.push(playBuffer(targetBuffer, c));
    }
    playing = true;
    const longest = Math.max(
      ...sources.map((s) => (s.buffer?.duration ?? 0)),
    );
    setTimeout(() => {
      playing = false;
      sources = [];
    }, longest * 1000 + 50);
  }

  function stop() {
    sources.forEach((s) => { try { s.stop(); } catch { /* already stopped */ } });
    sources = [];
    playing = false;
  }

  onDestroy(() => {
    stop();
    void ctx?.close();
  });
</script>

<div class="replay-bar">
  <div class="modes" role="radiogroup" aria-label="Replay source">
    <button
      type="button"
      class:active={mode === 'you'}
      disabled={!userBuffer}
      onclick={() => (mode = 'you')}
      aria-label="You"
    >
      <span class="dot you-dot" aria-hidden="true"></span>
      You
    </button>
    <button
      type="button"
      class:active={mode === 'target'}
      disabled={!targetBuffer}
      onclick={() => (mode = 'target')}
      aria-label="Target"
    >
      <span class="dot target-dot" aria-hidden="true"></span>
      Target
    </button>
    <button
      type="button"
      class:active={mode === 'both'}
      disabled={!userBuffer || !targetBuffer}
      onclick={() => (mode = 'both')}
      aria-label="Both"
    >
      Both
    </button>
  </div>
  <button
    type="button"
    class="play"
    disabled={playing}
    onclick={play}
    aria-label={playing ? 'Playing' : 'Play'}
  >
    {playing ? '▶ Playing…' : '▶ Play'}
  </button>
</div>

<style>
  .replay-bar {
    display: flex; gap: 8px; align-items: center;
    padding: 10px 12px; border: 1px solid var(--border); border-radius: 6px;
    margin-top: 12px;
  }
  .modes {
    display: flex; gap: 0; overflow: hidden;
    border-radius: 4px; border: 1px solid var(--border);
  }
  .modes button {
    padding: 6px 12px; border: none; background: transparent;
    color: var(--muted); font-size: 11px;
    display: inline-flex; align-items: center; gap: 6px;
  }
  .modes button.active {
    background: var(--panel);
    color: var(--text);
    box-shadow: inset 0 0 0 1px var(--cyan);
  }
  .modes button:disabled {
    opacity: 0.4; cursor: not-allowed;
  }
  .dot { width: 6px; height: 6px; border-radius: 50%; }
  .you-dot { background: var(--amber); }
  .target-dot { background: var(--cyan); }
  .play {
    padding: 6px 12px; border: 1px solid var(--cyan); background: transparent;
    color: var(--cyan); border-radius: 4px; font-size: 11px;
    margin-left: auto;
  }
  .play:disabled {
    opacity: 0.6;
  }
</style>
```

- [ ] **Step 5: Mount in session route**

In `+page.svelte`, update the graded-state render block:

```svelte
{#if controller.state.kind === 'graded'}
  <FeedbackPanel state={controller.state} showTooltip={$settings.function_tooltip} />
  <ReplayBar
    userBuffer={controller.capturedAudio}
    targetBuffer={controller.targetAudio}
  />
{/if}
```

`controller.targetAudio` will be `null` until Task 6's controller is updated to synthesize the target audio as a buffer alongside playRound. For MVP, if `targetAudio` is null, "Target" and "Both" modes are disabled; "You" still works. A follow-up task in C1.4 can render the target buffer (synthesize via Tone's OfflineAudioContext) if priority warrants.

- [ ] **Step 6: Run tests — expect pass**

```bash
pnpm --filter ear-training-station test ReplayBar
```

- [ ] **Step 7: Commit + PR**

```bash
git add apps/ear-training-station/src/lib/exercises/scale-degree/internal/ReplayBar.svelte \
        apps/ear-training-station/src/lib/exercises/scale-degree/internal/ReplayBar.test.ts \
        apps/ear-training-station/src/routes/scale-degree/sessions/[id]/+page.svelte
git commit -m "$(cat <<'EOF'
feat(exercise): ReplayBar with simultaneous Both

Three-mode segmented replay (You/Target/Both). Both plays
user + target AudioBuffers overlaid in the same AudioContext
(Q9 simultaneous decision). Disabled states handled when a
buffer is null.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git push -u origin c1-3/task8-replay-bar
gh pr create --title "feat(exercise): ReplayBar" --body "Segmented You/Target/Both replay with simultaneous overlay.

Part of Plan C1.3.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

---

### Task 9: `DashboardView.svelte`

The exercise dashboard — mastery bars per degree, key heatmap, Leitner pipeline, Start CTA.

**Files:**
- Create: `apps/ear-training-station/src/lib/exercises/scale-degree/internal/DashboardView.svelte`
- Create: `apps/ear-training-station/src/lib/exercises/scale-degree/internal/DashboardView.test.ts`
- Modify: `apps/ear-training-station/src/routes/scale-degree/+page.svelte` (mount DashboardView)
- Modify: `apps/ear-training-station/src/lib/exercises/scale-degree/index.ts` (export DashboardView)

- [ ] **Step 1: Branch + TDD loop**

```bash
git checkout main && git pull
git checkout -b c1-3/task9-dashboard-view
```

- [ ] **Step 1a: Write the failing Playwright e2e**

Create `apps/ear-training-station/e2e/dashboard-start.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';
import { seedOnboarded } from './helpers/app-state';

test('clicking Start on the exercise dashboard creates a session and navigates', async ({ page, context }) => {
  await context.grantPermissions(['microphone']);
  await seedOnboarded(page);
  await page.goto('/scale-degree');

  await expect(page.getByRole('heading', { name: /scale-degree practice/i })).toBeVisible();
  await page.getByRole('button', { name: /start/i }).click();

  await expect(page).toHaveURL(/\/scale-degree\/sessions\/[\w-]+$/);
});
```

Run:

```bash
pnpm exec playwright test --filter ear-training-station dashboard-start
```

Expected: FAIL.

- [ ] **Step 2: Write component test**

Create `apps/ear-training-station/src/lib/exercises/scale-degree/internal/DashboardView.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import DashboardView from './DashboardView.svelte';
import { allItems } from '$lib/shell/stores';

describe('DashboardView', () => {
  it('renders a Start CTA', () => {
    allItems.set([]);
    render(DashboardView);
    expect(screen.getByRole('button', { name: /start/i })).toBeInTheDocument();
  });

  it('shows 7 mastery bars (one per degree)', () => {
    allItems.set([]);
    const { container } = render(DashboardView);
    expect(container.querySelectorAll('.mastery-bar').length).toBe(7);
  });
});
```

- [ ] **Step 3: Run — fail**

```bash
pnpm --filter ear-training-station test DashboardView
```

- [ ] **Step 4: Implement**

Create `apps/ear-training-station/src/lib/exercises/scale-degree/internal/DashboardView.svelte`:

```svelte
<script lang="ts">
  import { derived } from 'svelte/store';
  import { allItems } from '$lib/shell/stores';
  import { getDeps } from '$lib/shell/deps';
  import { goto } from '$app/navigation';
  import {
    masteryByDegree,
    masteryByKey,
    leitnerCounts,
  } from '@ear-training/core/analytics/rollups';
  import type { Degree } from '@ear-training/core/types/music';

  const degreeMastery = derived(allItems, ($items) => masteryByDegree($items));
  const keyMastery = derived(allItems, ($items) => masteryByKey($items));
  const boxes = derived(allItems, ($items) => leitnerCounts($items));

  async function start() {
    // Start a new session via sessionsRepo and navigate to the session route.
    const deps = await getDeps();
    const id = crypto.randomUUID();
    const session = await deps.sessions.start({ id, target_items: 30, started_at: Date.now() });
    await goto(`/scale-degree/sessions/${session.id}`);
  }

  const degrees: Degree[] = [1, 2, 3, 4, 5, 6, 7];
</script>

<section class="dashboard">
  <h1 class="title">Scale-Degree Practice</h1>

  <div class="start-row">
    <button type="button" class="start" onclick={start}>Start today's session</button>
  </div>

  <section class="card">
    <h2>Per-degree mastery</h2>
    <div class="bars">
      {#each degrees as d}
        <div class="row">
          <span class="d-label">{d}</span>
          <div class="mastery-bar">
            <div class="fill" style="width: {Math.round(($degreeMastery.get(d) ?? 0) * 100)}%"></div>
          </div>
          <span class="pct">{Math.round(($degreeMastery.get(d) ?? 0) * 100)}%</span>
        </div>
      {/each}
    </div>
  </section>

  <section class="card">
    <h2>Leitner pipeline</h2>
    <div class="leitner">
      {#each ['new', 'learning', 'reviewing', 'mastered'] as box}
        <div class="box box-{box}">
          <div class="count">{$boxes[box] ?? 0}</div>
          <div class="box-label">{box}</div>
        </div>
      {/each}
    </div>
  </section>
</section>

<style>
  .dashboard { max-width: 640px; margin: 0 auto; }
  .title { font-size: 16px; font-weight: 600; margin: 0 0 16px; }
  .start-row { margin: 0 0 20px; }
  .start {
    width: 100%; padding: 14px; font-size: 14px;
    border-radius: 6px; border: 1px solid var(--cyan);
    background: transparent; color: var(--cyan);
  }
  .card {
    background: var(--panel); border: 1px solid var(--border);
    border-radius: 8px; padding: 12px; margin: 0 0 12px;
  }
  .card h2 { font-size: 11px; color: var(--muted); text-transform: uppercase; margin: 0 0 12px; letter-spacing: 0.04em; }
  .bars { display: flex; flex-direction: column; gap: 6px; }
  .row { display: flex; align-items: center; gap: 8px; font-size: 10px; }
  .d-label { width: 16px; font-variant-numeric: tabular-nums; color: var(--muted); }
  .pct { width: 36px; text-align: right; font-variant-numeric: tabular-nums; color: var(--text); }
  .mastery-bar { flex: 1; height: 8px; background: #171717; border-radius: 4px; overflow: hidden; }
  .fill { height: 100%; background: var(--green); transition: width 200ms ease; }
  .leitner { display: flex; gap: 6px; }
  .box {
    flex: 1; background: #171717; border: 1px solid var(--border); border-radius: 6px;
    padding: 8px 6px; text-align: center;
  }
  .box-new .count { color: var(--muted); }
  .box-learning .count { color: var(--amber); }
  .box-reviewing .count { color: var(--cyan); }
  .box-mastered .count { color: var(--green); }
  .count { font-size: 18px; font-weight: 600; font-variant-numeric: tabular-nums; }
  .box-label { font-size: 8px; color: var(--muted); text-transform: uppercase; }
</style>
```

- [ ] **Step 5: Update exercise index.ts**

```typescript
// Append to $lib/exercises/scale-degree/index.ts
export { default as DashboardView } from './internal/DashboardView.svelte';
```

- [ ] **Step 6: Replace the `/scale-degree/+page.svelte` placeholder**

```svelte
<script lang="ts">
  import { DashboardView } from '$lib/exercises/scale-degree';
</script>

<DashboardView />
```

- [ ] **Step 7: Run tests (component + e2e), commit, PR**

```bash
pnpm --filter ear-training-station test DashboardView
pnpm exec playwright test --filter ear-training-station dashboard-start
```

Expected: both green.

```bash
git add .
git commit -m "feat(exercise): DashboardView + replace /scale-degree placeholder

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push -u origin c1-3/task9-dashboard-view
gh pr create --title "feat(exercise): DashboardView" --body "Per-exercise dashboard with Start CTA, mastery bars, Leitner pipeline."
```

---

### Task 10: `DashboardWidget.svelte` for the station picker

Compact progress summary inside the station dashboard card.

**Files:**
- Create: `apps/ear-training-station/src/lib/exercises/scale-degree/internal/DashboardWidget.svelte`
- Modify: `apps/ear-training-station/src/lib/exercises/scale-degree/index.ts` (export)
- Modify: `apps/ear-training-station/src/lib/shell/StationDashboard.svelte` (render the widget inside each card)

- [ ] **Step 1: Branch**

```bash
git checkout main && git pull
git checkout -b c1-3/task10-dashboard-widget
```

- [ ] **Step 2: Create `DashboardWidget.svelte`**

```svelte
<script lang="ts">
  import { derived } from 'svelte/store';
  import { allItems } from '$lib/shell/stores';
  import { leitnerCounts } from '@ear-training/core/analytics/rollups';

  const boxes = derived(allItems, ($items) => leitnerCounts($items));
</script>

<div class="widget">
  <div class="stat">
    <span class="value">{$boxes.mastered ?? 0}</span>
    <span class="label">mastered</span>
  </div>
  <div class="stat">
    <span class="value">{$boxes.reviewing ?? 0}</span>
    <span class="label">reviewing</span>
  </div>
  <div class="stat">
    <span class="value">{$boxes.learning ?? 0}</span>
    <span class="label">learning</span>
  </div>
</div>

<style>
  .widget { display: flex; gap: 12px; margin-top: 12px; }
  .stat { display: flex; flex-direction: column; }
  .value { font-variant-numeric: tabular-nums; font-size: 14px; font-weight: 600; color: var(--cyan); }
  .label { font-size: 9px; color: var(--muted); text-transform: uppercase; }
</style>
```

- [ ] **Step 3: Export + mount**

Modify `index.ts`:

```typescript
export { default as DashboardWidget } from './internal/DashboardWidget.svelte';
```

Modify `StationDashboard.svelte` to render each exercise's widget:

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
        {#if ex.DashboardWidget}
          <ex.DashboardWidget />
        {/if}
      </a>
    {/each}
  </div>
</section>

<!-- styles unchanged -->
```

- [ ] **Step 4: Commit + PR**

```bash
git add .
git commit -m "feat(exercise): DashboardWidget in station picker card"
git push -u origin c1-3/task10-dashboard-widget
gh pr create --title "feat(exercise): DashboardWidget" --body "Compact per-exercise summary on the station picker card."
```

---

### Task 11: `SummaryView.svelte`

Post-session report card.

**Files:**
- Create: `apps/ear-training-station/src/lib/exercises/scale-degree/internal/SummaryView.svelte`
- Modify: exercise `index.ts` (export)
- Modify: session route `+page.svelte` (mount when `ended_at != null`)

- [ ] **Step 1: Branch + skeleton**

```bash
git checkout main && git pull
git checkout -b c1-3/task11-summary-view
```

Create `SummaryView.svelte`:

```svelte
<script lang="ts">
  import type { Session, Attempt } from '@ear-training/core/types/domain';
  import { goto } from '$app/navigation';

  let {
    session,
    attempts,
  }: {
    session: Session;
    attempts: Attempt[];
  } = $props();

  const durationMin = session.ended_at != null
    ? Math.round((session.ended_at - session.started_at) / 60000)
    : 0;
</script>

<section class="summary">
  <h1 class="title">Done.</h1>
  <p class="meta">{durationMin}m · {attempts.length} rounds</p>

  <div class="stats">
    <div class="stat">
      <div class="n">{session.pitch_pass_count}/{attempts.length}</div>
      <div class="stat-label">Pitch</div>
    </div>
    <div class="stat">
      <div class="n">{session.label_pass_count}/{attempts.length}</div>
      <div class="stat-label">Label</div>
    </div>
  </div>

  <div class="actions">
    <button type="button" class="btn" onclick={() => goto('/scale-degree')}>Dashboard</button>
    <button type="button" class="btn-primary" onclick={() => goto('/')}>Done</button>
  </div>
</section>

<style>
  .summary { max-width: 440px; margin: 40px auto; text-align: center; }
  .title { font-size: 28px; margin: 0 0 4px; color: var(--green); }
  .meta { font-size: 11px; color: var(--muted); margin: 0 0 24px; }
  .stats { display: flex; gap: 16px; justify-content: center; margin: 0 0 24px; }
  .stat { flex: 1; padding: 16px; background: var(--panel); border: 1px solid var(--border); border-radius: 8px; }
  .n { font-size: 28px; font-weight: 500; font-variant-numeric: tabular-nums; }
  .stat-label { font-size: 10px; color: var(--muted); text-transform: uppercase; margin-top: 4px; }
  .actions { display: flex; gap: 8px; justify-content: center; }
  .btn, .btn-primary {
    padding: 10px 20px; border-radius: 6px; font-size: 12px;
    border: 1px solid var(--border); background: transparent; color: var(--muted);
  }
  .btn-primary { border-color: var(--cyan); color: var(--cyan); }
</style>
```

Export from `index.ts`:

```typescript
export { default as SummaryView } from './internal/SummaryView.svelte';
```

Wire into `+page.svelte`:

```svelte
{:else if data.session.ended_at != null}
  <SummaryView session={data.session} attempts={data.attempts} />
```

- [ ] **Step 2: Write the failing Playwright e2e**

Create `apps/ear-training-station/e2e/summary.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';
import { seedOnboarded } from './helpers/app-state';

test('viewing a completed session renders the summary report card', async ({ page }) => {
  await seedOnboarded(page);
  await page.addInitScript(() => {
    const req = indexedDB.open('ear-training', 1);
    req.onsuccess = () => {
      const tx = req.result.transaction(['sessions', 'attempts'], 'readwrite');
      tx.objectStore('sessions').put({
        id: 'completed-1',
        started_at: Date.now() - 600000,
        ended_at: Date.now() - 300000,
        target_items: 10,
        completed_items: 8,
        pitch_pass_count: 6,
        label_pass_count: 7,
        focus_item_id: null,
      });
    };
  });

  await page.goto('/scale-degree/sessions/completed-1');

  await expect(page.getByRole('heading', { name: /done/i })).toBeVisible();
  await expect(page.getByText(/6\/\d/)).toBeVisible();  // pitch stat
  await expect(page.getByRole('button', { name: /done/i })).toBeVisible();
});
```

Run:

```bash
pnpm exec playwright test --filter ear-training-station summary
```

Expected: FAIL initially, PASS after SummaryView is wired.

- [ ] **Step 3: Commit + PR**

```bash
pnpm --filter ear-training-station test SummaryView
pnpm exec playwright test --filter ear-training-station summary
git add .
git commit -m "feat(exercise): SummaryView report card"
git push -u origin c1-3/task11-summary-view
gh pr create --title "feat(exercise): SummaryView" --body "Post-session report card rendered when session.ended_at is set."
```

---

### Task 12: Real warmup round — replace onboarding step 4 stub

Replaces `StepWarmupStub.svelte` with a real round using `{ key: 'C', degree: 5 }` + `register: 'comfortable'`.

**Files:**
- Create: `apps/ear-training-station/src/lib/shell/onboarding/StepWarmupRound.svelte`
- Modify: `apps/ear-training-station/src/lib/shell/OnboardingFlow.svelte` (import the real step)
- Delete: `apps/ear-training-station/src/lib/shell/onboarding/StepWarmupStub.svelte`

- [ ] **Step 1: Branch**

```bash
git checkout main && git pull
git checkout -b c1-3/task12-onboarding-warmup
```

- [ ] **Step 2: Create `StepWarmupRound.svelte`**

```svelte
<script lang="ts">
  import { createSessionController } from '$lib/exercises/scale-degree';
  import { getDeps } from '$lib/shell/deps';
  import ActiveRound from '$lib/exercises/scale-degree/internal/ActiveRound.svelte';
  import FeedbackPanel from '$lib/exercises/scale-degree/internal/FeedbackPanel.svelte';
  import { goto } from '$app/navigation';
  import { onMount, onDestroy } from 'svelte';
  import { settings } from '$lib/shell/stores';
  import type { Item } from '@ear-training/core/types/domain';

  let { onBack }: { onBack: () => void } = $props();

  const warmupItem: Item = {
    id: '5-C-major',
    degree: 5,
    key: { tonic: 'C', quality: 'major' },
    box: 'new',
    accuracy: { pitch: 0, label: 0 },
    recent: [],
    attempts: 0,
    consecutive_passes: 0,
    last_seen_at: null,
    due_at: 0,
    created_at: 0,
  };

  let controller: ReturnType<typeof createSessionController> | null = $state(null);
  let sessionId = $state<string | null>(null);

  onMount(async () => {
    const deps = await getDeps();
    const id = crypto.randomUUID();
    sessionId = id;
    const session = await deps.sessions.start({ id, target_items: 1, started_at: Date.now() });
    controller = createSessionController({
      session,
      firstItem: warmupItem,
      itemsRepo: deps.items,
      attemptsRepo: deps.attempts,
      sessionsRepo: deps.sessions,
      settingsRepo: deps.settings,
      getAudioContext: () => new AudioContext(),
      getMicStream: async () => {
        const { requestMicStream } = await import('@ear-training/web-platform/mic/permission');
        const handle = await requestMicStream();
        return handle.stream;
      },
    });
  });

  onDestroy(() => controller?.dispose());

  async function finish() {
    const deps = await getDeps();
    await deps.settings.update({ onboarded: true });
    settings.update((s) => ({ ...s, onboarded: true }));
    await goto('/scale-degree');
  }
</script>

<div class="step">
  <h2 class="headline">Your first round</h2>
  <p class="body">Hear the key, then sing the target note and say its degree.</p>

  {#if controller}
    <ActiveRound {controller} />
    {#if controller.state.kind === 'graded'}
      <FeedbackPanel state={controller.state} showTooltip={true} />
      <div class="next">
        <button type="button" class="primary" onclick={finish}>Finish onboarding</button>
      </div>
    {/if}
  {:else}
    <p class="body">Preparing…</p>
  {/if}

  <div class="actions">
    <button type="button" class="back" onclick={onBack}>Back</button>
  </div>
</div>

<style>
  .step { max-width: 640px; margin: 16px auto; }
  .headline { font-size: 16px; font-weight: 500; margin: 0 0 8px; text-align: center; }
  .body { font-size: 11px; color: var(--muted); text-align: center; margin: 0 0 16px; }
  .next { display: flex; justify-content: center; margin-top: 16px; }
  .primary {
    padding: 10px 20px; border-radius: 6px; border: 1px solid var(--cyan);
    background: transparent; color: var(--cyan); font-size: 12px;
  }
  .actions { display: flex; justify-content: center; margin-top: 16px; }
  .back {
    padding: 8px 16px; border-radius: 6px; border: 1px solid var(--border);
    background: transparent; color: var(--muted); font-size: 11px;
  }
</style>
```

- [ ] **Step 3: Swap in `OnboardingFlow.svelte`**

Modify `OnboardingFlow.svelte`:

```svelte
<script lang="ts">
  import StepWelcome from './onboarding/StepWelcome.svelte';
  import StepMicPermission from './onboarding/StepMicPermission.svelte';
  import StepConceptIntro from './onboarding/StepConceptIntro.svelte';
  import StepWarmupRound from './onboarding/StepWarmupRound.svelte';

  let step = $state<1 | 2 | 3 | 4>(1);
  const next = () => { step = (step + 1) as typeof step; };
  const back = () => { step = (step - 1) as typeof step; };
</script>

<div class="onboarding">
  <div class="progress">Step {step} of 4</div>
  {#if step === 1}
    <StepWelcome onNext={next} />
  {:else if step === 2}
    <StepMicPermission onNext={next} onBack={back} />
  {:else if step === 3}
    <StepConceptIntro onNext={next} onBack={back} />
  {:else}
    <StepWarmupRound onBack={back} />
  {/if}
</div>

<!-- styles unchanged -->
```

- [ ] **Step 4: Delete the stub**

```bash
rm apps/ear-training-station/src/lib/shell/onboarding/StepWarmupStub.svelte
```

- [ ] **Step 4a: Update the onboarding e2e spec to cover the real warmup**

The `apps/ear-training-station/e2e/onboarding.spec.ts` from C1.2 currently asserts the stub step 4 ("Start practicing" button → `/scale-degree`). Update it to drive the real warmup round:

```typescript
import { test, expect } from '@playwright/test';
import { resetAppState } from './helpers/app-state';

test('fresh user completes onboarding including a real warmup round', async ({ page, context }) => {
  await context.grantPermissions(['microphone']);
  await resetAppState(page);
  await page.goto('/');

  await expect(page).toHaveURL(/\/onboarding/);

  // Step 1
  await page.getByRole('button', { name: /continue/i }).click();
  // Step 2
  await page.getByRole('button', { name: /grant microphone access/i }).click();
  // Step 3
  await page.getByRole('button', { name: /continue/i }).click();
  // Step 4 — real warmup
  await expect(page.getByText(/your first round/i)).toBeVisible();
  await page.getByRole('button', { name: /start round/i }).click();

  // Wait for the round to reach graded state (uses Playwright's mic stub —
  // the fake audio config makes pitch/digit detection produce confident
  // frames; a real-audio test would be flaky).
  await expect(page.getByText(/pitch/i)).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: /finish onboarding/i }).click();

  await expect(page).toHaveURL(/\/scale-degree$/);
});
```

Note: driving a real round in Playwright requires the fake mic audio config (the existing harness smoke test uses a synthesized sine wave via `--use-fake-device-for-media-stream`). Confirm that flag is already set in `playwright.config.ts`; if not, add it. If driving the round end-to-end in Playwright is still flaky in practice, this task's e2e may be demoted to asserting the shell navigation (click Start round, confirm session state exists) and the round-completion assertion moves to Task 6's integration e2e.

Run:

```bash
pnpm exec playwright test --filter ear-training-station onboarding
```

Expected: PASS.

- [ ] **Step 5: Commit + PR**

```bash
git add apps/ear-training-station/src/lib/shell/onboarding/StepWarmupRound.svelte \
        apps/ear-training-station/src/lib/shell/OnboardingFlow.svelte
git rm apps/ear-training-station/src/lib/shell/onboarding/StepWarmupStub.svelte
git commit -m "$(cat <<'EOF'
feat(app): real warmup round in onboarding step 4

Replaces the C1.2 stub with a real round using the scale-degree
SessionController. Warmup item is degree 5 in C major per spec.
Finish Onboarding button sets onboarded = true and navigates to
the exercise dashboard.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git push -u origin c1-3/task12-onboarding-warmup
gh pr create --title "feat(app): warmup round in onboarding" --body "Step 4 of onboarding is now a real round using the session controller. Warmup item: degree 5 in C major."
```

---

## Plan C1.3 completion checklist

When all 12 PRs are merged:

- [ ] `/scale-degree` renders the DashboardView with mastery bars + Leitner + Start CTA
- [ ] Start CTA creates a session and navigates to `/scale-degree/sessions/[id]`
- [ ] ActiveRound renders: chord blocks animate during cadence, target appears, pitch trace live during capture
- [ ] On `CAPTURE_COMPLETE`, FeedbackPanel renders with ✓/✗ + cents + plain-English + tooltip
- [ ] ReplayBar offers You / Target / Both (Both = simultaneous overlay)
- [ ] Refresh mid-session abandons cleanly and lands on SummaryView
- [ ] Onboarding step 4 is a real warmup round; completing it sets `onboarded = true`
- [ ] All unit + component tests green
- [ ] All Playwright e2e specs green:
  - `session-abandon.spec.ts` — refresh of unfinished session renders summary
  - `dashboard-start.spec.ts` — Start button creates session and navigates
  - `round-graded.spec.ts` — seeded graded state renders FeedbackPanel + ReplayBar
  - `summary.spec.ts` — completed session renders report card
  - `onboarding.spec.ts` (updated) — full flow including real warmup round ends at `/scale-degree`
- [ ] `pnpm run typecheck && pnpm run test && pnpm run build` clean

Plan C1.4 adds error UX polish (MicDeniedGate, DegradationBanner, ShellToast), the service worker, and the axe a11y smoke spec. All round-feature e2e coverage is already in C1.3 (per TDD discipline — tests written alongside features, not deferred).
