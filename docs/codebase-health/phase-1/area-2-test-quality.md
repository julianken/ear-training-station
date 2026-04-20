# Investigation: Test Quality & Coverage Gaps

## Summary

The test suite has a structural weakness that is the same class of problem found in PR #101: mocked dependencies hide real serialization and integration failures. The pattern is pervasive. `startRound()` — the most complex path in the app — has zero unit test coverage. The `rollUpAbandonedSession()` pure function has no unit tests despite living in a SvelteKit `load()` function invisible to vitest. The `round-adapters` package passes 8 tests for code the production app never calls. DST edge cases in `currentStreak` will produce wrong results for users in daylight-saving timezones.

## Key Findings

### Finding 1: `startRound()` has zero unit test coverage
- **Evidence:** `session-controller.test.ts` — zero calls to `startRound()`. The only coverage is in a skipped e2e spec (`round-graded.spec.ts:9` is skipped).
- **Confidence:** High
- **Implication:** The most complex method — containing `Promise.all` races, mic acquisition, worklet loading, pitch/KWS subscription, 5-second capture timer — is entirely untested. The `done-before-targetStartAtAcTime` race condition (Tone abort during cadence) is undetected.

### Finding 2: `rollUpAbandonedSession` has no unit tests
- **Evidence:** `src/routes/scale-degree/sessions/[id]/+page.ts:22-45` — the function lives inside a SvelteKit `load()`, invisible to vitest. Only one Playwright e2e test covers it.
- **Confidence:** High
- **Implication:** This function destroyed the happy path before PR #101. Changes to its abandon heuristic (e.g., adding grace period, handling back-button) will ship undetected by CI.

### Finding 3: `round-adapters` package is dead code with live tests
- **Evidence:** Grep of `apps/` for `pitchFrameToEvent|digitFrameToEvent|targetStartedEvent|cadenceStartedEvent|playbackDoneEvent|roundStartedEvent|userCanceledEvent` returns zero matches. `packages/web-platform/tests/round-adapters/adapters.test.ts` has 8 passing tests.
- **Confidence:** High
- **Implication:** 8 tests provide false confidence. The session controller re-implements event stamping inline with `Date.now()` and no Clock injection, bypassing the tested infrastructure designed to solve the two-clock problem.

### Finding 4: `currentStreak` DST crossover is untested
- **Evidence:** `packages/core/tests/analytics/rollups.test.ts:93-101` — single timezone test uses `+3600_000` only. No negative offsets, no DST transitions. `StreakChip.svelte:7` captures `new Date().getTimezoneOffset()` at render time — a session recorded during DST replayed in standard time uses a wrong offset.
- **Confidence:** High
- **Implication:** US users (PST/EST) crossing DST boundaries will see streak regressions. The tz offset should be captured at session start and stored on the Session row.

### Finding 5: Structural-clone safety is a comment, not a linter/test
- **Evidence:** `session-controller.svelte.ts:107-109` — the `$state.snapshot()` call that fixed PR #101's DataCloneError is documented by a comment. Nothing prevents a future `$state<Foo>` from flowing into `deps.X.Y()` without snapshotting. The integration test covers only one code path (CAPTURE_COMPLETE → graded branch). `sessionsRepo.complete()` against real IDB is untested via the controller.
- **Confidence:** High
- **Implication:** The same class of silent bug can recur on any schema evolution that adds a Map, Set, or nested object to Session, Item, or Attempt.

### Finding 6: E2E `seedOnboarded` helper duplicates IDB schema with no drift detection
- **Evidence:** `e2e/helpers/app-state.ts:10-35` manually creates all object stores and indexes. Comment: "keep in sync." No mechanism to detect divergence from `store/db.ts`.
- **Confidence:** High
- **Implication:** A new index or store added to `db.ts` will silently not exist in E2E tests. E2E tests will pass against the wrong schema.

### Finding 7: `roundReducer` missing edge case coverage
- **Evidence:** `packages/core/tests/round/state.test.ts` — `ROUND_STARTED` in `playing_target` and `listening` states untested. Double `PLAYBACK_DONE` untested. `USER_CANCELED` from `idle` untested.
- **Confidence:** Medium (by inspection the reducer handles them safely, but there are no assertions)
- **Implication:** Future reducer changes can silently break these transitions.

## Well Tested

- Round reducer core state machine: 23 tests cover main transitions + USER_CANCELED + graded outcome
- Leitner box state machine: 11 tests cover box promotion/demotion, interval table, `dueAtAfter`
- IndexedDB repo contracts: round-trip tests with `fake-indexeddb` for all 4 repos
- Grade-pitch and grade-listening: octave invariance, confidence thresholds, best-frame selection
- SessionController persistence counters: tests verify counters don't advance on IDB failure

## Surprises

- `StepWarmupRound.finish()` runs 4 IDB writes in sequence but the test mocks all deps and asserts nothing about `finish()`
- The one regression test added in PR #101 (real IDB integration) is the right approach but covers only one of several controller paths that write reactive state to IDB

## Unknowns & Gaps

- Whether `consecutiveNullCount` store reset discipline holds across all component tests
- Whether the `push CAPTURE_COMPLETE from playing_target` scenario is possible in practice

## Raw Evidence

- Files read: `session-controller.test.ts`, `session-controller.integration.test.ts`, `round/state.test.ts`, `analytics/rollups.test.ts`, `round-adapters/adapters.test.ts`, `e2e/helpers/app-state.ts`, `+page.ts` (session route)
- Test runner: `pnpm run test` → 55 files, 340 tests, all passing
