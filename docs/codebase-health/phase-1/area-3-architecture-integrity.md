# Investigation: Architecture Integrity & Type Safety

## Summary

The core/platform/app layering is genuinely well-executed — packages/core has zero browser dependencies, no cross-layer import violations exist, and the discriminated union types are textbook clean. The issues are concentrated at the glue points where C0's pure logic was composed into C1's UI. Two significant problems: `createOrchestrator` in core is dead code in production (the session controller is a parallel re-implementation), and `selectNextItem()` was built and tested but never called. A few unsafe type assertions exist but are narrow and justified. The architecture can support future evolution cleanly — but the production path is shorter-circuiting the designed abstractions.

## Key Findings

### Finding 1: Session orchestrator is dead in production
- **Evidence:** `packages/core/src/session/orchestrator.ts` — zero imports from any file under `apps/` or `src/`. Only referenced by test files. The session controller at `src/lib/exercises/scale-degree/internal/session-controller.svelte.ts` is a parallel implementation of the same bookkeeping (Leitner box tracking, round index, pitch/label counters).
- **Confidence:** High
- **Implication:** ~200 lines of production-dead orchestrator code plus ~3 test files provide false confidence. The duplicated Leitner state computation between orchestrator (`orchestrator.ts:85-95`) and controller (`session-controller.svelte.ts:115-121`) is byte-for-byte equivalent today but will drift.

### Finding 2: `selectNextItem` was built but bypassed (also in Area 1)
- **Evidence:** `packages/core/src/scheduler/selection.ts` — `selectNextItem()` implements full interleaving constraints. Zero app imports. Controller uses naive `dueNow.find(i => i.id !== justPlayed)`.
- **Confidence:** High
- **Implication:** The spec's "no blocked practice" guarantee is not enforced. This is simultaneously an architecture violation (right abstraction exists but bypassed) and a spec violation.

### Finding 3: `settingsRepo` is dead dep on SessionController
- **Evidence:** `session-controller.svelte.ts:26` — field declared but never read. `minPitchConfidence`, `minDigitConfidence`, and auto-advance are hardcoded.
- **Confidence:** High
- **Implication:** Dependency injection is used but the injected dep has no effect. The controller's interface promises runtime configurability it doesn't deliver.

### Finding 4: `Date.now()` side effect inside pure core
- **Evidence:** `packages/core/src/round/grade-listening.ts:38` — `at: Date.now()`. Core is supposed to be side-effect-free; this is overwritten by the reducer at `state.ts:81` so observed behavior is correct, but it's a code smell that will mislead future contributors.
- **Confidence:** High (observable fact)
- **Implication:** Not a bug today; a maintenance trap for future changes to `gradeListeningState()`.

### Finding 5: `MicPermissionState.'unavailable'` declared, never returned
- **Evidence:** `packages/web-platform/src/mic/permission.ts:1-6` — union includes `'unavailable'` but `queryMicPermission()` never returns it. Pre-C1 known issue (documented in CLAUDE.md), still unresolved.
- **Confidence:** High
- **Implication:** Any consumer of `MicPermissionState` that handles `'unavailable'` is dead code.

### Finding 6: Frame buffer carries across playing_target → listening state
- **Evidence:** `packages/core/src/round/state.ts:43-60` — `PITCH_FRAME` events collected during `playing_target` (while Tone.js plays the target pitch through speakers) are forwarded into `listening` state via `frames: state.frames`. `gradePitch` then selects highest-confidence frame across all of them.
- **Confidence:** Medium — echo cancellation should suppress bleed-through in practice
- **Implication:** Target pitch played through speakers could influence grading if EC is weak. Design note: clear frames on PLAYBACK_DONE transition, or filter to `frames.filter(f => f.at_ms >= targetEndedAt)`.

## Clean Architecture (confirmed)

- `packages/core` has zero browser dependencies (package.json declares no deps)
- No cross-layer import violations anywhere in the monorepo
- Zero `any` in `packages/core/src` (3 narrow `as Degree` casts in curriculum.ts are legitimate)
- `RoundEvent` and `RoundState` discriminated unions are clean with no escape hatches
- `gradeListeningState()` and `gradePitch()` are pure with correct narrowed-type signatures
- Analytics rollups (`masteryByDegree`, `masteryByKey`, `leitnerCounts`) are actually wired to DashboardView

## Surprises

- `buildAttemptPersistence()` at `persistence.ts:69-71` already recomputes `nextBox` internally — but both the orchestrator and the session controller also recompute it externally, creating triple computation

## Unknowns & Gaps

- Whether the orchestrator-vs-controller divergence has already produced semantic differences in Leitner box progression logic
- Whether removing `createOrchestrator` would cause test-only breakage or also require touching types

## Raw Evidence

- Files read: `packages/core/src/session/orchestrator.ts`, `packages/core/src/scheduler/selection.ts`, `packages/core/src/round/grade-listening.ts`, `packages/core/src/round/state.ts`, `packages/web-platform/src/mic/permission.ts`, `session-controller.svelte.ts`, `packages/core/package.json`
- Grep: `selectNextItem` → zero app-level hits; `createOrchestrator` → test files only
