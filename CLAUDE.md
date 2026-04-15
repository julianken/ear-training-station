# ear-training-station

Dark-themed PWA for hobbyist instrumentalists who want to play songs by ear. MVP is one focused exercise: hear a cadence, hear a target scale-degree, sing it back and say the digit. See `docs/specs/2026-04-14-ear-training-mvp-design.md` for full spec.

GitHub: https://github.com/julianken/ear-training-station

## Current state

- **Plan A · Foundation + Core Logic** — ✅ executed. 88 tests passing, 0 type errors, 21 commits. Pure-logic kernel: types, SRS, scheduler, IndexedDB repos, orchestrator. No audio, no UI yet.
- **Plan B · Audio I/O** — written (`docs/plans/2026-04-14-plan-b-audio-io.md`), not yet executed. 12 tasks: note math, timbres, cadence/target structures, YIN pitch detection, Hz→degree mapping, Tone.js player, AudioWorklet, mic permission, TF.js speech commands, dev harness, Playwright smoke test.
- **Plan C · UI + Integration** — not yet written. Will cover Svelte components for all 5 surfaces, session state machine, PWA wiring.

`git log --oneline` shows the full progression.

## Docs to read first

1. `docs/specs/2026-04-14-ear-training-mvp-design.md` — what we're building and why (the source of truth for decisions)
2. `docs/research/2026-04-14-ear-training-research-synthesis.md` — evidence behind the pedagogy
3. `docs/plans/2026-04-14-plan-a-foundation-core-logic.md` — executed plan, useful as a reference for conventions
4. `docs/plans/2026-04-14-plan-b-audio-io.md` — next plan to execute
5. `docs/mockups/*.html` — visual design decisions (aesthetic, session screen, feedback state, dashboard, summary) as static HTML mockups

## Non-negotiable design commitments

From the research synthesis + explicit design picks. Do NOT drift from these during implementation:

- **Functional scale-degree hearing**, not isolated interval drills. Every round establishes a tonic via a cadence first.
- **Sing-and-verify.** User sings the target pitch AND says the digit ("five"). Both are graded.
- **Variability by default.** Key, timbre, register, cadence voicing vary across rounds.
- **Interleaving + Leitner SRS** for scheduling. No blocked practice.
- **Honest progress UI** — per-degree mastery bars, per-key heatmap, Leitner box counts, streak chip. No XP, no confetti, no Duolingo moves.
- **Dark audio-app aesthetic.** Background `#0a0a0a`. Cyan `#22d3ee` for target/reference data. Amber `#fbbf24` for user/capture data. Green `#22c55e` and red `#ef4444` for pass/fail.
- **Split-stage session screen** with cadence-visible chord blocks on top + R1 scrolling pitch trace on bottom.
- **Feedback = F2 result panel + segmented-toggle replay** (You / Target / Both).

If a task would drift one of these, stop and ask.

## Dev commands

```bash
npm run dev         # Vite dev server on :5173
npm run test        # Vitest — run once
npm run test:watch  # Vitest watch
npm run typecheck   # tsc --noEmit (authoritative)
npm run build       # production build
```

After Plan B lands:
```bash
# open http://localhost:5173/harness/audio.html   # manual audio validation harness
# npm run test:e2e                                # Playwright smoke test
```

## Known gotchas

- **LSP diagnostics lag behind the filesystem.** When a new file or a new `@/...` import lands, the editor LSP may flag "Cannot find module" for a minute or two. **`npm run typecheck` is authoritative.** Trust `tsc` and `vitest` over editor squiggles. This pattern showed up on every task in Plan A.
- **Tone.js under jsdom.** Tone touches `AudioContext` at module load. If a unit test indirectly imports `src/audio/timbres.ts`, wrap the synth factory so Tone construction is deferred until `createSynth()` is called.
- **npm audit.** CVEs in dev deps got cleared in Plan A (bumped vite 5→6 + svelte-plugin 4→5 + vitest 2→3). Expect `0 vulnerabilities` on a fresh install; if new ones appear, don't mass-upgrade — audit first.

## Execution convention

- **Subagent-driven development with Sonnet agents.** Implementer + reviewer subagents per task, full TDD loop. Plan A ran this way end-to-end and caught multiple real bugs (starter-curriculum interleaving deadlock, attempt-id collision, double-startSession data loss, CVE patches) via the review step.
- Fresh subagents carry zero session context, so the dispatcher provides complete task text and scene-setting each time. Don't tell the subagent to read the plan file — paste the relevant section into the prompt.
- Reviews are load-bearing, not ceremony. Don't skip them on "simple" tasks — the bugs hide there.

## Testing philosophy

- **Pure modules** (types, SRS math, scheduler, note math, YIN, degree mapping): full Vitest unit coverage. Test the math with synthetic input.
- **Persistence** (IndexedDB): Vitest + `fake-indexeddb` (auto-wired in `tests/helpers/test-setup.ts`).
- **Audio playback, mic input, ML inference**: NOT unit-tested. Covered by the dev harness (Plan B task 11) and a single Playwright smoke test (Plan B task 12). Do not chase 100% unit coverage of Web Audio — it's a mocking trap.

## When in doubt

The spec (`docs/specs/2026-04-14-ear-training-mvp-design.md`) is the source of truth for *what* and *why*. The plans are the source of truth for *how*. If an implementation decision isn't covered by either, stop and ask — don't guess.
