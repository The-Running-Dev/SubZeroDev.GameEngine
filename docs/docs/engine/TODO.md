---
sidebar_position: 6
slug: todo
---

# TODO

**Status:** Living task list, ordered. The MVP is broken into **units of work** — each one
a single responsibility with its own contract references, dependencies, and done-criteria,
sized to be picked up in a fresh session. The MVP boundary is marked; everything below it
is post-MVP.

> The MVP's Definition of Done is [`MVP.md`](MVP.md) §5 — every unit below rolls up to it.
> The contracts are [`04-core.md`](04-core.md) and
> [`03-story-graph-kind.md`](03-story-graph-kind.md). Nothing unsettled remains for the
> MVP: [`OPEN-QUESTIONS.md`](OPEN-QUESTIONS.md) §1 is now a decision log.

Legend: `[ ]` not started · `[~]` in progress · `[x]` done

---

## Done — Specification and Scaffold

- [x] **[`03-story-graph-kind.md`](03-story-graph-kind.md)** — `Node`, `Choice`,
      `Requirement` (reuses the `Condition` tree verbatim), `Consequence`, `Ending`,
      `VariableSchema`, `AchievementDefinition`, seeded random-transition node, turn/settle
      semantics, projection, worked Bureaucracy-arc example.
- [x] **[`04-core.md`](04-core.md)** — the Kind seam and the platform types, so the build
      runs against contracts rather than decisions. Forced the `03` state reconciliation
      (envelope vs kind-state).
- [x] **`executeAction` removed.** No client called it; the plan flow covers execution
      (`games/05-text-client.md` §6). A method with no caller is a hypothesis.
- [x] **MVP contracts finalized** — campaign/content identity split (04 §10.1), `visited`
      semantics + start-of-game RNG stream (03 §8.2, 04 §4/§8), `AdvanceResult` tightened,
      Definition of Done agreed ([`MVP.md`](MVP.md) §5).
- [x] **All eight MVP-blocking gaps decided** — profile store, base reason strings,
      authoring→registry builder, zero-choice campaigns, `InitialStateResult`, `params` to
      `advance`, story-graph reason codes, the two format versions
      ([`OPEN-QUESTIONS.md`](OPEN-QUESTIONS.md) §1).
- [x] Project scaffold: `src/engine/` package, TypeScript strict, vitest, eslint with the
      determinism guard (bans `Math.random`, `Math.pow/exp/log/sin/cos/tan`, `Date.now`).
- [x] Version control: this repo (engine **source + specs**). Companions: the game
      [SubZeroDev.GameOfLife](https://github.com/The-Running-Dev/SubZeroDev.GameOfLife) and
      the hosting layer [SubZeroDev.Platform](https://github.com/The-Running-Dev/SubZeroDev.Platform).
      All private.
- [x] **Seeded PRNG (PCG32)** + `deriveStream` substreams, serializable state.
      `src/core/rng/pcg32.ts` — verified bit-identical to the reference vectors.
- [x] **Canonical serialization** (sorted keys, rejects non-finite).
      `src/core/serialize/canonical.ts`.
- [x] **Toolchain runs green** — `npm install && npm test && npm run lint && npm run
      typecheck`; 15 tests across `pcg32` and `canonical`.

---

# The MVP — Units of Work

Ordered by dependency. **W1–W8** are core (shared by every kind), **W9–W14** the
story-graph kind, **W15–W19** content, clients, and proof. A unit is done when its
done-criteria are demonstrated by a test, not by inspection.

## Core

### W0 — CI and Documentation Gates
**Author** `.github/workflows/ci.yml` with one `engine` job (install / typecheck / lint /
test), and **install** the documentation system from the published container image, which
brings `docs-ci.yml` (link-and-terminology gate + production build) and `docs-deploy.yml`
(build + GitHub Pages) ready-made. Every unit below is then guarded from the first commit
rather than the last. The docs half is not optional garnish — `docs/Dockerfile` runs a dev
server, and Docusaurus enforces `onBrokenLinks` only during a production build, so without
it the repo's `throw` setting gates nothing. Also pins the Node floor (`engines`) so CI and
local cannot drift, generates the site homepage from `README.md`, and publishes the site.
- **Depends on:** nothing.
- **Done when:** `engine` plus the gate and the docs build all run green on a push; a
  newer run for the same repository branch cancels its superseded push/PR run; Pages is
  enabled and a push to `main` has deployed to the real published URL; the three
  pull-request checks are required on the default branch (deploy runs only on `main`, so
  requiring it would leave every PR pending); `engines.node` establishes Node 24 as the
  floor while CI runs Node 24; and three deliberate failures — a failing test, a broken
  README link, a broken spec link — have each turned their own check red, with run URLs
  recorded.
  - [x] Workflow authored, docs system installed, README converted, Node 24 aligned — all
        green remotely on [PR #3](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/3).
  - [x] Required checks configured on the `main` ruleset (`engine`,
        *Documentation links and terminology*, *Verify Documentation Build*; deploy
        excluded).
  - [x] Red-path proof captured and reverted to green, with run URLs — full evidence in
        [`plans/04-w0-phase-1-implementation.md`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/blob/main/plans/04-w0-phase-1-implementation.md).
  - [ ] First deploy to `main` — blocked on merging PR #3, paused for explicit
        confirmation since it publishes a live site to a real custom domain.
  - [ ] HTTPS enforcement — depends on the first deploy.
  - **Known, deliberate end state, once deployed:** `routeBasePath` stays `'docs'`, so
    `https://game-engine.subzerodev.com/docs/` will serve while the bare
    `https://game-engine.subzerodev.com/` **404s** — not a defect, a URL-structure choice
    left open for a later unit. The generated homepage also adds a new top-level sidebar
    entry above the `engine` category; ordering inside `engine/` is unaffected.
- **Plan:** [`plans/02-w0-ci-workflow.md`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/blob/main/plans/02-w0-ci-workflow.md), [`plans/04-w0-phase-1-implementation.md`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/blob/main/plans/04-w0-phase-1-implementation.md)

### W1 — Core Contract Types and Module Skeleton
Create the module tree of 04 §1.1 (`kernel`, `session`, `persistence`, `projection`,
`validation`, `registry`, `localization`, `determinism`) and put each declared type in the
module that owns it. Types only — no behaviour.
- **Spec:** 04 §§1.1–3, 5–12, §17.
- **Depends on:** nothing.
- **Done when:** `npm run typecheck` passes with `exactOptionalPropertyTypes`; a dependency
      scan shows no core module importing `kinds/`, `clients/`, or `mcp/`; `kindState` is
      `unknown`, not a union; `GameState` carries no clock, profile, or kind state.

### W2 — RNG Handle and Stream Derivation
Wrap the built `Pcg32` behind `RngHandle`, and implement the normative `StreamId` → string
encoding. No generator state is persisted anywhere.
- **Spec:** 04 §8.
- **Depends on:** W1.
- **Done when:** the three encoding forms round-trip exactly as specified; the same
      `(seed, streamId)` yields identical draws across runs; different stream ids are
      independent; `GameState` contains no RNG field.

### W3 — Pure Engine Kernel
`createEngine`, `createGame` (consuming `InitialStateResult`), `submitAction` (passing
`params`, returning the new state in `value`), `scene`, `availableActions`, `serialize`,
and a **validating** `deserialize` returning `CommandResult<GameState>`.
- **Spec:** 04 §§2–5, §12.
- **Depends on:** W1, W2.
- **Done when:** a successful action appends exactly one monotonic `LoggedAction`; a
      rejected action leaves serialized state byte-identical and does not advance the log;
      every operation returns a new envelope and leaves its input untouched; `deserialize`
      rejects a malformed envelope instead of casting; unknown kind, unknown campaign,
      ended session, and unknown action each have a test.

### W4 — Registry, Authoring Builder, Localization
The frozen in-memory `ContentRegistry`; `AuthoredText` → `BuiltCampaign` pure builder; the
protected `core.reason.*` string merge; `LocKey` resolution. Parsing and file I/O stay in
an outer adapter.
- **Spec:** 04 §10.1, §12, §17.
- **Depends on:** W1.
- **Done when:** identical key/text pairs deduplicate and conflicting ones fail; a write
      into `core.reason.*` is rejected; a registered reason code with no message fails
      construction; the engine package performs no filesystem or network I/O.

### W5 — Tiered Validation
The Tier 1 / Tier 2 framework, identifier and `LocKey` rules, delegating kind checks to
`validateCampaign`.
- **Spec:** 04 §11, §17.
- **Depends on:** W4.
- **Done when:** a Tier 1 error fails registry construction with a path; a Tier 2 warning
      loads and is reported; duplicate and malformed identifiers fail; an unvalidated
      registry can never be frozen.

### W6 — Projection
`Engine.view`, the `player` / `agent` audiences, and the `kind.project` seam.
- **Spec:** 04 §9.
- **Depends on:** W3.
- **Done when:** `seed`, `actionLog`, and raw `kindState` cannot reach a client by any
      path; the `agent` audience is not wider than `player` by default.

### W7 — Session Store
The in-memory store: `listCampaigns`, `getScene`, `getView`, `createSession`,
`resumeSession`, `submitAction`, `saveGame`, `loadGame`. Persist canonical blobs, not live
objects.
- **Spec:** 04 §7, §10.2.
- **Depends on:** W3, W6.
- **Done when:** save mid-session → load → continue loses no state; two sessions cannot
      mutate each other; `savedAt`, owner ids, and other host metadata never appear in a
      serialized `GameState`.

### W8 — Profile Store
`PlayerProfile`, `ProfileStore`, `profileId` on `CreateSessionConfig`, and the post-action
idempotent upsert.
- **Spec:** 04 §7.1.
- **Depends on:** W7.
- **Done when:** an unlock survives a new session with the same `profileId`; no `profileId`
      means no read and no write; missing and corrupt both load an empty profile with the
      right warning; a write failure warns without rolling back the game action; a profile
      read can be shown never to affect resolution.

## The Story-Graph Kind

### W9 — Variables and Consequences
`VariableSchema`, typed `set` / `increment` / `decrement`, clamp-after-all-effects, sorted
iteration of state-affecting records.
- **Spec:** 03 §2, §5, §8.1.
- **Depends on:** W1.
- **Done when:** undeclared and mistyped writes are rejected; `+5` then `-5` on a clamped
      int nets zero rather than clipping; a save/load round trip cannot reorder a `Record`.

### W10 — Conditions and Requirements
The frozen `Condition` evaluator plus this kind's field namespace (`var.*`, `turn`,
`visited.*`, `achieved.*`, `ending`).
- **Spec:** 03 §6; 04 §18.
- **Depends on:** W9.
- **Done when:** only the frozen operator set evaluates; every `field` path is checked at
      load against the schema and node set; an unknown path is a Tier 1 error.

### W11 — Nodes, Turn, and Settle
The four node kinds, `enter(nodeId)`, the settle loop, the `SETTLE_STEPS` guard, and
`initialState` returning `InitialStateResult`.
- **Spec:** 03 §3, §8.1, §8.2.
- **Depends on:** W2, W9, W10.
- **Done when:** an auto/random chain settles to a choice or ending; every entry increments
      its visit count, including the start node and pass-throughs; a 64-step
      non-terminating chain fails with `settle_guard_tripped`; a start that settles onto an
      ending reports `status: "ended"`; random transitions reproduce from seed + action log.

### W12 — Scene, Actions, Projection, Reason Codes
`availableActions` (omit on `showWhen`, disable with a reason on `requirements`), `scene`,
the slim `StoryGraphView`, and the kind's reason codes.
- **Spec:** 03 §4, §8.3, §9; 04 §6.
- **Depends on:** W6, W11.
- **Done when:** a `showWhen`-hidden choice is absent from the view **and** returns
      `unknown_action` when submitted — indistinguishable from a nonexistent id; a gated
      choice renders disabled with its `requirementFailKey`; hidden variables and visit
      counts never appear in a projection; `StoryGraphView` repeats nothing the generic
      `Scene` already carries.

### W13 — Endings and Achievements
Ending resolution, achievement evaluation after every turn, unlock-once into `kindState`
plus an `achievement_unlocked` `StateChange`.
- **Spec:** 03 §7, §8.2.
- **Depends on:** W8, W11.
- **Done when:** an achievement fires exactly once across repeated turns; the unlock is
      readable as `achieved.<id>` in a later condition; `advance` performs no I/O.

### W14 — Story-Graph Validation
The kind's Tier 1 and Tier 2 checks via `validateCampaign`.
- **Spec:** 03 §11.
- **Depends on:** W5, W11.
- **Done when:** dangling `goto`, undeclared variable, duplicate id, missing `LocKey`,
      non-visible variable in text, and a non-positive-integer `weight` each fail Tier 1
      with a path; unreachable nodes, exitless cycles, and `no_reachable_choice` warn at
      Tier 2 without blocking the load.

## Content, Clients, Proof

### W15 — The Bureaucracy Campaign and Broken Fixtures
Author 03 §12 in the W4 source form with all its strings, plus four deliberately broken
copies: dangling node, undeclared variable, unreachable node, settlement cycle.
- **Spec:** 03 §12; `games/bulgaria.md`; [`MVP.md`](MVP.md) §3.
- **Depends on:** W4, W14.
- **Done when:** the valid campaign loads with no Tier 1 errors; the loop reaches its
      `office_visits >= 3` gate; the seeded clerk transition reproduces; each broken fixture
      produces its expected tier and path; every authored string resolves through the
      registry.

### W16 — Text Client
The plain proving instrument, over `SessionStore` only.
- **Spec:** 04 §§6–7; [`MVP.md`](MVP.md) §5 "Honest."
- **Depends on:** W7, W12.
- **Done when:** it drives every public session-store operation (API coverage checklist);
      it imports nothing from `kinds/` and never reads a persisted `GameState`; requirement
      failures render from reason codes, never matched English.

### W17 — MCP Server
The same operations as tools — a sibling adapter, no AI-specific path.
- **Spec:** 04 §13.
- **Depends on:** W7, W12.
- **Done when:** all eight tools match their documented args and results; an agent
      completes the arc; the same seed and choices produce the same result as W16.

### W18 — Determinism Harness
The `PlaythroughFixture` runner, committed golden files, and property tests.
- **Spec:** 04 §14.
- **Depends on:** W15.
- **Done when:** the same seed + action log serializes byte-identically; a one-byte golden
      edit fails the suite; N random seeds run twice match; `deserialize(serialize(state))`
      round-trips; the suite passes in Node with no DOM, network, or AI adapter installed.

### W19 — MVP Acceptance
Walk [`MVP.md`](MVP.md) §5 and attach test evidence to each box.
- **Depends on:** every unit above.
- **Done when:** every box is checked with a named test. **MVP DONE.**

---

## Post-MVP — Depth

### Depth: Life in the Fast Lane (The `simulation` Kind)

- [ ] Build the simulation kind per `games/04-engine-specification.md` (Phases 1–4 there).
- [ ] "Stable Life" scenario playable to a win and a loss.
- [ ] Its Definition of Done: `games/life-in-the-fast-lane.md`.

### Depth: Finish the Bulgaria Adventure

- [ ] The remaining four arcs (Inheritance, Enterprise, Driving, Return).
- [ ] Its full Definition of Done: `games/bulgaria-adventure.md`.

### Breadth: The First Culture Pack

- [ ] Bulgaria culture pack over the simulation kind — Jones-in-Bulgaria content,
      no engine change ([`02-architecture.md`](02-architecture.md) §4a).

### Breadth: The Platform

- [ ] More clients (web, Discord).
- [ ] **Additional locales.** The MVP ships English only; the authoring→registry types
      already support more (04 §10.1), so this is string tables plus tooling, no type
      change.
- [ ] AI-assisted authoring (content only; engine validates).
- [ ] The hosted service — only once all of the above works
      ([`neaas-platform-vision.md`](https://github.com/The-Running-Dev/SubZeroDev.Platform)).
- [ ] Content-pack merge / override / dependency rules — before mods, not before MVP
      ([`neaas-platform-vision.md`](https://github.com/The-Running-Dev/SubZeroDev.Platform) → Known deferred gaps).

### Content Tooling — A First-Class Workstream, Not an Afterthought

> Peer review's sharpest point: as campaigns grow, the runtime stabilizes while
> **tooling becomes the larger effort.** Named here so it is planned, not discovered.

- [ ] Content validator / linter (the Tier 1/2 checks, as an author-facing tool).
- [ ] Graph visualization + a visual node editor.
- [ ] Content diff and balancing tools.
- [ ] Localization tooling (string-table extraction, coverage, translation).
- [ ] Authoring assistants (AI-drafted content → the same validation, §9).

---

## Known Open Items Carried In

> Full register of unknowns, gaps, and deferred decisions:
> [`OPEN-QUESTIONS.md`](OPEN-QUESTIONS.md).


- [ ] `wisdom` attribute has no consumer in the simulation kind — needs one to earn its
      place (`games/04-engine-specification.md` §8.4).
- [ ] Provisional numbers across the simulation kind (drift rates, scenario economics,
      `demandBand` thresholds, housing-quality formula, travel costs) need a balancing
      pass once the sim harness runs.
- [ ] Doc-tree numbering across repos — the engine specs and the game specs both start at
      `01-`. Largely obviated by the repo split (they are no longer one tree); confirm and
      close, or restate the remaining problem ([`OPEN-QUESTIONS.md`](OPEN-QUESTIONS.md) §2).
- [ ] **Dev-dependency advisories** — `npm audit` reports 10 (3 moderate, 6 high, 1
      critical). All are in `devDependencies`; the package has **no runtime dependencies**,
      so nothing ships with them. The critical (`vitest` → `@vitest/mocker`, arbitrary file
      read/execute) requires the **Vitest UI server**, which this project never starts — it
      runs `vitest run`. No non-breaking fix exists: `npm audit fix` resolves none, and
      `--force` moves vitest 2 → 4 and eslint 9 → 10. **Deferred deliberately**; revisit as
      a single toolchain upgrade once the determinism harness (W18) can prove the upgrade
      changed no behaviour.
- [ ] **Three `docs-template` hardening findings, to raise upstream — after this PR
      merges, not before.** Surfaced by automated review on
      [PR #3](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/3); all three
      sit in files installed verbatim from `ghcr.io/the-running-dev/docs-template` (not
      authored in this repo), and this repo's own W0 decision is to never hand-edit
      installer-owned files — so the fix belongs in the `docs-template` project, filed as
      a separate PR there once this one is settled:
  - `docs-ci.yml` / `docs-deploy.yml` pin `ghcr.io/the-running-dev/docs-template:latest`,
    a mutable tag — non-reproducible, silent behaviour drift possible on future runs.
    Checked whether the installer's own `-BaseImage` avoids this without an upstream
    change: it doesn't — repinning an already-installed file needs `-Overwrite`, which
    would also replace this repo's five preserved local files (`docusaurus.config.ts`,
    `sidebar.ts`, `Dockerfile`, `.dockerignore`, `docs.ps1`). A fix needs a pin mechanism
    scoped to just the docs workflows, independent of `-Overwrite`.
  - `build/Test-Documentation.ps1`'s link validator resolves relative targets with
    `Join-Path` + `GetFullPath` and only checks `Test-Path`, without constraining the
    result to stay under `$Root` — a `../../` link can resolve outside the repository and
    still "pass." Not currently exploitable here (no `../`-style links exist in this
    repo's docs today); a validator-correctness gap, not a live defect.
  - Same script's file enumeration (`Get-DocumentationFile`) recurses every directory
    before applying `ExcludedSegments`, so excluded trees (`.git`, `node_modules`) are
    still walked. Performance only, tagged "Optional" by the reviewer.
  - Full findings, the verification behind declining each in this repo, and the reply
    text posted on each review thread: PR #3, review comments
    [1](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/3#discussion_r3660515997),
    [2](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/3#discussion_r3660516002),
    [3](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/3#discussion_r3660516006).
