# Phase 2 · Iterator 5 — Test Strategy for Two Highest-Risk Gaps

**Scope:** minimal test additions that would catch (1) Svelte reactive state → IDB
serialization bugs and (2) DST / timezone bugs in streak calculation. Both are *real*
defects already latent in `main` (the PR #101 DataCloneError was the first observed
eruption of the first class; the DST bug currently has no regression test but is
reproducible at known epoch millisecond values — proof below).

The two gaps are treated together because the minimal fixes share a common idea: push
the invariant from *a comment that the author must remember* into *a structural test
fixture that fails the build when the invariant is violated*.

---

## 1. The `currentStreak()` / DST interaction — precisely what is broken

### 1.1 What `currentStreak()` does with `tzOffsetMs`

Source: `/Users/j/repos/ear-training/packages/core/src/analytics/rollups.ts` lines
44–66.

```ts
const DAY_MS = 86_400_000;

function dayIndex(ts: number, tzOffsetMs: number): number {
  return Math.floor((ts + tzOffsetMs) / DAY_MS);
}

export function currentStreak(
  sessions: ReadonlyArray<Session>,
  now: number,
  tzOffsetMs: number = 0,
): number {
  if (sessions.length === 0) return 0;
  const days = new Set(sessions.map((s) => dayIndex(s.started_at, tzOffsetMs)));
  const today = dayIndex(now, tzOffsetMs);
  ...
}
```

The rollup function itself is pure and correct in isolation: it takes `tzOffsetMs` as
an invariant offset and applies it identically to every `started_at` and to `now`. If
the caller is honest about what offset to apply, the math is fine.

### 1.2 Where the bug actually lives

`/Users/j/repos/ear-training/apps/ear-training-station/src/lib/shell/StreakChip.svelte`
lines 6–9:

```svelte
const streak = derived(allSessions, ($sessions) => {
  const tzOffsetMs = -new Date().getTimezoneOffset() * 60_000;
  return currentStreak($sessions, Date.now(), tzOffsetMs);
});
```

**The bug is in the caller, not the rollup.** `StreakChip` samples
`getTimezoneOffset()` once at render time and passes that single number as the offset
for *every* session, even sessions recorded under a different offset. This is wrong
whenever any session in the streak window crossed a DST boundary.

The rollup's single-`tzOffsetMs` contract is actually what forces the bug: it cannot
attribute a session to the day it was recorded-in-local-time unless the caller either
(a) stores the per-session offset and uses that, or (b) converts each `started_at` to
"local midnight-aligned day" before passing the set to the rollup.

### 1.3 Concrete reproduction at a US spring-forward

Spring 2026 DST transition in `America/New_York` is **Sunday March 8 2026, 02:00
local**. EST (UTC−5) → EDT (UTC−4).

Three sessions across the transition:

| Local time                    | UTC epoch ms      | Offset at that moment |
| ----------------------------- | ----------------- | --------------------- |
| Sat Mar 7 2026 23:30 EST      | `1_772_944_200_000` | −5h (`getTimezoneOffset()` = 300) |
| Sun Mar 8 2026 23:30 EDT      | `1_773_027_000_000` | −4h (`getTimezoneOffset()` = 240) |
| Mon Mar 9 2026 10:00 EDT (now) | `1_773_064_800_000` | −4h                  |

`StreakChip` at render time on Mon Mar 9 samples
`tzOffsetMs = -240 * 60_000 = -14_400_000` and passes it to all three.

```ts
dayIndex(Sat 23:30 EST, -14_400_000) === 20520  // WRONG — collapses into Sunday
dayIndex(Sun 23:30 EDT, -14_400_000) === 20520
dayIndex(Mon 10:00 EDT, -14_400_000) === 20521
```

Result: streak = **2**. The Saturday session ran but is silently merged into Sunday,
so the user sees a 2-day streak instead of 3.

With per-session offsets (the fix):

```ts
dayIndex(Sat 23:30, -18_000_000) === 20519  // correct — Saturday
dayIndex(Sun 23:30, -14_400_000) === 20520  // correct — Sunday
dayIndex(Mon 10:00, -14_400_000) === 20521  // correct — Monday
```

Streak = **3**. This is an honest-progress UI; under-reporting the streak is exactly
the kind of silent correctness loss the project's "no gamification" posture is supposed
to make impossible to paper over with a shrug.

Fall-back (Nov 1 2026, EDT→EST) is a milder case: with per-session offsets the streak
is still correct, but with the uniform render-time offset the Saturday EDT session's
`dayIndex` happens to land on the correct day by coincidence (the EDT-recorded session
with an EST offset happens not to cross a midnight boundary in this particular
scenario). Spring-forward is the smoking gun.

---

## 2. Should `tzOffsetMs` be captured at session start? Yes — here is the migration

### 2.1 Current schema

`/Users/j/repos/ear-training/packages/core/src/types/domain.ts` lines 64–74:

```ts
export interface Session {
  id: string;
  started_at: number;
  ended_at: number | null;
  target_items: number;
  completed_items: number;
  pitch_pass_count: number;
  label_pass_count: number;
  focus_item_id: string | null;
}
```

No timezone information. `/Users/j/repos/ear-training/packages/web-platform/src/store/sessions-repo.ts`
constructs Session rows at `start()` time from a `StartSessionInput` that is defined
in `packages/core/src/repos/interfaces.ts` and also has no offset field.

### 2.2 Recommended change

Add one optional field:

```ts
export interface Session {
  ...
  /** Minutes East of UTC at session-start time. -new Date().getTimezoneOffset() * 60_000.
   *  Captured because streak-day boundaries are local-time, not UTC, and a user's
   *  offset can change between sessions (DST, travel). Optional for backward-compat:
   *  absence implies "we don't know, fall back to render-time offset". */
  tz_offset_ms?: number;
}
```

- `StartSessionInput` gains a matching optional field.
- `createSessionsRepo.start()` stores whatever the controller sends.
- The controller calls `sessionsRepo.start({ ..., tz_offset_ms: -new Date().getTimezoneOffset() * 60_000 })`.
- `StreakChip.svelte` changes to:

```svelte
const streak = derived(allSessions, ($sessions) => {
  const fallback = -new Date().getTimezoneOffset() * 60_000;
  // Convert each session to a day-index using ITS recorded offset, then fall back
  // to render-time offset for legacy rows without tz_offset_ms.
  return currentStreak(
    $sessions,
    Date.now(),
    fallback, // still needed for `now`, which is always render-time
    (s) => s.tz_offset_ms ?? fallback,
  );
});
```

This requires a signature change on `currentStreak` — probably the cleanest form:

```ts
export function currentStreak(
  sessions: ReadonlyArray<Session>,
  now: number,
  tzOffsetMsForNow: number = 0,
  tzOffsetMsForSession: (s: Session) => number = () => tzOffsetMsForNow,
): number;
```

### 2.3 Migration cost

- **Schema:** IDB `DB_VERSION` is `1` in
  `/Users/j/repos/ear-training/packages/web-platform/src/store/db.ts`. Adding an
  optional field does NOT require a version bump — `idb` and structured-clone tolerate
  missing optional fields on read. Existing rows remain valid; new rows carry the
  offset. A version bump would only be needed if we added an **index** on
  `tz_offset_ms`, which we don't need (the field is read inside `currentStreak` by
  callback, not queried).
- **Code:** ~10 lines in sessions-repo, ~5 in session controller, signature change on
  `currentStreak`, caller update in `StreakChip`. Add tests (below).
- **Behavioural fallback:** legacy sessions without `tz_offset_ms` default to
  render-time offset, which is exactly today's behaviour — so the fix improves
  accuracy for new sessions without changing it for old ones. Graceful.

---

## 3. What writes reactive state to IDB inside the controller

Source: `/Users/j/repos/ear-training/apps/ear-training-station/src/lib/exercises/scale-degree/internal/session-controller.svelte.ts`.

Every call that could hand a `$state`-backed Proxy to structured-clone:

| # | Line | Call site                                   | Argument surface                                                         | Current mitigation                                            |
|---|------|----------------------------------------------|--------------------------------------------------------------------------|---------------------------------------------------------------|
| 1 | 146  | `deps.attemptsRepo.append(attempt)`          | `attempt` built from `gradedState` via `buildAttemptPersistence`          | `gradedState = $state.snapshot(this.state)` on line 109       |
| 2 | 147  | `deps.itemsRepo.put(updatedItem)`            | `updatedItem` derived from `gradedState.item`                             | Same snapshot on line 109                                      |
| 3 | 291  | `deps.sessionsRepo.complete(id, body)`       | `body` assembled from `this.#pitchPasses`/`#labelPasses` (plain numbers) and `sessionRow.focus_item_id`. `sessionRow = this.session!` — `this.session` IS `$state`. | **NOT snapshotted.** `sessionRow` is the reactive proxy; primitive reads are fine but `focus_item_id` flowing through an object literal is safe for clone. Still worth asserting via the wrapper below. |
| 4 | 310  | `deps.sessionsRepo.complete(id, body)` (empty-queue branch) | Same shape as #3                                                     | Same                                                          |

Additionally: **any future persistence call** (a settings write on the settings page,
a new onboarding-progress write, an exercise-bank save, a mastery snapshot export)
that accepts anything touching `$state` is a fresh opportunity for the same
DataCloneError PR #101 hit. The `$state.snapshot` on line 109 is **a comment with a
snapshot call attached**, not a structural guarantee. A future author adding a fifth
repo write is unlikely to notice that the argument hanging off a reactive `this.session`
must be snapshotted, because:

1. The current tests don't catch it (only the graded-state write path is exercised).
2. The Svelte 5 Proxy doesn't show up in `typeof`, `instanceof`, or in JSON
   serialization — it only explodes on `structuredClone`.
3. `structuredClone` is the first thing IndexedDB does on the write; the error surface
   is "DataCloneError" which does not mention Svelte.

The structural fix is to make *every* repo write provably clonable, in tests.

---

## 4. `createCloneVerifyingRepo(realRepo)` — design

### 4.1 Goals

- **Fail loud in tests** when a Proxy (or any structured-clone-hostile value) reaches
  the IDB boundary.
- **Zero production cost.** The wrapper is a test-only decorator applied in the
  integration test setup; it is not imported from production code.
- **No reliance on trying/catching DataCloneError from fake-indexeddb.**
  fake-indexeddb does implement structured-clone checking, but the failure surface is
  an async rejection that round-trips through the controller's own try/catch on line
  163, which *swallows* the error into `degradationState.persistenceFailing = true`.
  That's precisely what happened in PR #101: the error was silently degraded; tests
  that only looked at "did the happy path succeed" didn't notice. We need a wrapper
  that throws *synchronously* before the swallow, so the test assertion is on the
  argument shape, not on the downstream symptom.

### 4.2 TypeScript signature

A repo-agnostic higher-order function that wraps any repo and intercepts every method
call. `keyof T`-based, preserves the original interface exactly, and relies on a
pluggable clone-check.

```ts
/** Names of mutating methods per repo. Any method listed here will have its
 *  arguments deep-clone-probed before being forwarded to the underlying impl.
 *  Reads (get/listAll/findDue/findBySession/findByItem/findByBox/getOrDefault)
 *  are not cloned because their arguments are primitives.
 */
type WriteMethodNames = 'put' | 'putMany' | 'append' | 'start' | 'complete' | 'update';

/** Throws synchronously if `value` is not structured-clonable OR contains a Proxy.
 *  The Proxy check is deliberately stricter than structuredClone's behaviour —
 *  some Proxies happen to clone fine, but ANY reactive proxy reaching a repo
 *  boundary is a bug because it signals missing `$state.snapshot()`. */
export function assertPlainClonable(value: unknown, path: string = '<root>'): void {
  // 1. Try structured-clone — catches the PR #101 case (DataCloneError).
  try {
    structuredClone(value);
  } catch (e) {
    throw new Error(
      `createCloneVerifyingRepo: argument at ${path} is not structured-clonable. ` +
      `This usually means a Svelte $state Proxy leaked through without a ` +
      `$state.snapshot() call. Original: ${(e as Error).message}`,
    );
  }
  // 2. Walk for Proxies. Svelte 5 $state Proxies ARE structured-clonable in some
  //    shapes (strings, primitives) but NEVER in an object whose field layout we
  //    care about persisting. Detect via the $state.snapshot marker if exposed,
  //    else by the Proxy's internal [[Handler]] — vitest has `vi.isMockFunction`
  //    as precedent for internal-slot checks. Svelte exposes `$state.is` for
  //    this exact detection purpose.
  //    NB: in unit tests under jsdom without Svelte runtime, $state is undefined
  //    and this check silently passes, which is correct — there can be no Proxy
  //    if Svelte isn't loaded.
  walkForProxy(value, path);
}

export function createCloneVerifyingRepo<T extends object>(realRepo: T): T {
  return new Proxy(realRepo, {
    get(target, prop, receiver) {
      const orig = Reflect.get(target, prop, receiver);
      if (typeof orig !== 'function') return orig;
      const name = String(prop);
      const isWrite = (['put','putMany','append','start','complete','update'] as const)
        .includes(name as WriteMethodNames);
      if (!isWrite) return orig.bind(target);

      return (...args: unknown[]) => {
        args.forEach((arg, i) => assertPlainClonable(arg, `${name}#arg[${i}]`));
        return (orig as (...a: unknown[]) => unknown).apply(target, args);
      };
    },
  });
}
```

Implementation notes:

- `walkForProxy` is intentionally left as a helper and not fully specced here because
  the best implementation depends on whether Svelte ships a public detection helper.
  A pragmatic minimal form: use `structuredClone` plus a Proxy-detection `WeakSet`
  populated by a module-level setter. In practice the `structuredClone()` check in
  step 1 is **already sufficient to catch the PR #101 regression** because
  `$state`-backed objects with function-returning getters fail clone. The
  `walkForProxy` is defence-in-depth for future Svelte versions that may allow some
  proxies through clone.
- The assertion throws *synchronously* from the wrapper call, before the
  controller's `try/catch` on line 163 fires. So the controller sees a thrown error,
  not a Promise rejection, and the test sees a clear failure message rather than a
  silent `persistenceFailing` flag flip.
- Wrap the wrapper around EVERY repo passed to the controller in the integration
  test, not just `itemsRepo`/`attemptsRepo`. That is what catches call sites #3 and
  #4 above (the `sessionsRepo.complete` path).

### 4.3 Test that uses the wrapper

Minimal addition to
`src/lib/exercises/scale-degree/internal/session-controller.integration.test.ts`:

```ts
import { createCloneVerifyingRepo } from './helpers/clone-verifying-repo';

async function makeVerifiedDeps(db: DB) {
  const raw = await makeRealDeps(db);
  return {
    ...raw,
    itemsRepo:    createCloneVerifyingRepo(raw.itemsRepo),
    attemptsRepo: createCloneVerifyingRepo(raw.attemptsRepo),
    sessionsRepo: createCloneVerifyingRepo(raw.sessionsRepo),
    settingsRepo: createCloneVerifyingRepo(raw.settingsRepo),
  };
}

describe('SessionController — every repo write is clone-safe', () => {
  it('graded → attempts.append + items.put argument is clonable', async () => {
    const deps = await makeVerifiedDeps(db);
    const ctrl = createSessionController(deps);
    ctrl._forceState(/* same listening-state fixture as existing test */);
    ctrl._checkCaptureEnd();
    await flushPromises();
    // If the wrapper threw, it would have surfaced before degradationState flips.
    expect(get(degradationState).persistenceFailing).toBe(false);
  });

  // Specifically exercises the `next()` final-round branch on line 286–297.
  // This path was NOT covered by the existing integration test.
  it('final-round next() → sessions.complete argument is clonable', async () => {
    const deps = await makeVerifiedDeps(db);
    const ctrl = createSessionController({ ...deps, session: { ...baseSession, target_items: 1 } });
    ctrl._forceState(/* graded-state fixture */);
    await ctrl.next();
    await flushPromises();
    // Wrapper assertion runs synchronously inside next(); any proxy leak throws
    // before this line executes.
  });

  // Negative test — proves the wrapper actually catches a proxy. If this test
  // starts passing without the fix, the wrapper has regressed.
  it('wrapper throws when a Proxy is passed directly', async () => {
    const raw = await makeRealDeps(db);
    const verified = createCloneVerifyingRepo(raw.itemsRepo);
    const proxied = new Proxy(baseItem, {
      get(t, k) { return Reflect.get(t, k); },
    });
    // A hand-rolled Proxy may or may not fail structuredClone; either way, the
    // walkForProxy arm must fire. If this assertion is too strict in practice,
    // weaken to "passes through when args are plain objects" and rely on the
    // structuredClone arm for the Svelte case.
    await expect(verified.put(proxied)).rejects.toThrow(/not structured-clonable|Proxy/);
  });
});
```

### 4.4 Why this is structurally stronger than a comment

The `$state.snapshot()` on line 109 is correct *today*, but the invariant it
enforces is:

> "Every repo write argument in this controller must have no reactive proxy in its
> prototype chain."

A comment cannot enforce that. A typecheck cannot enforce it (the Proxy and the
plain object are structurally identical to TypeScript). An integration test that
asserts success on the happy path cannot enforce it (the error is swallowed by
`persistenceFailing`).

`createCloneVerifyingRepo` enforces it: add a fifth repo write tomorrow that forgets
the snapshot, the test fails at the wrapper, with a message that names which repo
method and which argument index was wrong.

---

## 5. The DST regression test

### 5.1 Concrete test

Add to `/Users/j/repos/ear-training/packages/core/tests/analytics/rollups.test.ts`:

```ts
describe('currentStreak — DST-crossover regression', () => {
  // 2026-03-08 02:00 America/New_York is the spring-forward transition.
  // Epoch values computed once and pinned as constants; the test does NOT use
  // `new Date(...)` with local-time fields because vitest runs under whatever
  // TZ the CI machine has, and we want the test to assert the bug regardless
  // of runner TZ.
  const SAT_EST_23_30 = 1_772_944_200_000; // 2026-03-07 23:30 EST (UTC-5)
  const SUN_EDT_23_30 = 1_773_027_000_000; // 2026-03-08 23:30 EDT (UTC-4)
  const MON_EDT_10_00 = 1_773_064_800_000; // 2026-03-09 10:00 EDT (UTC-4)

  const EST_OFFSET_MS = -300 * 60_000; // -18_000_000
  const EDT_OFFSET_MS = -240 * 60_000; // -14_400_000

  function makeSession(startedAt: number, id: string): Session {
    return {
      id,
      started_at: startedAt,
      ended_at: startedAt + 100_000,
      target_items: 10,
      completed_items: 10,
      pitch_pass_count: 8,
      label_pass_count: 9,
      focus_item_id: null,
    };
  }

  it('spring-forward: uniform render-time offset UNDER-counts the streak', () => {
    // This is the current (buggy) behaviour documented as a regression baseline.
    // When the fix lands, this test inverts: it becomes the proof that the
    // uniform-offset path is gone from callers.
    const sessions = [
      makeSession(SAT_EST_23_30, 's-sat'),
      makeSession(SUN_EDT_23_30, 's-sun'),
    ];
    // Render-time offset on Mon Mar 9 is EDT.
    expect(currentStreak(sessions, MON_EDT_10_00, EDT_OFFSET_MS)).toBe(2);
  });

  it('spring-forward: per-session offset (via a 4th-arg callback) gives true streak', () => {
    // This is the test that fails TODAY (currentStreak does not accept the
    // callback) and passes AFTER the proposed signature change.
    const sessions = [
      makeSession(SAT_EST_23_30, 's-sat'),
      makeSession(SUN_EDT_23_30, 's-sun'),
    ];
    const offsets: Record<string, number> = {
      's-sat': EST_OFFSET_MS,
      's-sun': EDT_OFFSET_MS,
    };
    expect(
      currentStreak(sessions, MON_EDT_10_00, EDT_OFFSET_MS, (s) => offsets[s.id]!),
    ).toBe(2); // Sat and Sun counted correctly; "today" is Mon with no session.
    // Include today's session -> 3
    expect(
      currentStreak(
        [...sessions, makeSession(MON_EDT_10_00, 's-mon')],
        MON_EDT_10_00 + 60_000,
        EDT_OFFSET_MS,
        (s) => s.id === 's-mon' ? EDT_OFFSET_MS : offsets[s.id]!,
      ),
    ).toBe(3);
  });

  it('fall-back: per-session offset preserves day-of-week boundaries', () => {
    // Oct 31 2026 20:00 EDT = 2026-11-01 00:00 UTC
    const SAT_EDT_20_00 = Date.UTC(2026, 10, 1, 0, 0);
    // Nov  1 2026 20:00 EST = 2026-11-02 01:00 UTC
    const SUN_EST_20_00 = Date.UTC(2026, 10, 2, 1, 0);
    const MON_EST_10_00 = Date.UTC(2026, 10, 2, 15, 0);
    const sessions = [
      makeSession(SAT_EDT_20_00, 's-sat-fb'),
      makeSession(SUN_EST_20_00, 's-sun-fb'),
    ];
    const offsets: Record<string, number> = {
      's-sat-fb': EDT_OFFSET_MS,
      's-sun-fb': EST_OFFSET_MS,
    };
    expect(
      currentStreak(sessions, MON_EST_10_00, EST_OFFSET_MS, (s) => offsets[s.id]!),
    ).toBe(2);
  });
});
```

### 5.2 Integration side

Add a rendering test for `StreakChip.svelte` in `apps/ear-training-station/tests/shell/`.
It must stub `Date.now()` and `new Date().getTimezoneOffset()`, seed two sessions
into the `allSessions` store (one with `tz_offset_ms = EST_OFFSET_MS`, one with
`tz_offset_ms = EDT_OFFSET_MS`), render `<StreakChip />`, and assert the displayed
count. This is the end-to-end proof that the chip picks the right per-session
offsets after the fix.

vitest's `vi.useFakeTimers({ now: MON_EDT_10_00 })` handles `Date.now()`. For
`getTimezoneOffset` either spy on `Date.prototype.getTimezoneOffset` or inject a
clock-like dependency into `StreakChip` (more invasive; the spy approach is fine for
one test).

---

## 6. Minimal test-addition summary

Four new artifacts, all small:

| # | File | Purpose |
|---|------|---------|
| 1 | `apps/ear-training-station/src/lib/exercises/scale-degree/internal/helpers/clone-verifying-repo.ts` | Test-only wrapper factory. ~40 lines. |
| 2 | Add three `describe` blocks to `session-controller.integration.test.ts` | Wrap the existing deps in `createCloneVerifyingRepo`; exercise graded-state write AND final-round `sessionsRepo.complete`; negative test for the wrapper itself. |
| 3 | Add `currentStreak — DST-crossover regression` describe block to `packages/core/tests/analytics/rollups.test.ts` | Three pinned-epoch tests covering spring-forward (buggy baseline + fixed behaviour) and fall-back. |
| 4 | `apps/ear-training-station/tests/shell/StreakChip.test.ts` | End-to-end chip render under pinned `Date.now()` + spied `getTimezoneOffset`. |

Schema + signature change (not a test, but the minimum implementation change required
for #3 and #4 to test the fixed behaviour rather than just documenting the bug):

- Add optional `tz_offset_ms?: number` to `Session` and `StartSessionInput`.
- Extend `currentStreak` with a 4th optional callback arg for per-session offset.
- Update `StreakChip.svelte` to pass the callback.
- Update `SessionController.next()` / `sessionsRepo.start` contract so new sessions
  record their offset.

No IDB version bump required; the field is optional and un-indexed.

---

## 7. Risk and prioritisation

| Risk | Likelihood without fix | Severity | Test coverage cost |
|------|-----------------------|----------|--------------------|
| `$state` proxy leak into a NEW repo write (5th, 6th, ...) | High. The controller is small today but Plan C1's dashboard and summary screens add at least three more call sites. | Silent per-round data loss. Same as PR #101 but without the easy-to-spot symptom because `allItems.update` isn't called on the new paths. | Low — one wrapper file, ~40 lines. |
| DST-crossover streak under-count | Certain, annually, for any user who crosses a US DST boundary. Spring 2026 (Mar 8) is the next firing. | Streak chip shows the wrong number. Low-severity UI misreport, but directly undermines the "honest progress" non-negotiable. | Low — three pure-function tests + one render test. |

Both are worth paying the modest cost for before Plan C1 adds surface area. The
clone-verifying wrapper in particular pays compounding interest: every new repo
write in C1 inherits the invariant for free if the wrapper is in the integration
fixture.

---

## Appendix — Key file paths referenced

- `/Users/j/repos/ear-training/packages/core/src/analytics/rollups.ts` — `currentStreak` source
- `/Users/j/repos/ear-training/apps/ear-training-station/src/lib/shell/StreakChip.svelte` — bug site
- `/Users/j/repos/ear-training/packages/core/src/types/domain.ts` — `Session` schema (line 64)
- `/Users/j/repos/ear-training/packages/core/src/repos/interfaces.ts` — `StartSessionInput`/`CompleteSessionInput`
- `/Users/j/repos/ear-training/packages/web-platform/src/store/sessions-repo.ts` — `start`/`complete` implementation
- `/Users/j/repos/ear-training/packages/web-platform/src/store/db.ts` — `DB_VERSION = 1`, schema
- `/Users/j/repos/ear-training/apps/ear-training-station/src/lib/exercises/scale-degree/internal/session-controller.svelte.ts` — `$state.snapshot` comment (line 109), four repo-write sites (146, 147, 291, 310)
- `/Users/j/repos/ear-training/apps/ear-training-station/src/lib/exercises/scale-degree/internal/session-controller.integration.test.ts` — existing single-path test
- `/Users/j/repos/ear-training/packages/core/tests/analytics/rollups.test.ts` — existing streak tests (no DST case)
