import { describe, it, expect } from 'vitest';
import { detectPitch } from '@/pitch/yin';

const SAMPLE_RATE = 44100;
const BUFFER_SIZE = 2048;

/** Synthesize a pure sine wave of the given frequency. */
function sine(freq: number, lenSamples = BUFFER_SIZE, sr = SAMPLE_RATE): Float32Array {
  const out = new Float32Array(lenSamples);
  const w = 2 * Math.PI * freq / sr;
  for (let n = 0; n < lenSamples; n++) out[n] = Math.sin(w * n);
  return out;
}

/** Low-amplitude deterministic noise via a simple LCG (avoids Math.random flake in CI). */
function noise(lenSamples = BUFFER_SIZE, amp = 0.01): Float32Array {
  const out = new Float32Array(lenSamples);
  // LCG params: Numerical Recipes values
  let state = 0x12345678;
  for (let n = 0; n < lenSamples; n++) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    // Map to [-1, 1] then scale by amp
    out[n] = ((state / 0x100000000) * 2 - 1) * amp;
  }
  return out;
}

describe('detectPitch (YIN)', () => {
  it('detects 440 Hz sine within ±5 cents', () => {
    const buf = sine(440);
    const { hz, confidence } = detectPitch(buf, SAMPLE_RATE);
    expect(hz).toBeCloseTo(440, 0);
    const cents = 1200 * Math.log2(hz / 440);
    expect(Math.abs(cents)).toBeLessThan(5);
    expect(confidence).toBeGreaterThan(0.8);
  });

  it('detects 220 Hz sine (A3)', () => {
    const buf = sine(220);
    const { hz } = detectPitch(buf, SAMPLE_RATE);
    expect(hz).toBeCloseTo(220, 0);
  });

  it('detects 880 Hz sine (A5)', () => {
    const buf = sine(880);
    const { hz } = detectPitch(buf, SAMPLE_RATE);
    expect(hz).toBeCloseTo(880, 0);
  });

  it('returns null-ish (low confidence) for pure noise', () => {
    const buf = noise();
    const { confidence } = detectPitch(buf, SAMPLE_RATE);
    expect(confidence).toBeLessThan(0.5);
  });

  it('returns low confidence for silence', () => {
    const buf = new Float32Array(BUFFER_SIZE); // all zeros
    const { hz, confidence } = detectPitch(buf, SAMPLE_RATE);
    // Either confidence near 0 OR hz reported as 0 — both are acceptable "no signal" outputs.
    expect(confidence < 0.5 || hz === 0).toBe(true);
  });
});
