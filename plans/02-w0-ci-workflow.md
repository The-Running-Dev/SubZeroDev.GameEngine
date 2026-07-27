# W0 — CI Workflow Plan

**Status:** Proposed for review

**Unit:** `docs/docs/engine/TODO.md` — W0

**Scope:** Add the minimum GitHub Actions workflow that (a) installs the engine package
and runs typecheck, lint, and tests, and (b) runs the docs production build so the
repository's `onBrokenLinks: 'throw'` setting actually gates something — on every push and
pull request. Also pin the Node floor in `package.json` so CI and local agree.

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
- [Node.js release index](https://nodejs.org/dist/index.json) — the authority for which
  line is Active LTS. Checked, not assumed.
- [`docs/docusaurus.config.ts`](../docs/docusaurus.config.ts) — `onBrokenLinks: 'throw'`,
  and [`docs/Dockerfile`](../docs/Dockerfile) — the image the docs job builds.

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

- The local baseline is 15 passing tests across the RNG and canonical serialization
  suites — re-verified from a wiped `node_modules` via `npm ci`, which left the lockfile
  unmodified.
- `src/engine/package.json` has **no `engines` field**, so no Node floor is enforced
  locally today.
- `src/engine/package-lock.json` carries the full set of `@esbuild/linux-*` and
  `@rollup/rollup-linux-*` optional binaries, so `npm ci` resolves on `ubuntu-latest`
  even though the lockfile was generated on macOS.
- `docs/Dockerfile`'s `CMD` is `pnpm run start:docker` → `docusaurus start`, a **dev
  server**. Docusaurus performs broken-link detection only during `docusaurus build`, so
  `onBrokenLinks: 'throw'` in `docs/docusaurus.config.ts` currently gates nothing. A
  production build inside the image passes today with zero broken links.
- W0 has no engine API or runtime-contract dependency.

### Allowed Workflow Surface

Create exactly one file:

```text
.github/workflows/ci.yml
```

Use:

- `actions/checkout@v6`.
- `actions/setup-node@v7`.
- **Node.js 24** — the current Active LTS line ("Krypton", `v24.18.0` at time of writing).
  Verified against `https://nodejs.org/dist/index.json`: v26 and v25 exist but are
  Current, not LTS; v22 ("Jod") is the *previous* LTS line.
- `ubuntu-latest`.
- `npm ci`.
- npm cache metadata keyed from `src/engine/package-lock.json`.
- `contents: read` only. The docs base image
  `ghcr.io/the-running-dev/docs-template` is **public** — verified by an anonymous
  GHCR manifest pull returning `200` — so the docs job needs no registry credential and
  W0's "no secrets" guard holds for both jobs.
- A `concurrency` group so a superseded run is cancelled rather than left to finish.

### Excluded Work

- Core contract types or runtime implementation.
- Documentation **deployment** (publishing the built site anywhere). Documentation
  **validation** is in scope — see the docs job below.
- Releases, package publication, or versioning.
- Coverage thresholds.
- Operating-system or Node-version matrices.
- Branch-protection configuration.
- Changes to lint, TypeScript, Vitest, or determinism rules.

## Phase 1 — Add the Workflow

### What to Implement

Create `.github/workflows/ci.yml` with:

1. Workflow name `CI`.
2. Triggers:
   - `push`.
   - `pull_request`.
3. Minimal permission:
   - `contents: read`.
4. A `concurrency` group keyed on workflow + ref, with `cancel-in-progress: true`. Both
   triggers fire on a PR branch, so without this every PR commit runs the suite twice and
   superseded runs keep burning minutes.
5. Two jobs, `engine` and `docs`, running independently — a docs regression must not be
   reported as an engine failure, or vice versa.
6. Runner `ubuntu-latest`; a reasonable timeout, recommended at 10 minutes.

### Job `engine`

7. Default command directory `src/engine`.
8. Steps in this order:
   - Check out the repository.
   - Set up **Node.js 24**.
   - Enable npm cache metadata using `src/engine/package-lock.json`.
   - Run `npm ci`.
   - Run `npm run typecheck`.
   - Run `npm run lint`.
   - Run `npm test`.

Keep typecheck, lint, and test as separate named steps so a failed check is immediately
identifiable in GitHub.

### Job `docs`

The reason this job exists: `onBrokenLinks: 'throw'` was set deliberately so a renamed
heading or moved file fails rather than warns, but nothing runs `docusaurus build`, so
today it gates nothing (Phase 0). This job is what makes that setting real.

9. Steps in this order:
   - Check out the repository.
   - Build the docs image from the `docs/` context using `docs/Dockerfile`, passing
     `BASE_IMAGE=ghcr.io/the-running-dev/docs-template:latest`. No registry login step —
     the base image is public.
   - Run the **production build** inside that image (`pnpm run build`), which is where
     Docusaurus enforces `onBrokenLinks` / `onBrokenMarkdownLinks`.

Do not run `docusaurus start`; the dev server does not check links and would never exit.
Do not publish or deploy the built site — validation only.

### Also in W0

10. Add `"engines": { "node": ">=24" }` to `src/engine/package.json`. Without it the
    workflow's Node choice is unenforceable locally and the two silently drift; the field
    is what makes "Node 24" a property of the package rather than of one YAML file.
11. Bump `@types/node` from `^22.0.0` to `^24.0.0` so the type surface matches the runtime
    the tests actually execute on. Re-run `npm install` and commit the lockfile change.

### Documentation References

- `docs/docs/engine/TODO.md`, W0.
- `src/engine/package.json`, `scripts`.
- Official GitHub Node.js workflow guide, “Specifying the Node.js Version” and
  “Installing Dependencies.”
- `actions/setup-node`, “Caching Global Packages Data.”

### Verification Checklist

- [ ] The workflow parses as valid GitHub Actions YAML.
- [ ] Every `engine` `run` command executes from `src/engine/`.
- [ ] `npm ci` uses the committed lockfile without modifying it.
- [ ] Typecheck, lint, and test are distinct steps.
- [ ] No secret, write permission, publishing credential, or deployment token is present
      — including in the `docs` job, which pulls a public base image.
- [ ] `concurrency` cancels a superseded run instead of leaving it queued.
- [ ] The `docs` job runs `pnpm run build`, not `docusaurus start`.
- [ ] `engines` is present in `package.json` and agrees with the workflow's Node version.
- [ ] `@types/node` matches the Node major the job runs.
- [ ] `git diff --check` passes.

### Anti-Pattern Guards

- Do not use `npm install`; CI must use `npm ci`.
- Do not run npm from the repository root.
- Do not rely on the runner’s implicit Node version.
- Do not omit `cache-dependency-path` for the subdirectory lockfile.
- Do not combine all checks into one opaque shell command.
- Do not add unrelated automation while creating the first CI guardrail. The `docs` job is
  not unrelated: it is the only thing that makes the repository's existing
  `onBrokenLinks: 'throw'` setting take effect.
- Do not justify the Node version from `@types/node`; a types pin is not a runtime
  constraint. `engines` is the runtime constraint.
- Do not add a GHCR login step or credential to the `docs` job.

## Phase 2 — Prove the Green Path

### What to Verify

Before pushing, run locally from `src/engine/`:

```bash
npm ci
npm run typecheck
npm run lint
npm test
```

And for the docs job, from the repository root:

```bash
pwsh ./docs.ps1 -BuildOnly
```

```bash
docker run --rm game-engine-docs sh -c "pnpm run build"
```

Then push the W0 branch and verify both `CI / engine` and `CI / docs` run successfully.

> **The local install is not byte-for-byte the CI install.** This machine's npm gates
> package install scripts (`npm warn allow-scripts` for `esbuild` and `fsevents`), so
> those postinstalls do not run locally; standard npm on the runner will execute them.
> The suite passes either way, but treat a green local run as strong evidence, not proof
> — which is what the anti-pattern guard below already says.

### Verification Checklist

- [ ] Local clean install succeeds.
- [ ] Local typecheck succeeds.
- [ ] Local lint succeeds.
- [ ] All 15 existing tests pass.
- [ ] The local docs production build succeeds with zero broken links.
- [ ] The pushed workflow starts automatically.
- [ ] The remote `CI / engine` job is green.
- [ ] The remote `CI / docs` job is green.
- [ ] The job logs show each required step ran rather than being skipped.

### Anti-Pattern Guards

- Do not claim remote CI success from local commands.
- Do not mark W0 complete while the GitHub job is queued or in progress.
- Do not update the lockfile merely to make `npm ci` pass without reviewing why it
  changed.

## Phase 3 — Prove the Red Path

W0’s Definition of Done requires evidence that a deliberate failure makes CI red.

### What to Verify

Both jobs need this evidence, and they fail for different reasons, so prove each:

1. On a temporary verification branch, add a deliberate failing test (for `engine`) **and**
   a deliberate broken markdown link in a spec doc (for `docs`).
2. Push the temporary failure.
3. Verify `CI / engine` becomes red at the expected step, and `CI / docs` becomes red on
   the broken link — the latter is the proof that `onBrokenLinks: 'throw'` now bites.
4. **Record both run URLs in this plan** before reverting. The verification branch gets
   deleted, so a run link is the only durable evidence; "we saw it go red" is not.
5. Revert the deliberate failures.
6. Push again and verify both jobs return to green.
7. Delete the temporary verification branch after the evidence is recorded.

The deliberate failure must never be merged into `main`.

### Verification Checklist

- [ ] A controlled failure produces a red remote job in **both** `engine` and `docs`.
- [ ] The `engine` job fails at the intended typecheck, lint, or test step.
- [ ] The `docs` job fails on the broken link, not on an image-build or network error.
- [ ] Both red run URLs are recorded in this plan.
- [ ] The deliberate failures are reverted.
- [ ] The restored revision produces green remote jobs.
- [ ] No temporary failure remains in the final diff or history intended for merge.

### Anti-Pattern Guards

- Do not weaken a check to manufacture or repair the red-path result.
- Do not use unavailable secrets, permissions, or external services as the failure.
- Do not merge the deliberate failure.
- Do not leave the temporary verification branch behind after acceptance.

## Final Acceptance

W0 is complete only when:

- [ ] `.github/workflows/ci.yml` is merged.
- [ ] Push and pull-request events run the workflow, without duplicate concurrent runs.
- [ ] Install, typecheck, lint, and test all execute successfully.
- [ ] The docs production build executes successfully and enforces broken links.
- [ ] `engines` and `@types/node` agree with the Node version the workflow runs.
- [ ] A deliberate temporary failure has been observed turning **each** job red, with run
      URLs recorded.
- [ ] The restored workflow has returned to green.
- [ ] `docs/docs/engine/TODO.md` W0 is checked only after this evidence exists.
- [ ] No W1 implementation is included.

## Next Unit

After W0 is accepted, plan and execute **W1 — Core Contract Types and Module Skeleton**.
Do not begin W1 as part of the CI change.
