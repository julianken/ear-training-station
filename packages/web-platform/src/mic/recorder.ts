import { buildRecorderWorkletSource } from './recorder-worklet';

export interface StartAudioRecorderInput {
  audioContext: AudioContext;
  micStream: MediaStream;
  maxDurationSec?: number;
}

export interface RecorderHandle {
  start(): void;
  stop(): Promise<AudioBuffer>;
  dispose(): void;
  _portForTest?(): MessagePort;
}

const moduleLoadedFor: WeakSet<AudioContext> = new WeakSet();

export async function startAudioRecorder(
  input: StartAudioRecorderInput,
): Promise<RecorderHandle> {
  const { audioContext, micStream, maxDurationSec = 6 } = input;

  if (!moduleLoadedFor.has(audioContext)) {
    const source = buildRecorderWorkletSource(maxDurationSec);
    const blob = new Blob([source], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    await audioContext.audioWorklet.addModule(url);
    moduleLoadedFor.add(audioContext);
  }

  const node = new AudioWorkletNode(audioContext, 'audio-buffer-recorder');
  const micSource = audioContext.createMediaStreamSource(micStream);
  micSource.connect(node);

  let pendingResolve: ((buf: AudioBuffer) => void) | null = null;

  node.port.onmessage = (ev) => {
    if (ev.data?.type !== 'snapshot') return;
    const samples: Float32Array<ArrayBuffer> = ev.data.samples;
    const written: number = ev.data.writtenSamples;
    const length = Math.max(1, written);
    const buffer = audioContext.createBuffer(1, length, audioContext.sampleRate);
    buffer.copyToChannel(samples.subarray(0, length), 0);
    pendingResolve?.(buffer);
    pendingResolve = null;
  };

  let disposed = false;

  return {
    start() {
      if (disposed) throw new Error('recorder disposed');
      node.port.postMessage({ type: 'start' });
    },
    stop(): Promise<AudioBuffer> {
      if (disposed) throw new Error('recorder disposed');
      return new Promise<AudioBuffer>((resolve) => {
        pendingResolve = resolve;
        node.port.postMessage({ type: 'stop' });
      });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      try { node.disconnect(); } catch { /* already disconnected */ }
      try { micSource.disconnect(); } catch { /* already disconnected */ }
    },
    _portForTest() {
      return node.port as unknown as MessagePort;
    },
  };
}
