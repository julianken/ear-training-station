# Context Packet: Phase 1

## Key Findings (ordered by impact)

1. **Interleaving scheduler never runs in production** — `selectNextItem()` (built, tested, 9 tests) is never imported by the app. Controller uses naive `dueNow[0]`. The core "no blocked practice" value prop is violated. (area-1, area-3)
2. **"Target" and "Both" replay always disabled** — `targetAudio` is initialized to null and never assigned. Two of three replay modes are permanently non-functional. (area-1)
3. **AudioContext created per round, never closed** — Chrome throttles at ~6 contexts. Round 7+ has no audio in a 30-round session. (area-4, area-5)
4. **`void hydrateShellStores()` — IDB failure silently empties the entire app** — No error surface for storage quota, private-mode IDB, or schema upgrade failures. (area-4)
5. **`startRound()` errors silently swallowed** — Mic denied, AudioContext fail, worklet error → user clicks "Start round," nothing happens. (area-4)
6. **`.catch(() => {})` re-introduced on stop** — Same pattern fixed in PR #76, now back in session-controller. If KWS stop throws, next session's digit recognition hangs forever. (area-4)
7. **tfjs + Tone.js eagerly bundled despite dynamic imports** — `digit-label.ts` static import chain defeats lazy loading. ~1.1 MiB parsed before first render. (area-5)
8. **`round-adapters` package is dead code with 8 live tests** — Session controller bypasses it; inline `Date.now()` reimplementation has no Clock injection. (area-2, area-3)
9. **Pitch trace visualization broken** — `windowStartMs = 0` stub + `Date.now()` frames → all frames clamp to rightmost pixel. Also y-axis always returns `targetDegree`. (area-1, area-4)
10. **Settings injected but never read** — `settingsRepo` dep declared, confidence thresholds and auto-advance hardcoded. Settings UI has no runtime effect. (area-1, area-3)

## Confidence Levels

- **High-confidence findings (direct code evidence):** All 10 above
- **Medium-confidence:** Frame buffer carrying across playing_target → listening (echo cancellation likely suppresses, but unverified); `roundReducer` edge cases (correct by inspection but unasserted)
- **Low-confidence:** Whether orchestrator-vs-controller Leitner computation has semantically diverged (appears identical today, could drift)

## Contradictions & Open Questions

1. **Was `targetAudio` population deferred intentionally or omitted?** The C1 plan task list may have had this as a sub-task that was missed. Needs git log / plan file check.
2. **Were the clock stubs (`windowStartMs = 0`) a known deferred item?** `ActiveRound.svelte:17-22` comments say "Task 6 wires real values" — but Task 6 is in a merged PR. Was it completed or forgotten?
3. **Is the `createOrchestrator` dead code intended to be deleted, or was it meant to replace the session controller once C1 settled?** The CLAUDE.md doesn't clarify this.

## Artifacts (read only if needed)
- `phase-1/area-1-spec-compliance.md`: 6 non-negotiable commitments — mostly confirmed, 5 significant deviations
- `phase-1/area-2-test-quality.md`: Mock-vs-real gaps, dead round-adapters tests, DST streak bug
- `phase-1/area-3-architecture-integrity.md`: Dead orchestrator, bypassed scheduler, clean core layering
- `phase-1/area-4-silent-failures.md`: 12 silent failure sites (4 critical, 6 high, 2 medium)
- `phase-1/area-5-performance-pwa.md`: Eager 1.1 MiB bundle, AudioContext leak, harness in prod, iOS PWA gap
