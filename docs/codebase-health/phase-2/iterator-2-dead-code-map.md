# Iteration: Dead Code Map

## Assignment

Quantify and map the "production-dead code" problem surfaced in Phase 1: what was built but bypassed by the app. For each dead module, measure LOC (source + tests), assess the behavioral delta vs the shipped controller, and recommend delete / wire-in / defer.

Phase 1 flagged four candidates:

1. `packages/core/src/session/orchestrator.ts` — `createOrchestrator()`
2. `packages/core/src/scheduler/selection.ts` — `selectNextItem()`
3. `packages/web-platform/src/round-adapters/` — whole module
4. `packages/web-platform/src/mic/permission.ts` — `MicPermissionState.'unavailable'` variant

## Findings

### Dead module: `createOrchestrator` (Plan A session orchestrator)

- **Evidence (files, LOC):**
  - `packages/core/src/session/orchestrator.ts` — **166 LOC** (source)
  - `packages/core/tests/session/orchestrator-unit.test.ts` — **133 LOC** (5 unit tests, stub repos)
  - `packages/web-platform/tests/session/orchestrator.test.ts` — **125 LOC** (6 integration tests, real IndexedDB via fake-indexeddb)
  - `packages/web-platform/tests/session/simulated-session.test.ts` — **166 LOC** (3 long-running sim tests, 30-round sessions)
  - **Total: 166 LOC source + 424 LOC tests = 590 LOC**
  - Grep `createOrchestrator` across `apps/`, `src/` → **zero hits** outside `packages/core/src/session/orchestrator.ts` itself, the three test files above, and historical plan docs
- **Confidence:** Very high. The session controller (`apps/.../session-controller.svelte.ts`) reimplements the same four operations — start, next, record, complete — against `deps.itemsRepo`, `deps.attemptsRepo`, `deps.sessionsRepo` directly. The duplication is line-by-line identical for the math:
  - Orchestrator lines 86–95 (precompute `nextBox`/`reviewsInCurrentBox`) ≡ Controller lines 115–121
  - Orchestrator lines 97–116 (build attempt, put item, append attempt, bump counters, push history) ≡ Controller lines 123–168
  - Orchestrator line 78 (`return selectNextItem(items, history, now, rng)`) vs Controller line 305 (`await deps.itemsRepo.findDue(Date.now())`)
  - Orchestrator `pickFocusItem` (lines 153–166) is the one piece of logic that has **no controller equivalent** — the controller passes `sessionRow.focus_item_id` through unchanged on `complete()`, which is the pre-round value, never recomputed. This is a production behavior delta the orchestrator would have caught (dashboard "focus item" is always whatever the load() function set, never the weakest-at-session-end).
- **Production behavior delta if deleted:**
  - Zero runtime impact — no production path touches it
  - Lose: the only existing `pickFocusItem` implementation. Summary screen's "practice this next" (spec §8) has no production recomputation path. If we delete the orchestrator without re-homing `pickFocusItem`, we lock in today's bug where `focus_item_id` is stale.
  - Lose: the `simulated-session.test.ts` integration coverage — 30-round multi-pass sessions with deterministic RNG, exercising item promotion/demotion, Leitner transitions, unlock gating, interleaving across a full curriculum. This is the closest thing to a full-session test the repo has. Controller tests only cover 1–3 rounds.
- **Production behavior delta if wired in:** The controller would shrink to a thin audio/IO adapter over the orchestrator, the `dueNow[0]` path gets replaced by `selectNextItem`, `pickFocusItem` runs on complete, and `simulated-session.test.ts` becomes load-bearing. But wiring requires either (a) Svelte-side `$state` reactivity on top of the pure orchestrator (orchestrator would need to expose getters or events) or (b) the orchestrator stays pure and the controller becomes an orchestrator-plus-audio shell that mirrors state into `$state` fields.
- **Effort estimate:**
  - Delete: ~30 min. Remove `packages/core/src/session/orchestrator.ts`, three test files, and the `selectNextItem` import it contains. Move `pickFocusItem` into a small pure helper in `packages/core/src/session/focus.ts` with its own unit test, and call it from the controller's `next()` / session-complete path. Net: -590 LOC, +~30 LOC.
  - Wire-in: **~1–2 days.** Requires designing the reactive boundary (orchestrator events → `$state` mirror), rewriting ~150 LOC of controller, rewriting `session-controller.test.ts` (~400 LOC) because the mock shape changes, re-running every integration test against the new composition. Non-trivial — this was the Plan C1 seam decision that the team implicitly skipped when C1 landed.
- **Recommendation: delete + preserve `pickFocusItem`.** The wire-in cost is substantial and the architectural win (one canonical path) is real but not urgent — the controller works and ships. Simultaneously wiring `selectNextItem` (see next finding) is a smaller, higher-leverage intervention and does not require adopting the orchestrator. Keep `simulated-session.test.ts` by rewriting it to exercise `selectNextItem + buildAttemptPersistence` directly (a ~40 LOC rewrite preserves the deterministic-RNG-over-full-session coverage without the orchestrator). File as a follow-up task.

---

### Dead module: `selectNextItem` (interleaving scheduler)

- **Evidence (files, LOC):**
  - `packages/core/src/scheduler/selection.ts` — **82 LOC** (source)
  - `packages/core/src/scheduler/interleaving.ts` — **57 LOC** (source; `isBlocked`, `isBlockedSameDegree`, `isBlockedSameKeyStreak`) — dependency of `selectNextItem`, not dead by itself (interleaving.test.ts exercises the predicates directly)
  - `packages/core/tests/scheduler/selection.test.ts` — **101 LOC** (6 unit tests with deterministic RNG)
  - `packages/core/tests/scheduler/interleaving.test.ts` — **108 LOC** (stays relevant if the predicates are reused)
  - **Total directly dead: 82 LOC source + 101 LOC tests = 183 LOC** (selection.ts + selection.test.ts)
- **Confidence:** Very high. Grep `selectNextItem` under `apps/` returns zero hits. The only in-repo consumer is `orchestrator.ts:78`, which is itself dead. The session controller uses `dueNow.find((i) => i.id !== justPlayed) ?? dueNow[0] ?? null` (line 307).
- **What the dead path enforces that the live path skips:**
  1. **Same-degree-back-to-back block** (`isBlockedSameDegree`) — the controller's `!== justPlayed` check only blocks the same **item id**, not the same **degree** from a different key. In a multi-key curriculum, presenting 5-of-C-major immediately followed by 5-of-G-major would be allowed by the controller but blocked by `selectNextItem`. Today's single-key curriculum (C major only) makes the IDs collapse to degrees, so the gap is masked — **but the spec §5.2 "no blocked practice" commitment is violated for every future key**.
  2. **Same-key-consecutive-≥3 block** (`isBlockedSameKeyStreak`) — completely missing from the controller. Again masked today (one key).
  3. **Weighted sampling** — `selectNextItem` weights by `(1 - accuracy.pitch) + due_bonus + box_bonus`, so weak/overdue items surface more often. Controller picks the first element of `findDue` ordered by the `by-due` IndexedDB index (earliest `due_at` first). Within the starter curriculum (3 items, all `due_at = 0` initially), this is deterministic order, not weighted by weakness.
  4. **Mastered warmup (30%)** — `WARMUP_SHARE = 0.3` samples mastered items uniformly to keep them warm. Controller has zero equivalent; once an item is `mastered` it only comes up when `due_at` rolls forward.
  5. **Soft-constraint fallback** — if strict interleaving blocks all items, `selectNextItem` retries with only the same-degree-back-to-back predicate. Controller has no analog — if `dueNow` is empty it ends the session early (line 310–320).
  6. **`rng`-driven** — `selectNextItem` takes an injectable RNG, making tests deterministic. Controller uses the IndexedDB iteration order (also deterministic, but coupled to insertion order, harder to reason about).
- **Production behavior delta if deleted:** Tests stay in sync with reality; doc drift goes away. BUT: the spec-stated "interleaving + weighted SRS" feature disappears from the codebase. The design commitment in `CLAUDE.md` ("**Interleaving + Leitner SRS** for scheduling. No blocked practice.") becomes a lie. This is a marketing/pedagogy claim, not just architecture.
- **Production behavior delta if wired in:** Real enforcement of spec §5.2. Today nothing changes visibly (starter curriculum is one key with three items — the constraints barely bind), but the moment C major + G major both have items, rounds stop clustering in one key. The 30% mastered warmup keeps promoted items from rotting. Weak items surface faster.
- **Effort estimate:**
  - Delete: ~15 min. `rm selection.ts selection.test.ts`, remove the orchestrator's import if the orchestrator survives. Leave `interleaving.ts` (its predicates are still tested standalone and could be reused).
  - Wire-in: **~2 hours.** The controller already carries the `rng` dep and a `VariabilityHistory` field (`#history`). Add a sibling `#roundHistory: RoundHistoryEntry[]`, push `{ itemId, degree, key }` at the end of the `CAPTURE_COMPLETE` branch (right after the successful persistence block, line 161), and change line 305–307 from `findDue(...).find(!== justPlayed)` to `selectNextItem(await itemsRepo.listAll(), this.#roundHistory, Date.now(), this.#rng)`. One new field, one `.push`, one callsite change. Tests: the existing `session-controller.test.ts` uses `findDue` mocks; those need to become `listAll` mocks, ~5 mock-replacements.
- **Recommendation: WIRE IN.** This is the cheapest, highest-leverage fix in the repo. Two hours of work restores a spec commitment, eliminates a dead module that tests something the app does not do, and the existing `selection.test.ts` is already the regression harness. The excuse "we have one key right now" is self-fulfilling — nothing will exercise multi-key interleaving until the scheduler is wired, and the first multi-key feature will then have to wire it anyway.

---

### Dead module: `round-adapters` (two-clock event factories)

- **Evidence (files, LOC):**
  - `packages/web-platform/src/round-adapters/clock.ts` — **5 LOC**
  - `packages/web-platform/src/round-adapters/index.ts` — **41 LOC** (7 factory functions)
  - `packages/web-platform/tests/round-adapters/adapters.test.ts` — **88 LOC** (8 tests)
  - **Total: 46 LOC source + 88 LOC tests = 134 LOC**
  - Grep `pitchFrameToEvent|digitFrameToEvent|targetStartedEvent|cadenceStartedEvent|playbackDoneEvent|roundStartedEvent|userCanceledEvent` under `apps/` → **zero hits**. Grep `round-adapters` under `apps/` → zero hits.
- **Confidence:** Very high. The session controller hand-rolls equivalent event stamping seven times inline — every `#dispatch(...)` call at lines 207–213, 233–237, 250, 254, 259, 265, 274 constructs a `RoundEvent` directly with `Date.now()` and the same fields the adapter would have produced. The adapter module's entire reason to exist — "the ONLY modules that know the two-clock problem exists" per `CLAUDE.md:80` — is violated by the controller calling `Date.now()` directly seven places.
- **What the dead path provides that the live path skips:**
  - **Injectable clock.** Adapters accept `Clock = systemClock` with a `now(): number` method. Tests can pass `stubClock = { now: () => 42_000 }` and get fully deterministic event timestamps. The controller's inline `Date.now()` means unit tests cannot assert on `at_ms` values — they use `vi.useFakeTimers()` or just ignore timestamps. That is a real testability loss for any future timing-sensitive test (e.g., measuring sung-pitch-arrival-latency-vs-target-start).
  - **Single-purpose translation for digit frames.** `digitFrameToEvent` includes the null-digit filter and the `digitLabelToNumber` conversion in one step. The controller inlines both (lines 231–237), which is fine but means any future change to the digit translation has two places to touch (adapter + controller) or diverges.
  - **Conceptual localization.** If a shared `AudioContext` ever replaces the current Tone-split architecture, the adapter module is the single edit point. With inlined stamping, changes touch seven sites in the controller.
- **Production behavior delta if deleted:** None. The adapter module is shadow code — every behavior exists in the controller, just inlined. Tests exercise the factories' translation logic; the controller does the same translation inline but uncovered.
- **Production behavior delta if wired in:** Indistinguishable runtime behavior. Modest refactor: seven controller callsites become one-line `await #dispatch(pitchFrameToEvent(frame))` etc. Injectable clock unlocks deterministic timestamp tests.
- **Effort estimate:**
  - Delete: ~10 min. `rm -r round-adapters/` and the test file. Delete the last line of `CLAUDE.md` package-surface description that references them. Net: -134 LOC.
  - Wire-in: **~1 hour.** Replace seven inline event constructions in `session-controller.svelte.ts` with adapter calls. Thread a `clock?: Clock` dep through `SessionControllerDeps` for testability. Update two controller tests to use `stubClock`.
- **Recommendation: DELETE.** This is the single cleanest delete in the dead-code inventory. The adapter layer was worth building in Plan C0 as an abstraction boundary, but when C1 built the controller, the abstraction turned out to buy nothing — the controller had to know the event shape anyway to compose it with `roundReducer`. The injectable-clock testability story is real but small; we can revisit when a timing-sensitive test actually gets written. Until then it is 134 LOC of code + tests that lie about where the two-clock knowledge lives.

---

### Dead variant: `MicPermissionState.'unavailable'`

- **Evidence (files, LOC):**
  - `packages/web-platform/src/mic/permission.ts` — **56 LOC source, one dead variant** (line 6: `| 'unavailable'` in the union)
  - Zero test file for this module (no `packages/web-platform/tests/mic/permission.test.ts`)
  - `queryMicPermission` returns `'granted' | 'denied' | 'prompt' | 'unknown'` — **never `'unavailable'`**. The API-missing path throws inside `requestMicStream` (line 19) instead of returning `'unavailable'` from the query.
  - The type identifier `MicPermissionState` is **never imported** anywhere in the repo — consumers narrow the return inline with string-literal comparisons (`micState === 'denied'` at `+page.svelte:31`).
- **Confidence:** Very high. This was already flagged in `CLAUDE.md` ("**Plan C1 integration items (polish deferred from earlier reviews)**" §2) as a deferred cleanup.
- **Production behavior delta if deleted (remove the `'unavailable'` variant from the union):** Zero. No caller types `MicPermissionState` explicitly, no caller handles `'unavailable'`, no code path produces it.
- **Production behavior delta if wired in (return `'unavailable'` when the API is missing):** `queryMicPermission` would need a capability check before the `permissions.query` call:
  ```ts
  if (!navigator.mediaDevices?.getUserMedia) return 'unavailable';
  ```
  Consumer at `+page.svelte:30–34` would need a new branch — currently falls through to `controller = createSessionController(...)` on anything non-`'denied'`, which would then blow up calling `requestMicStream` inside `getMicStream`. Wiring it in means surfacing a **new user-visible error state** (likely routing to the existing `MicDeniedGate` or a distinct "browser unsupported" gate).
- **Effort estimate:**
  - Delete: 2 min. One-line edit to the union.
  - Wire-in: ~30 min. Add the capability check, add a consumer branch, extend `MicDeniedGate` copy or add a tiny "unsupported browser" variant.
- **Recommendation: DELETE the variant.** The PWA target is mainstream browsers where `mediaDevices.getUserMedia` is universally available (Chrome 53+, Safari 11+, Firefox 36+ — all ≥10 years old). The variant was over-engineering for a scenario that never reaches the app. If someone files a bug from a truly ancient browser we can add it back, but today it is a lie in the type system that neither helps the compiler narrow nor gets tested.

---

## Resolved Questions

- **Is the orchestrator a replacement for the controller or a parallel implementation?** Parallel. The controller and orchestrator share zero runtime code — they duplicate the same persistence/SRS sequence against the same repo interfaces. The orchestrator was designed in Plan A before C1's Svelte reactivity requirements surfaced; the controller was written afresh in C1 to meet those requirements.
- **Are `interleaving.ts` predicates dead?** No — they are imported by `selection.ts` AND exercised directly by `interleaving.test.ts`. If we delete `selection.ts`, the predicates should stay (they are a leaf dependency).
- **Does the app have any integration test for a full multi-round session?** Not really. `simulated-session.test.ts` (orchestrator-based, ~166 LOC) is the only multi-round fixture in the repo. Controller tests run 1–3 rounds max. This is a coverage gap if the orchestrator is deleted without a replacement.
- **Does anyone consume the `MicPermissionState` type directly?** No. String-literal comparisons are the only narrowing pattern in the codebase.

## Remaining Unknowns

- **`pickFocusItem` production behavior.** I verified the controller does not recompute `focus_item_id` on `complete`, it just passes `sessionRow.focus_item_id` through (line 296 and 314). What actually sets that value on the session row in production? The `+page.svelte` load function? I did not trace this, but Phase 1's area-1 may have. This affects the "is the orchestrator the only place pickFocusItem runs" claim — if nothing in production runs it, the summary screen's "focus item" chip is either blank or stale-from-some-earlier-source. Worth verifying before deleting the orchestrator.
- **Does removing `selectNextItem`'s RNG contract break anything else?** I did not trace every `rng` consumer. The orchestrator's RNG is fed to `selectNextItem`; the controller's RNG is fed only to `pickTimbre`/`pickRegister`. Adding `selectNextItem` to the controller's RNG stream is fine, but if test fixtures count RNG pulls, that's a break.
- **Does wiring `selectNextItem` change the starter-curriculum deadlock-unlock story?** Plan A notes "caught starter-curriculum interleaving deadlock" as a bug the orchestrator tests found. The C1 controller has not been tested against the same deadlock shape. A wire-in should rerun those scenarios via the controller.

## Revised Understanding

**Gross dead LOC inventory:**

| Module | Source LOC | Test LOC | Total |
|---|---|---|---|
| `orchestrator.ts` + 3 test files | 166 | 424 | **590** |
| `selection.ts` + 1 test file | 82 | 101 | **183** |
| `round-adapters/` + 1 test file | 46 | 88 | **134** |
| `MicPermissionState.'unavailable'` | 1 | 0 | **1** |
| **Total directly dead** | **295** | **613** | **908** |

908 LOC of code and tests that the shipped app does not execute. For context, that is roughly 10% of the core + web-platform package source. None of it is harmful per se — the tests pass, the types are valid — but it creates three active costs:

1. **Anchor for misunderstanding.** A new contributor reading `selection.ts` or `orchestrator.ts` will assume those are live paths. The controller's divergence is invisible without running a grep the contributor has no reason to run.
2. **Spec drift.** `CLAUDE.md` line 105 (`**Interleaving + Leitner SRS** for scheduling. No blocked practice.`) is literally untrue in production. The orchestrator-comment in the Plan C0 doc ("round-adapters are the ONLY modules that know the two-clock problem exists") is literally untrue.
3. **Test noise.** 8 round-adapter tests, 9 selection tests, 14 orchestrator tests = 31 tests that return green and tell you nothing about whether the app works. They inflate the "221 passing tests" signal.

**Triage by dispo:**

- **Wire in: `selectNextItem`.** Two hours of work, spec-restoring, already has a full regression harness. Single highest-leverage action in Phase 2.
- **Delete: `round-adapters/`.** One hour, zero runtime impact, eliminates a confusing abstraction.
- **Delete + carve out: `orchestrator.ts`.** Keep `pickFocusItem` as a standalone helper (rewrite with its own small test). Rewrite `simulated-session.test.ts` as an orchestrator-free multi-round sim over `selectNextItem + buildAttemptPersistence` (preserves the long-horizon coverage). File as a dedicated follow-up task; larger scope than the other two.
- **Delete: `MicPermissionState.'unavailable'`.** Two-minute trivial edit; fold into the next PR that touches this file.

**What Phase 1 got right:** The dead-code call is accurate in every case. The problem is not that these modules are unnecessary — they encode real design intent. The problem is that when C1 shipped, the controller took the shortcut instead of composing the existing pieces, and nobody paid the cost of either finishing the wire-in or accepting the delete. Phase 2's job is to force that decision per module instead of letting all four drift together.
