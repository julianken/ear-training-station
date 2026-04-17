import { roundReducer } from '@ear-training/core/round/state';
import type { RoundState } from '@ear-training/core/round/state';
import type { RoundEvent } from '@ear-training/core/round/events';
import type { Item, Session, Register } from '@ear-training/core/types/domain';
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
    #history: VariabilityHistory = { lastTimbre: null, lastRegister: null };
    #rng: () => number = deps.rng ?? Math.random;

    // Persistence state — maintained across rounds
    #reviewsInBox: SvelteMap<string, number> = new SvelteMap();
    #roundIndex: number = deps.session.completed_items;
    #pitchPasses: number = deps.session.pitch_pass_count;
    #labelPasses: number = deps.session.label_pass_count;
    // Target hz stored at startRound time for use in attempt persistence
    #currentTargetHz: number = 0;

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
        const gradedState = this.state as Extract<RoundState, { kind: 'graded' }>;
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
      // Auto-advance on hit, if setting is on
      // (settings will be threaded through via settingsSnapshot — simple default for now)
      if (grade.outcome.pass) {
        void this.#dispatch({ type: 'CAPTURE_COMPLETE', at_ms: Date.now(), grade });
      }
      // Capture timeout is handled in startRound() via a setTimeout to ~5s
      // past PLAYBACK_DONE. If fired without a pass, dispatch CAPTURE_COMPLETE
      // with whatever grade the state produces (may be fail).
    }

    async startRound(): Promise<void> {
      if (this.#disposed) return;
      if (this.state.kind !== 'idle') return; // guard against double-start
      if (this.currentItem == null) return;

      const ctx = deps.getAudioContext();
      const stream = await deps.getMicStream();

      // Pick timbre and register via variability pickers (no monoculture)
      const allItems = await deps.itemsRepo.listAll();
      const { timbre, register } = this._pickVariability(allItems);

      // Dispatch ROUND_STARTED synthetically
      void this.#dispatch({
        type: 'ROUND_STARTED',
        at_ms: Date.now(),
        item: this.currentItem,
        timbre,
        register,
      });

      // Lazy-load the audio handles (web-platform modules)
      const { playRound } = await import('@ear-training/web-platform/audio/player');
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
          void this.#dispatch({
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

      void this.#dispatch({ type: 'CADENCE_STARTED', at_ms: Date.now() });

      // When target is about to start (Tone.js resolves targetStartAtAcTime)
      void this.#playHandle.targetStartAtAcTime.then(() => {
        void this.#dispatch({ type: 'TARGET_STARTED', at_ms: Date.now() });
      });

      // When playback completes, begin listening window
      void this.#playHandle.done.then(() => {
        void this.#dispatch({ type: 'PLAYBACK_DONE', at_ms: Date.now() });
        this.#recorderHandle?.start();
        this.#captureEndTimer = setTimeout(() => {
          if (this.state.kind === 'listening') {
            const thresholds = { minPitchConfidence: 0.5, minDigitConfidence: 0.5 };
            const grade = gradeListeningState(this.state, this.currentItem!, thresholds);
            void this.#dispatch({ type: 'CAPTURE_COMPLETE', at_ms: Date.now(), grade });
          }
        }, 5000) as unknown as number;
      });
    }

    cancelRound(): void {
      if (this.#disposed) return;
      void this.#dispatch({ type: 'USER_CANCELED', at_ms: Date.now() });
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
          focus_item_id: sessionRow.focus_item_id,
        });
        this.session = { ...sessionRow, ended_at: Date.now(), completed_items: completed };
        this.currentItem = null;
        this.state = { kind: 'idle' };
        return;
      }

      // More items due — advance.
      const dueNow = await deps.itemsRepo.findDue(Date.now());
      const justPlayed = this.currentItem?.id;
      const next = dueNow.find((i) => i.id !== justPlayed) ?? dueNow[0] ?? null;
      if (next == null) {
        // Unusual: target_items says more to go but the queue is empty. Persist completion anyway.
        await deps.sessionsRepo.complete(sessionRow.id, {
          ended_at: Date.now(),
          completed_items: completed,
          pitch_pass_count: this.#pitchPasses,
          label_pass_count: this.#labelPasses,
          focus_item_id: sessionRow.focus_item_id,
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
      this.#stopAudioHandles();
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
      void this.#dispatch({ type: 'PITCH_FRAME', at_ms: Date.now(), hz: frame.hz, confidence: frame.confidence });
    }

    _forceState(state: RoundState): void {
      this.state = state;
    }

    _forceTimer(id: number): void {
      this.#captureEndTimer = id;
    }

    _forceRunningCounters(pitch: number, label: number): void {
      this.#pitchPasses = pitch;
      this.#labelPasses = label;
    }

    _getRunningCounters(): { pitch: number; label: number; roundIndex: number } {
      return { pitch: this.#pitchPasses, label: this.#labelPasses, roundIndex: this.#roundIndex };
    }
  }

  return new ControllerImpl();
}
