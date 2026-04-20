# Investigation: Performance & PWA Quality

## Key Findings

### Finding 1: tfjs + Tone.js in eager static import graph (~1.1 MiB before first render)
- **Evidence:** `digit-label.ts:1` static-imports `keyword-spotter.ts` which static-imports `kws-loader.ts` which has `import '@tensorflow/tfjs-backend-webgl'` (side-effect). Despite the session controller using dynamic `await import()`, the 876 KiB tfjs + 238 KiB Tone.js chunks are in the eager static module graph.
- **Confidence:** High
- **Fix:** Inline `DIGIT_LABELS` in `digit-label.ts` (it's a const string array — no need to import from `keyword-spotter.ts`). Breaking this static chain allows the ~1.1 MiB chunk to remain deferred.
- **Implication:** The app parses ~1.1 MiB of JS before any UI renders. This is the most impactful LCP regression available.

### Finding 2: `new AudioContext()` per round — Chrome throttles at ~6 (overlaps Area 4)
- **Evidence:** `+page.svelte:50` and `StepWarmupRound.svelte:41` — factory `() => new AudioContext()`. Session controller calls this in `startRound()` once per round. Contexts never closed.
- **Confidence:** High
- **Fix:** Cache a single `AudioContext` at page/session level. The `pitchAudioContext` module-level cache in `src/harness/audio-harness.ts` is the correct model.
- **Implication:** 30-round session leaks ~30 AudioContexts. Chrome silences audio after ~6.

### Finding 3: Recorder worklet allocates in `process()` (minor)
- **Evidence:** `packages/web-platform/src/mic/recorder-worklet.ts:29, 52` — `this.ring.slice(0, this.writeIndex)` inside `process()`. Allocates on capture end (not every quantum), so not hot-path GC pressure.
- **Confidence:** Medium — departure from documented discipline, not a measured perf regression
- **Implication:** Inconsistency with YIN worklet's documented "allocation-free in process()" discipline. Low severity given non-hot-path timing.

### Finding 4: Harness HTML ships in production build
- **Evidence:** `static/harness/audio.html` is in SvelteKit's static root. `adapter-static` copies everything in `static/` to output. The file exists at `.svelte-kit/output/client/harness/audio.html`.
- **Confidence:** High
- **Implication:** Dev tool is deployed to production. Anyone who knows the URL can access the audio harness. CLAUDE.md states "keep harness dev-only" but the current placement violates this.

### Finding 5: iOS Safari standalone dark-mode status bar not handled
- **Evidence:** `src/app.html` — has `<meta name="theme-color" content="#0a0a0a">` (correct) but missing `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">`. iOS Safari ignores `theme_color` in standalone PWA mode.
- **Confidence:** High
- **Implication:** iOS PWA installs show a white status bar over dark content.

### Finding 6: SW `registerSW` has no `onRegisterError` (overlaps Area 4)
- **Evidence:** `+layout.svelte:13` — `registerSW({ immediate: true })` with no error callbacks.
- **Confidence:** High
- **Implication:** SW registration failures are silent. TF model re-fetched over network every session.

## Good Patterns

- **YIN worklet scratch buffer preallocated:** `yin-worklet.ts:39` — `private readonly scratch: Float32Array = new Float32Array(2048)`. `process()` reuses it via `.set()`. Correct audio-thread discipline.
- **`loadKwsRecognizer` promise memoization:** `kws-loader.ts:7-27` — collapses concurrent callers, nulls cache on failure. Correct pattern for expensive async resource loads.
- **SW uses `skipWaiting` + `clientsClaim` + `cleanupOutdatedCaches`:** Updated app versions are activated immediately. Correct for an audio PWA where stale JS could cause worklet mismatches.
- **Bundle budgets enforced by CI:** 2 MiB client + 50 KiB SW budgets in `bundle-size.yml`. Current sizes: ~1.26 MiB client, ~24.6 KiB SW — within budget.
- **KWS model runtime cache:** `vite.config.ts:80-95` — `CacheFirst` for `tfhub.dev` + `storage.googleapis.com/tfjs-models` with 30-day expiry. Correct offline-first strategy for the ~3 MB model.

## Surprises

- The dynamic import architecture in `session-controller.svelte.ts` was correct, but a single static import two modules upstream (in `digit-label.ts`) defeats it entirely
- The harness is in `static/` despite CLAUDE.md explicitly saying it should be "deliberately OUTSIDE of public/" — the two conventions (SvelteKit `static/` vs Vite `public/`) were conflated during C1

## Raw Evidence

- Files read: `vite.config.ts`, `src/app.html`, `src/routes/+layout.svelte`, `packages/web-platform/src/speech/digit-label.ts`, `packages/web-platform/src/speech/kws-loader.ts`, `packages/web-platform/src/pitch/yin-worklet.ts`, `packages/web-platform/src/mic/recorder-worklet.ts`, `static/harness/audio.html`
- Build output: 1,322,654 bytes client (~1.26 MiB), 25,231 bytes SW (~24.6 KiB)
