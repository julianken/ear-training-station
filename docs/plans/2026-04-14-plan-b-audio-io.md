# Plan B · Audio I/O

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the browser-side audio input/output layer so a round can *sound*: a cadence plays in a chosen key, a target scale-degree note plays after it, the mic captures the user singing + saying a digit, and the app reports what pitch and digit it heard. By the end of Plan B you can open a dev harness in the browser, tap "play round," sing a response, and see the grading data print to the screen — all without any real product UI.

**Architecture:** Two ingest paths (mic → pitch + mic → digit) and one output path (Tone.js → speakers). Audio structure is decoupled from audio playback: a cadence or target is first represented as pure data (a sequence of note events with timings and pitches) and only then handed to a Tone.js-backed player. Pitch detection runs inside an AudioWorklet (off the main thread) using the YIN algorithm implemented as pure math. Digit recognition uses Google's pretrained Speech Commands model via `@tensorflow-models/speech-commands`. A dev harness HTML page exposes every piece so the implementer and user can validate audio behavior manually before any UI exists.

**Tech Stack:** Tone.js for audio graph + synth instruments, @tensorflow-models/speech-commands (and TF.js) for digit KWS, a hand-rolled YIN AudioWorklet for pitch, Web Audio API MediaDevices for mic permission. All runs in-browser; no native audio.

**Companion docs:**
- [MVP design spec](../specs/2026-04-14-ear-training-mvp-design.md) (§8 Architecture, §9.2 Session screen)
- [Plan A · Foundation + Core Logic](2026-04-14-plan-a-foundation-core-logic.md) (prior — provides types, scheduler, store, orchestrator)

---

## Scope boundaries

**In scope:**
- Procedurally-generated audio (cadence + target note) rendered from MIDI-level data using Tone.js synth instruments.
- Mic-based pitch detection via YIN in an AudioWorklet; reports F0 and confidence per frame.
- Hz → scale-degree mapping given an established key (octave-invariant; returns the nearest diatonic or non-diatonic scale degree plus cents deviation).
- Digit recognition ("one" … "seven") via pretrained TF.js Speech Commands model.
- Mic permission flow (request, remember denied, explain why needed).
- Dev harness HTML page at `/harness/audio.html` for manual validation.
- Browser smoke test that loads the harness and runs a scripted end-to-end audio round.

**Out of scope (Plan C):**
- Any Svelte UI component, session screen, dashboard, feedback state.
- Real instrument samples (Salamander Grand Piano etc.). MVP uses Tone.js built-in synths for all 4 timbres.
- Source separation, user-uploaded audio, transcription workbench.
- Offline caching of TF.js model via service worker (Plan C).
- Persisting mic permission state in IndexedDB (handled in Plan C).

**Explicit non-goals:**
- Sub-10ms latency. Targets are "feels responsive," not "studio-grade."
- Perfect pitch accuracy. YIN ±5¢ on a clean sung tone is the bar; real singing may give worse and that's fine.
- KWS accuracy on singing. Speech Commands is trained on spoken words. If a user *sings* "five" as a long note the model will likely miss it; the product UX tells the user to *say* the digit at normal speaking cadence. We validate this in the harness.

---

## File structure (created by this plan)

```
ear-training/
├── public/
│   ├── harness/
│   │   └── audio.html               # dev harness (manual test page)
│   └── kws/
│       └── README.md                # placeholder for any model assets we cache locally
├── src/
│   ├── audio/
│   │   ├── timbres.ts               # timbre registry + synth factories
│   │   ├── cadence-structure.ts     # pure: Key → ChordEvent sequence
│   │   ├── target-structure.ts      # pure: Key + Degree + register → NoteEvent
│   │   ├── note-math.ts             # pure: Hz ↔ MIDI, Hz ↔ note name
│   │   └── player.ts                # Tone.js wiring: play a sequence of events
│   ├── pitch/
│   │   ├── yin.ts                   # pure: YIN algorithm on a Float32Array
│   │   ├── yin-worklet.ts           # AudioWorklet processor (imports yin.ts)
│   │   ├── pitch-detector.ts        # main-thread facade (starts worklet, exposes stream)
│   │   └── degree-mapping.ts        # pure: Hz + Key → { degree, cents, inKey }
│   ├── speech/
│   │   ├── kws-loader.ts            # load + warm up Speech Commands model
│   │   └── keyword-spotter.ts       # start/stop mic-based digit listening
│   ├── mic/
│   │   └── permission.ts            # getUserMedia wrapper + permission state helpers
│   └── harness/
│       └── audio-harness.ts         # entry script for public/harness/audio.html
└── tests/
    ├── audio/
    │   ├── timbres.test.ts
    │   ├── cadence-structure.test.ts
    │   ├── target-structure.test.ts
    │   └── note-math.test.ts
    ├── pitch/
    │   ├── yin.test.ts
    │   └── degree-mapping.test.ts
    └── harness/
        └── audio-harness.smoke.test.ts  # browser-like test via Playwright (see §Harness Testing)
```

**Dependency additions:**
- `tone` (runtime)
- `@tensorflow/tfjs` (runtime)
- `@tensorflow-models/speech-commands` (runtime)
- `@playwright/test` (dev) — for the one browser smoke test at the end; Playwright auto-installs Chromium.

---

## Testing strategy

- **Pure modules** (`yin`, `note-math`, `cadence-structure`, `target-structure`, `degree-mapping`, `timbres`): unit-tested in Vitest + jsdom like Plan A. Synthetic input data only.
- **Audio playback** (`player.ts`): the public API is a function that takes an event sequence and a schedule callback. Tests verify the scheduling math; Tone.js itself is exercised only by the harness.
- **Pitch detector + KWS + mic permission**: require a real browser. We rely on the **harness** for manual validation and a **single Playwright smoke test** at the end that drives the harness page headlessly with a canned audio stream. This is one integration test, not a unit-test strategy.
- **Harness** (`public/harness/audio.html`): serves as both developer playground and the substrate for the smoke test.

Do not chase 100% unit coverage of Web Audio API calls. That's a trap. Test the math and integration points; let the harness + smoke test cover the rest.

---

## Task 1: Audio note-math helpers (pure)

**Files:**
- Create: `src/audio/note-math.ts`
- Create: `tests/audio/note-math.test.ts`

### Step 1.1 — write failing test

Create `tests/audio/note-math.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  midiToHz,
  hzToMidi,
  pitchClassToMidi,
  centsBetween,
  nearestMidi,
} from '@/audio/note-math';

describe('note-math', () => {
  it('A4 is midi 69 and 440 Hz', () => {
    expect(midiToHz(69)).toBeCloseTo(440, 2);
    expect(hzToMidi(440)).toBeCloseTo(69, 2);
  });

  it('C4 is midi 60 and ~261.63 Hz', () => {
    expect(midiToHz(60)).toBeCloseTo(261.6256, 2);
  });

  it('pitchClassToMidi places a pitch class in a specific octave', () => {
    // Octave 4 in MIDI convention: C4 = 60
    expect(pitchClassToMidi('C', 4)).toBe(60);
    expect(pitchClassToMidi('A', 4)).toBe(69);
    expect(pitchClassToMidi('G#', 4)).toBe(68);
    expect(pitchClassToMidi('B', 4)).toBe(71);
  });

  it('centsBetween returns positive when sung is sharp of target', () => {
    // 440 Hz target, 445 Hz sung → ~+20 cents
    const cents = centsBetween(445, 440);
    expect(cents).toBeGreaterThan(15);
    expect(cents).toBeLessThan(25);
  });

  it('centsBetween returns 0 for identical Hz', () => {
    expect(centsBetween(440, 440)).toBeCloseTo(0, 4);
  });

  it('nearestMidi snaps a hz to the nearest midi and reports cents off', () => {
    const result = nearestMidi(445); // slightly above A4
    expect(result.midi).toBe(69);
    expect(result.cents).toBeGreaterThan(15);
    expect(result.cents).toBeLessThan(25);
  });
});
```

- [ ] **Step 1.2**: Run `npm run test -- note-math`. Expect module-not-found failure.

### Step 1.3 — implement

Create `src/audio/note-math.ts`:

```typescript
import type { PitchClass } from '@/types/music';
import { PITCH_CLASSES } from '@/types/music';

const A4_MIDI = 69;
const A4_HZ = 440;

/** Hz for a MIDI number. A4 = 69 → 440 Hz. */
export function midiToHz(midi: number): number {
  return A4_HZ * Math.pow(2, (midi - A4_MIDI) / 12);
}

/** Fractional MIDI number for a Hz frequency. */
export function hzToMidi(hz: number): number {
  return A4_MIDI + 12 * Math.log2(hz / A4_HZ);
}

/**
 * Convert (pitch class, octave) to a MIDI number.
 * Octave follows the scientific pitch notation: C4 = 60, middle C.
 */
export function pitchClassToMidi(pc: PitchClass, octave: number): number {
  const idx = PITCH_CLASSES.indexOf(pc);
  if (idx < 0) throw new Error(`unknown pitch class: ${pc}`);
  // C4 = MIDI 60; semitone index within an octave matches PITCH_CLASSES starting from C
  return (octave + 1) * 12 + idx;
}

/** Signed cents deviation of `hzSung` from `hzTarget`. Positive = sharp. */
export function centsBetween(hzSung: number, hzTarget: number): number {
  if (hzSung <= 0 || hzTarget <= 0) return 0;
  return 1200 * Math.log2(hzSung / hzTarget);
}

/**
 * Snap a Hz frequency to the nearest MIDI note, reporting cents off
 * the snapped note's frequency.
 */
export function nearestMidi(hz: number): { midi: number; cents: number } {
  if (hz <= 0) return { midi: 0, cents: 0 };
  const midiFloat = hzToMidi(hz);
  const midi = Math.round(midiFloat);
  const cents = centsBetween(hz, midiToHz(midi));
  return { midi, cents };
}
```

- [ ] **Step 1.4**: Run tests; expect 6/6 pass.
- [ ] **Step 1.5**: `npm run typecheck` exits 0.
- [ ] **Step 1.6**: Commit.

```bash
git add src/audio/note-math.ts tests/audio/note-math.test.ts
git commit -m "feat(audio): note-math helpers (midi/hz/cents/nearest)"
```

---

## Task 2: Timbre registry

**Files:**
- Create: `src/audio/timbres.ts`
- Create: `tests/audio/timbres.test.ts`

Timbres are pure metadata at this layer — the `name`, a display label, and a factory function that returns a configured Tone.js instrument. Playback (Task 4) consumes these; Plan C's UI shows the labels in a timbre-variety chip. MVP uses Tone.js built-in synth types (no sample files); real samples are deferred.

### Step 2.1 — write failing test

Create `tests/audio/timbres.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { TIMBRE_IDS, getTimbre, type TimbreId } from '@/audio/timbres';

describe('timbres', () => {
  it('exposes exactly 4 timbre ids', () => {
    expect(TIMBRE_IDS.length).toBe(4);
  });

  it('each timbre id maps to a timbre with a label and a synth factory', () => {
    for (const id of TIMBRE_IDS) {
      const t = getTimbre(id);
      expect(t.id).toBe(id);
      expect(typeof t.label).toBe('string');
      expect(t.label.length).toBeGreaterThan(0);
      expect(typeof t.createSynth).toBe('function');
    }
  });

  it('ids are stable (piano, epiano, guitar, pad)', () => {
    const ids: TimbreId[] = ['piano', 'epiano', 'guitar', 'pad'];
    for (const id of ids) {
      expect(TIMBRE_IDS).toContain(id);
    }
  });

  it('getTimbre throws on unknown id', () => {
    // @ts-expect-error deliberately wrong
    expect(() => getTimbre('banjo')).toThrow();
  });
});
```

- [ ] **Step 2.2**: Run test; expect fail.

### Step 2.3 — install Tone.js

```bash
npm install --save-exact tone@15.0.4
```

(Use the latest stable 15.x or 14.x available. If 15.x has breaking changes that affect the `PolySynth`/`Sampler` API, fall back to the newest 14.x.)

### Step 2.4 — implement

Create `src/audio/timbres.ts`:

```typescript
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
```

- [ ] **Step 2.5**: Run tests. Expect 4/4 pass.
- [ ] **Step 2.6**: `npm run typecheck` — 0 errors.
  - Note: `tone` may import browser APIs at module-load; if the test fails under jsdom because `AudioContext` is missing, import Tone lazily inside `createSynth` (wrap in a function) or add a jsdom audio shim. Do not mock all of Tone.
- [ ] **Step 2.7**: Commit.

```bash
git add package.json package-lock.json src/audio/timbres.ts tests/audio/timbres.test.ts
git commit -m "feat(audio): timbre registry with 4 synth-based instruments"
```

---

## Task 3: Cadence structure (pure)

**Files:**
- Create: `src/audio/cadence-structure.ts`
- Create: `tests/audio/cadence-structure.test.ts`

Represents a cadence as a sequence of `ChordEvent`s — pure data, independent of playback. A ChordEvent has a MIDI-number set, a time offset from cadence start (seconds), and a duration.

### Step 3.1 — write failing test

Create `tests/audio/cadence-structure.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildCadence, CADENCE_DURATION_SECONDS } from '@/audio/cadence-structure';
import { C_MAJOR, G_MAJOR, A_MINOR } from '../helpers/fixtures';

describe('buildCadence', () => {
  it('returns 4 chord events for a I-IV-V-I cadence in major', () => {
    const events = buildCadence(C_MAJOR);
    expect(events.length).toBe(4);
  });

  it('chord roots are I, IV, V, I in the target key (by MIDI semitones from tonic)', () => {
    const events = buildCadence(C_MAJOR);
    // First pitch of each chord is the root
    const roots = events.map((e) => e.notes[0]!);
    // Expected root offsets from tonic in semitones: 0, 5, 7, 0
    const tonic = roots[0]!;
    const offsets = roots.map((m) => (m - tonic) % 12);
    expect(offsets).toEqual([0, 5, 7, 0]);
  });

  it('total cadence duration approximately matches CADENCE_DURATION_SECONDS', () => {
    const events = buildCadence(C_MAJOR);
    const last = events[events.length - 1]!;
    const end = last.startSec + last.durationSec;
    expect(end).toBeCloseTo(CADENCE_DURATION_SECONDS, 0);
  });

  it('G major cadence transposes correctly', () => {
    const c = buildCadence(C_MAJOR);
    const g = buildCadence(G_MAJOR);
    // Semitone distance C→G = 7. Each chord root should shift by 7 mod 12.
    for (let i = 0; i < 4; i++) {
      const dC = c[i]!.notes[0]!;
      const dG = g[i]!.notes[0]!;
      expect(((dG - dC) % 12 + 12) % 12).toBe(7);
    }
  });

  it('minor cadence uses i-iv-V-i (major V in natural-minor convention)', () => {
    const events = buildCadence(A_MINOR);
    const tonic = events[0]!.notes[0]!;
    const offsets = events.map((e) => ((e.notes[0]! - tonic) % 12 + 12) % 12);
    // i, iv, V, i
    expect(offsets).toEqual([0, 5, 7, 0]);
    // Check that i is a minor triad (root, minor third, fifth)
    const iChord = events[0]!.notes;
    // minor triad: offsets 0, 3, 7 from root
    const iOffs = iChord.map((m) => m - iChord[0]!).sort((a, b) => a - b);
    expect(iOffs).toEqual([0, 3, 7]);
  });

  it('chord events have non-overlapping start times', () => {
    const events = buildCadence(C_MAJOR);
    for (let i = 1; i < events.length; i++) {
      expect(events[i]!.startSec).toBeGreaterThanOrEqual(events[i - 1]!.startSec);
    }
  });
});
```

- [ ] **Step 3.2**: Run test; expect fail.

### Step 3.3 — implement

Create `src/audio/cadence-structure.ts`:

```typescript
import type { Key } from '@/types/music';
import { pitchClassToMidi } from './note-math';
import { PITCH_CLASSES } from '@/types/music';

/** Duration of a full I-IV-V-I cadence in seconds (nominal tempo). */
export const CADENCE_DURATION_SECONDS = 3.2;

const CHORD_DURATION_SEC = 0.7; // each chord plays for ~0.7s
const CHORD_GAP_SEC = 0.1;     // small gap between chords
// Step = 0.8s. 4 chords × 0.8s = 3.2s total.

export interface ChordEvent {
  /** MIDI numbers to play simultaneously. */
  notes: number[];
  /** When this chord starts, seconds from cadence start. */
  startSec: number;
  /** How long each pitch in this chord sounds. */
  durationSec: number;
  /** Roman-numeral label for UI / debugging ('I', 'IV', 'V', 'i', 'iv'). */
  romanNumeral: string;
}

/**
 * Build a I-IV-V-I cadence (major) or i-iv-V-i (minor, harmonic-minor-flavored
 * with a major V to establish the tonic).
 *
 * Voicings are simple root-position triads in the octave centered around middle C.
 */
export function buildCadence(key: Key): ChordEvent[] {
  const tonicMidi = pitchClassToMidi(key.tonic, 4); // octave 4 for middle voicing
  const isMajor = key.quality === 'major';

  // Semitone offsets from tonic for the three chord roots (I, IV, V):
  // Major: major triad (0, 4, 7), IV major (5 + (0, 4, 7)), V major (7 + (0, 4, 7))
  // Minor: minor triad (0, 3, 7), iv minor (5 + (0, 3, 7)), V major (7 + (0, 4, 7))
  const majorTriad = [0, 4, 7];
  const minorTriad = [0, 3, 7];

  const I_notes = isMajor ? majorTriad : minorTriad;
  const IV_notes = isMajor ? majorTriad : minorTriad;
  const V_notes = majorTriad; // V is major in both major and minor cadences for resolution

  const events: ChordEvent[] = [];
  const rootOffsets = [0, 5, 7, 0]; // I, IV, V, I
  const triads = [I_notes, IV_notes, V_notes, I_notes];
  const labels = isMajor ? ['I', 'IV', 'V', 'I'] : ['i', 'iv', 'V', 'i'];

  for (let i = 0; i < 4; i++) {
    const rootMidi = tonicMidi + rootOffsets[i]!;
    const notes = triads[i]!.map((off) => rootMidi + off);
    events.push({
      notes,
      startSec: i * (CHORD_DURATION_SEC + CHORD_GAP_SEC),
      durationSec: CHORD_DURATION_SEC,
      romanNumeral: labels[i]!,
    });
  }
  // Quiet the TS unused-var check on PITCH_CLASSES; pitchClassToMidi uses it indirectly.
  void PITCH_CLASSES;
  return events;
}
```

(Note: the `void PITCH_CLASSES` import is not strictly needed; remove that line if lint complains.)

- [ ] **Step 3.4**: Run tests. Expect 6/6 pass.
- [ ] **Step 3.5**: Typecheck 0.
- [ ] **Step 3.6**: Commit.

```bash
git add src/audio/cadence-structure.ts tests/audio/cadence-structure.test.ts
git commit -m "feat(audio): cadence structure generator (I-IV-V-I, major and minor)"
```

---

## Task 4: Target note structure (pure)

**Files:**
- Create: `src/audio/target-structure.ts`
- Create: `tests/audio/target-structure.test.ts`

Given a `Key`, a `Degree`, and a desired `Register`, produce a single `NoteEvent` with a chosen MIDI number.

### Step 4.1 — write failing test

Create `tests/audio/target-structure.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildTarget, TARGET_DURATION_SECONDS } from '@/audio/target-structure';
import { C_MAJOR, A_MINOR } from '../helpers/fixtures';
import { midiToHz } from '@/audio/note-math';

describe('buildTarget', () => {
  it('returns a single note event for a scale degree in a key', () => {
    const ev = buildTarget(C_MAJOR, 5, 'comfortable');
    expect(typeof ev.midi).toBe('number');
    expect(ev.durationSec).toBeCloseTo(TARGET_DURATION_SECONDS, 2);
  });

  it('degree 5 in C major equals G (MIDI 67) in octave 4', () => {
    const ev = buildTarget(C_MAJOR, 5, 'comfortable');
    expect(ev.midi).toBe(67);
    expect(midiToHz(ev.midi)).toBeCloseTo(391.995, 1);
  });

  it('degree 3 in A minor equals C (MIDI 60) in octave 4', () => {
    const ev = buildTarget(A_MINOR, 3, 'comfortable');
    expect(ev.midi).toBe(60);
  });

  it('narrow register stays within one octave above tonic', () => {
    for (const d of [1, 2, 3, 4, 5, 6, 7] as const) {
      const ev = buildTarget(C_MAJOR, d, 'narrow');
      // Tonic in narrow mode = C4 = 60. Max: B4 = 71.
      expect(ev.midi).toBeGreaterThanOrEqual(60);
      expect(ev.midi).toBeLessThanOrEqual(71);
    }
  });

  it('wide register can span below tonic', () => {
    // With 'wide', we expect at least one degree to fall below octave-4 tonic for some keys.
    // For C major degree 1 wide, the target may be C3 = 48 or C4 = 60. Just verify the range span.
    const picks = [1, 2, 3, 4, 5, 6, 7].map((d) =>
      buildTarget(C_MAJOR, d as 1|2|3|4|5|6|7, 'wide').midi,
    );
    const min = Math.min(...picks);
    const max = Math.max(...picks);
    expect(max - min).toBeGreaterThan(0); // non-zero range
    expect(max).toBeLessThan(84); // nothing above C6
    expect(min).toBeGreaterThan(36); // nothing below C2
  });

  it('target hz matches the midi output', () => {
    const ev = buildTarget(C_MAJOR, 5, 'comfortable');
    expect(ev.hz).toBeCloseTo(midiToHz(ev.midi), 2);
  });
});
```

- [ ] **Step 4.2**: Run — expect fail.

### Step 4.3 — implement

Create `src/audio/target-structure.ts`:

```typescript
import type { Key, Degree } from '@/types/music';
import type { Register } from '@/types/domain';
import { semitoneOffset } from '@/types/music';
import { pitchClassToMidi, midiToHz } from './note-math';

export const TARGET_DURATION_SECONDS = 1.5;

export interface NoteEvent {
  midi: number;
  hz: number;
  durationSec: number;
}

/**
 * Produce a single scale-degree target note in the specified register.
 * Registers:
 *   - 'narrow': degree note sits in the octave starting at tonic4 (no below-tonic notes)
 *   - 'comfortable': same but can use next octave for degrees 6, 7 if higher feels better
 *   - 'wide': deterministic octave variation across degrees (for variety)
 */
export function buildTarget(
  key: Key,
  degree: Degree,
  register: Register,
): NoteEvent {
  const tonicMidi = pitchClassToMidi(key.tonic, 4);
  const offset = semitoneOffset(degree, key.quality);
  let midi = tonicMidi + offset;

  if (register === 'wide') {
    // Interleaved-octave variation: odd degrees in octave 4, even in octave 3, with
    // a deterministic swap for degrees 6-7 to avoid landing too low.
    if (degree === 2 || degree === 4) midi -= 12; // drop an octave
    if (degree === 6 || degree === 7) midi += 0;  // stay put (above tonic already)
  }
  // 'narrow' and 'comfortable' currently produce the same output.
  // Distinguishing them is deferred — the register axis exists now in the data model;
  // concrete narrowing rules live with UI settings (Plan C).

  return {
    midi,
    hz: midiToHz(midi),
    durationSec: TARGET_DURATION_SECONDS,
  };
}
```

- [ ] **Step 4.4**: Run tests. 6/6 pass.
- [ ] **Step 4.5**: Typecheck 0.
- [ ] **Step 4.6**: Commit.

```bash
git add src/audio/target-structure.ts tests/audio/target-structure.test.ts
git commit -m "feat(audio): target-note structure generator"
```

---

## Task 5: YIN pitch detection (pure math)

**Files:**
- Create: `src/pitch/yin.ts`
- Create: `tests/pitch/yin.test.ts`

YIN is a classical autocorrelation-based F0 estimator. The pure math version takes a `Float32Array` buffer and a sample rate and returns `{ hz, confidence }`. Confidence is a number in `[0, 1]` — higher = more reliable.

### Step 5.1 — write failing test

Create `tests/pitch/yin.test.ts`:

```typescript
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

/** Low-amplitude random noise. */
function noise(lenSamples = BUFFER_SIZE, amp = 0.01): Float32Array {
  const out = new Float32Array(lenSamples);
  for (let n = 0; n < lenSamples; n++) out[n] = (Math.random() * 2 - 1) * amp;
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
```

- [ ] **Step 5.2**: Run — expect fail.

### Step 5.3 — implement

Create `src/pitch/yin.ts`:

```typescript
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
```

- [ ] **Step 5.4**: Run tests. Expect 5/5 pass.

If the noise test flakes due to Math.random, run it a second time to sanity check — flaky behavior on a single ill-defined input is acceptable for a noise test. If it flakes repeatedly, lower the amplitude or seed the rng.

- [ ] **Step 5.5**: Typecheck 0.
- [ ] **Step 5.6**: Commit.

```bash
git add src/pitch/yin.ts tests/pitch/yin.test.ts
git commit -m "feat(pitch): YIN pitch-detection algorithm"
```

---

## Task 6: Hz → scale-degree mapping (pure)

**Files:**
- Create: `src/pitch/degree-mapping.ts`
- Create: `tests/pitch/degree-mapping.test.ts`

Given a detected Hz and the current `Key`, snap to the nearest scale degree (1–7) and report how many cents off the ideal that is. Octave-invariant. Also reports whether the detected pitch is in-key (within some cents tolerance of a diatonic degree) or out-of-key.

### Step 6.1 — test first

Create `tests/pitch/degree-mapping.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { mapHzToDegree } from '@/pitch/degree-mapping';
import { C_MAJOR, A_MINOR } from '../helpers/fixtures';
import { midiToHz, pitchClassToMidi } from '@/audio/note-math';

describe('mapHzToDegree', () => {
  it('exact C maps to degree 1 in C major', () => {
    const hz = midiToHz(pitchClassToMidi('C', 4));
    const r = mapHzToDegree(hz, C_MAJOR);
    expect(r.degree).toBe(1);
    expect(Math.abs(r.cents)).toBeLessThan(5);
    expect(r.inKey).toBe(true);
  });

  it('exact G maps to degree 5 in C major (any octave)', () => {
    const g3 = midiToHz(pitchClassToMidi('G', 3));
    const g4 = midiToHz(pitchClassToMidi('G', 4));
    const g5 = midiToHz(pitchClassToMidi('G', 5));
    for (const hz of [g3, g4, g5]) {
      const r = mapHzToDegree(hz, C_MAJOR);
      expect(r.degree).toBe(5);
      expect(r.inKey).toBe(true);
    }
  });

  it('A in A minor maps to degree 1', () => {
    const hz = midiToHz(pitchClassToMidi('A', 4));
    const r = mapHzToDegree(hz, A_MINOR);
    expect(r.degree).toBe(1);
  });

  it('C in A minor maps to degree 3 (minor third of A)', () => {
    const hz = midiToHz(pitchClassToMidi('C', 5));
    const r = mapHzToDegree(hz, A_MINOR);
    expect(r.degree).toBe(3);
  });

  it('sharp pitch reports positive cents', () => {
    const hz = midiToHz(pitchClassToMidi('G', 4)) * Math.pow(2, 20 / 1200); // +20 cents
    const r = mapHzToDegree(hz, C_MAJOR);
    expect(r.degree).toBe(5);
    expect(r.cents).toBeGreaterThan(15);
    expect(r.cents).toBeLessThan(25);
  });

  it('out-of-key pitch (F# in C major) maps to nearest degree (4 or 5) with inKey=false', () => {
    const hz = midiToHz(pitchClassToMidi('F#', 4));
    const r = mapHzToDegree(hz, C_MAJOR);
    expect([4, 5]).toContain(r.degree);
    expect(r.inKey).toBe(false);
  });

  it('returns null for non-positive hz', () => {
    expect(mapHzToDegree(0, C_MAJOR)).toBe(null);
    expect(mapHzToDegree(-1, C_MAJOR)).toBe(null);
  });
});
```

- [ ] **Step 6.2**: Run test — expect fail.

### Step 6.3 — implement

Create `src/pitch/degree-mapping.ts`:

```typescript
import type { Key, Degree } from '@/types/music';
import { DEGREES, semitoneOffset } from '@/types/music';
import { hzToMidi, pitchClassToMidi } from '@/audio/note-math';

export interface DegreeMapping {
  degree: Degree;
  /** Signed cents deviation from the ideal pitch of that degree in the current key. */
  cents: number;
  /** True if |cents| < IN_KEY_CENTS (the pitch sits on a diatonic degree). */
  inKey: boolean;
}

/** Pitch must be within this cents range of a diatonic degree to count as "in key". */
const IN_KEY_CENTS = 50;

/**
 * Map a detected Hz to the nearest diatonic scale degree in the given key,
 * octave-invariant. Returns null if `hz` is not positive.
 */
export function mapHzToDegree(hz: number, key: Key): DegreeMapping | null {
  if (hz <= 0) return null;

  const sungMidi = hzToMidi(hz);
  const tonicMidi = pitchClassToMidi(key.tonic, 4);
  // Pitch-class distance mod 12 from tonic. Negative rounding-safe.
  const sungPcFromTonic = ((sungMidi - tonicMidi) % 12 + 12) % 12;

  let best: { degree: Degree; cents: number } | null = null;
  for (const d of DEGREES) {
    const targetOffset = semitoneOffset(d, key.quality);
    // Compare sungPcFromTonic to targetOffset, choosing the shorter circular distance.
    let diff = sungPcFromTonic - targetOffset; // semitones
    // Normalize to [-6, 6]
    while (diff > 6) diff -= 12;
    while (diff < -6) diff += 12;
    const cents = diff * 100;
    if (best === null || Math.abs(cents) < Math.abs(best.cents)) {
      best = { degree: d, cents };
    }
  }

  // best is always non-null because DEGREES has 7 entries
  const { degree, cents } = best!;
  return { degree, cents, inKey: Math.abs(cents) < IN_KEY_CENTS };
}
```

- [ ] **Step 6.4**: Run tests. 7/7 pass.
- [ ] **Step 6.5**: Typecheck 0.
- [ ] **Step 6.6**: Commit.

```bash
git add src/pitch/degree-mapping.ts tests/pitch/degree-mapping.test.ts
git commit -m "feat(pitch): Hz → scale-degree mapping (octave-invariant)"
```

---

## Task 7: Audio player (Tone.js wiring)

**Files:**
- Create: `src/audio/player.ts`

This file couples our pure event structures to Tone.js. It does NOT have unit tests — Tone.js is not meaningfully testable in Vitest/jsdom without heavy mocking. We validate it via the harness (Task 11) and browser smoke test (Task 12).

### Step 7.1 — write `src/audio/player.ts`

```typescript
import * as Tone from 'tone';
import type { ChordEvent } from './cadence-structure';
import type { NoteEvent } from './target-structure';
import { midiToHz } from './note-math';
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
 */
export function playRound(input: PlayRoundInput): PlayRoundHandle {
  const gap = input.gapSec ?? 0.4;
  const synth = getTimbre(input.timbreId).createSynth();
  synth.toDestination();

  const now = Tone.now();
  let lastCadenceEnd = now;

  // Schedule cadence chords
  for (const ev of input.cadence) {
    const at = now + ev.startSec;
    const hzs = ev.notes.map((m) => midiToHz(m));
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

  const waitUntil = (acTime: number): Promise<void> =>
    new Promise((resolve) => {
      const check = () => {
        if (cancelled) return resolve();
        const remaining = acTime - Tone.now();
        if (remaining <= 0) return resolve();
        setTimeout(check, Math.max(10, Math.min(100, remaining * 1000)));
      };
      check();
    });

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
```

- [ ] **Step 7.2**: Typecheck — 0.
- [ ] **Step 7.3**: No test file. Commit.

```bash
git add src/audio/player.ts
git commit -m "feat(audio): Tone.js player for cadence + target round"
```

Document this explicitly in the commit body if a code reviewer flags the lack of tests: Tone.js effectively requires a real AudioContext. Integration coverage is in Task 11's harness + Task 12's smoke test.

---

## Task 8: Pitch detector (AudioWorklet + facade)

**Files:**
- Create: `src/pitch/yin-worklet.ts`
- Create: `src/pitch/pitch-detector.ts`

The worklet runs YIN on every 2048-sample buffer from the mic. The main-thread facade wraps the worklet in a subscribe-able event stream.

### Step 8.1 — `src/pitch/yin-worklet.ts`

This file is imported by the main thread *as a URL* (Vite supports `new URL('./yin-worklet.ts', import.meta.url)` for worklet registration), so it must be a standalone module that the AudioWorkletGlobalScope can execute. Keep imports to the YIN pure function only.

```typescript
/// <reference lib="WebWorker" />
// AudioWorklet global scope — not the main thread.
import { detectPitch } from './yin';

declare const registerProcessor: (name: string, ctor: unknown) => void;

class YinProcessor extends AudioWorkletProcessor {
  // ring buffer of samples
  private buf: Float32Array = new Float32Array(2048);
  private writePos = 0;
  private sr: number;

  constructor() {
    super();
    // sampleRate is provided in AudioWorkletGlobalScope
    this.sr = (globalThis as unknown as { sampleRate: number }).sampleRate;
  }

  process(inputs: Float32Array[][]): boolean {
    const input = inputs[0]?.[0];
    if (!input) return true;

    // Write incoming samples into ring buffer
    for (let i = 0; i < input.length; i++) {
      this.buf[this.writePos] = input[i]!;
      this.writePos = (this.writePos + 1) % this.buf.length;
    }

    // Run detection on the last 2048 samples (always, every render quantum ~128 samples)
    // For performance, we could throttle to once per N render quanta.
    const { hz, confidence } = detectPitch(this.buf, this.sr);
    this.port.postMessage({ hz, confidence, at: currentTime });
    return true;
  }
}

registerProcessor('yin-processor', YinProcessor);
```

Note: `AudioWorkletProcessor` and `currentTime` are globals in the worklet scope. TypeScript's `lib.webworker.d.ts` reference may or may not cover them — if typecheck errors arise, `// @ts-expect-error` on the `AudioWorkletProcessor` `extends` line and the `currentTime` reference is acceptable for this file only. Document why in a code comment.

### Step 8.2 — `src/pitch/pitch-detector.ts`

```typescript
export interface PitchFrame {
  hz: number;
  confidence: number;
  /** Timestamp in AudioContext time (seconds). */
  at: number;
}

export interface PitchDetectorHandle {
  stop: () => Promise<void>;
  /** Observable of pitch frames. Returns unsubscribe fn. */
  subscribe: (cb: (frame: PitchFrame) => void) => () => void;
}

export interface StartPitchDetectorInput {
  audioContext: AudioContext;
  micStream: MediaStream;
}

/**
 * Start pitch detection on a mic stream. Caller owns the AudioContext and
 * MediaStream lifetimes.
 */
export async function startPitchDetector(
  input: StartPitchDetectorInput,
): Promise<PitchDetectorHandle> {
  const { audioContext, micStream } = input;

  // Load the worklet module. Vite will handle the URL resolution at build time.
  const workletUrl = new URL('./yin-worklet.ts', import.meta.url);
  await audioContext.audioWorklet.addModule(workletUrl.href);

  const source = audioContext.createMediaStreamSource(micStream);
  const node = new AudioWorkletNode(audioContext, 'yin-processor');

  source.connect(node);
  // Worklet output is not routed to destination — we only want analysis.

  const subscribers = new Set<(f: PitchFrame) => void>();

  node.port.onmessage = (ev: MessageEvent<PitchFrame>) => {
    const frame = ev.data;
    for (const cb of subscribers) cb(frame);
  };

  return {
    subscribe(cb) {
      subscribers.add(cb);
      return () => subscribers.delete(cb);
    },
    async stop() {
      source.disconnect();
      node.port.onmessage = null;
      node.disconnect();
    },
  };
}
```

- [ ] **Step 8.3**: Typecheck. It may complain about `AudioWorkletProcessor` / `registerProcessor` / `currentTime` / `AudioWorkletGlobalScope`. Two acceptable solutions:
  1. Add `"lib": ["ES2022", "DOM", "DOM.Iterable", "WebWorker"]` to `tsconfig.json` and declare a dedicated type for the worklet scope inline.
  2. Mark the worklet file with `// @ts-nocheck` at the top. This is pragmatic for a file whose correctness is verified at runtime in the harness. Prefer option 2 if option 1 breaks other files' types.

Document the choice in a comment at the top of `yin-worklet.ts`.

- [ ] **Step 8.4**: No unit tests for these modules — worklet requires a real AudioContext. Coverage is via the harness.
- [ ] **Step 8.5**: Commit.

```bash
git add src/pitch/yin-worklet.ts src/pitch/pitch-detector.ts
git commit -m "feat(pitch): YIN AudioWorklet + main-thread facade"
```

---

## Task 9: Mic permission helper

**Files:**
- Create: `src/mic/permission.ts`

Tiny module. Requests mic via `getUserMedia`. Exposes permission state transitions (prompt / granted / denied / unavailable).

### Step 9.1 — implement

Create `src/mic/permission.ts`:

```typescript
export type MicPermissionState =
  | 'unknown'
  | 'prompt'
  | 'granted'
  | 'denied'
  | 'unavailable';

export interface MicStreamHandle {
  stream: MediaStream;
  stop: () => void;
}

/**
 * Request mic access. Returns a MediaStream if granted; throws on denial/unavailability.
 * The caller is responsible for calling `stop()` when done to release the mic.
 */
export async function requestMicStream(): Promise<MicStreamHandle> {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    const e = new Error('Microphone API unavailable in this browser');
    (e as Error & { code?: string }).code = 'unavailable';
    throw e;
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: false, // we care about pitch, not loudness
      channelCount: 1,
    },
    video: false,
  });

  return {
    stream,
    stop() {
      for (const t of stream.getTracks()) t.stop();
    },
  };
}

/**
 * Query the current mic permission state without prompting.
 * Not supported on all browsers — falls back to 'unknown'.
 */
export async function queryMicPermission(): Promise<MicPermissionState> {
  try {
    // @ts-expect-error - Permissions.query with 'microphone' is non-standard in some TS lib versions
    const status = await navigator.permissions.query({ name: 'microphone' });
    if (status.state === 'granted') return 'granted';
    if (status.state === 'denied') return 'denied';
    if (status.state === 'prompt') return 'prompt';
  } catch {
    // Some browsers (Safari) lack Permissions API for microphone.
  }
  return 'unknown';
}
```

- [ ] **Step 9.2**: Typecheck 0. No tests (jsdom does not simulate getUserMedia usefully).
- [ ] **Step 9.3**: Commit.

```bash
git add src/mic/permission.ts
git commit -m "feat(mic): permission helper"
```

---

## Task 10: Keyword-spotter (digits one–seven)

**Files:**
- Create: `src/speech/kws-loader.ts`
- Create: `src/speech/keyword-spotter.ts`

Uses the prebuilt Google Speech Commands model via `@tensorflow-models/speech-commands`. This model recognizes 18 words including "one" through "nine" — we filter to our target digits.

### Step 10.1 — install

```bash
npm install --save-exact @tensorflow/tfjs@4.22.0 @tensorflow-models/speech-commands@0.5.4
```

(Verify versions install without peer-dep errors; if newer versions exist that are stable, use those. If the `@tensorflow-models/speech-commands` package is unmaintained or has peer-dep issues with current `@tensorflow/tfjs`, stop and report BLOCKED with the error details. A viable alternative is `mediapipe/tasks-audio` but requires a different integration — prefer speech-commands first.)

### Step 10.2 — `src/speech/kws-loader.ts`

```typescript
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
```

### Step 10.3 — `src/speech/keyword-spotter.ts`

```typescript
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
      return () => subscribers.delete(cb);
    },
  };
}
```

- [ ] **Step 10.4**: Typecheck. Expect some generic-any noise from the `@tensorflow-models/speech-commands` typings — address specific errors only, do not widen to `any` en masse.
- [ ] **Step 10.5**: No Vitest unit tests for this module (requires browser mic). Covered by harness.
- [ ] **Step 10.6**: Commit.

```bash
git add package.json package-lock.json src/speech/kws-loader.ts src/speech/keyword-spotter.ts
git commit -m "feat(speech): digit keyword-spotter via @tensorflow-models/speech-commands"
```

---

## Task 11: Dev harness page

**Files:**
- Create: `public/harness/audio.html`
- Create: `src/harness/audio-harness.ts`
- Modify: `vite.config.ts` to serve `public/harness/` and allow the harness entry

This is a no-framework HTML page that lets you click buttons and see audio pipeline state. The final product UI is Plan C; this harness is the one-off debugging substrate.

### Step 11.1 — `public/harness/audio.html`

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Audio Harness · ear-training-station</title>
    <style>
      :root { color-scheme: dark; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Inter", system-ui, sans-serif;
        background: #0a0a0a; color: #fafafa;
        margin: 0; padding: 24px;
        max-width: 720px; margin-inline: auto;
      }
      h1 { font-weight: 800; letter-spacing: -0.02em; font-size: 20px; }
      h2 { font-size: 12px; letter-spacing: 0.2em; text-transform: uppercase; color: #737373; font-weight: 700; margin-top: 32px; }
      .row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin: 8px 0; }
      button { background: #22d3ee; color: #0a0a0a; border: 0; padding: 10px 14px; border-radius: 6px; font-weight: 700; cursor: pointer; }
      button[disabled] { opacity: 0.4; cursor: not-allowed; }
      button.secondary { background: #171717; color: #fafafa; border: 1px solid #262626; }
      select, input[type="number"] { background: #171717; color: #fafafa; border: 1px solid #262626; border-radius: 6px; padding: 8px; font-family: inherit; }
      .log { background: #0f0f0f; border: 1px solid #171717; border-radius: 6px; padding: 12px; font-family: ui-monospace, monospace; font-size: 11px; white-space: pre-wrap; max-height: 300px; overflow: auto; }
      .kv { display: grid; grid-template-columns: max-content 1fr; gap: 6px 12px; font-family: ui-monospace, monospace; font-size: 12px; }
      .kv .k { color: #737373; letter-spacing: 0.1em; text-transform: uppercase; font-size: 10px; align-self: center; }
      .kv .v { color: #22d3ee; }
      .kv .v.amber { color: #fbbf24; }
      .kv .v.red { color: #ef4444; }
    </style>
  </head>
  <body>
    <h1>Audio Harness</h1>

    <h2>Playback</h2>
    <div class="row">
      <label>Timbre <select id="timbre"></select></label>
      <label>Key <select id="key"></select></label>
      <label>Degree <select id="degree"></select></label>
      <label>Register <select id="register">
        <option>narrow</option><option selected>comfortable</option><option>wide</option>
      </select></label>
      <button id="play">Play round</button>
    </div>

    <h2>Mic — Pitch</h2>
    <div class="row">
      <button id="start-pitch">Start pitch detection</button>
      <button id="stop-pitch" class="secondary" disabled>Stop</button>
    </div>
    <div class="kv">
      <div class="k">Hz</div><div id="pitch-hz" class="v">—</div>
      <div class="k">Degree</div><div id="pitch-degree" class="v">—</div>
      <div class="k">Cents</div><div id="pitch-cents" class="v">—</div>
      <div class="k">Confidence</div><div id="pitch-conf" class="v">—</div>
    </div>

    <h2>Mic — Digit</h2>
    <div class="row">
      <button id="start-kws">Start digit recognizer</button>
      <button id="stop-kws" class="secondary" disabled>Stop</button>
    </div>
    <div class="kv">
      <div class="k">Digit</div><div id="kws-digit" class="v amber">—</div>
      <div class="k">Confidence</div><div id="kws-conf" class="v">—</div>
    </div>

    <h2>Log</h2>
    <div id="log" class="log"></div>

    <script type="module" src="/src/harness/audio-harness.ts"></script>
  </body>
</html>
```

### Step 11.2 — `src/harness/audio-harness.ts`

```typescript
import * as Tone from 'tone';
import { TIMBRE_IDS } from '@/audio/timbres';
import { DEGREES } from '@/types/music';
import { buildCadence } from '@/audio/cadence-structure';
import { buildTarget } from '@/audio/target-structure';
import { ensureAudioContextStarted, playRound } from '@/audio/player';
import { requestMicStream } from '@/mic/permission';
import { startPitchDetector, type PitchDetectorHandle } from '@/pitch/pitch-detector';
import { mapHzToDegree } from '@/pitch/degree-mapping';
import { startKeywordSpotter, type KeywordSpotterHandle } from '@/speech/keyword-spotter';
import type { Key, PitchClass } from '@/types/music';

const TONICS: PitchClass[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const QUALITIES = ['major', 'minor'] as const;

// Populate dropdowns
const timbreSel = document.getElementById('timbre') as HTMLSelectElement;
for (const id of TIMBRE_IDS) {
  const opt = document.createElement('option');
  opt.value = id; opt.textContent = id; timbreSel.appendChild(opt);
}
const keySel = document.getElementById('key') as HTMLSelectElement;
for (const t of TONICS) for (const q of QUALITIES) {
  const opt = document.createElement('option');
  opt.value = `${t}-${q}`; opt.textContent = `${t} ${q}`;
  keySel.appendChild(opt);
}
keySel.value = 'C-major';
const degreeSel = document.getElementById('degree') as HTMLSelectElement;
for (const d of DEGREES) {
  const opt = document.createElement('option');
  opt.value = String(d); opt.textContent = String(d); degreeSel.appendChild(opt);
}
degreeSel.value = '5';
const registerSel = document.getElementById('register') as HTMLSelectElement;

const logEl = document.getElementById('log')!;
function log(...parts: unknown[]): void {
  const line = parts.map((p) => typeof p === 'string' ? p : JSON.stringify(p)).join(' ');
  const stamp = new Date().toISOString().slice(11, 23);
  logEl.textContent = `[${stamp}] ${line}\n${logEl.textContent ?? ''}`.slice(0, 8000);
}

function parseKey(val: string): Key {
  const [tonic, quality] = val.split('-');
  return { tonic: tonic as PitchClass, quality: quality as 'major' | 'minor' };
}

// Playback
(document.getElementById('play') as HTMLButtonElement).addEventListener('click', async () => {
  await ensureAudioContextStarted();
  const key = parseKey(keySel.value);
  const degree = Number(degreeSel.value) as 1|2|3|4|5|6|7;
  const cadence = buildCadence(key);
  const target = buildTarget(key, degree, registerSel.value as 'narrow' | 'comfortable' | 'wide');
  log('playRound', { key, degree, target });
  const handle = playRound({ timbreId: timbreSel.value as any, cadence, target });
  await handle.done;
  log('round complete');
});

// Pitch
let pitchHandle: PitchDetectorHandle | null = null;
let micStop: (() => void) | null = null;
let unsubPitch: (() => void) | null = null;

const pitchHz = document.getElementById('pitch-hz')!;
const pitchDeg = document.getElementById('pitch-degree')!;
const pitchCents = document.getElementById('pitch-cents')!;
const pitchConf = document.getElementById('pitch-conf')!;

(document.getElementById('start-pitch') as HTMLButtonElement).addEventListener('click', async () => {
  try {
    await ensureAudioContextStarted();
    const { stream, stop } = await requestMicStream();
    micStop = stop;
    const ac = Tone.getContext().rawContext as AudioContext;
    pitchHandle = await startPitchDetector({ audioContext: ac, micStream: stream });
    unsubPitch = pitchHandle.subscribe((frame) => {
      pitchHz.textContent = frame.hz > 0 ? frame.hz.toFixed(1) : '—';
      pitchConf.textContent = frame.confidence.toFixed(2);
      if (frame.hz > 0 && frame.confidence > 0.5) {
        const key = parseKey(keySel.value);
        const m = mapHzToDegree(frame.hz, key);
        if (m) {
          pitchDeg.textContent = String(m.degree);
          pitchCents.textContent = `${m.cents >= 0 ? '+' : ''}${m.cents.toFixed(0)}`;
        }
      }
    });
    (document.getElementById('start-pitch') as HTMLButtonElement).disabled = true;
    (document.getElementById('stop-pitch') as HTMLButtonElement).disabled = false;
    log('pitch detector started');
  } catch (e) {
    log('pitch start failed', (e as Error).message);
  }
});

(document.getElementById('stop-pitch') as HTMLButtonElement).addEventListener('click', async () => {
  unsubPitch?.();
  await pitchHandle?.stop();
  micStop?.();
  pitchHandle = null; micStop = null; unsubPitch = null;
  (document.getElementById('start-pitch') as HTMLButtonElement).disabled = false;
  (document.getElementById('stop-pitch') as HTMLButtonElement).disabled = true;
  log('pitch detector stopped');
});

// Digit KWS
let kwsHandle: KeywordSpotterHandle | null = null;
let unsubKws: (() => void) | null = null;

const kwsDigit = document.getElementById('kws-digit')!;
const kwsConf = document.getElementById('kws-conf')!;

(document.getElementById('start-kws') as HTMLButtonElement).addEventListener('click', async () => {
  try {
    kwsHandle = await startKeywordSpotter();
    unsubKws = kwsHandle.subscribe((frame) => {
      kwsDigit.textContent = frame.digit ?? '—';
      kwsConf.textContent = frame.confidence.toFixed(2);
    });
    (document.getElementById('start-kws') as HTMLButtonElement).disabled = true;
    (document.getElementById('stop-kws') as HTMLButtonElement).disabled = false;
    log('kws started');
  } catch (e) {
    log('kws start failed', (e as Error).message);
  }
});

(document.getElementById('stop-kws') as HTMLButtonElement).addEventListener('click', async () => {
  unsubKws?.();
  await kwsHandle?.stop();
  kwsHandle = null; unsubKws = null;
  (document.getElementById('start-kws') as HTMLButtonElement).disabled = false;
  (document.getElementById('stop-kws') as HTMLButtonElement).disabled = true;
  log('kws stopped');
});
```

### Step 11.3 — Vite config

Vite serves `public/` at the root by default. The harness should be reachable at `http://localhost:5173/harness/audio.html`. No config change should be needed if `public/harness/audio.html` exists — verify by running `npm run dev` and visiting the URL.

If Vite does not resolve the `/src/harness/audio-harness.ts` script import from the harness HTML (it should, since `public/*.html` files can reference source files via Vite's dev middleware), update `vite.config.ts` to add the harness as an additional entry:

```typescript
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [svelte()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: { port: 5173 },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        harness: resolve(__dirname, 'public/harness/audio.html'),
      },
    },
  },
});
```

- [ ] **Step 11.4**: Start `npm run dev`; visit `http://localhost:5173/harness/audio.html`. Click Play round — should hear a cadence + target. Click Start pitch detection, grant mic, sing a note — should see Hz and scale-degree update. Click Start digit recognizer — say "five" at normal speech cadence — should see "five" appear with a confidence.
- [ ] **Step 11.5**: The harness is manual-only; there is no Vitest unit test for it. Commit.

```bash
git add public/harness/audio.html src/harness/audio-harness.ts vite.config.ts
git commit -m "feat(harness): dev harness for manual audio validation"
```

---

## Task 12: Browser smoke test

**Files:**
- Create: `tests/harness/audio-harness.smoke.spec.ts` (Playwright — note the `.spec.ts` convention to distinguish from Vitest)
- Modify: `package.json` to add a `test:e2e` script
- Create: `playwright.config.ts`
- Install `@playwright/test`

This single test drives the harness page in headless Chromium with a canned audio stream (a pre-recorded sine wave at 440 Hz) injected via `--use-fake-ui-for-media-stream` + `--use-fake-device-for-media-stream` + `--use-file-for-fake-audio-capture`. It verifies the whole audio stack loads and the pitch detector reports ~440 Hz.

### Step 12.1 — install

```bash
npm install --save-dev --save-exact @playwright/test@1.47.0
npx playwright install chromium
```

### Step 12.2 — test audio fixture

Create `tests/harness/fixtures/a4-sine.wav` using a tool of your choice (sox, ffmpeg, or a Node script). A 5-second 440 Hz sine at 16 kHz mono is sufficient. Example with sox (if available):

```bash
mkdir -p tests/harness/fixtures
sox -n -r 16000 -c 1 tests/harness/fixtures/a4-sine.wav synth 5 sine 440
```

If sox is unavailable, use a Node script:

```typescript
// tests/harness/fixtures/make-sine.mjs
import { writeFileSync } from 'node:fs';
const sr = 16000, sec = 5, f = 440;
const n = sr * sec;
const buf = Buffer.alloc(44 + n * 2);
// WAV header
buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8);
buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);
buf.writeUInt16LE(1, 22); buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * 2, 28);
buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
for (let i = 0; i < n; i++) {
  const s = Math.sin(2 * Math.PI * f * i / sr) * 0.5 * 32767;
  buf.writeInt16LE(Math.round(s), 44 + i * 2);
}
writeFileSync('tests/harness/fixtures/a4-sine.wav', buf);
```

Run once with `node tests/harness/fixtures/make-sine.mjs` to generate the file; commit the `.wav`.

### Step 12.3 — `playwright.config.ts`

```typescript
import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const audioFile = fileURLToPath(new URL('./tests/harness/fixtures/a4-sine.wav', import.meta.url));

export default defineConfig({
  testDir: './tests/harness',
  testMatch: '**/*.spec.ts',
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:5173',
    launchOptions: {
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        `--use-file-for-fake-audio-capture=${audioFile}`,
      ],
    },
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173/harness/audio.html',
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
```

### Step 12.4 — `tests/harness/audio-harness.smoke.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test('audio harness: pitch detector reports ~440 Hz on fake sine input', async ({ page }) => {
  await page.goto('/harness/audio.html');

  // Start pitch detection
  await page.click('#start-pitch');

  // Give the worklet time to load and a few frames to arrive
  await page.waitForFunction(
    () => {
      const el = document.getElementById('pitch-hz');
      if (!el) return false;
      const txt = el.textContent ?? '';
      const n = Number(txt);
      return Number.isFinite(n) && n > 400 && n < 480;
    },
    { timeout: 15_000 },
  );

  const hzText = await page.textContent('#pitch-hz');
  const hz = Number(hzText);
  expect(hz).toBeGreaterThan(430);
  expect(hz).toBeLessThan(450);
});
```

### Step 12.5 — `package.json` scripts

Add:

```json
"test:e2e": "playwright test"
```

### Step 12.6 — run

```bash
npm run test:e2e
```

Expected: 1 test passing. Takes ~20 seconds (dev server startup + first-run worklet compilation + a few frames of pitch detection).

If the test fails due to the worklet not loading, check the dev-server console for a `addModule` error — most likely a Vite asset-url resolution issue in the worklet path. Workaround: convert the `yin-worklet.ts` module to build-time-transformed asset via `?worker` or `?url` Vite imports.

- [ ] **Step 12.7**: If the test flakes (browser timing is inherently flaky), keep the timeout generous but do not weaken the assertions. The 440 Hz ± 10 Hz window is deliberately wide to account for windowing artifacts.
- [ ] **Step 12.8**: Commit.

```bash
git add playwright.config.ts tests/harness/audio-harness.smoke.spec.ts tests/harness/fixtures/ package.json package-lock.json
git commit -m "test(e2e): playwright smoke test for audio harness pitch detection"
```

---

## Plan Self-Review

**Spec coverage:**
- Audio generation (§8.1 Stack): sampler via Tone.js synths (Task 2), cadence + target structure (Tasks 3, 4), player (Task 7). ✓
- Pitch detection (§8.1): YIN AudioWorklet (Tasks 5, 8). ✓
- Hz → scale-degree mapping (§8.3 boundaries): Task 6. ✓
- Speech (KWS) with digit vocabulary (§5.1, §6.2): Task 10. ✓
- Mic permission (§10.1 edge cases): Task 9. ✓
- Dev harness for manual validation: Task 11. ✓
- Smoke test proving the stack loads: Task 12. ✓

Not implemented in this plan (deferred to Plan C):
- Service-worker caching of KWS model and samples. The tensorflow-models library fetches the model at first load; in Plan C the service worker precaches those URLs.
- Pitch trace visualization (the R1 scrolling graph). That is a Svelte component, Plan C.
- Integration with the Orchestrator's `recordAttempt`. That call-site lives in Plan C's session state machine.
- Reduced-motion handling (spec §7.2). UI-level concern.

**Placeholder scan:**
- Task 2's instrument configuration uses built-in Tone.js synths as "piano/epiano/guitar/pad" — this is a deliberate placeholder for real samples (called out in §Scope boundaries). No other placeholders.
- Task 5's confidence formula is a heuristic; if downstream tasks find it discriminates poorly, it can be tuned without touching callers.
- Task 10's vocabulary check throws if the model doesn't include our digit words. This is defensive and intentional — it surfaces an incompatibility loudly rather than silently failing.

**Type consistency:**
- `ChordEvent`, `NoteEvent`, `PitchFrame`, `DigitFrame`, `MicStreamHandle` — each exported from exactly one file, used consistently.
- `TimbreId` is a string literal union used by `getTimbre` and `PlayRoundInput.timbreId`. Consistent.
- `DigitLabel` is `'one'..'seven'` in `keyword-spotter`; consistent with Plan A's Nashville-numbers convention (labels are spoken digit words, not the numeric `1..7`). Plan C will translate between them when grading.

**Scope check:** Plan B is one coherent layer: audio in + audio out + mic permission + one harness + one smoke test. Each task produces a testable unit, and the harness binds them. No task is a half-implementation.

**Integration points into Plan C (forward reference):**
- `playRound(input)` returns a `Promise<void>` for `done` — Plan C's session state machine awaits this between cadence and capture.
- `startPitchDetector` and `startKeywordSpotter` both return subscribe-able handles — Plan C's UI components subscribe to render live pitch traces and digit chips.
- `mapHzToDegree` gives the scoring information Plan C hands to the orchestrator's `recordAttempt(pitchOk, labelOk)`.

---

## Execution Handoff

Plan complete and saved to `docs/plans/2026-04-14-plan-b-audio-io.md`. Two execution options:

**1. Subagent-Driven (recommended)** — same pattern as Plan A.

**2. Inline Execution** — batch with checkpoints.

Which approach?
