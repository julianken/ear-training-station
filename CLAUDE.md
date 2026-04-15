# ear-training-station

Dark-themed PWA for hobbyist instrumentalists who want to play songs by ear. MVP is one focused exercise: hear a cadence, hear a target scale-degree, sing it back and say the digit. See `docs/specs/2026-04-14-ear-training-mvp-design.md` for full spec.

GitHub: https://github.com/julianken/ear-training-station

## Current state

- **Plan A · Foundation + Core Logic** — ✅ executed. Pure-logic kernel: types, SRS, scheduler, IndexedDB repos, orchestrator.
- **Plan B · Audio I/O** — ✅ complete and hardened. All 12 tasks plus 2 cleanup PRs merged autonomously via the subagent-driven flow. **Head of `main`:** `6903750` as of 2026-04-15. **Tests:** 124 vitest unit tests + 1 Playwright e2e smoke test, all green. `npm run build` produces a clean prod bundle with no harness leakage.
- **Plan C · UI + Integration** — ⬜ **not yet written.** The spec (`docs/specs/2026-04-14-ear-training-mvp-design.md`) is the source of truth for what and why; Plan C needs to be authored before execution. It should cover: Svelte session screen (split-stage chord blocks + scrolling pitch trace), F2 feedback panel with segmented replay, dashboard (mastery bars, key heatmap, Leitner boxes, streak chip), summary screen, service worker for KWS model + sample caching, and wiring the orchestrator (Plan A) to the audio stack (Plan B) behind real UI.

**Plan B run stats (for context):** 14 PRs merged, 9 real bugs caught by julianken-bot review loops — 3 foundation-level (narrow-register contract violation invisible on C-major-only test; YIN ring-buffer seam + startup-window contamination; wrong tfjs version pair shipped by the plan itself creating a disjoint-backend runtime BLOCKER), 6 cheap-local-fix. Zero user escalations across the autonomous run once authorized. See `memory/project_plan_b_state.md` in the user-level memory for the full ledger.

- **julianken-bot review infrastructure** — live at user level, validated end-to-end across 17 review dispatches during the Plan B run:
  - Skill: `~/.claude/skills/reviewing-as-julianken-bot/` (SKILL.md + output-format.md + dispatch-template.md + merge-flow.md + sanitization.md)
  - Subagent: `~/.claude/agents/julianken-bot.md` (opus, fresh-context, loads the skill via frontmatter)
  - Credentials: macOS Keychain, service `julianken-bot@github.com`, accounts `token` / `password` / `totp-secret` / `recovery-codes`
  - Bot is a `write` collaborator on the repo; Classic PAT with `public_repo` + `repo:invite` scopes
  - Known PAT-scope gap: `gh pr view` GraphQL needs `read:org` which the current token lacks. The subagent has worked around it by using REST (`gh api repos/.../pulls/N`). Add `read:org` to the token if you want `gh pr view` to work directly.

`git log --oneline` shows the full progression since Plan B started.

## Plan B module surface (what Plan C will consume)

These are the exported entry points Plan C wires into its UI + session state machine. All are on `main` and unit-tested where tested-able.

**Types (Plan A):**
- `@/types/music` — `Key`, `Degree` (`1..7`), `PitchClass` (`'C'..'B'`), `DEGREES`, `PITCH_CLASSES`, `semitoneOffset(degree, quality)`
- `@/types/domain` — `Register` (`'narrow' | 'comfortable' | 'wide'`)

**Pure audio structure:**
- `@/audio/note-math` — `midiToHz`, `hzToMidi`, `pitchClassToMidi(pc, octave)`, `centsBetween(sung, target)`, `nearestMidi(hz)`
- `@/audio/cadence-structure` — `buildCadence(key): ChordEvent[]`, `CADENCE_DURATION_SECONDS` (`3.2s`). I-IV-V-I (major) or i-iv-V-i with major V (minor). Voicings in octave 4.
- `@/audio/target-structure` — `buildTarget(key, degree, register): NoteEvent`, `TARGET_DURATION_SECONDS` (`1.5s`). Narrow/comfortable both enforce "at or above tonic" via the octave-shift guard; wide uses deterministic octave variation.
- `@/audio/timbres` — `TIMBRE_IDS` (`'piano' | 'epiano' | 'guitar' | 'pad'`), `getTimbre(id).createSynth()` returns a fresh Tone.js `PolySynth` per round (caller owns disposal)

**Audio playback (integration, harness-tested):**
- `@/audio/player` — `ensureAudioContextStarted()` (must be called from a user-gesture handler), `playRound({timbreId, cadence, target, gapSec?}): PlayRoundHandle`. Handle has `done: Promise<void>`, `targetStartAtAcTime: Promise<number>`, `cancel()`. Synth is auto-disposed after `done` resolves.

**Mic input:**
- `@/mic/permission` — `requestMicStream(): Promise<MicStreamHandle>` returns `{stream, stop}`. Constraints: `echoCancellation: true`, `noiseSuppression: true`, `autoGainControl: false`, `channelCount: 1`. `queryMicPermission(): Promise<MicPermissionState>` falls back to `'unknown'` on browsers without the Permissions API.

**Pitch detection (pure + integration):**
- `@/pitch/yin` — `detectPitch(buffer: Float32Array, sampleRate): {hz, confidence}`. Pure math, unit-tested. Returns `hz=0, confidence=0` on silence/noise.
- `@/pitch/pitch-detector` — `startPitchDetector({audioContext, micStream}): Promise<PitchDetectorHandle>` with `subscribe((frame) => ...)` + `stop()`. The worklet (`yin-worklet.ts`) runs YIN on a 2048-sample ring buffer, unwrapped chronologically per call, gated on `samplesWritten >= buf.length` to avoid startup contamination, throttled to every 8th render quantum (~47 Hz frame rate). **`AudioWorkletNode` requires a native `AudioContext`, not Tone's wrapped `rawContext`** — see the harness for the cached-native-context pattern.
- `@/pitch/degree-mapping` — `mapHzToDegree(hz, key): DegreeMapping | null`. Octave-invariant. `inKey = |cents| < 50`. Returns `null` for non-positive hz.

**Speech / digit recognition:**
- `@/speech/keyword-spotter` — `startKeywordSpotter({probabilityThreshold?, minConfidence?}): Promise<KeywordSpotterHandle>` with `subscribe/stop`. **Idempotent at the library boundary:** concurrent callers share a single listener via module-level handle cache; rapid `stop()`→`start()` sequences are serialized via an in-flight `activeStop` Promise so `speech-commands` doesn't throw "Cannot start streaming again." Vocab: `'one' | 'two' | 'three' | 'four' | 'five' | 'six' | 'seven'`. `null` digit emitted when none of the target labels crosses `minConfidence`.
- `@/speech/kws-loader` — `loadKwsRecognizer()` Promise-memoized (concurrent callers share the in-flight load, auto-nulls on rejection). WebGL + CPU backends both registered via side-effect imports; tfjs-core picks WebGL by priority, falls back to CPU automatically in headless/WebGL-unavailable environments.

**Dev harness:** `harness/audio.html` (repo root, NOT in `public/`) + `src/harness/audio-harness.ts`. Served by Vite dev at `http://localhost:5173/harness/audio.html`. Deliberately excluded from `npm run build` output to keep speech-commands out of the prod graph. Features Play Round, Start Pitch Detection, Start Digit Recognizer with re-entrancy guards and visible error display.

## Plan C integration items (polish deferred from Plan B reviews)

Three items were classified as polish during the Plan B run and left to surface naturally when Plan C lands real callers. Address each when the relevant layer gets wired in, NOT as proactive cleanup:

1. **PR #6 YIN noise test LCG brittleness** — the noise-rejection test currently relies on a single LCG seed. Tighten to pin `hz === 0` explicitly if a future refactor of YIN's confidence formula requires it. Not a runtime concern; test-hygiene only.
2. **PR #7 degree-mapping `IN_KEY_CENTS` export** — when the Plan C feedback UI starts color-coding "on the diatonic degree" vs "off-key," export `IN_KEY_CENTS = 50` from `@/pitch/degree-mapping` so the UI shares the threshold instead of duplicating the constant. Also worth adding a docstring about the deterministic tie-break for equidistant pitches (current: first-degree wins in iteration order).
3. **PR #10 `MicPermissionState.unavailable` dead variant** — the union declares `'unavailable'` but `queryMicPermission` never returns it. When Plan C's settings UI starts using the state machine, either remove the dead variant or have `queryMicPermission` return it on API-missing instead of `'unknown'`.

None are latent runtime bugs. None block Plan C execution.

## Docs to read first

1. `docs/specs/2026-04-14-ear-training-mvp-design.md` — what we're building and why (the source of truth for decisions)
2. `docs/research/2026-04-14-ear-training-research-synthesis.md` — evidence behind the pedagogy
3. `docs/plans/2026-04-14-plan-a-foundation-core-logic.md` — executed plan (reference for conventions + TDD shape)
4. `docs/plans/2026-04-14-plan-b-audio-io.md` — executed plan (reference for conventions + module API expectations). **Note:** a few implementer-made corrections diverge from the plan text — the code on `main` is authoritative, not the plan. Divergences: PR #5 target-structure uses pitch-class-then-octave arithmetic with a below-tonic octave-shift guard (plan had a bug); PR #9 worklet uses chronological ring-buffer unwrap + startup gate + preallocated scratch + every-8-quantum throttle (plan had the naive linear-memory version); PR #11 tfjs deps are v3 backends with explicit side-effect imports, NOT `@tensorflow/tfjs@4.22.0` as the plan said.
5. `docs/mockups/*.html` — visual design decisions (aesthetic, session screen, feedback state, dashboard, summary) as static HTML mockups
6. **Plan C does not exist yet.** Before executing Plan C work, author `docs/plans/<today>-plan-c-ui-integration.md` using the brainstorming skill + Plan A/B as structural references.

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
npm run dev         # Vite dev server on :5173
npm run test        # Vitest — 124 tests on main
npm run test:watch  # Vitest watch
npm run typecheck   # tsc --noEmit (authoritative)
npm run build       # production build (clean, no harness leakage)
npm run test:e2e    # Playwright smoke test (1 test, ~3s after first run)
```

Dev-only harness URL (not in production builds):
```
http://localhost:5173/harness/audio.html
```
Open it after `npm run dev`, click Play Round / Start Pitch Detection / Start Digit Recognizer to sanity-check the full Plan B audio stack end-to-end.

## Known gotchas

- **LSP diagnostics lag behind the filesystem.** When a new file or a new `@/...` import lands, the editor LSP may flag "Cannot find module" OR "declared but never read" for a minute or two — and sometimes the stale state persists with specific parameter-type errors that look convincingly real. **`npm run typecheck` is authoritative.** Trust `tsc` and `vitest` over editor squiggles. This pattern showed up dozens of times during Plan B. The correct default is: see a system-reminder diagnostic on a file the implementer just created, run `npm run typecheck` on the branch, see it exit 0, move on. Don't loop fixing phantoms.
- **Tone.js under jsdom.** Tone touches `AudioContext` at module load. Tone 15.0.4 happens to load cleanly under jsdom without any shim because the factory pattern (`getTimbre(id).createSynth()`) defers `AudioContext` construction. If a future Tone version breaks this, wrap the synth factory in a dynamic import or add a jsdom audio shim — do NOT mock all of Tone.
- **`AudioWorkletNode` rejects Tone's wrapped context.** `Tone.getContext().rawContext` returns a `standardized-audio-context` wrapper instance, which native `new AudioWorkletNode(ctx, ...)` rejects with "parameter 1 is not of type 'BaseAudioContext'". The harness uses a module-cached **native** `AudioContext` (`pitchAudioContext`) for the YIN worklet specifically; `playRound` still uses Tone's context. Plan C UI code must follow the same split: pitch detection → native context (cached, reused), playback → Tone.
- **Harness is NOT in `public/`.** It lives at `harness/audio.html` (repo root, sibling to `src/`), deliberately OUTSIDE of `public/` so Vite's static-copy step doesn't land it in `dist/`. Vite's dev server still serves it at `/harness/audio.html` automatically. If Plan C moves it or tries to include it in the prod bundle, speech-commands gets dragged in, its `util.promisify` import fails the production build. Keep the harness dev-only.
- **tfjs version pinning is load-bearing.** `@tensorflow-models/speech-commands@0.5.4` peer-depends on tfjs-core v3. Do NOT install `@tensorflow/tfjs@4.x` alongside it — they install as disjoint parallel graphs and speech-commands sees no registered backend at runtime. Current working config: `@tensorflow/tfjs-backend-webgl@3.21.0` + `@tensorflow/tfjs-backend-cpu@3.21.0` + side-effect imports in `src/speech/kws-loader.ts`.
- **Audio-render thread is allocation-sensitive.** Per-call `new Float32Array(...)` inside the worklet's `process()` method creates GC pressure that can glitch audio. The YIN worklet preallocates a `scratch` buffer on the class and reuses it. Apply the same discipline to any future audio-thread code.
- **npm audit.** CVEs in dev deps got cleared in Plan A (bumped vite 5→6 + svelte-plugin 4→5 + vitest 2→3). Expect `0 vulnerabilities` on a fresh install; if new ones appear, don't mass-upgrade — audit first.

## Execution convention

- **Subagent-driven development with Sonnet agents** for implementation. Implementer subagent per task, full TDD loop. Plan A ran this way end-to-end and caught multiple real bugs (starter-curriculum interleaving deadlock, attempt-id collision, double-startSession data loss, CVE patches) via the review step.
- **PR reviews via the `julianken-bot` subagent** — dispatched via the user-level `reviewing-as-julianken-bot` skill (auto-loaded every session). The reviewer runs as `@julianken-bot` (a separate GitHub identity), reads the PR independently via `gh pr view` / `gh pr diff` (**never** injected with a "what changed" narrative — that's anchoring bias), posts inline `file:line` comments via the REST API batch endpoint, and follows a 12-rule anti-slop rubric including mandatory R8 second-pass find. Full rules, safety gates, and autonomous merge decision rule live in the skill's `merge-flow.md`.
- **Autonomous merge after APPROVE** — the dispatcher applies the decision rule from the skill without asking: BLOCKER/IMPORTANT loop, substantive SUGGESTIONs loop, polish SUGGESTIONs merge as-is. The dispatcher NEVER asks "should I merge?" — the skill defines the rule, the dispatcher applies it. Only `BLOCKED` / `NEEDS_CONTEXT` escalate to the user.
- For implementers: fresh subagents carry zero session context, so the dispatcher provides complete task text and scene-setting. Don't tell the subagent to read the plan file — paste the relevant section.
- For reviewers: dispatcher prompt is **minimal context only** (PR# + repo + optional focus constraints + optional out-of-band signals). No narrative, no pre-conclusions, no "I changed X". The reviewer reads the PR itself.
- Reviews are load-bearing, not ceremony. PR #2's review found a real gitignore bug via R8 mandatory-find that the first pass missed.

## Testing philosophy

- **Pure modules** (types, SRS math, scheduler, note math, YIN, degree mapping): full Vitest unit coverage. Test the math with synthetic input.
- **Persistence** (IndexedDB): Vitest + `fake-indexeddb` (auto-wired in `tests/helpers/test-setup.ts`).
- **Audio playback, mic input, ML inference**: NOT unit-tested. Covered by the dev harness (Plan B task 11) and a single Playwright smoke test (Plan B task 12). Do not chase 100% unit coverage of Web Audio — it's a mocking trap.

## When in doubt

The spec (`docs/specs/2026-04-14-ear-training-mvp-design.md`) is the source of truth for *what* and *why*. The plans are the source of truth for *how*. If an implementation decision isn't covered by either, stop and ask — don't guess.
