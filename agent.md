# Agent — Lessons Learned

Retrospective notes for whoever (human or agent) works this **engine** repo next. Standing
*instructions* live in [`CLAUDE.md`](CLAUDE.md); durable *facts/preferences* live in the
memory dir. This file is what we learned the hard way.

Keep this file short — it loads into context, so length is a recurring cost. Add a lesson
only when it would have changed a decision.

---

## Token Economy

1. **graphify** — nearly free on the code (AST), expensive on prose (~200K/rebuild) and
   marginal on this small a corpus. Don't full-rebuild the specs casually; use
   `--cluster-only` / `query`. (The `--update` edge-loss trap is in `CLAUDE.md`.)
2. **Skill prompts inject their whole instruction file** on invocation. Only invoke a skill
   you will actually use.
3. **Start a fresh session at phase boundaries.** `CLAUDE.md` + memory + the specs re-prime
   a new session cheaply — that's why they're kept tight.

## What Worked (Keep Doing)

- **Decide via questions, then batch-write.** Surface real forks one/few at a time with
  `AskUserQuestion` (recommended option first), get sign-off, *then* edit. Never bulk-apply
  findings unreviewed. The user routinely picks the non-recommended (more rigorous) option
  — so ask, don't assume.
- **Verify, don't assert.** Running the PCG32 code in Node caught a golden-test vector
  written from memory (`5cae1c8b` → actually `cbed606e`). Assert only what you have checked;
  report failures plainly. **A *negative* result needs a second method before it becomes a
  finding** — `gh api "…/contents/design/30-slices.md?ref=main"` returned `Not Found` for
  three files that exist (the query string does not survive PowerShell's argument handling),
  and a 404 is indistinguishable from a real one. `git ls-tree origin/main` settled it. Same
  shape as the grep lesson below: absence is silent, so confirm it twice.
- **Search the concept, not the phrasing you just edited.** Striking a requirement from seven
  places, `grep 'without client-side'` returned clean — it cannot match *"or client-side
  JavaScript"*, and six stale statements survived a check reported as thorough (PR #23; review
  caught two, a concept-level re-sweep for `javascript|prerender|hydrat|SSR` caught the rest).
  A pattern built from the text you changed confirms your edits instead of finding your misses.
  **Removals are where this bites**: a bad edit contradicts something visibly, a missed removal
  is silent.
- **Pull the real image before reasoning about it.** Merging the landing page (`site/`, a Vite
  build) onto the docs build (`docs/`, Docusaurus) meant one real question: do their `assets/`
  folders collide? Guessing wrong would have silently overwritten one build's JS with the
  other's. `docker pull ghcr.io/the-running-dev/docs-template` and running the actual build
  answered it in two commands: Docusaurus nests under `assets/css/` and `assets/js/`; Vite
  writes flat hashed files straight into `assets/`. Never touch. `build/Merge-LandingPage.ps1`
  ships on that verified fact, not an assumption about how either bundler works.
- **Spec before code.** Building ahead of spec is where drift starts. Asked to "keep going"
  into code, we stopped and wrote the core spec (`04-core`) first — which immediately
  exposed that `03`'s kind-state duplicated envelope fields. That reconciliation would have
  been a bug in the implementation otherwise.
- **Full read after many small edits.** Editing a spec from diffs accumulates drift that
  only a full read catches (`learn-codebase` once found twelve here, incl. a functional bug
  where `DerivedPath` omitted `world.strangeness`).

## Roadmap Page Maintenance

`/roadmap/` is the standalone Vite page under `site/`, not a Docusaurus document. Its public
status is intentionally curated in `site/src/roadmap/roadmapData.ts`; do not infer it from the
README, whose status is deliberately coarse.

- **After a work-unit PR merges or the changelog gains an entry:** update the delivered count,
  completed chapter grouping, current checkpoint, and evidence URL in `roadmapData.ts`. Count
  `### [x] W…` headings in `design/30-slices.md`, then explicitly account for any merged
  units that the ledger has not yet recorded in the `completedBeyondTodo` exception list. Update
  the page before describing the new unit as delivered anywhere public. Reconcile `README.md`'s
  coarse status at the same time if it has become misleading, then regenerate
  `docs/src/pages/index.md` with `build/ConvertTo-DocumentationHomepage.ps1`; never edit that
  generated file by hand.
- **For every roadmap change:** check `git log --first-parent` for the representative immutable
  commit URLs, `TODO.md` for the actual unit state, and the relevant programme plan for the next
  checkpoint. Do not mark a proposed or branch-only unit as done.
- **Run locally:** `npm --prefix site run dev -- --host 127.0.0.1 --port 5173`, then visit
  `http://127.0.0.1:5173/roadmap/`. It is a real multi-page route, emitted as
  `site/dist/roadmap/index.html`, because GitHub Pages has no SPA fallback.
- **Verify:** `npm --prefix site run check` and `git diff --check`. The site build test verifies
  both static HTML entries and the route metadata; `build/Merge-LandingPage.ps1` additionally
  asserts that the merged documentation artifact contains `roadmap/index.html` without changing
  `docs/`.

## Drift Hazards Specific to This Repo

- **`03-story-graph-kind` ↔ `04-core`** drift most: `04` implements `03` as types. When a
  type changes, update the prose, the examples, the projection, and the validation/test
  list too.
- **Envelope-duplication recurs — five times now.** `kindState` (03 §8.1), then
  `StoryGraphCampaign` (03 §1 vs 04-core §10.1), then `StoryGraphView` (03 §9 vs 04-core
  §6/§9, which had `status` 3×, scene text 2×, and the choice list twice under two
  identical types), then `SimulationKindState` (10 §2), then `ResortGameState` (12 §3) —
  the last two each also carrying a persisted `RngState` the envelope bans outright.
  **It recurs on the *view* side too, not just state and content** — whenever a kind
  mirrors a core concept, check the field lives in exactly one place. `CLAUDE.md` holds
  the canonical ledger; **count the list, never increment the number** — four documents
  once carried four different counts of this, all written from memory.
- **Positional numbering** — inserting a doc means renumbering + rewriting every link.
  Prefer appending. Sidebar *order and sections* live in `docs/sidebar.ts`, decoupled from
  filenames — and a new page must be added there or it never appears.
- **A diff cannot show a rendering bug.** Every spec doc shipped for months with its
  metadata fields merged into one run-on paragraph, because markdown joins consecutive
  lines — correct markdown, wrong intent. A metadata field or blockquote label needs a
  **blank line** after it (never trailing double-spaces: `git diff --check` rejects those).
  Render before merging a doc change; `./docs.ps1` alone is not enough, since the dev
  server does not check links — only a production build does.
- **Encoding** — some imported source docs arrived CP1252, not UTF-8 (mojibake em-dashes /
  arrows). Rewrite to UTF-8 when importing.

## Open Concerns & Assumptions

- **Spec-level unknowns** live in [`design/90-decisions.md`](design/90-decisions.md).
  Its §1 is now a **decision log** — all eight MVP-blocking gaps (including `PlayerProfile`,
  long the sharpest) are resolved and written into the contracts. Nothing MVP-blocking is
  open; add new gaps there as full entries.
- **Engine suite runs green under vitest** (15 tests, `pcg32` + `canonical`), and CI now
  runs it: `.github/workflows/ci.yml` (`engine`), plus the installed `docs-ci.yml` and
  `docs-deploy.yml`. The three pull-request checks are required on `main`; deploy is not,
  since it runs only on push to `main` (`TODO.md` W0, closed).
- **The docs-site base image is verified for the current W0 baseline.** `docs.ps1` builds
  on the public `ghcr.io/the-running-dev/docs-template`; the installed image uses
  Docusaurus 3, port 3000, and the local `sidebar.ts`. A production build passed with no
  leftover template docs in the sidebar. Re-verify when the base image tag changes. `/docs/`
  now serves the generated homepage (`docs/docs/index.md`); `/docs/engine/vision` is the
  first spec page beneath it. **Once `feature/landing-page` merges, the bare domain `/` stops
  being `docs/src/pages/index.md` (generated from README) and becomes the standalone landing
  page (`site/`) instead** — `build/Merge-LandingPage.ps1`, wired into both `docs-ci.yml` and
  `docs-deploy.yml`, overlays it on every build. `/docs/` and everything beneath it is
  unaffected; only the site root changes owner.
- **Two link checks, and between them everything is now gated.** `build/Test-Documentation.ps1`
  hard-fails on relative links and heading anchors — that is the one that catches a doc
  rename. Both of Docusaurus's own passes are back to `'throw'`, which re-covers the
  **site-absolute targets (`/docs/engine/…`)** the gate skips by design (its line 391). They
  were `'warn'` only while a static file held the site root: a static file is never a route,
  so the navbar brand's link to `/` could not satisfy the checker. The root is a real route
  again — `docs/src/pages/index.md`, generated from the README — so the compromise is gone.
  See `plans/02-w0-ci-workflow.md`.
- **The site root is generated; edit `README.md`, never `docs/src/pages/index.md`.** The gate
  drift-checks the two and fails the build if they disagree. Absolute
  `https://game-engine.subzerodev.com/…` links in the README are rewritten to site-relative
  on the generated page, which is what lets one file read correctly on GitHub and on the
  site.

## Orientation in One Paragraph

This repo = the **Game Engine**: source (`src/engine/`, Phase 1 core started) + canonical specs
(`design/`), with generated human docs under `docs/docs/engine/`. A game-agnostic **core** + **kinds** (engine-owned code) +
**campaigns** (data); v1 ships two kinds, `story-graph` (flagship, the MVP) and
`simulation`. A "campaign" is a kind + its data; a "culture pack" reskins a simulation
campaign. The flagship game (Life in the Fast Lane) is the companion
[SubZeroDev.GameOfLife](https://github.com/The-Running-Dev/SubZeroDev.GameOfLife); a second,
Sun Trap, sits on the `world-graph` kind in
[SubZeroDev.SunTrap](https://github.com/The-Running-Dev/SubZeroDev.SunTrap); hosting
is [SubZeroDev.Platform](https://github.com/The-Running-Dev/SubZeroDev.Platform). Build
order: core → story-graph kind → minimal Bulgaria adventure → text client + MCP = MVP.
Then depth (the simulation kind / Jones), then breadth (`world-graph` / Sun Trap).
Contracts: `design/20-contract.md` (types), `design/10-design.md` (decisions).
