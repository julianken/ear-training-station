## Diagrams

<!-- PRIMARY comprehension surface. Reviewers should be able to grasp the full
change from the diagram(s) alone — Summary and code diff are supporting context,
not the primary explanation.

Use ```mermaid fenced blocks (GitHub renders them inline). Good shapes: state
machines, component trees, sequence diagrams, data flows, navigation graphs,
cache strategies. Multiple diagrams are encouraged when the PR spans layers.

If the change genuinely cannot be diagrammed (one-line typo, dep bump,
comment-only), write: N/A — <reason>

```mermaid
sequenceDiagram
    participant UI as Session Screen
    participant Ctrl as Grading Controller
    participant Core as roundReducer

    UI->>Ctrl: cadence played
    Ctrl->>Core: CADENCE_STARTED
    UI->>Ctrl: target played
    Ctrl->>Core: TARGET_STARTED
    Ctrl->>Core: CAPTURE_COMPLETE (pitchGrade + digit)
    Core-->>Ctrl: state → graded
    Ctrl-->>UI: render F2 feedback panel
```
-->

## Summary

<!-- 1–3 bullets supporting the diagram(s) above. Lead with the *why* — the
diagram shows the *what*. -->

-
-

## Screenshots

<!-- REQUIRED when this PR adds or modifies visible UI (any .svelte file under
apps/**, CSS/tokens affecting rendering, any route). Otherwise write "N/A — not UI".

Headless workflow for subagent-generated PRs: capture via Playwright in the task's
e2e spec, save under docs/screenshots/c1-<N>/taskN-<slug>/<description>.png,
commit with the PR, then reference the file using an ABSOLUTE raw.githubusercontent
URL with the branch interpolated at PR-creation time. Relative paths like
../../docs/... do NOT work in PR bodies — GitHub resolves them against /pull/N/,
not the repo root (see github/markup#576). The raw URL form works for both
in-review PRs (pointing at the PR branch) and post-merge viewers.

Pattern (inside a subagent bash HEREDOC):

    BRANCH=$(git rev-parse --abbrev-ref HEAD)
    gh pr create --body "... ![feedback on pass](https://raw.githubusercontent.com/julianken/ear-training-station/$BRANCH/docs/screenshots/c1-3/task7-feedback-panel/pass-state.png) ..."

Human-authored PRs can drag-and-drop the image directly into the comment box —
GitHub uploads it and inserts a working link. -->

## Test plan

<!-- Checklist of the verifications you ran. Reviewers expect all boxes checked
on a ready-to-merge PR. -->

- [ ] `pnpm run typecheck && pnpm run test` — green
- [ ] New unit / component tests added (if behavior changed)
- [ ] New Playwright e2e spec added (if user-visible behavior changed)
- [ ] `pnpm run build` — clean production build
- [ ] (UI only) Manual smoke via `pnpm run dev` — feature works in the browser

## Plan reference

<!-- Link the execution plan and task this PR implements. For out-of-plan work,
write "Out of plan — <one-line reason>". -->

Part of Plan C1.<sub-plan>, Task <N>. See `docs/plans/<plan-file>.md`.

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)
