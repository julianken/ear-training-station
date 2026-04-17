# GitHub Actions CI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automated quality gates for the ear-training-station monorepo — typecheck, unit tests, build, lint, e2e, security scanning, bundle size reporting, and dependency updates.

**Architecture:** Six GitHub Actions workflow files, one Dependabot config, ESLint configuration added to the project, and GitHub branch protection configured via UI. Each task is a separate PR. Task 1 bootstraps CI; subsequent PRs benefit from its checks.

**Tech Stack:** GitHub Actions, pnpm/action-setup@v4, actions/setup-node@v4, ESLint 10 (flat config), typescript-eslint, eslint-plugin-svelte, Playwright sharding, CodeQL, Dependabot.

**Spec:** `docs/specs/2026-04-16-github-actions-ci-design.md`

---

## File Map

**Create:**
- `.github/workflows/ci.yml` — typecheck + test + build (Task 1)
- `.github/workflows/ci-lint.yml` — ESLint (Task 2)
- `eslint.config.mjs` — ESLint flat config (Task 2)
- `.github/workflows/e2e.yml` — Playwright sharded (Task 3)
- `.github/workflows/bundle-size.yml` — Vite bundle report (Task 4)
- `.github/workflows/codeql.yml` — security scanning (Task 5)
- `.github/dependabot.yml` — dependency updates (Task 5)

**Modify:**
- `package.json` — add `packageManager` field (Task 1), add `lint` script (Task 2)

---

## Task ordering and dependencies

```
Task 1 (core CI) ──► Task 2 (ESLint) ──► Task 3 (e2e) ──► Task 4 (bundle size) ──► Task 5 (CodeQL + Dependabot) ──► Task 6 (GitHub settings)
```

Each task is one PR. Tasks 2-5 are independent in principle but run sequentially so each PR benefits from the checks established by prior PRs. Task 6 is manual (Playwright MCP) and runs after all workflows are on `main`.

---

### Task 1: Core CI workflow + package.json updates

**Branch:** `ci/core-checks`

**Files:**
- Create: `.github/workflows/ci.yml`
- Modify: `package.json`

- [ ] **Step 1: Create the `.github/workflows` directory and `ci.yml`**

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  check:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile

      - name: Typecheck
        run: pnpm run typecheck

      - name: Unit tests
        run: pnpm run test

      - name: Build
        run: pnpm run build
```

- [ ] **Step 2: Add `packageManager` field to root `package.json`**

Add `"packageManager": "pnpm@9.15.9"` to the root `package.json`. This field goes at the top level (sibling of `name`, `private`, etc.). This enables `pnpm/action-setup@v4` to auto-detect the pnpm version without an explicit `version` input.

The resulting `package.json` should look like:

```json
{
  "name": "ear-training-monorepo",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@9.15.9",
  "scripts": {
    "dev": "pnpm --filter ear-training-station dev",
    "build": "pnpm --filter ear-training-station build",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "pnpm -r run typecheck",
    "test:e2e": "pnpm --filter ear-training-station test:e2e"
  },
  "devDependencies": {
    "@types/node": "22.9.0",
    "@vitest/ui": "3.2.4",
    "jsdom": "25.0.1",
    "typescript": "5.6.2",
    "vitest": "3.2.4"
  },
  "pnpm": {
    "onlyBuiltDependencies": ["esbuild"]
  }
}
```

- [ ] **Step 3: Verify locally**

Run: `pnpm run typecheck && pnpm run test && pnpm run build`

Expected: all three pass (221 tests, clean build).

- [ ] **Step 4: Commit and push**

```bash
git checkout -b ci/core-checks
git add .github/workflows/ci.yml package.json
git commit -m "ci: add core CI workflow (typecheck + test + build)"
git push -u origin ci/core-checks
```

- [ ] **Step 5: Open PR**

```bash
gh pr create --title "ci: add core CI workflow" --body "$(cat <<'EOF'
## Diagrams

<!-- Replace with a mermaid block (```mermaid fenced) showing the primary change.
If the change genuinely cannot be diagrammed, write `N/A — <reason>`. -->

## Summary
- Adds `.github/workflows/ci.yml` — runs typecheck, unit tests, and build on push to main and PRs
- Adds `packageManager` field to root `package.json` for pnpm version pinning in CI
- Concurrency control cancels stale runs on the same branch

## Test plan
- [ ] CI workflow runs on this PR and passes
- [ ] typecheck, test, and build steps all green

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

### Task 2: ESLint setup + lint workflow

**Branch:** `ci/eslint`

**Files:**
- Create: `eslint.config.mjs`
- Create: `.github/workflows/ci-lint.yml`
- Modify: `package.json` (add `lint` script + ESLint dev dependencies)

- [ ] **Step 1: Install ESLint dependencies**

```bash
pnpm add -Dw eslint typescript-eslint eslint-plugin-svelte globals
```

This adds four dev dependencies to the root `package.json`. The `-w` flag targets the workspace root.

- [ ] **Step 2: Create `eslint.config.mjs`**

```javascript
// eslint.config.mjs
import tseslint from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';

export default tseslint.config(
  // Global ignores
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.svelte-kit/**',
      'apps/ear-training-station/harness/**',
    ],
  },

  // Base TypeScript config for all .ts files
  ...tseslint.configs.recommended,

  // Svelte support (activates only on .svelte files)
  ...svelte.configs['flat/recommended'],

  // Svelte + TypeScript integration
  {
    files: ['**/*.svelte'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
      },
    },
  },

  // Browser globals for app and web-platform
  {
    files: [
      'apps/**/*.ts',
      'apps/**/*.svelte',
      'packages/web-platform/**/*.ts',
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },

  // Node globals for config files and tokens
  {
    files: [
      '*.config.*',
      'packages/ui-tokens/**/*.ts',
    ],
    languageOptions: {
      globals: globals.node,
    },
  },
);
```

- [ ] **Step 3: Add `lint` script to root `package.json`**

Add `"lint": "eslint ."` to the `scripts` section of `package.json`.

- [ ] **Step 4: Run lint and fix any errors**

Run: `pnpm run lint`

If there are lint errors, fix them. Common issues with a fresh ESLint setup on an existing codebase:
- Unused variables (especially in test files) — fix by removing or prefixing with `_`
- Missing return types — not enforced by `recommended`, so unlikely
- `@typescript-eslint/no-explicit-any` — fix by adding proper types or using `unknown`

Do NOT disable rules to make lint pass. Fix the code. If a rule is genuinely wrong for this codebase, add a targeted override in `eslint.config.mjs` with a comment explaining why.

After fixing, run `pnpm run lint` again. Expected: `0 errors, 0 warnings` (or only warnings if some are acceptable).

Also verify existing checks still pass: `pnpm run typecheck && pnpm run test`

- [ ] **Step 5: Create `.github/workflows/ci-lint.yml`**

```yaml
# .github/workflows/ci-lint.yml
name: Lint

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

concurrency:
  group: lint-${{ github.ref }}
  cancel-in-progress: true

jobs:
  lint:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile

      - name: ESLint
        run: pnpm run lint
```

- [ ] **Step 6: Commit and push**

```bash
git checkout -b ci/eslint
git add eslint.config.mjs .github/workflows/ci-lint.yml package.json pnpm-lock.yaml
```

If any source files were fixed for lint errors, add those too:
```bash
git add -u
```

```bash
git commit -m "ci: add ESLint config and lint workflow"
git push -u origin ci/eslint
```

- [ ] **Step 7: Open PR**

```bash
gh pr create --title "ci: add ESLint config and lint workflow" --body "$(cat <<'EOF'
## Diagrams

<!-- Replace with a mermaid block (```mermaid fenced) showing the primary change.
If the change genuinely cannot be diagrammed, write `N/A — <reason>`. -->

## Summary
- Adds `eslint.config.mjs` — flat config with typescript-eslint + eslint-plugin-svelte
- Adds `.github/workflows/ci-lint.yml` — runs `pnpm lint` on push/PR to main
- Adds ESLint dev dependencies and `lint` script to root package.json
- Fixes any existing lint violations

## Test plan
- [ ] `pnpm run lint` passes locally with zero errors
- [ ] CI lint workflow runs on this PR and passes
- [ ] Existing typecheck and tests unaffected

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

### Task 3: E2E workflow (sharded Playwright)

**Branch:** `ci/e2e`

**Files:**
- Create: `.github/workflows/e2e.yml`

- [ ] **Step 1: Create `.github/workflows/e2e.yml`**

```yaml
# .github/workflows/e2e.yml
name: E2E

on:
  pull_request:
    branches: [main]
    types: [opened, synchronize, ready_for_review]

concurrency:
  group: e2e-${{ github.ref }}
  cancel-in-progress: true

jobs:
  e2e:
    if: github.event.pull_request.draft == false
    runs-on: ubuntu-latest
    timeout-minutes: 15
    strategy:
      fail-fast: false
      matrix:
        shardIndex: [1, 2, 3, 4]
        shardTotal: [4]
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile

      - name: Install Playwright browsers
        run: pnpm exec playwright install chromium --with-deps

      - name: Run e2e tests (shard ${{ matrix.shardIndex }}/${{ matrix.shardTotal }})
        run: pnpm --filter ear-training-station test:e2e -- --shard=${{ matrix.shardIndex }}/${{ matrix.shardTotal }}

      - name: Upload Playwright report
        uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report-shard-${{ matrix.shardIndex }}
          path: apps/ear-training-station/test-results/
          retention-days: 7
```

Key design choices:
- `fail-fast: false` — all shards run to completion even if one fails (useful for seeing the full failure picture)
- `types: [opened, synchronize, ready_for_review]` — runs on new PRs, updated PRs, and when a draft is marked ready
- Draft PRs are skipped via the `if` condition
- Only Chromium is installed (not all browsers) — sufficient for smoke testing
- Artifacts upload only on failure to save storage

- [ ] **Step 2: Verify the Playwright test runs locally**

Run: `pnpm --filter ear-training-station test:e2e -- --shard=1/4`

Expected: the one existing smoke test runs in one shard, the other three shards report 0 tests (which is a pass).

- [ ] **Step 3: Commit and push**

```bash
git checkout -b ci/e2e
git add .github/workflows/e2e.yml
git commit -m "ci: add sharded Playwright e2e workflow"
git push -u origin ci/e2e
```

- [ ] **Step 4: Open PR**

```bash
gh pr create --title "ci: add sharded Playwright e2e workflow" --body "$(cat <<'EOF'
## Diagrams

<!-- Replace with a mermaid block (```mermaid fenced) showing the primary change.
If the change genuinely cannot be diagrammed, write `N/A — <reason>`. -->

## Summary
- Adds `.github/workflows/e2e.yml` — 4-shard Playwright matrix on PRs to main
- Skips draft PRs, uploads test artifacts on failure
- Prepares for e2e test suite growth in Plan C1

## Test plan
- [ ] E2E workflow runs on this PR (4 shards, 1 test distributed across them)
- [ ] All shards pass (empty shards exit cleanly)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

### Task 4: Bundle size workflow

**Branch:** `ci/bundle-size`

**Files:**
- Create: `.github/workflows/bundle-size.yml`

- [ ] **Step 1: Create `.github/workflows/bundle-size.yml`**

```yaml
# .github/workflows/bundle-size.yml
name: Bundle Size

on:
  pull_request:
    branches: [main]

concurrency:
  group: bundle-${{ github.ref }}
  cancel-in-progress: true

jobs:
  bundle-size:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile

      - name: Build and capture output
        run: pnpm run build 2>&1 | tee build-output.txt

      - name: Report bundle size
        run: |
          echo "## Bundle Size Report" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "| File | Size | Gzip |" >> $GITHUB_STEP_SUMMARY
          echo "|------|------|------|" >> $GITHUB_STEP_SUMMARY
          grep -E "^\s*dist/" build-output.txt | while IFS= read -r line; do
            file=$(echo "$line" | awk '{print $1}')
            size=$(echo "$line" | awk '{print $2, $3}')
            gzip=$(echo "$line" | awk -F'gzip: ' '{print $2}')
            echo "| \`$file\` | $size | $gzip |" >> $GITHUB_STEP_SUMMARY
          done
```

The shell parsing works as follows:
- `tee build-output.txt` saves Vite's build output while also printing it to stdout
- `grep -E "^\s*dist/"` matches Vite's per-file output lines (e.g., `dist/assets/index-abc123.js  0.76 kB │ gzip: 0.43 kB`)
- `awk` extracts the filename (field 1), raw size (fields 2-3), and gzip size (everything after `gzip: `)
- The result is a markdown table written to `$GITHUB_STEP_SUMMARY`, which GitHub renders in the Actions run summary

- [ ] **Step 2: Test the parsing locally**

Run: `pnpm run build 2>&1 | tee /tmp/build-output.txt && grep -E "^\s*dist/" /tmp/build-output.txt`

Expected: lines like:
```
dist/index.html                0.32 kB │ gzip: 0.23 kB
dist/assets/index-irwVq_Qx.js  0.76 kB │ gzip: 0.43 kB
```

- [ ] **Step 3: Commit and push**

```bash
git checkout -b ci/bundle-size
git add .github/workflows/bundle-size.yml
git commit -m "ci: add bundle size reporting workflow"
git push -u origin ci/bundle-size
```

- [ ] **Step 4: Open PR**

```bash
gh pr create --title "ci: add bundle size reporting workflow" --body "$(cat <<'EOF'
## Diagrams

<!-- Replace with a mermaid block (```mermaid fenced) showing the primary change.
If the change genuinely cannot be diagrammed, write `N/A — <reason>`. -->

## Summary
- Adds `.github/workflows/bundle-size.yml` — builds the app and reports chunk sizes in PR summary
- Parses Vite's build output into a markdown table (file, size, gzip)
- No external dependencies — pure shell parsing

## Test plan
- [ ] Bundle size workflow runs on this PR
- [ ] Check the Actions run summary for the bundle size table

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

### Task 5: CodeQL + Dependabot

**Branch:** `ci/codeql-dependabot`

**Files:**
- Create: `.github/workflows/codeql.yml`
- Create: `.github/dependabot.yml`

- [ ] **Step 1: Create `.github/workflows/codeql.yml`**

```yaml
# .github/workflows/codeql.yml
name: CodeQL

on:
  schedule:
    - cron: '0 4 * * 1'  # Mondays at 04:00 UTC
  pull_request:
    branches: [main]
  workflow_dispatch:

concurrency:
  group: codeql-${{ github.ref }}
  cancel-in-progress: true

permissions:
  security-events: write
  contents: read

jobs:
  analyze:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4

      - name: Initialize CodeQL
        uses: github/codeql-action/init@v3
        with:
          languages: javascript-typescript

      - name: Run CodeQL analysis
        uses: github/codeql-action/analyze@v3
```

- [ ] **Step 2: Create `.github/dependabot.yml`**

```yaml
# .github/dependabot.yml
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

- [ ] **Step 3: Commit and push**

```bash
git checkout -b ci/codeql-dependabot
git add .github/workflows/codeql.yml .github/dependabot.yml
git commit -m "ci: add CodeQL security scanning and Dependabot config"
git push -u origin ci/codeql-dependabot
```

- [ ] **Step 4: Open PR**

```bash
gh pr create --title "ci: add CodeQL and Dependabot" --body "$(cat <<'EOF'
## Diagrams

<!-- Replace with a mermaid block (```mermaid fenced) showing the primary change.
If the change genuinely cannot be diagrammed, write `N/A — <reason>`. -->

## Summary
- Adds `.github/workflows/codeql.yml` — JS/TS security scanning on PRs, weekly schedule, and manual trigger
- Adds `.github/dependabot.yml` — weekly grouped npm updates, monthly GH Actions updates
- Dependency groups: testing, svelte, tensorflow, eslint

## Test plan
- [ ] CodeQL workflow runs on this PR
- [ ] Dependabot config is valid (GitHub will surface errors in the Security tab if not)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

### Task 6: GitHub repo settings (manual — Playwright MCP)

**No branch or PR.** This is a manual configuration step performed via the GitHub UI using Playwright MCP.

**Prerequisite:** Tasks 1-5 must all be merged to `main`. The CI checks must have run at least once so GitHub recognizes the status check names.

- [ ] **Step 1: Verify GitHub Actions is enabled**

Navigate to `https://github.com/julianken/ear-training-station/settings/actions` and confirm Actions are enabled. If not, enable "Allow all actions and reusable workflows".

- [ ] **Step 2: Identify exact status check names**

Navigate to a recently completed PR's checks tab, or go to `https://github.com/julianken/ear-training-station/settings/branches` and start adding a branch protection rule. The status check names to look for:

- `check` (from `ci.yml`, job id `check`)
- `lint` (from `ci-lint.yml`, job id `lint`)
- `e2e (1)`, `e2e (2)`, `e2e (3)`, `e2e (4)` (from `e2e.yml`, job id `e2e`, matrix)
- `bundle-size` (from `bundle-size.yml`, job id `bundle-size`)
- `analyze` (from `codeql.yml`, job id `analyze`)

Note: The exact names may differ slightly. GitHub derives them from workflow name + job id + matrix values. Verify from the actual check run names.

- [ ] **Step 3: Create branch protection rule for `main`**

Navigate to `https://github.com/julianken/ear-training-station/settings/branches` and create a new branch protection rule:

- **Branch name pattern:** `main`
- **Require a pull request before merging:** optional (single developer; enable if desired)
- **Require status checks to pass before merging:** YES
  - **Require branches to be up to date before merging:** YES
  - Add all status checks identified in Step 2
- **Do not allow bypassing the above settings:** YES (enforces for admins too)

- [ ] **Step 4: Verify branch protection works**

Create a test branch, push a trivial change, open a PR, and confirm that all required checks run and the merge button is blocked until they pass.

---

## Execution notes

- **Task 1 must go first.** It bootstraps `.github/workflows/` and the `packageManager` field that all other tasks depend on.
- **Tasks 2-5 are sequential.** Each PR benefits from checks established by prior PRs. The dispatcher should wait for CI checks to pass on each PR before dispatching the julianken-bot reviewer.
- **Task 6 is manual.** Performed by the dispatcher (not a subagent) via Playwright MCP after all workflows are on `main`.
- **No PRs merge with failing checks.** The dispatcher monitors CI runs and only dispatches the reviewer after checks pass (or investigates if they fail).
