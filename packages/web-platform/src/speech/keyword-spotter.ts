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
 * Module-level idempotency state.
 *
 * At most one `recognizer.listen` stream is active at a time. Concurrent or
 * repeated calls to `startKeywordSpotter` share the same handle:
 *
 *   - `activeHandle`  — set once listening is established; returned synchronously
 *                       (via Promise.resolve) to any caller that arrives after
 *                       the first call resolves.
 *   - `activePromise` — in-flight Promise while the first call is loading the
 *                       model and starting the stream; collapsed to callers that
 *                       arrive concurrently before it resolves.
 *
 * State transitions:
 *   IDLE              activeHandle=null, activePromise=null
 *   LOADING           activeHandle=null, activePromise=<pending>
 *   ACTIVE            activeHandle=<handle>, activePromise=<resolved>
 *   IDLE (after stop) activeHandle=null, activePromise=null  (fresh start next call)
 *
 * NOTE: `probabilityThreshold` and `minConfidence` are locked on the FIRST call.
 * Subsequent callers with IDENTICAL thresholds receive the same handle (idempotent).
 * Subsequent callers with DIFFERENT thresholds receive a descriptive Error — call
 * stop() first to unlock and change thresholds.
 */
let activeHandle: KeywordSpotterHandle | null = null;
let activePromise: Promise<KeywordSpotterHandle> | null = null;
let activeStop: Promise<void> | null = null;
let activeThresholds: { probabilityThreshold: number; minConfidence: number } | null = null;

/**
 * Start listening for digit keywords. The speech-commands library internally opens
 * its own mic stream; no MediaStream needs to be passed in.
 *
 * This function is idempotent: multiple callers share a single `recognizer.listen`
 * stream. Concurrent calls collapse to the same in-flight Promise; calls after
 * the stream is established return `Promise.resolve(activeHandle)` immediately.
 * All callers subscribe via the shared `Set<>`, so every subscriber receives
 * every frame from the single live stream.
 */
export async function startKeywordSpotter(
  input: StartKeywordSpotterInput = {},
): Promise<KeywordSpotterHandle> {
  // Resolve defaults up front so threshold comparison works correctly for both
  // the already-active check and the in-flight-promise check below.
  const probabilityThreshold = input.probabilityThreshold ?? 0.75;
  const minConfidence = input.minConfidence ?? 0.75;

  // Already active — return the existing handle if thresholds match; throw if
  // the caller is trying to silently change thresholds on a live stream.
  if (activeHandle !== null) {
    if (
      activeThresholds !== null &&
      (activeThresholds.probabilityThreshold !== probabilityThreshold ||
        activeThresholds.minConfidence !== minConfidence)
    ) {
      throw new Error(
        `startKeywordSpotter called with different thresholds while active. ` +
        `Current: prob=${activeThresholds.probabilityThreshold}, conf=${activeThresholds.minConfidence}. ` +
        `Requested: prob=${probabilityThreshold}, conf=${minConfidence}. ` +
        `Call stop() first to change thresholds.`,
      );
    }
    return Promise.resolve(activeHandle);
  }

  // In-flight load — collapse concurrent callers to the same Promise.
  if (activePromise !== null) {
    return activePromise;
  }

  // First caller: build the Promise, store it, then await.
  activePromise = _createHandle({ probabilityThreshold, minConfidence });

  // On failure, null activePromise so the next call retries cleanly.
  activePromise.catch(() => {
    activePromise = null;
  });

  return activePromise;
}

async function _createHandle(
  input: Required<StartKeywordSpotterInput>,
): Promise<KeywordSpotterHandle> {
  const { probabilityThreshold, minConfidence } = input;
  const recognizer: Recognizer = await loadKwsRecognizer();
  // Serialize after any in-flight stop so speech-commands doesn't throw
  // "Cannot start streaming again when streaming is ongoing."
  if (activeStop) await activeStop;
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

  const handle: KeywordSpotterHandle = {
    async stop() {
      // Null the module-level cache FIRST so any concurrent startKeywordSpotter()
      // call during the stopListening() await creates a fresh listener instead of
      // returning this dying handle (which has an already-cleared subscribers Set).
      activeHandle = null;
      activePromise = null;
      activeThresholds = null;
      subscribers.clear();
      // Capture the in-flight stopListening so a concurrent start() can await
      // it before calling recognizer.listen() — otherwise speech-commands throws
      // "Cannot start streaming again when streaming is ongoing."
      activeStop = (async () => {
        try {
          await recognizer.stopListening();
        } finally {
          activeStop = null;
        }
      })();
      await activeStop;
    },
    subscribe(cb) {
      subscribers.add(cb);
      return () => { subscribers.delete(cb); };
    },
  };

  // Publish the handle and its thresholds at module scope so future callers
  // get the handle immediately and can validate their thresholds match.
  activeHandle = handle;
  activeThresholds = { probabilityThreshold, minConfidence };

  return handle;
}
