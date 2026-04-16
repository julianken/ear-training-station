# GitHub Actions CI Design

**Date:** 2026-04-16
**Status:** Draft
**Scope:** CI workflows, ESLint configuration, Dependabot, GitHub repo settings

## Purpose

Enable automated quality gates for the ear-training-station monorepo. Every PR to `main` must pass typecheck, unit tests, build, lint, e2e, and security scanning before merge. Bundle size is reported for visibility. Dependencies are kept current via Dependabot.

## Deliverables

Six workflow files, one Dependabot config, ESLint configuration, and GitHub repo settings.

### 1. `.github/workflows/ci.yml` — Fast checks

**Triggers:** push to `main`, PRs to `main`
**Concurrency:** `ci-${{ github.ref }}`, cancel-in-progress
**Timeout:** 10 minutes

Single job with sequential steps:

1. Checkout
2. `pnpm/action-setup@v4` (reads `packageManager` from `package.json`)
3. `actions/setup-node@v4` with `node-version: 22`, `cache: 'pnpm'`
4. `pnpm install --frozen-lockfile`
5. `pnpm run typecheck`
6. `pnpm run test`
7. `pnpm run build`

**Rationale for single job:** These three checks total ~60-90s. Splitting into parallel jobs would add ~30s of pnpm install overhead per job, making total wall time worse.

### 2. `.github/workflows/ci-lint.yml` — ESLint

**Triggers:** push to `main`, PRs to `main`
**Concurrency:** `lint-${{ github.ref }}`, cancel-in-progress
**Timeout:** 10 minutes

Steps: checkout, pnpm setup, `pnpm run lint`.

**Rationale for separate workflow:** ESLint is being added fresh to this project. Isolating it means initial lint failures (if any) don't block the established typecheck/test/build pipeline. Can be merged into `ci.yml` later once lint is clean and stable.

### 3. `.github/workflows/e2e.yml` — Playwright (sharded)

**Triggers:** PRs to `main` only (opened, synchronize, ready_for_review)
**Skips:** draft PRs (via `if: github.event.pull_request.draft == false`)
**Concurrency:** `e2e-${{ github.ref }}`, cancel-in-progress
**Timeout:** 15 minutes

**Matrix:** 4 shards (`shardIndex: [1, 2, 3, 4]`, `shardTotal: [4]`)

Steps per shard:

1. Checkout
2. pnpm + Node setup with cache
3. `pnpm install --frozen-lockfile`
4. `pnpm exec playwright install chromium --with-deps`
5. `pnpm --filter ear-training-station test:e2e --shard=${{ matrix.shardIndex }}/${{ matrix.shardTotal }}`
6. Upload `playwright-report` artifact on failure (7-day retention)

**No explicit build step:** Playwright's `webServer.command` in the config already starts `pnpm run dev` (Vite dev server) before running tests. The dev server starts fast and serves the app. A separate `pnpm run build` is unnecessary here — bundle correctness is already validated by `ci.yml` and `bundle-size.yml`.

**Not triggered on push to main:** With one developer, running e2e on every main push is redundant — the PR already gated it.

### 4. `.github/workflows/bundle-size.yml` — Size reporting

**Triggers:** PRs to `main` only
**Concurrency:** `bundle-${{ github.ref }}`, cancel-in-progress
**Timeout:** 10 minutes

Steps:

1. Checkout
2. pnpm + Node setup with cache
3. `pnpm install --frozen-lockfile`
4. `pnpm run build 2>&1 | tee build-output.txt`
5. Parse Vite's size output and write to `$GITHUB_STEP_SUMMARY`

The summary format will show a table of chunk names and sizes (gzipped) extracted from Vite's build output. No external dependencies — just shell parsing.

### 5. `.github/workflows/codeql.yml` — Security scanning

**Triggers:** weekly schedule (Mondays 04:00 UTC), PRs to `main`, manual `workflow_dispatch`
**Timeout:** 15 minutes
**Permissions:** `security-events: write`, `contents: read`

Steps:

1. Checkout
2. `github/codeql-action/init@v3` with `languages: javascript-typescript`
3. `github/codeql-action/analyze@v3`

### 6. `.github/dependabot.yml` — Dependency updates

```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    groups:
      testing:
        patterns: ["vitest", "@vitest/*", "@playwright/*", "playwright"]
      svelte:
        patterns: ["svelte", "svelte-*", "@sveltejs/*", "vite", "@sveltejs/vite-*"]
      tensorflow:
        patterns: ["@tensorflow/*", "@tensorflow-models/*"]
      eslint:
        patterns: ["eslint", "eslint-*", "typescript-eslint", "@eslint/*"]
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "monthly"
```

### 7. ESLint configuration

**New file:** `eslint.config.mjs` at repo root (flat config format).

**Plugins:**
- `typescript-eslint` — type-aware linting for all `.ts` files across all packages
- `eslint-plugin-svelte` — Svelte component linting (ready for C1, no `.svelte` files exist yet)

**Ignores:** `node_modules`, `dist`, `.svelte-kit`, `*.js` in root (config files)

**New dev dependencies (root):**
- `eslint`
- `typescript-eslint`
- `eslint-plugin-svelte`
- `globals`

**New script (root `package.json`):**
- `"lint": "eslint ."`

**Design choice:** Single config at root rather than per-package configs. The monorepo is small enough that one config handles everything. The Svelte plugin only activates on `.svelte` files, so it's harmless in non-Svelte packages.

### 8. `package.json` updates

- Add `"packageManager": "pnpm@9.15.9"` — enables `pnpm/action-setup@v4` auto-detection
- Add `"lint"` script (see above)

### 9. GitHub repo settings (via Playwright MCP)

**Enable GitHub Actions** on `julianken/ear-training-station` if not already enabled.

**Branch protection on `main`:**
- Require status checks to pass before merging:
  - `check` (from `ci.yml`)
  - `lint` (from `ci-lint.yml`)
  - `e2e (1)`, `e2e (2)`, `e2e (3)`, `e2e (4)` (from `e2e.yml` matrix)
  - `bundle-size` (from `bundle-size.yml`)
  - `codeql` (from `codeql.yml`)
- Require branches to be up to date before merging

**Note:** Status check names must match the `jobs.<id>` names in the workflow files. The exact names will be confirmed after the first CI run.

## Execution approach

Subagent-driven development with Sonnet implementers. Each task lands as a branch + PR. The `julianken-bot` subagent reviews each PR. No PR merges until all CI checks pass (once the workflows exist and branch protection is configured).

**Ordering constraint:** The workflow files and ESLint config must land on `main` before branch protection rules can reference the check names. So:

1. First PR: all workflow files + ESLint config + `package.json` changes (this establishes the checks)
2. GitHub repo settings configured after first PR merges and checks are visible
3. Subsequent PRs are gated by the new branch protection rules

**Alternative ordering:** Land workflows in a single PR without branch protection first. Once merged, the checks run on subsequent PRs. Then configure branch protection using the now-visible check names.

## What this does NOT include

- Lighthouse CI (no deployed URL)
- Coverage upload/thresholds (can add later)
- Renovate (starting with Dependabot, simpler)
- npm publishing workflows (all packages are private)
- Matrix Node versions (single developer, Node 22 LTS is sufficient)
