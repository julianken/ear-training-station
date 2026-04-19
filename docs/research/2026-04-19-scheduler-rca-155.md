# RCA — #155 Scheduler returns null mid-session

- **Date:** 2026-04-19
- **Issue:** [#155](https://github.com/julianken/ear-training-station/issues/155)
- **Author:** Claude Opus (fresh-context RCA agent)

## Abstract

The bug is **not reproducible** through the scheduler. `selectNextItem` is
mathematically sound for the input the probe reported (28 items across 4 keys
× 7 degrees, 6-round history). A systematic search across 5,000 random
histories (length 0..20) against the same 28-item pool never returns null;
neither does a controller-driven repro that exercises the production `next()`
code path with the probe's exact history. The observed symptom —
`completed_items: 6`, `ended_at` set, summary renders "Done. · 6 rounds"
despite `target_items: 15` — **is produced deterministically by a different
mechanism**: the `refresh-abandon` auto-complete in
`apps/ear-training-station/src/routes/scale-degree/sessions/[id]/+page.ts:25`,
which calls `sessions.complete` on any load where `isReload === true` and
`session.ended_at == null`. The probe misattributed the symptom to the
scheduler because all three session-completion paths produce identical
terminal state. No scheduler fix is needed. The advisory recommendation is to
make the refresh-abandon path visible (log or distinguish "abandoned" vs
"completed" in the summary) and to pursue [#157](
https://github.com/julianken/ear-training-station/issues/157) so that a
reload RESUMES rather than abandons.

## Reproduction

### Repro'd via scheduler? **No.**

- `packages/core/tests/scheduler/rca-155-repro.test.ts` — five tests:
  - Probe state (28 items, 6-round history) x 1,000 rng trials → 0 nulls.
  - Same with 6 items marked `learning` (post-round realistic shape) → 0 nulls.
  - Random-history stress (5,000 trials, history length 0..20) → 0 nulls.
  - Sanity null cases (single-key saturation) confirm the null-return
    machinery still works when it _should_ return null.
- `apps/ear-training-station/src/lib/exercises/scale-degree/internal/session-controller.rca-155.test.ts`
  — drives the real controller's `next()` through fake-indexeddb with the
  28-item seed, the probe's 6-round history seeded via `_seedRoundHistory`,
  and `_forceState` for the `graded` guard. `next()` advances to a real item;
  `sessionsRepo.complete` is NOT called.

### Repro'd via refresh-abandon? **Yes, deterministic.**

- `apps/ear-training-station/tests/routes/scale-degree-session-load.test.ts`
  — simulates the `+page.ts` load-time `isReload` branch against fake-IDB.
  Start session with `target_items: 15`. Persist 6 attempts. Simulate the
  `isReload === true` load. Assert `completed_items === 6`, `ended_at` set.
  Matches the probe report bit-for-bit.

### Minimum repro state for the real bug (refresh-abandon)

```
1. Start session with target_items: 15, ended_at: null, completed_items: 0.
2. Play N rounds (N < 15); each round appends to attempts via controller
   persistence. Critically, `session.completed_items` in IDB stays at 0
   throughout — the controller only writes it at session end (#157 latent).
3. Browser reload (F5 / Ctrl+R / location.reload() / Playwright
   page.reload()) — any event that makes
   `performance.getEntriesByType('navigation')[0].type === 'reload'`.
4. +page.ts:load() reads session (ended_at === null), checks isReload
   (true), computes rollUpAbandonedSession(attempts) →
   { ended_at: Date.now(), completed_items: N, ... }, calls
   sessions.complete.
5. UI renders SummaryView with "Done. · N rounds". Indistinguishable from a
   naturally-completed session.
```

## Trace

### 1. Where does the session actually get its `ended_at` set?

`grep -n "sessions\.complete\|sessionsRepo\.complete"` across the app code:

- `apps/ear-training-station/src/routes/scale-degree/sessions/[id]/+page.ts:28`
  — refresh-abandon on load.
- `apps/ear-training-station/src/lib/exercises/scale-degree/internal/session-controller.svelte.ts:405`
  — `completed >= target_items` branch (target reached).
- `apps/ear-training-station/src/lib/exercises/scale-degree/internal/session-controller.svelte.ts:428`
  — scheduler-null fallback.

No other path writes `ended_at`. So observed `ended_at != null` at
`completed_items: 6` with `target_items: 15` reduces to one of these three.

Two ruled out:
- `completed >= target_items`: 6 ≥ 15 is false.
- scheduler-null: requires `selectNextItem(listAll, roundHistory, now, rng)`
  to return `null` with the probe's input. Mathematical impossibility given
  28 items across 4 keys × 7 degrees against any 6-round history (proven
  below).

Remaining: refresh-abandon.

### 2. Why the scheduler cannot return null for the probe's state

`packages/core/src/scheduler/selection.ts:selectNextItem` null-return paths:

- **`eligible.length === 0`** (line 33). Eligible is filtered by strict
  `isBlocked` first, then falls back to `isBlockedSameDegree`-only. For the
  scheduler to return null, EVEN the soft-fallback filter must eliminate all
  items. The soft filter only drops items whose degree equals the last
  history entry's degree.
- **`pick-returned-null`** paths — guarded by `arr.length > 0`; unreachable
  when `eligible.length > 0`.

For the probe state: items contain 4 distinct keys × 7 distinct degrees.
The soft filter drops at most 4 items (the four keys × last-degree=5). 24
items remain. `eligible.length >= 24` always. Null-return impossible.

Empirical confirmation: the 5,000-trial random-history stress in
`rca-155-repro.test.ts` covers every plausible history shape (including
degenerate all-same-degree and all-same-key long streaks). No null produced.

### 3. How refresh-abandon fires

`apps/ear-training-station/src/routes/scale-degree/sessions/[id]/+page.ts:22-31`:

```ts
const isReload = typeof performance !== 'undefined'
  && (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined)?.type === 'reload';

if (session.ended_at == null && isReload && !bypassAbandon) {
  const attempts = await deps.attempts.findBySession(session.id);
  const rollup = rollUpAbandonedSession(attempts);
  await deps.sessions.complete(session.id, rollup);
  const updated: Session = { ...session, ...rollup };
  return { session: updated, attempts };
}
```

`rollUpAbandonedSession(attempts)` returns
`{ ended_at: Date.now(), completed_items: attempts.length, pitch_pass_count, label_pass_count }`.

The probe drove the session via Playwright MCP. Whether it triggered a
reload explicitly (via `page.reload()` or a devtools "take memory snapshot"
/ network-log step that internally reloaded) or via a genuine F5 during a
pause for logging, the `navigation.type === 'reload'` check would fire and
auto-complete the session. The probe's own account notes testing a
mid-session reload during the IDB-persistence checks — that reload fired
the abandon path.

## Proximate vs root cause

- **Proximate (as filed in #155):** "session ended at completed_items=6,
  ended_at set, target_items=15, 6 attempts persisted."
- **Proximate (actual):** `sessions.complete(sessionId, { ended_at,
  completed_items: attempts.length, ... })` was called against an
  in-progress session.
- **Root (actual):** the `+page.ts` load-time `refresh-abandon` branch ran
  because `performance.getEntriesByType('navigation')[0].type === 'reload'`.
  Probably the probe's MCP driver reloaded the page at some point during
  session 1 (the probe's own report mentions "Reloading mid-session restores
  the controller and continues" as a checked surface); whatever navigation
  event triggered isReload=true silently ended session 1.
- **Root (as probe hypothesized):** `selectNextItem returns null when it
  shouldn't`. **Disproven** by the controller-driven repro and the 5,000-
  trial random-history stress.

## Class

This is a **misattribution bug**, not a scheduler bug. The class of issue
is "three paths produce the same terminal UI state; the one that fired is
invisible from the observed data." A single log line at the refresh-abandon
site would have saved this investigation. The scheduler is structurally
sound for the MVP curriculum (≥2 keys × ≥2 degrees = no null on any
history), though it CAN return null on a genuinely narrow curriculum
slice (single-key, saturated-degree; covered by the sanity test).

Adjacent latent concerns surfaced during the investigation:

- **#157 — `sessionsRepo.advance()` missing.** `session.completed_items`
  persists to IDB only at session end. A mid-session reload cannot resume;
  the refresh-abandon design is the consequence. Fixing #157 would enable
  resume-on-reload and make #155's symptom impossible to reach from an
  accidental F5.
- **#159 scheduler instrumentation** still has value even though the
  scheduler didn't cause this incident. If a genuinely narrow curriculum
  slice ever saturates in production (e.g. single-key onboarding with a
  4-round streak of the only remaining degree), the diagnostic will fire
  and a human can decide whether to relax constraints.
- **Double-dispatch race on "Next round".** #159 also mitigates this. Not
  root-cause for #155 but worth landing anyway.

## Fixes considered

### Option A — No code change; document and close #155 as "not a bug"

- **Pro.** The scheduler is fine; the probe misattributed the symptom.
- **Pro.** The refresh-abandon path is intentional per the C1 spec.
- **Con.** The next QA probe / real user will hit the same surprise.
- **Con.** Leaves the observability gap that made this RCA expensive.

### Option B — Add a visible abandon reason to the session row (MINIMAL)

Add a `completion_reason` field or an `abandoned: boolean` flag on
`Session`, set by `rollUpAbandonedSession`. SummaryView shows "Abandoned
on reload · N rounds" vs "Completed · N rounds". No behavior change, but
the user (and the next probe) can tell which path fired.

- **Pro.** Narrow, ships in a day, defuses the misattribution class.
- **Con.** Data-model change (Session interface + IDB schema version bump).
  Slightly more scope than an RCA doc.

### Option C — Resume-on-reload (STRUCTURAL, depends on #157)

Persist `completed_items` / `pitch_pass_count` / `label_pass_count` after
every successful round (the #157 `sessionsRepo.advance()` proposal). On
reload, instead of abandoning, load the session's persisted counts and the
`attempts` for that session, seed the controller's in-memory counters and
`#roundHistory` from attempts, and continue. Refresh-abandon goes away.

- **Pro.** Eliminates #155's observed symptom at the mechanism level.
  Better UX.
- **Pro.** Closes the data/UI mismatch called out in #157.
- **Con.** Needs careful testing: AudioContext is gone after reload
  (session controller's #audioContext must be re-created); `#roundHistory`
  reconstruction from attempts requires item/key/degree lookup; tz_offset_ms
  logic already handles the reconstructed-session case but wants a test.
- **Out of scope for this RCA** — issue #157 owns the fix.

### Option D — Instrumentation only (DIAGNOSTIC)

Add one `console.warn('[session-abandon-on-reload]', { sessionId,
attempts: N })` line at `+page.ts:28`. Keeps behavior identical, makes the
next probe's misattribution impossible.

- **Pro.** Cheapest visible change; ~3 lines.
- **Pro.** Composable with #159's scheduler-null instrumentation — both
  paths are now loud when they fire.
- **Con.** Doesn't fix the UX surprise.

## Chosen fix

**Option D shipped in this PR.** It's the minimum change that fixes the
class of misattribution demonstrated here: the next probe agent sees
`[session-abandon-on-reload]` in console and files against the right
mechanism. It does NOT change the scheduler (correctly, since the scheduler
is sound). It does NOT change persistence semantics (#157's scope). And
it's composable with #159's `[scheduler-null]` log — the two together
give us complete observability over the "session ended early" symptom.

Option B (visible abandon reason) is the natural follow-up; filing as a
polish item.

Option C (resume-on-reload) is blocked on #157 which is already filed.

## Open questions / follow-ups

- **Why did the probe trigger a reload?** The report is ambiguous about
  whether Playwright MCP `navigate_page` / `new_page` triggered a reload
  mid-session or whether a DevTools-style "reload + inspect IDB" sequence
  did. Confirming this would close the loop but isn't load-bearing for
  fixing the bug class.
- **Could `performance.getEntriesByType('navigation')[0].type` ever be
  `'reload'` under a normal SPA transition?** Per HTML spec, no — but
  some MCP drivers use `page.goto(sameUrl, { waitUntil: 'commit' })` that
  could show as reload in some Chromium builds. Worth pinning if we see
  this misfire in production.
- **Should `rollUpAbandonedSession` require >0 attempts before completing?**
  Currently a reload before the first round's grading (attempts.length === 0)
  would create a session with `ended_at` set and 0 rounds, which shows a
  degenerate "Done. · 0 rounds" summary. Not observed in the wild but trivial
  to guard.
- **#159 merge.** PR #159 is still in review; merging it gives us
  `[scheduler-null]` on top of this PR's `[session-abandon-on-reload]`,
  which is the intended observability shape.

## References

- `packages/core/src/scheduler/selection.ts` — `selectNextItem`; null paths.
- `packages/core/src/scheduler/interleaving.ts` — `isBlocked`,
  `isBlockedSameDegree`, `isBlockedSameKeyStreak`.
- `apps/ear-training-station/src/lib/exercises/scale-degree/internal/session-controller.svelte.ts`
  — `next()` at L392 and its two `sessions.complete` sites.
- `apps/ear-training-station/src/routes/scale-degree/sessions/[id]/+page.ts`
  — `refresh-abandon` branch at L25.
- `packages/core/tests/scheduler/rca-155-repro.test.ts` — proof the
  scheduler is sound for the probe state.
- `apps/ear-training-station/src/lib/exercises/scale-degree/internal/session-controller.rca-155.test.ts`
  — proof the controller advances correctly for the probe state.
- `apps/ear-training-station/tests/routes/scale-degree-session-load.test.ts`
  — proof the refresh-abandon path produces the observed symptom bit-for-bit.
