# Ear-Training App · MVP Design

**Date:** 2026-04-14
**Status:** Design draft — pending user review
**Companion docs:** [Research synthesis](../../research/2026-04-14-ear-training-research-synthesis.md)

---

## 1. Problem & Thesis

Existing ear-training apps produce quiz-fluency, not hearing-fluency. Users drill isolated intervals and chords for months and still can't transcribe a song they love. The research converges on *why*: decontextualized pitch drilling does not transfer to real musical tasks. Functional / scale-degree hearing does, especially when paired with vocalization and variable-context practice.

No existing app combines the four things the evidence says matter — functional hearing, sung response, context-varied audio, and an explicit bridge to real music. This product aims to build the foundational piece of that stack as a single well-designed exercise, and grow from there.

The long-term vision is a "drill + real-music transcription" dual-path app. The MVP is the drill half, done right: **one interactive exercise that you can feel working after two weeks.**

## 2. Users

**Primary:** Hobbyist instrumentalists (guitar, keys, bass) who want to play songs by ear. They have some music theory, have tried an ear-training app, and stalled on transfer.

**Secondary (v2+):** Producers, singer-songwriters, and more formal music students. Designed for, not optimized for.

**Explicitly out of scope:** Absolute-pitch aspirants, children (pre-teen), music-school exam cramming, classical conservatory use.

## 3. Pedagogical Commitments

The evidence (research synthesis §1) supports these design commitments. Non-negotiable for the MVP:

- **Functional primitive.** The unit of practice is a (scale-degree, key-quality) pair — "the 5 in C major," not "a perfect fifth." Every round establishes a tonic first.
- **Sing-and-verify.** Singing the target is a required response mode. Production closes a perception loop that pure recognition does not.
- **Variability by default.** Timbre, register, key, and cadence voicing vary across items. Timbre monoculture is the incumbent's biggest failure.
- **Interleaving + spaced repetition.** Items are never blocked by degree within a session. Review cadence follows a Leitner schedule.
- **Retrieval, not recognition.** The primary task is produce-then-identify, not click-the-right-button.
- **Honest feedback.** Per-degree mastery and per-key progress are shown as plain numbers. No XP. No streaks as the primary engagement engine (a streak counter is acceptable as a secondary chip).

## 4. Scope

### 4.1 In scope (MVP)

- **One exercise:** Functional scale-degree hearing with sung response.
- **Procedural audio generation.** Cadence + target note rendered client-side from sampled instruments.
- **Mic-based pitch detection** on sung response, mapped to scale degree in the current key.
- **Keyword-spotting** for digit labels ("one" through "seven").
- **Adaptive session scheduler.** Leitner SRS + interleaving, targeting missed items.
- **Offline-first** after initial load. Installable web app, native-feel UI on desktop and mobile.
- **Local persistence** of progress, sessions, and preferences (IndexedDB).
- **Five surfaces:** session screen, feedback state, dashboard, session summary, minimal onboarding.

### 4.2 Out of scope (deferred)

- User-uploaded audio / transcription workbench (v2 — the other half of the product thesis)
- Solfège mode (v2 — a toggle, not a separate app)
- Additional exercise types (phrase echo, tonic-finding, chord quality, bassline, cadence identification, chunks library)
- Cloud sync, accounts, social features, leaderboards
- Source separation
- Modal, chromatic, or jazz-extended content
- Language localization beyond English
- Accessibility beyond baseline (keyboard navigation, screen-reader labels) — full a11y is v2

### 4.3 Success criteria

MVP is done when:

1. A first-time user can open the URL, install the app, and start a session within 60 seconds.
2. A session runs a ~10-minute, ~30-item loop without errors, with pitch and label grading on every round.
3. The scheduler produces different item mixes across consecutive sessions (adaptive behavior is visible).
4. Progress persists across sessions and across reloads. Offline mode works after first load.
5. A musician using it 10 minutes/day for two weeks reports — subjectively — that their scale-degree hearing has improved on a real song.

Criterion 5 is the product-thesis test. Criteria 1–4 are functional. All five are the bar.

## 5. The Exercise Loop

### 5.1 A single round

A round takes 10–15 seconds. States:

| # | State | Duration | What the app does | What the user does |
|---|---|---|---|---|
| 1 | **Key setup** | 3 s | Plays I–IV–V–I cadence in current key, with visual chord blocks lighting up as each chord plays. | Listens. |
| 2 | **Target** | 1.5 s | Plays a single scale-degree tone in the cadence's key. | Listens; target number also shown visually. |
| 3 | **Capture** | ≤5 s | Opens mic; runs pitch detection and keyword-spotting in parallel. Pitch trace graph animates live. | Sings the pitch + says the digit ("five"). |
| 4 | **Grade** | <100 ms | Computes pitch correctness (accept any octave; ±50¢ of any octave of target) and label correctness. | Waits. |
| 5 | **Feedback** | 2–5 s | Shows result panel, updates pitch trace with target line, offers replay. | Reviews; taps Next (or waits for auto-advance on hits). |
| 6 | **Advance** | <100 ms | Scheduler picks next item. | — |

### 5.2 Session structure

- Default session = **30 items / ~10 minutes**. User can set a longer session in settings (future).
- Interleaving constraints:
  - No same scale degree back-to-back.
  - No same key for more than 3 consecutive rounds.
  - New keys (those not yet unlocked) are gated by prerequisite mastery.
- Each session ends with the **Session Summary** screen (see §9.5).

### 5.3 Variability axes

Each item is parameterized by:

- **Key** (12 keys × {major, minor})
- **Scale degree** (1 through 7; diatonic only in MVP)
- **Target register** (target note chosen within a comfortable vocal range; register widens as skill grows)
- **Cadence voicing** (root position MVP; inversions and alternate progressions in v2)
- **Timbre** (pool of ~4 sampled instruments — acoustic piano, electric piano, acoustic guitar, warm synth pad)
- **Cadence tempo** (small jitter ±10% from nominal 80 bpm)

Timbre and tempo vary within a session; key and register evolve across sessions as the learner progresses.

## 6. Adaptive Scoring & SRS

### 6.1 Item model

The training unit is an **item**: a `(scaleDegree, keyQuality)` pair — e.g., `(♭3, minor)` or `(5, major)`. With 7 degrees × 2 qualities = 14 items per key × 12 keys = 168 items total. MVP starts with 3 items (degrees 1, 3, 5 in C major) and unlocks gradually per §6.5.

Each item tracks:

- `box`: `{new, learning, reviewing, mastered}` — Leitner box.
- `accuracy.pitch`: rolling window (last 10 attempts), recency-weighted.
- `accuracy.label`: same, for digit labeling.
- `last_seen_at`, `due_at`: SRS scheduling.
- `consecutive_passes`: integer, resets on miss.
- `total_attempts`: integer.

### 6.2 Grading

A **pitch correct** is: detected pitch within ±50 cents of any octave of the target's frequency. Octave-invariant.

A **label correct** is: keyword-spotting top-1 match to the target digit, confidence ≥ 0.7.

An attempt is a **pass** iff both pitch and label are correct. Partial credit is recorded (one-of-two) but does not advance the Leitner box.

### 6.3 Leitner boxes

- **new** → item has been introduced but not yet attempted.
- **learning** → ≤2 consecutive passes.
- **reviewing** → 3+ consecutive passes.
- **mastered** → 6+ consecutive passes *and* ≥5 reviews with no miss over ≥7 days.

Promotion on 3 consecutive passes. Demotion by one box on any miss.

Review intervals:

| Box | Interval |
|---|---|
| new | immediate (same session) |
| learning | next session |
| reviewing | 2d → 5d → 10d |
| mastered | 21d |

### 6.4 Item selection within a session

- 70% weak-or-due items, 30% review of recently-mastered (keeps strong items warm).
- Interleaving hard constraints (above).
- New items enter the pool only when prerequisites are met (see §6.5).

### 6.5 Difficulty gating

The learner starts in **C major**, degrees {1, 3, 5} (tonic triad), singing target notes within a narrow vocal range. New content unlocks as follows:

1. Degrees 1, 3, 5 in C major, then add 2, 4, 6, 7.
2. Unlock next major key (G, then F, then D, A, B♭ — circle-of-fifths adjacent).
3. Expand target register (narrow → comfortable → full).
4. Introduce **minor keys** once the learner has 5+ mastered items in major keys.
5. Timbre variety expands from 1 to 4 instruments over first ~10 sessions.

Unlock criteria: an item-group (e.g., "all 7 degrees in C major") unlocks the next group when ≥70% of its items are in `reviewing` or `mastered`.

## 7. Visual Design

See mockups in `docs/mockups/`. Decisions locked:

- **Aesthetic:** dark, audio-app native. Background `#0a0a0a`. Primary accent `#22d3ee` (cyan) for reference/target data. Secondary accent `#fbbf24` (amber) for user/capture data. Greens `#22c55e` and reds `#ef4444` for pass/fail. Typography: Inter (UI), IBM Plex Mono / ui-monospace (numbers), Times New Roman italic (Roman-numeral chord labels only).
- **Session screen:** split-stage. Top zone = "what the app is doing" (cadence + target), bottom zone = "what you are doing" (pitch trace + result). Active zone is highlighted by border color; stage label text indicates `LISTENING` (cyan) or `CAPTURING` (amber).
- **Audio visualization during capture:** scrolling pitch-trace graph. Y-axis = scale degree (1–7); x-axis = time (last ~3 s). Target degree highlighted as a tolerance band (`±50¢`). Sung pitch drawn as a live amber line; "now" indicator pulses at the right edge. Cents and Hz readouts live-update.
- **Feedback state:** result panel with separate ✓/✗ for pitch and label; cents deviation; plain-English "what target was" line; optional function tooltip (e.g., "5 resolves down to 1").
- **Replay:** single play-bar with segmented-toggle source selector — **You / Target / Both**. One progress bar, one speed toggle (1× / ½×). Keyboard shortcuts: 1/2/3 to switch source, Space to play/pause.
- **Dashboard (home):** "cockpit" — scale-degree mastery bars (top-left), key heatmap 6×2 major (top-right), Leitner pipeline counts (middle, span-2), large start-CTA (bottom, span-2). Streak chip in top-right; total-time chip beside it.
- **Session summary:** "report card" — three big stats (pitch %, label %, streak), degree-by-degree deltas with before/after bars, "tomorrow's focus" highlight box, Done button.
- **Onboarding:** flow is specified in §9.1 (welcome → mic permission → concept intro → first round). Visual polish of onboarding is deferred — no mockups produced during brainstorming.

### 7.1 Responsive behavior

- **Desktop (≥ 900px wide):** single-column session centered at ~480px wide with generous vertical space; dashboard uses the 2-column grid shown in mockups.
- **Mobile (≤ 600px wide):** session screen is full-viewport; dashboard cockpit cards stack vertically; start-CTA becomes a sticky bottom bar.
- **Tablet:** desktop layout with adjusted padding.

### 7.2 Accessibility baseline

- Keyboard-first: every interactive element is focusable and operable via keyboard. Space/Enter for primary actions; digit keys 1–7 for tap-pad input.
- Screen-reader labels on every control.
- Color is never the only signal: ✓/✗ icons accompany green/red states.
- Respects `prefers-reduced-motion`: pitch trace still shows current value but no scrolling animation.
- Full WCAG-AA compliance is v2.

## 8. Technical Architecture

### 8.1 Stack

- **Build:** Vite + TypeScript (strict).
- **UI framework:** Svelte 5.
- **Audio engine:** Tone.js on Web Audio API.
- **Sampling:** SFZ-free custom sampler — bundled AIFF/WAV samples at a few pitches per instrument (3–5 samples × 4 instruments ≈ 8–15 MB total), pitch-shifted in playback.
- **Pitch detection:** AudioWorklet running YIN algorithm, implemented as a small TypeScript/WASM module (~5 KB). `pitchfinder` is an acceptable fallback during prototyping.
- **Speech (keyword-spotting):** TensorFlow.js + a small digit-recognition model derived from Google Speech Commands. Target size ≤1 MB after quantization.
- **Persistence:** IndexedDB via `idb` (Jake Archibald's wrapper) for type-safe access.
- **Service worker:** Workbox-generated. Precache app shell, samples, and ML model.
- **Hosting:** Static. Cloudflare Pages first choice; Netlify/Vercel acceptable alternatives. No server.

### 8.2 Module layout

```
src/
  audio/
    sampler.ts          # Tone.js sampler wrapper
    cadence.ts          # cadence voicings, tempo jitter
    generator.ts        # round-level: cadence + target
  pitch/
    yin-worklet.ts      # AudioWorklet processor
    pitch-detector.ts   # main-thread facade
    degree-mapping.ts   # hz → scale degree in key
  speech/
    kws-model.ts        # TF.js model loader
    keyword-spotter.ts  # mic capture + classification
    model/              # model assets (quantized)
  scheduler/
    item.ts             # Item type + Leitner math
    scheduler.ts        # select-next-item, interleaving
    unlock.ts           # curriculum gating
  store/
    db.ts               # IndexedDB schema + migrations
    items-repo.ts
    sessions-repo.ts
    settings-repo.ts
  session/
    session-machine.ts  # xstate or hand-rolled state machine
    round.ts            # a single round (cadence→target→capture→grade)
  ui/
    SessionView.svelte
    FeedbackPanel.svelte
    PitchTrace.svelte
    ReplayBar.svelte
    Dashboard.svelte
    SessionSummary.svelte
    Onboarding.svelte
  sw.ts                 # service worker (Workbox)
  app.ts                # entry
```

### 8.3 Module boundaries & contracts

- `audio/*` knows nothing about scoring, scale degrees, or user state. It renders sounds on request. Input: `{ kind: 'cadence' | 'note', key, degree, timbre, tempo }`. Output: audio playback + a "done" event.
- `pitch/*` is pure capture + detection. Output: stream of `{ time, hz, confidence }` frames. `degree-mapping` is the boundary that converts hz to scale degree given the current key context.
- `speech/*` is pure: input = audio buffer, output = `{ digit: 1..7 | null, confidence }`.
- `scheduler/*` is the only module that knows the Leitner math. Input: list of items, history, current session state. Output: next item to present, plus unlock events.
- `store/*` is the only module that touches IndexedDB. Other modules accept repository interfaces.
- `session/*` orchestrates. It asks `scheduler` for items, tells `audio` to play them, awaits `pitch` + `speech` results, grades them, tells `store` to update, and drives the UI state.
- `ui/*` is presentation. Components subscribe to session state and render; they do not contain game logic.

### 8.4 PWA behavior

- **First load:** downloads app shell (~200 KB gzipped Svelte bundle), instrument samples (~10 MB), KWS model (~1 MB), Workbox service worker. Shows progress.
- **Subsequent loads:** everything served from cache; offline-capable.
- **Update flow:** new service worker installs in background on next visit; user is prompted to reload on "update ready" event.
- **Install prompt:** A2HS (Add to Home Screen) prompt shown after 2nd session completion. Not before.

## 9. Screen-by-screen Specification

### 9.1 Onboarding (minimal)

1. **Welcome.** One sentence: "Ear training that uses your voice." Continue button.
2. **Mic permission.** Explains why ("we grade your singing; audio never leaves this device in MVP"). Requests `getUserMedia`.
3. **Concept intro (30 s).** Plays a cadence, then "this is the 1, this is the 5, this is what you'll learn to hear." Optional, skippable.
4. **First round.** Uses a gentle warmup item (degree 5 in C major; well-known "happy" note).

Not included: account creation, preferences, goal-setting. These are v2.

### 9.2 Session screen

Matches L2 split-stage. See §7. States:

- `LISTENING` — cadence playing, target not yet played. Top zone highlighted cyan.
- `TARGET` — target note playing. Top zone still cyan; target number animates in.
- `CAPTURING` — mic open, pitch trace drawing live. Bottom zone highlighted amber.
- `GRADING` — brief transition; pitch trace freezes, target line appears.
- `FEEDBACK` — result panel shown (§9.3).

Top bar: current key chip · session progress chip (`12 / 30`).
Bottom bar: hidden during active round; keyboard-shortcut hints appear in feedback state.

### 9.3 Feedback state

Appears after grading. Elements:

- Pitch trace graph (frozen), with user's trace + target line + tolerance band.
- Result panel: ✓/✗ × {pitch, label}, with cents deviation (pitch) and detected digit (label).
- Plain-English answer line: "Target was 5 · G — you sang 6 · A, one scale degree higher."
- Optional function tooltip (toggleable in settings; default ON): "The 5 resolves down to 1; the 6 wants to resolve down to 5."
- Replay bar: segmented-toggle (You/Target/Both) + play/pause + progress + 1×/½× speed.
- Keyboard shortcuts: Space (play), 1/2/3 (source), Enter (next).

On **hit:** auto-advance in 1.5 s. Replay bar collapsed by default; clickable to expand.
On **miss:** no auto-advance. User must press Enter / tap Next.

### 9.4 Dashboard (home)

Matches V2 cockpit. Cards:

1. **Scale-degree mastery** (top-left). 7 rows, one per degree, with accuracy bar + percentage. Color per Leitner box.
2. **Keys** (top-right). 6×2 grid for 12 major keys (minor grid appears once unlocked). Each cell colored by item-group mastery; locked cells dimmed.
3. **Spaced-review pipeline** (middle, span-2). Four boxes: New / Learning / Reviewing / Mastered, with counts.
4. **Start session** (bottom, span-2). Large CTA. Sub-line shows session focus and estimated length.

Top bar: app logo · streak chip · total-time chip. Bottom: (none — CTA is the action).

### 9.5 Session summary

Matches S1 report card.

1. "Done." header + session meta (`11:23 · 30 items · C & G major`).
2. Three big stats: Pitch X/30, Label X/30, Streak X days.
3. "Movement by degree" card: per-degree bars with before (dim) / after (colored) + delta percentage.
4. "Tomorrow's focus" highlight box.
5. Bottom actions: `Dashboard` (secondary) · `Done` (primary).

### 9.6 Settings (minimal, accessible from dashboard)

- Toggle: function tooltip on feedback ("The 5 resolves down to 1…") — default ON.
- Toggle: auto-advance on correct — default ON.
- Slider: session length (20 / 30 / 45 items) — default 30.
- Toggle: reduced motion — default follows OS.
- Button: reset progress (with confirmation).

Not in MVP settings: account, sync, notifications, email, sound pack selection.

## 10. Data Model

```typescript
// Item (per scale-degree × key)
interface Item {
  id: string;                    // e.g. "5-Cmaj"
  degree: 1|2|3|4|5|6|7;         // MVP: no accidentals
  key: { tonic: PitchClass; quality: 'major'|'minor' };
  box: 'new'|'learning'|'reviewing'|'mastered';
  accuracy: { pitch: number; label: number };   // 0..1, rolling
  attempts: number;
  consecutive_passes: number;
  last_seen_at: number;          // unix ms
  due_at: number;
  created_at: number;
}

// Attempt (one round)
interface Attempt {
  id: string;
  item_id: string;
  session_id: string;
  at: number;
  target: { hz: number; degree: number };
  sung: { hz: number | null; cents_off: number | null; confidence: number };
  spoken: { digit: number | null; confidence: number };
  graded: { pitch: boolean; label: boolean; pass: boolean };
  timbre: string;
  register: 'narrow'|'comfortable'|'wide';
}

// Session
interface Session {
  id: string;
  started_at: number;
  ended_at: number | null;
  target_items: number;          // e.g. 30
  completed_items: number;
  pitch_pass_count: number;
  label_pass_count: number;
  focus_item_id: string | null;  // "tomorrow's focus" highlight
}

// Settings
interface Settings {
  function_tooltip: boolean;
  auto_advance_on_hit: boolean;
  session_length: 20|30|45;
  reduced_motion: 'auto'|'on'|'off';
}
```

IndexedDB stores: `items`, `attempts`, `sessions`, `settings` (single row).

## 10.1 Edge cases & error handling

- **Mic permission denied.** Show a graceful explainer screen with a "grant mic access" retry button and instructions per-browser. Do not start a session without mic; session requires both pitch and label detection.
- **KWS model fails to load.** Fall back to pitch-only grading for the current session; show a small banner "voice recognition unavailable — pitch still graded." Retry on next launch.
- **Pitch detection returns null for full capture window.** Record attempt as a miss on pitch; label is still graded. Do not penalize via Leitner demotion if ≥3 consecutive null-pitch captures occur in a session (likely mic issue); prompt the user to check mic.
- **Item pool exhausted mid-session.** If all unlocked items are `mastered` and not yet due, fill the remaining session with the next-smallest unlocked group's items (accelerate unlock). Should only happen in late-stage sessions.
- **User closes the tab mid-round.** Session is saved as abandoned; on next open, offer to resume. Partial attempts are not graded.
- **Clock skew.** All `due_at` / `last_seen_at` comparisons use the device clock. If the device clock moves backward by >1 hour, re-anchor SRS intervals to the most recent session's timestamp.

## 11. Open Questions & Risks

### 11.1 Pedagogical / product risks

- **Does the product hypothesis hold?** Research says functional + sing-and-verify should transfer. We won't know for this specific app until we can measure it. Success criterion #5 is the first test; a lightweight transcription-test mode (v2) will give us cleaner evidence.
- **Is singing a blocker for enough users to hurt adoption?** Some hobbyists will resist singing. MVP doesn't ship a tap-only mode, but we may need it as a fallback.
- **Keyword-spotting accuracy on singing-voices vs. speaking-voices.** Speech Commands dataset is speaking voices. Singing "five" is acoustically different. We may need to gather a small custom dataset or shift to simpler number-detection heuristics (energy + formant + digit-duration).

### 11.2 Technical risks

- **Sampler quality vs. bundle size.** Good-sounding piano via samples costs bytes. Prototype with Salamander (free, well-regarded) and measure.
- **YIN on mobile Safari AudioWorklet.** AudioWorklet support is broad now but historically flaky on iOS. Need early device testing.
- **Service worker + CORS + cross-origin audio assets.** Keep all assets same-origin.
- **IndexedDB quota on mobile.** 10 MB of samples + 1 MB model is well within typical quotas, but worth monitoring.

### 11.3 Design questions (resolvable before build)

- **Exactly which 4 timbres to bundle for MVP?** Working assumption: Salamander grand piano; Fender Rhodes-style EP; acoustic nylon guitar; a warm synth pad. To confirm during sample curation.
- **Minor-key cadence voicing.** i–iv–V–i vs. i–iv–V7–i. Pick one per MVP.
- **"Function tooltip" copy.** One-line explanations per (degree, quality) pair. Need a small content table.

### 11.4 Operational questions (deferrable)

- Hosting, DNS, domain name, and branding (project codename "Eartrain" in mockups is placeholder).
- Analytics in MVP: none. Local-only telemetry.
- Privacy posture: audio never leaves the device in MVP. If we later add telemetry or cloud sync, we require opt-in and an explicit privacy note.

## 12. What "Done" Looks Like

When all five success criteria in §4.3 pass, and the design doc-to-code trace is clean:

- Every module described in §8.2 exists with tests.
- Every screen in §9 is implemented and responsive per §7.1.
- PWA installs offline and runs through a complete session without internet.
- At least one musician (non-author) uses the MVP for two weeks and reports subjective improvement on a real song.

## 13. Appendix: References

- Research synthesis: `docs/research/2026-04-14-ear-training-research-synthesis.md`
- Visual mockups: `docs/mockups/`
  - `aesthetic-direction.html` — aesthetic decision (D)
  - `session-layout.html` + `l2-variations.html` — session-screen decision (L2 + V2 cadence-visible)
  - `audio-viz.html` — capture visualization (R1 pitch trace)
  - `grading-feedback.html` + `f2-with-replay-v2.html` — feedback state (F2 + segmented replay)
  - `dashboard.html` — home screen (V2 cockpit)
  - `session-summary.html` — end-of-session (S1 report card)
