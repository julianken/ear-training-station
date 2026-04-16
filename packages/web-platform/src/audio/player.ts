import * as Tone from 'tone';
import type { ChordEvent } from '@ear-training/core/audio/cadence-structure';
import type { NoteEvent } from '@ear-training/core/audio/target-structure';
import { midiToHz } from '@ear-training/core/audio/note-math';
import { getTimbre, type TimbreId } from './timbres';

/**
 * Ensure Tone.js audio context is started. Must be called from a user
 * gesture handler per browser autoplay policy.
 */
export async function ensureAudioContextStarted(): Promise<void> {
  await Tone.start();
}

export interface PlayRoundInput {
  timbreId: TimbreId;
  cadence: ReadonlyArray<ChordEvent>;
  target: NoteEvent;
  /** Seconds of silence between cadence end and target start. */
  gapSec?: number;
}

export interface PlayRoundHandle {
  /** Promise that resolves when the target note has finished playing. */
  done: Promise<void>;
  /** Time (seconds, audio context time) at which the target note started. */
  targetStartAtAcTime: Promise<number>;
  /** Stop everything and dispose the synth. */
  cancel: () => void;
}

/**
 * Play a full round: the cadence chord sequence, then (after `gapSec`) the target note.
 * Resolves when the target note finishes.
 *
 * No unit tests: Tone.js requires a real AudioContext and is not meaningfully
 * testable in Vitest/jsdom. Integration coverage is provided by:
 *   - Task 11: manual audio harness (harness/audio.html)
 *   - Task 12: Playwright smoke test
 */
export function playRound(input: PlayRoundInput): PlayRoundHandle {
  const gap = input.gapSec ?? 0.4;
  const synth = getTimbre(input.timbreId).createSynth();
  synth.toDestination();

  const now = Tone.now();
  let lastCadenceEnd = now;

  // Schedule cadence chords.
  // Tone.PolySynth.triggerAttackRelease accepts Frequency | Frequency[] where
  // Frequency includes number (Hz), so number[] is a valid Frequency[].
  for (const ev of input.cadence) {
    const at = now + ev.startSec;
    const hzs: number[] = ev.notes.map((m) => midiToHz(m));
    synth.triggerAttackRelease(hzs, ev.durationSec, at);
    lastCadenceEnd = Math.max(lastCadenceEnd, at + ev.durationSec);
  }

  const targetAt = lastCadenceEnd + gap;
  synth.triggerAttackRelease(midiToHz(input.target.midi), input.target.durationSec, targetAt);
  const targetEnd = targetAt + input.target.durationSec;

  let cancelled = false;
  const cancel = () => {
    cancelled = true;
    try {
      synth.releaseAll();
      synth.disconnect();
      synth.dispose();
    } catch {
      // swallow — disposal is best-effort
    }
  };

  function waitUntil(acTime: number): Promise<void> {
    return new Promise((resolve) => {
      function check() {
        if (cancelled) return resolve();
        const remaining = acTime - Tone.now();
        if (remaining <= 0) return resolve();
        setTimeout(check, Math.max(10, Math.min(100, remaining * 1000)));
      }
      check();
    });
  }

  const done = waitUntil(targetEnd + 0.05).then(() => {
    // Auto-dispose after target completes so we do not leak synth instances.
    if (!cancelled) {
      try {
        synth.disconnect();
        synth.dispose();
      } catch {
        /* ignore */
      }
    }
  });

  return {
    done,
    targetStartAtAcTime: Promise.resolve(targetAt),
    cancel,
  };
}
