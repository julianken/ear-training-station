/**
 * Generate a4-sine.wav: 48kHz mono 16-bit PCM, 1 second, A4 (440 Hz) sine wave.
 *
 * Spec:
 *   - Sample rate: 48000 Hz (matches WebAudio's default AudioContext rate, avoids
 *     upstream resampling into the YIN worklet).
 *   - Duration: exactly 1 second (48000 samples).
 *   - Frequency: 440 Hz — exactly 440 complete periods in 48000 samples (loop-safe:
 *     48000 / 440 = 109.09... — NOT integer! We use 440 periods over 48000 samples
 *     which means the WAV loops cleanly every full second).
 *   - Amplitude: 0.5 (half of full scale to avoid clipping).
 *   - Format: 16-bit signed PCM, mono, little-endian.
 *
 * Note: 440 Hz over 48000 samples at 48000 Hz = 440 complete cycles per second.
 * The sine completes exactly 440 full periods, so the waveform starts and ends at
 * the same phase (zero-crossing at i=0), making it loop-safe.
 *
 * Usage: node apps/ear-training-station/e2e/fixtures/make-audio.mjs
 * Output: apps/ear-training-station/e2e/fixtures/a4-sine.wav (~96044 bytes)
 */

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SR = 48000;    // sample rate (Hz)
const F = 440;       // A4 frequency (Hz)
const SEC = 1;       // duration (seconds)
const AMP = 0.5;     // amplitude (fraction of full scale)
const N = SR * SEC;  // total samples = 48000

// Build WAV header (44 bytes) + PCM data (N * 2 bytes)
const buf = Buffer.alloc(44 + N * 2);

// RIFF chunk descriptor
buf.write('RIFF', 0);
buf.writeUInt32LE(36 + N * 2, 4);  // ChunkSize = 36 + data size
buf.write('WAVE', 8);

// fmt sub-chunk (PCM)
buf.write('fmt ', 12);
buf.writeUInt32LE(16, 16);          // Subchunk1Size = 16 for PCM
buf.writeUInt16LE(1, 20);           // AudioFormat = 1 (PCM)
buf.writeUInt16LE(1, 22);           // NumChannels = 1 (mono)
buf.writeUInt32LE(SR, 24);          // SampleRate = 48000
buf.writeUInt32LE(SR * 2, 28);      // ByteRate = SampleRate * NumChannels * BitsPerSample/8
buf.writeUInt16LE(2, 32);           // BlockAlign = NumChannels * BitsPerSample/8
buf.writeUInt16LE(16, 34);          // BitsPerSample = 16

// data sub-chunk
buf.write('data', 36);
buf.writeUInt32LE(N * 2, 40);       // Subchunk2Size = NumSamples * NumChannels * BitsPerSample/8

// PCM samples
for (let i = 0; i < N; i++) {
  // sin(2π * 440 * i / 48000) — exactly 440 complete periods over 48000 samples
  const sample = Math.sin(2 * Math.PI * F * i / SR) * AMP * 32767;
  buf.writeInt16LE(Math.round(sample), 44 + i * 2);
}

const outPath = join(__dirname, 'a4-sine.wav');
writeFileSync(outPath, buf);

const expectedBytes = 44 + N * 2;
console.log(`wrote ${outPath}`);
console.log(`  size: ${buf.length} bytes (expected ~${expectedBytes})`);
console.log(`  rate: ${SR} Hz, freq: ${F} Hz, duration: ${SEC}s, samples: ${N}`);
console.log(`  periods: ${F * SEC} complete cycles`);
