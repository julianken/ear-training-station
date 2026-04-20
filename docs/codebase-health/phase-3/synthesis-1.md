# Synthesis: Thematic Analysis

## Synthesis Approach

Phase 1 produced five area investigations (spec compliance, test quality, architecture
integrity, silent failures, performance/PWA). Phase 2 iterated on five derived
questions (deferred-vs-forgotten, dead code map, silent failure blast radius, agentic
failure archetypes, test strategy for the two highest-risk gaps). This synthesis
collapses those ten documents into three to four structural themes, then examines what
they share — where the evidence points at a single root cause acting in multiple
disguises.

The synthesis treats the codebase's raw state as ground truth. All claims below are
anchored to specific file paths and line numbers verified against `main` as of commit
`04d3665`.

---

## Core Narrative

The ear-training-station is not a buggy project in the conventional sense. The types
compile. The tests pass. The build is clean. The six non-negotiable design commitments
are all honored structurally — the right components exist, the right colors are used,
the right domain objects flow between the right layers. What is wrong is subtler: the
app is a structurally correct shell around a functionally broken core loop.

The pattern that runs through every finding is a single production dynamic: agentic
development, operating one PR at a time with bounded scope, is systematically good at
building things and systematically bad at verifying that things work end-to-end when
assembled. Each plan task produces correct artifacts in isolation. But the composition
step — the moment where the user sits down, presses "Start round," and hears feedback
about their singing — was never made an explicit test target. As a result, every defect
in this report is invisible to CI and to any per-task reviewer, yet every defect is
observable to a human who uses the app for ten minutes.

Three themes organize the findings. A fourth theme captures what this means for Plan
C2.

---

## Key Conclusions

### Conclusion 1: The Interleaving Guarantee Is a Structural Lie

**Pattern:** The single most prominent design commitment in `CLAUDE.md` — "Interleaving
+ Leitner SRS for scheduling. No blocked practice." — is currently violated in
production while passing tests. The violation is not subtle. `selectNextItem()` in
`packages/core/src/scheduler/selection.ts` (82 LOC, 9 tests, all green) is never
imported by any application file. The session controller's actual selection logic is
`dueNow.find(i => i.id !== justPlayed) ?? dueNow[0]` at
`session-controller.svelte.ts:305-307`. This returns the earliest-due item by
IndexedDB insertion order, not the weakness-weighted interleaved item the spec
describes.

The dead code extends upward: `createOrchestrator()` in
`packages/core/src/session/orchestrator.ts` (166 LOC, 590 LOC total with tests) is the
only production caller `selectNextItem` ever had. The orchestrator itself has zero
app-level imports. When Plan C1 built the session controller fresh rather than
composing the Plan A orchestrator, both the orchestrator and its scheduler were
orphaned without anyone deciding to delete or wire them in.

**Supporting evidence:**
- Phase 1, area-1, Finding 1: grep confirms zero app-level imports of `selectNextItem`
- Phase 2, iterator-2: full dead-code inventory — 908 LOC total across four orphaned
  modules; `selectNextItem` wire-in effort ~2 hours
- Phase 2, iterator-2: five enforcement properties the live path skips — same-degree
  back-to-back blocking, same-key-consecutive-streak blocking, weakness-weighted
  sampling, mastered-item warmup (30%), soft-constraint fallback

**Confidence:** High. The grep evidence is unambiguous. The behavioral delta is
partially masked today (single key with three items means few inter-key constraints
bind), but is structurally present and will become visible the moment a second key is
added.

**Caveats:** The masking effect of a single-key starter curriculum means no real user
has yet been harmed by this specific gap. Wire-in is low-risk and self-contained.

---

### Conclusion 2: Three Critical Runtime Failures Are on the Happy Path

**Pattern:** Four silent failures were catalogued in Phase 1, area-4. Phase 2,
iterator-3 establishes that three of them are not edge-case failures — they are
deterministic outcomes of normal usage with no existing mitigation.

**Finding 2a — AudioContext exhaustion (round 7+ of any complete session).**
`+page.svelte:50` passes `getAudioContext: () => new AudioContext()` to the controller.
`session-controller.svelte.ts:199` creates a fresh `AudioContext` on every `startRound`
call and never closes it. Chrome enforces a limit of approximately 6 concurrent
`AudioContext` instances. A standard 10-round session exhausts the budget at round 7.
From round 7 onward, `new AudioContext()` returns a context in the `suspended` state.
The AudioWorklet for pitch detection is attached to this context and never receives
frames. The pitch trace shows nothing. The 5-second capture timeout fires, `gradeListeningState`
runs with empty frames, and the round is graded pitch-fail. The user's SRS data
accumulates incorrect fail grades silently for every remaining round in every complete
session. There is no degradation flag, no toast, and `consecutiveNullCount` does not
increment because a suspended context emits zero frames rather than low-confidence
ones.

This is not a corner case. The default session length is 10 rounds. This is the happy
path.

**Finding 2b — `void hydrateShellStores()` on IDB failure (private/incognito users).**
`+layout.svelte:10` discards the hydration promise with `void`. Any IDB failure —
Safari private mode (common), Chrome quota exceeded, schema upgrade conflict — leaves
all three shell stores at their empty defaults silently. The app renders normally. The
dashboard shows no mastery, no sessions, no streak. The scheduler finds no items due.
The user cannot train. No error is surfaced.

**Finding 2c — `startRound()` errors silently lost (mic revoked, network failure).**
`ActiveRound.svelte:45-47` calls `await controller.startRound()` with no try/catch.
`startRound()` can throw from at minimum five internal sites (mic permission,
AudioWorklet load, AudioRecorder setup, IDB during `listAll`, dynamic import on network
failure). Every throw propagates to the event handler as an unhandled rejection. The UI
state does not change. The "Start round" button stays visible. The controller stays in
`idle`. The user has no feedback and no recovery path short of a full page reload.

**Supporting evidence:**
- Phase 1, area-4: initial identification of all four silent failures
- Phase 2, iterator-3: trigger conditions, Chrome throttle behavior verified, user
  experience walkthrough, error surface inventory
- Code verified: `+page.svelte:50`, `session-controller.svelte.ts:199`, no
  `ctx.close()` anywhere in the codebase, `+layout.svelte:10` void call,
  `ActiveRound.svelte:45-47` bare await

**Confidence:** High. The AudioContext behavior was verified against Chrome's spec
behavior (suspended-on-limit, no throw, worklet silently idle). The other two are
verified code paths with no try/catch.

**Caveats:** The KWS stop `.catch(() => {})` pattern (iterator-3 Finding 3) is HIGH
rather than CRITICAL because it does surface a degradation signal downstream, even
though the root cause is swallowed. It was also explicitly fixed in PR #76 and then
re-introduced at `session-controller.svelte.ts:345-346`, which is relevant to
Conclusion 4.

---

### Conclusion 3: The Visual Feedback Loop Is Broken by Deferred Wiring That Never Arrived

**Pattern:** Two deferred items from Plan C1 were each assigned a named future task
that was then never written into any task's implementation steps. Both affect the core
feedback experience.

**Finding 3a — Pitch trace clock stub.** `ActiveRound.svelte:17-22` stubs
`windowStartMs = 0` and `getNowMs = () => 0` with the comment "Task 6 wires real
values." Task 6 in `plan-c1-3-scale-degree-exercise.md` defines full `startRound()`
implementation steps but contains no step updating `ActiveRound.svelte` to replace the
stubs. The visual result: pitch frames arrive with `at_ms = Date.now()` (~1.7e12 ms).
`PitchTrace.timeToX` computes `(1.7e12 - 0) / 5000 = 3.4e8`, which exceeds the canvas
width of 480px by many orders of magnitude. All frames clamp to the rightmost pixel.
The scrolling pitch trace — the split-stage visualization explicitly named in
spec §7 and §9.2 — never scrolls. The y-axis is also a stub: `hzToVisualDegree` always
returns `targetDegree` regardless of actual pitch. The fix is a one-line change in the
controller to capture and expose the resolved `targetStartAtAcTime` value that
`PlayRoundHandle` already provides.

**Finding 3b — Target and Both replay modes permanently disabled.** The spec (§9.3)
requires a segmented-toggle replay with "You / Target / Both" modes. `ReplayBar.svelte`
implements all three modes structurally. `targetAudio` is initialized to null on
`session-controller.svelte.ts:67`, reset to null in `next()`, and assigned nowhere.
"Target" and "Both" mode buttons are therefore always disabled. The plan text
(`plan-c1-3-scale-degree-exercise.md`, Task 8) deferred this to "a follow-up task in
C1.4 can render the target buffer (synthesize via Tone's OfflineAudioContext) if
priority warrants." C1.4 contained no such task.

Both deferrals are documented. Neither was forgotten accidentally. Both were placed in
a "future task" that was never created. The distinction matters: these are not bugs in
the implementation of a task, they are scope decisions that were never reconsidered
when the future task failed to appear in C1.4.

**Supporting evidence:**
- Phase 1, area-1, Findings 2 and 3
- Phase 2, iterator-1: confirmed deferred-vs-forgotten classification with plan-text
  citations
- Code verified: `ActiveRound.svelte:17-22`, arithmetic confirms the pixel-clamp
  outcome, `session-controller.svelte.ts:67` and surrounding grep for `targetAudio`

**Confidence:** High. The arithmetic on the pitch trace is deterministic. The
`targetAudio` null path is confirmed by grep.

**Caveats:** The clock stub fix is genuinely simple (one field, one prop pass-through)
and should not require a full planning cycle. The `targetAudio` fix requires
`OfflineAudioContext` synthesis work that is non-trivial and legitimately belongs in a
dedicated task.

---

### Conclusion 4: Agentic Development Produces Recurring Failure Classes That Process Cannot Prevent Individually

**Pattern:** Phase 2, iterator-4 classified six agentic failure archetypes across the
entire Plan A–C1 history. All six are systemic. Two are still live in the codebase
(Archetypes 3 and 4). One defines the root cause of Conclusions 1 and 3 (Archetype 3:
dead/unreachable code shipped as features). One defines the root cause of Finding 2c
and the KWS stop re-regression (Archetype 4: async rejection silently swallowed).

The most diagnostic single observation: the `.catch(() => {})` pattern on KWS stop was
an IMPORTANT finding in PR #76, was explicitly fixed, and was re-introduced at the
identical site (`#stopAudioHandles`) in a later PR with no review escalation. This is
not human error in the conventional sense. The implementer agent that introduced it had
no memory of the prior correction and no structural signal telling it the pattern was
wrong. The existing ESLint config does not flag floating promises at that severity. The
pattern is semantically valid TypeScript and lint-clean.

This is the defining characteristic of agentic re-regression: the project's review
infrastructure (julianken-bot) catches violations when they are submitted, but cannot
prevent re-introduction because each agent starts fresh. The only persistent enforcement
mechanism is a structural guardrail — an ESLint rule, a test wrapper, a CI check —
that fires regardless of agent memory state.

The six archetypes with their current status:

| Archetype | Still live | Guardrail that would prevent recurrence |
|---|---|---|
| CI env parity gaps | No — CI is green | `NO_COLOR=1 pnpm run build && pnpm run lint && pnpm run typecheck` as mandatory pre-PR |
| Clock domain confusion | Partially — pitch trace broken | JSDoc unit annotations on all time-parameter functions |
| Dead/unreachable code shipped as features | Yes — 908 LOC dead | Pre-PR store-writer audit: zero writer = ship the writer first |
| Async rejection silently swallowed | Yes — two live instances | `@typescript-eslint/no-floating-promises: error` in ESLint config |
| Plan text diverging from actual API shapes | No active bugs, latent in e2e helper | Pre-dispatch plan identifier validation against source |
| Plan-authored defects faithfully propagated | Partially — DST offset bug | Plan-controlled IMPORTANT findings require plan-amendment commit before re-review |

The DST streak miscalculation (Phase 2, iterator-5) sits squarely in Archetype 6. The
render-time `getTimezoneOffset()` passed uniformly to `currentStreak()` was a design
decision in the plan, not an implementer deviation. The rollup function is correct in
isolation. The caller (`StreakChip.svelte:7`) faithfully implemented the plan, and the
plan was wrong. A spring-forward DST crossing causes the Saturday session to be
silently merged into Sunday, under-counting the streak by one day annually. The fix
requires per-session `tz_offset_ms` storage — a schema addition, a `currentStreak`
signature change, and a `StreakChip` caller update.

**Supporting evidence:**
- Phase 2, iterator-4: all six archetypes with evidence, still-present assessment,
  proposed guardrail
- Phase 2, iterator-5: DST concrete reproduction at 2026-03-08 epoch values; test
  design for the regression; clone-verifying repo wrapper design
- `session-controller.svelte.ts:345-346`: re-introduced `.catch(() => {})`

**Confidence:** High across all archetypes. The re-regression evidence is unambiguous.

**Caveats:** Guardrails have a cost. The ESLint `no-floating-promises` rule in
particular may produce noise in Svelte's event-handler patterns where `void` is
idiomatic. A scoped enable with targeted overrides (rather than project-wide) may be
the right implementation to avoid slowing down development.

---

## Blind Spots

**1. End-to-end session test coverage gap.** The analysis confirmed that no test
exercises a complete 10-round session through the controller. `simulated-session.test.ts`
does this, but via the dead orchestrator, not the live controller. The AudioContext
exhaustion bug (Conclusion 2a) would have been caught by such a test. This gap is
noted but not fully remediated in Phase 2 (iterator-5 focuses on DST and clone safety,
not full-session integration).

**2. Mobile/PWA runtime behavior untested.** The AudioContext throttle behavior was
verified against Chrome desktop documentation. Chrome's behavior on iOS Safari (where
AudioContext is more aggressively managed by the browser) is not analyzed. The KWS stop
failure and pitch handle stop failure paths (Conclusion 2, iterator-3) are more likely
on mobile backgrounding events. No analysis of the service worker's interaction with
audio state on resume from background.

**3. SRS corruption quantification.** Conclusion 2a establishes that round 7+ silently
grades pitch-fail. The downstream impact on `Item.box`, `Item.due_at`, and
`Item.consecutive_passes` from a stream of incorrect fail grades has not been modeled.
A user completing several sessions could have their entire curriculum demoted to Leitner
Box 1, effectively resetting their learning history. This could be the most severe
user-facing impact in the report, but it was not quantified.

**4. Settings wiring.** Phase 1, area-1, Finding 5 identified that the `settingsRepo`
dep is injected but never read during a session. `minPitchConfidence` and
`minDigitConfidence` are hardcoded at 0.5. The `auto_advance_on_hit` setting is
effectively ignored. This was not revisited in Phase 2 — it remains an open gap in
spec compliance.

**5. `+error.svelte` absence.** Phase 2, iterator-3 confirmed that no `+error.svelte`
exists in the routes tree. Any uncaught `load()` rejection produces the default
SvelteKit unstyled error page. This was identified but not included in any
Conclusion above as a first-class theme because it is primarily a UX polish gap rather
than a correctness issue — though it does intersect with the IDB hydration silent
failure.

---

## Recommendations (high-level only)

The following are ranked by impact-to-effort ratio, drawing on the effort estimates in
Phase 2. They are not tasks — they are inputs to Plan C2 planning.

**R1 — AudioContext lifecycle fix (Conclusion 2a). Highest priority.**
Hoist the `AudioContext` to a module-level singleton, created once on first user
gesture and reused across rounds. Add a `degradationState.audioContextThrottled` flag
triggered when `ctx.state === 'suspended'` on entry to `startRound`. This is a
structural bug that silently corrupts every user's SRS data on their first complete
session. ~2-4 hours of work.

**R2 — `startRound()` error handling (Conclusion 2c).**
Add try/catch in `ActiveRound.svelte`'s `start()` function and route to `pushToast`.
~30 minutes. The fix is minimal; the severity justifies treating it as a hotfix rather
than a C2 task.

**R3 — `void hydrateShellStores()` error handling (Conclusion 2b).**
Catch the hydration rejection, set a `degradationState.persistenceUnavailable` flag,
show a banner message, and add a `+error.svelte` for the `+layout.ts` path. ~1-2
hours. The Safari private browsing failure is a high-frequency production trigger.

**R4 — Wire `selectNextItem` into the session controller (Conclusion 1).**
~2 hours per iterator-2's estimate. The single highest-leverage spec-compliance fix in
the repo. File as a named C2 task before any multi-key feature work begins; otherwise
every new key compounds the pedagogical harm.

**R5 — Clock stubs in `ActiveRound.svelte` (Conclusion 3a).**
Capture the resolved `targetStartAtAcTime` in the controller and expose it; pass to
`ChordBlocks` and `PitchTrace`. ~1-2 hours. The pitch trace is broken for every user.

**R6 — ESLint `no-floating-promises` rule (Conclusion 4).**
Prevents Archetype 4 recurrence without review cycles. Apply scoped to the app and
controller files, with documented exceptions for Svelte event handlers where `void` is
idiomatic. ~1 hour to configure and suppress existing legitimate voids.

**R7 — Clone-verifying repo wrapper in integration tests (Conclusion 4).**
Prevents Archetype 3/4 recurrence at the IDB boundary. ~40 LOC per iterator-5 design.
Applies compounding interest to every future repo write.

**R8 — DST streak fix and regression tests (Conclusion 4).**
Schema add `tz_offset_ms?: number` to `Session`, extend `currentStreak` signature,
update `StreakChip` caller, add pinned-epoch tests. ~30 LOC implementation + ~80 LOC
tests per iterator-5. No IDB version bump required. Directly addresses the "honest
progress" non-negotiable.

**Not recommended for C2:** Wiring in `createOrchestrator` (wire-in effort ~1-2 days,
architectural value debatable); deleting `round-adapters` (correct disposition but low
urgency, fold into whatever PR next touches that area).
