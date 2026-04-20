# Phase 2 · Iterator 3 — Silent Failure Blast Radius

**Scope:** Verify the four critical silent failures from Phase 1, establish real trigger conditions, measure existing mitigations, and assess user experience under each failure mode.

---

## Finding 1: `void hydrateShellStores()` in `+layout.svelte:10`

### Code path verified

`+layout.svelte:10` calls `void hydrateShellStores()` inside `onMount`. No try/catch. `hydrateShellStores()` in `stores.ts:42-52` calls `getDeps()`, which calls `openEarTrainingDB()` via the idb library, then does three concurrent IDB reads: `settings.getOrDefault()`, `items.listAll()`, `sessions.findRecent(200)`. If any of these reject, the entire Promise rejects — but it is discarded by `void`.

When the call fails:
- `settings` store stays at `DEFAULT_SETTINGS`
- `allItems` store stays at `[]`
- `allSessions` store stays at `[]`

No flag is set. No toast is pushed. No banner message fires. `degradationState` is not updated.

### Real trigger conditions

1. **Private/incognito browsing on Safari and some Firefox versions**: IndexedDB is either blocked or throws `InvalidStateError` during `openDB`. This is a common production condition — users who open the app in a private tab for the first time hit this immediately.

2. **Storage quota exceeded**: Chrome throws `QuotaExceededError` on `openDB` or on any write once the origin's storage quota is full. A user who has trained across many sessions can hit this.

3. **IDB schema upgrade path failure**: If `openEarTrainingDB()` encounters a version conflict (e.g., a corrupted or partially-upgraded DB), the `openDB` call rejects before any reads run.

4. **`+layout.ts` load() failure (separate but related)**: `+layout.ts:8-13` also calls `getDeps()` with no try/catch. If IDB fails here, SvelteKit will catch the uncaught rejection from the `load()` function and render an unstyled error page — because there is no `+error.svelte` in the routes tree. Confirmed: `find /src/routes -name "+error*"` returns nothing. The user sees a raw browser error page.

### Existing mitigations

None for the `onMount` path. The `degradationState.persistenceFailing` flag exists but is only set by the session controller's per-round persistence catch block — not by the initial hydration failure. There is a `DegradationBanner` component in the shell, but it has no flag for hydration failure.

For the `+layout.ts` path: SvelteKit's framework-level error boundary catches uncaught `load()` errors. Since no `+error.svelte` exists, the default SvelteKit error page renders — completely unstyled, no app chrome.

### User experience

The app loads and renders normally. Every reactive component that reads `$settings`, `$allItems`, or `$allSessions` gets default/empty values silently. The dashboard shows no mastery bars, no streak, zero history. The user believes they have no progress. If they start a session, the scheduler reads `allItems` which is empty, so the session page shows "No items are due right now." The user is effectively locked out of training with no explanation.

### Severity: CRITICAL

The failure is invisible, the user experience is actively misleading (app appears to have no data rather than an error), and it occurs reliably under private browsing.

---

## Finding 2: `startRound()` errors swallowed in `ActiveRound.svelte:45-47`

### Code path verified

`ActiveRound.svelte:45-47`:

```ts
async function start() {
  await controller.startRound();
}
```

Called via `onclick={start}` at line 77. No try/catch.

`startRound()` in `session-controller.svelte.ts:194-268` can throw from multiple sites:
- `deps.getMicStream()` at line 200 — `requestMicStream()` in `permission.ts` throws on denial (`NotAllowedError`) or when the API is absent (`code: 'unavailable'`). The `getMicStream` lambda in the session page does not have error handling around `requestMicStream()` either.
- `startPitchDetector()` at line 224 — throws if the AudioWorklet module fails to load (network error, or if the `AudioContext` is in a suspended/closed state).
- `startAudioRecorder()` at line 243 — throws if worklet registration fails.
- `deps.itemsRepo.listAll()` at line 203 — throws on IDB failure.
- The dynamic imports (`playRound`, etc.) at lines 216-222 — throws on network failure if a lazy chunk fails to load.

When any of these throw, the Promise rejects, the `start()` function propagates the rejection to the event handler, and the browser converts it to an unhandled promise rejection. The UI state does not change: the "Start round" button remains visible, the state stays `idle`, and the user has no feedback.

### The second `startRound` call path

`+page.svelte:80` calls `await c.startRound()` inside a try/catch with `pushToast({ message: 'Could not advance. Try again.', level: 'error' })`. This path (after FeedbackPanel's "Next" action) IS handled. The gap is specifically the initial "Start round" button in `ActiveRound.svelte`.

### Existing mitigations

The FeedbackPanel's "Next" path in `+page.svelte` has error handling. The mic-denied state is checked before the controller is even created in `onMount`, but only for the pre-session permission query — not for mid-session denial (e.g., the user revokes mic access during training). The `#stopAudioHandles` cleanup on `cancelRound` and `dispose` exists, but does not help when `startRound` itself throws.

### User experience

User clicks "Start round." Nothing happens. No spinner stops, no error message, no toast. If the failure was `NotAllowedError` (mic revoked mid-session), the button sits there and every subsequent click throws the same error. The controller state never advances from `idle`, so the UI is permanently stuck showing the start button. The user's only recovery path is a full page reload.

### Severity: CRITICAL

The onclick handler for the primary CTA in the core user flow has no error handling. Any synchronous or async failure in `startRound()` is a silent stuck-UI condition.

---

## Finding 3: `.catch(() => {})` on pitch/KWS stop at `session-controller.svelte.ts:345-346`

### Code path verified

`#stopAudioHandles()` at lines 339-352:

```ts
this.#pitchHandle?.stop().catch(() => {});
this.#kwsHandle?.stop().catch(() => {});
```

Called from `cancelRound()`, `dispose()`, and transitively from `next()` when `#stopAudioHandles` needs cleanup.

**Pitch handle stop path**: `PitchDetectorHandle.stop()` in `pitch-detector.ts:52-56` calls `source.disconnect()`, `node.port.onmessage = null`, `node.disconnect()`. These are synchronous DOM operations. The only realistic throw is if the AudioContext is already closed, which would produce an `InvalidStateError`. This error is swallowed. The worklet node remains connected and continues posting frames to `node.port.onmessage` which is now null — frames are silently dropped, no crash.

**KWS handle stop path**: `KeywordSpotterHandle.stop()` at lines 180-199 nulls `activeHandle`, `activePromise`, `activeThresholds`, then creates `activeStop` as an IIFE that awaits `recognizer.stopListening()`. If `stopListening()` throws, the `finally` block runs (`activeStop = null`), and the throw propagates to the outer `await activeStop`. The `.catch(() => {})` in `#stopAudioHandles` catches this.

**Result after a KWS stop failure**: `activeHandle = null`, `activeStop = null`, `activeThresholds = null`, but `recognizer` may still be internally streaming. The next `startKeywordSpotter()` call in the next round's `startRound()` will execute `_createHandle()`, which checks `if (activeStop) await activeStop` — `activeStop` is null, so it skips the serialization guard. It then calls `recognizer.listen()` on a recognizer that may still be listening. The speech-commands library throws "Cannot start streaming again when streaming is ongoing." This throw is caught by the try/catch at `session-controller.svelte.ts:229-241` and sets `kwsUnavailable: true`. The DegradationBanner shows "Speech recognition unavailable — you can still sing the note." The round continues without digit recognition.

So the KWS failure cascades into a degraded-mode session, not a complete failure. However:
1. The root cause (stopListening failure) is swallowed and never logged.
2. The user sees the degradation message without knowing it was caused by a prior KWS stop failure.
3. Developers debugging this will never find it in logs.

### Real trigger conditions

1. **KWS stop failure**: The speech-commands library's `stopListening()` rejects if the recognizer was never in a listening state (e.g., was already stopped by the library itself on an internal error, or if the AudioContext feeding it was closed). This is more likely after a page backgrounding event on mobile where the browser may have suspended audio.

2. **Pitch stop failure**: Less likely on desktop; more likely on mobile where the AudioContext for the worklet may be suspended or closed by the browser when the page is backgrounded.

### Existing mitigations

The KWS failure path has a partial mitigation — the existing try/catch around `startKeywordSpotter()` in `startRound()` catches the "streaming ongoing" error and sets the degradation flag. But this mitigates the *symptom* of the swallowed stop error, not the stop error itself.

### User experience

Normal rounds work fine unless the KWS stop fails. If it does: next round shows "Speech recognition unavailable" in the DegradationBanner. User cannot say digits to grade rounds. Progress still logs for pitch, but label grades are always null. Subsequent rounds in the session have the same degradation. No indication of what happened or how to recover (reloading would reset the KWS module state).

### Severity: HIGH

Not a complete silent failure (the cascade path surfaces the degradation), but the root error is never logged, making debugging impossible. The user experience is confusing — the banner appears suddenly with no causal link to any user action.

---

## Finding 4: `new AudioContext()` per round — Chrome throttle behavior

### Code path verified

`+page.svelte:50`: `getAudioContext: () => new AudioContext()` — a new lambda that creates a fresh `AudioContext` on every invocation.

`session-controller.svelte.ts:199`: `const ctx = deps.getAudioContext();` — called at the start of every `startRound()` call.

The context is passed to `startPitchDetector` (line 224) and `startAudioRecorder` (line 243). Neither stores a reference that outlives the round. `#stopAudioHandles()` does not call `ctx.close()`. Confirmed: zero `ctx.close()`, `audioContext.close()`, or `context.close()` calls exist anywhere in the codebase.

### Chrome's actual behavior

Chrome enforces a limit of approximately 6 concurrent `AudioContext` instances per page (the exact number is browser-version-dependent; Chrome 116+ may allow more, but the spec-recommended limit is 6). When the limit is reached:

- `new AudioContext()` does **not** throw. It returns an `AudioContext` in `suspended` state.
- The context never auto-resumes. All scheduling on it is a no-op.
- Tone.js, which is initialized separately, continues to work because it uses its own context.
- `audioContext.audioWorklet.addModule()` resolves (worklets can be added to suspended contexts).
- `new AudioWorkletNode(ctx, 'yin-processor')` succeeds without throwing.
- The worklet's `process()` method is never called because the context is suspended.
- `node.port.onmessage` never fires.

The user experience: audio playback works (Tone uses its own context). The pitch trace shows nothing — all frames have `hz: 0, confidence: 0`. After 5 seconds, the capture timeout fires, `gradeListeningState` runs with empty frames, and the round is graded as pitch-fail. The digit channel may still work (KWS has its own internal audio stream). The user is graded wrong on every round silently.

Additionally, Chrome emits a console warning: "The number of AudioContext objects has exceeded the recommended limit. Please close some AudioContexts." This warning is the **only** indication of the problem — there is no in-app error, no toast, no degradation flag for this condition.

### Real trigger conditions

A session of 10 items creates 10 `AudioContext` instances. The default session length (from the spec and existing tests) is 10 items. A user completing their first session exhausts the context budget on the first session. After round 6, all remaining rounds in the session silently grade as pitch-fail.

This is not an edge case. This is the **default happy path** for a complete session.

### Existing mitigations

None. `degradationState` has no `audioContextThrottled` flag. The `consecutiveNullCount` store increments when pitch frames have low confidence, and there is a `PitchNullHint` component (`PitchNullHint.svelte` exists in the component tree) — but a suspended `AudioContext` produces zero frames, not low-confidence frames. `consecutiveNullCount` is only incremented in `_onPitchFrame()`, which is only called when the worklet posts a frame. A suspended context never posts frames, so `consecutiveNullCount` stays at 0. The hint does not fire.

### User experience

Session feels normal for the first 5-6 rounds. Starting at round 7 (or whenever the 6th context is created), pitch detection silently stops. The PitchTrace canvas shows nothing. The round auto-times out after 5 seconds and grades pitch as fail. The user thinks they are singing poorly. Over multiple sessions, the `allItems` SRS data accumulates incorrect fail grades, degrading their learning schedule. The user has no mechanism to discover the problem without opening DevTools.

### Severity: CRITICAL

This is a deterministic failure on the default happy path (completing a full session). The failure silently corrupts SRS data with incorrect pitch-fail grades. The user's only observable symptom is that they seem to be "failing" rounds they feel they sang correctly. No existing mitigation.

---

## Error surface inventory

The app has three designed error surfaces:

1. **`DegradationBanner`** — shows messages for `kwsUnavailable`, `persistenceFailing`, `micLost`. Wired to `degradationState` in `stores.ts`. `micLost` is declared in the type but **never set to `true` anywhere in production code** — it is a dead flag.

2. **`ShellToast`** — `pushToast()` is available from `stores.ts`. Only called in one location: the FeedbackPanel "Next" handler in `+page.svelte:82`. No other error paths use it.

3. **SvelteKit framework error boundary** — catches uncaught errors in `load()` functions. Since no `+error.svelte` exists, it renders the default unstyled SvelteKit error page. This is the only handler for `+layout.ts` IDB failures.

**Missing surfaces:**
- No `+error.svelte` for styled error recovery
- No `window.onerror` or `unhandledrejection` handler
- No Sentry / `logError` / `errorIds.ts` infrastructure (the CLAUDE.md references these as project standards, but none exist in the codebase)
- No error surface for AudioContext throttling
- No error surface for hydration failure

---

## Cross-cutting observation: `micLost` is a dead flag

`DegradationState.micLost` is declared in `stores.ts:12`, initialized `false` in line 17, displayed in `DegradationBanner.svelte:7`, and tested in `DegradationBanner.test.ts:25`. But no production code ever sets it to `true`. The banner message "Microphone disconnected — reconnect to continue." can never appear. This is a designed feature that was never wired up.

---

## Summary table

| Finding | Real trigger frequency | Existing mitigation | User experience |
|---|---|---|---|
| `void hydrateShellStores()` | Every private/incognito session; any quota event | None | App shows empty, user believes they have no data |
| `startRound()` in ActiveRound | Mic revoked mid-session; network failure; AudioContext suspended | FeedbackPanel "Next" path has handling; initial button does not | UI stuck on "Start round" forever, no feedback |
| `.catch(()=>{})` on KWS stop | Mobile backgrounding; AudioContext closure | Cascade catches "streaming ongoing" on next round, sets kwsUnavailable | Degradation banner without root-cause explanation |
| `new AudioContext()` per round | Round 7+ of any complete session (default: 10 rounds) | None — `consecutiveNullCount` does not fire | Silent pitch-fail on every late round; SRS data corrupted |
