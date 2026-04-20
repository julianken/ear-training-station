# Context Packet: Phase 2

## Key Findings (thematic, ordered by impact)

### Theme A: Intentional Deferrals That Became Permanent
1. `targetAudio` was explicitly scoped out of MVP with "follow-up in C1.4 if priority warrants" — C1.4 never picked it up. "Target" + "Both" replay permanently disabled. **Deliberately deferred, not a bug. Needs a named C2 task.**
2. Clock stubs (`windowStartMs=0`) were labeled "Task 6 wires real values" — but Task 6's implementation steps never included the `ActiveRound.svelte` update. The mechanism exists (`PlayRoundHandle.targetStartAtAcTime`); the wiring was skipped. **Plan authoring gap, not a code bug. One-hour fix.**

### Theme B: Production-Dead Code (908 LOC)
3. `createOrchestrator` (166 src + 424 test LOC) — parallel reimplementation of session controller, production-dead. **Critical finding: `pickFocusItem()` is in the orchestrator and has NO controller equivalent** — `focus_item_id` is never set in production, meaning the summary "practice this next" feature is silently broken.
4. `selectNextItem` + interleaving module (82 src LOC) — the spec's interleaving guarantee. Wire-in cost: ~2 hours. Delete cost: ~30 min but abandons the core pedagogical design.
5. `round-adapters` (134 src + 8 test LOC) — recommended: delete. The two-clock problem it solves is now handled inline.

### Theme C: Four Critical Silent Failures (confirmed, no mitigation)
6. `void hydrateShellStores()` — triggers in Safari private mode, Firefox strict privacy, quota exceeded. User sees zero data with no error message. **No existing mitigation.**
7. `startRound()` error swallowing — mic revoked, AudioContext fail, worklet load error → button click produces nothing. The FeedbackPanel `onNext` path IS protected; only the initial start button is not.
8. AudioContext created per round, never closed — **deterministic failure at round 7** in a 30-round session. Chrome returns suspended context that never processes audio; SRS accumulates incorrect failure data. No `AudioContext.close()` anywhere in the codebase.
9. `.catch(() => {})` re-introduced on KWS stop — same pattern fixed in PR #76, now back. KWS stop failure can cause next session's digit recognition to hang forever. Partially mitigated by catch in `startKeywordSpotter` that degrades gracefully — but root cause is never logged.

### Theme D: Systemic Agentic Failure Patterns (all 6 are systemic)
10. Six recurring archetypes confirmed: CI env parity, clock domain confusion, dead unreachable code, async swallowing, plan-API drift, plan-authored defects. All will recur in C2 without structural guardrails. Key guardrail: `"@typescript-eslint/no-floating-promises": "error"` catches Archetypes 1+4.

### Theme E: Test Strategy Gaps
11. `sessionsRepo.complete()` at controller lines 291/310 passes reactive state without `$state.snapshot()` — currently safe (Session is all primitives) but one schema addition breaks it silently. **Fix: `createCloneVerifyingRepo` wrapper in all integration tests.**
12. DST bug is in the caller (`StreakChip`), not `currentStreak()`. Concrete spring-forward test: sessions spanning Mar 7→8 2026 EST→EDT boundary. Fix: capture `tz_offset_ms` at session start; optional field, no IDB version bump needed.

## Confidence Levels

**High confidence (direct code evidence):**
- All Theme A (plan text + code confirmed)
- All Theme B (grep confirms zero app imports)
- All Theme C (iterator 3 walked exact failure paths)
- All Theme D (PR corpus + current code verified)

**Medium confidence:**
- DST test exactness (arithmetic confirmed but not run against live code)
- `pickFocusItem` broken in prod (confirms `focus_item_id = null` pattern in controller; summary screen behavior depends on whether it actually renders the field)

## Contradictions & Open Questions

1. **Is `pickFocusItem` / `focus_item_id` actually used in the summary screen?** If `SummaryView.svelte` never renders it, the silent null is harmless. If it does render, users see wrong or empty "practice this next" data. Synthesizers should check `SummaryView.svelte` for this field.
2. **Does the `AudioContext` Chrome throttle produce a hard silent failure, or a degraded experience?** Iterator 3 confirmed: suspended context = worklet never fires = pitches grade as fail = SRS corruption. This escalates the AudioContext leak from UX degradation to data integrity issue.
3. **Is `selectNextItem` a C2 hard requirement or a nice-to-have?** Wire-in is 2 hours. Without it the "no blocked practice" non-negotiable is violated. Synthesizers should assess whether this is a C2 blocker.

## Artifacts (read only if needed)
- `phase-2/iterator-1-deferred-vs-forgotten.md`: Plan text evidence for targetAudio + clock stub decisions
- `phase-2/iterator-2-dead-code-map.md`: LOC counts, pickFocusItem gap, wire-in vs delete recommendations
- `phase-2/iterator-3-silent-failure-blast-radius.md`: Confirmed trigger conditions for 4 critical failures
- `phase-2/iterator-4-agentic-failure-archetypes.md`: 6 systemic archetypes + proposed guardrails
- `phase-2/iterator-5-test-strategy.md`: createCloneVerifyingRepo design + DST test epochs + session schema change
