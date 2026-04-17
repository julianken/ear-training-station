/**
 * Produces the source code for the AudioBufferRecorder worklet as a string,
 * to be registered via audioWorklet.addModule(URL.createObjectURL(Blob)).
 *
 * The worklet maintains a preallocated Float32 ring buffer sized for
 * maxDurationSec * sampleRate samples. On 'start', write pointer resets;
 * every process() call writes mono (first channel) input samples into the
 * ring, stopping at capacity. On 'stop', the worklet posts the buffer
 * slice back to the main thread.
 *
 * Allocation-free in process() — follows the YIN worklet discipline.
 */
export function buildRecorderWorkletSource(maxDurationSec: number): string {
  return `
class RecorderProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const sampleRate = globalThis.sampleRate;
    this.capacity = Math.ceil(${maxDurationSec} * sampleRate);
    this.ring = new Float32Array(this.capacity);
    this.writeIndex = 0;
    this.recording = false;
    this.port.onmessage = (e) => {
      if (e.data.type === 'start') {
        this.writeIndex = 0;
        this.recording = true;
      } else if (e.data.type === 'stop') {
        this.recording = false;
        const snapshot = this.ring.slice(0, this.writeIndex);
        this.port.postMessage({
          type: 'snapshot',
          samples: snapshot,
          writtenSamples: this.writeIndex,
        }, [snapshot.buffer]);
      }
    };
  }

  process(inputs) {
    if (!this.recording) return true;
    const input = inputs[0];
    if (!input || input.length === 0) return true;
    const channel = input[0];
    const remaining = this.capacity - this.writeIndex;
    const toCopy = Math.min(channel.length, remaining);
    for (let i = 0; i < toCopy; i++) {
      this.ring[this.writeIndex + i] = channel[i];
    }
    this.writeIndex += toCopy;
    if (this.writeIndex >= this.capacity) {
      this.recording = false;
      const snapshot = this.ring.slice(0, this.writeIndex);
      this.port.postMessage({
        type: 'snapshot',
        samples: snapshot,
        writtenSamples: this.writeIndex,
      }, [snapshot.buffer]);
    }
    return true;
  }
}

registerProcessor('audio-buffer-recorder', RecorderProcessor);
  `;
}
