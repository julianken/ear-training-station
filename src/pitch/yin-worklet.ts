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
  private quantumCount = 0;

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

    // Throttle YIN analysis to once every 8 render quanta (~47 Hz updates).
    // Lower than sample rate but plenty for UI feedback; keeps audio-thread
    // CPU bounded.
    this.quantumCount++;
    if (this.quantumCount % 8 !== 0) return true;

    // Unwrap ring buffer into chronological scratch array before YIN.
    // The ring buffer's sample at this.writePos is the OLDEST (next to be overwritten),
    // and the sample at this.writePos - 1 (mod length) is the NEWEST. So chronological
    // order is [writePos..end] followed by [0..writePos].
    const scratch = new Float32Array(this.buf.length);
    const tail = this.buf.length - this.writePos;
    scratch.set(this.buf.subarray(this.writePos), 0);
    scratch.set(this.buf.subarray(0, this.writePos), tail);
    const { hz, confidence } = detectPitch(scratch, this.sr);
    // currentTime is declared above as a worklet global (AudioWorkletGlobalScope)
    this.port.postMessage({ hz, confidence, at: currentTime });
    return true;
  }
}

registerProcessor('yin-processor', YinProcessor);
