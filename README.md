# Ear Training Station

A dark-themed PWA for hobbyist instrumentalists who want to learn to play songs by ear. One focused exercise: hear a cadence, hear a target scale degree, sing it back, and say the digit.

## What it is

Ear Training Station teaches **functional scale-degree hearing** — the ability to identify where a note sits within a key. Every round establishes a tonic via a full cadence first, then plays one target note. You sing the pitch back and say the digit aloud ("five"). Both are graded.

This is not interval drills. The cadence resets tonal context every time, which is how the ear learns to orient to a key rather than to the previous note.

## How it works

1. A cadence plays to establish the key
2. A target note plays — one of the 7 diatonic scale degrees
3. Sing the pitch back into the mic
4. Say the digit aloud ("one" through "seven")
5. Both pitch accuracy and spoken digit are graded immediately
6. The Leitner SRS scheduler picks the next item based on your history

## Key features

- **Leitner SRS scheduling** — items advance through boxes based on correct answers; mistakes reset them
- **Variability by default** — key, timbre, register, and cadence voicing vary across rounds
- **Honest progress UI** — per-degree mastery bars, per-key heatmap, Leitner box counts, streak chip; no XP or confetti
- **Sing-and-verify** — pitch detection and keyword spotting run in parallel; both must match
- **PWA / offline** — service worker caches the TensorFlow.js KWS model after first load; works offline

## Getting started

**Prerequisites:** Node 20+, pnpm 9+

```bash
git clone https://github.com/julianken/ear-training-station.git
cd ear-training-station
pnpm install
pnpm run dev          # Vite dev server at http://localhost:5173
```

Open `http://localhost:5173` and grant microphone permission when prompted.

## Running tests

```bash
pnpm run test         # Vitest unit tests across all packages
pnpm run test:e2e     # Playwright smoke test (requires dev server or build)
pnpm run typecheck    # tsc --noEmit per package
pnpm run lint         # ESLint across all packages
```

## Project structure

pnpm workspace with four packages:

| Package | Name | Contents |
|---------|------|----------|
| `packages/core/` | `@ear-training/core` | Pure TypeScript: types, SRS, scheduler, round reducer, analytics — no browser APIs |
| `packages/web-platform/` | `@ear-training/web-platform` | Browser infra: Tone.js playback, AudioWorklet pitch detection, TensorFlow.js speech recognition, IndexedDB repos |
| `packages/ui-tokens/` | `@ear-training/ui-tokens` | Design tokens (TypeScript + CSS custom properties) |
| `apps/ear-training-station/` | `ear-training-station` | SvelteKit app shell, session UI, dashboard, service worker |

## Tech stack

- **SvelteKit + Svelte 5** — UI framework
- **Vite** — build tool and dev server
- **TypeScript** — strict throughout
- **Tone.js** — cadence and target note synthesis
- **TensorFlow.js + speech-commands** — on-device keyword spotting for digit recognition
- **Web Audio API / AudioWorklet** — real-time YIN pitch detection
- **IndexedDB** — local persistence for items, attempts, sessions
- **Workbox / VitePWA** — service worker, offline caching
- **Vitest** — unit tests
- **Playwright** — end-to-end tests with axe-core accessibility checks

## Design principles

These are non-negotiable and must not drift during implementation:

- **Functional scale-degree hearing** — cadence first, every round; no isolated interval drills
- **Sing-and-verify** — both pitch and spoken digit are graded; neither alone is sufficient
- **Variability by default** — key, timbre, register, voicing vary to prevent rote memorization
- **Interleaving + Leitner SRS** — no blocked practice; scheduler ensures interleaving across degrees
- **Honest progress UI** — mastery bars, key heatmap, Leitner counts, streak; nothing gamified
- **Dark audio-app aesthetic** — background `#0a0a0a`, cyan `#22d3ee` for reference data, amber `#fbbf24` for captured input, green/red for pass/fail

## Architecture

```
apps/ear-training-station/
  └── SvelteKit routes + session/dashboard UI
        │
        ├── @ear-training/web-platform   (browser I/O layer)
        │     ├── audio/player           Tone.js cadence + target playback
        │     ├── mic/ + pitch/          AudioWorklet YIN pitch detector
        │     ├── speech/                TF.js keyword spotter
        │     ├── round-adapters/        bridges audio events to round reducer
        │     └── store/                 IndexedDB repositories
        │
        └── @ear-training/core           (pure logic, no browser APIs)
              ├── types/                 Key, Degree, Item, Session, Attempt
              ├── srs/ + scheduler/      Leitner SRS + interleaved scheduling
              ├── round/                 round reducer, grade-pitch, events
              ├── analytics/             mastery rollups, streak, heatmap data
              └── variability/           key/timbre/register pickers
```

## Contributing

The agent-driven development workflow, PR conventions, and CI configuration are documented in [CLAUDE.md](CLAUDE.md).

## License

No license file present. All rights reserved.
