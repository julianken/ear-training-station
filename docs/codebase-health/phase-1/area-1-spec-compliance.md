# Investigation: Spec Compliance & UI Fidelity

## Summary

The 6 core non-negotiable design commitments are largely honored at the component level — color tokens, sing-and-verify grading, Leitner SRS wiring, and the split-stage session screen are all present. However, five significant spec deviations exist that undermine the product's value proposition: the interleaving scheduler is never called in production, the "Target" and "Both" replay modes are permanently disabled, the pitch trace visualization is broken by a clock domain stub, and the Session Summary and replay speed toggle are incomplete. The UI is structurally correct but functionally incomplete in ways that would be immediately noticeable to a user.

## Key Findings

### Finding 1: Interleaving scheduler bypassed in production
- **Evidence:** `session-controller.svelte.ts:305-307` — item selection is `dueNow.find(i => i.id !== justPlayed) ?? dueNow[0]`. `selectNextItem()` in `packages/core/src/scheduler/selection.ts` is never imported by any app file.
- **Confidence:** High — grep confirms zero app-level imports of `selectNextItem`
- **Implication:** The non-negotiable "interleaving + Leitner SRS, no blocked practice" commitment is violated. Users will receive items in lowest-ID order, not weakness-weighted interleaved order. This is the core pedagogical failure.

### Finding 2: "Target" and "Both" replay always disabled
- **Evidence:** `session-controller.svelte.ts:67` initializes `targetAudio = null`; reset in `next()` at line 327-328. No assignment anywhere. `ReplayBar.svelte:74-105` disables Target and Both buttons when `targetBuffer` is null.
- **Confidence:** High — full grep of `targetAudio` shows only initialization and reset, never assignment
- **Implication:** The F2 segmented-toggle replay — explicitly named in spec §9.3 as required — works for "You" only. Two of three modes are permanently disabled.

### Finding 3: Pitch trace visualization broken by clock domain mismatch
- **Evidence:** `ActiveRound.svelte:17-22` stubs `windowStartMs = 0` and `getNowMs = () => 0`. Pitch frames use `at_ms = Date.now()` (~1.7 trillion). `timeToX` computes `(1.7e12 - 0) / 5000` → exceeds width 480px, all frames clamp to rightmost pixel.
- **Confidence:** High — arithmetic confirms the visual result
- **Implication:** The split-stage scrolling pitch trace (spec §7, §9.2) never scrolls. All frames appear as a dot at the far right. The y-axis also always returns `targetDegree` regardless of actual pitch (`PitchTrace.svelte:58-61`).

### Finding 4: Session Summary missing degree movement and tomorrow's focus
- **Evidence:** `SummaryView.svelte:23-41` shows title, session meta, and two stats (Pitch, Label). Spec §9.5 requires three stats + "Movement by degree" card + "Tomorrow's focus" highlight box.
- **Confidence:** High
- **Implication:** The Summary screen is a stub — 60% of its required content is absent.

### Finding 5: `selectNextItem` bypasses settings (confidence thresholds, auto-advance)
- **Evidence:** `session-controller.svelte.ts:26` declares `settingsRepo` dep but never reads it. Lines 182 and 263 hardcode `minPitchConfidence: 0.5`, `minDigitConfidence: 0.5`. Line 186-188 auto-advances regardless of `auto_advance_on_hit` setting.
- **Confidence:** High
- **Implication:** The Settings UI is cosmetically functional but has no effect on the running session. Changing confidence thresholds does nothing.

## Confirmed (working correctly)

- Color tokens: exact spec values (`--bg: #0a0a0a`, `--cyan: #22d3ee`, `--amber: #fbbf24`) at `packages/ui-tokens/src/tokens.css`
- Cadence-first: `startRound()` always calls `buildCadence()` before `buildTarget()`
- Sing-and-verify: `gradeListeningState()` grades both pitch frames and digit label; FeedbackPanel shows separate ✓/✗ badges
- Leitner SRS: `buildAttemptPersistence()` computes next box correctly at `session-controller.svelte.ts:118-121`
- Variability: `_pickVariability()` calls `pickTimbre()` and `pickRegister()` with history tracking
- Streak chip: `StreakChip.svelte` calls `currentStreak()` from core rollups
- No gamification: zero XP, confetti, or Duolingo mechanics found
- Onboarding: 4-step gate with real warmup round at `{ key: 'C', degree: 5 }`

## Surprises

- The `selectNextItem()` function was built, tested (9 tests), and then completely bypassed by C1
- `PitchTrace.hzToVisualDegree()` always returns `targetDegree` — the y-axis is a no-op stub despite the function existing with a body
- `ReplayBar.svelte` creates its own `AudioContext` per play, violating the "same AudioContext for Both" requirement in the C1 design spec

## Unknowns & Gaps

- Whether `auto_advance_on_hit` was intentionally deferred or accidentally omitted
- Whether the speed toggle (1×/½×) was planned for a later task or forgotten
- Whether chord block animation (cadence start time wiring) was in any C1 task

## Raw Evidence

- Files read: `session-controller.svelte.ts`, `ActiveRound.svelte`, `PitchTrace.svelte`, `ReplayBar.svelte`, `SummaryView.svelte`, `DashboardView.svelte`, `FeedbackPanel.svelte`, `StepWarmupRound.svelte`, `+layout.ts`, `packages/core/src/scheduler/selection.ts`, `packages/ui-tokens/src/tokens.css`
- Spec: `docs/specs/2026-04-14-ear-training-mvp-design.md`
- C1 design spec: `docs/specs/2026-04-16-plan-c1-ui-integration-design.md`
