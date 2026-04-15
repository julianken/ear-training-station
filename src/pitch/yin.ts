/**
 * YIN pitch detection (difference function + cumulative mean normalized
 * difference + parabolic interpolation). Returns F0 in Hz and a confidence
 * score in [0, 1].
 *
 * Reference: de Cheveigné & Kawahara, "YIN, a fundamental frequency estimator
 * for speech and music," J. Acoust. Soc. Am. 111 (4), April 2002.
 *
 * This is the pure-math version suitable for testing in Node. It operates on
 * a Float32Array audio buffer and does not touch Web Audio APIs.
 */

const THRESHOLD = 0.1;
const MIN_HZ = 60;
const MAX_HZ = 1200;

export interface PitchResult {
  /** Estimated F0 in Hz, or 0 if not detected. */
  hz: number;
  /** Confidence in [0, 1]. Higher = more reliable. */
  confidence: number;
}

export function detectPitch(buffer: Float32Array, sampleRate: number): PitchResult {
  const N = buffer.length;

  // Guard: silence / near-silence — avoid false-positive pitch on an all-zeros buffer
  // (d(tau)=0 everywhere → dPrime→0 → spurious high confidence).
  let rms = 0;
  for (let i = 0; i < N; i++) rms += buffer[i]! * buffer[i]!;
  rms = Math.sqrt(rms / N);
  if (rms < 1e-6) return { hz: 0, confidence: 0 };

  const tauMin = Math.floor(sampleRate / MAX_HZ);
  const tauMax = Math.min(Math.floor(sampleRate / MIN_HZ), Math.floor(N / 2));
  if (tauMax <= tauMin + 1) return { hz: 0, confidence: 0 };

  // 1. Difference function d(tau)
  const d = new Float32Array(tauMax + 1);
  for (let tau = tauMin; tau <= tauMax; tau++) {
    let sum = 0;
    for (let i = 0; i < N - tau; i++) {
      const delta = buffer[i]! - buffer[i + tau]!;
      sum += delta * delta;
    }
    d[tau] = sum;
  }

  // 2. Cumulative mean normalized difference d'(tau)
  const dPrime = new Float32Array(tauMax + 1);
  dPrime[tauMin] = 1;
  let running = 0;
  for (let tau = tauMin + 1; tau <= tauMax; tau++) {
    running += d[tau]!;
    dPrime[tau] = (d[tau]! * tau) / (running || 1);
  }

  // 3. Absolute threshold — find first tau with d'(tau) < THRESHOLD,
  //    then refine by picking the local minimum.
  let tau = -1;
  for (let t = tauMin + 1; t < tauMax; t++) {
    if (dPrime[t]! < THRESHOLD) {
      while (t + 1 < tauMax && dPrime[t + 1]! < dPrime[t]!) t++;
      tau = t;
      break;
    }
  }

  if (tau < 0) {
    // No clear period found — pick the global minimum as a fallback for confidence reporting.
    let bestTau = tauMin + 1;
    let bestVal = dPrime[bestTau]!;
    for (let t = tauMin + 2; t < tauMax; t++) {
      if (dPrime[t]! < bestVal) {
        bestVal = dPrime[t]!;
        bestTau = t;
      }
    }
    // If even the global best is above 0.8, this is essentially noise.
    if (bestVal > 0.8) return { hz: 0, confidence: 0 };
    tau = bestTau;
  }

  // 4. Parabolic interpolation around tau for sub-sample accuracy.
  let refinedTau = tau;
  if (tau > 0 && tau < tauMax) {
    const s0 = dPrime[tau - 1] ?? dPrime[tau]!;
    const s1 = dPrime[tau]!;
    const s2 = dPrime[tau + 1] ?? dPrime[tau]!;
    const denom = (s0 + s2 - 2 * s1);
    if (denom !== 0) {
      refinedTau = tau + (s0 - s2) / (2 * denom);
    }
  }

  const hz = sampleRate / refinedTau;
  if (hz < MIN_HZ || hz > MAX_HZ) return { hz: 0, confidence: 0 };

  // Confidence: how much smaller than THRESHOLD was the d'(tau) value? Clamp to [0, 1].
  const dVal = dPrime[tau]!;
  const confidence = Math.max(0, Math.min(1, 1 - dVal));

  return { hz, confidence };
}
