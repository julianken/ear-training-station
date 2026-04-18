import { WaveFile } from 'wavefile';

export interface SineWavOpts {
  hz: number;
  durationSec: number;
  sampleRate?: number; // default 48000
  amplitude?: number; // default 0.5, range 0..1
}

/**
 * Generate a sine wave WAV as a Uint8Array buffer (16-bit PCM mono).
 * If (sampleRate * durationSec) is not an integer multiple of (sampleRate / hz),
 * the resulting file will have a discontinuity at loop seams. Caller's responsibility
 * to pick parameters that produce an integer number of periods for loop-safe audio.
 */
export function generateSineWav(opts: SineWavOpts): Uint8Array {
  const { hz, durationSec, sampleRate = 48000, amplitude = 0.5 } = opts;
  if (!Number.isFinite(hz) || hz <= 0) {
    throw new RangeError(`generateSineWav: hz must be a positive finite number, got ${hz}`);
  }
  if (amplitude < 0 || amplitude > 1) {
    throw new RangeError(`generateSineWav: amplitude must be in [0, 1], got ${amplitude}`);
  }
  if (!Number.isFinite(durationSec) || durationSec <= 0) {
    throw new RangeError(`generateSineWav: durationSec must be a positive finite number, got ${durationSec}`);
  }
  const numSamples = Math.floor(sampleRate * durationSec);
  const samples: number[] = new Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    samples[i] = Math.round(Math.sin(2 * Math.PI * hz * i / sampleRate) * amplitude * 32767);
  }
  const wav = new WaveFile();
  wav.fromScratch(1, sampleRate, '16', samples);
  return wav.toBuffer();
}

export interface SilenceWavOpts {
  durationSec: number;
  sampleRate?: number; // default 48000
}

export function generateSilenceWav(opts: SilenceWavOpts): Uint8Array {
  const { durationSec, sampleRate = 48000 } = opts;
  if (!Number.isFinite(durationSec) || durationSec <= 0) {
    throw new RangeError(`generateSilenceWav: durationSec must be a positive finite number, got ${durationSec}`);
  }
  const numSamples = Math.floor(sampleRate * durationSec);
  const samples: number[] = new Array(numSamples).fill(0);
  const wav = new WaveFile();
  wav.fromScratch(1, sampleRate, '16', samples);
  return wav.toBuffer();
}
