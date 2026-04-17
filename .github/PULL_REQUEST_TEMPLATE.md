## Summary

<!-- 1–3 bullets. What changes, why, and what it unlocks. Lead with the "why" when
the "what" is obvious from the diff. -->

-
-

## Screenshots

<!-- REQUIRED when this PR adds or modifies visible UI (any .svelte file under
apps/**, CSS/tokens affecting rendering, any route). Otherwise write "N/A — not UI".

Headless workflow for subagent-generated PRs: capture via Playwright in the task's
e2e spec, save under docs/screenshots/c1-<N>/taskN-<slug>/<description>.png,
commit with the PR, reference here with a relative markdown image link:

    ![feedback panel on pass](../../docs/screenshots/c1-3/task7-feedback-panel/pass-state.png)

Human-authored PRs can use GitHub's drag-and-drop. -->

## Diagrams

<!-- Optional. Use a ```mermaid fenced block when a diagram clarifies the change
more than prose would. GitHub renders mermaid inline. Good candidates:
component trees, state machines, data flows, navigation graphs, cache strategies.
Delete this whole section when not applicable.

```mermaid
flowchart LR
    A --> B
```
-->

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
