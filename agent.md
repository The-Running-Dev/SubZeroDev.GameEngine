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
  report failures plainly.
- **Spec before code.** Building ahead of spec is where drift starts. Asked to "keep going"
  into code, we stopped and wrote the core spec (`04-core`) first — which immediately
  exposed that `03`'s kind-state duplicated envelope fields. That reconciliation would have
  been a bug in the implementation otherwise.
- **Full read after many small edits.** Editing a spec from diffs accumulates drift that
  only a full read catches (`learn-codebase` once found twelve here, incl. a functional bug
  where `DerivedPath` omitted `world.strangeness`).

## Drift Hazards Specific to This Repo

- **`03-story-graph-kind` ↔ `04-core`** drift most: `04` implements `03` as types. When a
  type changes, update the prose, the examples, the projection, and the validation/test
  list too.
- **Envelope-duplication recurs — three times now.** `kindState` (03 §8.1), then
  `StoryGraphCampaign` (03 §1 vs 04-core §10.1), then `StoryGraphView` (03 §9 vs 04-core
  §6/§9, which had `status` 3×, scene text 2×, and the choice list twice under two
  identical types). **It recurs on the *view* side too, not just state and content** —
  whenever a kind mirrors a core concept, check the field lives in exactly one place.
- **Positional numbering** — inserting a doc means renumbering + rewriting every link.
  Prefer appending. Sidebar *order* is `sidebar_position` front matter, decoupled from
  filenames.
- **A diff cannot show a rendering bug.** Every spec doc shipped for months with its
  metadata fields merged into one run-on paragraph, because markdown joins consecutive
  lines — correct markdown, wrong intent. A metadata field or blockquote label needs a
  **blank line** after it (never trailing double-spaces: `git diff --check` rejects those).
  Render before merging a doc change; `./docs.ps1` alone is not enough, since the dev
  server does not check links — only a production build does.
- **Encoding** — some imported source docs arrived CP1252, not UTF-8 (mojibake em-dashes /
  arrows). Rewrite to UTF-8 when importing.

## Open Concerns & Assumptions

- **Spec-level unknowns** live in [`OPEN-QUESTIONS.md`](docs/docs/engine/OPEN-QUESTIONS.md).
  Its §1 is now a **decision log** — all eight MVP-blocking gaps (including `PlayerProfile`,
  long the sharpest) are resolved and written into the contracts. Nothing MVP-blocking is
  open; add new gaps there as full entries.
- **Engine suite runs green under vitest** (15 tests, `pcg32` + `canonical`); no CI
  workflow yet (`TODO.md` W0).
- **The docs-site base image is verified for the current W0 baseline.** `docs.ps1` builds
  on the public `ghcr.io/the-running-dev/docs-template`; the installed image uses
  Docusaurus 3, port 3000, and the local `sidebar.ts`. A production build passed with no
  leftover template docs in the sidebar. Re-verify when the base image tag changes. The
  site lands on `/docs/engine/vision`, not `/docs`.
- **Broken links now fail the docs build** (`onBrokenLinks: 'throw'`). Renaming a heading
  or a file breaks anchors *silently* under `warn`; under `throw` the build catches it.
  Run the docs build before merging any doc rename.

## Orientation in One Paragraph

This repo = the **Game Engine**: source (`src/engine/`, Phase 1 core started) + specs
(`docs/docs/engine/`). A game-agnostic **core** + **kinds** (engine-owned code) +
**campaigns** (data); v1 ships two kinds, `story-graph` (flagship, the MVP) and
`simulation`. A "campaign" is a kind + its data; a "culture pack" reskins a simulation
campaign. The flagship game (Life in the Fast Lane) is the companion
[SubZeroDev.GameOfLife](https://github.com/The-Running-Dev/SubZeroDev.GameOfLife); hosting
is [SubZeroDev.Platform](https://github.com/The-Running-Dev/SubZeroDev.Platform). Build
order: core → story-graph kind → minimal Bulgaria adventure → text client + MCP = MVP.
Then depth (the simulation kind / Jones). Contracts: `04-core.md` (types),
`02-architecture.md` (decisions).
