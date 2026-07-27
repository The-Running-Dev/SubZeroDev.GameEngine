# W0 — CI Workflow Plan

**Status:** Proposed for review

**Unit:** `docs/docs/engine/TODO.md` — W0

**Scope:** Add the minimum GitHub Actions workflow that installs the engine package and
runs typecheck, lint, and tests on every push and pull request.

## Authority

- [`docs/docs/engine/TODO.md`](../docs/docs/engine/TODO.md), W0 — scope and Definition of
  Done.
- [`CLAUDE.md`](../CLAUDE.md), “The Code” — `src/engine/` is the npm package root.
- [`src/engine/package.json`](../src/engine/package.json) — authoritative script names.
- [`src/engine/package-lock.json`](../src/engine/package-lock.json) — reproducible install
  input.
- [GitHub: Building and Testing Node.js](https://docs.github.com/en/actions/tutorials/build-and-test-code/nodejs)
  — official workflow pattern.
- [GitHub: `actions/setup-node`](https://github.com/actions/setup-node) — Node setup and
  subdirectory lockfile caching.

This plan does not amend the engine specifications. It implements only W0 and stops
before W1.

## Phase 0 — Documentation Discovery

### Confirmed Repository State

- No `.github/workflows/` directory exists.
- The npm package lives at `src/engine/`.
- The committed lockfile is `src/engine/package-lock.json`.
- The required scripts already exist:

  ```text
  npm run typecheck
  npm run lint
  npm test
  ```

- The local baseline is documented as 15 passing tests across the RNG and canonical
  serialization suites.
- W0 has no engine API or runtime-contract dependency.

### Allowed Workflow Surface

Create exactly one file:

```text
.github/workflows/ci.yml
```

Use:

- `actions/checkout@v6`.
- `actions/setup-node@v7`.
- Node.js 22, matching the package’s Node 22 type dependency.
- `ubuntu-latest`.
- `npm ci`.
- npm cache metadata keyed from `src/engine/package-lock.json`.
- Read-only repository contents permission.

### Excluded Work

- Core contract types or runtime implementation.
- Documentation deployment.
- Releases, package publication, or versioning.
- Coverage thresholds.
- Operating-system or Node-version matrices.
- Branch-protection configuration.
- Changes to lint, TypeScript, Vitest, or determinism rules.
- The separate uncommitted Phase 0 documentation follow-ups currently in the worktree.

## Phase 1 — Add the Workflow

### What to Implement

Create `.github/workflows/ci.yml` with:

1. Workflow name `CI`.
2. Triggers:
   - `push`.
   - `pull_request`.
3. Minimal permission:
   - `contents: read`.
4. One job named `engine`.
5. Runner `ubuntu-latest`.
6. A reasonable timeout, recommended at 10 minutes.
7. Default command directory `src/engine`.
8. Steps in this order:
   - Check out the repository.
   - Set up Node.js 22.
   - Enable npm cache metadata using `src/engine/package-lock.json`.
   - Run `npm ci`.
   - Run `npm run typecheck`.
   - Run `npm run lint`.
   - Run `npm test`.

Keep typecheck, lint, and test as separate named steps so a failed check is immediately
identifiable in GitHub.

### Documentation References

- `docs/docs/engine/TODO.md`, W0.
- `src/engine/package.json`, `scripts`.
- Official GitHub Node.js workflow guide, “Specifying the Node.js Version” and
  “Installing Dependencies.”
- `actions/setup-node`, “Caching Global Packages Data.”

### Verification Checklist

- [ ] The workflow parses as valid GitHub Actions YAML.
- [ ] Every `run` command executes from `src/engine/`.
- [ ] `npm ci` uses the committed lockfile without modifying it.
- [ ] Typecheck, lint, and test are distinct steps.
- [ ] No secret, write permission, publishing credential, or deployment token is present.
- [ ] `git diff --check` passes.

### Anti-Pattern Guards

- Do not use `npm install`; CI must use `npm ci`.
- Do not run npm from the repository root.
- Do not rely on the runner’s implicit Node version.
- Do not omit `cache-dependency-path` for the subdirectory lockfile.
- Do not combine all checks into one opaque shell command.
- Do not add unrelated automation while creating the first CI guardrail.

## Phase 2 — Prove the Green Path

### What to Verify

Before pushing, run locally from `src/engine/`:

```bash
npm ci
npm run typecheck
npm run lint
npm test
```

Then push the W0 branch and verify the GitHub Actions `CI / engine` job runs all four
operations successfully.

### Verification Checklist

- [ ] Local clean install succeeds.
- [ ] Local typecheck succeeds.
- [ ] Local lint succeeds.
- [ ] All 15 existing tests pass.
- [ ] The pushed workflow starts automatically.
- [ ] The remote `CI / engine` job is green.
- [ ] The job log shows each required step ran rather than being skipped.

### Anti-Pattern Guards

- Do not claim remote CI success from local commands.
- Do not mark W0 complete while the GitHub job is queued or in progress.
- Do not update the lockfile merely to make `npm ci` pass without reviewing why it
  changed.

## Phase 3 — Prove the Red Path

W0’s Definition of Done requires evidence that a deliberate failure makes CI red.

### What to Verify

1. On a temporary verification branch, add a deliberate failing test or equivalent
   harmless check failure.
2. Push the temporary failure.
3. Verify `CI / engine` becomes red at the expected step.
4. Revert the deliberate failure.
5. Push again and verify the job returns to green.
6. Delete the temporary verification branch after the evidence is recorded.

The deliberate failure must never be merged into `main`.

### Verification Checklist

- [ ] A controlled failure produces a red remote job.
- [ ] The job fails at the intended typecheck, lint, or test step.
- [ ] The deliberate failure is reverted.
- [ ] The restored revision produces a green remote job.
- [ ] No temporary failure remains in the final diff or history intended for merge.

### Anti-Pattern Guards

- Do not weaken a check to manufacture or repair the red-path result.
- Do not use unavailable secrets, permissions, or external services as the failure.
- Do not merge the deliberate failure.
- Do not leave the temporary verification branch behind after acceptance.

## Final Acceptance

W0 is complete only when:

- [ ] `.github/workflows/ci.yml` is merged.
- [ ] Push and pull-request events run the workflow.
- [ ] Install, typecheck, lint, and test all execute successfully.
- [ ] A deliberate temporary failure has been observed turning CI red.
- [ ] The restored workflow has returned to green.
- [ ] `docs/docs/engine/TODO.md` W0 is checked only after this evidence exists.
- [ ] No W1 implementation is included.

## Next Unit

After W0 is accepted, plan and execute **W1 — Core Contract Types and Module Skeleton**.
Do not begin W1 as part of the CI change.
