# Plan C · Phase C1 — UI Integration Design

**Status:** Design (brainstorm output). Implementation plan to follow in `docs/plans/` via the writing-plans skill.

**Scope:** Build the Svelte UI on top of the C0 integration seam. Turn the station into an installable, offline-capable PWA with one working exercise (scale-degree) living inside a multi-app shell that is ready — architecturally — for future exercises. **In scope:** SvelteKit app shell, exercise module pattern with a public contract, session / dashboard / summary / onboarding / settings UI, round lifecycle wiring including Option B `listening → graded`, `AudioBufferRecorder` for user-audio replay, service worker precache, error / permission UX, component and end-to-end tests. **Out of scope:** a second exercise, polished mobile layout, persisted replay, full WCAG-AA audit.

---

## Context

Plans A (foundation + core logic), B (audio I/O), and C0 (integration seam) delivered a complete pure-logic and browser-infrastructure foundation. On `main`: 221 Vitest unit tests + 1 Playwright smoke test green, pre-C1 foundation fixes landed (PR #30: KWS stale thresholds, `Degree` type leak, settings-repo merge), and GitHub Actions CI (CI, lint, e2e shards, bundle size, CodeQL, Dependabot) gates with a Mergify merge queue.

`apps/ear-training-station/src/app.ts` is `console.log('ear-training: foundation layer')` today. No Svelte code exists. Plan C1 is greenfield on the UI side, sitting on a very solid base.

The MVP spec (`docs/specs/2026-04-14-ear-training-mvp-design.md`) calls for one focused exercise. A brainstorming session on 2026-04-16 confirmed the long-term product shape is a **multi-exercise station**: each exercise is a mini-application at its own route, sharing a station shell (global streak, settings, onboarding, exercise picker). Plan C1 builds one exercise (scale-degree) *inside* the multi-app shape — deliberately thin on the station side, fully fleshed on the exercise side, with an explicit contract between them so exercise #2 is a copy-paste-and-modify job, not a rewrite.

A multi-agent survey + PR-comment sweep run before brainstorming identified 11 non-obvious gaps between spec and code — user-audio recording, chord-block animation, cadence tempo jitter, function-tooltip copy table, register-expansion gating, reduced-motion enforcement, service worker scaffolding, and the full error-path UX (all zero in code). The PR backlog is mostly CI polish (autoqueue, trace/screenshot artifacts); no UI-bearing decisions were buried in threads.

---

## Goals

1. **Ship an installable, offline-capable PWA** with one complete exercise (scale-degree) passing all 10 ship criteria in Delivery.
2. **Establish the multi-app shape explicitly.** The station dashboard at `/` is distinct from the exercise dashboard at `/scale-degree`. Adding exercise #2 is one new manifest + one new route directory, with no shell refactor.
3. **Preserve the pure-reducer discipline from C0.** All round lifecycle driven through the existing `roundReducer` + a new `CAPTURE_COMPLETE` event (Option B). No imperative state hidden inside Svelte components.
4. **Respect the lifecycle pressure of audio resources.** Mic, pitch detector, KWS, and the new `AudioBufferRecorder` start on the session route mount and stop on unmount. Svelte lifecycle *is* the resource lifecycle.
5. **Match the locked visual design.** Mockups in `docs/mockups/` define dashboard, session, feedback, summary. This plan implements them without aesthetic drift.
6. **Live up to the user's four stated values** — decoupled, reusable, easily tested, simple.

## Non-goals (deferred)

- A second exercise (architecture is ready; implementation is v2)
- Persisted replay (user audio + pitch frames are in-memory only in MVP)
- Polished mobile layout (C1 ships "works"; C1.5 polishes)
- Full WCAG-AA audit (axe smoke is the C1 floor)
- Visual regression / screenshot tests
- A2HS install prompt and update-ready banner (end-of-C1 polish; slip to C1.5 if needed)
- Cadence tempo jitter (±10% per spec §5.3; end-of-C1 polish; not load-bearing)

---

## Architectural decisions

All eleven decisions were made interactively during the 2026-04-16 brainstorming session. Each lists its alternatives and the rationale that settled it.

### 1. User audio recording — MVP

**Decision:** include `AudioBufferRecorder` in C1.
**Alternatives:** defer to v2 (the segmented replay becomes two sources instead of three).
**Rationale:** spec §9.3 locks the three-source You / Target / Both segmented replay as part of F2 feedback. Deferring "You" drifts the spec. The implementation is small (see decision 7).

### 2. Stack — SvelteKit + Svelte 5 runes + `adapter-static` + `@vite-pwa/sveltekit`

**Decision:** SvelteKit 2.x with Svelte 5 runes, `adapter-static`, `@vite-pwa/sveltekit` for PWA plumbing.
**Alternatives:** hand-rolled SPA with plain Vite; hand-rolled service worker.
**Rationale:** this is a multi-app station (decision 3). URL identity — `/`, `/scale-degree`, `/scale-degree/sessions/[id]`, future `/intervals` — is the organizing principle, not a convenience. File-based routing delivers URL identity without hand-rolled routing state. `adapter-static` keeps the PWA client-only (no server). Svelte 5 runes give an ergonomic reactive-class pattern for the session controller. `@vite-pwa/sveltekit` (Workbox under the hood) covers precache + runtime cache + update-ready events.

### 3. Station dashboard at `/` — exercise picker card

**Decision:** `/` is a distinct station dashboard with an exercise picker grid. In MVP, one card for scale-degree. Shell header includes logo, streak chip, total-time chip, settings link. Exercise #2 = one new card.
**Alternatives:** thin bridge screen (single CTA); aggregate hero with cross-exercise stats; auto-redirect to `/scale-degree`.
**Rationale:** the multi-app shape is legible from day 1. "Station" isn't pure chrome; its identity is the picker.

### 4. Exercise module boundary — A+ (`$lib/exercises/<slug>/` + lint rule)

**Decision:** exercise code lives at `apps/ear-training-station/src/lib/exercises/<slug>/`. The only public import surface is `index.ts`. ESLint `no-restricted-imports` blocks reaching into `internal/*` from outside the exercise. Contract:

```ts
export const manifest: ExerciseManifest;
export function createSessionController(deps: ExerciseDeps): SessionController;
export { default as DashboardView } from './internal/DashboardView.svelte';
export { default as SessionView } from './internal/SessionView.svelte';
export { default as DashboardWidget } from './internal/DashboardWidget.svelte';
```

**Alternatives:** monorepo workspace package per exercise (`packages/exercise-scale-degree/`); flat route-only layout with all exercise code under `routes/<slug>/`.
**Rationale:** scored A+ against the user's four values — equivalent or better than the workspace package on decoupling, reuse, and testability, strictly better on simplicity (no per-exercise `package.json` / `tsconfig.json` / `vitest.config.ts` overhead). Promotable to a workspace package later if the discipline ever slips. The flat route-only layout loses the registry-via-import pattern that feeds the picker.

### 5. Session URL shape — `/scale-degree/sessions/[id]`, refresh abandons

**Decision:** session URL is `/scale-degree/sessions/[id]`. The same route renders active or summary based on `session.ended_at`. Refresh of a non-ended session abandons: `load()` sets `ended_at = now` and the page renders summary.
**Alternatives:** single route with internal state; session URL with no ID.
**Rationale:** standard multi-app URL pattern (Gmail, GitHub, Linear all use `/<entity>/[id]`). `Session.id` already exists in the domain model — putting it in the URL is free. Resource lifecycle via Svelte mount/unmount works the same whether the URL has an ID or not; the ID only adds URL-addressability. Refresh-abandon policy aligns with spec §10.1 "partial attempts not graded".

### 6. Onboarding and settings — both routes

**Decision:** `/onboarding` and `/settings` are dedicated routes. Onboarding is gated by `+layout.ts` redirecting to `/onboarding` when `settings.onboarded === false`.
**Alternatives:** both modals; mixed (onboarding route, settings modal).
**Rationale:** uniform URL patterning across the app, consistent mental model. Settings-as-route means a toggle flip unmounts and remounts the page under it — accepted cost for URL consistency.

### 7. `AudioBufferRecorder` — `AudioWorkletNode` → `AudioBuffer`

**Decision:** new `packages/web-platform/src/mic/recorder.ts` using an `AudioWorkletNode` with a preallocated Float32 ring buffer. On stop, slice the ring into an `AudioBuffer` in the same native `AudioContext` the pitch detector uses.
**Alternatives:** `MediaRecorder` API (Blob → `decodeAudioData`); record inside the session controller without a web-platform module.
**Rationale:** consistent with the existing YIN pitch-worklet discipline. `AudioBuffer` composes trivially with the simultaneous "Both" replay (two `BufferSourceNode`s, same `AudioContext`, perfect sync). `MediaRecorder` would require a codec round-trip and make "Both" awkward (mixing a Blob-sourced `<audio>` element with scheduled target playback). Preallocation follows the Plan B discipline "audio-render thread is allocation-sensitive".

### 8. Chord-block animation — derive client-side from `AudioContext`

**Decision:** UI reads `cadenceStartAtAcTime` from the `playRound` handle plus `ChordEvent.startTimeSec` from the cadence array. A requestAnimationFrame loop reads `audioContext.currentTime` and flags each chord block as `active` when its range contains the current time. Same pattern drives the pitch-trace "now" indicator.
**Alternatives:** extend `playRound` with an `onChordStart?` callback; return an event emitter from `playRound`.
**Rationale:** zero change to the `playRound` contract; audio layer stays decoupled from visual concerns; visual timing is anchored to the same clock (`audioContext.currentTime`) the audio is anchored to.

### 9. Error / permission UX — severity-matched matrix

**Decision:** each edge case from spec §10.1 maps to one of four UX classes — full-screen gate, inline banner, contextual hint, silent. Matrix below in Cross-cutting.
**Alternatives:** all full-screen gates; all banners; one modal queue.
**Rationale:** the severity of the case matches the intrusiveness of the UX. Permission denials block everything (gates); degraded capability runs with a banner; recoverable issues get contextual hints; system-level edges (clock skew, tab close) stay silent.

### 10. Service worker — `@vite-pwa/sveltekit`, minimum-viable precache

**Decision:** `@vite-pwa/sveltekit` with `registerType: 'prompt'`. Precache the app shell (JS / CSS / HTML / icons) via the generated build manifest. Runtime CacheFirst the TF speech-commands model. No sample files — timbres are algorithmic.
**Alternatives:** hand-rolled SW; a different plugin.
**Rationale:** established SvelteKit-aware defaults. A2HS prompt and update-ready banner are end-of-C1 polish — implemented if time allows, slipped to C1.5 if not. Neither blocks MVP install.

### 11. "Both" replay — simultaneous overlay

**Decision:** "Both" plays user audio and target note overlaid starting at `ctx.currentTime` simultaneously (two `BufferSourceNode`s in one `AudioContext`).
**Alternatives:** sequential (target, then user); sub-mode picker inside "Both".
**Rationale:** matches the pitch-trace visual, which shows both lines overlaid during graded state — playback is coherent with the visual. Direct pitch comparison (flat/sharp) is immediately audible.

---

## Code organization

### Routing map

```
/                                   station dashboard — exercise picker card(s)
/onboarding                         first-run flow (4 steps, gated by settings.onboarded)
/settings                           settings — toggles, session length, reset
/scale-degree                       exercise dashboard — mastery, heatmap, start CTA
/scale-degree/sessions/[id]         session page; branches active vs summary on session.ended_at
```

### Three-layer reuse model

```
Layer 1  @ear-training/core            pure logic (existing)
         @ear-training/web-platform    browser infra (existing + new recorder)
         @ear-training/ui-tokens       design tokens (existing)

Layer 2  $lib/shell/                   nav, settings modal, stores, theming

Layer 3  $lib/exercises/<slug>/        exercise-internal, public via index.ts only
         $lib/exercises/index.ts       registry — re-exports manifests for the picker

--- app public boundary ---
routes/<slug>/+page.svelte            imports only from $lib/exercises/<slug>
```

### Exercise registry

```ts
// $lib/exercises/index.ts
import * as scaleDegree from './scale-degree';
export const exercises = [scaleDegree] as const;
export type ExerciseModule = typeof exercises[number];
```

Station picker reads `exercises.map(e => e.manifest)` to render cards. Adding exercise #2: one line here + one folder + one route directory.

---

## Round lifecycle and audio subsystem

### Session controller — one per route mount

```ts
// $lib/exercises/scale-degree/internal/session-controller.svelte.ts
export class ScaleDegreeSessionController {
  state = $state<RoundState>(initialRoundState());
  session = $state<Session | null>(null);
  currentItem = $state<Item | null>(null);

  #audioCtx: AudioContext;       // native, shared by pitch + recorder
  #playHandle?: PlayRoundHandle;
  #pitchHandle?: PitchDetectorHandle;
  #kwsHandle?: KeywordSpotterHandle;
  #recorderHandle?: RecorderHandle;
  #captureEndTimer?: number;

  constructor(deps: ExerciseDeps) { ... }
  async startRound(): Promise<void>
  cancelRound(): void
  dispose(): void

  #dispatch(event: RoundEvent) {
    this.state = roundReducer(this.state, event);
    this.#onStateChange();   // observes listening → triggers CAPTURE_COMPLETE
  }
}
```

Created in the session route's `onMount`; `dispose()` called in `onDestroy`. No long-lived singletons.

### Event sources

```
playRound handle          → CADENCE_STARTED · TARGET_STARTED · PLAYBACK_DONE
pitch detector frames     → PITCH_FRAME
keyword spotter frames    → DIGIT_HEARD
controller capture-watch  → CAPTURE_COMPLETE   ← new (Option B)
user cancel button        → USER_CANCELED
```

All events translated via the existing `round-adapters` module (C0), which stamps wall-clock `at_ms` at arrival.

### Option B — `listening → graded`

Two new modules in `packages/core`:

```ts
// packages/core/src/round/events.ts  — add
type CaptureCompleteEvent = {
  type: 'CAPTURE_COMPLETE';
  grade: ListeningGrade;    // full bundle, see below
  at_ms: number;
};

// packages/core/src/round/grade-listening.ts  — new, pure
export interface ListeningGrade {
  outcome: AttemptOutcome;        // existing {pitch, label, pass, at}
  pitchGrade: PitchGrade;         // existing {pitchOk, sungBest, cents_off}
  spokenDigit: Degree | null;     // best-confidence digit from DIGIT_HEARD frames
  spokenConfidence: number;       // 0..1
}

export function gradeListeningState(
  state: RoundState & { kind: 'listening' },
  item: Item,
  thresholds: GradingThresholds,
): ListeningGrade
```

Reducer extension: `listening + CAPTURE_COMPLETE → graded{grade}`. The graded state carries the full bundle so the feedback panel can render cents, sung-hz, and the spoken digit without another query. When the attempt is persisted, `Attempt.graded = grade.outcome` and the detail fields are mapped into `Attempt.sung` / `Attempt.spoken`.

The session controller watches `state.kind === 'listening'` and fires `CAPTURE_COMPLETE` on any of:

1. Capture window elapsed (~5s since `PLAYBACK_DONE`)
2. Both pitch and label satisfy thresholds (auto-advance on hit when `settings.auto_advance_on_hit === true`)
3. User pressed "next" (soft end)

### Audio subsystem fan-out

```
Session start (route mount)
  ├── requestMicStream()                 → MediaStream (one per session)
  ├── new AudioContext() (native)        → for pitch + recorder worklets
  ├── startPitchDetector({ ctx, stream })
  ├── startKeywordSpotter({ stream })    ← TF lib uses its own internal context
  └── startAudioRecorder({ ctx, stream }) ← new

Playback (per round)
  └── playRound(...)                     ← uses Tone-wrapped AudioContext

Session end (route unmount)
  └── dispose all handles; close contexts
```

Two `AudioContext`s exist by design (C0 decision). UI never mixes them.

### Reactive visuals

- **Pitch trace** — SVG polyline bound to `controller.state.frames` via `$derived`. Target band = cyan dashed rect spanning ±50¢ around the target degree.
- **Chord blocks** — each block's `active` flag = `audioContext.currentTime ∈ [chordStart, chordEnd]` where `chordStart = cadenceStartAtAcTime + chord.startTimeSec`.
- **"Now" indicator** — one `requestAnimationFrame` loop per session reading `audioContext.currentTime`.

No polling for state updates — all driven by reducer events. One rAF per session just for the cursor position.

---

## UI composition

### Component tree

```
apps/ear-training-station/src/
├── routes/
│   ├── +layout.svelte              <AppShell>
│   ├── +page.svelte                <StationDashboard />
│   ├── onboarding/+page.svelte     <OnboardingFlow />
│   ├── settings/+page.svelte       <SettingsPage />
│   └── scale-degree/
│       ├── +page.svelte            renders <DashboardView /> from the exercise
│       └── sessions/[id]/
│           ├── +page.ts            load()  →  { session, item }
│           └── +page.svelte        renders <SessionView /> from the exercise
└── lib/
    ├── shell/
    │   ├── AppShell.svelte         header, outlet, settings gear, streak chip
    │   ├── StreakChip.svelte
    │   ├── StationDashboard.svelte exercise picker grid
    │   ├── SettingsPage.svelte
    │   ├── OnboardingFlow.svelte   4-step stepper
    │   ├── MicDeniedGate.svelte
    │   ├── DegradationBanner.svelte
    │   └── ShellToast.svelte
    └── exercises/scale-degree/internal/
        ├── DashboardView.svelte    mastery bars, heatmap, Leitner boxes, Start CTA
        ├── DashboardWidget.svelte  compact card for station picker
        ├── SessionView.svelte      branches active vs summary on session.ended_at
        ├── ActiveRound.svelte      split-stage: ChordBlocks + TargetDisplay + PitchTrace
        ├── ChordBlocks.svelte
        ├── PitchTrace.svelte       SVG polyline + target band + now indicator
        ├── FeedbackPanel.svelte    ✓/✗ badges, cents, explanation, tooltip
        ├── ReplayBar.svelte        segmented toggle, play/pause, progress, speed
        ├── PitchNullHint.svelte    contextual hint for case 3
        ├── SummaryView.svelte
        └── session-controller.svelte.ts
```

### Session route branches on `session.ended_at`

```svelte
<script>
  let { data } = $props();
  const controller = new ScaleDegreeSessionController({ session: data.session, ...deps });
  $effect(() => () => controller.dispose());    // unmount cleanup
</script>

{#if data.session.ended_at == null}
  <ActiveRound {controller} />
  {#if controller.state.kind === 'graded'}
    <FeedbackPanel grade={controller.state.grade} />
    <ReplayBar
      userBuffer={controller.capturedAudio}
      targetBuffer={controller.targetAudio}
    />
  {/if}
{:else}
  <SummaryView session={data.session} />
{/if}
```

### Pitch trace — SVG derived from state

```svelte
<script>
  const points = $derived(
    controller.state.frames
      .filter(f => f.hz != null)
      .map(f => `${timeToX(f.at_ms)},${degreeToY(f.degreeMapping)}`)
      .join(' ')
  );
</script>

<svg>
  <rect class="target-band" ... />       <!-- cyan dashed, ±50¢ around target -->
  <polyline class="sung" {points} />      <!-- amber -->
  <circle class="now-indicator" ... />    <!-- position driven by rAF -->
</svg>
```

### Replay bar

```ts
interface ReplayBarProps {
  userBuffer: AudioBuffer;            // from AudioBufferRecorder
  targetBuffer: AudioBuffer;          // synthesized from target NoteEvent
  mode: 'you' | 'target' | 'both';
  speed: 1 | 0.5;
}
// mode === 'both'  → two BufferSourceNodes, both start at ctx.currentTime (simultaneous)
// Progress indicator driven by rAF against ctx.currentTime
```

### Dashboard data flow

```ts
// $lib/shell/stores.ts  — reactive readables over IndexedDB
export const itemsByExercise    = readable<Map<Slug, Item[]>>(...);
export const sessionsByExercise = readable<Map<Slug, Session[]>>(...);
export const settings           = readable<Settings>(...);

// Each dashboard composes these via $derived:
//   StationDashboard     — currentStreak across all exercises
//   DashboardView        — masteryByDegree, masteryByKey, leitnerCounts (per-exercise)
//   DashboardWidget      — quick-glance summary for the picker card
```

---

## Cross-cutting concerns

### Service worker

```ts
// vite.config.ts
SvelteKitPWA({
  registerType: 'prompt',
  strategies: 'generateSW',
  manifest: {
    name: 'Ear Training Station',
    short_name: 'EarTraining',
    theme_color: '#0a0a0a',
    background_color: '#0a0a0a',
    display: 'standalone',
    icons: [/* 192 + 512 */],
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,svg,woff2}'],
    runtimeCaching: [{
      urlPattern: /speech-commands.*\.(json|bin)/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'kws-model',
        expiration: { maxAgeSeconds: 31536000 },
      },
    }],
  },
})
```

In C1: precache app shell + icons + manifest; runtime-cache the KWS model. No sample-file precache — timbres are algorithmic (Tone synths). Deferred: A2HS prompt after 2nd session (spec §9.1) and update-ready banner — implemented only if time allows at end of C1.

### Error / permission UX matrix

| # | Case | UX class | Component |
|---|------|----------|-----------|
| 1 | Mic denied | Full-screen gate | `MicDeniedGate.svelte` rendered in place of session route content; per-browser instructions; retry button |
| 2 | KWS model load fail | Inline banner | `DegradationBanner.svelte` in `AppShell`, store-controlled; "Voice recognition unavailable. Pitch is still graded." Dismissible per-session |
| 3 | ≥3 consecutive pitch-null frames | Contextual hint | `PitchNullHint.svelte` inside `FeedbackPanel`; "We're not hearing anything — check mic input?" Dismissible |
| 4 | Item pool exhausted mid-session | Silent + one-time toast | Scheduler auto-accelerates unlock; `ShellToast` fires once: "New items unlocked." |
| 5 | Tab closed mid-round | Silent | Refresh-abandon per decision 5; summary renders from persisted attempts |
| 6 | Clock skew | Silent | SRS math tolerates small drift |
| 7 | Offline | Silent | Default expected path; no banner |
| 8 | AudioContext suspended | Contextual prompt | Start CTA doubles as the user-gesture resume; mid-session "tap to resume audio" prompt if it somehow suspends |

### Onboarding — 4 steps, gated by `settings.onboarded`

1. **Welcome** — Headline: "Ear training that uses your voice". One-line pitch. Continue button.
2. **Mic permission** — "We grade your singing. Audio never leaves this device." Grant button → `requestMicStream()`. On deny: in-step explainer with per-browser retry instructions.
3. **Concept intro** — silent visual (not audio narration). Cadence plays via `playRound(cadence only)`. Labels flash over chord blocks ("this is I", "this is V"). Static text: "scale degrees 1–7 are the notes of this key." Continue button.
4. **First round — warmup** — real round. Item: `{ key: 'C', degree: 5 }`; round params: `register: 'comfortable'`, default timbre. Same `SessionView` component. On completion, set `settings.onboarded = true`, navigate to `/scale-degree`.

Layout-level redirect: `+layout.ts` checks `settings.onboarded`; if false and current path ≠ `/onboarding`, `throw redirect(302, '/onboarding')`.

Silent-visual intro (not audio narration) chosen deliberately — smaller bundle, no TTS dependency, the cadence itself carries the audio content. Step 4's warmup is a real round that feeds the scheduler.

### Settings page (`/settings`)

Fields, backed by the existing `SettingsRepo`:

- `function_tooltip` (toggle) — show degree-function explanations on feedback
- `auto_advance_on_hit` (toggle, default ON) — skip replay panel on pass
- `session_length` (20 / 30 / 45) — rounds per session
- `reduced_motion` (`auto` / `on` / `off`) — respects `prefers-reduced-motion` when `auto`

Actions:

- **Reset progress** — button opens `<ResetConfirmModal />`. Confirmation wipes `items` + `sessions` + `attempts`. Settings preserved.

### Persistence boundary

Persisted (IndexedDB via existing repos):

| Store | Content |
|-------|---------|
| `items` | `id`, `key`, `degree`, `box` (Leitner), `accuracy`, `recent`, `attempts`, `consecutive_passes`, `last_seen_at`, `due_at`, `created_at` — existing shape. (`register` is a round-level parameter picked by `pickRegister`, not an item field.) |
| `sessions` | `id`, `started_at`, `ended_at`, `target_items`, `completed_items`, `pitch_pass_count`, `label_pass_count`, `focus_item_id` — existing shape; no new fields in C1 (exercise identity is encoded in the URL path until exercise #2 lands) |
| `attempts` | `id`, `item_id`, `session_id`, `at`, `target` (hz, degree), `sung` (hz, cents_off, confidence), `spoken` (digit, confidence), `graded` (AttemptOutcome), `timbre`, `register` — existing shape; no new fields in C1 |
| `settings` | existing fields (`function_tooltip`, `auto_advance_on_hit`, `session_length`, `reduced_motion`) **plus a new `onboarded: boolean` flag added in C1**. SettingsRepo's existing schema-evolution merge (per PR #30) picks up the default for existing users automatically. |

Ephemeral (in-memory only, intentionally):

- User audio buffer from `AudioBufferRecorder` — lives on the session controller
- Pitch frame array (`RoundState.frames`) — lives on the session controller

Consequence: replay ("You" or "Both") works only while the user stays on the session page. After refresh, the summary renders without replay; `ReplayBar` is disabled with a subtle note. Persisting replay data is a v2 feature.

Active-session abandonment on reload (decision 5):

```ts
// routes/scale-degree/sessions/[id]/+page.ts
export async function load({ params }) {
  const session = await sessionsRepo.get(params.id);
  if (!session) throw error(404, 'session not found');

  if (session.ended_at == null) {
    // Refresh-abandon: compute roll-up from persisted attempts,
    // then call the existing SessionsRepo.complete(id, CompleteSessionInput).
    const attempts = await attemptsRepo.findBySession(session.id);
    await sessionsRepo.complete(session.id, rollUpAbandon(attempts));
    return { session: { ...session, ...rollUpAbandon(attempts) } };
  }
  return { session };
}
```

User lands on the summary view; persisted attempts drive the stats. The exact `rollUpAbandon` function is a C1 task-level detail (pure function over `Attempt[]`).

---

## Delivery

### Testing strategy

Already green (kept passing):

- 221 Vitest unit tests across core + web-platform + ui-tokens
- 1 Playwright smoke test (`audio-harness.smoke.spec.ts`)

New in C1:

- **Vitest + `@testing-library/svelte` component tests:**
  - Exercise-internal: `PitchTrace`, `ChordBlocks`, `FeedbackPanel`, `ReplayBar`, `SessionView`, `DashboardView`, `SummaryView`
  - Shell: `AppShell`, `OnboardingFlow`, `SettingsPage`, `MicDeniedGate`, `DegradationBanner`
  - Focus: reducer-state-driven rendering, prop contracts, user interactions
- **New pure-function unit tests in core:**
  - `round/grade-listening.test.ts` — `gradeListeningState()` covering hit / miss / partial combinations
  - `round/state-capture-complete.test.ts` — the `listening + CAPTURE_COMPLETE → graded` transition
- **New web-platform tests:**
  - `mic/recorder.test.ts` — `AudioBufferRecorder` handle under jsdom with a mocked worklet
- **Playwright e2e (add to the existing 4-shard workflow):**
  - `full-session.spec.ts` — onboarding → warmup → dashboard → second session happy path
  - `abandon-on-refresh.spec.ts` — start session, reload, land on summary with abandoned state
  - `mic-denied.spec.ts` — deny permission, see gate, re-grant, proceed
  - `onboarding-redirect.spec.ts` — fresh profile → any path redirects to `/onboarding`
- **Axe a11y smoke** — one Playwright spec runs axe-core against each rendered screen; fails on any `serious` or `critical` violation.

Not in C1: visual regression, load / perf benchmarks.

### Ship criteria

All 10 must be green before C1 is done.

| # | Criterion | Maps to |
|---|-----------|---------|
| 1 | Installable PWA: manifest + icons present; offline-capable after first load | spec §4.3.1 |
| 2 | First-run: `/onboarding` gates until 4 steps complete; warmup is degree 5 in C major | spec §9.1 |
| 3 | Round loop: cadence → target → sing + say → graded (Option B) → feedback → next | spec §5.1 + §9.2 |
| 4 | Feedback panel: ✓/✗ per source, cents, plain-English line, tooltip (toggleable), replay with 3 modes + simultaneous "Both" | spec §9.3 + decisions 7/11 |
| 5 | Dashboards: station picker at `/`; exercise dashboard at `/scale-degree` with mastery bars, heatmap, Leitner boxes, streak chip | spec §9.4 + §4.3.3 |
| 6 | Session summary: 3 big stats + degree movement + tomorrow's focus | spec §9.5 |
| 7 | Settings persist: toggles + session length + reset across reloads | spec §9.6 + §4.3.4 |
| 8 | Error / permission UX: cases 1–4 of the matrix have working components | spec §10.1 |
| 9 | All existing 221 unit tests green; new component + e2e tests green; axe a11y smoke green | — |
| 10 | Production build clean (no harness in output); bundle-size CI reports under a documented budget | — |

Spec §4.3 criterion 5 ("two-week pilot reports improvement") is the v1.0 success criterion, not a C1 gate — it cannot be satisfied until the product ships.

### Scope carve-out

| Item | Where |
|------|-------|
| A2HS install prompt after 2nd session | End-of-C1 polish; slip if needed |
| Update-ready banner for new SW version | End-of-C1 polish; slip if needed |
| Full visual regression / screenshot tests | Out of C1 |
| Persisted replay (user audio + frames stored with Attempt) | v2 |
| Function-tooltip copy table | In C1 — minimal initial content; expand later |
| Cadence tempo jitter (±10%, spec §5.3) | End-of-C1 polish; not load-bearing |
| Register-expansion gating per progress | In C1 (small scheduler tweak) |
| Mobile-polished responsive layout | "Works" in C1; "polished" in C1.5 |
| Exercise #2 | Out of C1; architecture is ready |
| Full WCAG-AA audit and remediation | Out of C1; axe smoke is the C1 floor |

### Pre-existing deferred items (tracked through C1, non-blocking)

- **PR #6** — YIN noise-test LCG brittleness. Test hygiene; defer.
- **PR #10** — `MicPermissionState.unavailable` dead variant. Decide when settings UI consumes the state (return on API-missing, or remove).
- **PR #47** — Mergify `autoqueue: true` missing. Small CI polish.
- **PR #33** — Playwright trace / screenshot artifacts. Fold into C1's e2e work.

---

## Open questions / follow-ups

- **Function-tooltip copy table.** Spec §7 and §11.3 flag per-(degree, key-quality) explanation strings as a design question. C1 ships minimal starter content ("The 5 resolves down to 1…") and the table grows over time.
- **Register-expansion gating math.** Spec §5.3 says register widens with progress; `unlock.ts` has no gate today. Simplest shape is a 2- or 3-tier threshold driven by Leitner-box distribution — decide during the relevant C1 task.
- **Mobile heatmap reflow.** 6×2 grid on desktop; spec §7.1 calls for vertical stack at ≤600px. Exact reflow (single-column 12 rows? 3×4?) is a visual call during C1.
- **PR #10 `MicPermissionState.unavailable`.** The settings UI will touch this enum. Decide at that point, not now.

---

## Decision log

| # | Question | Answer | Driver |
|---|----------|--------|--------|
| 1 | User-audio recording: MVP or v2? | MVP | Spec §9.3 locks three-source replay |
| 2 | Routing: hand-rolled SPA or SvelteKit? | SvelteKit | Multi-app shape; URL is identity |
| 3 | Service worker scope in C1 | Min-viable in C1; prompt / update-ready polish slips | Spec §4.3.1 requires installable PWA |
| 4 | Station dashboard at `/` | Exercise picker card | Legible multi-app shape from day 1 |
| 5 | Exercise module boundary | A+ (`$lib/exercises/<slug>/` + lint) | Best score against user's four values |
| 6 | Session URL shape | `/scale-degree/sessions/[id]`; refresh abandons | Matches standard multi-app pattern; IDs already in domain |
| 7 | Onboarding & settings placement | Both routes | URL consistency |
| 8 | AudioBufferRecorder approach | AudioWorklet → AudioBuffer | Matches pitch-worklet pattern; enables simultaneous "Both" |
| 9 | Chord-block animation source | Derive client-side from AudioContext | No `playRound` API change; same clock anchors audio and visual |
| 10 | Error / permission UX | Severity-matched matrix | Spec §10.1 language lines up with class ladder |
| 11 | "Both" replay | Simultaneous overlay | Coherent with pitch-trace visual comparison |

The writing-plans output (Plan C1 execution plan in `docs/plans/`) will break these decisions into small, TDD-shaped tasks following the Plan A/B/C0 convention.
