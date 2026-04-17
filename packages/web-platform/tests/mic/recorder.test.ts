import { describe, expect, it, vi, beforeEach } from 'vitest';
import { startAudioRecorder } from '@/mic/recorder';

// jsdom has no AudioWorklet — we mock the shape the module uses.
class FakeAudioWorkletNode extends EventTarget {
  port = {
    onmessage: null as ((ev: MessageEvent) => void) | null,
    postMessage: vi.fn(),
  };
  disconnect = vi.fn();
  constructor(public ctx: AudioContext, public name: string, public opts?: AudioWorkletNodeOptions) {
    super();
  }
}

function makeFakeContext(): AudioContext {
  const audioWorklet = { addModule: vi.fn(async () => undefined) };
  const createBuffer = vi.fn((channels: number, length: number, sampleRate: number) => ({
    numberOfChannels: channels,
    length,
    sampleRate,
    getChannelData: vi.fn(() => new Float32Array(length)),
    copyToChannel: vi.fn(),
  })) as unknown as AudioContext['createBuffer'];

  const createMediaStreamSource = vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
  })) as unknown as AudioContext['createMediaStreamSource'];

  return {
    sampleRate: 48000,
    audioWorklet,
    createBuffer,
    createMediaStreamSource,
  } as unknown as AudioContext;
}

function makeFakeMicStream(): MediaStream {
  return {} as MediaStream;
}

beforeEach(() => {
  // @ts-expect-error install the fake constructor globally
  globalThis.AudioWorkletNode = FakeAudioWorkletNode;
  // jsdom does not implement URL.createObjectURL — stub it out.
  // The recorder uses it only to pass a URL string to addModule(); since
  // addModule is itself mocked, the value of the URL doesn't matter.
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:fake');
});

describe('AudioBufferRecorder', () => {
  it('loads the recorder worklet module once and returns a handle', async () => {
    const ctx = makeFakeContext();
    const stream = makeFakeMicStream();
    const handle = await startAudioRecorder({ audioContext: ctx, micStream: stream, maxDurationSec: 6 });
    expect(ctx.audioWorklet.addModule).toHaveBeenCalledTimes(1);
    expect(typeof handle.start).toBe('function');
    expect(typeof handle.stop).toBe('function');
    expect(typeof handle.dispose).toBe('function');
  });

  it('start() does not throw with a fresh handle', async () => {
    const ctx = makeFakeContext();
    const handle = await startAudioRecorder({
      audioContext: ctx, micStream: makeFakeMicStream(), maxDurationSec: 6,
    });
    expect(() => handle.start()).not.toThrow();
  });

  it('stop() resolves with an AudioBuffer whose sampleRate matches the AudioContext', async () => {
    const ctx = makeFakeContext();
    const handle = await startAudioRecorder({
      audioContext: ctx, micStream: makeFakeMicStream(), maxDurationSec: 6,
    });

    handle.start();
    const stopPromise = handle.stop();
    // Grab the port via the test hook and simulate the worklet's snapshot response.
    const port = handle._portForTest?.();
    if (port?.onmessage) {
      const samples = new Float32Array(1024);
      port.onmessage({ data: { type: 'snapshot', samples, writtenSamples: 500 } } as MessageEvent);
    }
    const buffer = await stopPromise;
    expect(buffer.sampleRate).toBe(48000);
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.length).toBeLessThanOrEqual(500);
  });

  it('dispose() disconnects the worklet without throwing', async () => {
    const ctx = makeFakeContext();
    const handle = await startAudioRecorder({
      audioContext: ctx, micStream: makeFakeMicStream(), maxDurationSec: 6,
    });
    expect(() => handle.dispose()).not.toThrow();
  });
});
