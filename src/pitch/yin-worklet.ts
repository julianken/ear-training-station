/// <reference lib="WebWorker" />
// AudioWorklet global scope — not the main thread.
//
// TypeScript type approach: AudioWorkletProcessor, registerProcessor, and
// currentTime are globals that exist only in the AudioWorkletGlobalScope.
// TypeScript's standard libs (even lib.webworker.d.ts) do not declare them as
// of TS 5.6. Rather than adding "WebWorker" to tsconfig.json (which would
// redefine DOM globals like MessageEvent and break other project files), we
// declare the missing types inline here. The triple-slash directive above
// provides the DedicatedWorkerGlobalScope baseline. Runtime correctness is
// verified by the manual harness (Task 11) and the Playwright smoke test
// (Task 12).

import { detectPitch } from './yin';

// Minimal declarations for AudioWorklet globals absent from TS standard libs.
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
  constructor();
  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>,
  ): boolean;
}
declare function registerProcessor(name: string, ctor: unknown): void;
declare const currentTime: number;
declare const sampleRate: number;

class YinProcessor extends AudioWorkletProcessor {
  // ring buffer of samples
  private buf: Float32Array = new Float32Array(2048);
  private writePos = 0;
  private sr: number;

  constructor() {
    super();
    // sampleRate is declared above as a worklet global (AudioWorkletGlobalScope)
    this.sr = sampleRate;
  }

  override process(inputs: Float32Array[][]): boolean {
    const input = inputs[0]?.[0];
    if (!input) return true;

    // Write incoming samples into ring buffer — single-producer from process(),
    // no threading hazard.
    for (let i = 0; i < input.length; i++) {
      this.buf[this.writePos] = input[i]!;
      this.writePos = (this.writePos + 1) % this.buf.length;
    }

    // Run YIN detection on the full 2048-sample ring buffer every render quantum.
    // For future performance tuning, this could be throttled to once per N quanta.
    const { hz, confidence } = detectPitch(this.buf, this.sr);
    // currentTime is declared above as a worklet global (AudioWorkletGlobalScope)
    this.port.postMessage({ hz, confidence, at: currentTime });
    return true;
  }
}

registerProcessor('yin-processor', YinProcessor);
