export interface PitchFrame {
  hz: number;
  confidence: number;
  /** Timestamp in AudioContext time (seconds). */
  at: number;
}

export interface PitchDetectorHandle {
  stop: () => Promise<void>;
  /** Observable of pitch frames. Returns unsubscribe fn. */
  subscribe: (cb: (frame: PitchFrame) => void) => () => void;
}

export interface StartPitchDetectorInput {
  audioContext: AudioContext;
  micStream: MediaStream;
}

/**
 * Start pitch detection on a mic stream. Caller owns the AudioContext and
 * MediaStream lifetimes.
 */
export async function startPitchDetector(
  input: StartPitchDetectorInput,
): Promise<PitchDetectorHandle> {
  const { audioContext, micStream } = input;

  // Load the worklet module. Vite resolves this URL at build time so the
  // worklet script is bundled as a separate chunk / asset.
  const workletUrl = new URL('./yin-worklet.ts', import.meta.url);
  await audioContext.audioWorklet.addModule(workletUrl.href);

  const source = audioContext.createMediaStreamSource(micStream);
  const node = new AudioWorkletNode(audioContext, 'yin-processor');

  source.connect(node);
  // Worklet output is intentionally NOT routed to destination — analysis only.

  const subscribers = new Set<(f: PitchFrame) => void>();

  node.port.onmessage = (ev: MessageEvent<PitchFrame>) => {
    const frame = ev.data;
    for (const cb of subscribers) cb(frame);
  };

  return {
    subscribe(cb) {
      subscribers.add(cb);
      // subscribers.delete returns boolean; wrap in void to match () => void.
      return () => { subscribers.delete(cb); };
    },
    async stop() {
      source.disconnect();
      node.port.onmessage = null;
      node.disconnect();
    },
  };
}
