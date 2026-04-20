# Synthesis: Risk and Opportunity Analysis

## Synthesis Approach

This synthesis rates each confirmed risk on a two-axis matrix (**severity** × **likelihood**) and each opportunity on (**effort** × **impact**). Ratings are calibrated by three forces:

1. **Data-integrity primacy.** Risks that silently corrupt the SRS model — the thing the whole app exists to produce — outrank risks that merely degrade UX. A broken button is recoverable; 12 rounds of poisoned mastery data takes weeks to unpoison if the user even notices.
2. **Agentic-build failure mode.** The codebase was assembled by Sonnet subagents under an Opus reviewer. The archetype of bug we expect is NOT logic errors (the bot catches those) but **integration-layer silent failure** — promises not awaited, errors swallowed, resources not disposed. Every confirmed risk fits that archetype. That clustering is itself a signal.
3. **Structured dissent on "high confidence."** Phase 2 labeled all 8 risks "confirmed, high-confidence." I am deliberately NOT inheriting that label. Where Phase 2 asserts confidence, I re-test with: what observation would falsify this? If nothing, the confidence is an artifact of narrative, not evidence.

Blockers are distinguished from post-launch-monitor items by asking: **does a single user session in the wild produce unrecoverable bad state?** If yes, pre-launch. If only UX friction or fixable-with-a-patch drift, monitor.

## Core Narrative

The ear-training-station is a **structurally sound app with a leaky integration seam**. Plan A's pure core is clean. Plan B's audio adapters are hardened. The gap — and every confirmed risk lives in it — is the **app-layer glue**: controllers that wire repos to UI, onboarding that must persist seed state, round loops that must dispose audio resources. This glue is exactly what Plan C1 added, and it is exactly where agentic development has its weakest track record.

The dominant failure mode is not "wrong logic" but "silently correct-looking logic that drops information on the floor when an exceptional path fires." Every confirmed risk is an instance of one of three patterns:

- **Resource not released** (AudioContext per round, KWS stop swallowed) → cumulative drift across sessions
- **Error not surfaced** (`void hydrate`, unguarded `.complete()`, unguarded `onboarding.finish()`) → user sees empty/frozen UI or, worse, a stuck state
- **Wire connected, signal ignored** (Settings injected but unread, `selectNextItem` never called) → feature appears present but does nothing

The first pattern is the most dangerous because it **poisons durable state** (SRS rows). Rounds 1–6 grade honestly; round 7+ silently miscredits pitch failures; the Leitner box regresses based on the miscredit; the next scheduling pass doubles down on a fixed difficulty spike. The user feels "I'm getting worse at 5-hat" and has no way to know the grader cheated them.

The opportunities cluster around a different insight: **almost all these bugs are preventable by a one-line ESLint rule plus a wrapper type**, not by more review or more tests. The `no-floating-promises` rule alone would have caught risks 2, 3, 4, 5, 6 at PR time. The `createCloneVerifyingRepo` wrapper catches the IDB Proxy archetype before it re-ships. The leverage is not "test harder" — it is "make the bad shape unexpressible."

Two unknowns (focus_item rendering, whether real users have poisoned SRS data) need **probes, not speculation**. They are listed as recommendations, not rated risks, because rating them without evidence would be the exact kind of confidence inflation this synthesis is supposed to resist.

## Risk Register

### Risk: AudioContext leak → Chrome throttle → silent SRS corruption

- **Severity: critical**
- **Likelihood: certain**
- **Evidence:** Phase 2 reports AudioContext created per round, never closed. Chromium ships a hard throttle at ~6 undisposed contexts per tab (see Chromium issue tracker, `AudioContext` counter). After the cap, new-context creation resolves but decode/render paths are silently degraded; pitch-detector input becomes unreliable, and `gradePitch` will read low-confidence frames as failure. **Dissent check:** could this be wrong? Only if (a) Chrome changed the behavior since last tested, or (b) the code actually reuses one context per session. The context packet asserts the opposite. Assign "certain" if a single session reaches round 7; assign "likely" if median session length is under 6 rounds. Per the spec, target session length is 15–30 rounds, so "certain" holds for real users.
- **Mitigation:** Single long-lived `AudioContext` at app startup, shared across rounds via the existing `ensureAudioContextStarted()` abstraction in `@ear-training/web-platform/audio/player`. The platform already has the seam; the app layer just has to stop creating new ones. Pair with a runtime guard that logs if the live-context count exceeds 1. Pre-launch blocker.

### Risk: `void hydrateShellStores()` → silent zero-state app

- **Severity: high**
- **Likelihood: likely**
- **Evidence:** Phase 2 flags `void hydrateShellStores()` as fire-and-forget. IDB failures on first load (Safari private mode, quota-exceeded, schema-mismatch after a dev version-bump) will reject the promise; `void` discards it; the app renders with empty stores. The user sees a dashboard with zero items and no error. **Dissent check:** the "Safari private" path is a real class of failures but is not universal — most users are on Chrome. Severity is high (not critical) because the failure is recoverable (retry, reinstall) and does not corrupt persistent state. Likelihood is "likely" not "certain" because Chrome desktop default storage is generous; the hit rate will be dominated by Safari+iOS cohort.
- **Mitigation:** Replace `void hydrate()` with `await hydrate()` inside an `onMount` that sets an `appState.ready` flag. Render an error state with retry CTA if the promise rejects. Pre-launch blocker if iOS Safari is a supported platform.

### Risk: `startRound()` errors swallowed → dead button

- **Severity: high**
- **Likelihood: likely**
- **Evidence:** Phase 2 states the start-round path doesn't surface worklet-load failure or mic-permission denial. User clicks "Start" and nothing happens. **Dissent check:** is this the same bug as the AudioContext leak? No — this fires on the exceptional path (denied perms, blocked worklet), not the happy path. Severity is "high" not "critical" because no durable data is corrupted; the session simply doesn't start. Likelihood is "likely" because the mic-permission denial is a **first-run event for every new user on iOS Safari**, and Chrome on HTTP origins. The first-click failure rate in the field will be non-trivial.
- **Mitigation:** Wrap `startRound` in try/catch; route the error to a UI surface (banner or modal) that distinguishes mic-denied (link to settings), worklet-failed (reload suggestion), and network-failed (KWS model fetch). Pre-launch blocker.

### Risk: `.catch(() => {})` on KWS stop → stuck recognizer

- **Severity: high**
- **Likelihood: possible**
- **Evidence:** Phase 2 notes this was re-introduced after the PR #76 fix. The KWS `stop()` path swallows errors silently, and the idempotent-cache design means the next `startKeywordSpotter` call with the same thresholds returns the cached but stale-state instance. Digit recognition hangs for the rest of the session. **Dissent check:** Phase 2 asserts "next session digit recognition hangs" as certain, but the KWS cache is process-lifetime, not session-lifetime — a page reload resets it. Likelihood is "possible" (per-session, not per-reload) unless users run long multi-session workouts without reloading. The original PR #76 fix was correct; reintroduction suggests a mis-merge, not a design flaw.
- **Mitigation:** Re-apply the PR #76 pattern; add a lint rule banning `.catch(() => {})` literal (trivial to detect with ESLint). Add a regression test that asserts `stop()` throws on the simulated failure path. Pre-launch blocker if the path can recur inside one user session; post-launch monitor if only inter-session.

### Risk: `onboarding.finish()` unguarded → stuck/unseeded user

- **Severity: critical**
- **Likelihood: possible**
- **Evidence:** Phase 2 flags `onboarding.finish()` as having no error guard. An IDB failure during seeding leaves the user either (a) stuck in onboarding (settings flag not set) or (b) past onboarding but with no curriculum (flag set, items write failed). Case (b) is the dangerous one — user lands on an empty dashboard with no obvious remedy. **Dissent check:** how often does IDB fail mid-transaction? Rare on the happy path but not rare at the tail — quota changes, browser crash mid-write, extension interference. Severity is "critical" because it's a **first-impression-destroying state** that cannot be self-recovered without knowing about devtools → clear storage. Likelihood is "possible" not "likely" because IDB mid-write failures require specific conditions.
- **Mitigation:** Wrap `finish()` in a transaction; atomic set-flag-AND-seed-items, or neither. If transactional-IDB feels heavy, at minimum check-and-repair on next load: "flag says onboarded but zero items exist → re-seed." Pre-launch blocker for launch credibility.

### Risk: `sessionsRepo.complete()` unguarded → in-memory/DB split

- **Severity: medium**
- **Likelihood: possible**
- **Evidence:** Phase 2 notes that session completion updates in-memory state regardless of DB persistence outcome. User finishes a session; DB write fails; in-memory says "done" but next load shows session still active. The user re-does the session (minor annoyance) or sees inconsistent summary stats. **Dissent check:** why is this medium, not high? Because the failure mode is recoverable and visible — the user notices "didn't I just finish this?" The SRS data from the session is stored per-attempt, not per-session-completion, so the underlying mastery model is unaffected. The failure is a UX split, not a data-integrity event.
- **Mitigation:** Await completion; if it rejects, keep the session in a "pending sync" state with a retry CTA. Do not flip in-memory to done until persistence succeeds. Can ship with logging-only and monitor hit rate in production.

### Risk: Settings injected but never read → cosmetic Settings UI

- **Severity: high**
- **Likelihood: certain**
- **Evidence:** Phase 2 confirms confidence thresholds and auto-advance are hardcoded despite Settings plumbing. The Settings screen exists (flow-12 screenshot in repo root), user changes values, nothing happens. **Dissent check:** is this a risk or a missing feature? It is a *risk* because the user-visible promise of "configurable" is violated; reputation damage on discovery is disproportionate to the code fix. Severity is "high" because the credibility cost of shipping fake settings is non-linear — one reviewer tweet about "settings that don't do anything" outweighs the value of the feature.
- **Mitigation:** Either (a) remove the Settings UI until it's wired, or (b) wire the read path through the controller. Option (b) is 1–2 hours given the repos are already injected. Pre-launch blocker on credibility grounds.

### Risk: `selectNextItem` never called → blocked practice instead of interleaving

- **Severity: high**
- **Likelihood: certain**
- **Evidence:** Phase 2 confirms the interleaving module exists, is tested (9 tests), but is not called from the session controller. Rounds cycle through one item repeatedly, or follow insertion order, violating the non-negotiable design commitment from the spec: "**Interleaving + Leitner SRS** for scheduling. No blocked practice." **Dissent check:** the CLAUDE.md explicitly lists this as a non-negotiable. The spec is the source of truth. This isn't a close call — the shipping build violates a stated non-negotiable. Severity is "high" because the product IS the scheduling algorithm for this user; blocked practice is literally what the research synthesis argues against.
- **Mitigation:** Wire `selectNextItem` into the round-start path. Per Phase 2, estimated 2 hours. Pre-launch blocker on spec-fidelity grounds.

## Opportunity Matrix

### Opportunity: Add `@typescript-eslint/no-floating-promises: error`

- **Effort: hours**
- **Impact: critical**
- **Evidence:** Phase 2 identifies this as a single-rule ESLint change that would catch 5 of the 8 risks (2, 3, 4, 5, 6) at PR time. The project already runs ESLint in CI (`ci-lint.yml`) with typescript-eslint. Enabling the rule in `eslint.config.js` is a one-line change plus a one-pass fix of existing violations. **Dissent check:** why isn't this already enabled? Likely because it was not default in the initial config and nobody revisited. The cost is a one-time cleanup of intentional void-promises (spot-check: maybe 5–15 sites); after that, the rule pays forever. Impact is "critical" because it shifts an entire bug class from "find in review or prod" to "can't merge."

### Opportunity: Wire `selectNextItem` + interleaving

- **Effort: hours**
- **Impact: critical**
- **Evidence:** Module exists, 9 tests pass, integration point is known. 2-hour estimate from Phase 2. **Dissent check:** what could go wrong in 2 hours? The usual hazard is that wiring the scheduler exposes a second bug — e.g., attempt persistence isn't happening (per MEMORY.md `project_controller_persistence_gap.md`), so the scheduler has no history to interleave on. Effort could expand to a day if the persistence gap must be closed first. Still, the unit of work is small and unblocks a non-negotiable design commitment.

### Opportunity: `createCloneVerifyingRepo` wrapper

- **Effort: hours**
- **Impact: high**
- **Evidence:** Phase 2 says design is specified. The IDB-Proxy-mutation archetype has already shipped once; the wrapper is the surgical fix. **Dissent check:** is the wrapper pattern worth the indirection vs. just disciplined `structuredClone` at read sites? The wrapper wins because it makes the bad shape unexpressible at the type level — you literally cannot read an IDB row without going through the clone path. That's the leverage pattern. Impact is "high" not "critical" because the bug class has been seen once and fixed; this is preventing regression, not stopping an active bleed.

### Opportunity: Surface hydrate/startRound/onboarding errors with a single error store

- **Effort: days**
- **Impact: high**
- **Evidence:** Three of the risks (2, 3, 5) share the same remediation shape: an error-surface UI + a shared error store + wiring from the failing callsite. Building one and applying it to three callsites is cheaper than three one-offs. **Dissent check:** why days, not hours? Because it involves UI design (banner vs. modal vs. toast), i18n/copy, and dismissal behavior — small things that add up. Worth doing once properly so C2 inherits the pattern.

### Opportunity: Test a 15-round session end-to-end under Playwright

- **Effort: days**
- **Impact: critical**
- **Evidence:** The existing Playwright smoke test is 1 test, ~3s — covers initial render but not multi-round state. A 15-round test (even with audio mocked) would catch the AudioContext leak empirically (by counting active contexts), the KWS stop leak (by asserting digit recognition still fires on round N+1), and scheduler violations (by asserting item variety). **Dissent check:** isn't this expensive to build? Yes, but the cost is one-time; the payoff is a permanent regression guard against the exact archetype of bug this codebase ships. Impact is "critical" because without it, the next AudioContext-leak-equivalent bug ships unnoticed.

### Opportunity: Leverage julianken-bot review but add pre-PR guardrails

- **Effort: hours**
- **Impact: high**
- **Evidence:** Phase 2 observes the bot already catches all 6 archetypes; the gap is pre-PR. Adding guardrails (ESLint rule, type wrappers, mandatory Playwright-multi-round) shifts the cost to the implementer subagent, which is cheaper than Opus review cycles. **Dissent check:** does adding guardrails slow implementers down? Slightly, but the saved round-trips (fewer review loops for floating-promise bugs) pay it back within one plan.

### Opportunity: Consolidate AudioContext lifecycle into a single owned resource

- **Effort: hours**
- **Impact: critical**
- **Evidence:** Fix for risk 1. The `@ear-training/web-platform/audio/player` already has `ensureAudioContextStarted()`. The app layer needs to stop creating parallel contexts. **Dissent check:** why hours and not a day? Because the abstraction exists; the work is (a) auditing all `new AudioContext` / Tone.getContext callsites, (b) routing them through the single source, (c) adding a runtime invariant log. Impact is "critical" because it stops the durable-data-corruption bleed.

### Opportunity: Strengthen spec-fidelity checks in CI

- **Effort: days**
- **Impact: medium**
- **Evidence:** The Settings-ignored and scheduler-bypassed risks both violate stated commitments. A "spec-fidelity" test file (`tests/spec-fidelity/*.test.ts`) that asserts "`selectNextItem` is invoked at least once per session" and "a Settings change mutates the controller's active threshold" would prevent this class. **Dissent check:** impact is "medium" not "high" because these tests are structural — they catch the specific violations, not the category. The ESLint rule and multi-round Playwright are higher-leverage.

## Blind Spots

1. **Have real users' SRS rows already been poisoned?** The AudioContext bug has been shipping. If Plan C1 has been in users' hands (even friend-testers), their IDB has bad attempts. Listed as unknown in the packet; this synthesis cannot rate it without a probe. **Recommendation:** query one real device's IDB for `attempts` rows with `outcome === 'pitch_fail'` where `cents_off > 300` (implausibly bad) and see if they cluster at round index ≥ 7. If yes, the corruption is confirmed historic and a migration is needed (mark those rows as `corrupt: true`, recompute mastery).

2. **SummaryView `focus_item_id` rendering.** Packet flags it as unknown. If the field is null in production and renders a broken chip, that's a silent-UI risk. If it renders a "no focus item" empty state, it's fine. **Recommendation:** 10-minute DOM probe, not a speculative risk entry.

3. **What isn't in Phase 2 but might be real:**
   - **Memory leak in pitch-detector AudioWorklet** — the CLAUDE.md warns about scratch-buffer allocation. Has every new worklet added since followed that discipline? No audit was done in Phase 2.
   - **Service worker cache bust on KWS model update** — PRs #97 added the SW. If the KWS model URL changes and the SW serves the stale one, digit recognition degrades silently. No mention in Phase 2.
   - **IndexedDB version upgrade** — any schema evolution triggers `onupgradeneeded`. If the app ships with a bump but no migration path, users with existing data are stuck. Pre-C1 fix (PR #30) addressed one instance; has another accreted?
   - **Variability "locked" paths** — the settings bridge decision kept `lockedTimbre/lockedRegister: null`. If a user ever sets a lock, does anything read it? If not, same cosmetic-setting archetype as risk 7.
   - **Dashboard mastery calculations under empty history** — `masteryByDegree` on an item with zero attempts; does it divide by zero, return NaN, render "NaN%"? This is the Phase 2 analytics rollup module; unit-tested, but UI integration not verified.

4. **Phase 2 confidence inflation.** The packet labels 8 risks as "confirmed, high-confidence." Three of them (risks 4, 5, 6) are actually "possible" on my re-read because they require specific exceptional paths. The packet's habit of flattening confidence is itself a synthesis-process risk — Phase 3 should be the calibration layer.

5. **The "2 hours" estimates.** Phase 2 gives 2-hour estimates for multiple fixes. Implementation subagent history on this repo suggests 2-hour estimates run 3–5 hours in practice once the review loop is counted. Don't plan-capacity against the raw estimates.

## Recommendations

**Pre-launch blockers (ship-stopping):**

1. Fix AudioContext lifecycle (risk 1) — **critical × certain, hours of work**
2. Wire `selectNextItem` (risk 8) — **high × certain, hours**
3. Wire Settings reads (risk 7) — **high × certain, hours**
4. Guard `onboarding.finish()` with check-and-repair (risk 5) — **critical × possible, hours**
5. Surface `startRound` errors (risk 3) — **high × likely, half-day**
6. Await `hydrateShellStores()` with error state (risk 2) — **high × likely, hours**

**Merge before next plan (infrastructure hardening):**

7. Enable `@typescript-eslint/no-floating-promises: error` — **hours, prevents 5 archetype bugs**
8. Re-apply PR #76 KWS stop fix + lint-ban `.catch(() => {})` literal (risk 4) — **hours**
9. Add multi-round Playwright test that asserts AudioContext count and scheduler variety — **days, permanent guard**

**Post-launch monitoring (ship with logging, watch metrics):**

10. Guard `sessionsRepo.complete()` with pending-sync state (risk 6) — **hours, low-severity-enough to ship with logging**

**Probes needed before finalizing synthesis (unknowns → knowns):**

11. Query production IDB for suspect `attempts` rows to confirm/deny historic corruption
12. DOM-probe SummaryView `focus_item_id` render state
13. Audit new AudioWorklet additions for scratch-buffer discipline
14. Verify SW cache strategy against KWS model versioning
15. Test `masteryByDegree` → UI path with zero-attempt items

**Process recommendation:**

The bot-review-catches-everything observation is correct but incomplete. The next plan should add **pre-PR structural guardrails** (lint rules, type wrappers, Playwright multi-round) so the bot is no longer the single point of catch. The bot's value is qualitative (archetype pattern recognition); guardrails should handle the quantitative (floating promises, untyped IDB reads). Splitting the work by who's good at what is the leverage move.
