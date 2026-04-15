import * as speechCommands from '@tensorflow-models/speech-commands';

export type Recognizer = speechCommands.SpeechCommandRecognizer;

let cached: Recognizer | null = null;

/**
 * Load and warm up the speech-commands model.
 * Subsequent calls return the cached instance.
 * Model files are fetched from tfhub/tfjs-models CDN on first call; ~3 MB.
 */
export async function loadKwsRecognizer(): Promise<Recognizer> {
  if (cached) return cached;
  const recognizer = speechCommands.create('BROWSER_FFT');
  await recognizer.ensureModelLoaded();
  cached = recognizer;
  return recognizer;
}

/**
 * Labels the loaded model exposes. Use this to verify the digits we need are present.
 */
export function modelWordLabels(recognizer: Recognizer): string[] {
  return recognizer.wordLabels();
}
