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

    #dispatch(event: RoundEvent): void {
      this.state = roundReducer(this.state, event);
      this.#onStateChange();
    }

    #onStateChange(): void {
      // Task 6 installs the capture-end watcher here.
    }

    async startRound(): Promise<void> {
      if (this.#disposed) return;
      throw new Error('not implemented — see C1.3 Task 6');
    }

    cancelRound(): void {
      if (this.#disposed) return;
      this.#dispatch({ type: 'USER_CANCELED', at_ms: Date.now() });
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
      void this.#pitchHandle?.stop();
      void this.#kwsHandle?.stop();
      this.#recorderHandle?.dispose();
      this.#playHandle = null;
      this.#pitchHandle = null;
      this.#kwsHandle = null;
      this.#recorderHandle = null;
    }

    _forceState(state: RoundState): void {
      this.state = state;
    }
  }

  return new ControllerImpl();
}
