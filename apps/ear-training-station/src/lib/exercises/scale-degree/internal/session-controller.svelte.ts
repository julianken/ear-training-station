import { roundReducer } from '@ear-training/core/round/state';
import type { RoundState } from '@ear-training/core/round/state';
import type { RoundEvent } from '@ear-training/core/round/events';
import type { Item, Session } from '@ear-training/core/types/domain';
import type {
  ItemsRepo, AttemptsRepo, SessionsRepo, SettingsRepo,
} from '@ear-training/core/repos/interfaces';
import type { PlayRoundHandle } from '@ear-training/web-platform/audio/player';
import type { PitchDetectorHandle } from '@ear-training/web-platform/pitch/pitch-detector';
import type { KeywordSpotterHandle } from '@ear-training/web-platform/speech/keyword-spotter';
import type { RecorderHandle } from '@ear-training/web-platform/mic/recorder';
import { gradeListeningState } from '@ear-training/core/round/grade-listening';

export interface SessionControllerDeps {
  session: Session;
  firstItem: Item;
  itemsRepo: ItemsRepo;
  attemptsRepo: AttemptsRepo;
  sessionsRepo: SessionsRepo;
  settingsRepo: SettingsRepo;
  getAudioContext: () => AudioContext;
  getMicStream: () => Promise<MediaStream>;
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

      // Dispatch ROUND_STARTED synthetically
      const timbre = 'piano' as const;
      const register = 'comfortable' as const;
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
        void this.#dispatch({ type: 'PITCH_FRAME', at_ms: Date.now(), hz: frame.hz, confidence: frame.confidence });
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
        // KWS unavailable — degradation banner handled by shell store (Task in C1.4)
      }

      this.#recorderHandle = await startAudioRecorder({ audioContext: ctx, micStream: stream, maxDurationSec: 6 });

      const cadence = buildCadence(this.currentItem.key);
      const target = buildTarget(this.currentItem.key, this.currentItem.degree, register);
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
      throw new Error('not implemented — see C1.3 Task 6');
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

    _forceState(state: RoundState): void {
      this.state = state;
    }

    _forceTimer(id: number): void {
      this.#captureEndTimer = id;
    }
  }

  return new ControllerImpl();
}
