# Analysis Brief — Ear-Training Station Codebase Health

## Analysis Question

**What is the current health, correctness, and production-readiness of the ear-training-station PWA, built entirely via agentic development (Claude Code subagents across ~103 PRs), now that Plans A+B+C0+C1 are complete?**

Specifically: where does the codebase diverge from its own spec, what bugs exist that tests haven't caught, and what technical debt was introduced by agentic development patterns?

---

## Facts (Known Knowns)

- Plans A (core logic), B (audio I/O), C0 (integration seam), and C1 (UI + PWA) are all merged to `main`
- 103 PRs merged; 340 vitest tests pass; 14 Playwright e2e specs exist
- `pnpm run typecheck` exits 0 across all packages
- CLAUDE.md says "Plan C1 not yet written" — this is stale; C1 is complete
- 18/88 reviewed PRs (20%) required at least one REQUEST_CHANGES cycle
- 5 hard BLOCKERs were found by `julianken-bot` across the run
- PR #101 found three critical integration bugs that all tests missed (IDB Proxy serialization, refresh-abandon on first nav, broken happy path) — discovered only via Playwright MCP walkthrough
- The project is a dark-themed PWA for scale-degree ear training; core value prop is functional scale-degree hearing with cadence → sing → verify workflow

## Known Unknowns

- Whether the interleaving/Leitner scheduler is actually wired into the production path
- Whether the replay (You/Target/Both) feature is functional end-to-end
- How many AudioContext instances accumulate per session
- What portion of the Settings UI actually affects runtime behavior
- Whether the iOS Safari standalone dark-mode status bar is handled

## Suspected Unknowns

- Other places where Svelte 5 reactive Proxies cross IDB boundaries (PR #101 found one)
- Other places where `.catch(() => {})` or `void` async calls swallow errors
- Gaps in the SRS algorithm that diverge from the spec's pedagogical intent
- Whether CLAUDE.md's documented module surface paths still match the actual filesystem

---

## Domain Tags

| Domain | Reason |
|--------|--------|
| **Architecture** | Multi-package monorepo, module boundary correctness, cross-layer imports |
| **Testing** | 340 unit tests + E2E; PR #101 showed mock-vs-real gaps exist |
| **Performance** | Bundle budget, AudioContext lifecycle, GC pressure on audio thread |
| **UI/Visual** | SvelteKit UI, spec-mandated visual design (dark theme, split-stage, F2 panel) |
| **Developer Experience** | CLAUDE.md documentation, plan artifacts, agentic dev meta-patterns |

---

## Quality Criteria

| Criterion | Weight | Description |
|-----------|--------|-------------|
| Evidence strength | 25% | Every finding cites file path + line number |
| Completeness | 20% | Covers all 5 domains and the 6 non-negotiable design commitments |
| Accuracy | 20% | Claims are verifiable via `pnpm run typecheck` and `grep` |
| Actionability | 15% | Findings are specific enough to fix without re-investigation |
| Nuance | 10% | Distinguishes blockers from polish; rates confidence |
| Clarity | 10% | Organized for a developer audience ready to act on findings |

---

## Five Investigation Areas (Phase 1)

| Area | Domain | Focus |
|------|--------|-------|
| 1. Spec Compliance | UI/Visual + Architecture | Do the 6 non-negotiable design commitments hold? What's missing or deviated? |
| 2. Test Quality | Testing | Where do tests pass but real failures exist? Mock-vs-real gaps? |
| 3. Architecture Integrity | Architecture | Package boundaries, type safety, dead code, duplicated logic |
| 4. Silent Failures | Architecture + Testing | Error swallowing, void async, resource leaks, clock domain bugs |
| 5. Performance + PWA | Performance | Bundle size, AudioContext lifecycle, service worker, PWA gaps |

---

## Assumptions

- The spec at `docs/specs/2026-04-14-ear-training-mvp-design.md` is still the source of truth
- TypeScript strict mode is enforced (validated: `pnpm run typecheck` exits 0)
- The `julianken-bot` review history in GitHub PRs is a reliable signal of AI agent failure modes
- "Production-readiness" means: functional core value prop, no data-loss bugs, audio pipeline stable for a 30-round session
