# W0 Phase 1 — Draft Implementation Plan

**Status:** Reviewed. **F1–F3 approved and applied; Phase 1 done.** Phases 2–6 await
execution. Planning only; no W0 implementation is included.

**Branch:** `codex/w0-phase-1-plan`

**Parent plan:** [`02-w0-ci-workflow.md`](02-w0-ci-workflow.md), Phase 1.

**Unit:** [`TODO.md`](../docs/docs/engine/TODO.md), W0.

## Goal

Execute the first implementation phase of W0 without beginning W1:

1. Author the engine-only GitHub Actions workflow.
2. Install the published documentation system without overwriting the tuned local
   Docusaurus overlay.
3. Generate the documentation homepage from `README.md`.
4. Set the real documentation origin.
5. Establish Node 24 as the supported floor and CI baseline.
6. Prepare the already-configured GitHub Pages/custom-domain deployment for its first
   successful publish.

## Authority and Change Control

- [`plans/02-w0-ci-workflow.md`](02-w0-ci-workflow.md) defines the approved W0 design.
- [`docs/docs/engine/TODO.md`](../docs/docs/engine/TODO.md), W0, defines the authoritative
  unit boundary and Definition of Done.
- [`CLAUDE.md`](../CLAUDE.md) and [`agent.md`](../agent.md) define repository conventions.
- `src/engine/package.json` is authoritative for engine scripts.
- The published `ghcr.io/the-running-dev/docs-template:latest` image is authoritative for
  installed documentation scripts and workflows.

This draft records review findings that the parent plan did not account for. It does not
silently amend the parent plan or `TODO.md`. The three proposed corrections below require
peer approval before execution changes either authoritative document.

## Stop Boundary

This plan covers W0 Phase 1 only. It must not:

- Begin W0 Phase 2 green-path or Phase 3 red-path remote proof.
- Mark W0 complete.
- Begin W1 or change anything under `src/engine/src/`.
- Change engine contracts in `docs/docs/engine/03-story-graph-kind.md` or
  `docs/docs/engine/04-core.md`.
- Hand-edit installer-owned documentation workflows or scripts.

---

## Phase 0 — Documentation Discovery

### Sources Read

- Every source and test file under `src/engine/src/`.
- `src/engine/package.json`, `package-lock.json`, `tsconfig.json`, `eslint.config.js`, and
  `README.md`.
- `CLAUDE.md`, `agent.md`, and the repository `README.md`.
- `plans/01-mvp-implementation.md` and `plans/02-w0-ci-workflow.md`.
- `docs/docs/engine/TODO.md`, especially W0.
- `docs/docusaurus.config.ts`, `docs/sidebar.ts`, `docs/Dockerfile`, and `docs.ps1`.
- The current docs-template installer and its `docs-ci.yml` / `docs-deploy.yml` templates
  from the published container image.
- Current GitHub Pages and branch-protection state.

### Confirmed Repository Baseline

- `main` is synchronized with `origin/main`.
- The old design branch and merged `main` have identical trees.
- No `.github/`, `build/`, or `.config/` directory exists.
- `docs/docs/index.md` does not exist.
- `src/engine/package.json` has no `engines` field.
- `@types/node` is `^22.0.0`; the lockfile resolves it to the Node 22 line.
- The engine has four source/test files: PCG32 and canonical serialization with colocated
  Vitest tests.
- Typecheck, lint, and all 15 tests pass.
- No W1 module skeleton exists.
- `docs/docusaurus.config.ts` retains `onBrokenLinks: 'throw'`, serves content below
  `/docs`, and still uses `https://docs.example.com`.
- The local `docs.ps1` builds and serves only; it does not regenerate the homepage.

### Confirmed External Baseline

- GitHub Pages already uses the **GitHub Actions** build type.
- `game-engine.subzerodev.com` is already set as the repository custom domain.
- GitHub reports the custom domain as verified.
- DNS already works; HTTP resolves and redirects to HTTPS.
- HTTPS enforcement is not enabled yet.
- The root and `/docs/` currently return 404 because no site has been deployed.
- `main` currently has no branch protection or required status checks.

### Frozen Installer Evidence

The reviewed image resolves to:

```text
ghcr.io/the-running-dev/docs-template@sha256:000c221389cb5ba241bf91c69ec339539f7a64aba7da18de3e9cbd29538f2991
```

Record the resolved digest again immediately before implementation. The tag `:latest` is
mutable, so a different digest requires a fresh dry run and installed-file review.

### Review Findings — F1–F3 **Approved and Applied**

> **Disposition: all three accepted, and the corrections are already made** in
> [`02-w0-ci-workflow.md`](02-w0-ci-workflow.md) and
> [`TODO.md`](../docs/docs/engine/TODO.md). Each was reproduced before being accepted:
>
> - **F1** — ran both forms. The dispatcher `-WhatIf` printed one line and enumerated
>   nothing; the direct `pwsh -File` form printed exactly six creates and five skips and
>   wrote nothing to the worktree.
> - **F2** — counted: 15 occurrences, 10 unique targets. The parent plan's "14" came from
>   counting distinct link *texts* rather than occurrences.
> - **F3** — read the installed `docs-deploy.yml`: it triggers only on `push` to `main`
>   and `workflow_dispatch`.
>
> A fourth defect, raised inside F1, is also applied: the expected skip list is **five**
> files, not four — `docs/.dockerignore` exists here and is skipped too.
>
> **Phase 1 below is therefore already done.** It is kept as the record of what changed and
> why. Nothing in it needs re-executing; re-read it only to confirm the corrections landed.

### The Findings

#### F1 — The Documented Dry-Run Command Does Not Reach the Installer

The parent plan invokes:

```bash
docker run ... ghcr.io/the-running-dev/docs-template:latest \
  Invoke-SetupDocs ... -WhatIf
```

With `-WhatIf`, the image dispatcher simulates invoking the discovered script and stops:

```text
What if: Performing the operation "Invoke discovered PowerShell Script" ...
```

It does not enumerate created/skipped/replaced files. The detailed, non-writing preview
works when PowerShell calls the installer script directly:

```bash
docker run --rm -v "$PWD:/work" -w /work --user "$(id -u):$(id -g)" \
  ghcr.io/the-running-dev/docs-template:latest \
  pwsh -NoProfile -File /PSModule/Scripts/setup-docs.ps1 \
    -ProjectDir /work -Title 'Game Engine' \
    -SiteUrl 'https://game-engine.subzerodev.com/' -WhatIf
```

**Proposed disposition:** use the direct `pwsh -File` form for the dry run, then use the
public `Invoke-SetupDocs` entry point for the real install.

#### F2 — The README Link Count Is Stale

The parent plan says 14 relative links. The current README has **15 relative-link
occurrences across 10 unique relative targets**. Stopping after 14 would leave one broken
generated-homepage link.

**Proposed disposition:** replace every relative Markdown link by target, not by count.
Map the `docs/docs/engine/` directory link to the documented reading entry point,
`/docs/engine/vision`.

#### F3 — The Deploy Job Must Not Be a Required Pull-Request Check

The installed workflows behave as follows:

- `docs-ci.yml` runs `Documentation links and terminology` and
  `Verify Documentation Build` on pull requests.
- `docs-deploy.yml` runs `Build and Deploy Documentation` only on pushes to `main` and
  manual dispatch.

Requiring the deploy check on pull requests would leave every pull request pending because
that check never runs there.

**Proposed disposition:** require these three pull-request checks:

```text
CI / engine
Documentation links and terminology
Verify Documentation Build
```

Monitor `Build and Deploy Documentation` after pushes to `main`, but do not make it a
pull-request merge requirement.

### Peer-Review Additions — No Approval Required

Two consequences surfaced in review that this plan did not state. Neither changes scope,
so both are folded into the phases they affect rather than raised as findings:

- **A1 — the generated homepage adds a top-level sidebar entry** (Phase 5). The generator
  writes `title` and `sidebar_position: 1`, so the sidebar gains an entry above the
  `engine` category. Confirmed not to disturb the ordering *inside* `engine/`, which
  encodes the stated reading order — but now verified rather than assumed.
- **A2 — the bare root will 404 after deployment** (Phase 6). `routeBasePath` stays
  `'docs'`, so the site publishes at `/docs/` and the bare hostname keeps returning 404.
  Deliberate, and now recorded as an expected end state instead of a latent surprise.

Both were verified against the published image and the live Pages configuration.

### Allowed Interfaces

Use only:

- `actions/checkout@v7`.
- `actions/setup-node@v7`.
- Node 24 on `ubuntu-latest`.
- `npm ci`, `npm run typecheck`, `npm run lint`, and `npm test`.
- `Invoke-SetupDocs` for the real documentation-system installation.
- `/PSModule/Scripts/setup-docs.ps1 -WhatIf` for the detailed non-writing preview.
- `build/ConvertTo-DocumentationHomepage.ps1` for homepage generation.
- `build/Test-Documentation.ps1` for the documentation gate.
- `Invoke-DocsBuild` for the production documentation build.

No engine runtime API is used in W0 Phase 1.

### Allowed File Surface

Author:

```text
.github/workflows/ci.yml
```

Install without hand-editing:

```text
.github/workflows/docs-ci.yml
.github/workflows/docs-deploy.yml
build/ConvertTo-DocumentationHomepage.ps1
build/Test-Documentation.ps1
.config/DocumentationRules.psd1
docs/docs/index.md
```

Modify:

```text
README.md
docs/docusaurus.config.ts
src/engine/package.json
src/engine/package-lock.json
```

Preserve:

```text
docs.ps1
docs/Dockerfile
docs/.dockerignore
docs/sidebar.ts
```

After approval of F1–F3, correct the affected execution wording in:

```text
plans/02-w0-ci-workflow.md
docs/docs/engine/TODO.md
```

No other tracked file is in scope.

---

## Phase 1 — Reconcile the Approved Execution Documents — **Done**

### What to Implement

*Applied; retained as the record of what changed.* The discovered factual defects, all now
corrected in the authoritative documents:

1. Replace the ineffective dry-run invocation with the direct `pwsh -File` command.
2. Change the expected skip list from four files to the five files actually reported:
   `docusaurus.config.ts`, `sidebar.ts`, `Dockerfile`, `.dockerignore`, and `docs.ps1`.
3. Replace the “14 links” count with 15 occurrences / 10 unique relative targets.
4. Require the three checks that actually run on pull requests; treat deploy as a
   post-merge verification.
5. Record Pages, custom-domain, and DNS setup as already satisfied; retain HTTPS,
   deployment, and branch protection as incomplete.

### Documentation References

- Parent plan Phase 1, installer and required-check sections.
- The published `setup-docs.ps1`, `docs-ci.yml`, and `docs-deploy.yml` templates.
- Current GitHub Pages API state.

### Verification Checklist

- [x] Parent plan and `TODO.md` agree on required checks — three, deploy excluded.
- [x] The documented dry run prints created/skipped/replaced operations — verified by
      running it; six creates, five skips, nothing written.
- [x] The README count and mapping match the current file — 15 occurrences, 10 targets,
      with the full target map now in the parent plan.
- [x] No engine contract or runtime file changes.
- [x] `git diff --check` passes.

### Anti-Pattern Guards

- Do not rewrite settled W0 scope while correcting execution facts.
- Do not mark external settings complete without current evidence.
- Do not call deploy a pull-request check.

---

## Phase 2 — Freeze Inputs and Run the Installer Preview

### What to Implement

1. Pull the documentation image and record its resolved digest.
2. If the digest differs from Phase 0, re-read the installer and workflow templates.
3. Run the direct-script `-WhatIf` preview.
4. Require exactly six creates and five skips:

   ```text
   Create:
     build/ConvertTo-DocumentationHomepage.ps1
     docs/docs/index.md
     build/Test-Documentation.ps1
     .config/DocumentationRules.psd1
     .github/workflows/docs-ci.yml
     .github/workflows/docs-deploy.yml

   Skip:
     docs/docusaurus.config.ts
     docs/sidebar.ts
     docs/Dockerfile
     docs/.dockerignore
     docs.ps1
   ```

5. Stop if an existing local file is reported as replaced or removed.

### Documentation References

- Published `setup-docs.ps1`, `Set-ProjectFile`, and its `SupportsShouldProcess` behavior.
- Parent plan, “Decisions Taken — This Repository Adopts the System.”

### Verification Checklist

- [ ] Image digest recorded.
- [ ] Preview creates nothing in the worktree.
- [ ] Six creates and five skips match the expected list.
- [ ] No replacement is reported.
- [ ] Worktree differs only by the approved planning/documentation corrections.

### Anti-Pattern Guards

- Do not use `-Overwrite`.
- Do not treat the dispatcher-only `-WhatIf` line as a successful preview.
- Do not proceed after an unexpected installer diff.

---

## Phase 3 — Author Engine CI and Align Node

### What to Implement

Create `.github/workflows/ci.yml` by copying the exact W0 pattern:

- Name: `CI`.
- Triggers: `push`, `pull_request`.
- Permissions: `contents: read`.
- Concurrency: workflow + head repository + branch name, cancel in progress.
- One job: `engine`.
- Runner: `ubuntu-latest`.
- Timeout: 10 minutes.
- Default working directory: `src/engine`.
- Checkout v7.
- Setup Node v7 with Node 24, npm cache, and
  `cache-dependency-path: src/engine/package-lock.json`.
- Separate steps for `npm ci`, typecheck, lint, and test.

Update `src/engine/package.json`:

```json
"engines": {
  "node": ">=24"
}
```

Update `@types/node` to `^24.0.0`, regenerate the lockfile with npm, and review the
lockfile diff before accepting it.

### Documentation References

- Parent plan, “Part A — Author `.github/workflows/ci.yml`.”
- `src/engine/package.json`, existing script names.
- Official `actions/setup-node` subdirectory-cache example.

### Verification Checklist

- [ ] Workflow YAML parses.
- [ ] The workflow contains one engine job and no docs job.
- [ ] Every npm command runs from `src/engine`.
- [ ] Typecheck, lint, and test remain separate.
- [ ] No secret, write permission, registry login, matrix, or publication step exists.
- [ ] `engines.node` is `>=24`.
- [ ] `@types/node` targets Node 24 in the manifest and lockfile.
- [ ] Lockfile changes are explained and limited to the requested dependency update.

### Anti-Pattern Guards

- Do not run npm from the repository root.
- Do not use `npm install` in CI.
- Do not add a documentation job to `ci.yml`.
- Do not weaken TypeScript, lint, Vitest, or determinism settings.

---

## Phase 4 — Install the Documentation System

### What to Implement

Run the approved installer command without `-WhatIf` and without `-Overwrite`.

Review the resulting files before any manual edit:

- The six expected files exist.
- The five local overlay files remain byte-identical to their pre-install versions.
- The two installed workflows match the image templates for the recorded digest.
- No retired workflow or unrelated file was removed.

Never hand-edit installer-owned scripts or workflows.

### Documentation References

- Published `setup-docs.ps1`.
- Parent plan, “Part B — Install the Documentation System.”

### Verification Checklist

- [ ] Six expected files created.
- [ ] Five expected files skipped and unchanged.
- [ ] Installed workflows are byte-identical to the reviewed image templates.
- [ ] `onBrokenLinks: 'throw'` remains present.
- [ ] No source file under `src/engine/src/` changed.

### Anti-Pattern Guards

- Do not pass `-Overwrite`.
- Do not edit `docs-ci.yml` or `docs-deploy.yml`.
- Do not add GHCR credentials; the image is public.
- Do not assume retained `docs.ps1` regenerates the homepage.

---

## Phase 5 — Integrate the Published Documentation

### What to Implement

Set:

```ts
url: 'https://game-engine.subzerodev.com',
baseUrl: '/',
```

Convert all 15 relative README-link occurrences using this target map:

| Relative Target | Absolute Target |
|---|---|
| `docs/docs/engine/01-vision.md` | `https://game-engine.subzerodev.com/docs/engine/vision` |
| `docs/docs/engine/02-architecture.md` | `https://game-engine.subzerodev.com/docs/engine/architecture` |
| `docs/docs/engine/03-story-graph-kind.md` | `https://game-engine.subzerodev.com/docs/engine/story-graph-kind` |
| `docs/docs/engine/04-core.md` | `https://game-engine.subzerodev.com/docs/engine/core` |
| `docs/docs/engine/MVP.md` | `https://game-engine.subzerodev.com/docs/engine/mvp` |
| `docs/docs/engine/TODO.md` | `https://game-engine.subzerodev.com/docs/engine/todo` |
| `docs/docs/engine/OPEN-QUESTIONS.md` | `https://game-engine.subzerodev.com/docs/engine/open-questions` |
| `docs/docs/engine/` | `https://game-engine.subzerodev.com/docs/engine/vision` |
| `docs.ps1` | `https://github.com/The-Running-Dev/SubZeroDev.GameEngine/blob/main/docs.ps1` |
| `src/engine/` | `https://github.com/The-Running-Dev/SubZeroDev.GameEngine/tree/main/src/engine` |

Run:

```bash
pwsh ./build/ConvertTo-DocumentationHomepage.ps1
```

Commit `README.md` and `docs/docs/index.md` together during later implementation.

#### The Generated Homepage Changes the Sidebar

The generator writes front matter, not just body text — confirmed in the published
`ConvertTo-DocumentationHomepage.ps1`:

```yaml
---
title: '<-Title>'
sidebar_position: 1
---
```

Two consequences, neither of them a defect, both worth confirming rather than discovering:

- **A new top-level sidebar entry appears**, labelled with `-Title`, above the `engine`
  category. The sidebar is autogenerated from `docs/docs/`, and until now that directory
  held only `engine/`.
- **No collision with the existing ordering.** `sidebar_position: 1` here applies at the
  *top level*; the positions set in `docs/docs/engine/*.md` (vision 1 → open-questions 7)
  order documents *within* the category and are untouched. Verify this rather than assume
  it — the sidebar order inside `engine/` is deliberate and encodes the stated reading
  order, in which `04-core` precedes `03-story-graph-kind`.

### Documentation References

- Parent plan, README conversion and published-origin sections.
- Docusaurus slugs in `docs/docs/engine/`.
- Installed homepage generator.

### Verification Checklist

- [ ] No relative Markdown link remains in `README.md`.
- [ ] All 15 occurrences use the approved target map.
- [ ] Generated homepage exists and matches a fresh generator run.
- [ ] Placeholder origin is absent from `docs/docusaurus.config.ts`.
- [ ] The docs gate passes.
- [ ] Production docs build passes with zero broken links.
- [ ] The rendered sidebar shows the generated homepage as a top-level entry above the
      `engine` category.
- [ ] Inside `engine/`, the order is still Vision → Architecture → **Core Specification** →
      **Story-Graph Kind** → MVP → TODO → Open Questions, matching the reading order
      `04-core` states.

### Anti-Pattern Guards

- Do not edit generated `docs/docs/index.md` by hand.
- Do not link repository files to nonexistent documentation-site routes.
- Do not change `routeBasePath` or attempt to solve the bare-root landing page in W0.

---

## Phase 6 — Complete the External Phase 1 Configuration

### What to Implement

Treat these as already satisfied and verify only:

- Pages source is GitHub Actions.
- Custom domain is `game-engine.subzerodev.com`.
- Domain verification and DNS resolution are healthy.

After the workflows exist:

1. Push the later implementation branch and let the three pull-request checks register.
2. Require:

   ```text
   CI / engine
   Documentation links and terminology
   Verify Documentation Build
   ```

3. Do not require `Build and Deploy Documentation`; it runs only after pushes to `main`.
4. After merge, verify the deploy workflow publishes `/docs/`.
5. Enable HTTPS enforcement when GitHub makes it available.

#### The Bare Root Will 404 — Deliberately

Both `https://game-engine.subzerodev.com/` and `/docs/` return 404 today because nothing
has been deployed. After the first successful deploy they diverge:

| URL | After W0 |
|---|---|
| `https://game-engine.subzerodev.com/docs/` | serves the generated homepage |
| `https://game-engine.subzerodev.com/` | **still 404** |

`routeBasePath` is `'docs'`, and Phase 5 deliberately does not change it. So W0 ends with a
live site whose bare hostname is a 404 — which is fine for a docs subdomain, but stops
being hypothetical the moment the domain is shareable. **Record it as a known state at
handoff**, so the first person to type the bare host is not filing a bug.

Two exits, both explicitly outside W0: set `routeBasePath: '/'` (moves every URL and
contradicts the keep-local-config decision), or add a root landing page under
`docs/src/pages/` leaving `/docs/…` untouched.

### Documentation References

- Installed `docs-ci.yml` and `docs-deploy.yml` triggers.
- Current GitHub Pages API state.

### Verification Checklist

- [ ] Three pull-request checks are required on `main`.
- [ ] Deploy is not configured as a pull-request requirement.
- [ ] First main-branch deploy succeeds.
- [ ] `https://game-engine.subzerodev.com/docs/` serves the generated homepage.
- [ ] The bare root's 404 is **recorded as expected**, not reported as a deployment
      failure.
- [ ] HTTPS enforcement is enabled.

### Anti-Pattern Guards

- Do not recreate or change working DNS.
- Do not claim a 404 is a DNS failure before the first deployment.
- Do not require a status check that never runs on pull requests.

---

## Final Phase — Local Verification and Handoff

Run:

```bash
cd src/engine
npm ci
npm run typecheck
npm run lint
npm test
```

Then from the repository root:

```bash
pwsh ./build/Test-Documentation.ps1
```

```bash
docker run --rm -v "$PWD:/work" -w /work \
  ghcr.io/the-running-dev/docs-template:latest \
  Invoke-DocsBuild -SourceDocs /work/docs -OutputPath /work/artifacts/docs
```

**No `--user` here.** Found during this implementation: `--user` makes `Invoke-DocsBuild`
fail outright with `Access to the path '/template/Dockerfile' is denied.` — it overlays
onto `/template`, which is root-owned in the image, so a non-root user can't write there.
`Invoke-SetupDocs` needs `--user` because it writes only into the mounted `/work`;
`Invoke-DocsBuild` does not, and carrying the flag over breaks it. Corrected everywhere it
appeared in [`02-w0-ci-workflow.md`](02-w0-ci-workflow.md). CI is unaffected — the
installed `docs-ci.yml` runs this inside a `container:` job with no `user:` override, so it
already runs as root.

Finally:

```bash
git diff --check
git status --short
```

### Acceptance Checklist

- [ ] Only the allowed Phase 1 file surface changed.
- [ ] Engine clean install, typecheck, lint, and all 15 tests pass.
- [ ] Documentation gate and production build pass.
- [ ] Generated homepage is reproducible.
- [ ] Installed workflows remain unedited.
- [ ] Existing Docusaurus overlay remains intact.
- [ ] Sidebar verified: homepage at top level, `engine/` order unchanged (A1).
- [ ] Bare-root 404 recorded as an expected end state, not a defect (A2).
- [ ] External state is reported accurately, with DNS recorded as already working.
- [ ] W0 Phase 2 and Phase 3 remain unstarted.
- [ ] W1 remains unstarted.

## Peer-Review Order

F1–F3 are approved and applied, and Phase 1 is done — no longer under review. What remains:

1. Review the allowed file surface and stop boundary.
2. Review the README target map (now also in the parent plan).
3. Review installer preservation and byte-identity checks.
4. Review external Pages/check sequencing.
5. Approve execution of **Phases 2–6** in a fresh implementation task.
