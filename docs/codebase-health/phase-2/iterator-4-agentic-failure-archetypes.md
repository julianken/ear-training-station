# Iteration: Agentic Development Failure Archetypes

## Assignment
Classify all bugs caught by julianken-bot reviews into failure archetypes, assess which are still present, and identify which are systemic vs incidental.

## Findings

### Archetype 1: CI/Build Broken at Submission
- **Evidence:** 8 PRs caused hard CI red at submission — PRs #11, #12, #34, #70, #72, #87, #90, #97. Sub-bugs: ANSI codes under CI=true (#34), SvelteKit sync prefix missing (#72), harness HTTP 500 in e2e webServer (#70), prod build broken by virtual module import (#97), unused import causing lint red (#90).
- **Confidence:** High
- **Still present:** No — CI is currently green, all checks pass.
- **Classification:** Systemic — agents lack CI environment parity and self-author their verification checklists.
- **Proposed guardrail:** Require `NO_COLOR=1 pnpm run build && pnpm run lint && pnpm run typecheck` as mandatory pre-PR commands. Specifically reproduces the CI env.

### Archetype 2: Clock/Time Domain Confusion
- **Evidence:** PR #82 (AC-seconds vs wall-clock ms in PitchTrace, stray `* 1000`); PR #72 (UTC midnight vs local day in StreakChip); PR #81 (naming convention set bad precedent).
- **Confidence:** High
- **Still present:** Partially — `StreakChip` fix is correct but DST crossover still under-tested. `ActiveRound.svelte:17-22` clock stubs produce broken pitch trace visualization (confirmed via arithmetic: `Date.now()` vs `windowStartMs=0`).
- **Classification:** Systemic — `number` doesn't encode unit; mocks hide domain-boundary bugs in tests.
- **Proposed guardrail:** JSDoc `@param {number} nowMs` / `@param {number} acTime` on all time-taking functions. CLAUDE.md instruction: never mix `Date.now()` and `AudioContext.currentTime` in the same arithmetic expression without an explicit unit conversion.

### Archetype 3: Dead/Unreachable Code Shipped as Features
- **Evidence:** PR #86 (PitchNullHint rendered with no writer for `consecutiveNullCount`); PR #93 (`_onPitchFrame` mislabeled as test-hook, would have broken production); PR #85 (anti-repeat filter compared wrong field). Plus post-C1: `createOrchestrator` (166 LOC, zero app imports), `selectNextItem` (82 LOC, zero app imports), `round-adapters` (8 passing tests, production unused).
- **Confidence:** High
- **Still present:** Partially — PitchNullHint now wired. Dead orchestrator + scheduler + round-adapters remain (Iterator 2: 908 LOC of production-dead code).
- **Classification:** Systemic — single-PR scope prevents cross-PR dependency audits; agents don't verify that new store consumers have existing writers.
- **Proposed guardrail:** Before any PR introducing a new store consumer: grep for writer(s). Zero writer hits = ship the writer first.

### Archetype 4: Async Rejection Silently Swallowed
- **Evidence:** PR #15 (KWS stop race), PR #76 (`.catch(() => {})` on stop handles — IMPORTANT, fixed), PR #88 (counter advanced on IDB failure — IMPORTANT), PR #86 (void next/startRound chain). Current: `void hydrateShellStores()` in `+layout.svelte:10` (CRITICAL, no mitigation). Re-introduced `.catch(() => {})` at `session-controller.svelte.ts:345-346` — same pattern as PR #76.
- **Confidence:** High
- **Still present:** Yes — two live instances: naked `void` on layout hydration, `.catch(() => {})` re-introduced in session controller.
- **Classification:** Systemic — `void` is the default path of least resistance in reactive Svelte contexts; mocked tests never surface IDB rejections.
- **Proposed guardrail:** `"@typescript-eslint/no-floating-promises": "error"` in ESLint config. Forces every `void` to be a conscious override with justification.

### Archetype 5: Plan Text Diverging from Actual API Shapes
- **Evidence:** PR #57 (9 wrong type literals across 4 plans: `Accuracy` shape, `'EarTrainingDB'` DB name, non-existent `ChordEvent` fields); PR #70 (e2e fixture used wrong schema, wrong bundle path); PR #93 (e2e seed order wrong, test-hook mislabeling).
- **Confidence:** High
- **Still present:** No active bugs from this archetype, but `e2e/helpers/app-state.ts` manually duplicates IDB schema with "keep in sync" comment and no drift detection — same class of risk.
- **Classification:** Systemic — plans age from the moment written; verbatim implementation propagates drift.
- **Proposed guardrail:** Pre-dispatch plan validation: grep every identifier, type name, and DB/store name in the plan against actual source. Flag zero-match identifiers before implementation begins.

### Archetype 6: Plan-Authored Defects Faithfully Propagated by Implementer
- **Evidence:** PR #11 (tfjs v4 dependency prescribed in plan — BLOCKER); PR #25 (octave-invariance bug in grade-pitch — "plan-controlled"); PR #85 (anti-repeat filter compared `focus_item_id` — "IMPORTANT plan-controlled bug"); PR #59 (`Date.now()` placeholder in attempt records — plan-controlled).
- **Confidence:** High
- **Still present:** Partially — specific fixes landed, but DST offset at render-time (Iterator 5) is a plan-controlled decision still producing wrong behavior for US users.
- **Classification:** Systemic — implementer agents treat the plan as the specification; bugs in the plan become bugs in the code with no additional signal.
- **Proposed guardrail:** Plan-controlled IMPORTANT/BLOCKER findings require a plan-amendment commit before the implementation PR can be re-reviewed. Currently this loop exists only for SUGGESTION severity.

## Resolved Questions
- All 6 archetypes are systemic — none are incidental to this project's specific setup
- The re-introduction of `.catch(() => {})` (Archetype 4) in `session-controller.svelte.ts:345-346` after it was explicitly fixed in PR #76 confirms agents don't retain memory of prior corrections — the pattern will recur in C2 without a structural guardrail (ESLint rule)

## Remaining Unknowns
- Whether any of the 6 proposed guardrails conflict with existing ESLint/TypeScript configs in the project

## Revised Understanding
All recurring failure modes are structural properties of agentic development, not one-off mistakes. They require process guardrails — linting, plan validation, store-writer audits — not more review cycles. The julianken-bot review infrastructure catches them after the fact; the guardrails proposed here prevent them before the PR opens.
