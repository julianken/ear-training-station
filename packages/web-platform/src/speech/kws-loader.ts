import '@tensorflow/tfjs-backend-webgl';
import '@tensorflow/tfjs-backend-cpu';
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
