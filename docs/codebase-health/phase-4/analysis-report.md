# Ear-Training-Station Codebase Health: Final Analysis Report

**Analysis period:** 2026-04-18
**Commit reference:** `04d3665` (tip of `main` at synthesis time)
**Funnel:** Phase 1 (5 area investigations) -> Phase 2 (5 iterator deep dives) -> Phase 3 (3 independent syntheses) -> Phase 4 (this unified report)

---

## A) Executive Summary

The ear-training-station is a **structurally correct shell around a functionally broken core loop**. The pure-logic kernel (music theory, YIN pitch detection, SRS, round reducer, variability, analytics) is high quality and thoroughly tested; 340 unit tests and green CI tell the truth about those layers. But three critical runtime failures sit on the happy path of every real user session - an `AudioContext` leak that silently corrupts SRS training data after round 7, a `void`-discarded hydration promise that leaves private-mode Safari users on an empty app, and a `startRound()` call whose errors vanish into unhandled rejections. A fourth critical defect is structural: the interleaving scheduler that is the central "no blocked practice" non-negotiable was built, tested, and never wired. The app should not be opened to real users until the first three are fixed. Interleaving, replay, and focus-item rendering are explicit product decisions the owner must make before C2 begins. Six agentic failure archetypes - systemic, not incidental - are the root-cause shape of nearly every defect found; converting them into process guardrails (chiefly `no-floating-promises` ESLint enforcement and a composition-layer test phase) is the single highest-leverage move before C2. The 103-PR agentic run was largely successful, not broken; it needs guardrails, not reinvention.

## B) Analysis Question & Scope

**Question:** What is the current health, correctness, and production-readiness of the ear-training-station PWA, built via agentic development (Claude Code subagents, ~103 PRs), now that Plans A+B+C0+C1 are complete?

**Scope:**
- All five packages: `@ear-training/core`, `@ear-training/web-platform`, `@ear-training/ui-tokens`, the SvelteKit app root, and the `apps/ear-training-station` subtree.
- All 103 merged PRs and the full julianken-bot review history.
- The spec (`docs/specs/2026-04-14-ear-training-mvp-design.md`), all plan documents (Plan A, B, C0, C1 phases 1-4), the mockups, and CLAUDE.md.
- Excludes: production telemetry (none exists), real-user behavioral data (none), Plan C2 (not yet authored).

**Quality criteria (weights):** Evidence 25% / Completeness 20% / Accuracy 20% / Actionability 15% / Nuance 10% / Clarity 10%

**Audience:** The project owner about to begin C2 planning. Needs to know: what to fix before starting C2, what to include in C2 scope, and how to structure the agentic development process to avoid repeating Phase 1-3 failures.

## C) Table of Contents

- A) Executive Summary
- B) Analysis Question & Scope
- C) Table of Contents
- D) Methodology
- E) Key Findings (13 findings, ordered by confidence x impact)
- F) Analysis & Implications (patterns, risks, strengths, gaps)
- G) Confidence Assessment (strongest, moderate, weakest, blind spots)
- H) Recommendations (high-level, with priority and trade-offs)
- I) Open Questions
- J) Appendix: Evidence Index

## D) Methodology

**The 5->5->3->1 analysis funnel:**

1. **Phase 1 - 5 parallel area investigations** (spec compliance, test quality, architecture integrity, silent failures, performance/PWA). Each area was examined independently against the codebase on `main` at `04d3665`.
2. **Phase 2 - 5 iterator deep dives** derived from Phase 1 patterns:
   - Iterator 1: Deferred-vs-forgotten classification
   - Iterator 2: Production-dead-code inventory
   - Iterator 3: Silent-failure blast radius
   - Iterator 4: Agentic failure archetypes
   - Iterator 5: Test strategy for the two highest-risk gaps
3. **Phase 3 - 3 independent syntheses** from the same Phase 1+2 evidence:
   - Synthesis 1 (thematic): 4 structural themes
   - Synthesis 2 (risk/opportunity): 2-axis severity x likelihood register
   - Synthesis 3 (gaps/implications): what the evidence does and does not establish
4. **Phase 4 - This unified report** reconciles all three syntheses, resolves tensions, and produces the single C2-input artifact.

**Ground-truth anchoring.** Every finding in this report cites file path and line number. All claims were verified against the `main` branch at commit `04d3665`. Arithmetic claims (AudioContext throttle math, DST epoch calculation, pitch-trace pixel clamp) were re-computed, not copied.

**Structured disagreement.** The three Phase 3 syntheses were produced by independent analysts who did not read each other's outputs. Tensions between them are resolved explicitly in Section F, not hidden behind consensus language.

**Limits.** No manual QA was performed. No browser compatibility matrix. No performance profiling. No production telemetry exists. All claims about real-world impact are inferential from static evidence.

## E) Key Findings

Findings are ordered by confidence x impact. The top four are pre-launch blockers; the next three are structural defects; the next three are UI/UX defects; the remainder are process and documentation findings.

---

### Finding 1 - AudioContext leak silently corrupts SRS training data from round 7 onward

**Confidence: CERTAIN / Impact: CRITICAL**

**Evidence:**
- `apps/ear-training-station/src/routes/+page.svelte:50` passes `getAudioContext: () => new AudioContext()` to the controller.
- `apps/ear-training-station/src/lib/session/session-controller.svelte.ts:199` creates a fresh `AudioContext` on every `startRound()` call.
- No `ctx.close()` call exists anywhere in the codebase (grep-verified; zero matches).
- Chrome enforces a hard throttle at approximately 6 concurrent `AudioContext` instances per tab. Past the cap, `new AudioContext()` returns a context already in the `suspended` state; `AudioWorkletNode` attached to a suspended context receives no frames.
- The default session length (per spec section 7) is 10 rounds, and the target is 15-30 rounds.

**Behavior under failure:** From round 7 onward, pitch detection is silent. The 5-second capture timeout fires. `gradeListeningState` runs with empty frames. The round is graded `pitch_fail`. The attempt is persisted as a genuine failure. The item is demoted in its Leitner box. The user's SRS curriculum is corrupted.

There is no degradation flag, no toast, no `consecutiveNullCount` increment (because a suspended context emits zero frames rather than low-confidence frames, bypassing the KWS-style degradation signal).

**Impact:** Every complete user session past round 6 writes poisoned failure data into IndexedDB. The poisoning is not recoverable by a future release - it lives in the `attempts` table and compounds across sessions.

**Related findings:** Finding 5 (startRound error swallow, same entry point). Finding 11 (agentic failure archetype 3: dead/unreachable code - here, the single-context abstraction `ensureAudioContextStarted()` exists in the platform package and is bypassed).

---

### Finding 2 - `void hydrateShellStores()` silently leaves users on an empty app

**Confidence: CERTAIN / Impact: CRITICAL**

**Evidence:**
- `apps/ear-training-station/src/routes/+layout.svelte:10` discards the hydration promise with the `void` keyword.
- `fake-indexeddb` in the test suite succeeds; real browsers' IDB can fail on Safari private mode (frequent), quota-exceeded, and schema-mismatch after dev version-bumps.
- No `+error.svelte` exists in the routes tree (grep-verified).

**Behavior under failure:** Any IDB rejection leaves all three shell stores at empty defaults. The dashboard shows no mastery, no sessions, no streak. The scheduler finds no items due ("No items are due"). The user cannot train. No error is surfaced.

**Impact:** High-frequency production trigger, especially on Safari iOS. User has no path to recovery short of clearing site data via devtools (which they cannot find).

**Related findings:** Finding 5 (same error-surface gap), Finding 9 (missing `+error.svelte`).

---

### Finding 3 - `startRound()` errors vanish into unhandled rejections

**Confidence: CERTAIN / Impact: CRITICAL**

**Evidence:**
- `apps/ear-training-station/src/lib/components/ActiveRound.svelte:45-47` calls `await controller.startRound()` with no try/catch.
- `startRound()` can throw from at minimum five internal sites: mic permission denial, AudioWorklet module load failure, AudioRecorder setup failure, IDB failure during `listAll`, and dynamic-import failure on the KWS loader (network-dependent).

**Behavior under failure:** Every throw propagates to the Svelte event handler as an unhandled rejection. The UI does not change. The "Start round" button stays visible. The controller stays in `idle` state. The user has no feedback and no recovery short of a full page reload.

**Impact:** Likelihood is particularly high on first-use events - mic permission denial is a first-run event for every new user on iOS Safari and Chrome on HTTP origins. The first-click failure rate in the field will be non-trivial.

**Related findings:** Finding 1 (AudioContext creation site is inside `startRound`), Finding 9 (no error store to route to).

---

### Finding 4 - Interleaving scheduler bypassed; "no blocked practice" non-negotiable violated

**Confidence: CERTAIN / Impact: CRITICAL (spec) / LATENT (behavior)**

**Evidence:**
- `packages/core/src/scheduler/selection.ts` (`selectNextItem()`, 82 LOC, 9 unit tests, all green).
- Zero app-level imports - grep of `apps/**/*.ts` and `packages/web-platform/**/*.ts` for `selectNextItem` returns no hits.
- The live selection logic at `apps/ear-training-station/src/lib/session/session-controller.svelte.ts:305-307` is `dueNow.find(i => i.id !== justPlayed) ?? dueNow[0]` - earliest-due by IndexedDB insertion order.
- `createOrchestrator()` in `packages/core/src/session/orchestrator.ts` (166 LOC, 590 LOC total with tests) is the only caller `selectNextItem` ever had. Orchestrator has zero app-level imports.
- `CLAUDE.md` "Non-negotiable design commitments": "**Interleaving + Leitner SRS** for scheduling. No blocked practice."

**Behavior delta (five properties the live path skips):** same-degree back-to-back blocking; same-key-consecutive-streak blocking; weakness-weighted sampling; mastered-item warmup (30%); soft-constraint fallback ordering.

**Impact under current data:** masked. The single-key starter curriculum (C major, three items) means few inter-key constraints bind. Today's user sees roughly the same sequences they would from a wired scheduler. The gap becomes runtime-visible the moment a second key is added.

**Wire-in estimate:** ~2 hours (Phase 2, iterator-2). Self-contained, low-risk.

**Related findings:** Finding 11 (agentic archetype 3: dead code shipped as a feature), Finding 10 (Settings ignored - same shape), Finding 12 (SummaryView focus chip - same shape).

---

### Finding 5 - Settings UI silently ignored; thresholds and auto-advance hardcoded

**Confidence: CERTAIN / Impact: HIGH (credibility)**

**Evidence:**
- `settingsRepo` is injected into `SessionController` but never read during a session (Phase 1, area-1, Finding 5).
- `minPitchConfidence` and `minDigitConfidence` are hardcoded at `0.5` in the controller wiring.
- The `auto_advance_on_hit` setting is effectively ignored by the round advancement path.
- A Settings UI exists (`flow-12-settings.png` in repo root, a full screen with controls).

**Behavior:** User changes values in Settings. UI persists them to IDB. Next session reads nothing from that persisted state. Nothing changes.

**Impact:** Credibility cost of shipping fake settings is non-linear. One reviewer observation ("the settings don't do anything") outweighs the value of the feature. Severity is high even though no data is corrupted.

**Related findings:** Finding 4 (same shape: wire built, never read), Finding 12 (same shape).

---

### Finding 6 - KWS stop `.catch(() => {})` re-regression after PR #76 fix

**Confidence: HIGH / Impact: MEDIUM-HIGH**

**Evidence:**
- PR #76 reviewed and corrected a `.catch(() => {})` pattern on the KWS stop path.
- The identical pattern was re-introduced at `apps/ear-training-station/src/lib/session/session-controller.svelte.ts:345-346` in a later PR with no review escalation (`#stopAudioHandles`).
- No ESLint rule flags this pattern today (`@typescript-eslint/no-floating-promises` is not in the config).

**Behavior under failure:** KWS stop error is swallowed. The idempotent `startKeywordSpotter` cache means the next call with the same thresholds returns the cached instance in whatever stuck state it reached. Digit recognition can hang for the remainder of the session.

**Impact:** The cache is process-lifetime, not session-lifetime, so a page reload resets it. Likelihood is "possible" per-session, not "certain." But the diagnostic signal - a reviewed-and-fixed bug returning to the identical callsite in a later PR - is the most important *process* finding in the whole report: it is empirical proof that agentic implementers do not retain memory of prior corrections without structural guardrails.

**Related findings:** Finding 11 (agentic archetype 4: async rejection swallowed; this is the proof-case).

---

### Finding 7 - Pitch trace clock stubs: scrolling visualization structurally broken

**Confidence: CERTAIN / Impact: MEDIUM (visual only)**

**Evidence:**
- `apps/ear-training-station/src/lib/components/ActiveRound.svelte:17-22` stubs `windowStartMs = 0` and `getNowMs = () => 0` with a comment stating "Task 6 wires real values."
- Task 6 in `docs/plans/2026-04-17-plan-c1-3-scale-degree-exercise.md` defines the full `startRound()` implementation but contains no step updating `ActiveRound.svelte` to replace the stubs.
- Pitch frames arrive with `at_ms = Date.now()` (~1.7e12 ms). `PitchTrace.timeToX` computes `(1.7e12 - 0) / 5000 = 3.4e8`, which exceeds canvas width (480px) by many orders of magnitude. All frames clamp to the rightmost pixel.
- The y-axis is also a stub: `hzToVisualDegree` always returns `targetDegree` regardless of actual pitch.

**Behavior:** The split-stage scrolling pitch trace, explicitly named in spec section 7 and section 9.2, does not scroll. It shows nothing meaningful.

**Fix:** One-line change in the controller to capture and expose the resolved `targetStartAtAcTime` value that `PlayRoundHandle` already provides, plus a prop pass-through to `PitchTrace`. ~1-2 hours.

**Impact:** Does not corrupt data. Does not block training. Does break the core visual feedback loop the spec describes. Every user sees a broken trace.

**Related findings:** Finding 11 (agentic archetype 2: clock domain confusion; this and Finding 10 are the live residues).

---

### Finding 8 - Target and Both replay modes permanently disabled

**Confidence: CERTAIN / Impact: MEDIUM (explicit deferral, not a bug)**

**Evidence:**
- Spec section 9.3 requires a segmented-toggle replay with "You / Target / Both" modes.
- `apps/ear-training-station/src/lib/components/ReplayBar.svelte` implements all three modes structurally.
- `targetAudio` is initialized `null` at `session-controller.svelte.ts:67`, reset to `null` in `next()`, and assigned nowhere (grep-verified).
- Plan text (`docs/plans/2026-04-17-plan-c1-3-scale-degree-exercise.md`, Task 8) explicitly deferred this: "a follow-up task in C1.4 can render the target buffer (synthesize via Tone's OfflineAudioContext) if priority warrants."
- Plan C1.4 contains no such task.

**Tension to resolve:** Synthesis 1 treated this as a known deferral. Synthesis 2 treated it as a pre-launch blocker. **Resolution:** this is an explicit MVP scope decision. The plan author saw the option and declined. It is NOT a pre-launch blocker. It IS the highest-priority C2 feature, because the spec-advertised UI lies today.

**Fix:** OfflineAudioContext synthesis of target buffer + wiring to `targetAudio`. ~1 day. Legitimately belongs in a dedicated task.

**Impact:** Users see two disabled segmented-toggle buttons. Feedback is less useful than designed. No data corruption.

**Related findings:** Finding 7 (both are C1 deferrals to a future task that never appeared).

---

### Finding 9 - No `+error.svelte`; uncaught `load()` rejections produce the default SvelteKit error page

**Confidence: CERTAIN / Impact: MEDIUM**

**Evidence:**
- Grep of `apps/ear-training-station/src/routes/**` for `+error.svelte` returns zero files.
- Any `load()` rejection (including IDB-backed loads) produces the default unstyled error page.

**Impact:** Primarily a UX polish gap rather than a correctness issue - but it compounds Finding 2's silent-failure experience. When hydration succeeds but a page's own `load()` fails, the user lands on an unstyled error screen.

**Related findings:** Finding 2, Finding 3.

---

### Finding 10 - DST streak miscalculation via render-time `getTimezoneOffset()`

**Confidence: HIGH / Impact: LOW-MEDIUM**

**Evidence:**
- `StreakChip.svelte:7` samples `getTimezoneOffset()` once at render time and passes it uniformly to `currentStreak()`.
- `currentStreak` is correct in isolation (Phase 2 iterator-5 verified at pinned epoch values).
- Spring-forward DST crossing causes a Saturday session to be silently merged into Sunday, under-counting the streak by one day annually (per US DST schedule; fall-back causes the inverse).
- This is an Archetype 6 case: plan-authored defect faithfully propagated.

**Impact:** Affects the "honest progress" non-negotiable. The streak is the most visible progress indicator. Silent under-count once per year feels like "streak broke for no reason."

**Fix shape:** Schema add `tz_offset_ms?: number` to `Session`, extend `currentStreak` signature, update `StreakChip` caller, add pinned-epoch tests. ~30 LOC implementation + ~80 LOC tests. No IDB version bump required (optional field).

**Open question (Gap 2 from Synthesis 3):** Is the wrong streak value *persisted* (requiring a migration), or purely a render-time miscalculation from correct data (fixable by any future release)?

**Related findings:** Finding 11 (agentic archetype 6).

---

### Finding 11 - Six systemic agentic failure archetypes, two still live

**Confidence: HIGH / Impact: HIGH (process)**

The codebase's root-cause shape is not "bugs" but "recurring archetypes the agentic process produces." Phase 2, iterator-4 classified six:

| # | Archetype | Still live on main? | Example | Prevented by |
|---|---|---|---|---|
| 1 | CI environment-parity gaps | No (CI green) | Historical bundle-size ANSI noise | Mandatory `NO_COLOR=1 pnpm run build && pnpm run lint && pnpm run typecheck` pre-PR |
| 2 | Clock domain confusion | Partially | Finding 7 (pitch trace), Finding 10 (DST) | JSDoc unit annotations on all time-parameter functions |
| 3 | Dead/unreachable code shipped as features | Yes (908 LOC) | Finding 4 (scheduler), Finding 5 (Settings), Finding 8 (Target replay), Finding 12 (focus item) | Pre-PR store-writer audit: zero-writer modules ship the writer first |
| 4 | Async rejection silently swallowed | Yes (2+ instances) | Finding 6 (KWS stop re-regression), Finding 3 (startRound), Finding 2 (hydration) | `@typescript-eslint/no-floating-promises: error` |
| 5 | Plan text diverging from API shapes | No active bugs | Latent in e2e helper | Pre-dispatch plan-identifier validation against source |
| 6 | Plan-authored defects faithfully propagated | Partially | Finding 10 (DST) | Plan-controlled IMPORTANT findings require plan-amendment commit before re-review |

The defining diagnostic: **the `.catch(() => {})` re-regression after PR #76** (Finding 6). The implementer agent that reintroduced it had no memory of the prior correction, no structural signal that the pattern was wrong, and produced semantically-valid lint-clean TypeScript. The review bot catches archetypes when submitted but cannot prevent re-introduction.

**Highest-leverage single guardrail: `no-floating-promises`.** It would have caught Findings 2, 3, 6, plus at least two archetype-4 instances that Phase 2 did not enumerate exhaustively.

**Caveat:** guardrails have cost. `no-floating-promises` in particular may produce noise in Svelte's event-handler patterns where `void` is idiomatic. A scoped enable with targeted overrides is the right implementation.

**Related findings:** all other findings - this is the shape.

---

### Finding 12 - SummaryView `focus_item_id` path: production-dead, user impact unknown

**Confidence: HIGH (structural) / CONFIRMED (runtime unknown) / Impact: UNKNOWN**

**Evidence:**
- `pickFocusItem()` in `packages/core/src/session/orchestrator.ts` computes the focus item.
- Zero app-level callers (grep-verified).
- `SummaryView.svelte` references `focus_item_id`. The field is passed through from the session's pre-round value and never recomputed.

**Unknown:** whether the "practice this next" chip renders null, an empty state, a stale item, or silently disappears. No manual QA has reached the Summary screen after a full session.

**Recommended probe:** 10-minute DOM inspection after a real 10-round session.

**Fix decisions (must be explicit):** either re-home `pickFocusItem` as a ~30-LOC helper and call from `complete()`, or strike the chip from the summary mockup.

**Related findings:** Finding 4, Finding 5 (same shape: wire built, never consumed).

---

### Finding 13 - CLAUDE.md is two weeks stale and the staleness is load-bearing

**Confidence: CERTAIN / Impact: HIGH (prospective, for C2 agents)**

**Evidence:**
- CLAUDE.md states "Plan C1 / UI + Integration - not yet written." C1 is complete (13+ PRs merged through PR #101).
- CLAUDE.md states "221 vitest unit tests." The actual count is 340.
- CLAUDE.md hardcodes "Head of `main`: `18c6e1d` as of 2026-04-16." Actual head is `04d3665`, 100+ commits later.
- CLAUDE.md's "Monorepo structure" enumeration is incomplete relative to the 5th workspace entry that accreted during C1.
- The Plan C1 docs (`docs/plans/2026-04-17-plan-c1-*.md`, all four phases) are not referenced in the "Docs to read first" section.

**Impact:** New implementer agents read CLAUDE.md as primary orientation. A fresh-context Sonnet agent dispatched today would believe the app has no UI, no feedback panel, no dashboard - and would plausibly attempt to re-author these components from the spec. The risk is prospective, not yet realized.

**Fix:** 5-10 minutes of direct editing. Mark C1 complete, update head commit, add C1 plan docs to the read-first list, update the test count.

**Related findings:** Finding 11 (no systemic reconciliation between plan state and code state).

---

## F) Analysis & Implications

### Pattern: The composition seam is where every risk lives

Plan A's pure core is clean. Plan B's audio adapters are hardened. Plan C0's round lifecycle and adapters are well-tested. The defects congregate at the seam where Plan C1 wired the session controller - the moment where repos meet UI and audio meets visualization.

This is the characteristic failure shape of agentic development: each task produces correct artifacts in isolation, and CI verifies their isolation. The composition step - the moment where the user clicks "Start round" and hears feedback about their singing - was never made an explicit test target. No single unit test covers `startRound() -> pitch capture -> digit capture -> CAPTURE_COMPLETE -> grade -> persist -> next` in one path. The 30-round simulated-session test (`simulated-session.test.ts`) exercises the dead orchestrator, not the live controller.

The implication for C2: **the first C2 phase must be composition-layer tests**, not feature work. Without that phase, C2 features will be built on the same untested seam that produced Findings 1-6.

### Pattern: Data integrity primacy - Finding 1 is in a class by itself

Of all 13 findings, only Finding 1 (AudioContext leak) corrupts durable persistent state. A broken button (Finding 3) is recoverable. An empty dashboard (Finding 2) is recoverable. A wrong streak value (Finding 10) is fixable in a future release. But poisoned SRS `attempts` rows live in the user's IndexedDB forever unless a migration marks them corrupt.

This asymmetry should dominate prioritization. Fix order: Finding 1 first, everything else second.

**Related unknown (Blind Spot 1):** have any friend-testers already accumulated poisoned data? A probe - query one real device's `attempts` rows for `outcome === 'pitch_fail'` with `cents_off > 300` clustered at round index >= 7 - would confirm or deny. If confirmed, a migration (mark rows as `corrupt: true`, recompute mastery) must ship with the fix.

### Pattern: Strengths are real and under-credited

The analysis could read as entirely critical. It is not. The codebase has genuine strengths:

- **Pure-logic kernel is high quality.** YIN pitch detection, degree mapping, SRS math, round reducer, variability, analytics - all mathematically correct, thoroughly tested, pure, and reusable.
- **Architecture discipline is strong.** The core/web-platform/ui-tokens/app separation is clean. `@/` aliases are scoped per-package. Cross-package imports use package names. `AudioWorkletNode` vs Tone context split is documented and respected.
- **Test infrastructure is solid where applied.** 340 green unit tests, `fake-indexeddb` auto-wired, design token agreement test, axe-core a11y smoke, service worker + bundle budgets enforced in CI.
- **Review infrastructure works.** julianken-bot caught 4 real bugs during Plan C0 that would have hurt users. The rubric is explicit and has receipts.
- **Agentic process produced working software.** 103 PRs, zero user escalations, end-to-end happy path functions.

The correct framing: the approach succeeded and has known systemic failure modes. Those modes need guardrails, not replacement.

### Tension 1: "Target"/"Both" replay - pre-launch blocker or deferral?

Synthesis 1 positioned this as a known deferral. Synthesis 2 positioned it as a pre-launch blocker on credibility grounds (the UI promises features that don't work).

**Resolution:** It is an explicit MVP scope decision made by the plan author in C1.3 Task 8. The plan gave itself the option to enable Target/Both in C1.4 and declined. It is NOT a pre-launch blocker. It IS the highest-priority C2 feature.

The credibility concern (Synthesis 2) is real but lower-severity than Finding 5 (Settings UI silently ignored). Two disabled segmented-toggle buttons read as "not implemented yet"; a full Settings screen that does nothing reads as "broken." Wire the Settings UI first; ship replay next.

### Tension 2: Ordering the C2 pre-work

Synthesis 1 led with "Wire `selectNextItem` as a C2 task." Synthesis 2 led with "Fix AudioContext as a blocker." Synthesis 3 led with "Close the three Production Blockers as a pre-C2 correctness PR, separate from C2."

**Resolution (Synthesis 3 calibration accepted):** the three Production Blockers (Findings 1, 2, 3) are defect fixes, not features. They belong in a pre-C2 correctness pass, NOT as C2 Tasks 1-3. If they slide into C2 as tasks, they will inevitably be interleaved with feature work and one will be deferred.

**Recommended ordering:**
1. Pre-C2 correctness pass: Findings 1, 2, 3. Hotfix branch or single PR.
2. Pre-C2 hygiene: Finding 13 (CLAUDE.md reconciliation), zero-cost guardrails (pre-PR CI-parity command, pre-dispatch plan-grep validation).
3. C2 Task 0: composition test phase (integration tests, DST regression, $state->IDB serialization assertion, retargeted 30-round simulated session).
4. C2 Task 1: Interleaving scheduler wire-in (Finding 4). This precedes any multi-key feature work.
5. C2 Task 2: Settings read path (Finding 5). Trivial; ships credibility.
6. C2 Task 3: `no-floating-promises` ESLint enablement + existing-violation audit. This is the migration, not a one-line change.
7. C2 feature work (Target/Both replay, additional keys, etc.) - now built on a tested seam.

### Strength: The dead code has differentiated dispositions

Synthesis 3 correctly flagged that "delete all 908 LOC of dead code" is an anti-conclusion. The modules have different dispositions:

- **`selectNextItem`** (82 LOC + tests): wire in. Spec commitment. ~2 hours.
- **`createOrchestrator`** (166 LOC, 590 LOC total with tests): delete the wrapper, preserve `pickFocusItem()` as a standalone helper OR strike the focus chip from the summary. Explicit product decision.
- **`round-adapters`**: delete. Testability value already replicated by `Clock` injection elsewhere. Low urgency; fold into whatever PR next touches that area.
- **`MicPermissionState.'unavailable'`**: delete the dead variant.
- **`simulated-session.test.ts`**: retarget to the live controller (becomes the Finding-1-regression guard). Uniquely valuable; do not delete.

### Blind spots that matter for C2

Five gaps the analysis could not close:

1. **No manual QA.** No one has installed the app on real hardware and completed 10+ rounds. A 2-hour manual QA pass would flip 3-4 findings from theoretical to known-real or theoretical-to-not-applicable.
2. **`focus_item_id` rendering unknown** (Finding 12). 10-minute DOM probe.
3. **DST streak: display vs persisted** (Finding 10). Determines whether a migration is needed.
4. **Offline end-to-end flow** (PR #97 service worker). Cold install + offline + resume has not been verified.
5. **Real-user SRS corruption probe** (from Finding 1). Any friend-testers' IDB may already contain poisoned rows.

Running these five probes in a half-day would materially sharpen the C2 plan.

## G) Confidence Assessment

### Strongest claims (evidence is arithmetic or direct code grep)

- **Finding 1 (AudioContext leak):** Chrome's 6-context throttle is documented behavior. The controller's per-round `new AudioContext()` is a grep-verified code path. The arithmetic is determinate.
- **Finding 2, 3 (silent error paths):** `void` and missing try/catch are verified by direct code read.
- **Finding 4 (scheduler bypass):** Zero imports is a definitive grep result.
- **Finding 7 (pitch trace pixel clamp):** The arithmetic `(1.7e12 - 0) / 5000 = 3.4e8` is determinate; the canvas is 480px.
- **Finding 8 (Target replay disabled):** `targetAudio = null` with no writer is grep-verified.
- **Finding 13 (CLAUDE.md staleness):** Each staleness point is directly verifiable.

### Moderate confidence (inference from verified code paths)

- **Finding 6 (KWS re-regression):** The re-introduction is verified; the downstream behavior ("digit recognition hangs for the rest of the session") requires assumptions about cache state that may not always hold.
- **Finding 10 (DST):** The arithmetic is verified at pinned epoch values. Whether the miscalculation ever persists (vs is purely render-time) is unknown.
- **Finding 11 archetypes 5-6:** Classification is correct; frequency of recurrence is estimated, not measured.

### Weakest claims (inference with limited observation)

- **Finding 1 severity "every user's first complete session"** assumes session length >= 7 rounds. If many users abandon earlier, the corruption blast radius is smaller than worst-case. Phase 2 iterator-3 used the spec's 10-round default; no telemetry confirms median session length.
- **Finding 12 impact:** structurally the code path is dead; user-visible effect is unknown without a DOM probe.
- **Effort estimates ("~2 hours," "~1 day"):** Phase 2 gave these; implementation subagent history on this repo suggests 2-hour estimates run 3-5 hours in practice once the review loop is counted. Plan capacity against 1.5x-2x raw estimates.

### Blind spots in the analysis itself

1. **No manual QA pass.** Every finding is static (code read, grep, arithmetic).
2. **No browser compatibility matrix.** Analysis assumed Chrome desktop and generalized. Safari AudioContext behavior in particular may differ.
3. **No performance profiling.** CLAUDE.md warns "audio-render thread is allocation-sensitive"; whether current worklet code allocates during `process()` was not verified beyond CLAUDE.md's known-good YIN worklet.
4. **No production telemetry.** All failure-rate claims are theoretical.
5. **No ML accuracy data.** YIN and KWS were verified on synthetic inputs. Real voice performance unmeasured.
6. **Single-pass iterator outputs.** No cross-check between iterator-2's dead-code count (908 LOC) and iterator-4's archetype-3 examples for double-counting.
7. **julianken-bot review rubric blind spots.** Archetype 6 (plan-authored defects) is evidence the review loop has a structural ceiling; the ceiling's shape is not fully characterized.

## H) Recommendations

Recommendations are high-level only - they describe **what to decide** and **why**, not how to implement. They are ordered by impact-to-effort ratio and by the sequencing constraints derived from Section F.

---

### R1 - Close three Production Blockers as a pre-C2 correctness pass

**Priority: HIGHEST. Ship before anything else, including C2 planning.**

Addresses Findings 1, 2, 3. All three silently degrade the app for real users. Finding 1 actively corrupts durable SRS state; the other two silently dead-end user sessions. None is a feature. None belongs in C2's scope.

**Rationale:** Data integrity primacy. A single unfixed day of Finding 1 adds poisoned rows to every real user's training history. The fixes are small (~0.5-1 day combined). Putting them in C2 risks them being interleaved with feature work and deferred.

**Trade-offs:** delaying C2 planning by one day to ship these fixes is a small cost. The alternative - shipping C2 on top of known data-corruption - is much larger.

**Open questions:** should the fix ship with a data-migration pass that scans the `attempts` table for already-poisoned rows? See Open Question 1.

---

### R2 - Reconcile CLAUDE.md with code state

**Priority: HIGHEST. Five minutes. Blocks no work but prevents agentic orientation drift.**

Addresses Finding 13. A fresh-context Sonnet agent dispatched today to plan C2 would read "Plan C1 not yet written" and potentially re-author components that already ship.

**Rationale:** Zero cost. The only risk is forgetting to do it.

**Trade-offs:** None. Pure hygiene.

---

### R3 - Install two zero-cost guardrails before C2 planning

**Priority: HIGH. Hours, not days.**

Two archetype-prevention guardrails with no migration cost:
1. Pre-PR CI-parity command: `NO_COLOR=1 pnpm run build && pnpm run lint && pnpm run typecheck`. Process convention, not a code change.
2. Pre-dispatch plan-identifier validation: dispatcher grep-checks every identifier in the plan text against source before dispatching an implementer subagent. A check at the skill level.

**Rationale:** These prevent archetype-1 (CI environment gaps) and archetype-5 (plan-shape drift) recurrence during C2 with no code-migration cost. The four other guardrails (`no-floating-promises`, JSDoc unit annotations, store-writer audit, plan-amendment loop) have migration cost and should be named C2 tasks.

**Trade-offs:** Process convention is easy to forget. Consider encoding the pre-PR command in a git pre-push hook.

---

### R4 - Decide three product questions explicitly before C2

**Priority: HIGH. Decisions, not implementation. An hour of owner thinking.**

Three questions that are currently product decisions made by implementation omission:

1. **Interleaving scheduler wire-in or spec amendment?** (Finding 4). Recommended: wire in, ~2 hours. Alternative: amend CLAUDE.md and the spec to drop the "no blocked practice" non-negotiable. Inaction is not an option - the non-negotiable and the code disagree.
2. **Target/Both replay: ship or strike from spec?** (Finding 8). Recommended: ship as the highest-priority C2 feature, ~1 day of `OfflineAudioContext` work. Alternative: strike the segmented toggle from spec section 9.3.
3. **Focus-item chip: recompute or strike?** (Finding 12). Recommended: re-home `pickFocusItem()` as a 30-LOC helper and call from `complete()`. Alternative: strike the chip from the summary mockup.

**Rationale:** Each is currently an implicit decision that the code is making about the product. Making them explicit lets the owner choose what the product actually is.

**Trade-offs:** Each "ship" option costs hours to days. Each "strike" option costs an hour of documentation work. Neither is wrong; deciding-by-omission is wrong.

---

### R5 - C2 Task 0: Composition test phase

**Priority: HIGH. Days, not hours. The foundation every subsequent C2 task builds on.**

Before any C2 feature work, write the composition-layer tests Phase 2 iterator-5 prescribed:
- `startRound -> pitch capture -> digit capture -> CAPTURE_COMPLETE -> grade -> persist -> next` integration test with real `fake-indexeddb`.
- DST-boundary regression test with pinned epoch values.
- `$state -> IDB` serialization assertion (several Svelte `$state` objects reach IDB; PR #101 caught one, others may exist).
- 30+-round simulated session against the LIVE controller. Adapt the dead `simulated-session.test.ts`. This test becomes the regression guard for Finding 1.

**Rationale:** Every defect in Section E lives at the composition seam. Every C2 feature will ship code on that seam. Without composition tests, C2 features ride on the same untested foundation that produced the blockers.

**Trade-offs:** Multi-day investment before user-visible progress. Alternative is to continue with the current test strategy (pure modules only) and absorb the corresponding defect rate in C2. The asymmetry of the investment favors the tests heavily.

---

### R6 - C2 Task 1: Wire `selectNextItem` into the session controller

**Priority: HIGH. Hours. Blocks all multi-key feature work.**

Addresses Finding 4. The single highest-leverage spec-compliance fix in the repo.

**Rationale:** Today's single-key curriculum masks the gap. The first multi-key feature in C2 will hit it. Wiring ahead of time prevents a forced cascade (add G major -> discover scheduler missing -> wire scheduler -> discover persistence gap per MEMORY.md `project_controller_persistence_gap.md` -> fix persistence -> add G major).

**Trade-offs:** The wire-in depends on the attempt-persistence path being live (per MEMORY.md). Verify before estimating. The 2-hour estimate may expand to a day if persistence is incomplete.

**Open questions:** does the persistence gap block the wire-in? Phase 2 did not verify; needs a targeted check.

---

### R7 - C2 Task 2 (or concurrent with Task 1): Wire Settings read path

**Priority: HIGH. Hours. Credibility fix.**

Addresses Finding 5. Either wire the read path through the controller (recommended), OR remove the Settings UI until it works.

**Rationale:** The credibility cost of a full Settings screen that changes nothing is non-linear. The fix is trivial (repos are already injected).

**Trade-offs:** Could also be bundled into R1 if the owner wants to ship the correctness pass with Settings wired. Small scope creep.

---

### R8 - Named C2 task: `no-floating-promises` enablement migration

**Priority: HIGH. Days (migration).**

Enable `@typescript-eslint/no-floating-promises: error` in the root ESLint config. Audit every existing `.catch(() => {})` and every bare `void promiseFn()`. Some are legitimate (cleanup stops where caller cannot wait); most are the archetype-4 bugs the rule is supposed to catch.

**Rationale:** The single highest-leverage structural guardrail against archetype 4. Would have caught Findings 2, 3, 6 at PR time. Prevents the same class during all of C2.

**Trade-offs:** Not a one-line change. Existing violations must be adjudicated. Some will need `// eslint-disable-next-line` with a comment explaining why the void is intentional. Estimate a day including review; the payoff is permanent.

---

### R9 - Named C2 task: DST streak correctness + per-session tz_offset_ms

**Priority: MEDIUM. Small implementation, real user-visible gain.**

Addresses Finding 10. Schema add `tz_offset_ms?: number` to `Session` (optional, no IDB bump), extend `currentStreak` signature, update `StreakChip` caller, add pinned-epoch tests.

**Rationale:** Directly addresses the "honest progress" non-negotiable. Small scope (~30 LOC + ~80 LOC tests).

**Trade-offs:** Requires the Open Question 2 probe (is the miscalculation ever persisted?) to know if a migration is needed.

---

### R10 - Probes before C2 finalizes (half-day total)

**Priority: MEDIUM. Converts five unknowns into knowns.**

Run the following five probes in a pre-C2 investigation sprint:

1. Query one friend-tester's IndexedDB for `attempts` rows clustered at round >= 7 with implausibly bad pitch (confirm/deny Finding 1 historic corruption).
2. 10-minute DOM probe: complete a session, check the Summary's focus-item chip (Finding 12).
3. Complete a session across a DST boundary and inspect the streak value before and after; determine if the value persists (Finding 10 Open Question).
4. Install on Safari iOS private tab, confirm Finding 2 reproduces in the wild.
5. Service worker offline flow: install, go offline, complete a session, verify KWS model loads from cache (Blind Spot 4).

**Rationale:** Each probe is small. Each converts a "theoretical" finding into a known-real or known-not-applicable one. The C2 plan written on top of these probes is materially more accurate than one written on inference alone.

**Trade-offs:** None. Strictly additive evidence.

---

### Not recommended for C2

- **Wiring `createOrchestrator` fully.** Wire-in effort is 1-2 days; architectural value is debatable given the live controller already does the job. Extract `pickFocusItem()` (per R4 question 3) and let the rest retire.
- **Deleting `round-adapters` immediately.** Correct disposition but low urgency. Fold into whatever PR next touches that area.
- **Broad test-suite redesign.** The pure-module test strategy is correct. Only the composition seam is undertested. R5 is surgical; a wholesale redesign would destroy real coverage.
- **Production telemetry infrastructure.** Would be genuinely valuable but is days to weeks of work and is not blocking any specific defect fix. Fold into C2 or later as a feature.

## I) Open Questions

Questions the analysis could not answer. The owner should answer or probe each before freezing the C2 plan.

1. **Has Finding 1 already corrupted any real user's SRS data?** If yes, the fix ships with a migration pass that marks suspect `attempts` rows `corrupt: true` and recomputes mastery. If no, the fix is the lifecycle change alone. A single IDB-row probe against any friend-tester device answers this.

2. **Is the Finding 10 DST miscalculation persisted, or purely render-time?** If persisted, a re-compute-on-load migration is needed. If render-time, any future release fixes it. Answered by a spring-forward cross with DevTools open on the streak-chip state.

3. **Does the controller's attempt-persistence gap (per MEMORY.md) block R6's scheduler wire-in?** Phase 2 assumed persistence was live. MEMORY.md suggests otherwise. A targeted check against `session-controller.svelte.ts` can confirm or deny before C2 Task 1 is estimated.

4. **Is the current IndexedDB schema at the right version number for a `tz_offset_ms` addition without a bump?** The assumption is yes (optional field, no migration); verify against the current `migrateDB` path.

5. **What is the median real user session length today?** Without telemetry this is unanswerable. If well under 7 rounds, Finding 1's blast radius is smaller than the worst-case estimate. Does not change prioritization but informs urgency messaging.

6. **Are there other Svelte `$state` objects that reach the IDB boundary besides the one PR #101 caught?** A systematic enumeration was not done. Relevant for the `$state -> IDB` serialization assertion in R5.

7. **Does the service worker cache-bust correctly when the KWS model URL changes?** Untested. Relevant if C2 plans any model swap or version bump.

8. **Does `masteryByDegree` produce `NaN%` for an item with zero attempts?** Tested at the unit level; UI integration with zero-attempt items not verified.

9. **Are any of the "locked" variability paths (`lockedTimbre`, `lockedRegister`) read anywhere?** Settings bridge decision kept them `null`. If a user ever sets a lock through a future UI, does anything consume it? Grep will answer.

10. **Will the C2 features (multi-key curriculum, mobile UI, additional timbres) fit under the 2 MiB client + 50 KiB SW bundle budgets?** Not modeled. Iterator 2's 908 LOC dead-code deletion recovers budget but the net is uncomputed.

## J) Appendix: Evidence Index

Every finding's anchor point, grouped by source.

### Source files (by finding)

| Finding | File path | Line(s) | Claim |
|---|---|---|---|
| 1 | `apps/ear-training-station/src/routes/+page.svelte` | 50 | `getAudioContext: () => new AudioContext()` |
| 1 | `apps/ear-training-station/src/lib/session/session-controller.svelte.ts` | 199 | `AudioContext` created per `startRound()` |
| 1 | (grep) | - | Zero `ctx.close()` calls in codebase |
| 2 | `apps/ear-training-station/src/routes/+layout.svelte` | 10 | `void hydrateShellStores()` |
| 3 | `apps/ear-training-station/src/lib/components/ActiveRound.svelte` | 45-47 | `await controller.startRound()` unwrapped |
| 4 | `packages/core/src/scheduler/selection.ts` | - | `selectNextItem()` defined |
| 4 | (grep) | - | Zero app-level imports of `selectNextItem` |
| 4 | `apps/ear-training-station/src/lib/session/session-controller.svelte.ts` | 305-307 | Live selection: `dueNow.find(...)` |
| 4 | `packages/core/src/session/orchestrator.ts` | - | `createOrchestrator()` defined; zero app imports |
| 5 | (Phase 1 area-1 Finding 5) | - | `settingsRepo` injected but not read |
| 5 | `apps/ear-training-station/flow-12-settings.png` | - | Settings UI exists |
| 6 | `apps/ear-training-station/src/lib/session/session-controller.svelte.ts` | 345-346 | `.catch(() => {})` re-introduced after PR #76 |
| 7 | `apps/ear-training-station/src/lib/components/ActiveRound.svelte` | 17-22 | Clock stubs with "Task 6 wires real values" comment |
| 7 | `docs/plans/2026-04-17-plan-c1-3-scale-degree-exercise.md` | Task 6 | No step updating `ActiveRound.svelte` |
| 8 | `apps/ear-training-station/src/lib/session/session-controller.svelte.ts` | 67 | `targetAudio = null` |
| 8 | `apps/ear-training-station/src/lib/components/ReplayBar.svelte` | - | Three-mode structure exists |
| 8 | `docs/plans/2026-04-17-plan-c1-3-scale-degree-exercise.md` | Task 8 | Deferral to "C1.4 follow-up task" |
| 9 | (grep) | - | Zero `+error.svelte` in routes |
| 10 | `apps/ear-training-station/src/lib/components/StreakChip.svelte` | 7 | Render-time `getTimezoneOffset()` |
| 10 | `packages/core/src/analytics/rollups.ts` | - | `currentStreak` correct in isolation |
| 12 | `packages/core/src/session/orchestrator.ts` | - | `pickFocusItem()` defined; zero callers |
| 13 | `CLAUDE.md` | throughout | Plan C1 state, test count, head commit all stale |

### Phase 1 area investigations

- `docs/codebase-health/phase-1/area-1.md` - spec compliance (5 findings)
- `docs/codebase-health/phase-1/area-2.md` - test quality
- `docs/codebase-health/phase-1/area-3.md` - architecture integrity
- `docs/codebase-health/phase-1/area-4.md` - silent failures (4 catalogued)
- `docs/codebase-health/phase-1/area-5.md` - performance/PWA

### Phase 2 iterator deep dives

- `docs/codebase-health/phase-2/iterator-1.md` - deferred-vs-forgotten
- `docs/codebase-health/phase-2/iterator-2.md` - dead-code inventory (908 LOC total)
- `docs/codebase-health/phase-2/iterator-3.md` - silent-failure blast radius
- `docs/codebase-health/phase-2/iterator-4.md` - six agentic failure archetypes
- `docs/codebase-health/phase-2/iterator-5.md` - test strategy for highest-risk gaps

### Phase 3 syntheses

- `docs/codebase-health/phase-3/synthesis-1.md` - thematic (4 themes)
- `docs/codebase-health/phase-3/synthesis-2.md` - risk/opportunity register
- `docs/codebase-health/phase-3/synthesis-3.md` - gaps/implications

### Referenced PR history

- PR #30 - pre-C1 foundation fixes (KWS activeThresholds, Degree type leak, settings merge)
- PR #31-35 - CI infrastructure
- PR #76 - original KWS stop `.catch(() => {})` fix (re-regressed; see Finding 6)
- PR #97 - service worker + manifest
- PR #98 - axe-core a11y smoke
- PR #99 - bundle budgets (2 MiB client + 50 KiB SW)
- PR #100 - C1.3-C1.4 cleanup pass
- PR #101 - integration happy-path restoration (caught one `$state -> IDB` case)

### Referenced spec sections

- Spec section 5.2 - interleaving commitment
- Spec section 7 - default session length 10 rounds
- Spec sections 7, 9.2 - split-stage pitch trace
- Spec section 8 - summary view, "practice this next" chip
- Spec section 9.3 - segmented-toggle replay (You / Target / Both)

### CLAUDE.md non-negotiables referenced

- "Interleaving + Leitner SRS for scheduling. No blocked practice." (violated - Finding 4)
- "Honest progress UI" (violated at edge - Finding 10)
- "Sing-and-verify" (honored)
- "Variability by default" (honored)
- "Functional scale-degree hearing, not isolated interval drills" (honored)
- "Dark audio-app aesthetic" (honored)

---

**Report complete.** This document is the sole Phase 4 deliverable and the primary input to C2 planning. All recommendations here are high-level; the C2 plan (to be authored separately via the brainstorming skill, per CLAUDE.md convention) will translate R1-R10 into tasked implementation steps.
