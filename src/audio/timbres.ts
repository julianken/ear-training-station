import * as Tone from 'tone';

export const TIMBRE_IDS = ['piano', 'epiano', 'guitar', 'pad'] as const;
export type TimbreId = (typeof TIMBRE_IDS)[number];

export interface Timbre {
  id: TimbreId;
  label: string;
  /**
   * Build a Tone.js polyphonic instrument. Caller owns disposal.
   * Kept as a factory (not a singleton) so each round gets a fresh instrument
   * — avoids state leak between rounds.
   */
  createSynth: () => Tone.PolySynth;
}

const TIMBRES: Record<TimbreId, Timbre> = {
  piano: {
    id: 'piano',
    label: 'Piano',
    createSynth: () =>
      new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.01, decay: 0.25, sustain: 0.35, release: 0.9 },
      }),
  },
  epiano: {
    id: 'epiano',
    label: 'Electric Piano',
    createSynth: () =>
      new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 2.5,
        modulationIndex: 4,
        envelope: { attack: 0.005, decay: 0.3, sustain: 0.3, release: 0.8 },
        modulationEnvelope: { attack: 0.005, decay: 0.2, sustain: 0.1, release: 0.5 },
      }),
  },
  guitar: {
    id: 'guitar',
    label: 'Guitar',
    createSynth: () =>
      new Tone.PolySynth(Tone.AMSynth, {
        harmonicity: 1.5,
        oscillator: { type: 'sawtooth' },
        envelope: { attack: 0.005, decay: 0.6, sustain: 0.0, release: 0.6 },
        modulation: { type: 'square' },
        modulationEnvelope: { attack: 0.01, decay: 0.2, sustain: 0, release: 0.2 },
      }),
  },
  pad: {
    id: 'pad',
    label: 'Warm Pad',
    createSynth: () =>
      new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'sine' },
        envelope: { attack: 0.3, decay: 0.4, sustain: 0.6, release: 1.5 },
      }),
  },
};

export function getTimbre(id: TimbreId): Timbre {
  const t = TIMBRES[id];
  if (!t) throw new Error(`unknown timbre id: ${id}`);
  return t;
}
