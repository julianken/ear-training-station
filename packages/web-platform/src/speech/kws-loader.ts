import '@tensorflow/tfjs-backend-webgl';
import '@tensorflow/tfjs-backend-cpu';
// Attach chained ops (e.g. `tensor.argMax(...)`) to the Tensor prototype.
// The tfjs-core package exposes ops as standalone functions by default; the
// chained-method forms that speech-commands@0.5.4 calls (notably
// `y.argMax(-1)` inside BROWSER_FFT recognition) are only registered when
// this side-effect module is imported. The tfjs backends alone do NOT
// register chained ops — they only register kernels. Without this import,
// every inference frame throws `o.argMax is not a function` and no digit is
// ever emitted. See GitHub #156.
import '@tensorflow/tfjs-core/dist/public/chained_ops/register_all_chained_ops';
import * as speechCommands from '@tensorflow-models/speech-commands';

export type Recognizer = speechCommands.SpeechCommandRecognizer;

let cached: Promise<Recognizer> | null = null;

/**
 * Load and warm up the speech-commands model.
 * Subsequent callers (including concurrent ones) share the same in-flight load.
 * Model files are fetched from tfhub/tfjs-models CDN on first call; ~3 MB.
 */
export function loadKwsRecognizer(): Promise<Recognizer> {
  if (cached) return cached;
  cached = (async () => {
    const recognizer = speechCommands.create('BROWSER_FFT');
    await recognizer.ensureModelLoaded();
    return recognizer;
  })();
  // Null the cache on failure so a transient CDN error doesn't lock a failed
  // Promise in place forever.
  cached.catch(() => {
    cached = null;
  });
  return cached;
}

/**
 * Labels the loaded model exposes. Use this to verify the digits we need are present.
 */
export function modelWordLabels(recognizer: Recognizer): string[] {
  return recognizer.wordLabels();
}
