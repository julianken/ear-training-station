# Plan A · Foundation + Core Logic

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the pure-logic and persistence kernel of the ear-training app — Leitner SRS, item scheduler, IndexedDB repositories, and the session-level orchestrator that ties them together. No audio, no UI, no ML. Every module unit-tested; end-to-end simulated-session test proves the layer works.

**Architecture:** Pure TypeScript modules with tight boundaries. `types/` defines the domain. `srs/` holds Leitner math as pure functions. `scheduler/` composes SRS + interleaving + unlock gating. `store/` wraps IndexedDB via `idb`. `session/` orchestrates using scheduler + store. Everything testable with Vitest + `fake-indexeddb`.

**Tech Stack:** Vite, TypeScript (strict), Svelte 5 (scaffolded but unused in this plan), Vitest, fake-indexeddb, idb.

**Companion docs:**
- [MVP design spec](../specs/2026-04-14-ear-training-mvp-design.md)
- [Research synthesis](../research/2026-04-14-ear-training-research-synthesis.md)

---

## File Structure (created by this plan)

```
ear-training/
├── .gitignore
├── .npmrc
├── package.json
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts
├── index.html
├── src/
│   ├── app.ts                          # entry (placeholder in Plan A)
│   ├── types/
│   │   ├── music.ts                    # PitchClass, Key, Degree
│   │   └── domain.ts                   # Item, Attempt, Session, Settings
│   ├── srs/
│   │   ├── leitner.ts                  # box transitions, intervals
│   │   └── accuracy.ts                 # rolling recency-weighted accuracy
│   ├── scheduler/
│   │   ├── interleaving.ts             # interleaving constraints
│   │   ├── selection.ts                # pick next item
│   │   ├── curriculum.ts               # ordered unlock groups
│   │   └── unlock.ts                   # gating logic
│   ├── store/
│   │   ├── db.ts                       # IDB schema + open
│   │   ├── items-repo.ts
│   │   ├── attempts-repo.ts
│   │   ├── sessions-repo.ts
│   │   └── settings-repo.ts
│   ├── session/
│   │   └── orchestrator.ts             # coordinates scheduler + store
│   └── seed/
│       └── initial-items.ts            # factory for starter items
└── tests/
    ├── helpers/
    │   ├── test-db.ts                  # fake-indexeddb wiring
    │   └── fixtures.ts                 # common item/key builders
    ├── srs/
    │   ├── leitner.test.ts
    │   └── accuracy.test.ts
    ├── scheduler/
    │   ├── interleaving.test.ts
    │   ├── selection.test.ts
    │   └── unlock.test.ts
    ├── store/
    │   ├── items-repo.test.ts
    │   ├── attempts-repo.test.ts
    │   ├── sessions-repo.test.ts
    │   └── settings-repo.test.ts
    └── session/
        └── orchestrator.test.ts        # simulated session integration test
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `.gitignore`, `.npmrc`, `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `index.html`, `src/app.ts`

- [ ] **Step 1.1: Initialize git and npm**

Run these in the project root (`/Users/j/repos/ear-training`):

```bash
cd /Users/j/repos/ear-training
git init -b main
npm init -y
```

Expected: git repo initialized; `package.json` created with default values.

- [ ] **Step 1.2: Write `.gitignore`**

Create `.gitignore`:

```
node_modules/
dist/
.vite/
coverage/
*.log
.DS_Store
.env
.env.local
.superpowers/
```

- [ ] **Step 1.3: Write `.npmrc`**

Create `.npmrc` (ensures stricter installs):

```
save-exact=true
fund=false
```

- [ ] **Step 1.4: Install dev dependencies**

```bash
npm install --save-dev typescript@5.6.2 vite@5.4.10 @sveltejs/vite-plugin-svelte@4.0.0 svelte@5.1.9 svelte-check@4.0.5 vitest@2.1.4 @vitest/ui@2.1.4 jsdom@25.0.1 fake-indexeddb@6.0.0
```

Expected: deps installed; `package.json` updated.

- [ ] **Step 1.5: Install runtime dependencies**

```bash
npm install --save idb@8.0.0
```

- [ ] **Step 1.6: Write `tsconfig.json`**

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "resolveJsonModule": true,
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": ["vite/client", "svelte"],
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src/**/*", "tests/**/*", "vite.config.ts", "vitest.config.ts"]
}
```

- [ ] **Step 1.7: Write `vite.config.ts`**

Create `vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [svelte()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
  },
});
```

- [ ] **Step 1.8: Write `vitest.config.ts`**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/helpers/test-setup.ts'],
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
```

- [ ] **Step 1.9: Write minimal test setup**

Create `tests/helpers/test-setup.ts`:

```typescript
import 'fake-indexeddb/auto';
```

This wires `fake-indexeddb` as the global `indexedDB` for all test files. Keeps each repo test free of manual setup.

- [ ] **Step 1.10: Write placeholder entry point**

Create `index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Ear Training</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/app.ts"></script>
  </body>
</html>
```

Create `src/app.ts`:

```typescript
console.log('ear-training: foundation layer');
```

- [ ] **Step 1.11: Update `package.json` scripts**

Edit `package.json` to set `"type": "module"` and add scripts. The `scripts` block should look like:

```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:ui": "vitest --ui",
  "typecheck": "tsc --noEmit"
}
```

Also add `"type": "module"` at the top level if it isn't already there.

- [ ] **Step 1.12: Verify scaffold**

```bash
npm run typecheck
```

Expected: exits 0, no errors.

```bash
npm run test
```

Expected: "No test files found" but no error. Vitest runs cleanly.

- [ ] **Step 1.13: Commit**

```bash
git add .
git commit -m "chore: scaffold vite + svelte + typescript + vitest project"
```

---

## Task 2: Music Domain Types

**Files:**
- Create: `src/types/music.ts`
- Create: `tests/helpers/fixtures.ts`

- [ ] **Step 2.1: Write `src/types/music.ts`**

```typescript
// Pitch classes (12 notes in an octave), using sharps for simplicity.
// Accidentals (♭) are not part of MVP item set but PitchClass must support all 12.
export type PitchClass =
  | 'C' | 'C#' | 'D' | 'D#' | 'E' | 'F'
  | 'F#' | 'G' | 'G#' | 'A' | 'A#' | 'B';

export const PITCH_CLASSES: readonly PitchClass[] = [
  'C', 'C#', 'D', 'D#', 'E', 'F',
  'F#', 'G', 'G#', 'A', 'A#', 'B',
];

export type KeyQuality = 'major' | 'minor';

export interface Key {
  tonic: PitchClass;
  quality: KeyQuality;
}

// MVP scale degrees are diatonic 1..7. No accidentals yet.
export type Degree = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const DEGREES: readonly Degree[] = [1, 2, 3, 4, 5, 6, 7];

// Stable id for a key: "C-major", "A-minor".
export function keyId(key: Key): string {
  return `${key.tonic}-${key.quality}`;
}

// Stable id for an item (degree in a key): "5-C-major".
export function itemId(degree: Degree, key: Key): string {
  return `${degree}-${keyId(key)}`;
}

// Diatonic scale offsets from tonic, in semitones.
// Major: W W H W W W H → 0, 2, 4, 5, 7, 9, 11
// Natural minor: W H W W H W W → 0, 2, 3, 5, 7, 8, 10
const MAJOR_OFFSETS: Record<Degree, number> = {
  1: 0, 2: 2, 3: 4, 4: 5, 5: 7, 6: 9, 7: 11,
};
const MINOR_OFFSETS: Record<Degree, number> = {
  1: 0, 2: 2, 3: 3, 4: 5, 5: 7, 6: 8, 7: 10,
};

/** Returns semitone offset of `degree` from the tonic in the given key. */
export function semitoneOffset(degree: Degree, quality: KeyQuality): number {
  return (quality === 'major' ? MAJOR_OFFSETS : MINOR_OFFSETS)[degree];
}
```

- [ ] **Step 2.2: Write test fixtures**

Create `tests/helpers/fixtures.ts`:

```typescript
import type { Key } from '@/types/music';

export const C_MAJOR: Key = { tonic: 'C', quality: 'major' };
export const A_MINOR: Key = { tonic: 'A', quality: 'minor' };
export const G_MAJOR: Key = { tonic: 'G', quality: 'major' };
```

- [ ] **Step 2.3: Write failing test for `itemId` and `semitoneOffset`**

Create `tests/srs/leitner.test.ts` — wait, that's the next task's file. Instead, write a small smoke test for music types first.

Create `tests/types/music.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { itemId, keyId, semitoneOffset } from '@/types/music';
import { C_MAJOR, A_MINOR } from '../helpers/fixtures';

describe('music types', () => {
  it('keyId produces stable ids', () => {
    expect(keyId(C_MAJOR)).toBe('C-major');
    expect(keyId(A_MINOR)).toBe('A-minor');
  });

  it('itemId composes degree and key', () => {
    expect(itemId(5, C_MAJOR)).toBe('5-C-major');
    expect(itemId(3, A_MINOR)).toBe('3-A-minor');
  });

  it('semitoneOffset returns correct intervals for major', () => {
    expect(semitoneOffset(1, 'major')).toBe(0);
    expect(semitoneOffset(3, 'major')).toBe(4);
    expect(semitoneOffset(5, 'major')).toBe(7);
    expect(semitoneOffset(7, 'major')).toBe(11);
  });

  it('semitoneOffset returns correct intervals for natural minor', () => {
    expect(semitoneOffset(1, 'minor')).toBe(0);
    expect(semitoneOffset(3, 'minor')).toBe(3);
    expect(semitoneOffset(6, 'minor')).toBe(8);
    expect(semitoneOffset(7, 'minor')).toBe(10);
  });
});
```

- [ ] **Step 2.4: Run tests**

```bash
npm run test
```

Expected: all 4 tests pass.

- [ ] **Step 2.5: Commit**

```bash
git add src/types/music.ts tests/types/music.test.ts tests/helpers/fixtures.ts
git commit -m "feat(types): music domain (PitchClass, Key, Degree, helpers)"
```

---

## Task 3: Domain Types — Items, Attempts, Sessions, Settings

**Files:**
- Create: `src/types/domain.ts`

- [ ] **Step 3.1: Write `src/types/domain.ts`**

```typescript
import type { Degree, Key } from './music';

export type LeitnerBox = 'new' | 'learning' | 'reviewing' | 'mastered';

export type Register = 'narrow' | 'comfortable' | 'wide';

export interface Accuracy {
  /** Rolling recency-weighted accuracy in [0, 1]. */
  pitch: number;
  /** Same for digit label recognition. */
  label: number;
}

export interface Item {
  /** Stable id, e.g. "5-C-major" (see itemId). */
  id: string;
  degree: Degree;
  key: Key;
  box: LeitnerBox;
  accuracy: Accuracy;
  /** Rolling history of recent passes (for consecutive-pass math and accuracy). */
  recent: ReadonlyArray<AttemptOutcome>;
  attempts: number;
  consecutive_passes: number;
  last_seen_at: number | null;
  due_at: number;
  created_at: number;
}

export interface AttemptOutcome {
  /** Did pitch detection match the target (octave-invariant, ±50¢). */
  pitch: boolean;
  /** Did keyword-spotting match the target digit. */
  label: boolean;
  /** An item passes only when both are true. */
  pass: boolean;
  /** When this attempt was recorded. */
  at: number;
}

export interface Attempt {
  id: string;
  item_id: string;
  session_id: string;
  at: number;
  target: {
    hz: number;
    degree: Degree;
  };
  sung: {
    hz: number | null;
    cents_off: number | null;
    confidence: number;
  };
  spoken: {
    digit: number | null;
    confidence: number;
  };
  graded: AttemptOutcome;
  timbre: string;
  register: Register;
}

export interface Session {
  id: string;
  started_at: number;
  ended_at: number | null;
  target_items: number;
  completed_items: number;
  pitch_pass_count: number;
  label_pass_count: number;
  /** Item id highlighted on the summary as "tomorrow's focus". */
  focus_item_id: string | null;
}

export interface Settings {
  function_tooltip: boolean;
  auto_advance_on_hit: boolean;
  session_length: 20 | 30 | 45;
  reduced_motion: 'auto' | 'on' | 'off';
}

export const DEFAULT_SETTINGS: Readonly<Settings> = Object.freeze({
  function_tooltip: true,
  auto_advance_on_hit: true,
  session_length: 30,
  reduced_motion: 'auto',
});
```

- [ ] **Step 3.2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3.3: Commit**

```bash
git add src/types/domain.ts
git commit -m "feat(types): Item, Attempt, Session, Settings, LeitnerBox"
```

---

## Task 4: Leitner SRS Math (Pure)

**Files:**
- Create: `src/srs/leitner.ts`
- Create: `tests/srs/leitner.test.ts`

- [ ] **Step 4.1: Write failing test**

Create `tests/srs/leitner.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  nextBoxOnPass,
  nextBoxOnMiss,
  intervalForBox,
  dueAtAfter,
  PROMOTE_AFTER_CONSECUTIVE_PASSES,
} from '@/srs/leitner';

describe('leitner box transitions', () => {
  describe('on pass', () => {
    it('stays in box until consecutive_passes threshold', () => {
      expect(nextBoxOnPass('learning', 1)).toBe('learning');
      expect(nextBoxOnPass('learning', 2)).toBe('learning');
    });

    it('promotes new → learning on first pass', () => {
      expect(nextBoxOnPass('new', 1)).toBe('learning');
    });

    it('promotes learning → reviewing after threshold', () => {
      expect(nextBoxOnPass('learning', PROMOTE_AFTER_CONSECUTIVE_PASSES)).toBe('reviewing');
    });

    it('promotes reviewing → mastered after threshold', () => {
      expect(nextBoxOnPass('reviewing', PROMOTE_AFTER_CONSECUTIVE_PASSES)).toBe('mastered');
    });

    it('stays at mastered once mastered', () => {
      expect(nextBoxOnPass('mastered', 10)).toBe('mastered');
    });
  });

  describe('on miss', () => {
    it('demotes by one box', () => {
      expect(nextBoxOnMiss('mastered')).toBe('reviewing');
      expect(nextBoxOnMiss('reviewing')).toBe('learning');
      expect(nextBoxOnMiss('learning')).toBe('learning');
      expect(nextBoxOnMiss('new')).toBe('new');
    });
  });
});

describe('leitner intervals', () => {
  const HOUR = 60 * 60 * 1000;
  const DAY = 24 * HOUR;

  it('new items are due immediately', () => {
    expect(intervalForBox('new', 0)).toBe(0);
  });

  it('learning items are due next session (tomorrow floor)', () => {
    // Approximation: 1 day; see dueAtAfter for exact semantics.
    expect(intervalForBox('learning', 0)).toBe(DAY);
  });

  it('reviewing items escalate 2d → 5d → 10d', () => {
    expect(intervalForBox('reviewing', 0)).toBe(2 * DAY);
    expect(intervalForBox('reviewing', 1)).toBe(5 * DAY);
    expect(intervalForBox('reviewing', 2)).toBe(10 * DAY);
    // repeats at 10d once top reached
    expect(intervalForBox('reviewing', 99)).toBe(10 * DAY);
  });

  it('mastered items review every 21d', () => {
    expect(intervalForBox('mastered', 0)).toBe(21 * DAY);
  });
});

describe('dueAtAfter', () => {
  it('returns now + interval for the box', () => {
    const now = 1_700_000_000_000;
    const result = dueAtAfter('reviewing', 0, now);
    expect(result).toBe(now + 2 * 24 * 60 * 60 * 1000);
  });
});
```

- [ ] **Step 4.2: Run — expect failure**

```bash
npm run test -- leitner
```

Expected: FAIL — `Cannot find module '@/srs/leitner'`.

- [ ] **Step 4.3: Implement `src/srs/leitner.ts`**

```typescript
import type { LeitnerBox } from '@/types/domain';

export const PROMOTE_AFTER_CONSECUTIVE_PASSES = 3;

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const REVIEWING_INTERVALS = [2 * DAY, 5 * DAY, 10 * DAY] as const;

/**
 * Compute the next Leitner box after a successful attempt.
 *
 * @param current - the box the item is currently in
 * @param consecutivePassesAfterThis - consecutive passes including this one
 */
export function nextBoxOnPass(
  current: LeitnerBox,
  consecutivePassesAfterThis: number,
): LeitnerBox {
  if (current === 'new') return 'learning';
  if (current === 'mastered') return 'mastered';
  if (consecutivePassesAfterThis < PROMOTE_AFTER_CONSECUTIVE_PASSES) return current;
  if (current === 'learning') return 'reviewing';
  if (current === 'reviewing') return 'mastered';
  return current;
}

/** Compute the next box after a failed attempt. Demotes by one box, never below `learning`. */
export function nextBoxOnMiss(current: LeitnerBox): LeitnerBox {
  switch (current) {
    case 'new': return 'new';
    case 'learning': return 'learning';
    case 'reviewing': return 'learning';
    case 'mastered': return 'reviewing';
  }
}

/**
 * Interval until the next review, in ms.
 *
 * @param box - the new box after the transition
 * @param reviewsInBox - how many times this item has been reviewed in this box
 *                      (used for the `reviewing` escalation schedule)
 */
export function intervalForBox(box: LeitnerBox, reviewsInBox: number): number {
  switch (box) {
    case 'new': return 0;
    case 'learning': return DAY;
    case 'reviewing': {
      const idx = Math.min(reviewsInBox, REVIEWING_INTERVALS.length - 1);
      return REVIEWING_INTERVALS[idx]!;
    }
    case 'mastered': return 21 * DAY;
  }
}

/** Compute due_at for a given box, anchored at `now`. */
export function dueAtAfter(box: LeitnerBox, reviewsInBox: number, now: number): number {
  return now + intervalForBox(box, reviewsInBox);
}
```

- [ ] **Step 4.4: Run tests — expect pass**

```bash
npm run test -- leitner
```

Expected: all Leitner tests pass.

- [ ] **Step 4.5: Commit**

```bash
git add src/srs/leitner.ts tests/srs/leitner.test.ts
git commit -m "feat(srs): Leitner box transitions and review intervals"
```

---

## Task 5: Accuracy Rolling Window

**Files:**
- Create: `src/srs/accuracy.ts`
- Create: `tests/srs/accuracy.test.ts`

- [ ] **Step 5.1: Write failing test**

Create `tests/srs/accuracy.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { weightedAccuracy, pushOutcome, ACCURACY_WINDOW } from '@/srs/accuracy';
import type { AttemptOutcome } from '@/types/domain';

function pass(at = 0): AttemptOutcome {
  return { pitch: true, label: true, pass: true, at };
}
function missPitch(at = 0): AttemptOutcome {
  return { pitch: false, label: true, pass: false, at };
}

describe('weightedAccuracy', () => {
  it('is 0 when no history', () => {
    const acc = weightedAccuracy([], 'pitch');
    expect(acc).toBe(0);
  });

  it('is 1.0 with all pass on pitch', () => {
    const history = [pass(1), pass(2), pass(3)];
    expect(weightedAccuracy(history, 'pitch')).toBe(1);
  });

  it('is 0.0 with all misses on pitch', () => {
    const history = [missPitch(1), missPitch(2), missPitch(3)];
    expect(weightedAccuracy(history, 'pitch')).toBe(0);
  });

  it('weights recent attempts more heavily', () => {
    // Older pass, newer miss — accuracy should be well below 0.5
    const history = [pass(1), missPitch(100)];
    const acc = weightedAccuracy(history, 'pitch');
    expect(acc).toBeLessThan(0.5);
  });

  it('weights recent pass higher than older miss', () => {
    const history = [missPitch(1), pass(100)];
    const acc = weightedAccuracy(history, 'pitch');
    expect(acc).toBeGreaterThan(0.5);
  });
});

describe('pushOutcome', () => {
  it('appends and caps at ACCURACY_WINDOW', () => {
    const big = Array.from({ length: ACCURACY_WINDOW + 5 }, (_, i) => pass(i));
    let hist: ReadonlyArray<AttemptOutcome> = [];
    for (const o of big) {
      hist = pushOutcome(hist, o);
    }
    expect(hist.length).toBe(ACCURACY_WINDOW);
    // oldest should be the (5th) one, since first 5 dropped
    expect(hist[0]!.at).toBe(5);
    expect(hist[hist.length - 1]!.at).toBe(big.length - 1);
  });

  it('returns a new array (immutable)', () => {
    const hist: ReadonlyArray<AttemptOutcome> = [pass(1)];
    const next = pushOutcome(hist, pass(2));
    expect(next).not.toBe(hist);
    expect(hist.length).toBe(1);
    expect(next.length).toBe(2);
  });
});
```

- [ ] **Step 5.2: Run — expect failure**

```bash
npm run test -- accuracy
```

Expected: FAIL — module not found.

- [ ] **Step 5.3: Implement `src/srs/accuracy.ts`**

```typescript
import type { AttemptOutcome } from '@/types/domain';

export const ACCURACY_WINDOW = 10;

export type AccuracyAxis = 'pitch' | 'label';

/**
 * Compute recency-weighted accuracy over the history.
 * Weights follow a linear ramp: newest attempt weighted `history.length`,
 * oldest weighted 1. Empty history returns 0.
 */
export function weightedAccuracy(
  history: ReadonlyArray<AttemptOutcome>,
  axis: AccuracyAxis,
): number {
  if (history.length === 0) return 0;
  let num = 0;
  let den = 0;
  for (let i = 0; i < history.length; i++) {
    const outcome = history[i]!;
    const weight = i + 1; // oldest=1, newest=history.length
    const correct = outcome[axis] ? 1 : 0;
    num += correct * weight;
    den += weight;
  }
  return num / den;
}

/**
 * Append an outcome to the rolling window, capped at ACCURACY_WINDOW.
 * Returns a new array — does not mutate.
 */
export function pushOutcome(
  history: ReadonlyArray<AttemptOutcome>,
  outcome: AttemptOutcome,
): ReadonlyArray<AttemptOutcome> {
  const next = [...history, outcome];
  if (next.length <= ACCURACY_WINDOW) return next;
  return next.slice(next.length - ACCURACY_WINDOW);
}
```

- [ ] **Step 5.4: Run tests — expect pass**

```bash
npm run test -- accuracy
```

Expected: all tests pass.

- [ ] **Step 5.5: Commit**

```bash
git add src/srs/accuracy.ts tests/srs/accuracy.test.ts
git commit -m "feat(srs): recency-weighted rolling accuracy"
```

---

## Task 6: Interleaving Constraints

**Files:**
- Create: `src/scheduler/interleaving.ts`
- Create: `tests/scheduler/interleaving.test.ts`

- [ ] **Step 6.1: Write failing test**

Create `tests/scheduler/interleaving.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { isBlocked, type RoundHistoryEntry } from '@/scheduler/interleaving';
import type { Item } from '@/types/domain';
import { C_MAJOR, G_MAJOR } from '../helpers/fixtures';

const item = (degree: 1|2|3|4|5|6|7, key = C_MAJOR): Item => ({
  id: `${degree}-${key.tonic}-${key.quality}`,
  degree,
  key,
  box: 'learning',
  accuracy: { pitch: 0.7, label: 0.9 },
  recent: [],
  attempts: 3,
  consecutive_passes: 1,
  last_seen_at: 0,
  due_at: 0,
  created_at: 0,
});

const seen = (i: Item): RoundHistoryEntry => ({
  itemId: i.id,
  degree: i.degree,
  key: i.key,
});

describe('interleaving', () => {
  it('blocks same-degree-back-to-back', () => {
    const history = [seen(item(5))];
    expect(isBlocked(item(5), history)).toBe(true);
  });

  it('allows different degree after same-degree', () => {
    const history = [seen(item(5))];
    expect(isBlocked(item(6), history)).toBe(false);
  });

  it('blocks a 4th consecutive round in the same key', () => {
    const history = [
      seen(item(1, C_MAJOR)),
      seen(item(3, C_MAJOR)),
      seen(item(5, C_MAJOR)),
    ];
    expect(isBlocked(item(2, C_MAJOR), history)).toBe(true);
  });

  it('allows C major item when last 3 rounds include a different key', () => {
    const history = [
      seen(item(1, C_MAJOR)),
      seen(item(3, G_MAJOR)),
      seen(item(5, C_MAJOR)),
    ];
    expect(isBlocked(item(2, C_MAJOR), history)).toBe(false);
  });

  it('allows G major item regardless of prior C major streak', () => {
    const history = [
      seen(item(1, C_MAJOR)),
      seen(item(3, C_MAJOR)),
      seen(item(5, C_MAJOR)),
    ];
    expect(isBlocked(item(2, G_MAJOR), history)).toBe(false);
  });

  it('empty history blocks nothing', () => {
    expect(isBlocked(item(5), [])).toBe(false);
  });
});
```

- [ ] **Step 6.2: Run — expect failure**

```bash
npm run test -- interleaving
```

- [ ] **Step 6.3: Implement `src/scheduler/interleaving.ts`**

```typescript
import type { Item } from '@/types/domain';
import { keyId } from '@/types/music';
import type { Degree, Key } from '@/types/music';

export interface RoundHistoryEntry {
  itemId: string;
  degree: Degree;
  key: Key;
}

const SAME_KEY_MAX_CONSECUTIVE = 3;

/**
 * Is this item blocked from being the next-up by interleaving constraints?
 * Rules (spec §5.2):
 *   - No same scale degree back-to-back.
 *   - No same key for more than 3 consecutive rounds.
 */
export function isBlocked(
  candidate: Item,
  history: ReadonlyArray<RoundHistoryEntry>,
): boolean {
  if (history.length === 0) return false;

  const last = history[history.length - 1]!;

  // Same degree back-to-back (any key).
  if (last.degree === candidate.degree) return true;

  // Same key, >3 consecutive: look at the tail.
  const candidateKeyId = keyId(candidate.key);
  let consecutiveSameKey = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if (keyId(history[i]!.key) === candidateKeyId) consecutiveSameKey++;
    else break;
  }
  if (consecutiveSameKey >= SAME_KEY_MAX_CONSECUTIVE) return true;

  return false;
}
```

- [ ] **Step 6.4: Run tests — expect pass**

```bash
npm run test -- interleaving
```

- [ ] **Step 6.5: Commit**

```bash
git add src/scheduler/interleaving.ts tests/scheduler/interleaving.test.ts
git commit -m "feat(scheduler): interleaving constraints"
```

---

## Task 7: Curriculum Definition & Unlock Gating

**Files:**
- Create: `src/scheduler/curriculum.ts`
- Create: `src/scheduler/unlock.ts`
- Create: `tests/scheduler/unlock.test.ts`

- [ ] **Step 7.1: Write `src/scheduler/curriculum.ts`**

```typescript
import type { Degree, Key } from '@/types/music';

/**
 * An ordered curriculum group. A group is a coherent slice of content
 * that unlocks together when its prerequisite is sufficiently mastered.
 */
export interface CurriculumGroup {
  id: string;
  label: string;
  /** Items in this group. */
  members: ReadonlyArray<{ degree: Degree; key: Key }>;
  /** Other group id whose mastery >= UNLOCK_THRESHOLD triggers this one. */
  prerequisite: string | null;
}

/**
 * Fraction of a group's items that must be in reviewing/mastered
 * before the next group unlocks. Spec §6.5.
 */
export const UNLOCK_THRESHOLD = 0.7;

/** The MVP curriculum, ordered. */
export const MVP_CURRICULUM: ReadonlyArray<CurriculumGroup> = [
  {
    id: 'c-major-tonic-triad',
    label: 'C major · degrees 1, 3, 5',
    members: [
      { degree: 1, key: { tonic: 'C', quality: 'major' } },
      { degree: 3, key: { tonic: 'C', quality: 'major' } },
      { degree: 5, key: { tonic: 'C', quality: 'major' } },
    ],
    prerequisite: null,
  },
  {
    id: 'c-major-diatonic-full',
    label: 'C major · degrees 2, 4, 6, 7',
    members: [
      { degree: 2, key: { tonic: 'C', quality: 'major' } },
      { degree: 4, key: { tonic: 'C', quality: 'major' } },
      { degree: 6, key: { tonic: 'C', quality: 'major' } },
      { degree: 7, key: { tonic: 'C', quality: 'major' } },
    ],
    prerequisite: 'c-major-tonic-triad',
  },
  {
    id: 'g-major-full',
    label: 'G major · all degrees',
    members: [1, 2, 3, 4, 5, 6, 7].map((d) => ({
      degree: d as Degree,
      key: { tonic: 'G' as const, quality: 'major' as const },
    })),
    prerequisite: 'c-major-diatonic-full',
  },
  {
    id: 'f-major-full',
    label: 'F major · all degrees',
    members: [1, 2, 3, 4, 5, 6, 7].map((d) => ({
      degree: d as Degree,
      key: { tonic: 'F' as const, quality: 'major' as const },
    })),
    prerequisite: 'g-major-full',
  },
  {
    id: 'd-major-full',
    label: 'D major · all degrees',
    members: [1, 2, 3, 4, 5, 6, 7].map((d) => ({
      degree: d as Degree,
      key: { tonic: 'D' as const, quality: 'major' as const },
    })),
    prerequisite: 'f-major-full',
  },
];

/** Lookup: group that owns a given (degree, key). */
export function groupFor(degree: Degree, key: Key): CurriculumGroup | null {
  for (const g of MVP_CURRICULUM) {
    for (const m of g.members) {
      if (m.degree === degree && m.key.tonic === key.tonic && m.key.quality === key.quality) {
        return g;
      }
    }
  }
  return null;
}
```

- [ ] **Step 7.2: Write failing test for unlock**

Create `tests/scheduler/unlock.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { computeUnlockedGroupIds } from '@/scheduler/unlock';
import { MVP_CURRICULUM } from '@/scheduler/curriculum';
import type { Item } from '@/types/domain';
import { itemId } from '@/types/music';

function item(
  degree: 1|2|3|4|5|6|7,
  key: { tonic: 'C'|'G'|'F'|'D'; quality: 'major' },
  box: Item['box'],
): Item {
  return {
    id: itemId(degree, key),
    degree,
    key,
    box,
    accuracy: { pitch: 0.7, label: 0.9 },
    recent: [],
    attempts: 1,
    consecutive_passes: 0,
    last_seen_at: 0,
    due_at: 0,
    created_at: 0,
  };
}

describe('computeUnlockedGroupIds', () => {
  const C = { tonic: 'C' as const, quality: 'major' as const };
  const G = { tonic: 'G' as const, quality: 'major' as const };

  it('first group is always unlocked (no prerequisite)', () => {
    const unlocked = computeUnlockedGroupIds([], MVP_CURRICULUM);
    expect(unlocked).toContain('c-major-tonic-triad');
  });

  it('does not unlock next group when prereq < 70%', () => {
    // Tonic triad = 3 items. Only 1 in 'reviewing' (33%).
    const items = [
      item(1, C, 'reviewing'),
      item(3, C, 'learning'),
      item(5, C, 'learning'),
    ];
    const unlocked = computeUnlockedGroupIds(items, MVP_CURRICULUM);
    expect(unlocked).not.toContain('c-major-diatonic-full');
  });

  it('unlocks next group when prereq >= 70%', () => {
    // 3 of 3 (100%) in reviewing.
    const items = [
      item(1, C, 'reviewing'),
      item(3, C, 'reviewing'),
      item(5, C, 'mastered'),
    ];
    const unlocked = computeUnlockedGroupIds(items, MVP_CURRICULUM);
    expect(unlocked).toContain('c-major-diatonic-full');
  });

  it('cascades through the chain', () => {
    const all7inC = [1,2,3,4,5,6,7].map((d) =>
      item(d as 1|2|3|4|5|6|7, C, 'mastered'));
    const unlocked = computeUnlockedGroupIds(all7inC, MVP_CURRICULUM);
    expect(unlocked).toContain('c-major-tonic-triad');
    expect(unlocked).toContain('c-major-diatonic-full');
    expect(unlocked).toContain('g-major-full');
  });

  it('stops cascading when a later group is below threshold', () => {
    const all7inC = [1,2,3,4,5,6,7].map((d) =>
      item(d as 1|2|3|4|5|6|7, C, 'mastered'));
    const onlyOneInG = [item(1, G, 'reviewing')]; // 1 of 7 = 14%
    const unlocked = computeUnlockedGroupIds(
      [...all7inC, ...onlyOneInG],
      MVP_CURRICULUM,
    );
    expect(unlocked).toContain('g-major-full');
    expect(unlocked).not.toContain('f-major-full');
  });

  it('treats missing items (never introduced) as box=new for ratio purposes', () => {
    // Only one item ever recorded in tonic triad; the other two not yet in DB.
    // ratio = 0/3 -> locked.
    const items = [item(1, C, 'reviewing')];
    const unlocked = computeUnlockedGroupIds(items, MVP_CURRICULUM);
    expect(unlocked).not.toContain('c-major-diatonic-full');
  });
});
```

- [ ] **Step 7.3: Run — expect failure**

```bash
npm run test -- unlock
```

- [ ] **Step 7.4: Implement `src/scheduler/unlock.ts`**

```typescript
import type { Item, LeitnerBox } from '@/types/domain';
import { itemId } from '@/types/music';
import {
  MVP_CURRICULUM,
  UNLOCK_THRESHOLD,
  type CurriculumGroup,
} from './curriculum';

const ADVANCED_BOXES: ReadonlyArray<LeitnerBox> = ['reviewing', 'mastered'];

/**
 * Compute the set of group ids currently unlocked based on item mastery.
 * A group unlocks if either:
 *   - it has no prerequisite, OR
 *   - its prerequisite group has >= UNLOCK_THRESHOLD ratio of members
 *     in box "reviewing" or "mastered".
 *
 * Groups not yet in the DB count as box="new" (0 toward the ratio).
 */
export function computeUnlockedGroupIds(
  items: ReadonlyArray<Item>,
  curriculum: ReadonlyArray<CurriculumGroup> = MVP_CURRICULUM,
): ReadonlySet<string> {
  const byId = new Map<string, Item>();
  for (const it of items) byId.set(it.id, it);

  const masteryRatio = (group: CurriculumGroup): number => {
    if (group.members.length === 0) return 0;
    let advanced = 0;
    for (const m of group.members) {
      const it = byId.get(itemId(m.degree, m.key));
      if (it && ADVANCED_BOXES.includes(it.box)) advanced++;
    }
    return advanced / group.members.length;
  };

  const unlocked = new Set<string>();
  for (const group of curriculum) {
    if (group.prerequisite === null) {
      unlocked.add(group.id);
      continue;
    }
    if (!unlocked.has(group.prerequisite)) continue;
    const prereq = curriculum.find((g) => g.id === group.prerequisite);
    if (!prereq) continue;
    if (masteryRatio(prereq) >= UNLOCK_THRESHOLD) {
      unlocked.add(group.id);
    }
  }
  return unlocked;
}

/** The set of (degree, key) pairs currently available to the learner. */
export function unlockedMembers(
  items: ReadonlyArray<Item>,
  curriculum: ReadonlyArray<CurriculumGroup> = MVP_CURRICULUM,
): ReadonlyArray<CurriculumGroup['members'][number]> {
  const unlocked = computeUnlockedGroupIds(items, curriculum);
  const out: CurriculumGroup['members'][number][] = [];
  for (const g of curriculum) {
    if (unlocked.has(g.id)) out.push(...g.members);
  }
  return out;
}
```

- [ ] **Step 7.5: Run tests — expect pass**

```bash
npm run test -- unlock
```

- [ ] **Step 7.6: Commit**

```bash
git add src/scheduler/curriculum.ts src/scheduler/unlock.ts tests/scheduler/unlock.test.ts
git commit -m "feat(scheduler): curriculum groups and unlock gating"
```

---

## Task 8: Item Selection (Weighted)

**Files:**
- Create: `src/scheduler/selection.ts`
- Create: `tests/scheduler/selection.test.ts`

- [ ] **Step 8.1: Write failing test**

Create `tests/scheduler/selection.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { selectNextItem } from '@/scheduler/selection';
import type { Item } from '@/types/domain';
import { C_MAJOR } from '../helpers/fixtures';
import { itemId } from '@/types/music';

function mkItem(degree: 1|2|3|4|5|6|7, overrides: Partial<Item> = {}): Item {
  return {
    id: itemId(degree, C_MAJOR),
    degree,
    key: C_MAJOR,
    box: 'learning',
    accuracy: { pitch: 0.5, label: 0.8 },
    recent: [],
    attempts: 3,
    consecutive_passes: 0,
    last_seen_at: 0,
    due_at: 0,
    created_at: 0,
    ...overrides,
  };
}

describe('selectNextItem', () => {
  it('returns null when all items are blocked by interleaving', () => {
    const items = [mkItem(5)];
    const history = [{ itemId: items[0]!.id, degree: 5 as const, key: C_MAJOR }];
    // Only one item; same-degree back-to-back → blocked.
    const result = selectNextItem(items, history, 1, () => 0.5);
    expect(result).toBe(null);
  });

  it('returns the sole non-blocked item', () => {
    const items = [mkItem(5), mkItem(3)];
    const history = [{ itemId: items[0]!.id, degree: 5 as const, key: C_MAJOR }];
    const result = selectNextItem(items, history, Date.now(), () => 0);
    expect(result).toBe(items[1]); // degree 3
  });

  it('prefers due weak items over strong ones', () => {
    const now = 1_000_000_000_000;
    const weak = mkItem(3, {
      accuracy: { pitch: 0.2, label: 0.3 },
      box: 'learning',
      due_at: now - 1000,
    });
    const strong = mkItem(5, {
      accuracy: { pitch: 0.95, label: 0.98 },
      box: 'mastered',
      due_at: now + 1_000_000,
    });
    // Run many trials; weak should dominate.
    let weakCount = 0;
    for (let i = 0; i < 1000; i++) {
      const pick = selectNextItem([weak, strong], [], now, Math.random);
      if (pick === weak) weakCount++;
    }
    expect(weakCount).toBeGreaterThan(600);
  });

  it('still occasionally serves mastered items (keeps them warm)', () => {
    const now = 1_000_000_000_000;
    const weak = mkItem(3, { box: 'learning', due_at: now - 1000 });
    const strong = mkItem(5, {
      box: 'mastered',
      due_at: now + 1_000_000,
    });
    let strongCount = 0;
    for (let i = 0; i < 1000; i++) {
      const pick = selectNextItem([weak, strong], [], now, Math.random);
      if (pick === strong) strongCount++;
    }
    // ~30% mastered warmup expectation from spec; allow wide band.
    expect(strongCount).toBeGreaterThan(150);
    expect(strongCount).toBeLessThan(450);
  });

  it('is deterministic given a seeded rng', () => {
    const items = [mkItem(3), mkItem(5), mkItem(6)];
    const seed = () => 0.42;
    const a = selectNextItem(items, [], 0, seed);
    const b = selectNextItem(items, [], 0, seed);
    expect(a).toBe(b);
  });
});
```

- [ ] **Step 8.2: Run — expect failure**

```bash
npm run test -- selection
```

- [ ] **Step 8.3: Implement `src/scheduler/selection.ts`**

```typescript
import type { Item } from '@/types/domain';
import { isBlocked, type RoundHistoryEntry } from './interleaving';

/** Fraction of picks that come from the "keep warm" mastered pool. */
const WARMUP_SHARE = 0.3;

/** Minimum sampling weight for any eligible item, so picks are not deterministic. */
const MIN_WEIGHT = 0.05;

/**
 * Pick the next item to present, or null if nothing is eligible.
 *
 * Behavior:
 *   - Filter by interleaving constraints.
 *   - With probability WARMUP_SHARE, sample from the mastered pool
 *     (uniform over mastered items); if that pool is empty, fall through.
 *   - Otherwise sample from the weak/due pool, weighted by
 *     (1 - accuracy.pitch) + due-weight.
 *
 * @param rng - number in [0, 1); defaults to Math.random.
 *              Inject a seed for deterministic tests.
 */
export function selectNextItem(
  items: ReadonlyArray<Item>,
  history: ReadonlyArray<RoundHistoryEntry>,
  now: number,
  rng: () => number = Math.random,
): Item | null {
  const eligible = items.filter((it) => !isBlocked(it, history));
  if (eligible.length === 0) return null;

  const mastered = eligible.filter((it) => it.box === 'mastered');
  const working = eligible.filter((it) => it.box !== 'mastered');

  if (mastered.length > 0 && rng() < WARMUP_SHARE) {
    return uniformPick(mastered, rng);
  }

  const pool = working.length > 0 ? working : mastered; // fallback
  return weightedPick(pool, now, rng);
}

function uniformPick<T>(arr: ReadonlyArray<T>, rng: () => number): T | null {
  if (arr.length === 0) return null;
  const idx = Math.floor(rng() * arr.length);
  return arr[Math.min(idx, arr.length - 1)]!;
}

function weightForItem(item: Item, now: number): number {
  const weakness = 1 - item.accuracy.pitch; // 0..1, bigger = weaker
  const dueBonus = item.due_at <= now ? 0.5 : 0;
  const boxBonus = item.box === 'new' ? 0.7
    : item.box === 'learning' ? 0.3
    : item.box === 'reviewing' ? 0.1
    : 0;
  return Math.max(MIN_WEIGHT, weakness + dueBonus + boxBonus);
}

function weightedPick(
  arr: ReadonlyArray<Item>,
  now: number,
  rng: () => number,
): Item | null {
  if (arr.length === 0) return null;
  let total = 0;
  const weights: number[] = [];
  for (const it of arr) {
    const w = weightForItem(it, now);
    weights.push(w);
    total += w;
  }
  const target = rng() * total;
  let acc = 0;
  for (let i = 0; i < arr.length; i++) {
    acc += weights[i]!;
    if (acc >= target) return arr[i]!;
  }
  return arr[arr.length - 1]!;
}
```

- [ ] **Step 8.4: Run tests — expect pass**

```bash
npm run test -- selection
```

- [ ] **Step 8.5: Commit**

```bash
git add src/scheduler/selection.ts tests/scheduler/selection.test.ts
git commit -m "feat(scheduler): weighted item selection with warmup"
```

---

## Task 9: IndexedDB Schema & Open

**Files:**
- Create: `src/store/db.ts`
- Create: `tests/helpers/test-db.ts`

- [ ] **Step 9.1: Write `src/store/db.ts`**

```typescript
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Item, Attempt, Session, Settings } from '@/types/domain';

export const DB_NAME = 'ear-training';
export const DB_VERSION = 1;

export interface EarTrainingDB extends DBSchema {
  items: {
    key: string; // item.id
    value: Item;
    indexes: {
      'by-box': string;
      'by-due': number;
    };
  };
  attempts: {
    key: string;
    value: Attempt;
    indexes: {
      'by-session': string;
      'by-item': string;
      'by-at': number;
    };
  };
  sessions: {
    key: string;
    value: Session;
    indexes: {
      'by-started-at': number;
    };
  };
  settings: {
    key: 'singleton';
    value: Settings;
  };
}

export type DB = IDBPDatabase<EarTrainingDB>;

export async function openEarTrainingDB(dbName: string = DB_NAME): Promise<DB> {
  return openDB<EarTrainingDB>(dbName, DB_VERSION, {
    upgrade(db) {
      const items = db.createObjectStore('items', { keyPath: 'id' });
      items.createIndex('by-box', 'box');
      items.createIndex('by-due', 'due_at');

      const attempts = db.createObjectStore('attempts', { keyPath: 'id' });
      attempts.createIndex('by-session', 'session_id');
      attempts.createIndex('by-item', 'item_id');
      attempts.createIndex('by-at', 'at');

      const sessions = db.createObjectStore('sessions', { keyPath: 'id' });
      sessions.createIndex('by-started-at', 'started_at');

      db.createObjectStore('settings');
    },
  });
}
```

- [ ] **Step 9.2: Write test-db helper**

Create `tests/helpers/test-db.ts`:

```typescript
import { openEarTrainingDB, type DB } from '@/store/db';

/**
 * Open a fresh isolated DB for a test. Each call uses a unique name
 * so tests do not share state.
 */
let seq = 0;
export async function openTestDB(): Promise<DB> {
  seq++;
  return openEarTrainingDB(`ear-training-test-${seq}-${Math.random()}`);
}
```

- [ ] **Step 9.3: Write smoke test for db open**

Create `tests/store/db.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { openTestDB } from '../helpers/test-db';

describe('db open', () => {
  it('creates all object stores', async () => {
    const db = await openTestDB();
    expect(db.objectStoreNames).toContain('items');
    expect(db.objectStoreNames).toContain('attempts');
    expect(db.objectStoreNames).toContain('sessions');
    expect(db.objectStoreNames).toContain('settings');
    db.close();
  });

  it('creates expected indexes on items', async () => {
    const db = await openTestDB();
    const tx = db.transaction('items', 'readonly');
    const store = tx.objectStore('items');
    expect(store.indexNames).toContain('by-box');
    expect(store.indexNames).toContain('by-due');
    await tx.done;
    db.close();
  });
});
```

- [ ] **Step 9.4: Run tests — expect pass**

```bash
npm run test -- db
```

- [ ] **Step 9.5: Commit**

```bash
git add src/store/db.ts tests/helpers/test-db.ts tests/store/db.test.ts
git commit -m "feat(store): IndexedDB schema and open helper"
```

---

## Task 10: Items Repository

**Files:**
- Create: `src/store/items-repo.ts`
- Create: `tests/store/items-repo.test.ts`

- [ ] **Step 10.1: Write failing test**

Create `tests/store/items-repo.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { createItemsRepo } from '@/store/items-repo';
import { openTestDB } from '../helpers/test-db';
import type { Item } from '@/types/domain';
import { C_MAJOR } from '../helpers/fixtures';
import { itemId } from '@/types/music';

function mkItem(overrides: Partial<Item> = {}): Item {
  return {
    id: itemId(5, C_MAJOR),
    degree: 5,
    key: C_MAJOR,
    box: 'new',
    accuracy: { pitch: 0, label: 0 },
    recent: [],
    attempts: 0,
    consecutive_passes: 0,
    last_seen_at: null,
    due_at: 0,
    created_at: 1_700_000_000_000,
    ...overrides,
  };
}

describe('items-repo', () => {
  it('put + get round-trips an item', async () => {
    const db = await openTestDB();
    const repo = createItemsRepo(db);
    const it = mkItem();
    await repo.put(it);
    const fetched = await repo.get(it.id);
    expect(fetched).toEqual(it);
  });

  it('listAll returns all items', async () => {
    const db = await openTestDB();
    const repo = createItemsRepo(db);
    await repo.put(mkItem({ id: 'a', degree: 1 }));
    await repo.put(mkItem({ id: 'b', degree: 2 }));
    const all = await repo.listAll();
    expect(all.length).toBe(2);
    expect(all.map((i) => i.id).sort()).toEqual(['a', 'b']);
  });

  it('findDue returns only items with due_at <= now', async () => {
    const db = await openTestDB();
    const repo = createItemsRepo(db);
    const now = 1_700_000_000_000;
    await repo.put(mkItem({ id: 'past', due_at: now - 1000 }));
    await repo.put(mkItem({ id: 'future', due_at: now + 1000 }));
    const due = await repo.findDue(now);
    expect(due.map((i) => i.id)).toEqual(['past']);
  });

  it('putMany inserts atomically', async () => {
    const db = await openTestDB();
    const repo = createItemsRepo(db);
    const items = [mkItem({ id: 'a' }), mkItem({ id: 'b' }), mkItem({ id: 'c' })];
    await repo.putMany(items);
    const all = await repo.listAll();
    expect(all.length).toBe(3);
  });
});
```

- [ ] **Step 10.2: Run — expect failure**

```bash
npm run test -- items-repo
```

- [ ] **Step 10.3: Implement `src/store/items-repo.ts`**

```typescript
import type { DB } from './db';
import type { Item } from '@/types/domain';

export interface ItemsRepo {
  get(id: string): Promise<Item | undefined>;
  listAll(): Promise<Item[]>;
  findDue(now: number): Promise<Item[]>;
  findByBox(box: Item['box']): Promise<Item[]>;
  put(item: Item): Promise<void>;
  putMany(items: ReadonlyArray<Item>): Promise<void>;
}

export function createItemsRepo(db: DB): ItemsRepo {
  return {
    async get(id) {
      return db.get('items', id);
    },

    async listAll() {
      return db.getAll('items');
    },

    async findDue(now) {
      const all = await db.getAllFromIndex('items', 'by-due');
      return all.filter((it) => it.due_at <= now);
    },

    async findByBox(box) {
      return db.getAllFromIndex('items', 'by-box', box);
    },

    async put(item) {
      await db.put('items', item);
    },

    async putMany(items) {
      const tx = db.transaction('items', 'readwrite');
      await Promise.all(items.map((it) => tx.store.put(it)));
      await tx.done;
    },
  };
}
```

- [ ] **Step 10.4: Run tests — expect pass**

```bash
npm run test -- items-repo
```

- [ ] **Step 10.5: Commit**

```bash
git add src/store/items-repo.ts tests/store/items-repo.test.ts
git commit -m "feat(store): items repository"
```

---

## Task 11: Attempts Repository

**Files:**
- Create: `src/store/attempts-repo.ts`
- Create: `tests/store/attempts-repo.test.ts`

- [ ] **Step 11.1: Write failing test**

Create `tests/store/attempts-repo.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { createAttemptsRepo } from '@/store/attempts-repo';
import { openTestDB } from '../helpers/test-db';
import type { Attempt } from '@/types/domain';

function mkAttempt(overrides: Partial<Attempt> = {}): Attempt {
  return {
    id: 'att-1',
    item_id: '5-C-major',
    session_id: 'sess-1',
    at: 1,
    target: { hz: 392, degree: 5 },
    sung: { hz: 395, cents_off: +13, confidence: 0.9 },
    spoken: { digit: 5, confidence: 0.95 },
    graded: { pitch: true, label: true, pass: true, at: 1 },
    timbre: 'piano',
    register: 'comfortable',
    ...overrides,
  };
}

describe('attempts-repo', () => {
  it('append + findBySession returns attempts in order of `at`', async () => {
    const db = await openTestDB();
    const repo = createAttemptsRepo(db);
    await repo.append(mkAttempt({ id: 'b', at: 2 }));
    await repo.append(mkAttempt({ id: 'a', at: 1 }));
    await repo.append(mkAttempt({ id: 'c', at: 3 }));
    const fetched = await repo.findBySession('sess-1');
    expect(fetched.map((a) => a.id)).toEqual(['a', 'b', 'c']);
  });

  it('findByItem filters by item', async () => {
    const db = await openTestDB();
    const repo = createAttemptsRepo(db);
    await repo.append(mkAttempt({ id: 'a', item_id: 'x' }));
    await repo.append(mkAttempt({ id: 'b', item_id: 'y' }));
    const fetched = await repo.findByItem('x');
    expect(fetched.map((a) => a.id)).toEqual(['a']);
  });

  it('scoped findBySession does not return other sessions', async () => {
    const db = await openTestDB();
    const repo = createAttemptsRepo(db);
    await repo.append(mkAttempt({ id: 'a', session_id: 's1' }));
    await repo.append(mkAttempt({ id: 'b', session_id: 's2' }));
    const fetched = await repo.findBySession('s1');
    expect(fetched.map((a) => a.id)).toEqual(['a']);
  });
});
```

- [ ] **Step 11.2: Run — expect failure**

```bash
npm run test -- attempts-repo
```

- [ ] **Step 11.3: Implement `src/store/attempts-repo.ts`**

```typescript
import type { DB } from './db';
import type { Attempt } from '@/types/domain';

export interface AttemptsRepo {
  append(attempt: Attempt): Promise<void>;
  findBySession(sessionId: string): Promise<Attempt[]>;
  findByItem(itemId: string): Promise<Attempt[]>;
}

export function createAttemptsRepo(db: DB): AttemptsRepo {
  return {
    async append(attempt) {
      await db.put('attempts', attempt);
    },

    async findBySession(sessionId) {
      const all = await db.getAllFromIndex('attempts', 'by-session', sessionId);
      return all.sort((a, b) => a.at - b.at);
    },

    async findByItem(itemId) {
      const all = await db.getAllFromIndex('attempts', 'by-item', itemId);
      return all.sort((a, b) => a.at - b.at);
    },
  };
}
```

- [ ] **Step 11.4: Run tests — expect pass**

```bash
npm run test -- attempts-repo
```

- [ ] **Step 11.5: Commit**

```bash
git add src/store/attempts-repo.ts tests/store/attempts-repo.test.ts
git commit -m "feat(store): attempts repository"
```

---

## Task 12: Sessions & Settings Repositories

**Files:**
- Create: `src/store/sessions-repo.ts`
- Create: `src/store/settings-repo.ts`
- Create: `tests/store/sessions-repo.test.ts`
- Create: `tests/store/settings-repo.test.ts`

- [ ] **Step 12.1: Write failing test for sessions-repo**

Create `tests/store/sessions-repo.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { createSessionsRepo } from '@/store/sessions-repo';
import { openTestDB } from '../helpers/test-db';

describe('sessions-repo', () => {
  it('start + complete round-trip', async () => {
    const db = await openTestDB();
    const repo = createSessionsRepo(db);

    const session = await repo.start({ id: 's1', target_items: 30, started_at: 100 });
    expect(session.id).toBe('s1');
    expect(session.ended_at).toBe(null);
    expect(session.completed_items).toBe(0);

    await repo.complete('s1', {
      ended_at: 200,
      completed_items: 30,
      pitch_pass_count: 24,
      label_pass_count: 28,
      focus_item_id: '6-C-major',
    });

    const after = await repo.get('s1');
    expect(after?.ended_at).toBe(200);
    expect(after?.completed_items).toBe(30);
    expect(after?.focus_item_id).toBe('6-C-major');
  });

  it('findRecent returns sessions sorted newest first', async () => {
    const db = await openTestDB();
    const repo = createSessionsRepo(db);
    await repo.start({ id: 'a', target_items: 30, started_at: 1 });
    await repo.start({ id: 'b', target_items: 30, started_at: 3 });
    await repo.start({ id: 'c', target_items: 30, started_at: 2 });

    const recent = await repo.findRecent(10);
    expect(recent.map((s) => s.id)).toEqual(['b', 'c', 'a']);
  });
});
```

- [ ] **Step 12.2: Implement `src/store/sessions-repo.ts`**

```typescript
import type { DB } from './db';
import type { Session } from '@/types/domain';

export interface StartSessionInput {
  id: string;
  target_items: number;
  started_at: number;
}

export interface CompleteSessionInput {
  ended_at: number;
  completed_items: number;
  pitch_pass_count: number;
  label_pass_count: number;
  focus_item_id: string | null;
}

export interface SessionsRepo {
  start(input: StartSessionInput): Promise<Session>;
  complete(id: string, input: CompleteSessionInput): Promise<void>;
  get(id: string): Promise<Session | undefined>;
  findRecent(limit: number): Promise<Session[]>;
}

export function createSessionsRepo(db: DB): SessionsRepo {
  return {
    async start(input) {
      const session: Session = {
        id: input.id,
        started_at: input.started_at,
        ended_at: null,
        target_items: input.target_items,
        completed_items: 0,
        pitch_pass_count: 0,
        label_pass_count: 0,
        focus_item_id: null,
      };
      await db.put('sessions', session);
      return session;
    },

    async complete(id, input) {
      const existing = await db.get('sessions', id);
      if (!existing) return;
      const updated: Session = { ...existing, ...input };
      await db.put('sessions', updated);
    },

    async get(id) {
      return db.get('sessions', id);
    },

    async findRecent(limit) {
      const all = await db.getAllFromIndex('sessions', 'by-started-at');
      return all.reverse().slice(0, limit);
    },
  };
}
```

- [ ] **Step 12.3: Run tests for sessions — expect pass**

```bash
npm run test -- sessions-repo
```

- [ ] **Step 12.4: Write failing test for settings-repo**

Create `tests/store/settings-repo.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { createSettingsRepo } from '@/store/settings-repo';
import { openTestDB } from '../helpers/test-db';
import { DEFAULT_SETTINGS } from '@/types/domain';

describe('settings-repo', () => {
  it('getOrDefault returns defaults when nothing stored', async () => {
    const db = await openTestDB();
    const repo = createSettingsRepo(db);
    const s = await repo.getOrDefault();
    expect(s).toEqual(DEFAULT_SETTINGS);
  });

  it('update persists changes', async () => {
    const db = await openTestDB();
    const repo = createSettingsRepo(db);
    await repo.update({ function_tooltip: false, session_length: 45 });
    const s = await repo.getOrDefault();
    expect(s.function_tooltip).toBe(false);
    expect(s.session_length).toBe(45);
    // unchanged fields retained
    expect(s.auto_advance_on_hit).toBe(DEFAULT_SETTINGS.auto_advance_on_hit);
  });
});
```

- [ ] **Step 12.5: Implement `src/store/settings-repo.ts`**

```typescript
import type { DB } from './db';
import { DEFAULT_SETTINGS, type Settings } from '@/types/domain';

const KEY = 'singleton' as const;

export interface SettingsRepo {
  getOrDefault(): Promise<Settings>;
  update(partial: Partial<Settings>): Promise<void>;
}

export function createSettingsRepo(db: DB): SettingsRepo {
  return {
    async getOrDefault() {
      const existing = await db.get('settings', KEY);
      return existing ?? { ...DEFAULT_SETTINGS };
    },

    async update(partial) {
      const current = await this.getOrDefault();
      const next: Settings = { ...current, ...partial };
      await db.put('settings', next, KEY);
    },
  };
}
```

- [ ] **Step 12.6: Run tests for settings — expect pass**

```bash
npm run test -- settings-repo
```

- [ ] **Step 12.7: Commit**

```bash
git add src/store/sessions-repo.ts src/store/settings-repo.ts \
  tests/store/sessions-repo.test.ts tests/store/settings-repo.test.ts
git commit -m "feat(store): sessions and settings repositories"
```

---

## Task 13: Seed — Initial Items Factory

**Files:**
- Create: `src/seed/initial-items.ts`
- Create: `tests/seed/initial-items.test.ts`

- [ ] **Step 13.1: Write failing test**

Create `tests/seed/initial-items.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildInitialItems } from '@/seed/initial-items';

describe('buildInitialItems', () => {
  it('creates 3 items for the tonic triad in C major', () => {
    const items = buildInitialItems({ now: 1_700_000_000_000 });
    expect(items.length).toBe(3);
    const degrees = items.map((i) => i.degree).sort((a, b) => a - b);
    expect(degrees).toEqual([1, 3, 5]);
  });

  it('all starter items are in C major', () => {
    const items = buildInitialItems({ now: 0 });
    for (const it of items) {
      expect(it.key.tonic).toBe('C');
      expect(it.key.quality).toBe('major');
    }
  });

  it('all starter items start in box=new, due_at=now, empty history', () => {
    const now = 42;
    const items = buildInitialItems({ now });
    for (const it of items) {
      expect(it.box).toBe('new');
      expect(it.due_at).toBe(now);
      expect(it.recent).toEqual([]);
      expect(it.attempts).toBe(0);
      expect(it.consecutive_passes).toBe(0);
      expect(it.last_seen_at).toBe(null);
      expect(it.accuracy).toEqual({ pitch: 0, label: 0 });
      expect(it.created_at).toBe(now);
    }
  });

  it('item ids are stable and match itemId()', () => {
    const items = buildInitialItems({ now: 0 });
    const ids = items.map((i) => i.id).sort();
    expect(ids).toEqual(['1-C-major', '3-C-major', '5-C-major']);
  });
});
```

- [ ] **Step 13.2: Run — expect failure**

```bash
npm run test -- initial-items
```

- [ ] **Step 13.3: Implement `src/seed/initial-items.ts`**

```typescript
import type { Item } from '@/types/domain';
import { itemId } from '@/types/music';
import { MVP_CURRICULUM } from '@/scheduler/curriculum';

export interface SeedOpts {
  now: number;
}

/** Build the initial set of items presented to a fresh learner. */
export function buildInitialItems(opts: SeedOpts): Item[] {
  const first = MVP_CURRICULUM[0];
  if (!first) throw new Error('Curriculum is empty');
  return first.members.map((m) => ({
    id: itemId(m.degree, m.key),
    degree: m.degree,
    key: m.key,
    box: 'new' as const,
    accuracy: { pitch: 0, label: 0 },
    recent: [],
    attempts: 0,
    consecutive_passes: 0,
    last_seen_at: null,
    due_at: opts.now,
    created_at: opts.now,
  }));
}
```

- [ ] **Step 13.4: Run tests — expect pass**

```bash
npm run test -- initial-items
```

- [ ] **Step 13.5: Commit**

```bash
git add src/seed/initial-items.ts tests/seed/initial-items.test.ts
git commit -m "feat(seed): build initial learner items (C major tonic triad)"
```

---

## Task 14: Session Orchestrator

The orchestrator ties scheduler + store together. Given an attempt result, it updates item state (Leitner + accuracy + due_at) atomically and picks the next item.

**Files:**
- Create: `src/session/orchestrator.ts`
- Create: `tests/session/orchestrator.test.ts`

- [ ] **Step 14.1: Write failing test**

Create `tests/session/orchestrator.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createOrchestrator, type Orchestrator } from '@/session/orchestrator';
import { createItemsRepo } from '@/store/items-repo';
import { createAttemptsRepo } from '@/store/attempts-repo';
import { createSessionsRepo } from '@/store/sessions-repo';
import { openTestDB } from '../helpers/test-db';
import { buildInitialItems } from '@/seed/initial-items';
import type { Item } from '@/types/domain';

async function setup(): Promise<Orchestrator> {
  const db = await openTestDB();
  const itemsRepo = createItemsRepo(db);
  const attemptsRepo = createAttemptsRepo(db);
  const sessionsRepo = createSessionsRepo(db);
  await itemsRepo.putMany(buildInitialItems({ now: 0 }));
  return createOrchestrator({
    itemsRepo,
    attemptsRepo,
    sessionsRepo,
    now: () => 1_000,
    rng: () => 0.5,
    sessionId: 'sess-1',
  });
}

describe('orchestrator', () => {
  it('starts a session and returns a first item', async () => {
    const orch = await setup();
    await orch.startSession({ target_items: 10 });
    const first = await orch.nextItem();
    expect(first).not.toBe(null);
  });

  it('updates item state on pass (advances toward promotion)', async () => {
    const orch = await setup();
    await orch.startSession({ target_items: 10 });
    const first = await orch.nextItem();
    if (!first) throw new Error('expected item');

    await orch.recordAttempt({
      item: first,
      target: { hz: 440, degree: first.degree },
      sung: { hz: 441, cents_off: 4, confidence: 0.9 },
      spoken: { digit: first.degree, confidence: 0.95 },
      pitchOk: true,
      labelOk: true,
      timbre: 'piano',
      register: 'comfortable',
    });

    const after = await orch.peekItem(first.id);
    expect(after).toBeDefined();
    expect(after!.attempts).toBe(1);
    expect(after!.consecutive_passes).toBe(1);
    // new -> learning on first pass
    expect(after!.box).toBe('learning');
  });

  it('demotes box on miss from reviewing to learning', async () => {
    const orch = await setup();
    await orch.startSession({ target_items: 10 });
    const first = await orch.nextItem();
    if (!first) throw new Error('expected item');

    // Force a reviewing state and re-fetch so the Item reference is fresh.
    await orch.forceSetBox(first.id, 'reviewing');
    const fresh = await orch.peekItem(first.id);
    if (!fresh) throw new Error('missing item after forceSetBox');

    await orch.recordAttempt({
      item: fresh,
      target: { hz: 440, degree: fresh.degree },
      sung: { hz: 470, cents_off: 100, confidence: 0.9 },
      spoken: { digit: 7, confidence: 0.6 },
      pitchOk: false,
      labelOk: false,
      timbre: 'piano',
      register: 'comfortable',
    });

    const after = await orch.peekItem(fresh.id);
    expect(after!.box).toBe('learning');
    expect(after!.consecutive_passes).toBe(0);
  });

  it('completes a session and aggregates stats', async () => {
    const orch = await setup();
    await orch.startSession({ target_items: 2 });

    for (let i = 0; i < 2; i++) {
      const it = await orch.nextItem();
      if (!it) break;
      await orch.recordAttempt({
        item: it,
        target: { hz: 440, degree: it.degree },
        sung: { hz: 441, cents_off: 4, confidence: 0.9 },
        spoken: { digit: it.degree, confidence: 0.95 },
        pitchOk: true,
        labelOk: true,
        timbre: 'piano',
        register: 'comfortable',
      });
    }

    const summary = await orch.completeSession();
    expect(summary.completed_items).toBe(2);
    expect(summary.pitch_pass_count).toBe(2);
    expect(summary.label_pass_count).toBe(2);
  });
});
```

- [ ] **Step 14.2: Run — expect failure**

```bash
npm run test -- orchestrator
```

- [ ] **Step 14.3: Implement `src/session/orchestrator.ts`**

```typescript
import type { Attempt, AttemptOutcome, Item, LeitnerBox, Register, Session } from '@/types/domain';
import type { Degree } from '@/types/music';
import type { ItemsRepo } from '@/store/items-repo';
import type { AttemptsRepo } from '@/store/attempts-repo';
import type { SessionsRepo } from '@/store/sessions-repo';
import { selectNextItem } from '@/scheduler/selection';
import type { RoundHistoryEntry } from '@/scheduler/interleaving';
import { nextBoxOnPass, nextBoxOnMiss, dueAtAfter } from '@/srs/leitner';
import { weightedAccuracy, pushOutcome } from '@/srs/accuracy';

export interface OrchestratorDeps {
  itemsRepo: ItemsRepo;
  attemptsRepo: AttemptsRepo;
  sessionsRepo: SessionsRepo;
  now: () => number;
  rng: () => number;
  sessionId: string;
}

export interface StartSessionInput {
  target_items: number;
}

export interface RecordAttemptInput {
  item: Item;
  target: { hz: number; degree: Degree };
  sung: { hz: number | null; cents_off: number | null; confidence: number };
  spoken: { digit: number | null; confidence: number };
  pitchOk: boolean;
  labelOk: boolean;
  timbre: string;
  register: Register;
}

export interface Orchestrator {
  startSession(input: StartSessionInput): Promise<Session>;
  nextItem(): Promise<Item | null>;
  recordAttempt(input: RecordAttemptInput): Promise<AttemptOutcome>;
  completeSession(): Promise<Session>;

  // test-only hooks
  peekItem(id: string): Promise<Item | undefined>;
  forceSetBox(id: string, box: LeitnerBox): Promise<void>;
}

export function createOrchestrator(deps: OrchestratorDeps): Orchestrator {
  let started = false;
  const history: RoundHistoryEntry[] = [];
  let completedItems = 0;
  let pitchPasses = 0;
  let labelPasses = 0;
  let targetItems = 0;
  let reviewsInBox = new Map<string, number>(); // item.id → count in current box

  return {
    async startSession(input) {
      started = true;
      history.length = 0;
      completedItems = 0;
      pitchPasses = 0;
      labelPasses = 0;
      targetItems = input.target_items;
      reviewsInBox = new Map();
      return deps.sessionsRepo.start({
        id: deps.sessionId,
        target_items: input.target_items,
        started_at: deps.now(),
      });
    },

    async nextItem() {
      if (!started) throw new Error('session not started');
      if (completedItems >= targetItems) return null;
      const items = await deps.itemsRepo.listAll();
      return selectNextItem(items, history, deps.now(), deps.rng);
    },

    async recordAttempt(input) {
      if (!started) throw new Error('session not started');
      const now = deps.now();
      const outcome: AttemptOutcome = {
        pitch: input.pitchOk,
        label: input.labelOk,
        pass: input.pitchOk && input.labelOk,
        at: now,
      };

      // Update item
      const updated: Item = {
        ...input.item,
        attempts: input.item.attempts + 1,
        consecutive_passes: outcome.pass ? input.item.consecutive_passes + 1 : 0,
        recent: pushOutcome(input.item.recent, outcome),
        last_seen_at: now,
      };
      updated.accuracy = {
        pitch: weightedAccuracy(updated.recent, 'pitch'),
        label: weightedAccuracy(updated.recent, 'label'),
      };
      const nextBox = outcome.pass
        ? nextBoxOnPass(input.item.box, updated.consecutive_passes)
        : nextBoxOnMiss(input.item.box);
      const reviewsInCurrentBox = nextBox === input.item.box
        ? (reviewsInBox.get(input.item.id) ?? 0) + 1
        : 0;
      reviewsInBox.set(input.item.id, reviewsInCurrentBox);
      updated.box = nextBox;
      updated.due_at = dueAtAfter(nextBox, reviewsInCurrentBox, now);
      await deps.itemsRepo.put(updated);

      // Record attempt
      const attempt: Attempt = {
        id: `${deps.sessionId}-${now}-${input.item.id}`,
        item_id: input.item.id,
        session_id: deps.sessionId,
        at: now,
        target: input.target,
        sung: input.sung,
        spoken: input.spoken,
        graded: outcome,
        timbre: input.timbre,
        register: input.register,
      };
      await deps.attemptsRepo.append(attempt);

      // Update session bookkeeping
      completedItems++;
      if (outcome.pitch) pitchPasses++;
      if (outcome.label) labelPasses++;

      history.push({ itemId: input.item.id, degree: input.item.degree, key: input.item.key });

      return outcome;
    },

    async completeSession() {
      const endedAt = deps.now();
      const items = await deps.itemsRepo.listAll();
      const weakest = pickFocusItem(items);
      await deps.sessionsRepo.complete(deps.sessionId, {
        ended_at: endedAt,
        completed_items: completedItems,
        pitch_pass_count: pitchPasses,
        label_pass_count: labelPasses,
        focus_item_id: weakest?.id ?? null,
      });
      const out = await deps.sessionsRepo.get(deps.sessionId);
      if (!out) throw new Error('session disappeared');
      started = false;
      return out;
    },

    async peekItem(id) {
      return deps.itemsRepo.get(id);
    },

    async forceSetBox(id, box) {
      const it = await deps.itemsRepo.get(id);
      if (!it) return;
      await deps.itemsRepo.put({ ...it, box });
    },
  };
}

/**
 * Identify the weakest item across pitch accuracy; returns null if nothing qualifies.
 * Ties broken by lowest box rank.
 */
function pickFocusItem(items: ReadonlyArray<Item>): Item | null {
  const BOX_RANK: Record<LeitnerBox, number> = {
    new: 0, learning: 1, reviewing: 2, mastered: 3,
  };
  let best: Item | null = null;
  for (const it of items) {
    if (best === null) { best = it; continue; }
    if (it.accuracy.pitch < best.accuracy.pitch) { best = it; continue; }
    if (it.accuracy.pitch === best.accuracy.pitch && BOX_RANK[it.box] < BOX_RANK[best.box]) {
      best = it;
    }
  }
  return best;
}
```

- [ ] **Step 14.4: Run tests — expect pass**

```bash
npm run test -- orchestrator
```

- [ ] **Step 14.5: Commit**

```bash
git add src/session/orchestrator.ts tests/session/orchestrator.test.ts
git commit -m "feat(session): orchestrator coordinating scheduler + store"
```

---

## Task 15: End-to-End Simulated Session

This is the integration test. We simulate a realistic run of ~30 rounds, with varying pass/fail rates, and verify the end-to-end system behaves as expected: items progress through Leitner boxes, new groups unlock, the next session behaves differently.

**Files:**
- Create: `tests/session/simulated-session.test.ts`

- [ ] **Step 15.1: Write the integration test**

Create `tests/session/simulated-session.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { createOrchestrator } from '@/session/orchestrator';
import { createItemsRepo } from '@/store/items-repo';
import { createAttemptsRepo } from '@/store/attempts-repo';
import { createSessionsRepo } from '@/store/sessions-repo';
import { openTestDB } from '../helpers/test-db';
import { buildInitialItems } from '@/seed/initial-items';
import { computeUnlockedGroupIds } from '@/scheduler/unlock';

function seedRng(seed: number): () => number {
  // Mulberry32 — small, deterministic PRNG for reproducible tests.
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('simulated full session', () => {
  it('runs 30 rounds with near-perfect responses and unlocks the next group', async () => {
    const db = await openTestDB();
    const itemsRepo = createItemsRepo(db);
    const attemptsRepo = createAttemptsRepo(db);
    const sessionsRepo = createSessionsRepo(db);
    await itemsRepo.putMany(buildInitialItems({ now: 0 }));

    let clock = 1_000;
    const tick = () => { clock += 15_000; return clock; }; // 15s per round

    const orch = createOrchestrator({
      itemsRepo,
      attemptsRepo,
      sessionsRepo,
      now: () => clock,
      rng: seedRng(42),
      sessionId: 'sim-1',
    });

    await orch.startSession({ target_items: 30 });

    let rounds = 0;
    while (true) {
      const item = await orch.nextItem();
      if (!item) break;
      tick();
      // 95% pass rate
      const passing = Math.random() < 0.95;
      await orch.recordAttempt({
        item,
        target: { hz: 440, degree: item.degree },
        sung: { hz: passing ? 442 : 520, cents_off: passing ? 7 : 450, confidence: 0.9 },
        spoken: { digit: passing ? item.degree : 2, confidence: 0.9 },
        pitchOk: passing,
        labelOk: passing,
        timbre: 'piano',
        register: 'comfortable',
      });
      rounds++;
      if (rounds > 200) throw new Error('runaway loop'); // safety
    }

    expect(rounds).toBe(30);
    const summary = await orch.completeSession();
    expect(summary.completed_items).toBe(30);

    // All three starter items should have advanced at least out of "new".
    const items = await itemsRepo.listAll();
    for (const it of items) {
      expect(it.box).not.toBe('new');
      expect(it.attempts).toBeGreaterThan(0);
    }

    // The next group should be unlocked (at 95% pass, all three will be
    // in reviewing/mastered long before 30 rounds).
    const unlocked = computeUnlockedGroupIds(items);
    expect(unlocked.has('c-major-diatonic-full')).toBe(true);
  });

  it('does not unlock next group after a failure-heavy session', async () => {
    const db = await openTestDB();
    const itemsRepo = createItemsRepo(db);
    const attemptsRepo = createAttemptsRepo(db);
    const sessionsRepo = createSessionsRepo(db);
    await itemsRepo.putMany(buildInitialItems({ now: 0 }));

    let clock = 1_000;
    const orch = createOrchestrator({
      itemsRepo,
      attemptsRepo,
      sessionsRepo,
      now: () => clock,
      rng: seedRng(7),
      sessionId: 'sim-2',
    });

    await orch.startSession({ target_items: 30 });

    let rounds = 0;
    const miss = seedRng(99);
    while (true) {
      const item = await orch.nextItem();
      if (!item) break;
      clock += 15_000;
      // 20% pass rate — not enough to promote
      const passing = miss() < 0.2;
      await orch.recordAttempt({
        item,
        target: { hz: 440, degree: item.degree },
        sung: { hz: passing ? 442 : 520, cents_off: passing ? 7 : 450, confidence: 0.9 },
        spoken: { digit: passing ? item.degree : 2, confidence: 0.9 },
        pitchOk: passing,
        labelOk: passing,
        timbre: 'piano',
        register: 'comfortable',
      });
      rounds++;
      if (rounds > 200) throw new Error('runaway loop');
    }

    const items = await itemsRepo.listAll();
    const unlocked = computeUnlockedGroupIds(items);
    expect(unlocked.has('c-major-diatonic-full')).toBe(false);
  });

  it('applies interleaving constraints across the session', async () => {
    const db = await openTestDB();
    const itemsRepo = createItemsRepo(db);
    const attemptsRepo = createAttemptsRepo(db);
    const sessionsRepo = createSessionsRepo(db);
    await itemsRepo.putMany(buildInitialItems({ now: 0 }));

    let clock = 1_000;
    const orch = createOrchestrator({
      itemsRepo,
      attemptsRepo,
      sessionsRepo,
      now: () => clock,
      rng: seedRng(13),
      sessionId: 'sim-3',
    });
    await orch.startSession({ target_items: 30 });

    const presented: number[] = [];
    while (true) {
      const item = await orch.nextItem();
      if (!item) break;
      presented.push(item.degree);
      clock += 15_000;
      await orch.recordAttempt({
        item,
        target: { hz: 440, degree: item.degree },
        sung: { hz: 442, cents_off: 7, confidence: 0.9 },
        spoken: { digit: item.degree, confidence: 0.9 },
        pitchOk: true,
        labelOk: true,
        timbre: 'piano',
        register: 'comfortable',
      });
    }
    // No consecutive same degree within the first group
    for (let i = 1; i < presented.length; i++) {
      expect(presented[i]).not.toBe(presented[i - 1]);
    }
  });
});
```

- [ ] **Step 15.2: Run — expect pass**

```bash
npm run test -- simulated-session
```

Expected: all 3 integration scenarios pass.

- [ ] **Step 15.3: Full test sweep**

```bash
npm run test
```

Expected: every test file passes. Count should be roughly 40+ passing tests.

- [ ] **Step 15.4: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 15.5: Commit**

```bash
git add tests/session/simulated-session.test.ts
git commit -m "test(session): simulated end-to-end sessions (pass-heavy, miss-heavy, interleaving)"
```

---

## Plan Self-Review

After implementation, verify:

1. **Spec coverage:**
   - §5.1 round states — orchestrator supports start/next/record/complete. Audio+UI states are in Plan C. ✓
   - §5.2 session structure — target items, interleaving, key-rotation rules. ✓
   - §6.1 item model — `Item` type matches spec. ✓
   - §6.2 grading — orchestrator takes `pitchOk`/`labelOk` booleans; grader that produces them is a Plan B/C concern. ✓
   - §6.3 Leitner boxes, intervals, promotion/demotion. ✓
   - §6.4 selection (70/30 split, weighting). ✓
   - §6.5 unlock gating via curriculum + ratio threshold. ✓
   - §10 data model — `Item`, `Attempt`, `Session`, `Settings` types match. ✓
   - §10.1 edge cases — "user closes tab mid-round" is partially covered: the orchestrator's `completeSession` marks session end; resuming is Plan C. Clock-skew reanchoring not yet implemented — deferred to Plan C (UI can detect and call a repo method).

2. **Placeholder scan:** None — every task contains the literal code to write, every test its assertions, every command its expected output.

3. **Type consistency:**
   - `nextBoxOnPass` signature matches between test (`nextBoxOnPass('learning', 1)`) and implementation. ✓
   - `selectNextItem` signature matches. ✓
   - `createOrchestrator`'s `RecordAttemptInput` uses `pitchOk`/`labelOk` consistently across test and implementation. ✓
   - `ItemsRepo`, `AttemptsRepo`, `SessionsRepo`, `SettingsRepo` interfaces all use function-returning-interface pattern. ✓

Plan complete.

---

## Execution Handoff

**Plan A complete and saved to `docs/plans/2026-04-14-plan-a-foundation-core-logic.md`.**

Two execution options:

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration. Best for this plan because tasks are independent and each produces a green test run.

**2. Inline Execution** — execute tasks in this session, batch execution with checkpoints.

Which approach?
