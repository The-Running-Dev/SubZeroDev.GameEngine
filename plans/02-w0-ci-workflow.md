# W0 — CI Workflow Plan

**Status:** **Approved — ready to implement in this repository.** Not yet implemented:
`.github/workflows/` does not exist here, `src/engine/package.json` has no `engines` field,
and `@types/node` is still `^22.0.0`. `TODO.md` W0 stays open until all three land here.

**Unit:** `docs/docs/engine/TODO.md` — W0

**Scope:** Two things, on every push and pull request:

1. **Author** `.github/workflows/ci.yml` — one `engine` job: install, typecheck, lint, test.
2. **Install** the documentation system from the published container image, which brings
   `docs-ci.yml` (gate + build) and `docs-deploy.yml` (build + Pages) ready-made, plus the
   link-and-terminology gate. This is what finally makes the repository's
   `onBrokenLinks: 'throw'` setting gate something.

Also pin the Node floor in `package.json` so CI and local agree, convert the README's
relative links, and set the real published URL.

**Method note.** An earlier draft hand-wrote a `docs` job that ran `docker build` then
`pnpm run build`. That is superseded: the installer provides the equivalent and more, and
keeps its workflows byte-identical to the template so upstream fixes arrive by re-running
one command.

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

### The Documentation System — Reference and Adoption Path

> **⚠ This section documents the docs system as it works once installed. This repository
> has not installed it *yet*** — its docs tooling is currently hand-rolled: a local
> `docs.ps1` plus `docs/Dockerfile`. Everything marked **not here** in the table below is
> the post-install state, i.e. **what W0 delivers**. The adoption decision has now been
> taken; see *Decisions taken* below for the exact switches and their consequences.

Installed from the published container image — no Node install, no template checkout to
keep in sync.

#### What is true of this repository today

| Claim | Here? | Evidence |
|---|---|---|
| Base image is public; `github.token` suffices, no `REGISTRY_TOKEN` | **Yes** | anonymous GHCR manifest pull returns `200` |
| Docs serve under `/docs` (`routeBasePath: 'docs'`) | **Yes** | `docs/docusaurus.config.ts` |
| Image dispatches `Invoke-*` commands by name | **Yes** | `entrypoint.sh` → `scripts/dispatch.ps1`; all five commands present |
| `./build/Test-Documentation.ps1` (the gate) | **Not here** | no `build/` directory |
| `docs-ci.yml` / `docs-deploy.yml` | **Not here** | no `.github/workflows/` |
| Required status checks on the default branch | **Not here** | no workflows to require |
| `docs/docs/index.md` generated from `README.md` | **Not here** | no `index.md`; `docs.ps1` contains no README step |
| `./docs.ps1 -BuildOnly` regenerates the homepage | **Not here** | it only builds the image |
| `url` set by `-SiteUrl` at install | **Not here** | `url` is still the placeholder `https://docs.example.com` |

#### Install

```bash
docker run --rm -v "$PWD:/work" -w /work --user "$(id -u):$(id -g)" \
  ghcr.io/the-running-dev/docs-template:latest \
  Invoke-SetupDocs -ProjectDir /work -Title 'My Project' -SiteUrl 'https://docs.example.com/'
```

- **Mount the whole project, including `.git`.** The gate finds the project root by walking
  up for a `.git` marker and fails without it.
- **`--user "$(id -u):$(id -g)"`** matters on Linux hosts; without it the container writes
  root-owned files into the repository.
- **`-ProjectDir` must point at the mount.** It defaults to `.`, and the image's own working
  directory is `/template`. Omit both and the command refuses to run rather than installing
  into the image itself.

Re-run with `-Overwrite` to pick up upstream fixes. `-BaseImage` pins a specific tag instead
of tracking `:latest`.

| Command | Purpose |
|---|---|
| `Invoke-SetupDocs` | Install or update the whole system. |
| `Invoke-SetupDocsWorkflow` | Install only the two workflows. |
| `Invoke-DocsBuild` | Build the static site, the same way CI does. |

`Invoke-DocsBuildImage` and `Invoke-PreviewDocs` drive Docker themselves, so they only run
on a host — not inside the image.

#### Deploying

Two things must be set up once, by hand:

**1. Enable GitHub Pages.** *Settings* → *Pages* → *Source*: **GitHub Actions**. Without
this the deploy job fails at `configure-pages`.

**2. Make the checks required** on the default branch, or a red run reports but does not
block a merge:

```text
Documentation links and terminology
Verify Documentation Build
Build and Deploy Documentation
```

> **⚠ Do not require the third one as a pull-request check.** Verified against the
> installed templates: `Build and Deploy Documentation` lives in `docs-deploy.yml`, which
> triggers only on `push` to `main` and `workflow_dispatch`. Required on pull requests it
> can never report, so every PR stays pending. Require the first two plus `CI / engine`;
> treat deploy as post-merge verification.

No registry credentials are needed — `ghcr.io/the-running-dev/docs-template` is a public
package, so the `github.token` the workflows already fall back to is enough.
`REGISTRY_TOKEN` is only required if `-BaseImage` points at a private fork or mirror.

Then it is automatic:

- **Pull request** → gate runs, site builds, Pages artifact archived. Nothing is published.
- **Push to `main`** → `docs-deploy.yml` builds and deploys to Pages.

The published URL is `url` + `baseUrl` in `docs/docusaurus.config.ts`, set by `-SiteUrl` at
install time.

To reproduce the CI build without pushing — **no `--user`**:

```bash
docker run --rm -v "$PWD:/work" -w /work \
  ghcr.io/the-running-dev/docs-template:latest \
  Invoke-DocsBuild -SourceDocs /work/docs -OutputPath /work/artifacts/docs
```

> **⚠ `--user` breaks `Invoke-DocsBuild` — verified by running both ways.** It overlays
> `/work/docs` onto `/template` *inside the image* before building, and `/template` is
> root-owned (`755`, baked into the image). `--user "$(id -u):$(id -g)"` makes the process
> a non-root, non-writing user for that directory, so the overlay step fails outright:
> `Copy-Item: Access to the path '/template/Dockerfile' is denied.` This is the opposite of
> `Invoke-SetupDocs`, which writes only into the mounted `/work` and needs `--user` for
> exactly the reason stated there — do not carry that flag over by habit.
>
> CI itself is unaffected: the installed `docs-ci.yml` runs this inside a GitHub Actions
> `container:` job with no `user:` override, so it runs as the image's default root and
> never hits this. It is a local-reproduction issue only, and only for this one command.

#### Local preview

```bash
./docs.ps1              # build and serve
./docs.ps1 -Live        # bind-mount docs/ for hot reload
./docs.ps1 -BuildOnly   # build only; regenerates the homepage
```

#### The homepage is generated

`docs/docs/index.md` comes from `README.md`. Edit the README, run `./docs.ps1 -BuildOnly`,
and commit both together — the gate fails if the committed copy differs.

The generator rewrites the site origin to `/` but **not** relative links, so `docs/guide.md`
in the README becomes `docs/docs/docs/guide.md` and fails the gate. Prefer absolute links to
the published site.

#### The gate

```bash
./build/Test-Documentation.ps1
```

Errors (broken relative links, bad heading anchors, generated-file drift) fail the run.
**Warnings (terminology) do not block CI** — `docs-ci.yml` runs the gate without
`-TreatWarningsAsErrors`. Add that switch if they should.

#### Serving path

Docs serve under `/docs` (`routeBasePath: 'docs'`), so `docs/docs/index.md` is the section
landing page, not the site root. Setting `routeBasePath: '/'` makes the generated homepage
the root, at the cost of moving every URL.

#### Decisions taken — this repository adopts the system

W0 installs the documentation system rather than hand-writing a docs job. Settled:

| # | Decision | Consequence |
|---|---|---|
| 1 | **Generate the homepage** from `README.md` (no `-NoHomepage`) | The README's relative links must become absolute, or the gate fails — **15 occurrences across 10 unique targets**; see below |
| 2 | **No `-Overwrite`** | Five files are reported *skipped* and survive with their local edits — `docs/docusaurus.config.ts`, `docs/sidebar.ts`, `docs/Dockerfile`, `docs/.dockerignore`, and `docs.ps1` — including the deliberate `onBrokenLinks: 'throw'`. Only the genuinely missing pieces land: `build/`, `.config/`, the two workflows, and the generated homepage |
| 3 | **Enable GitHub Pages and publish** | Documentation deployment moves *into* W0's scope |

Two consequences of combining 1 and 2 that must be handled explicitly, because neither is
obvious:

- **`docs.ps1` is skipped, so it will not regenerate the homepage.** The upstream
  `docs.ps1` does that; this repository's hand-written one has no such step and is being
  kept. The generator is installed independently at
  `build/ConvertTo-DocumentationHomepage.ps1` and is invoked directly. Do **not** assume
  `./docs.ps1 -BuildOnly` refreshes `docs/docs/index.md` here — it does not.
- **`-SiteUrl` does not fix `docusaurus.config.ts`.** It only rewrites the site origin
  inside the *generated homepage*. The published URL comes from `url` + `baseUrl` in
  `docs/docusaurus.config.ts`, which is skipped under decision 2 and still holds the
  placeholder `https://docs.example.com`. That file must be hand-edited, or the deployed
  site's links point at a domain that is not ours.

#### ✔ Closed — the site root under a custom domain

`routeBasePath` is `'docs'`, and decision 2 keeps it that way. So the generated homepage
publishes to **`https://game-engine.subzerodev.com/docs/`**, and this section assumed the
bare root `https://game-engine.subzerodev.com/` had nothing mapped to it.

**That assumption was wrong, and the correction forced the decision.** The root *did*
resolve on the first deploy — but only by accident. `docs/docusaurus.config.ts` never
disables the classic preset's `pages` plugin, so it scanned `/template/src/pages/` and
picked up the demo pages the base image happened to ship there. The first deploy therefore
published the template's demo homepage at `/`, plus stray `/cv/`, `/portfolio/`,
`/projects/`, and `/admin/projects/` routes, none of which belong to this project.

A later `docs-template:latest` revision removed those demo pages
(`sha256:5e18fd4b…` → `sha256:2f0c9ad5…`). Nothing then claimed `/`, and because the navbar
brand links to `/` from every page — including `404.html` — `onBrokenLinks: 'throw'` failed
the build on nine identical broken links. Same commit, same Node: the 20:32 deploy of
`47342b3` succeeded and the 22:29 re-run of that very commit failed.

Resolved with the second option below, which was already the less invasive one:

- ~~Set `routeBasePath: '/'`~~ — would move every URL and contradict decision 2.
- **Claim the root ourselves, leaving `/docs/…` untouched.** Done:
  [`docs/static/index.html`](../docs/static/index.html) forwards `/` to `/docs/`.

The point is not only that the root now resolves — it is that the site root is now **owned
by this repository** rather than inherited from whatever the base image happens to contain.

**Static file, not a `src/pages` route.** The first attempt here was a `src/pages/index.tsx`
rendering `<Redirect>`. That was the wrong mechanism, for three reasons:

1. **It re-used the mechanism that caused the outage.** The accidental root came from the
   base image's own `src/pages` being picked up by the classic preset. A fix that depends on
   that same plugin scanning that same directory leaves the root hostage to the image a
   second time — an image revision that repathed or disabled the `pages` plugin would
   silently remove the root again.
2. **It required JavaScript.** `<Redirect>` is client-side routing, so the emitted
   `index.html` is an empty shell that only forwards after React hydrates. A `meta refresh`
   forwards with no JS at all, and carries a `rel=canonical` so the root does not compete
   with `/docs/` in search results.
3. **It was a second answer to a solved problem.** `SubZeroDev.WinGet` hit this during the
   same docs-template migration and had already settled on `docs/static/index.html`. Two
   sibling repos solving one problem two ways is drift for no gain.

`docs/static/index.html` here is deliberately near-identical to WinGet's, down to the
comment explaining when to delete it.

**Note the difference in `onBrokenLinks`.** WinGet keeps the template default, `'warn'`;
this repo sets `'throw'` (see the strict-gating decision above). So WinGet's static file
fixes its bare-domain 404, while the navbar's link to `/` stays a tolerated warning there.
Under `'throw'` the same file has to additionally satisfy the link checker — verified in CI
rather than assumed, since a static file is not a route.

**Standing risk, not closed by this fix:** both docs workflows track
`ghcr.io/the-running-dev/docs-template:latest`, so an image revision can still break a
green `main` with no commit here. Pinning to a digest would trade that for manual bumps.
Left open deliberately — see the deploy workflow's `container.image`.

**Declined in review, retained knowingly.** Automated review flagged that
`docs/static/index.html` repeats `'docs'` from `routeBasePath`, and proposed extracting a
shared `DOCS_ROUTE_BASE` constant imported by both.

The underlying mechanism is real and worth stating plainly: the forwarding file is not a
route, so `onBrokenLinks` never sees it. Renaming `routeBasePath` without updating the
root page would send `/` to a dead route and **still build green** — the one drift in this
site that the build gate cannot catch.

The constant was declined anyway. `routeBasePath: 'docs'` is frozen by decision 2, and the
section above just reaffirmed it by rejecting `routeBasePath: '/'`; a module indirecting a
value the project has decided not to change buys nothing. The failure mode is a human
editing the config, so the mitigation lives there instead — `docusaurus.config.ts` now
carries a comment at `routeBasePath` naming the dependency and the silence, and the root
file names the coupling from its side. If `routeBasePath` ever does become a live variable,
revisit this and extract the constant then.

#### The README links that must change

Generating the homepage rewrites the site origin but **not** relative links, so each of
these becomes `docs/docs/…` relative to the site and fails the gate.

**Replace by target, not by count** — there are **15 occurrences across 10 unique targets**,
because some targets are linked twice under different text (`[MVP]` and `[MVP.md]` both
point at `MVP.md`). Counting link texts instead of occurrences is how an earlier draft of
this plan arrived at "14" and would have left one broken link behind.

| Relative target | Absolute target |
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

The last two point at repository files with no published-site equivalent, so they resolve
to the code host rather than the docs site.

### Allowed Workflow Surface

Author exactly one **new workflow file**:

```text
.github/workflows/ci.yml        # the `engine` job only
```

The documentation workflows are **installed, not authored**:

```text
.github/workflows/docs-ci.yml       # gate + build       (installed)
.github/workflows/docs-deploy.yml   # build + Pages      (installed)
```

This split is the installer's own design, not a preference: it *"never edits a workflow or
script the project author wrote, which is why the gate and build live in their own
`docs-ci.yml` rather than jobs appended to an existing test workflow."* Deploy stays a
separate file because a workflow cannot grant a job more permission than the workflow
declares, so folding the Pages/`id-token` grant into `docs-ci.yml` would hand the gate and
verify jobs credentials they never use.

**Never hand-edit the two installed workflows.** They are kept byte-identical to the
template so `Invoke-SetupDocs` can be re-run to pick up upstream fixes; an edit is silently
reverted on the next run.

W0 also updates `src/engine/package.json` and its lockfile, `README.md`, and
`docs/docusaurus.config.ts` as described below. "One new workflow file" does not mean "one
changed file."

For `ci.yml`, use:

- `actions/checkout@v7`.
- `actions/setup-node@v7`.
- **Node.js 24** — the current Active LTS line ("Krypton", `v24.18.0` at time of writing).
  Verified against `https://nodejs.org/dist/index.json`: v26 and v25 exist but are
  Current, not LTS; v22 ("Jod") is the *previous* LTS line.
- `ubuntu-latest`.
- `npm ci`.
- npm cache metadata keyed from `src/engine/package-lock.json`.
- `contents: read` only.
- A `concurrency` group so a superseded run is cancelled rather than left to finish.

The installed workflows carry their own permissions and container image; no registry
credential is needed because the base image is public.

### Excluded Work

- Core contract types or runtime implementation.
- Releases, package publication, or versioning.
- Coverage thresholds.
- Operating-system or Node-version matrices.
- Changes to lint, TypeScript, Vitest, or determinism rules.
- Hand-authoring a docs job in `ci.yml` — superseded; the installer provides it.
- Editing the installed workflows.

## Phase 1 — Author `ci.yml`, Install the Docs System

### What to Implement

#### Part A — author `.github/workflows/ci.yml`

1. Workflow name `CI`.
2. Triggers — **`pull_request`, plus `push` restricted to `main`**:

   ```yaml
   "on":
     push:
       branches:
         - main
     pull_request:
   ```

   Branches are covered by `pull_request`, `main` by `push`. Restricting the push trigger
   is what prevents a branch with an open PR producing two runs of this workflow. This is
   the same approach the installed `docs-ci.yml` takes — and the reason it carries no
   concurrency group at all.

3. Minimal permission:
   - `contents: read`.
4. A `concurrency` group on `github.ref`, with `cancel-in-progress: true`, so consecutive
   pushes to `main` supersede each other:

   ```yaml
   concurrency:
     group: ${{ github.workflow }}-${{ github.ref }}
     cancel-in-progress: true
   ```

   > **⚠ Corrected after it blocked a merge.** An earlier version of this plan specified an
   > unrestricted `push:` trigger deduplicated by a group keyed on head repository +
   > branch name, so that a push run and its PR run would share a group and one would
   > cancel the other. That is exactly what happened — and it is worse than a duplicate
   > run. The cancelled run still reports a check-run named `engine`, so a commit ends up
   > with two `engine` results, one `success` and one `cancelled`. A
   > `required_status_checks` rule sees the cancelled one and **blocks the merge with every
   > check passing**. It is also a race: on one commit the push run won and both were
   > green, so the failure is intermittent. Restrict the trigger instead of deduplicating
   > after the fact.
5. **One job, `engine`.** Documentation is handled by the installed `docs-ci.yml`, not by a
   job here — so a docs regression is never reported as an engine failure, and `ci.yml`
   stays a file the installer will never touch.
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

#### Part B — install the documentation system

9. **Dry run first — via the script directly, not the dispatcher.** `-WhatIf` on the
   `Invoke-SetupDocs` entry point stops at the container's command dispatcher and prints a
   single line, enumerating nothing:

   ```text
   What if: Performing the operation "Invoke discovered PowerShell Script" on target
   "/PSModule/Scripts/setup-docs.ps1".
   ```

   That is not a preview. Call the installer script directly to get the real one:

   ```bash
   docker run --rm -v "$PWD:/work" -w /work --user "$(id -u):$(id -g)" \
     ghcr.io/the-running-dev/docs-template:latest \
     pwsh -NoProfile -File /PSModule/Scripts/setup-docs.ps1 \
       -ProjectDir /work -Title 'Game Engine' \
       -SiteUrl 'https://game-engine.subzerodev.com/' -WhatIf
   ```

   Expect exactly **six creates and five skips**, and nothing written to the worktree:

   ```text
   Create:  build/ConvertTo-DocumentationHomepage.ps1   docs/docs/index.md
            build/Test-Documentation.ps1                .config/DocumentationRules.psd1
            .github/workflows/docs-ci.yml               .github/workflows/docs-deploy.yml

   Skip:    docs/docusaurus.config.ts   docs/sidebar.ts   docs/Dockerfile
            docs/.dockerignore          docs.ps1
   ```

   The five skips are decision 2 working. If any is reported as *replaced* or *removed*,
   stop: `-Overwrite` has leaked in and the local `onBrokenLinks: 'throw'` is about to be
   lost.

10. **Install** with the public `Invoke-SetupDocs` entry point — the dispatcher is fine for
    the real run, it is only `-WhatIf` that degrades — without `-Overwrite`. New files:
    `build/ConvertTo-DocumentationHomepage.ps1`, `build/Test-Documentation.ps1`,
    `.config/DocumentationRules.psd1`, `.github/workflows/docs-ci.yml`,
    `.github/workflows/docs-deploy.yml`, and `docs/docs/index.md`.

11. **Set the published URL by hand** in `docs/docusaurus.config.ts`. The published origin
    is **`https://game-engine.subzerodev.com`**:

    ```ts
    url: 'https://game-engine.subzerodev.com',
    baseUrl: '/',
    ```

    `baseUrl` is already `'/'`, so this is a one-line change to `url`. The installer skips
    this file under decision 2, so `-SiteUrl` alone does **not** update it; it currently
    holds the placeholder `https://docs.example.com`. Getting this wrong ships a site whose
    internal links point at someone else's domain.

12. **Convert every relative README link to an absolute URL** using the target map in
    Phase 0 — 15 occurrences, 10 unique targets; replace by target, not by count. Spec
    links point at `https://game-engine.subzerodev.com/docs/engine/…`; `docs.ps1` and
    `src/engine/` point at the code host on GitHub, which has no published-site equivalent.
    Then regenerate and commit both files together:

    ```bash
    pwsh ./build/ConvertTo-DocumentationHomepage.ps1
    ```

    Do **not** expect `./docs.ps1 -BuildOnly` to do this — the local `docs.ps1` is kept
    under decision 2 and has no homepage step.

13. **Enable GitHub Pages**: *Settings* → *Pages* → *Source* → **GitHub Actions**. Without
    it `docs-deploy.yml` fails at `configure-pages` on the first push to `main`.

13a. **Configure the custom domain.** `game-engine.subzerodev.com` is not the default
    `*.github.io` origin, so two more things are needed:

    - **DNS:** a `CNAME` record for `game-engine.subzerodev.com` →
      `the-running-dev.github.io`.
    - **Repository:** *Settings* → *Pages* → *Custom domain* → `game-engine.subzerodev.com`,
      then **Enforce HTTPS** once the certificate is issued.

    The template ships **no `CNAME` file** — verified, there is none anywhere in what the
    installer writes — so the domain lives in Pages settings, not in the built artifact.
    Under Actions-based deployment that is where GitHub reads it from. If the domain is
    ever dropped on a deploy, add `docs/static/CNAME` containing the hostname; Docusaurus
    copies `static/` verbatim into the build output.

14. **Make the three pull-request checks required** on the default branch, or a red run
    reports without blocking. `CI / engine` is the human-readable label GitHub's UI shows
    (workflow name / job name); the required-status-check **context** a config must use is
    the job name alone — confirmed via the check-runs API before configuring:

    ```text
    engine
    Documentation links and terminology
    Verify Documentation Build
    ```

    This repository uses a **ruleset**, not classic branch protection (`GET
    .../branches/main/protection` 404s here) — add a `required_status_checks` rule to the
    ruleset with the three contexts above, each pinned to the GitHub Actions app
    (`integration_id: 15368`), rather than using the classic protection API.

    **Do not require `Build and Deploy Documentation`.** It is declared in
    `docs-deploy.yml`, which triggers only on `push` to `main` and `workflow_dispatch` — it
    never runs on a pull request. Requiring a check that cannot report would leave **every
    pull request pending forever**. Watch it after merges to `main` instead; it is
    post-merge verification, not a merge gate.

### Also in W0

15. Add `"engines": { "node": ">=24" }` to `src/engine/package.json`. This establishes
    Node 24 as the **minimum supported runtime** and rejects older majors; it deliberately
    permits newer Node releases. CI remains pinned to Node 24 so the tested baseline is
    stable.
16. Bump `@types/node` from `^22.0.0` to `^24.0.0` so the type surface matches the runtime
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
- [ ] No secret, write permission, publishing credential, or deployment token appears in
      `ci.yml`. (`docs-deploy.yml` legitimately carries `pages: write` / `id-token: write`
      — that is the installer's design and is not W0's to edit.)
- [ ] `concurrency` gives push and pull-request runs for the same repository branch the
      same group and cancels a superseded run instead of leaving both active.
- [ ] `engines.node` sets a minimum of Node 24, and the workflow explicitly runs Node 24.
- [ ] `@types/node` matches the Node major the job runs.
- [ ] The install reported `docusaurus.config.ts`, `sidebar.ts`, `Dockerfile`, and
      `docs.ps1` as **skipped**, and `onBrokenLinks: 'throw'` survives in the config.
- [ ] `docs/docusaurus.config.ts` has `url: 'https://game-engine.subzerodev.com'` and
      `baseUrl: '/'` — not the `https://docs.example.com` placeholder.
- [ ] DNS `CNAME` for `game-engine.subzerodev.com` → `the-running-dev.github.io` resolves,
      and the custom domain is set in *Settings* → *Pages* with HTTPS enforced.
- [ ] `docs/docs/index.md` is committed and matches a fresh run of
      `build/ConvertTo-DocumentationHomepage.ps1`.
- [ ] No relative link survives in `README.md`.
- [ ] The two installed workflows are byte-identical to the template — unedited.
- [ ] `git diff --check` passes.

### Anti-Pattern Guards

- Do not use `npm install`; CI must use `npm ci`.
- Do not run npm from the repository root.
- Do not rely on the runner’s implicit Node version.
- Do not omit `cache-dependency-path` for the subdirectory lockfile.
- Do not combine all checks into one opaque shell command.
- Do not add unrelated automation while creating the first CI guardrail. The docs system is
  not unrelated: it is the only thing that makes the repository's existing
  `onBrokenLinks: 'throw'` setting take effect.
- Do not justify the Node version from `@types/node`; a types pin is not a runtime
  constraint. `engines` is the minimum-runtime constraint.
- Do not hand-edit `docs-ci.yml` or `docs-deploy.yml`; they are kept byte-identical to the
  template and an edit is reverted by the next `Invoke-SetupDocs` run.
- Do not add a docs job to `ci.yml`. It would duplicate `docs-ci.yml` and reintroduce the
  overlap this method removes.
- Do not pass `-Overwrite` to pick up one upstream fix; it replaces the tuned
  `docusaurus.config.ts` along with everything else. Re-run without it, or diff first.
- Do not assume `./docs.ps1 -BuildOnly` regenerates the homepage here — the upstream
  `docs.ps1` does that, and this repository keeps its own.
- Do not add a GHCR login step or credential; the base image is public.

## Phase 2 — Prove the Green Path

### What to Verify

Before pushing, run locally from `src/engine/`:

```bash
npm ci
npm run typecheck
npm run lint
npm test
```

And for the docs side, from the repository root — the gate, then the same build CI runs:

```bash
pwsh ./build/Test-Documentation.ps1
```

```bash
docker run --rm -v "$PWD:/work" -w /work \
  ghcr.io/the-running-dev/docs-template:latest \
  Invoke-DocsBuild -SourceDocs /work/docs -OutputPath /work/artifacts/docs
```

No `--user` here — see the warning under *Deploying* above.

Then push the W0 branch and verify `CI / engine`, *Documentation links and terminology*,
and *Verify Documentation Build* all run successfully. On a pull request nothing is
published — the Pages artifact is archived only.

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
- [ ] The local gate passes: no broken relative links, no bad heading anchors, no
      generated-file drift.
- [ ] The local `Invoke-DocsBuild` succeeds with zero broken links.
- [ ] The pushed workflows start automatically.
- [ ] The remote `CI / engine` job is green.
- [ ] *Documentation links and terminology* and *Verify Documentation Build* are green.
- [ ] The pull request published nothing — only archived the Pages artifact.
- [ ] The job logs show each required step ran rather than being skipped.

### Anti-Pattern Guards

- Do not claim remote CI success from local commands.
- Do not mark W0 complete while the GitHub job is queued or in progress.
- Do not update the lockfile merely to make `npm ci` pass without reviewing why it
  changed.

## Phase 3 — Prove the Red Path

W0’s Definition of Done requires evidence that a deliberate failure makes CI red.

### What to Verify

Three checks need this evidence, and they fail for different reasons, so prove each:

1. On a temporary verification branch, introduce three deliberate failures:
   - a failing test — for `CI / engine`;
   - a broken relative link in `README.md` — for *Documentation links and terminology*;
   - a broken markdown link in a spec doc — for *Verify Documentation Build*, which is the
     proof that `onBrokenLinks: 'throw'` finally bites.
2. Push the temporary failures.
3. Verify each check goes red at its own step, and that the *gate* and the *build* fail
   independently — they catch different classes, and a single failure proving both would
   mean one is not actually running.
4. **Record all three run URLs in this plan** before reverting. The verification branch gets
   deleted, so a run link is the only durable evidence; "we saw it go red" is not.
5. Revert the deliberate failures.
6. Push again and verify every check returns to green.
7. Delete the temporary verification branch after the evidence is recorded.

The deliberate failures must never be merged into `main`.

> **Terminology warnings do not fail CI.** `docs-ci.yml` runs the gate without
> `-TreatWarningsAsErrors`, so a terminology warning reports but does not block. Do not
> use a terminology warning as the red-path failure — it will stay green and prove
> nothing. Use a broken link or anchor.

### Verification Checklist

- [ ] A controlled failure produces a red result in **each** of the three checks.
- [ ] `CI / engine` fails at the intended typecheck, lint, or test step.
- [ ] The gate fails on the broken README link, not on a container or network error.
- [ ] The docs build fails on the broken spec link, independently of the gate.
- [ ] All three red run URLs are recorded in this plan.
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

- [ ] `.github/workflows/ci.yml` is merged, carrying the `engine` job only.
- [ ] `docs-ci.yml` and `docs-deploy.yml` are installed, unedited, and merged.
- [ ] Push and pull-request events run the workflows; a newer run for the same repository
      branch cancels its superseded push/PR run.
- [ ] Install, typecheck, lint, and test all execute successfully.
- [ ] The gate and the docs production build both execute and enforce their checks.
- [ ] `engines.node` establishes Node 24 as the floor, CI runs Node 24, and
      `@types/node` targets Node 24.
- [ ] GitHub Pages is enabled (*Source: GitHub Actions*), the custom domain resolves, and
      a push to `main` has **deployed the site to `https://game-engine.subzerodev.com`**.
- [ ] The **three** pull-request checks are marked required on the default branch —
      `CI / engine`, *Documentation links and terminology*, *Verify Documentation Build* —
      and *Build and Deploy Documentation* is **not** among them.
- [ ] `docs/docs/index.md` matches a fresh generator run, and `README.md` has no relative
      links.
- [ ] `onBrokenLinks: 'throw'` survives in `docs/docusaurus.config.ts` after the install.
- [ ] A deliberate temporary failure has been observed turning **each** of the three checks
      red, with run URLs recorded.
- [ ] The restored workflows have returned to green.
- [ ] `docs/docs/engine/TODO.md` W0 is checked only after this evidence exists.
- [ ] No W1 implementation is included.

## Next Unit

After W0 is accepted, plan and execute **W1 — Core Contract Types and Module Skeleton**.
Do not begin W1 as part of the CI change.
