# Synthesis: Gaps and Implications

## Synthesis Approach

This synthesis is the deliberate counterweight to the two companion syntheses. Where those will compress the evidence into affirmative conclusions, this one's job is to draw the **boundary of what the 340 tests, 5 investigation areas, and 5 iterator passes have actually established** — and to state clearly what the project owner can and cannot decide on that evidence before opening C2 planning.

The method: take each confident Phase 2 finding and ask three questions before letting it into a recommendation.

1. **What did we observe vs. what did we infer?** Several findings are arithmetic proofs (DST epoch calculation, AudioContext leak counting). Others are grep-based absence claims (`selectNextItem` has zero app imports). Others are test-coverage arguments (no unit test covers `startRound` end-to-end). These have different evidential weights and should produce different urgencies.
2. **What would have shown up if we had looked, but we didn't look?** Static analysis of the codebase plus doc comparison covers a great deal, but it does not cover production telemetry, real-user behavior on first install, screen-reader navigation, offline flow, or long-running session stability. The absence of data in these dimensions is itself a finding.
3. **What decision does this finding change?** A defect that produces wrong behavior but is invisibly recoverable (DST display drift) is categorically different from a defect that accumulates in the persistence layer and mis-trains the SRS model (AudioContext leak). C2 planning needs to rank by this distinction, not by finding count.

The synthesis is scoped to three outputs: **gaps** (what the evidence does not tell us), **implications** (what the evidence forces or forecloses on C2), and **anti-conclusions** (claims the evidence does not support but would be tempting to draw).

---

## Core Narrative

The ear-training-station codebase is in a state that is both healthier and unhealthier than its 340-green-tests + green-CI surface implies.

Healthier than it looks: the pure-logic kernel (music theory, YIN pitch detection, degree mapping, SRS math, round reducer) is thoroughly tested at the leaf level and is almost certainly correct in the small. The design commitments are encoded at the type level (`Key`, `Degree`, `Register`). The audio stack works in the dev harness end-to-end. Plan A/B/C0 review bot caught four real bugs before merge that would have hurt users.

Unhealthier than it looks: the story of the 340 tests is not "the app works" but "the components work in isolation." The **composition** — the exact path users take when they click "Start round" — has zero unit test coverage. The code that actually persists attempts, drives the SRS, and renders the dashboard is a parallel reimplementation of the pure kernel, not a consumer of it. The interleaving scheduler, the round reducer's composition contract, and the two-clock adapter module were all built as planned, then bypassed at the final wiring step. The non-negotiable design commitments survive at the *type* level and die at the *execution* level for two of six (interleaving, replay).

The AudioContext leak is the single most consequential finding because it crosses from UI polish into the SRS: by round 7 of a session, the app is recording incorrect failure data into the Leitner boxes that drive the learner's future practice. Every day the app ships without that fix, real users produce polluted training history that is not recoverable by a future release.

The six agentic failure archetypes are the second most consequential finding because they are not bugs — they are the structural properties of the process that produced the code. C2 will reproduce all six unless process-level guardrails are put in place *before* C2 starts, not as part of C2's first task. The review bot catches these after the fact; the guardrails prevent them from reaching the bot.

The C1 documentation drift (CLAUDE.md says "Plan C1 not yet written"; C1 landed two weeks ago) is a small finding on its own but a large finding as a signal: the system does not have an automatic reconciliation between plan state and code state. The owner needs to decide whether that is a process gap to fix or a trivial cleanup.

## Key Conclusions

### Conclusion 1: The app is not production-ready for real users until three Production Blockers are closed

- **Supporting evidence:**
  - **AudioContext leak (Iterator 3, Finding from Phase 1 Area 1 cross-referenced):** By round 7, new `AudioContext` construction fails on most browsers (Chrome's hard limit is 6 concurrent contexts), pitch detection silently goes dark, `PitchGrade.pass=false` is recorded, and the affected items get demoted in their Leitner boxes. This corrupts the SRS training record of every user who trains more than 6 rounds in a sitting.
  - **`void hydrateShellStores()` at `+layout.svelte:10` (Iterator 3, Finding 1):** First-load in Safari private browsing fails silently. User sees empty dashboard, believes they have no progress, cannot start a session ("No items are due"). No toast, no banner, no error path.
  - **`await controller.startRound()` unwrapped in `ActiveRound.svelte:45-47` (Iterator 3, Finding 2):** Mid-session mic revocation or a failed AudioWorklet module load produces an unhandled rejection; the UI stays on the start button forever. Full page reload is the only recovery.
- **Confidence:** High for all three. The leak is measured against Chrome's documented 6-context limit; the Safari private browsing failure is a documented IDB behavior; the startRound error path is verified to have no try/catch.
- **Caveats:** None of the three is tested in production by this analysis. We are inferring real-world impact from the code paths. First-use behavior on a Safari private tab has not been manually verified. The AudioContext leak may be partially mitigated on some browsers by context reclamation during GC — unobserved.

### Conclusion 2: C2 cannot begin planning until the six agentic failure archetypes are converted into process guardrails

- **Supporting evidence:**
  - **Iterator 4:** All six archetypes are classified as systemic (not incidental). The re-introduction of `.catch(() => {})` in `session-controller.svelte.ts:345-346` after it was explicitly corrected in PR #76 is empirical proof that agents do not retain memory of prior corrections.
  - **Iterator 1:** Two concrete behaviors (`targetAudio = null`, clock stubs) were intentionally deferred in the plan text with conditional follow-ups, then permanently forgotten because no plan picked up the conditionals.
  - **Iterator 2:** 908 LOC of production-dead code (orchestrator, scheduler, round-adapters) represents three instances of the same archetype: build a pure module, pass its unit tests, never consume it from the app.
- **Confidence:** High for the archetype classification; medium for the claim that guardrails will actually prevent recurrence — guardrails have been proposed but not evaluated against the existing toolchain.
- **Caveats:** Some guardrails (e.g., `@typescript-eslint/no-floating-promises`) may conflict with existing code and require a migration pass before enablement. The pre-dispatch plan-validation step adds review overhead; its cost vs. benefit is untested.

### Conclusion 3: The two spec-commitment violations (interleaving, replay) are not equivalent and should not be batched

- **Supporting evidence:**
  - **Interleaving (Iterator 2 recommendation to wire-in `selectNextItem`):** ~2 hours of work. The existing `selection.test.ts` becomes the regression harness. Today's single-key starter curriculum masks the gap; the first multi-key feature will hit it. Spec §5.2 commits to interleaving; code has none.
  - **Replay (Iterator 1 Finding 1):** "Target" and "Both" modes are deliberately disabled, not broken. The C1.4 plan gave itself the conditional option to enable them and declined. This is a product decision that was made in the weeds of implementation without being surfaced as a product decision.
- **Confidence:** High on the asymmetry. The interleaving fix is mechanical and spec-required; the replay decision is a product call the owner should make explicitly rather than by omission.
- **Caveats:** The interleaving recommendation assumes the 2-hour estimate is accurate — it depends on the controller's `rng` dep and `VariabilityHistory` field being trivially adaptable, which Iterator 2 verified but only at a grep level.

### Conclusion 4: The test suite's 340-test green state materially under-represents the risk surface

- **Supporting evidence:**
  - **Iterator 5:** The two highest-risk defect classes (Svelte `$state` → IDB serialization, DST boundary in streak) are both defects where the existing test infrastructure *cannot* catch them — not defects that escaped review. A `$state` object is structurally-cloned successfully by `fake-indexeddb`'s in-memory clone but rejected by real browsers' structured-clone implementation. `currentStreak()` unit tests pass because they hardcode a single tzOffsetMs; the production caller samples `getTimezoneOffset()` once at render time.
  - **Iterator 2:** The orchestrator and scheduler each have their own integration test suites (`simulated-session.test.ts`, `selection.test.ts`) that exercise the *pure* modules against stub repos. The controller that actually ships has 1–3 round tests. The 30-round sim is covering dead code.
  - **Phase 1 Area 4:** No unit test exercises the complete `startRound() → pitch capture → digit capture → CAPTURE_COMPLETE → grade → persist → next` path in one test. The round reducer is tested in isolation; persistence is tested in isolation; the glue is tested only by the e2e smoke.
- **Confidence:** High. The failures are reproducible at known inputs (DST epoch ms) and architectural in nature (`$state` is not structured-cloneable).
- **Caveats:** We have not yet enumerated all `$state` objects that reach the IDB boundary — PR #101 caught one; there may be others.

### Conclusion 5: CLAUDE.md is two weeks stale and the staleness is load-bearing

- **Supporting evidence:**
  - CLAUDE.md states "Plan C1 · UI + Integration — not yet written." C1 is complete with 13+ PRs merged through PR #101.
  - New implementer agents (fresh-context sonnet) read CLAUDE.md as primary orientation. A new agent dispatched today would believe the app has no UI, no feedback panel, no dashboard — and would plausibly attempt to re-author these components from the spec.
  - The hardcoded Head-of-main commit (`18c6e1d`) is 100+ commits stale.
- **Confidence:** High. Each staleness point is directly verifiable.
- **Caveats:** The staleness has not yet caused an observable agentic failure — no C2 agent has been dispatched. The risk is prospective, not realized.

---

## Gaps in the Analysis

These are genuine unknowns. The Phase 2 iterators did not investigate them, and the owner should not treat the analysis as having answered them.

1. **`focus_item_id = null` end-user impact.** Iterator 2 noted that the controller never recomputes `focus_item_id` — it passes the pre-round value through `complete()`. But whether the `SummaryView` "practice this next" chip (spec §8) actually renders a wrong or missing value, or silently falls back to the first item, was not verified. The correct test is manually reaching the Summary screen after a full session — not done.

2. **DST streak bug: display-only vs data-corrupting?** Iterator 5 proved the math is wrong at DST boundaries for US users. It did not determine whether the wrong streak value is ever *persisted* into the sessions table (making it recoverable only by a re-compute-on-load pass) or whether the bug is purely a render-time miscalculation from correct data (making it recoverable by any future release). The distinction matters for whether existing users will need a data migration.

3. **Accessibility depth.** PR #98 added an axe-core smoke test. It catches WCAG rule violations at render time. It does NOT validate: keyboard-only round completion (start → sing → say digit → advance), screen reader announcement of the grading result ("You sang five, target was five, pass"), focus-trap behavior in the FeedbackPanel modal, or color-blind-safe cyan/amber contrast in the pitch trace. The Phase 2 iterators did not investigate any of these.

4. **Offline end-to-end flow.** The service worker (PR #97) caches the tfjs model and samples. Whether a cold install, go offline, re-open flow actually yields a working session was not verified. Possible failure modes unaudited: `+layout.ts load()` fetching from network, IDB open succeeding in offline mode, the `hydrateShellStores` path under offline conditions, the KWS model load-from-cache path.

5. **Multi-session accumulated behavior.** All controller tests run 1–3 rounds. The dead `simulated-session.test.ts` runs 30 rounds but against dead code. No test runs 50+ rounds against live code with a realistic curriculum growing key-by-key. Items' Leitner box transitions across many sessions, SRS due-date drift, history-entry pruning (if any) — all untested against the live controller.

6. **The "audio stack works" claim is unverified at volume.** The dev harness + the single Playwright smoke test assert that the audio stack loads without throwing. Nothing asserts: YIN detection accuracy on real human voice (vs synthetic sinewaves), KWS digit recognition accuracy across accents, or audio glitch rate under GC pressure at round 10+. These are ML-accuracy questions, not unit-test questions, but they are production-readiness questions.

7. **Bundle-size ceiling headroom.** The 2 MiB client + 50 KiB SW budgets are enforced. Whether C2 features (multi-key curriculum, mobile-specific UI, additional timbres) will fit under that ceiling was not modeled. Iterator 2's "delete 908 LOC of dead code" recommendation recovers some budget but the net is not computed.

8. **Whether `pnpm run typecheck` is actually authoritative under current conditions.** The CLAUDE.md gotcha ("LSP diagnostics lag behind the filesystem") is from prior phases. No iterator verified that the current toolchain (updated typescript-eslint, updated Svelte 5) produces the same clean typecheck on a fresh checkout.

---

## Implications for C2 Planning

The owner is about to plan C2. The findings directly constrain, enable, or make-urgent the following decisions.

### Must be done BEFORE C2 planning begins (not as part of C2)

- **Close the three Production Blockers** (AudioContext leak, `void hydrateShellStores`, `startRound` error swallow). All three are defect fixes, not features. They do not belong in C2's scope — they belong in a pre-C2 correctness pass. If they slide into C2 as tasks 1–3, they will inevitably be interleaved with feature work and one of them will get deferred.
- **Reconcile CLAUDE.md with code state.** Five minutes of edit. Required because C2 implementer agents will read a stale orientation doc. Do this before authoring the C2 plan.
- **Install two of the six guardrails from Iterator 4 that have no migration cost:** (a) CI-environment-parity pre-PR command (`NO_COLOR=1 pnpm run build && pnpm run lint && pnpm run typecheck`) — zero code change, pure process. (b) Pre-dispatch plan-validation grep (every identifier in the plan text exists in source) — can be a dispatcher-agent-level check in the skill. The four guardrails that DO have migration cost (ESLint `no-floating-promises`, JSDoc unit annotations, store-writer audit, plan-amendment loop) should be C2 Task 0 or stretched across C2 phases.

### Must be explicit product decisions made BEFORE C2, not implementation decisions made DURING C2

- **Interleaving scheduler: wire-in or drop the spec commitment.** Iterator 2's 2-hour wire-in is the clean path. If the owner decides not to wire it in, CLAUDE.md and the spec need a written amendment — otherwise the commitment is a lie the codebase tells about itself.
- **Replay modes: ship Target/Both or strike them from the spec.** The C1.4 conditional ("if priority warrants") was never resolved. The owner should decide. If ship: ~1 day of OfflineAudioContext synthesis work. If drop: strike the segmented-toggle UI from the spec's feedback panel description.
- **Focus-item recomputation: ship `pickFocusItem` or strike the "practice this next" chip.** Same shape. The orchestrator's only unique capability (Iterator 2) is `pickFocusItem`. If kept, re-home it into a 30-LOC helper and call from controller's `complete()`. If dropped, remove the chip from the summary mockup.

### Should be C2's explicit first phase, not woven into features

- **Composition/integration test phase.** A single named phase that writes the missing tests Iterator 5 and Iterator 2 prescribe: startRound-to-persist integration test with real `fake-indexeddb`, DST-boundary regression test, `$state → IDB` serialization assertion, 30+-round simulated session against the LIVE controller (adapted from the dead simulated-session.test.ts). This phase converts the dead code's test value into live code's test value.

### Enables (makes possible)

- **Multi-key curriculum expansion.** Once interleaving is wired, adding G major items is a data task, not an architecture task. Until it's wired, expansion forces the wire-in as a blocker.
- **Real user beta.** Once the three Production Blockers are closed, the app is shippable to a small friendly beta. Before: shipping to real users generates corrupted SRS data in the field.

### Forecloses (makes harder or moot)

- **Further reliance on "we have tests, we're good."** The 340-green story is no longer defensible as a correctness argument for the composition path. Any C2 feature that adds to the controller without tests cannot lean on existing coverage.
- **Adding features that read from `focus_item_id` without fixing it.** Any dashboard feature that promises "practice this next" compounds the existing staleness.

---

## Anti-Conclusions (what NOT to conclude)

These claims would be tempting to draw from the evidence but are **not supported** by what Phase 1 and Phase 2 actually established.

1. **"The agentic approach is broken."** No — it produced a working app in 103 PRs with 340 passing tests and caught four bugs via review. The finding is that the approach has known systemic failure modes. The correct response is to add guardrails for those modes, not to replace the approach.

2. **"The app is unusable."** No — the app loads, plays cadences, captures pitch and digits, grades rounds, and persists attempts. Every single user path works in the happy case. The failure modes are edge cases (private browsing, >6 rounds, mic-revoked mid-session, DST boundaries). Saying "unusable" conflates defect severity with defect presence.

3. **"We should delete all the dead code immediately."** No — `selectNextItem` should be wired in, not deleted (spec commitment). The `simulated-session.test.ts` harness should be retargeted, not removed (uniquely valuable). `round-adapters` can be deleted only if their testability value is replicated (see Iterator 2 Section 3 recommendation). Iterator 2's recommendations are NOT "delete all dead code" — they are module-specific.

4. **"The test strategy needs a complete overhaul."** No — the pure-logic test strategy is correct. The gap is specifically at the composition seam, not across the board. Adding 4–6 composition tests closes the risk. Replacing the test suite would destroy the real coverage we have.

5. **"CLAUDE.md staleness proves the documentation system is broken."** No — CLAUDE.md is stale because manual reconciliation was missed, not because the system doesn't have a path to update it. The fix is a process commit ("after each plan completes, revise CLAUDE.md state section"), not a documentation-system overhaul.

6. **"Plan C1 was a failure."** No — C1 shipped the UI, the integration, the PWA, the a11y smoke, the bundle budgets. The failures are localized to: (a) two intentional deferrals that should have been plan-captured (`targetAudio`, clock stubs), and (b) interleaving scheduler bypass. C1 was largely successful with two named gaps.

7. **"The interleaving bypass is a production bug."** No — it's a spec violation masked by the starter curriculum's single-key constraint. Today it produces identical behavior to a wired scheduler. It becomes a runtime bug the moment C2 adds G major. Calling it "production bug" overstates; calling it "latent spec violation" is accurate.

8. **"The 340 tests are worthless."** Explicitly no. Iterator 5 is very clear that the pure-module tests are correct and valuable. The criticism is specifically that no test exercises the composition. Pure module tests remain the correct tool for their layer.

9. **"Auto-fix all the archetypes."** Some guardrails (floating-promises ESLint) will surface dozens of existing violations that will need manual adjudication (some `.catch(() => {})` are genuinely intentional, e.g., cleanup stops). Enablement is not "add one line to ESLint config" — it's a migration project in itself.

10. **"The AudioContext leak is a general AudioContext hygiene problem."** Not established. The leak is specifically the missing `.close()` / `.suspend()` on the native pitch-detection context (the one `CLAUDE.md` notes is separate from Tone's wrapped context). Tone's context is reused across rounds. The fix is specifically for the native pitch context lifecycle.

---

## Blind Spots

Known blind spots in the analysis itself, not in the codebase.

1. **No manual QA pass.** Every finding is static (code read, grep, arithmetic on epoch ms). No one installed the app on a real browser, started a round, revoked the mic, or crossed midnight during a session. A two-hour manual QA pass could confirm or dispute 3–4 findings (focus chip, DST display, startRound recovery, offline install).

2. **No browser compatibility matrix.** Safari, Firefox, Chrome, mobile Safari, mobile Chrome, Samsung Internet — each has different AudioWorklet support, IDB behavior in private mode, and service worker caveats. The analysis assumed "Chrome desktop" and generalized. At least 20% of real users will be on Safari, where several findings may present differently.

3. **No performance profiling.** The dev harness works end-to-end but has no perf data. "Audio-render thread is allocation-sensitive" is a known gotcha in CLAUDE.md; whether the current code actually allocates during `process()` was not verified. Long-running sessions' memory growth is unmeasured.

4. **No prod telemetry.** The app has no analytics/error reporting infrastructure (confirmed: grep for Sentry/Datadog/telemetry returns nothing). We have zero signal from real users. All failure-rate claims are theoretical.

5. **No ML accuracy data.** YIN detection quality, KWS digit accuracy, octave-resilience of `mapHzToDegree` against real voices — all verified only on synthetic inputs. A hobbyist instrumentalist trying to sing "five" with a rough voice or a digit with an accent may get failure rates that unit tests don't capture.

6. **julianken-bot review blind spots inherit.** The review rubric caught 4 real bugs but also has its own dead zones — multi-PR composition bugs, cross-plan invariant violations, anti-features (things built that shouldn't be). The archetype-6 (plan-authored defects) finding is evidence that the review loop has a structural ceiling on what it can catch.

7. **The iterator outputs themselves are single-pass.** No cross-check between Iterator 2's dead-code count (908 LOC) and Iterator 4's archetype-3 examples (PitchNullHint, `_onPitchFrame`, etc.) to see if they're consistent. Possible double-counting or under-counting.

---

## Recommendations

Ordered by criticality × tractability.

1. **CLOSE THE THREE PRODUCTION BLOCKERS as a pre-C2 correctness PR.** Not as C2 Task 1. Before C2 planning. Expected effort: 0.5–1 day. This clears the "the app is shippable" gate.

2. **RECONCILE CLAUDE.md IN FIVE MINUTES.** Mark Plan C1 complete, update Head of `main`, replace "not yet written" with "complete. C2 pending." No C2 work proceeds until done.

3. **DECIDE THREE PRODUCT QUESTIONS EXPLICITLY BEFORE C2:**
   - Wire in interleaving scheduler? (recommend yes, 2 hours)
   - Ship Target/Both replay? (recommend yes, 1 day) OR amend spec
   - Ship focus-item recomputation? (recommend yes, 30 LOC) OR amend spec

4. **INSTALL TWO ZERO-COST GUARDRAILS:** (a) pre-PR CI-parity command, (b) pre-dispatch plan-grep validation. These prevent archetype-1 and archetype-5 recurrences in C2. Do not wait.

5. **WRITE C2 TASK 0: COMPOSITION TEST PHASE.** Before any C2 feature work, write the 4–6 composition tests Iterator 5 prescribes. Convert the dead `simulated-session.test.ts` into a live 30-round controller integration test. This phase's value is that it catches every future regression in the critical path by failing the build.

6. **PLAN FOUR GUARDRAILS WITH MIGRATION COST AS A NAMED C2 TASK:** `no-floating-promises` ESLint enablement + manual audit of all existing `.catch(() => {})` sites, JSDoc unit annotations for time-taking functions, store-writer audit, plan-amendment loop for IMPORTANT/BLOCKER findings.

7. **DO A 2-HOUR MANUAL QA PASS BEFORE C2 LANDS THE FIRST FEATURE.** Install on Safari private window, Chrome, Firefox. Revoke mic mid-session. Cross midnight during a session. Complete a full session and check the Summary's focus-item chip. Three or four findings will flip from theoretical to known-real or theoretical-to-not-applicable.

8. **DEFER (not drop) the broader test-suite redesign** until (5) lands and (1)–(4) prove their value. Iterator 5 is a surgical prescription, not a manifesto. Over-testing the audio stack is the mocking trap CLAUDE.md already warns about.

9. **TREAT THE DEAD CODE NON-UNIFORMLY.** Wire-in `selectNextItem` this week. Delete `round-adapters` only after its testability value is preserved elsewhere. Rewrite `simulated-session.test.ts` to target the live controller. Decide about `createOrchestrator` only after the composition test phase shows whether a pure-orchestrator-plus-reactive-shell refactor is warranted. These are four separate decisions, not one.

10. **REVISIT THE GAPS.** Six of the eight gaps in this synthesis are answerable in under half a day of dedicated investigation. The gap list should itself become the investigation backlog for a pre-C2 sprint.
