# Investigation: Silent Failures & Data Integrity

## Summary

Fifteen silent failure sites were identified — four rated critical. The most dangerous: `void hydrateShellStores()` in `+layout.svelte` means any IDB failure makes the entire app appear empty with no user feedback. `startRound()` errors are silently swallowed in the event handler. The `.catch(() => {})` pattern from PR #76 was re-introduced in `session-controller.svelte.ts`. AudioContext instances are created per round and never closed, hitting Chrome's ~6-context limit by round 7 of a 30-round session. An AudioContext stub value of 0 for `windowStartMs` produces a broken pitch trace visualization.

## Key Findings

### Finding 1: `void hydrateShellStores()` — IDB failure makes app appear empty (CRITICAL)
- **Evidence:** `+layout.svelte:10` — `void hydrateShellStores()`. No try/catch. `hydrateShellStores()` opens IDB and populates `$settings`, `$allItems`, `$allSessions`.
- **Confidence:** High
- **Implication:** Storage quota error, private-mode IDB restriction, or schema upgrade failure → entire app silently shows 0% mastery, 0-day streak, empty dashboard. No error banner. No toast. User thinks they lost all data.

### Finding 2: `startRound()` errors silently swallowed (CRITICAL)
- **Evidence:** `ActiveRound.svelte:45-47` — `onclick={async function start() { await controller.startRound(); }}`. No try/catch. `startRound()` can throw for mic permission denial, AudioContext failure, worklet load error.
- **Confidence:** High
- **Implication:** User clicks "Start round," nothing happens. No error message. No indication of what failed or whether to try again.

### Finding 3: `.catch(() => {})` re-introduced on pitch/KWS stop (CRITICAL)
- **Evidence:** `session-controller.svelte.ts:345-346` — `this.#pitchHandle?.stop().catch(() => {})` and `this.#kwsHandle?.stop().catch(() => {})`. Identical pattern caught and fixed in PR #76. Re-introduced here.
- **Confidence:** High
- **Implication:** If KWS stop throws before nulling `activeStop`, the next `startKeywordSpotter()` hangs forever. No digit recognition for the rest of the session without a page reload.

### Finding 4: AudioContext created per round — Chrome throttles at ~6 (CRITICAL)
- **Evidence:** `+page.svelte:50` — `getAudioContext: () => new AudioContext()`. Called in `startRound()` once per round. Contexts are never closed.
- **Confidence:** High
- **Implication:** Chrome enforces ~6 concurrent AudioContext limit. Round 7+ fails silently with no audio and no error. A 30-round session is completely broken after the first few rounds.

### Finding 5: Playback Promise chains have no `.catch()` — round state can freeze (HIGH)
- **Evidence:** `session-controller.svelte.ts:253-254` — `void this.#playHandle.targetStartAtAcTime.then(() => {...})` and `:258-260` — `void this.#playHandle.done.then(() => {...})`. Both have no `.catch()`.
- **Confidence:** High
- **Implication:** If Tone.js rejects (AudioContext closed mid-playback), `TARGET_STARTED` or `PLAYBACK_DONE` never fires. State machine stalls at `playing_cadence` forever. Only recovery is page reload.

### Finding 6: `onboarding.finish()` fully unguarded — infinite loop risk (HIGH)
- **Evidence:** `StepWarmupRound.svelte:52-70` — 7 sequential async IDB ops with no error handling. If `settings.update({ onboarded: true })` fails, in-memory store updates but IDB doesn't. Next load reads `onboarded: false`, redirects to `/onboarding`.
- **Confidence:** High
- **Implication:** User stuck in infinite onboarding loop with no message. Alternative failure: if `putMany(seeds)` fails, user is onboarded with no starter curriculum.

### Finding 7: `sessionsRepo.complete()` unguarded — in-memory/DB split (HIGH)
- **Evidence:** `session-controller.svelte.ts:291, 310` — unguarded IDB write. On failure, in-memory `session.ended_at` is set. Next page load finds `ended_at == null` in IDB, re-enters "active" session.
- **Confidence:** High
- **Implication:** User repeats a completed session. Progress is double-counted.

### Finding 8: Subscriber unsubscribe functions discarded — memory leak (HIGH)
- **Evidence:** `session-controller.svelte.ts:226, 231` — `this.#pitchHandle.subscribe(...)` and `this.#kwsHandle.subscribe(...)` discard the returned unsubscribe function. Subscriber closures capture `this`.
- **Confidence:** High
- **Implication:** 60 orphaned subscriber references per 30-round session. If stop fails (Finding 3), callbacks fire into disposed controller.

### Finding 9: `windowStartMs = 0` stub produces broken pitch trace (HIGH)
- **Evidence:** `ActiveRound.svelte:17-21` — `const windowStartMs = 0`, `const getNowMs = () => 0`. Frames use `at_ms = Date.now()`. `timeToX(Date.now()) = (1.7e12) / 5000 >> 480px` → clamped to rightmost pixel.
- **Confidence:** High
- **Implication:** The pitch trace visualization is broken for all users: all frames appear as a dot at the right edge of the canvas.

### Finding 10: `SettingsPage.update()` and `performReset()` unguarded (HIGH)
- **Evidence:** `SettingsPage.svelte:9-26` — both functions have no try/catch.
- **Confidence:** High
- **Implication:** Setting change silently fails to persist (checkbox toggles, next reload reverts). Reset fails with modal stuck open, DB potentially partially cleared.

### Finding 11: `onMount` in `StepWarmupRound` unguarded + mic stream leak (MEDIUM)
- **Evidence:** `StepWarmupRound.svelte:30-48` — unguarded async onMount. If IDB fails, controller stays `null`, "Preparing…" spinner never resolves. `getMicStream()` returns `handle.stream` but discards `handle.stop` — MediaStream tracks never individually stopped.
- **Confidence:** High
- **Implication:** Onboarding gets stuck with no message. Mic resource leak per onboarding run.

### Finding 12: Service worker `registerSW` has no `onRegisterError` (MEDIUM)
- **Evidence:** `+layout.svelte:13` — `registerSW({ immediate: true })` with no error callbacks.
- **Confidence:** High
- **Implication:** SW registration failures are silent. TF model is re-fetched over the network every session without the user knowing offline/PWA support is unavailable.

## Clean Paths (correct error handling)

- `session-controller.svelte.ts:145-168` — persistence try/catch correctly catches IDB errors, logs, updates `degradationState`, keeps counters consistent
- `session-controller.svelte.ts:229-241` — KWS startup try/catch gracefully degrades with `kwsUnavailable: true`
- `StepMicPermission.svelte:12-20` — catches mic permission errors, shows actionable message
- `+page.svelte:78-85` — `onNext` handler catches advance failures, logs, shows toast
- `kws-loader.ts:23-26` — nulls cache on failure so transient CDN errors don't permanently lock a failed Promise

## Surprises

- The `.catch(() => {})` pattern was explicitly caught by julianken-bot in PR #76, fixed, and then re-introduced in `session-controller.svelte.ts` in C1 — agents don't retain memory of prior corrections
- The `void hydrateShellStores()` pattern is the exact same failure mode as the `void` async calls in the component-level handlers

## Raw Evidence

- Files read: `+layout.svelte`, `ActiveRound.svelte`, `session-controller.svelte.ts`, `StepWarmupRound.svelte`, `SettingsPage.svelte`, `+page.svelte` (session route)
- GitHub PR history: PR #76 (KWS catch bug), PR #101 (IDB Proxy DataCloneError)
