# ear-training-station

Dark-themed PWA for hobbyist instrumentalists who want to play songs by ear. MVP is one focused exercise: hear a cadence, hear a target scale-degree, sing it back and say the digit. See `docs/specs/2026-04-14-ear-training-mvp-design.md` for full spec.

GitHub: https://github.com/julianken/ear-training-station

## Current state

- **Plan A · Foundation + Core Logic** — ✅ executed. Pure-logic kernel: types, SRS, scheduler, IndexedDB repos, orchestrator.
- **Plan B · Audio I/O** — ✅ complete and hardened. All 12 tasks plus 2 cleanup PRs merged autonomously.
- **Plan C0 · Integration Seam** — ✅ complete. 13 PRs merged (PRs #16–#28). Restructured as pnpm monorepo, added round lifecycle reducer, adapters, variability pickers, analytics rollups, design tokens. **Head of `main`:** `0dc5f30` as of 2026-04-15. **Tests:** 221 vitest unit tests + 1 Playwright e2e smoke test, all green. `pnpm run build` produces a clean prod bundle.
- **Plan C1 · UI + Integration** — ⬜ **not yet written.** The spec (`docs/specs/2026-04-14-ear-training-mvp-design.md`) is the source of truth for what and why; Plan C1 needs to be authored before execution. It should cover: Svelte session screen (split-stage chord blocks + scrolling pitch trace), F2 feedback panel with segmented replay, dashboard (mastery bars, key heatmap, Leitner boxes, streak chip), summary screen, service worker for KWS model + sample caching, and wiring the orchestrator (Plan A) to the audio stack (Plan B) behind the round reducer (Plan C0) and real UI.

**Plan C0 run stats:** 13 PRs merged, 4 real bugs caught by julianken-bot reviews — octave-invariant cents_off mismatch (grade-pitch computed against fixed octave-4 target), UTC day boundaries in streak calculation, LOADING-state threshold guard gap in KWS, Degree return type narrowing for digitLabelToNumber. Zero user escalations.

- **julianken-bot review infrastructure** — live at user level, validated end-to-end across 17 review dispatches during the Plan B run:
  - Skill: `~/.claude/skills/reviewing-as-julianken-bot/` (SKILL.md + output-format.md + dispatch-template.md + merge-flow.md + sanitization.md)
  - Subagent: `~/.claude/agents/julianken-bot.md` (opus, fresh-context, loads the skill via frontmatter)
  - Credentials: macOS Keychain, service `julianken-bot@github.com`, accounts `token` / `password` / `totp-secret` / `recovery-codes`
  - Bot is a `write` collaborator on the repo; Classic PAT with `public_repo` + `repo:invite` scopes
  - Known PAT-scope gap: `gh pr view` GraphQL needs `read:org` which the current token lacks. The subagent has worked around it by using REST (`gh api repos/.../pulls/N`). Add `read:org` to the token if you want `gh pr view` to work directly.

`git log --oneline` shows the full progression since Plan B started.

## Monorepo structure

pnpm workspace with four packages:

```
packages/core/          @ear-training/core          — pure TypeScript, no browser APIs
packages/web-platform/  @ear-training/web-platform  — browser infra (Tone, AudioWorklet, speech-commands, IndexedDB)
packages/ui-tokens/     @ear-training/ui-tokens     — design tokens (TS + CSS)
apps/ear-training-station/  ear-training-station     — app shell, Svelte entry point, dev harness, e2e
```

Cross-package imports use package names: `import { Key } from '@ear-training/core/types/music'`. Within a package, `@/` alias points to that package's `src/`.

## Module surface (what Plan C1 will consume)

**Types (Plan A, `@ear-training/core`):**
- `types/music` — `Key`, `Degree`, `PitchClass`, `DEGREES`, `PITCH_CLASSES`, `semitoneOffset`, `keyId`, `itemId`
- `types/domain` — `Item`, `Session`, `Attempt`, `AttemptOutcome`, `Settings`, `Register`, `LeitnerBox`, `Accuracy`
- `repos/interfaces` — `ItemsRepo`, `AttemptsRepo`, `SessionsRepo`, `SettingsRepo` (pure interfaces; implementations in web-platform)

**Pure audio structure (`@ear-training/core`):**
- `audio/note-math` — `midiToHz`, `hzToMidi`, `pitchClassToMidi`, `centsBetween`, `nearestMidi`
- `audio/cadence-structure` — `buildCadence(key): ChordEvent[]`, `CADENCE_DURATION_SECONDS` (`3.2s`)
- `audio/target-structure` — `buildTarget(key, degree, register): NoteEvent`, `TARGET_DURATION_SECONDS` (`1.5s`)
- `pitch/yin` — `detectPitch(buffer, sampleRate): {hz, confidence}`. Pure math.
- `pitch/degree-mapping` — `mapHzToDegree(hz, key): DegreeMapping | null`, `IN_KEY_CENTS` (50)

**Round lifecycle (Plan C0, `@ear-training/core`):**
- `round/events` — `RoundEvent` discriminated union (7 variants, all with `at_ms: number`)
- `round/grade-pitch` — `gradePitch(frames, item, minConfidence): PitchGrade`, `PitchObservation`
- `round/state` — `RoundState` (5 variants), `roundReducer(state, event) → state'`. The `listening → graded` transition is deferred to Plan C1 composition.
- `variability/pickers` — `pickTimbre(rng, history, settings)`, `pickRegister(...)`, `TimbreId`, `VariabilityHistory`, `VariabilitySettings`
- `analytics/rollups` — `masteryByDegree(items)`, `masteryByKey(items)`, `leitnerCounts(items)`, `currentStreak(sessions, now, tzOffsetMs?)`

**Audio playback (`@ear-training/web-platform`):**
- `audio/player` — `ensureAudioContextStarted()`, `playRound({timbreId, cadence, target, gapSec?}): PlayRoundHandle`
- `audio/timbres` — `TIMBRE_IDS`, `getTimbre(id).createSynth()`

**Mic input (`@ear-training/web-platform`):**
- `mic/permission` — `requestMicStream(): Promise<MicStreamHandle>`, `queryMicPermission()`

**Pitch detection (`@ear-training/web-platform`):**
- `pitch/pitch-detector` — `startPitchDetector({audioContext, micStream}): Promise<PitchDetectorHandle>`. **`AudioWorkletNode` requires a native `AudioContext`, not Tone's wrapped `rawContext`.**

**Speech / digit recognition (`@ear-training/web-platform`):**
- `speech/keyword-spotter` — `startKeywordSpotter({probabilityThreshold?, minConfidence?})`. Idempotent cache; **throws on threshold mismatch** (call `stop()` first to change thresholds).
- `speech/digit-label` — `digitLabelToNumber(label: DigitLabel): Degree`
- `speech/kws-loader` — `loadKwsRecognizer()` Promise-memoized

**Round adapters (`@ear-training/web-platform`):**
- `round-adapters/` — `pitchFrameToEvent`, `digitFrameToEvent`, `targetStartedEvent`, `cadenceStartedEvent`, `playbackDoneEvent`, `roundStartedEvent`, `userCanceledEvent`. Injectable `Clock` for tests. These are the ONLY modules that know the two-clock problem exists.

**Design tokens (`@ear-training/ui-tokens`):**
- `tokens` — `colors` object (`bg`, `panel`, `border`, `text`, `muted`, `cyan`, `amber`, `green`, `red`)
- `tokens.css` — matching CSS custom properties (`var(--cyan)`, etc.)

**Dev harness:** `apps/ear-training-station/harness/audio.html` + `src/harness/audio-harness.ts`. Served by Vite dev at `http://localhost:5173/harness/audio.html`. Excluded from production builds.

## Plan C1 integration items (polish deferred from earlier reviews)

Two items remain from Plan B reviews. Address when Plan C1 lands real callers, NOT as proactive cleanup:

1. **PR #6 YIN noise test LCG brittleness** — test-hygiene only, not a runtime concern.
2. **PR #10 `MicPermissionState.unavailable` dead variant** — the union declares `'unavailable'` but `queryMicPermission` never returns it. When Plan C1's settings UI uses the state machine, either remove it or return it on API-missing.

(PR #7 `IN_KEY_CENTS` export was completed in Plan C0 Task 2.)

## Docs to read first

1. `docs/specs/2026-04-14-ear-training-mvp-design.md` — what we're building and why (the source of truth for decisions)
2. `docs/research/2026-04-14-ear-training-research-synthesis.md` — evidence behind the pedagogy
3. `docs/plans/2026-04-14-plan-a-foundation-core-logic.md` — executed plan (reference for conventions + TDD shape)
4. `docs/plans/2026-04-14-plan-b-audio-io.md` — executed plan (reference for conventions). Code on `main` is authoritative where it diverges from plan text.
5. `docs/specs/2026-04-15-plan-c-phase-0-integration-seam-design.md` — Phase C0 design spec (brainstormed + approved)
6. `docs/plans/2026-04-15-plan-c0-integration-seam.md` — Phase C0 execution plan (14 tasks, all executed)
7. `docs/mockups/*.html` — visual design decisions (aesthetic, session screen, feedback state, dashboard, summary) as static HTML mockups
8. **Plan C1 does not exist yet.** Before executing Plan C1 work, author `docs/plans/<today>-plan-c1-ui-integration.md` using the brainstorming skill.

## Non-negotiable design commitments

From the research synthesis + explicit design picks. Do NOT drift from these during implementation:

- **Functional scale-degree hearing**, not isolated interval drills. Every round establishes a tonic via a cadence first.
- **Sing-and-verify.** User sings the target pitch AND says the digit ("five"). Both are graded.
- **Variability by default.** Key, timbre, register, cadence voicing vary across rounds.
- **Interleaving + Leitner SRS** for scheduling. No blocked practice.
- **Honest progress UI** — per-degree mastery bars, per-key heatmap, Leitner box counts, streak chip. No XP, no confetti, no Duolingo moves.
- **Dark audio-app aesthetic.** Background `#0a0a0a`. Cyan `#22d3ee` for target/reference data. Amber `#fbbf24` for user/capture data. Green `#22c55e` and red `#ef4444` for pass/fail.
- **Split-stage session screen** with cadence-visible chord blocks on top + R1 scrolling pitch trace on bottom.
- **Feedback = F2 result panel + segmented-toggle replay** (You / Target / Both).

If a task would drift one of these, stop and ask.

## Dev commands

```bash
pnpm run dev         # Vite dev server on :5173 (app)
pnpm run test        # Vitest workspace — 221 tests across core + web-platform + ui-tokens
pnpm run test:watch  # Vitest watch
pnpm run typecheck   # tsc --noEmit per package (authoritative)
pnpm run build       # production build (clean, no harness leakage)
pnpm run test:e2e    # Playwright smoke test (1 test, ~3s after first run)
```

Dev-only harness URL (not in production builds):
```
http://localhost:5173/harness/audio.html
```
Open it after `pnpm run dev`, click Play Round / Start Pitch Detection / Start Digit Recognizer to sanity-check the full audio stack end-to-end.

## Known gotchas

- **LSP diagnostics lag behind the filesystem.** When a new file or a new import lands, the editor LSP may flag "Cannot find module" OR "declared but never read" for a minute or two — and sometimes the stale state persists with specific parameter-type errors that look convincingly real. **`pnpm run typecheck` is authoritative.** Trust `tsc` and `vitest` over editor squiggles. This pattern showed up dozens of times during Plans B and C0. The correct default is: see a system-reminder diagnostic, run `pnpm run typecheck`, see it exit 0, move on. Don't loop fixing phantoms.
- **Tone.js under jsdom.** Tone touches `AudioContext` at module load. Tone 15.0.4 happens to load cleanly under jsdom without any shim because the factory pattern (`getTimbre(id).createSynth()`) defers `AudioContext` construction. If a future Tone version breaks this, wrap the synth factory in a dynamic import or add a jsdom audio shim — do NOT mock all of Tone.
- **`AudioWorkletNode` rejects Tone's wrapped context.** `Tone.getContext().rawContext` returns a `standardized-audio-context` wrapper instance, which native `new AudioWorkletNode(ctx, ...)` rejects with "parameter 1 is not of type 'BaseAudioContext'". The harness uses a module-cached **native** `AudioContext` (`pitchAudioContext`) for the YIN worklet specifically; `playRound` still uses Tone's context. Plan C UI code must follow the same split: pitch detection → native context (cached, reused), playback → Tone.
- **Harness is NOT in `public/`.** It lives at `apps/ear-training-station/harness/audio.html`, deliberately OUTSIDE of `public/` so Vite's static-copy step doesn't land it in `dist/`. Vite's dev server still serves it at `/harness/audio.html` automatically. Keep the harness dev-only.
- **tfjs version pinning is load-bearing.** `@tensorflow-models/speech-commands@0.5.4` peer-depends on tfjs-core v3. Do NOT install `@tensorflow/tfjs@4.x` alongside it. Current working config in `packages/web-platform/package.json`: `@tensorflow/tfjs-backend-webgl@3.21.0` + `@tensorflow/tfjs-backend-cpu@3.21.0` + side-effect imports in `packages/web-platform/src/speech/kws-loader.ts`.
- **Audio-render thread is allocation-sensitive.** Per-call `new Float32Array(...)` inside the worklet's `process()` method creates GC pressure that can glitch audio. The YIN worklet preallocates a `scratch` buffer on the class and reuses it. Apply the same discipline to any future audio-thread code.
- **pnpm workspace `@/` alias.** Each package's vitest config and tsconfig set `@/` to point to THAT PACKAGE's `src/`. Within core, `@/types/music` resolves to `packages/core/src/types/music.ts`. Within web-platform, `@/store/db` resolves to `packages/web-platform/src/store/db.ts`. Cross-package imports use the full package name: `@ear-training/core/types/music`.
- **pnpm audit.** CVEs in dev deps got cleared in Plan A. Expect `0 vulnerabilities` on a fresh install; if new ones appear, don't mass-upgrade — audit first.

## Execution convention

- **Subagent-driven development with Sonnet agents** for implementation. Implementer subagent per task, full TDD loop. Plan A ran this way end-to-end and caught multiple real bugs (starter-curriculum interleaving deadlock, attempt-id collision, double-startSession data loss, CVE patches) via the review step.
- **PR reviews via the `julianken-bot` subagent** — dispatched via the user-level `reviewing-as-julianken-bot` skill (auto-loaded every session). The reviewer runs as `@julianken-bot` (a separate GitHub identity), reads the PR independently via `gh pr view` / `gh pr diff` (**never** injected with a "what changed" narrative — that's anchoring bias), posts inline `file:line` comments via the REST API batch endpoint, and follows a 12-rule anti-slop rubric including mandatory R8 second-pass find. Full rules, safety gates, and autonomous merge decision rule live in the skill's `merge-flow.md`.
- **Autonomous merge after APPROVE** — the dispatcher applies the decision rule from the skill without asking: BLOCKER/IMPORTANT loop, substantive SUGGESTIONs loop, polish SUGGESTIONs merge as-is. The dispatcher NEVER asks "should I merge?" — the skill defines the rule, the dispatcher applies it. Only `BLOCKED` / `NEEDS_CONTEXT` escalate to the user.
- For implementers: fresh subagents carry zero session context, so the dispatcher provides complete task text and scene-setting. Don't tell the subagent to read the plan file — paste the relevant section.
- For reviewers: dispatcher prompt is **minimal context only** (PR# + repo + optional focus constraints + optional out-of-band signals). No narrative, no pre-conclusions, no "I changed X". The reviewer reads the PR itself.
- Reviews are load-bearing, not ceremony. PR #2's review found a real gitignore bug via R8 mandatory-find that the first pass missed.

## Testing philosophy

- **Pure modules** (`packages/core` — types, SRS, scheduler, round reducer, grade-pitch, variability, analytics): full Vitest unit coverage. Test the math with synthetic input. Orchestrator unit tests use in-memory stub repos (`packages/core/tests/helpers/stub-repos.ts`).
- **Persistence** (IndexedDB): Vitest + `fake-indexeddb` (auto-wired in `packages/web-platform/tests/helpers/test-setup.ts`). Orchestrator integration tests with real repos live in `packages/web-platform/tests/session/`.
- **Round adapters**: Vitest with injectable `Clock` stub. No real `Date.now()` in tests.
- **Audio playback, mic input, ML inference**: NOT unit-tested. Covered by the dev harness and a single Playwright smoke test. Do not chase 100% unit coverage of Web Audio — it's a mocking trap.
- **Design tokens**: Agreement test verifies `tokens.ts` ↔ `tokens.css` have identical values.

## When in doubt

The spec (`docs/specs/2026-04-14-ear-training-mvp-design.md`) is the source of truth for *what* and *why*. The plans are the source of truth for *how*. If an implementation decision isn't covered by either, stop and ask — don't guess.
