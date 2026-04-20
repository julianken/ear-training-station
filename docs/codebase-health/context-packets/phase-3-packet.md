# Context Packet: Phase 3

## Where the Three Syntheses Agree (High Confidence)

**A. The AudioContext leak is the single most consequential finding.**
All three syntheses independently rated it highest severity. Synthesis 1: "deterministic on the happy path — round 7+ grades as pitch-fail, SRS corrupts silently." Synthesis 2: "Severity: critical, Likelihood: certain — data corruption, not UX degradation." Synthesis 3: "crosses from display into SRS data corruption — the only finding that poisons the data model the app exists to produce."

**B. The interleaving scheduler violation is the core product integrity failure.**
Synthesis 1: "structural lie — `selectNextItem()` never imported, five enforcement properties missing." Synthesis 2: "pre-launch blocker — contradicts a named non-negotiable." Synthesis 3: "distinct asymmetry between spec compliance (honored at type level) and operational compliance (violated at runtime)." Wire-in estimated 2 hours across all three.

**C. `void hydrateShellStores()` is a critical, uncovered failure path.**
All three identify this as pre-launch blocker. Synthesis 3 specifically notes it as a gap in the test suite (no integration path covers IDB failure during layout hydration).

**D. Six agentic failure archetypes are systemic and structural guardrails are the fix.**
All three syntheses agree on this framing. Key convergence: `@typescript-eslint/no-floating-promises: error` is the single highest-leverage guardrail (eliminates Archetypes 1+4 at lint time). The `.catch(() => {})` re-introduction after PR #76 is the clearest evidence.

**E. The codebase foundation (core/platform layering, types, tests) is genuinely strong.**
All three note this explicitly. Synthesis 3's anti-conclusions flag that "340 tests are worthless" and "agentic approach is broken" are NOT supported conclusions.

## Where the Syntheses Diverge

**Severity calibration for risks 4-8 (onboarding loop, sessionsRepo split, KWS hang):**
- Synthesis 2 (dissent lens) challenged Phase 2's confidence levels: re-rated risks 4, 5, 6 down from "high likelihood" to "possible" — these require exceptional paths (mid-write IDB failure, inter-session KWS reuse), not the happy path.
- Syntheses 1 and 3 did not explicitly challenge confidence levels.
- **Resolution for Phase 4:** Synthesis 2's calibration is more rigorous. Risk 1 (AudioContext), Risk 2 (void hydration), Risk 3 (startRound), Risk 8 (interleaving) are certain/high likelihood. Risks 4-6 are possible and high-impact if triggered but not on the happy path.

**Treatment of dead code:**
- Synthesis 1: frames as "composition failure" — code built without verifying integration.
- Synthesis 2: frames as an opportunity (orchestrator → delete, selectNextItem → wire-in).
- Synthesis 3: frames as a measurement gap (908 LOC tests give false confidence signal).
- **Resolution for Phase 4:** All three framings are valid and complementary. The final report should carry all three.

## Strongest Conclusions (all three agree, high confidence)
1. AudioContext leak → SRS data corruption is certain on any 10+ round session
2. `selectNextItem` bypass violates the core "no blocked practice" non-negotiable
3. Six agentic archetypes are systemic; `no-floating-promises` ESLint rule is the key guardrail
4. The app should not be opened to real users until AudioContext leak and `void hydrateShellStores()` are fixed
5. Core/platform architecture is a strong foundation; risks are all at the composition seam

## Largest Blind Spots (named across all three syntheses)
- No manual QA walkthrough (no human has done a 10+ round session)
- `focus_item_id = null` user impact unknown (is it rendered in SummaryView?)
- DST bug data corruption scope unknown (display inaccuracy vs actual wrong streak storage)
- Offline/PWA end-to-end flow not verified
- No browser matrix (Safari, Firefox behavior on IDB private mode not tested)

## For Phase 4: Key Tensions to Resolve
1. **"Pre-launch blockers" scope:** Is the replay ("Target"/"Both" disabled) a blocker or a known deferral? Synthesis 2 says blocker (core feature); synthesis 1 says known deferral (explicitly scoped). Phase 4 should take a position.
2. **Order of C2 fixes:** AudioContext first (data integrity) vs interleaving first (product integrity) vs guardrails first (process integrity). Phase 4 should sequence these.
3. **CLAUDE.md staleness:** All three syntheses note it; synthesis 3 calls updating it a "pre-C2 gate." Phase 4 should include it as a named recommendation with priority.

## Artifacts (read if needed)
- `phase-3/synthesis-1.md`: Thematic — 4 themes, core narrative: "structurally correct, compositely broken"
- `phase-3/synthesis-2.md`: Risk/opportunity — risk register with severity/likelihood ratings, 5 blind spots named
- `phase-3/synthesis-3.md`: Gaps/implications — 8 genuine gaps, 10 anti-conclusions, C2 planning implications
