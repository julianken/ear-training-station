import { loadKwsRecognizer, type Recognizer } from './kws-loader';

/** Digits the product cares about (MVP). */
export const DIGIT_LABELS = ['one', 'two', 'three', 'four', 'five', 'six', 'seven'] as const;
export type DigitLabel = (typeof DIGIT_LABELS)[number];

export interface DigitFrame {
  /** Top digit the model emitted, or null if none of the target digits matched. */
  digit: DigitLabel | null;
  /** Confidence in [0, 1]. */
  confidence: number;
  /** Raw scores over every digit label (useful for debugging). */
  scores: Record<DigitLabel, number>;
}

export interface KeywordSpotterHandle {
  stop: () => Promise<void>;
  subscribe: (cb: (f: DigitFrame) => void) => () => void;
}

export interface StartKeywordSpotterInput {
  /** Minimum probability threshold for the built-in library to emit a detection. */
  probabilityThreshold?: number;
  /** Minimum confidence to emit to subscribers (we apply our own filter on top). */
  minConfidence?: number;
}

/**
 * Start listening for digit keywords. The speech-commands library internally opens
 * its own mic stream; no MediaStream needs to be passed in.
 */
export async function startKeywordSpotter(
  input: StartKeywordSpotterInput = {},
): Promise<KeywordSpotterHandle> {
  const probabilityThreshold = input.probabilityThreshold ?? 0.75;
  const minConfidence = input.minConfidence ?? 0.75;
  const recognizer: Recognizer = await loadKwsRecognizer();
  const labels = recognizer.wordLabels();

  const digitIndexes: number[] = DIGIT_LABELS.map((d) => labels.indexOf(d));
  // Every digit must be present. If any is missing, the library's model doesn't cover our vocab.
  for (let i = 0; i < digitIndexes.length; i++) {
    if (digitIndexes[i]! < 0) {
      throw new Error(
        `Speech Commands model does not include digit "${DIGIT_LABELS[i]}". ` +
        `Available labels: ${labels.join(', ')}`,
      );
    }
  }

  const subscribers = new Set<(f: DigitFrame) => void>();

  await recognizer.listen(
    (result) => {
      // result.scores is Float32Array | Float32Array[]; for BROWSER_FFT streaming it is always
      // a single Float32Array (one prediction vector per frame).
      const scores = result.scores as Float32Array;
      const perDigit = {} as Record<DigitLabel, number>;
      let topIdx = -1;
      let topScore = 0;
      for (let i = 0; i < DIGIT_LABELS.length; i++) {
        const s = scores[digitIndexes[i]!]!;
        perDigit[DIGIT_LABELS[i]!] = s;
        if (s > topScore) {
          topScore = s;
          topIdx = i;
        }
      }
      const digit = topIdx >= 0 && topScore >= minConfidence ? DIGIT_LABELS[topIdx]! : null;
      const frame: DigitFrame = {
        digit,
        confidence: topScore,
        scores: perDigit,
      };
      for (const cb of subscribers) cb(frame);
      return Promise.resolve();
    },
    {
      probabilityThreshold,
      includeSpectrogram: false,
      overlapFactor: 0.5,
    },
  );

  return {
    async stop() {
      subscribers.clear();
      await recognizer.stopListening();
    },
    subscribe(cb) {
      subscribers.add(cb);
      return () => { subscribers.delete(cb); };
    },
  };
}
