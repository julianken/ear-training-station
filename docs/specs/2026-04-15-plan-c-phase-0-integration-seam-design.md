# Plan C · Phase C0 — Integration Seam Design

**Status:** Design (brainstorm output). Implementation plan to follow in `docs/plans/` via the writing-plans skill.

**Scope:** Pre-UI integration work that bridges Plan A (pure logic) and Plan B (audio I/O) so Plan C1 (Svelte UI) can be built on a stable foundation. **No Svelte components, no UI, no service worker.**

---

## Context

Plan A delivered the pure-logic kernel: types, Leitner SRS, interleaving scheduler, IndexedDB repos, session orchestrator. Plan B delivered the audio I/O stack: Tone.js playback, cadence and target synthesis, YIN pitch detection via a native `AudioWorkletNode`, speech-commands keyword spotter for digit recognition. Both are merged and stable on `main` (head `6903750`, 124 Vitest tests + 1 Playwright smoke, all green).

A pre-Plan-C audit (this session, 2026-04-15) across six dimensions — integration gap, module surface quality, design-commitment conformance, test coverage, Plan C prerequisites, and code duplication — found the codebase in very good shape overall. No drift from design commitments, clean production build, minimal duplication, disciplined test philosophy. It also identified a small cluster of integration-seam issues that would bite Plan C1 if left unaddressed:

- **Type mismatch.** KWS emits `DigitLabel` (`'one' | 'two' | …`). Orchestrator's `Attempt.spoken.digit` is `number | null`. No conversion helper exists — fails `tsc` on any wiring attempt.
- **Two-clock problem.** `targetStartAtAcTime` is in Tone's `AudioContext`. `PitchFrame.at` is in a separate, cached native `AudioContext` required by `AudioWorkletNode`. Their `currentTime` clocks are not comparable. Any gate of "frames after target started" would silently misfire.
- **Private grading constant.** `IN_KEY_CENTS = 50` lives as a module-private const in `degree-mapping.ts`. Plan C1 would duplicate it.
- **KWS re-start unsafe.** Re-calling `startKeywordSpotter` with a different probability threshold silently keeps the first threshold via the idempotent-cache. Plan C1's settings UI will hit this.
- **Missing middle layer.** Neither Plan A nor Plan B owned the session-round lifecycle. No `RoundState` type, no event schema, no composition contract between orchestrator and audio stack. Plan C1 would write it all inline in Svelte.
- **Missing pure helpers.** No variability pickers for per-round timbre/register selection, no analytics rollups for the dashboard (per-degree mastery, per-key heatmap, Leitner counts, streak), no design tokens for the committed aesthetic.
- **Monolithic structure.** Multiple future ear-training apps will share the core logic. The current flat `src/` is a monolith; the second app would force a disruptive restructure.

Phase C0 closes these gaps before any Svelte code is written.

---

## Goals

1. **Make Plan A and Plan B integrable via pure, testable modules.** The round reducer, event schema, and audio-to-event adapters exist and are covered by unit tests before Plan C1 imports any of them.
2. **Establish a three-layer pnpm monorepo.** `packages/core` (pure TypeScript), `packages/web-platform` (browser infrastructure), `packages/ui-tokens` (design tokens), `apps/ear-training-station` (this app). Future ear-training apps land as sibling folders under `apps/` and reuse `core` + `web-platform` + `ui-tokens` without migration.
3. **Lock the design tokens.** Background `#0a0a0a`, cyan `#22d3ee`, amber `#fbbf24`, green `#22c55e`, red `#ef4444`. Consumed as both TypeScript constants and CSS custom properties so Svelte components use `var(--cyan)` and dynamic code imports `colors.cyan`.
4. **Zero drift from non-negotiable design commitments.** The round reducer enforces cadence-before-target structurally. Variability is modeled as a per-round input, not session-level state. No XP/points/streak-multiplier shapes enter the type system.
5. **Close specific test gaps** from the pre-Phase-C0 audit: `groupFor()`, `pickFocusItem()` tie-break, `centsBetween()` edge cases, `nextItem()` after `completeSession()`.

## Non-goals (deferred to Phase C1)

- Any Svelte component, store, or route
- Session screen, F2 feedback panel, dashboard, summary screen
- Pitch-trace persistence (storing sung-frame arrays in `Attempt`)
- Mic recorder for "you-only" replay
- Partial playback API for segmented replay
- Service worker and KWS model caching
- Real data in the analytics rollups — the functions exist and are tested; wiring them to a UI is Plan C1's problem

---

## Architectural decisions

All four decisions were made interactively during brainstorming and apply throughout Phase C0.

### 1. Round lifecycle is a pure reducer, not an imperative facade

The round lifecycle is modeled as a `RoundState` discriminated union plus a pure `roundReducer(state, event) → state'`. Composition — subscribing to audio handles, dispatching events, stopping on done — lives in Plan C1 Svelte code.

**Rationale.** Iteration flexibility. New sequences (grace windows, multi-digit confirmation, different grading rules), new flows (free practice, demo mode, teaching mode), and new UI shapes are additive in Svelte without touching the reducer. Svelte 5's runes handle subscription cleanup automatically, which neutralizes the main argument for an imperative facade.

### 2. Two-clock problem is solved via Ports & Adapters (wall-clock proxy)

A dedicated adapter layer (`round-adapters`, in `packages/web-platform`) is the only module that knows the two clocks exist. It converts raw audio-stack signals (`PitchFrame`, `DigitFrame`, `targetStartAtAcTime` resolution) into typed `RoundEvent` values stamped with wall-clock `at_ms` at arrival.

The reducer sees only normalized events with a single timestamp domain. It has no `AudioContext` awareness, no Tone.js awareness, no browser awareness.

**Rationale.** Receiver-side ordering is the standard technique for unsynchronized event sources in distributed systems, and our frame interval (~21ms at 47Hz) is well above wall-clock jitter (~5–20ms). Option 2 (shared `AudioContext`) would require re-opening Plan B's hard-won audio startup, which deliberately split the contexts because `AudioWorkletNode` rejected Tone's wrapped context. Option 3 (measured clock offset) is strictly worse than wall-clock at this frame interval once drift is accounted for.

**Flexibility dividend.** Three dimensions of change are now decoupled:

- New event type → touch reducer only
- New UI flow → touch Svelte composition only
- New timing technique (e.g., future shared `AudioContext`) → touch `round-adapters` only

### 3. Three-layer pnpm monorepo

- `packages/core` — pure TypeScript, no browser APIs, no Svelte. Contains types, music theory primitives, SRS, scheduler, orchestrator, repo interfaces, **pure DSP** (YIN), **pure note math** (hz/midi/cents), **pure structure builders** (cadences, targets), **pure grading** (hz → degree mapping), and all new Phase C0 modules (round, variability, analytics). Reusable across future ear-training apps.
- `packages/web-platform` — browser-specific infrastructure only: Tone.js playback, `AudioWorkletNode` wrappers, speech-commands runtime, `getUserMedia`, IndexedDB, plus the `round-adapters` layer. Reusable across web-based ear-training apps.
- `packages/ui-tokens` — design tokens (TS constants + CSS custom properties). Reusable across all future apps.
- `apps/ear-training-station` — this specific app's shell. Plan C1 will fill this with Svelte code.

**Rationale.** The user plans multiple ear-training apps that share components. A pnpm workspace enforces boundaries at the package-manager level — `packages/core` has no dependency on `apps/*`, so accidental cross-layer imports fail the install. Future apps drop into `apps/` as new folders and reuse the shared packages without migration.

### 4. Monorepo migration is task 1 of the Phase C0 plan

The existing Plan A/B code moves into `packages/core` and `packages/web-platform` as the first PR of Phase C0. All 124 unit tests and the Playwright smoke test must be green in the new location before any new Phase C0 code lands.

**Rationale.** Avoids the write-then-move churn of building new modules in the old structure and then migrating them. The migration is a single mechanical PR; new modules land in subsequent PRs inside the correct package.

---

## Target structure

```
ear-training-monorepo/
├── pnpm-workspace.yaml
├── package.json                       # workspace root (private)
├── tsconfig.base.json                 # shared compiler options
├── packages/
│   ├── core/                          # @ear-training/core
│   │   ├── package.json
│   │   ├── tsconfig.json              # project reference
│   │   └── src/
│   │       ├── music/                 # ← src/types/music.ts
│   │       ├── types/                 # ← src/types/domain.ts
│   │       ├── srs/                   # ← src/srs/*
│   │       ├── scheduler/             # ← src/scheduler/*
│   │       ├── session/               # ← src/session/orchestrator.ts
│   │       ├── repos/                 # NEW — repo interfaces (extracted from store)
│   │       ├── seed/                  # ← src/seed/*
│   │       ├── audio/                 # ← src/audio/{note-math,cadence-structure,target-structure}.ts (PURE)
│   │       ├── pitch/                 # ← src/pitch/{yin,degree-mapping}.ts (PURE)
│   │       ├── round/                 # NEW — events.ts, state.ts, grade-pitch.ts
│   │       ├── variability/           # NEW — pickers.ts
│   │       └── analytics/             # NEW — rollups.ts
│   ├── web-platform/                  # @ear-training/web-platform
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── audio/                 # ← src/audio/{player,timbres}.ts (Tone-dependent)
│   │       ├── pitch/                 # ← src/pitch/{pitch-detector,yin-worklet}.ts (AudioWorkletNode)
│   │       ├── speech/                # ← src/speech/*
│   │       ├── mic/                   # ← src/mic/*
│   │       ├── store/                 # ← src/store/* (concrete repo implementations)
│   │       └── round-adapters/        # NEW — index.ts, clock.ts
│   └── ui-tokens/                     # @ear-training/ui-tokens
│       ├── package.json
│       └── src/
│           ├── tokens.ts              # NEW — typed constants
│           └── tokens.css             # NEW — CSS custom properties
└── apps/
    └── ear-training-station/          # ear-training-station (unscoped, private)
        ├── package.json
        ├── tsconfig.json
        ├── vite.config.ts             # ← vite.config.ts
        ├── playwright.config.ts       # ← playwright.config.ts
        ├── index.html                 # ← index.html
        ├── src/
        │   ├── app.ts                 # ← src/app.ts
        │   ├── harness/               # ← src/harness/*
        │   └── (components, routes, stores — Plan C1)
        ├── harness/audio.html         # ← harness/audio.html
        ├── e2e/                       # ← e2e/*
        └── public/
```

### Splitting repo interfaces from implementations

`src/store/*.ts` currently defines both interface and implementation in the same file (e.g., `ItemsRepo` interface + `createItemsRepo(db: DB)` factory). The monorepo split requires separating these:

- Interfaces (`ItemsRepo`, `AttemptsRepo`, `SessionsRepo`, `SettingsRepo`) move to `packages/core/src/repos/interfaces.ts`. They have no dependency on `idb` or IndexedDB.
- Concrete implementations (`createItemsRepo`, `DB`, `openEarTrainingDB`, `EarTrainingDB` schema) stay in `packages/web-platform/src/store/`.

The orchestrator in `packages/core/src/session/orchestrator.ts` imports only from `../repos/interfaces`. The app wires in concrete implementations at startup.

---

## Module inventory — what Phase C0 introduces

### `@ear-training/core/round/events.ts`

Discriminated union for round-lifecycle events. Every variant carries `at_ms: number` (wall clock).

```ts
export type RoundEvent =
  | { type: 'ROUND_STARTED';   at_ms: number; item: Item; timbre: TimbreId; register: Register }
  | { type: 'CADENCE_STARTED'; at_ms: number }
  | { type: 'TARGET_STARTED';  at_ms: number }
  | { type: 'PITCH_FRAME';     at_ms: number; hz: number; confidence: number }
  | { type: 'DIGIT_HEARD';     at_ms: number; digit: number; confidence: number }
  | { type: 'PLAYBACK_DONE';   at_ms: number }
  | { type: 'USER_CANCELED';   at_ms: number };
```

No audio-stack types leak into this module. No `Date.now()` calls.

### `@ear-training/core/round/state.ts`

```ts
export type RoundState =
  | { kind: 'idle' }
  | { kind: 'playing_cadence'; item: Item; timbre: TimbreId; register: Register; startedAt: number }
  | { kind: 'playing_target';  item: Item; timbre: TimbreId; register: Register; targetStartedAt: number; frames: PitchObservation[] }
  | { kind: 'listening';       item: Item; timbre: TimbreId; register: Register; targetStartedAt: number; frames: PitchObservation[]; digit: number | null; digitConfidence: number }
  | { kind: 'graded';          item: Item; timbre: TimbreId; register: Register; outcome: AttemptOutcome; sungBest: PitchObservation | null; digitHeard: number | null };

export function roundReducer(state: RoundState, event: RoundEvent): RoundState;
```

The reducer exhaustively handles every `(state, event)` pair. Invalid combinations return the current state unchanged — tests verify the ignored cases explicitly.

### `@ear-training/core/round/grade-pitch.ts`

Pure grading helper consumed by the reducer at the `listening → graded` transition.

```ts
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
): PitchGrade;
```

Reuses existing functions from `@ear-training/core/pitch/degree-mapping` (`mapHzToDegree`) and `@ear-training/core/audio/note-math` (`centsBetween`) — both pure modules that live in `core`, not `web-platform`.

### `@ear-training/web-platform/round-adapters/`

The only module family that knows the two-clock problem exists. Pure functions that convert raw audio-stack types into `RoundEvent` values with wall-clock timestamps.

```ts
// round-adapters/clock.ts — injectable clock so tests can stub
export interface Clock { now(): number; }
export const systemClock: Clock = { now: () => Date.now() };

// round-adapters/index.ts
export function pitchFrameToEvent(frame: PitchFrame, clock?: Clock): RoundEvent;
export function digitFrameToEvent(frame: DigitFrame, clock?: Clock): RoundEvent | null;
export function targetStartedEvent(clock?: Clock): RoundEvent;
export function cadenceStartedEvent(clock?: Clock): RoundEvent;
export function playbackDoneEvent(clock?: Clock): RoundEvent;
export function roundStartedEvent(item: Item, timbre: TimbreId, register: Register, clock?: Clock): RoundEvent;
export function userCanceledEvent(clock?: Clock): RoundEvent;
```

Each call builds a typed event using `clock.now()` (defaults to `systemClock`). Tests inject a stub clock for deterministic `at_ms` values. The adapter uses `digitLabelToNumber` (below) to normalize the digit.

### `@ear-training/web-platform/speech/digit-label.ts`

```ts
export function digitLabelToNumber(label: DigitLabel): number;
```

Trivial: `DIGIT_LABELS.indexOf(label) + 1`. Seven test cases + one "unknown label" error case. Lives near the keyword-spotter because that's where the mismatch originates.

### `@ear-training/core/variability/pickers.ts`

Pure per-round pickers with anti-repeat and settings override.

```ts
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
): TimbreId;

export function pickRegister(
  rng: () => number,
  history: VariabilityHistory,
  settings: VariabilitySettings,
): Register;
```

Uniform random over the allowed set excluding `history.last*`. A locked setting short-circuits to the locked value.

### `@ear-training/core/analytics/rollups.ts`

Compositional pure functions over `ReadonlyArray<Item>` and `ReadonlyArray<Session>`. Plan C1 dashboards pick which to call.

```ts
export function masteryByDegree(items: ReadonlyArray<Item>): Map<Degree, number>;
export function masteryByKey(items: ReadonlyArray<Item>): Map<string, number>; // key is keyId(key)
export function leitnerCounts(items: ReadonlyArray<Item>): Record<LeitnerBox, number>;
export function currentStreak(sessions: ReadonlyArray<Session>, now: number): number;
```

Each function is independently testable. No premature materialization — at 168 items the on-demand cost is microseconds.

### `@ear-training/ui-tokens/src/tokens.ts` and `tokens.css`

Dual export. Same values in both files; the CSS file is authored by hand to match the TS file (no build step).

```ts
// tokens.ts
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

```css
/* tokens.css */
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

Plan C1 imports `tokens.css` once in `app.ts`, then uses `var(--cyan)` freely in Svelte `<style>` blocks. When dynamic color is needed in TypeScript, `import { colors } from '@ear-training/ui-tokens'`.

A single unit test verifies the two files agree on every value.

---

## Must-fix mechanical items

Grouped under Phase C0 for tracking. All are small isolated changes.

1. **Export `IN_KEY_CENTS`** from `@ear-training/core/pitch/degree-mapping.ts` (pure module, lives in `core`), with a docstring about the deterministic tie-break (first degree wins for equidistant pitches, current iteration order).
2. **KWS re-start safety** in `@ear-training/web-platform/speech/keyword-spotter.ts`: throw a descriptive `Error` when `startKeywordSpotter` is called while a cached handle exists with different thresholds. The existing idempotent-cache behavior is preserved for same-threshold calls. Update the handle cache to also store the threshold inputs so the comparison is exact.
3. **Digit label conversion** lands via `digit-label.ts` (module inventory above).

---

## Test strategy

| Layer | Tooling | What's tested | Not tested |
|---|---|---|---|
| Pure modules (reducer, events, pickers, analytics, grade-pitch, digit-label, tokens agreement) | Vitest | Every function, every `(state, event)` transition, edge cases, tie-break semantics | — |
| Adapters (`round-adapters`) | Vitest + stubbable `Clock` | Translation correctness, not wall-clock values themselves | Real `Date.now()` timing |
| Persistence (interfaces + concrete repos) | Vitest + `fake-indexeddb` | Repo contract, query correctness, round-trip | Index performance |
| Integration seams | Vitest (new file `packages/core/tests/round-integration.test.ts`) | Golden path event stream through reducer; cancel mid-round; timeout with no pitch; wrong digit | Audio stack real playback |
| Audio playback, mic input, KWS inference | Dev harness + 1 Playwright smoke | End-to-end sanity in a real browser | Everything else (mocking trap) |

**Test gap backfills** — grouped under Phase C0, added at their post-migration locations:

- `packages/core/tests/scheduler/curriculum.test.ts` — `groupFor()` coverage for each of the 4 curriculum groups plus non-membership
- `packages/core/tests/session/orchestrator.test.ts` — `pickFocusItem()` tie-break cases (all same accuracy, all same box, empty, single-item)
- `packages/core/tests/audio/note-math.test.ts` — `centsBetween()` for zero hz, negative hz, extreme frequencies
- `packages/core/tests/session/orchestrator.test.ts` — `nextItem()` after `completeSession()` state-machine edge

---

## Verification

Phase C0 is complete when all of these hold:

1. `pnpm run typecheck` passes at the workspace root with zero errors.
2. `pnpm run test` runs all unit tests across all packages (124 pre-existing + new Phase C0 tests) and all pass.
3. `pnpm run test:e2e` runs the Playwright smoke test and passes.
4. `pnpm run build` in `apps/ear-training-station` produces a clean production bundle. Dev harness is deliberately excluded (same as today). `speech-commands` does not appear in the prod graph.
5. The round reducer has exhaustive `(state, event)` test coverage: at least one passing test per allowable transition and one per "ignored in this state" combination.
6. The adapters have unit tests that verify translation correctness using an injected stub `Clock`.
7. All three must-fix mechanical items (IN_KEY_CENTS export, KWS re-start safety, digit label conversion) are landed and referenced by tests.
8. The `ui-tokens` package has a test asserting that `tokens.ts` and `tokens.css` agree on every color value.
9. CLAUDE.md is updated: new monorepo structure, package names, where new modules live, the Phase C0 module surface that Plan C1 will consume, the dev-command changes (`pnpm` instead of `npm`, workspace-scoped scripts).
10. The existing dev harness at `apps/ear-training-station/harness/audio.html` still works end-to-end (Play Round, Start Pitch Detection, Start Digit Recognizer all function in the browser).

---

## Open questions for Plan C1 (not blocking)

Noted here so Plan C1 brainstorming has them queued up:

- Where does composition live in Svelte — a `<SessionHost>` component, a plain TypeScript module called from `onMount`, or a store with its own lifecycle?
- Canceled rounds: persist as an `Attempt` with `graded.pass = false`, or not persist at all?
- Does the user see the raw pitch trace live during the listening window, or only in feedback?
- Which analytics rollup functions does the dashboard call eagerly vs. lazily?

None of these block Phase C0. They belong to Plan C1.

---

## Critical files referenced by this design

Existing files that Phase C0 will move and consume. **Paths shown below are pre-migration `src/*` paths.** See the Target structure section above for where each file lands in the monorepo layout — notably, the pure parts of `src/audio/*` and `src/pitch/*` land in `packages/core`, while the Tone/worklet parts land in `packages/web-platform`.

- `src/session/orchestrator.ts` — `Orchestrator`, `RecordAttemptInput`, `OrchestratorDeps`
- `src/scheduler/selection.ts` — `selectNextItem`
- `src/scheduler/interleaving.ts` — `isBlocked`, `RoundHistoryEntry`
- `src/scheduler/curriculum.ts` — `groupFor`, `MVP_CURRICULUM`
- `src/srs/leitner.ts` — `nextBoxOnPass`, `nextBoxOnMiss`, `intervalForBox`
- `src/srs/accuracy.ts` — `weightedAccuracy`, `pushOutcome`
- `src/types/music.ts`, `src/types/domain.ts` — core type shapes
- `src/store/*.ts` — repo interfaces + implementations (to be split)
- `src/audio/player.ts` — `playRound`, `PlayRoundHandle`, `targetStartAtAcTime`
- `src/audio/cadence-structure.ts` — `buildCadence`, `CADENCE_DURATION_SECONDS`
- `src/audio/target-structure.ts` — `buildTarget`, `TARGET_DURATION_SECONDS`
- `src/audio/timbres.ts` — `TIMBRE_IDS`, `getTimbre`
- `src/audio/note-math.ts` — `midiToHz`, `hzToMidi`, `centsBetween`, `nearestMidi`
- `src/pitch/pitch-detector.ts` — `startPitchDetector`, `PitchDetectorHandle`, `PitchFrame`
- `src/pitch/yin-worklet.ts` — worklet processor
- `src/pitch/degree-mapping.ts` — `mapHzToDegree`, `DegreeMapping`, private `IN_KEY_CENTS`
- `src/speech/keyword-spotter.ts` — `startKeywordSpotter`, `DigitLabel`, `DIGIT_LABELS`, `DigitFrame`
- `src/speech/kws-loader.ts` — `loadKwsRecognizer`
- `src/mic/permission.ts` — `requestMicStream`, `queryMicPermission`
- `src/harness/audio-harness.ts` — current integration template

Phase C0 does not modify the logic of any of these files. It moves them into the correct package, splits repo interfaces out, and adds new modules around them.
