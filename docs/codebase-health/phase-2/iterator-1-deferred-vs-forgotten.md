# Iteration: Deferred vs Forgotten — `targetAudio` and Clock Stubs

## Assignment
Determine whether `targetAudio = null` (never populated) and `windowStartMs = 0` / `getNowMs = () => 0` stubs in `ActiveRound.svelte` were intentional deferred items with a completion plan, or accidentally omitted during C1.

## Findings

### Finding 1: `targetAudio` was an explicit MVP scope deferral with a conditional follow-up
- **Evidence:** `docs/plans/2026-04-16-plan-c1-3-scale-degree-exercise.md` (Task 8) states verbatim: "`controller.targetAudio` will be `null` until Task 6's controller is updated to synthesize the target audio as a buffer... For MVP, if `targetAudio` is null, 'Target' and 'Both' modes are disabled; 'You' still works. A follow-up task in C1.4 can render the target buffer (synthesize via Tone's OfflineAudioContext) **if priority warrants**." Neither `docs/plans/2026-04-16-plan-c1-4-error-ux-pwa-delivery.md` nor `docs/plans/2026-04-17-plan-c1-4-degradation-a11y-pwa.md` contains any task for `targetAudio` synthesis.
- **Confidence:** High
- **Relation to Phase 1:** Confirms area-1 finding. The omission was intentional, not accidental.
- **Significance:** "Target" and "Both" replay modes are permanently disabled post-C1. This was a deliberate product decision, not a bug. The plan gave C1.4 the option to fix it "if priority warrants" — C1.4 didn't take it up.

### Finding 2: Clock stubs were assigned to Task 6 but Task 6's implementation steps never included the wiring
- **Evidence:** `docs/plans/2026-04-16-plan-c1-3-scale-degree-exercise.md` (Task 5 template) has `cadenceStartAcTime={0 /* Task 6 passes real value: targetStartAtAcTime - CADENCE_DURATION_SECONDS */}`. `ActiveRound.svelte:17-22` mirrors these stubs with "Task 6 wires real values" comments. But Task 6's implementation steps (lines 1185–1507 in the plan) define full `startRound()` implementation without any step updating `ActiveRound.svelte` to replace the clock stubs.
- **Confidence:** High
- **Relation to Phase 1:** Extends area-1. Task 6 was declared complete without the wiring ever being written into its steps.
- **Significance:** A plan authoring gap: the plan said Task 6 would do it, Task 6 was executed without doing it, no test asserted the animation works. The C1.3 completion checklist includes "chord blocks animate during cadence" but passes with stubs.

### Finding 3: The design spec described the correct wiring; PlayRoundHandle exposes it
- **Evidence:** `docs/specs/2026-04-16-plan-c1-ui-integration-design.md` lines 265–266 specify `cadenceStartAcTime = await playHandle.targetStartAtAcTime - CADENCE_DURATION_SECONDS`. `packages/web-platform/src/audio/player.ts` exposes `targetStartAtAcTime: Promise<number>` on `PlayRoundHandle`. The controller at `session-controller.svelte.ts:252-255` chains `.then(() => { dispatch TARGET_STARTED })` but discards the resolved value.
- **Confidence:** High
- **Relation to Phase 1:** Extends area-1. One-line fix in the controller — capture resolved `targetAt` as a class field, expose it, `ActiveRound` passes it to ChordBlocks/PitchTrace.
- **Significance:** The fix is straightforward. The spec is correct. No new API needed.

## Resolved Questions
1. Were these intentional? Yes — `targetAudio` was an explicit MVP scope reduction; clock stubs were labeled Task 6 but Task 6 implementation steps were incomplete as written.
2. Is there a plan to complete `targetAudio`? No current plan — the C1.4 conditional was never converted into a task.
3. Can clock stubs be wired without new APIs? Yes — `PlayRoundHandle.targetStartAtAcTime` already resolves to the needed value.

## Remaining Unknowns
- Whether any test currently asserts chord block animation works (would trivially pass with stubs)
- Whether `targetAudio` OfflineAudioContext synthesis is in any C2 plan scope

## Revised Understanding
Both items are known deferred work, not bugs. However, their user-visible impact is significant: the pitch trace visualization is broken for all users (frames pile at rightmost pixel), and two of three replay modes are permanently disabled. They need to be planned as named tasks in C2, not treated as "known issues" that will eventually be handled.
