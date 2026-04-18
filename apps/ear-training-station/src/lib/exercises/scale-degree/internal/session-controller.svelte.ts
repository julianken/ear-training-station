import { roundReducer } from '@ear-training/core/round/state';
import type { RoundState } from '@ear-training/core/round/state';
import type { RoundEvent } from '@ear-training/core/round/events';
import type { Item, Session, Settings, Register } from '@ear-training/core/types/domain';
import type {
  ItemsRepo, AttemptsRepo, SessionsRepo, SettingsRepo,
} from '@ear-training/core/repos/interfaces';
import type { PlayRoundHandle } from '@ear-training/web-platform/audio/player';
import type { PitchDetectorHandle } from '@ear-training/web-platform/pitch/pitch-detector';
import type { KeywordSpotterHandle } from '@ear-training/web-platform/speech/keyword-spotter';
import type { RecorderHandle } from '@ear-training/web-platform/mic/recorder';
import { gradeListeningState } from '@ear-training/core/round/grade-listening';
import { pickTimbre, pickRegister, type VariabilityHistory, type TimbreId } from '@ear-training/core/variability/pickers';
import { availableRegisters } from '@ear-training/core/scheduler/register-gating';
import { selectNextItem } from '@ear-training/core/scheduler/selection';
import type { RoundHistoryEntry } from '@ear-training/core/scheduler/interleaving';
import { buildAttemptPersistence } from '@ear-training/core/round/persistence';
import { nextBoxOnPass, nextBoxOnMiss } from '@ear-training/core/srs/leitner';
import { SvelteMap } from 'svelte/reactivity';
import { allItems, consecutiveNullCount, degradationState } from '$lib/shell/stores';

export interface SessionControllerDeps {
  session: Session;
  firstItem: Item;
  itemsRepo: ItemsRepo;
  attemptsRepo: AttemptsRepo;
  sessionsRepo: SessionsRepo;
  settingsRepo: SettingsRepo;
  getAudioContext: () => AudioContext;
  getMicStream: () => Promise<MediaStream>;
  /** Optional rng for testability; defaults to Math.random. */
  rng?: () => number;
}

export interface SessionController {
  readonly state: RoundState;
  readonly session: Session | null;
  readonly currentItem: Item | null;
  readonly capturedAudio: AudioBuffer | null;
  readonly targetAudio: AudioBuffer | null;
  startRound(): Promise<void>;
  cancelRound(): void;
  next(): Promise<void>;
  dispose(): void;
  /** @internal — test hook */
  _forceState(state: RoundState): void;
  /** @internal — test hook */
  _forceTimer(id: number): void;
  /** @internal — test hook */
  _checkCaptureEnd(): void;
  /** @internal — test hook for variability picker integration */
  _pickVariability(items: ReadonlyArray<Item>): { timbre: TimbreId; register: Register };
  /** @internal — test hook: simulate a pitch frame arriving from the detector */
  _onPitchFrame(frame: { hz: number; confidence: number }): void;
  /** @internal — test hook: set the running pitch/label pass counters directly,
   *  to simulate the effect of persistence having run during _forceState tests */
  _forceRunningCounters(pitch: number, label: number): void;
  /** @internal — test hook: read the current running pitch/label pass counters
   *  and roundIndex to verify consistency after persistence failures */
  _getRunningCounters(): { pitch: number; label: number; roundIndex: number };
  /** @internal — test hook: seed the scheduler's round history (interleaving state)
   *  so anti-repeat behavior can be exercised without going through full dispatch. */
  _seedRoundHistory(entries: ReadonlyArray<RoundHistoryEntry>): void;
  /** @internal — test hook: inject a settings snapshot without running
   *  startRound(). Lets tests exercise settings-gated code paths
   *  (auto_advance_on_hit=false) while still using _forceState() fixtures. */
  _forceSettings(settings: Settings): void;
}

export function createSessionController(deps: SessionControllerDeps): SessionController {
  class ControllerImpl implements SessionController {
    state = $state<RoundState>({ kind: 'idle' });
    session = $state<Session | null>(deps.session);
    currentItem = $state<Item | null>(deps.firstItem);
    capturedAudio = $state<AudioBuffer | null>(null);
    targetAudio = $state<AudioBuffer | null>(null);

    #playHandle: PlayRoundHandle | null = null;
    #pitchHandle: PitchDetectorHandle | null = null;
    #kwsHandle: KeywordSpotterHandle | null = null;
    #recorderHandle: RecorderHandle | null = null;
    #captureEndTimer: number | null = null;
    #disposed = false;
    #renderToken: number = 0;
    #history: VariabilityHistory = { lastTimbre: null, lastRegister: null };
    // Round-history for the Leitner + interleaving scheduler. Populated on
    // each successful graded transition so selectNextItem() can enforce
    // "no same degree back-to-back" + "no same key for >3 consecutive rounds".
    #roundHistory: RoundHistoryEntry[] = [];
    #rng: () => number = deps.rng ?? Math.random;
    // One AudioContext per session, created lazily on the first startRound()
    // and reused for every round. Chrome caps concurrent contexts at ~6; a
    // fresh context per round silently exhausts the budget and breaks the
    // pitch worklet (every round grades as pitch-fail, corrupting SRS).
    #audioContext: AudioContext | null = null;

    // Persistence state — maintained across rounds
    #reviewsInBox: SvelteMap<string, number> = new SvelteMap();
    #roundIndex: number = deps.session.completed_items;
    #pitchPasses: number = deps.session.pitch_pass_count;
    #labelPasses: number = deps.session.label_pass_count;
    // Target hz stored at startRound time for use in attempt persistence
    #currentTargetHz: number = 0;
    // User settings — loaded lazily on first startRound() from settingsRepo.
    // Null until the first round starts. Once loaded, reused for the life of
    // the session (changes during a session don't take effect until the next
    // session; the Settings screen writes back to IDB so the next session
    // picks up the new value on its own first-round load).
    #settings: Settings | null = null;

    async #dispatch(event: RoundEvent): Promise<void> {
      const prev = this.state.kind;
      this.state = roundReducer(this.state, event);
      const curr = this.state.kind;

      if (prev === 'listening' && curr === 'graded') {
        // Clear the 5-second capture-end timer so it doesn't fire during a
        // future round if next() is called before the timeout expires.
        if (this.#captureEndTimer != null) {
          clearTimeout(this.#captureEndTimer);
          this.#captureEndTimer = null;
        }
        // Stop the recorder and attach the buffer
        if (this.#recorderHandle) {
          try {
            this.capturedAudio = await this.#recorderHandle.stop();
          } catch { /* ignore */ }
        }

        // Persist the attempt and update item SRS state.
        // Use at_ms from the CAPTURE_COMPLETE event as the clock source.
        // $state-backed state exposes fields as reactive Proxies, which IndexedDB's
        // structured-clone cannot serialize. Snapshot at the boundary.
        const gradedState = $state.snapshot(this.state) as Extract<RoundState, { kind: 'graded' }>;
        const item = gradedState.item;
        const now = event.type === 'CAPTURE_COMPLETE' ? event.at_ms : Date.now();
        const pitchOk = gradedState.outcome.pitch;
        const labelOk = gradedState.outcome.label;

        const prevReviews = this.#reviewsInBox.get(item.id) ?? 0;
        // Compute nextBox to determine reviewsInCurrentBox
        const consecutivePassesAfter = pitchOk && labelOk ? item.consecutive_passes + 1 : 0;
        const nextBox = pitchOk && labelOk
          ? nextBoxOnPass(item.box, consecutivePassesAfter)
          : nextBoxOnMiss(item.box);
        const reviewsInCurrentBox = nextBox === item.box ? prevReviews + 1 : 0;

        const { attempt, updatedItem } = buildAttemptPersistence({
          item,
          sessionId: deps.session.id,
          roundIndex: this.#roundIndex,
          reviewsInCurrentBox,
          now,
          target: { hz: this.#currentTargetHz },
          sung: {
            hz: gradedState.sungBest?.hz ?? null,
            cents_off: gradedState.cents_off,
            confidence: gradedState.sungBest?.confidence ?? 0,
          },
          spoken: {
            digit: gradedState.digitHeard,
            confidence: gradedState.digitConfidence,
          },
          pitchOk,
          labelOk,
          timbre: gradedState.timbre,
          register: gradedState.register,
        });

        try {
          await deps.attemptsRepo.append(attempt);
          await deps.itemsRepo.put(updatedItem);
          // Mirror the updated item into the in-memory read model so the
          // dashboard reflects the new state without a hard reload.
          allItems.update((items) => {
            const idx = items.findIndex((i) => i.id === updatedItem.id);
            if (idx === -1) return [...items, updatedItem];
            const copy = [...items];
            copy[idx] = updatedItem;
            return copy;
          });
          // Update running counters only after both writes succeed — keeps
          // controller state consistent with the DB on partial failure.
          this.#reviewsInBox.set(item.id, reviewsInCurrentBox);
          this.#roundIndex++;
          if (pitchOk) this.#pitchPasses++;
          if (labelOk) this.#labelPasses++;
          // Record the completed round so the scheduler can enforce
          // interleaving (no same-degree back-to-back, no >3 same-key streak).
          this.#roundHistory.push({
            itemId: item.id,
            degree: item.degree,
            key: item.key,
          });
        } catch (e) {
          // Persistence failed — leave counters at pre-round values so controller
          // state stays consistent with the DB. Surface the failure to the shell banner.
          console.error('session-controller: persistence failed, round not counted', e);
          degradationState.update((s) => ({ ...s, persistenceFailing: true }));
        }
      }

      this.#onStateChange();
    }

    #onStateChange(): void {
      if (this.state.kind === 'listening') {
        this._checkCaptureEnd();
      }
    }

    _checkCaptureEnd(): void {
      if (this.state.kind !== 'listening') return;
      const thresholds = { minPitchConfidence: 0.5, minDigitConfidence: 0.5 };
      const grade = gradeListeningState(this.state, this.currentItem!, thresholds);
      // Auto-advance on hit — early transition from listening→graded without
      // waiting for the 5s capture window to close. Gated on the user's
      // `auto_advance_on_hit` setting. When OFF, the listening window runs
      // the full 5s and the timeout in startRound() fires CAPTURE_COMPLETE.
      // When #settings is null (setting not yet loaded, or controller in a
      // harness/test path that skipped startRound), default to true — matches
      // DEFAULT_SETTINGS.auto_advance_on_hit and preserves existing behavior
      // for the unit tests that force a listening state directly.
      const autoAdvance = this.#settings?.auto_advance_on_hit ?? true;
      if (autoAdvance && grade.outcome.pass) {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises -- #dispatch is the internal event reducer; it transitions state and handles its own error paths. Awaiting from this sync subscription/grader callback would require async event handlers and is architecturally incorrect.
        this.#dispatch({ type: 'CAPTURE_COMPLETE', at_ms: Date.now(), grade });
      }
      // Capture timeout is handled in startRound() via a setTimeout to ~5s
      // past PLAYBACK_DONE. If fired without a pass, dispatch CAPTURE_COMPLETE
      // with whatever grade the state produces (may be fail).
    }

    async startRound(): Promise<void> {
      if (this.#disposed) return;
      if (this.state.kind !== 'idle') return; // guard against double-start
      if (this.currentItem == null) return;

      // Increment the render token so any in-flight renderTargetBuffer()
      // from a prior canceled round will be discarded when it resolves.
      this.#renderToken++;
      this.targetAudio = null;

      // Load user settings lazily on the first round, then reuse for the life
      // of the session. settingsRepo.getOrDefault() falls back to
      // DEFAULT_SETTINGS if IDB read fails or the row is absent, so we never
      // block the round on a settings read — any failure inside the repo
      // surfaces as defaults rather than an exception here.
      if (this.#settings == null) {
        this.#settings = await deps.settingsRepo.getOrDefault();
      }

      // Create the session AudioContext lazily on the first round, then reuse
      // it for every subsequent round. Closed in dispose().
      if (this.#audioContext == null) {
        this.#audioContext = deps.getAudioContext();
      }
      const ctx = this.#audioContext;
      const stream = await deps.getMicStream();

      // Pick timbre and register via variability pickers (no monoculture)
      const allItems = await deps.itemsRepo.listAll();
      const { timbre, register } = this._pickVariability(allItems);

      // Dispatch ROUND_STARTED synthetically
      // eslint-disable-next-line @typescript-eslint/no-floating-promises -- #dispatch is the internal event reducer; it transitions state and handles its own error paths. Awaiting here would serialize reducer work with audio setup below; fire-and-forget is the intended shape.
      this.#dispatch({
        type: 'ROUND_STARTED',
        at_ms: Date.now(),
        item: this.currentItem,
        timbre,
        register,
      });

      // Lazy-load the audio handles (web-platform modules)
      const { playRound, renderTargetBuffer } = await import('@ear-training/web-platform/audio/player');
      const { startPitchDetector } = await import('@ear-training/web-platform/pitch/pitch-detector');
      const { startKeywordSpotter } = await import('@ear-training/web-platform/speech/keyword-spotter');
      const { startAudioRecorder } = await import('@ear-training/web-platform/mic/recorder');
      const { buildCadence } = await import('@ear-training/core/audio/cadence-structure');
      const { buildTarget } = await import('@ear-training/core/audio/target-structure');
      const { digitLabelToNumber } = await import('@ear-training/web-platform/speech/digit-label');

      this.#pitchHandle = await startPitchDetector({ audioContext: ctx, micStream: stream });
      this.#pitchHandle.subscribe((frame) => {
        this._onPitchFrame(frame);
      });

      try {
        this.#kwsHandle = await startKeywordSpotter({});
        this.#kwsHandle.subscribe((frame) => {
          if (frame.digit == null) return;
          // eslint-disable-next-line @typescript-eslint/no-floating-promises -- #dispatch is the internal event reducer; it transitions state and handles its own error paths. Awaiting from this synchronous KWS subscription callback would require an async event handler and is architecturally incorrect.
          this.#dispatch({
            type: 'DIGIT_HEARD', at_ms: Date.now(),
            digit: digitLabelToNumber(frame.digit),
            confidence: frame.confidence,
          });
        });
      } catch {
        degradationState.update((s) => ({ ...s, kwsUnavailable: true }));
      }

      this.#recorderHandle = await startAudioRecorder({ audioContext: ctx, micStream: stream, maxDurationSec: 6 });

      const cadence = buildCadence(this.currentItem.key);
      const target = buildTarget(this.currentItem.key, this.currentItem.degree, register);
      this.#currentTargetHz = target.hz;
      this.#playHandle = playRound({ timbreId: timbre, cadence, target, gapSec: 0.2 });

      // Render the target note to an AudioBuffer in parallel so the
      // ReplayBar's Target / Both replay modes have a buffer to play.
      // Offline rendering runs much faster than real time — a ~2s target
      // renders in a few ms — so the buffer is ready well before the user
      // reaches the graded state (earliest ~10s: cadence 3.2s + gap 0.2s +
      // target 1.5s + 5s capture). Handled `.then(...).catch(...)` chain —
      // replay is a non-essential affordance; a render failure must not
      // block the round.
      //
      // Race guard: capture the render token at render-start. If the round
      // is canceled (and optionally restarted) by the time the render
      // resolves, the token will have been incremented and the stale buffer
      // is discarded — preventing a timbre-A render from clobbering the
      // null reset or a fresh timbre-B render from a new round on the same item.
      const renderToken = this.#renderToken;
      renderTargetBuffer({ timbreId: timbre, target })
        .then((buf) => {
          if (this.#disposed || renderToken !== this.#renderToken) return;
          this.targetAudio = buf;
        })
        .catch((e) => {
          console.warn('session-controller: target render failed', e);
        });

      // eslint-disable-next-line @typescript-eslint/no-floating-promises -- #dispatch is the internal event reducer; it transitions state and handles its own error paths. Awaiting here would serialize reducer work with the play-handle wiring below; fire-and-forget is the intended shape.
      this.#dispatch({ type: 'CADENCE_STARTED', at_ms: Date.now() });

      // When target is about to start (Tone.js resolves targetStartAtAcTime)
      // eslint-disable-next-line @typescript-eslint/no-floating-promises -- This is a play-handle Promise chain used as a completion hook. startRound() must return once setup is complete — awaiting here would block until target playback starts, defeating the async orchestration model. Errors are owned by playRound().
      this.#playHandle.targetStartAtAcTime.then(() => {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises -- #dispatch is the internal event reducer; it transitions state and handles its own error paths. Awaiting from this synchronous .then() callback would require an async handler and is architecturally incorrect.
        this.#dispatch({ type: 'TARGET_STARTED', at_ms: Date.now() });
      });

      // When playback completes, begin listening window
      // eslint-disable-next-line @typescript-eslint/no-floating-promises -- This is a play-handle Promise chain used as a completion hook. startRound() must return once setup is complete — awaiting here would block until playback ends, defeating the async orchestration model. Errors are owned by playRound().
      this.#playHandle.done.then(() => {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises -- #dispatch is the internal event reducer; it transitions state and handles its own error paths. Awaiting from this synchronous .then() callback would require an async handler and is architecturally incorrect.
        this.#dispatch({ type: 'PLAYBACK_DONE', at_ms: Date.now() });
        this.#recorderHandle?.start();
        this.#captureEndTimer = setTimeout(() => {
          if (this.state.kind === 'listening') {
            const thresholds = { minPitchConfidence: 0.5, minDigitConfidence: 0.5 };
            const grade = gradeListeningState(this.state, this.currentItem!, thresholds);
            // eslint-disable-next-line @typescript-eslint/no-floating-promises -- #dispatch is the internal event reducer; it transitions state and handles its own error paths. Awaiting from this synchronous setTimeout callback would require an async handler and is architecturally incorrect.
            this.#dispatch({ type: 'CAPTURE_COMPLETE', at_ms: Date.now(), grade });
          }
        }, 5000) as unknown as number;
      });
    }

    cancelRound(): void {
      if (this.#disposed) return;
      consecutiveNullCount.set(0);
      // Invalidate any in-flight renderTargetBuffer() so a stale render from
      // this round cannot clobber the buffer when the next round (possibly
      // on the same item with a different timbre) kicks off.
      this.#renderToken++;
      this.targetAudio = null;
      // eslint-disable-next-line @typescript-eslint/no-floating-promises -- #dispatch is the internal event reducer; it transitions state and handles its own error paths. cancelRound() is synchronous (called from UI click handlers) — awaiting would force the method async and is architecturally incorrect.
      this.#dispatch({ type: 'USER_CANCELED', at_ms: Date.now() });
      this.#stopAudioHandles();
    }

    async next(): Promise<void> {
      if (this.#disposed) return;
      if (this.state.kind !== 'graded') return; // guard: only callable post-grade

      // Reset mic-check counter so the new round starts clean.
      consecutiveNullCount.set(0);

      const sessionRow = this.session!;
      const completed = sessionRow.completed_items + 1;

      if (completed >= sessionRow.target_items) {
        // Session is full — complete it, do not start another round.
        // Running counters (#pitchPasses / #labelPasses) already include this round's outcome.
        await deps.sessionsRepo.complete(sessionRow.id, {
          ended_at: Date.now(),
          completed_items: completed,
          pitch_pass_count: this.#pitchPasses,
          label_pass_count: this.#labelPasses,
        });
        this.session = { ...sessionRow, ended_at: Date.now(), completed_items: completed };
        this.currentItem = null;
        this.state = { kind: 'idle' };
        return;
      }

      // More items due — advance. Use the Leitner + interleaving scheduler
      // (`selectNextItem`) so weak/overdue items are prioritized AND the
      // "no same-degree back-to-back" + "no >3 same-key streak" constraints
      // from the spec §5.2 are honored. The scheduler handles its own due-
      // weighting internally via the item's `due_at`; pass `listAll()` so
      // the mastered-warmup pool is visible too.
      const now = Date.now();
      const allItemsForScheduler = await deps.itemsRepo.listAll();
      const next = selectNextItem(allItemsForScheduler, this.#roundHistory, now, this.#rng);
      if (next == null) {
        // Unusual: target_items says more to go but the queue is empty. Persist completion anyway.
        await deps.sessionsRepo.complete(sessionRow.id, {
          ended_at: Date.now(),
          completed_items: completed,
          pitch_pass_count: this.#pitchPasses,
          label_pass_count: this.#labelPasses,
        });
        this.session = { ...sessionRow, ended_at: Date.now(), completed_items: completed };
        this.currentItem = null;
        this.state = { kind: 'idle' };
        return;
      }

      this.currentItem = next;
      this.session = { ...sessionRow, completed_items: completed };
      this.state = { kind: 'idle' };
      // Reset captured/target audio for the next round.
      this.capturedAudio = null;
      this.targetAudio = null;
    }

    dispose(): void {
      if (this.#disposed) return;
      this.#disposed = true;
      consecutiveNullCount.set(0);
      degradationState.update((s) => ({ ...s, kwsUnavailable: false }));
      this.#stopAudioHandles();
      // Release the session's AudioContext so Chrome's ~6-context budget isn't
      // consumed by stale contexts from prior sessions. close() is async but we
      // fire-and-forget: the caller doesn't need to await disposal, and close()
      // can reject if the context is already closed — which we don't care about.
      if (this.#audioContext != null) {
        const ctx = this.#audioContext;
        this.#audioContext = null;
        ctx.close().catch(() => { /* already closed or unsupported */ });
      }
    }

    #stopAudioHandles(): void {
      if (this.#captureEndTimer != null) {
        clearTimeout(this.#captureEndTimer);
        this.#captureEndTimer = null;
      }
      this.#playHandle?.cancel();
      this.#pitchHandle?.stop().catch(() => {});
      this.#kwsHandle?.stop().catch(() => {});
      this.#recorderHandle?.dispose();
      this.#playHandle = null;
      this.#pitchHandle = null;
      this.#kwsHandle = null;
      this.#recorderHandle = null;
    }

    _pickVariability(items: ReadonlyArray<Item>): { timbre: TimbreId; register: Register } {
      const variabilitySettings = { lockedTimbre: null, lockedRegister: null };
      const available = availableRegisters(items);
      const timbre = pickTimbre(this.#rng, this.#history, variabilitySettings);
      const register = pickRegister(this.#rng, this.#history, variabilitySettings, available);
      this.#history = { lastTimbre: timbre, lastRegister: register };
      return { timbre, register };
    }

    _onPitchFrame(frame: { hz: number; confidence: number }): void {
      // Update the mic-check hint store (consecutiveNullCount).
      // A "null" frame is one with no signal (hz <= 0) or low confidence (< 0.5).
      if (frame.hz <= 0 || frame.confidence < 0.5) {
        consecutiveNullCount.update((n) => n + 1);
      } else {
        consecutiveNullCount.set(0);
      }
      // eslint-disable-next-line @typescript-eslint/no-floating-promises -- #dispatch is the internal event reducer; it transitions state and handles its own error paths. Awaiting from this synchronous pitch-detector subscription callback would require an async handler and is architecturally incorrect.
      this.#dispatch({ type: 'PITCH_FRAME', at_ms: Date.now(), hz: frame.hz, confidence: frame.confidence });
    }

    _forceState(state: RoundState): void {
      if (import.meta.env.MODE === 'production') return;
      this.state = state;
    }

    _forceTimer(id: number): void {
      if (import.meta.env.MODE === 'production') return;
      this.#captureEndTimer = id;
    }

    _forceRunningCounters(pitch: number, label: number): void {
      if (import.meta.env.MODE === 'production') return;
      this.#pitchPasses = pitch;
      this.#labelPasses = label;
    }

    _getRunningCounters(): { pitch: number; label: number; roundIndex: number } {
      if (import.meta.env.MODE === 'production') return { pitch: 0, label: 0, roundIndex: 0 };
      return { pitch: this.#pitchPasses, label: this.#labelPasses, roundIndex: this.#roundIndex };
    }

    _seedRoundHistory(entries: ReadonlyArray<RoundHistoryEntry>): void {
      if (import.meta.env.MODE === 'production') return;
      this.#roundHistory = [...entries];
    }

    _forceSettings(settings: Settings): void {
      if (import.meta.env.MODE === 'production') return;
      this.#settings = settings;
    }
  }

  return new ControllerImpl();
}
