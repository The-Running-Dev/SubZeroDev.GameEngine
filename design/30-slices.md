# Slices

> Canonical delivery ledger for the agent-kit workflow. This repository retains its established
> W identifiers because plans, tests, issues, changelog entries, and merged history already cite
> them. In this repository a W-numbered work unit is the agent kit's vertical slice.

<!-- human-doc:start path="engine/TODO.md" -->
---
slug: todo
---

# TODO

**Status:** Living task list, ordered. The MVP is broken into **units of work** — each one
a single responsibility with its own contract references, dependencies, and done-criteria,
sized to be picked up in a fresh session. The MVP boundary is marked; everything below it
is post-MVP.

> The MVP's Definition of Done is [`MVP.md`](MVP.md) §5 — every unit below rolls up to it.
> The contracts are [`04-core.md`](04-core.md),
> [`03-story-graph-kind.md`](03-story-graph-kind.md) and
> [`05-observability.md`](05-observability.md). Nothing unsettled remains for the
> MVP: [`OPEN-QUESTIONS.md`](OPEN-QUESTIONS.md) §1 is now a decision log.
>
> **Unit numbering is positional, like the doc numbering.** A unit inserted between two
> existing ones takes a letter suffix — `W3a` — rather than renumbering everything after
> it and invalidating every reference in `plans/`. Same convention as architecture §4a.

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
- [x] **MVP contracts finalized** — campaign/content identity split ([04 §10.1](04-core.md#101-content-registry)), `visited`
      semantics + start-of-game RNG stream ([03 §8.2](03-story-graph-kind.md), [04 §4](04-core.md#4-registration-and-the-pure-engine)/[§8](04-core.md#8-randomness)), `AdvanceResult` tightened,
      Definition of Done agreed ([`MVP.md`](MVP.md) §5).
- [x] **All eight MVP-blocking gaps decided** — profile store, base reason strings,
      authoring→registry builder, zero-choice campaigns, `InitialStateResult`, `params` to
      `advance`, story-graph reason codes, the two format versions
      ([`OPEN-QUESTIONS.md`](OPEN-QUESTIONS.md) §1).
- [x] Project scaffold: `src/engine/` package ([Engine Package](/docs/guide/engine-package)),
      TypeScript strict, vitest, eslint with the
      determinism guard (bans `Math.random`, `Math.pow/exp/log/sin/cos/tan`, `Date.now`).
- [x] Version control: this repo (engine **source + specs**). Companions: the games
      [SubZeroDev.GameOfLife](https://github.com/The-Running-Dev/SubZeroDev.GameOfLife) and
      [SubZeroDev.SunTrap](https://github.com/The-Running-Dev/SubZeroDev.SunTrap), and
      the hosting layer [SubZeroDev.Platform](https://github.com/The-Running-Dev/SubZeroDev.Platform).
      This repository and Sun Trap are **public** — verified 2026-08-02, when the engine
      package's own visibility raised the question. This line previously said "All private."
- [x] **Seeded PRNG (PCG32)** + `deriveStream` substreams, serializable state.
      `src/engine/src/core/determinism/pcg32.ts` — verified bit-identical to the reference vectors.
- [x] **Canonical serialization** (sorted keys, rejects non-finite).
      `src/engine/src/core/persistence/canonical.ts`.
- [x] **Toolchain runs green** — `npm install && npm test && npm run lint && npm run
      typecheck`; 15 tests across `pcg32` and `canonical`.

---

# The MVP — Units of Work

> **MVP DONE.** W1–W19 are all checked. [`MVP.md`](MVP.md) §5's Definition of Done is
> checked box-by-box against a named test for each one — the platform is proven. What
> follows below (Post-MVP) is depth and breadth building on it, not the MVP itself.

Ordered by dependency. **W1–W8** are core (shared by every kind), **W9–W14** the
story-graph kind, **W15–W19** content, clients, and proof. A unit is done when its
done-criteria are demonstrated by a test, not by inspection.

## Core

### [x] W0 — CI and Documentation Gates
**Author** `.github/workflows/ci.yml` with one `engine` job (install / typecheck / lint /
test), and **install** the documentation system from the published container image, which
brings `docs-ci.yml` (link-and-terminology gate + production build) and `docs-deploy.yml`
(build + GitHub Pages) ready-made. Every unit below is then guarded from the first commit
rather than the last. The docs half is not optional garnish — `docs/Dockerfile` runs a dev
server, and Docusaurus enforces `onBrokenLinks` only during a production build, so without
CI that pass never runs at all. Both Docusaurus link checks are `'warn'` by design; the hard
gate is `build/Test-Documentation.ps1`, which fails on every relative link and heading
anchor. Also pins the Node floor (`engines`) so CI and local cannot drift, generates the
site homepage from `README.md`, and publishes the site.
- **Depends on:** nothing.
- **Status:** Done — [PR #3](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/3)
      (workflow + docs system; landed across a few follow-up PRs — see the evidence below).
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
  - [x] First deploy to `main` — green twice: `47342b3`
        ([run](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/actions/runs/30303045991),
        PR #3) and `4e3effc`
        ([run](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/actions/runs/30316383318),
        PR #5). `https://game-engine.subzerodev.com/docs/` serves the generated homepage.
  - [x] HTTPS enforcement — enabled in *Settings* → *Pages* by the repository owner. Note
        for future reference: the domain is Cloudflare-fronted, so the `http` → `https`
        redirect observable from outside is Cloudflare's "Always Use HTTPS" and is not by
        itself evidence of this setting — the checkbox state is.
  - **Known, deliberate end state:** `routeBasePath` stays `'docs'`, so the specs serve
    from `https://game-engine.subzerodev.com/docs/` and the bare
    `https://game-engine.subzerodev.com/` serves the README, generated into
    `docs/src/pages/index.md` by the docs installer. That is a real route, so both
    broken-link checks are `'throw'`. They were briefly `'warn'` while a static file held
    the root instead — a static file serves the request but never satisfies a route
    checker, so the navbar brand's link to `/` failed the build under `'throw'`. The
    `/docs/` landing page lists the specs in reading order and adds one top-level sidebar
    entry above the `engine` category; ordering inside `engine/` is unaffected.
- **Plan:** [`plans/02-w0-ci-workflow.md`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/blob/main/plans/02-w0-ci-workflow.md), [`plans/04-w0-phase-1-implementation.md`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/blob/main/plans/04-w0-phase-1-implementation.md)

### [x] W1 — Core Contract Types and Module Skeleton
Create the module tree of 04 §1.1 (`kernel`, `session`, `persistence`, `projection`,
`validation`, `registry`, `localization`, `determinism`, `observability`, `composition`) and
put each declared type in the module that owns it. Types only — no behaviour.
- **Spec:** [04 §§1.1–3, 5–12, §17](04-core.md); [05 §§3–4](05-observability.md) for the
      `observability` types; [`06-extensibility.md`](06-extensibility.md) §4–§5 for
      `composition` — the two host roots and the `IdSource` and `Clock` port interfaces.
- **Depends on:** nothing.
- **Status:** Done — [PR #17](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/17).
- **Done when:** `npm run typecheck` passes with `exactOptionalPropertyTypes`; a dependency
      scan shows no core module importing `kinds/`, `clients/`, or `mcp/`; `kindState` is
      `unknown`, not a union; `GameState` carries no clock, profile, or kind state;
      `EngineEvent` carries no timestamp and no trace id — both are added at the boundary
      ([05 §6](05-observability.md#6-the-boundary--stamping-and-tracing)); every port is an interface with a working default, supplied only through
      `EngineHost` or `SessionHost`, and no core module reads a clock or generates an id
      itself ([06 §4](06-extensibility.md#4-the-composition-root)).

### [x] W2 — RNG Handle and Stream Derivation
Wrap the built `Pcg32` behind `RngHandle`, and implement the normative `StreamId` → string
encoding. No generator state is persisted anywhere.
- **Spec:** [04 §8](04-core.md#8-randomness).
- **Depends on:** [W1](#x-w1--core-contract-types-and-module-skeleton).
- **Status:** Done — [PR #22](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/22).
- **Done when:** all four encoding forms round-trip exactly as specified; the same
      `(seed, streamId)` yields identical draws across runs; different stream ids are
      independent; `GameState` contains no RNG field.

### [x] W3 — Pure Engine Kernel
`createEngine`, `createGame` (consuming `InitialStateResult`), `submitAction` (passing
`params`, returning the new state in `value`), `scene`, `availableActions`, `serialize`,
and a **validating** `deserialize` returning `CommandResult<GameState>`.
- **Spec:** [04 §§2–5, §12](04-core.md).
- **Depends on:** [W1](#x-w1--core-contract-types-and-module-skeleton),
      [W2](#x-w2--rng-handle-and-stream-derivation).
- **Status:** Done — [PR #33](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/33).
- **Done when:** a successful action appends exactly one monotonic `LoggedAction`; a
      rejected action leaves serialized state byte-identical and does not advance the log;
      every operation returns a new envelope and leaves its input untouched; `deserialize`
      rejects a malformed envelope instead of casting; unknown kind, unknown campaign,
      ended session, and unknown action each have a test.

### [x] W3a — Observability: Emitter, Events, and Sinks
The **core half** of the operational event channel. `Emitter`, the per-resolution
`ResolutionEmitter` handle on `KindContext`, the `GameEvent`/`SystemEvent` split, the core
event set ([05 §8](05-observability.md#8-core-events)), and two sinks — `nullEmitter` and `recordingEmitter`. Numbered `3a`
rather than inserted, so no existing unit renumbers — the same convention architecture §4a
uses.

**The boundary half is W7's**, because it cannot exist before the session store does:
stamping, spans, `attempt`, and `jsonlEmitter` all belong to the layer that owns a clock.
- **Spec:** [`05-observability.md`](05-observability.md) §§1–5, §7–§10, §12;
      [04 §3.1](04-core.md#31-kindcontext), [§4](04-core.md#4-registration-and-the-pure-engine),
      [§14](04-core.md#14-determinism-harness).
- **Depends on:** [W1](#x-w1--core-contract-types-and-module-skeleton),
      [W3](#x-w3--pure-engine-kernel). (Kind events come with the kind units —
      [W11](#x-w11--nodes-turn-and-settle) and [W12](#x-w12--scene-actions-projection-reason-codes).)
- **Status:** Done — [PR #34](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/34).
- **Done when:** `emit` returns `void` and no core code path reads anything back from a
      sink; the core isolates every `emit`, so a sink that throws on every call does not
      fail a game; a fixture replays byte-identically under `nullEmitter` and
      `recordingEmitter`; the same fixture twice under `recordingEmitter` yields the
      identical event sequence including ordinals, comparing modulo `gameId`; ordinals
      restart at 0 each resolution, so a stream does not depend on how many games ran
      before; no `EngineEvent` field is populated from a clock or an RNG draw;
      `core.validation.completed` and `core.deserialize.rejected` are `scope: "system"` and
      carry no `gameId`; a rejected unknown action id is absent from the emitted `data`; a
      name outside `core.*` emitted by the core, or outside `kind.<kindId>.*` by a kind,
      fails.

### [x] W4 — Registry, Authoring Builder, Localization
The frozen in-memory `ContentRegistry`; `AuthoredText` → `BuiltCampaign` pure builder; the
protected `core.reason.*` string merge; `LocKey` resolution. Parsing and file I/O stay in
an outer adapter.
- **Spec:** [04 §10.1](04-core.md#101-content-registry),
      [§12](04-core.md#12-reason-codes-state-changes-messages),
      [§17](04-core.md#17-identifier-conventions).
- **Depends on:** [W1](#x-w1--core-contract-types-and-module-skeleton).
- **Status:** Done — [PR #35](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/35).
- **Done when:** identical key/text pairs deduplicate and conflicting ones fail; a write
      into `core.reason.*` is rejected; a registered reason code with no message fails
      construction; the engine package performs no filesystem or network I/O.

### [x] W5 — Tiered Validation
The Tier 1 / Tier 2 framework, identifier and `LocKey` rules, delegating kind checks to
`validateCampaign`.
- **Spec:** [04 §11](04-core.md#11-tiered-validation), [§17](04-core.md#17-identifier-conventions).
- **Depends on:** [W4](#x-w4--registry-authoring-builder-localization).
- **Status:** Done — [PR #36](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/36).
- **Done when:** a Tier 1 error fails registry construction with a path; a Tier 2 warning
      loads and is reported; duplicate and malformed identifiers fail; an unvalidated
      registry can never be frozen.

### [x] W6 — Projection
`Engine.view`, the `player` / `ai` audiences, and the `kind.project` seam.
- **Spec:** [04 §9](04-core.md#9-projection).
- **Depends on:** [W3](#x-w3--pure-engine-kernel).
- **Status:** Done — [PR #37](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/37).
- **Done when:** `seed`, `actionLog`, and raw `kindState` cannot reach a client by any
      path; the `ai` audience is not wider than `player` by default.

### [x] W7 — Session Store
The in-memory store: `listCampaigns`, `getScene`, `getView`, `createSession`,
`resumeSession`, `submitAction`, `saveGame`, `loadGame`. Persist canonical blobs, not live
objects. **Owns the observability boundary** ([05 §6](05-observability.md#6-the-boundary--stamping-and-tracing)) — the half W3a deliberately leaves
out, because stamping needs the layer that has a clock.
- **Spec:** [04 §7](04-core.md#7-the-session-store-and-the-platform-api),
      [§10.2](04-core.md#102-save-envelope-and-migration);
      [05 §6](05-observability.md#6-the-boundary--stamping-and-tracing),
      [§6.1](05-observability.md#61-how-per-command-context-reaches-an-event),
      [§11](05-observability.md#11-incident-forensics--a-bug-report-is-a-fixture).
- **Depends on:** [W3a](#x-w3a--observability-emitter-events-and-sinks),
      [W3](#x-w3--pure-engine-kernel), [W6](#x-w6--projection).
- **Status:** Done — [PR #38](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/38).
- **Done when:** save mid-session → load → continue loses no state; two sessions cannot
      mutate each other; `savedAt`, owner ids, and other host metadata never appear in a
      serialized `GameState`; every command wraps the base emitter per call via
      `withEmitter` and stamps `emittedAt`, `traceId`, `spanId`, `attempt` and `sessionId`;
      two concurrent commands never cross-attribute an event, verified with interleaved
      sessions rather than asserted; `attempt` increments on **rejected** submissions too,
      so repeated invalid actions are distinguishable where `seq` repeats ([05 §5](05-observability.md#5-correlation-without-a-clock));
      `jsonlEmitter` writes one stamped record per line.

### [x] W8 — Profile Store
`PlayerProfile`, `ProfileStore`, `profileId` on `CreateSessionConfig`, and the post-action
idempotent upsert.
- **Spec:** [04 §7.1](04-core.md#71-the-profile-store).
- **Depends on:** [W7](#x-w7--session-store).
- **Status:** Done — [PR #39](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/39).
- **Done when:** an unlock survives a new session with the same `profileId`; no `profileId`
      means no read and no write; missing and corrupt both load an empty profile with the
      right warning; a write failure warns without rolling back the game action; a profile
      read can be shown never to affect resolution.

## The Story-Graph Kind

### [x] W9 — Variables and Consequences
`VariableSchema`, typed `set` / `increment` / `decrement`, clamp-after-all-effects, sorted
iteration of state-affecting records.
- **Spec:** [03 §2](03-story-graph-kind.md#2-variable-schema--fully-typed-n6),
      [§5](03-story-graph-kind.md#5-consequences--typed-effects), [§8.1](03-story-graph-kind.md#81-state).
- **Depends on:** [W1](#x-w1--core-contract-types-and-module-skeleton).
- **Status:** Done — [PR #41](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/41).
- **Done when:** undeclared and mistyped writes are rejected; `+5` then `-5` on a clamped
      int nets zero rather than clipping; a save/load round trip cannot reorder a `Record`.

### [x] W10 — Conditions and Requirements
The frozen `Condition` evaluator plus this kind's field namespace (`var.*`, `turn`,
`visited.*`, `achieved.*`, `ending`).
- **Spec:** [03 §6](03-story-graph-kind.md#6-requirements-and-conditions);
      [04 §18](04-core.md#18-frozen-primitives).
- **Depends on:** [W9](#x-w9--variables-and-consequences).
- **Status:** Done — [PR #43](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/43).
- **Done when:** only the frozen operator set evaluates; every `field` path is checked at
      load against the schema and node set; an unknown path is a Tier 1 error.

### [x] W11 — Nodes, Turn, and Settle
The four node kinds, `enter(nodeId)`, the settle loop, the `SETTLE_STEPS` guard, and
`initialState` returning `InitialStateResult`.
- **Spec:** [03 §3](03-story-graph-kind.md#3-nodes--the-single-content-type-n7),
      [§8.1](03-story-graph-kind.md#81-state), [§8.2](03-story-graph-kind.md),
      [§8.4](03-story-graph-kind.md#84-events).
- **Depends on:** [W2](#x-w2--rng-handle-and-stream-derivation),
      [W3a](#x-w3a--observability-emitter-events-and-sinks),
      [W9](#x-w9--variables-and-consequences), [W10](#x-w10--conditions-and-requirements).
- **Status:** Done — [PR #44](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/44).
- **Done when:** an auto/random chain settles to a choice or ending; every entry increments
      its visit count, including the start node and pass-throughs; a 64-step
      non-terminating chain fails with `settle_guard_tripped`; a start that settles onto an
      ending reports `status: "ended"`; random transitions reproduce from seed + action log;
      the settle loop emits `settle.step`, `node.entered` (with `visitCount`) and
      `random.picked`, and a stream diff localizes a seeded divergence to one transition.

### [x] W12 — Scene, Actions, Projection, Reason Codes
`availableActions` (omit on `showWhen`, disable with a reason on `requirements`), `scene`,
the slim `StoryGraphView`, and the kind's reason codes.
- **Spec:** [03 §4](03-story-graph-kind.md#4-choices-and-transitions),
      [§8.3](03-story-graph-kind.md#83-reason-codes), [§8.4](03-story-graph-kind.md#84-events),
      [§9](03-story-graph-kind.md#9-projection--what-a-client-sees); [04 §6](04-core.md#6-scenes-and-actions-generic).
- **Depends on:** [W6](#x-w6--projection), [W11](#x-w11--nodes-turn-and-settle).
- **Status:** Done — [PR #47](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/47).
- **Done when:** a `showWhen`-hidden choice is absent from the view **and** returns
      `unknown_action` when submitted — indistinguishable from a nonexistent id; a gated
      choice renders disabled with its `requirementFailKey`; hidden variables and visit
      counts never appear in a projection; `StoryGraphView` repeats nothing the generic
      `Scene` already carries.

### [x] W13 — Endings and Achievements
Ending resolution, achievement evaluation after every turn, unlock-once into `kindState`
plus an `achievement_unlocked` `StateChange`.
- **Spec:** [03 §7](03-story-graph-kind.md#7-achievements), [§8.2](03-story-graph-kind.md).
- **Depends on:** [W8](#x-w8--profile-store), [W11](#x-w11--nodes-turn-and-settle).
- **Status:** Done — [PR #51](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/51).
- **Done when:** an achievement fires exactly once across repeated turns; the unlock is
      readable as `achieved.<id>` in a later condition; `advance` performs no I/O.

### [x] W14 — Story-Graph Validation
The kind's Tier 1 and Tier 2 checks via `validateCampaign`.
- **Spec:** [03 §11](03-story-graph-kind.md#11-validation-story-graph-specific).
- **Depends on:** [W5](#x-w5--tiered-validation), [W11](#x-w11--nodes-turn-and-settle).
- **Status:** Done — [PR #55](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/55).
- **Done when:** dangling `goto`, undeclared variable, duplicate id, missing `LocKey`,
      non-visible variable in text, and a non-positive-integer `weight` each fail Tier 1
      with a path; unreachable nodes, exitless cycles, and `no_reachable_choice` warn at
      Tier 2 without blocking the load.

## Content, Clients, Proof

### [x] W15 — The Bureaucracy Campaign and Broken Fixtures
Author 03 §12 in the W4 source form with all its strings, plus four deliberately broken
copies: dangling node, undeclared variable, unreachable node, settlement cycle.
- **Spec:** [03 §12](03-story-graph-kind.md#12-worked-example--the-mvp-bureaucracy-arc);
      `games/bulgaria.md`; [MVP §3](MVP.md#3-in-scope).
- **Depends on:** [W4](#x-w4--registry-authoring-builder-localization),
      [W14](#x-w14--story-graph-validation).
- **Status:** Done — [PR #60](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/60).
- **Done when:** the valid campaign loads with no Tier 1 errors; the loop reaches its
      `office_visits >= 3` gate; the seeded clerk transition reproduces; each broken fixture
      produces its expected tier and path; every authored string resolves through the
      registry.

### [x] W16 — Text Client
The plain proving instrument, over `SessionStore` only.
- **Spec:** [04 §§6–7](04-core.md); [`09-clients.md`](09-clients.md) — the contract, and
      [§4](09-clients.md#4-the-api-coverage-checklist) the checklist;
      [MVP §5](MVP.md#5-definition-of-done--the-mvp) "Honest."
- **Depends on:** [W7](#x-w7--session-store), [W12](#x-w12--scene-actions-projection-reason-codes).
- **Status:** Done — [PR #63](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/63).
- **Done when:** the **API coverage checklist** ([09 §4](09-clients.md#4-the-api-coverage-checklist)) is complete for the text-client
      column — all nine operations that existed when W16 shipped exercised by automated
      tests, not by inspection (W48 later adds and proves the tenth); it
      imports nothing from `kinds/` and never reads a persisted `GameState`; requirement
      failures render from reason codes, never matched English; an unknown reason code
      renders rather than crashing ([09 §5](09-clients.md#5-reason-codes-and-messages)).

### [x] W17 — MCP Server
The same operations as tools — a sibling adapter, no AI-specific path.
- **Spec:** [04 §13](04-core.md#13-the-mcp-surface); [09 §7](09-clients.md#7-mcp-is-a-sibling-not-a-special-case)
      — MCP is a sibling, not a special case; the tool table itself lives in
      [SubZeroDev.Platform's `mcp-tool-contract.md`](https://github.com/The-Running-Dev/SubZeroDev.Platform/blob/main/docs/docs/mcp-tool-contract.md).
- **Depends on:** [W7](#x-w7--session-store), [W12](#x-w12--scene-actions-projection-reason-codes).
- **Status:** Done — [PR #66](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/66).
- **Done when:** every tool matches its documented args and results and maps
      one-to-one onto a store operation, with no tool that is not one ([09 §4](09-clients.md#4-the-api-coverage-checklist)); the MCP column of
      the coverage checklist is complete; an agent completes the arc; the same seed and
      choices, under the same counting `IdSource`, produce **byte-identical** `serialize()`
      output to W16's run — the client contract's proof ([09 §1](09-clients.md#1-the-rule-made-testable)); an agent sees no more than a human client does, including
      getting `unknown_action` for a hidden choice.

### [x] W18 — Determinism Harness
The `PlaythroughFixture` runner, committed golden files, property tests, and the
sink-independence pass.
- **Spec:** [04 §14](04-core.md#14-determinism-harness); [05 §12](05-observability.md#12-validation-and-tests).
- **Depends on:** [W3a](#x-w3a--observability-emitter-events-and-sinks),
      [W15](#x-w15--the-bureaucracy-campaign-and-broken-fixtures).
- **Status:** Done — [PR #70](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/70).
- **Done when:** the same seed + action log serializes byte-identically; a one-byte golden
      edit fails the suite; N random seeds run twice match; `deserialize(serialize(state))`
      round-trips; every fixture replays byte-identically under `nullEmitter` and
      `recordingEmitter`; the event stream is golden-filed and a stream diff fails the suite
      on an unintended behavioural change; the suite passes in Node with no DOM, network, or
      AI adapter installed.

### [x] W19 — MVP Acceptance
Walk [`MVP.md`](MVP.md) §5 and attach test evidence to each box.
- **Depends on:** every unit above.
- **Status:** Done — [PR #71](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/71).
- **Done when:** every box is checked with a named test. **MVP DONE.**

---

## Post-MVP — Depth

### Rigour: The Replay Regression Oracle

Replaying committed fixtures across **engine versions**, per
[`07-replay.md`](07-replay.md). Distinct from W18, which compares a build against itself.

**Not MVP.** It compares versions, and before W19 there is only one. Sequenced here so the
contract is settled while the reasoning is fresh, which is the same call observability took.
Broken into four units — see `plans/27-replay-oracle-programme.md` for the reasoning behind
the split and the decisions each one resolved.

### [x] W20 — Engine Versioning and Release Tags
Set a real version on the engine package and define the tagging scheme the oracle's
cross-version comparison depends on.
- **Spec:** [07 §2](07-replay.md#2-fixtures-are-inputs-not-state), [§8](07-replay.md#8-where-this-runs).
- **Depends on:** nothing.
- **Status:** Done — [PR #73](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/73).
- **Done when:** `src/engine/package.json` carries a real semver; a documented tag scheme
      exists; the version is readable from code without a runtime dependency; the first tag
      is cut at the current MVP-done commit.

### [x] W21 — Replay Oracle: Outcome and the Runner
The `Outcome`/`Decision` projection and the three-verdict runner (07 §3, §6), driven by a
counting `IdSource` ([06 §5.1](06-extensibility.md)) so `createGame` itself replays. Core-owned
and kind-agnostic, the same split `core/determinism/harness.ts` (W18) used, proved first
against a synthetic kind. Composed directly against `Engine` and `ProfileStore`, not
`createInMemorySessionStore` — its client-facing `SessionStore` surface never returns the raw
`GameState` `finalStatus`/`terminal` need (07 §3.2, revised from this unit's original plan
during implementation).
- **Spec:** [07 §2–§3](07-replay.md#2-fixtures-are-inputs-not-state), [§5](07-replay.md#prerequisite-a-controllable-idsource), [§6](07-replay.md#6-the-runner-and-its-verdicts).
- **Depends on:** [W20](#x-w20--engine-versioning-and-release-tags).
- **Status:** Done — [PR #73](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/73).
- **Done when:** all three verdicts (`match`/`diverged`/`unrunnable`) are reachable and
      tested; `at` is a `Decision.index`, never a `seq`; a rejected submission records
      `seq: null` and does not stop the replay; achievements are read from an in-memory
      `ProfileStore` after the last submission.

### [x] W22 — Replay Oracle: The Corpus
The committed `fixtures/replay/*.{fixture,outcome}.json` set (07 §4) against the real
Bureaucracy campaign: every MVP §5 playable box, plus a deliberate edge case. Also promotes
`createCountingIds` to `core/determinism/counting-ids.ts` and extracts the single real
`story-graph` kind assembly (`kinds/story-graph/kind.ts`), de-duplicating five byte-identical
copies test files accumulated across W16–W19 that a sixth (this unit's own corpus test) would
otherwise have joined.
- **Spec:** [07 §4](07-replay.md#4-the-corpus), [§5](07-replay.md#prerequisite-a-controllable-idsource).
- **Depends on:** [W21](#x-w21--replay-oracle-outcome-and-the-runner).
- **Status:** Done — [PR #73](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/73).
- **Done when:** every MVP §5 *Playable* box has a fixture (the arc, the gated choice, the
      seeded transition, the achievement, the loop gate); at least one deliberate edge-case
      fixture exists (a rejection, an unknown action); `kinds/story-graph/kind.ts` is the
      single kind assembly and the five duplicates are gone; a hand-edited `.outcome.json`
      produces `diverged` with the right `at`.

### [x] W23 — Replay Oracle: CI Wiring
No `paths` filter was actually kept on `pull_request` — one was tried and reverted (`ci.yml`'s
own comment: a path-filtered required check that never starts leaves a PR waiting on a report
that never arrives). The equivalent skip lives *inside* the `engine` job instead ("Determine
whether the engine package changed"), so it always reports while skipping the expensive steps
on a documentation-only PR ([07 §8](07-replay.md#8-where-this-runs)). `push` to `main` stays
unfiltered regardless, since path filters and tag pushes don't reliably combine. A new
`release-tag-replay` job runs only on `v*` tags, extracts the previous tag's committed
`.outcome.json` files via `git show`, and runs the corpus test against them via
`REPLAY_BASELINE_DIR` — the actual cross-version comparison.
Regenerating a committed `.outcome.json` is a deliberate, reviewed, single-fixture step — never
an automatic sweep ([07 §7](07-replay.md#7-intended-change-versus-regression)).
- **Spec:** [07 §7–§8](07-replay.md#7-intended-change-versus-regression).
- **Depends on:** [W20](#x-w20--engine-versioning-and-release-tags), [W22](#x-w22--replay-oracle-the-corpus).
- **Status:** Done — [PR #73](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/73).
- **Done when:** the suite runs on engine-package changes and on release tags; it does not
      run on documentation-only changes (verified live: a `plans/`-only PR reported `engine`
      green in 22s rather than not running at all). Regenerating an outcome file is a
      documented, deliberate per-fixture command, never a sweep. **The release-tag job's
      comparison branch is now verified live**, not just by local shell-logic testing: cutting
      `v0.2.0` (the first commit with a replay corpus) found the job's checkout never fetched
      sibling tags (`actions/checkout`'s `fetch-tags` defaults to `false`), so the comparison
      always fell through to "nothing to compare yet" regardless of what tags existed — fixed
      in `fetch-tags: true`, then proven end to end with a disposable tag: `4 passed | 5
      skipped` against `v0.2.0`'s real fixtures (PR #76). Milestone M3
      (`plans/27-replay-oracle-programme.md`) needed restating too — it said the *second* tag
      would prove this, which undercounts by one: `v0.1.0` predates the corpus entirely, so a
      second tag would have hit the same fixture-free skip on correct code. `v0.2.0` is the
      actual milestone M3 needed (`plans/35-w26-toolchain-upgrade.md`, Decision 4).

### Rigour: Spec and Toolchain Debt

Not new capability — the documentation and tooling debt six units (W8–W13) each correctly
deferred as "not blocking," none since picked up because no unit owned them. Named and
sequenced in [`plans/33-post-mvp-programme.md`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/blob/main/plans/33-post-mvp-programme.md), Tranche A.

### [x] W24 — Core Spec Reconciliation
Codifies in `04-core.md` §12 and §18 the conventions the code has implemented and depended on
since W8–W13 (two `StateChange` shapes, the `<kindId>.reason.*` messageKey namespace, the
`Condition` shape itself), fixes one intra-document contradiction in `03-story-graph-kind.md`
§9, closes the doc-tree numbering item, ticks all eighteen boxes of `09-clients.md` §4's API
coverage checklist with a real test cited per box, and corrects six entries `TODO.md` itself
had gotten wrong.
- **Spec:** [04 §12](04-core.md#12-reason-codes-state-changes-messages), [§18](04-core.md#18-frozen-primitives); [03 §9](03-story-graph-kind.md#9-projection--what-a-client-sees); [09 §4](09-clients.md#4-the-api-coverage-checklist).
- **Depends on:** nothing.
- **Status:** Done — [PR #77](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/77).
- **Done when:** every convention is stated where the interface it belongs to is defined, not
      only where it is used; `09-clients.md`'s checklist reflects real, run, passing tests
      rather than an unticked table beside a closed MVP claim; every corrected `TODO.md` entry
      cites the code or plan that proves the correction; no file under `src/engine/` changes.
- **Plan:** [`plans/34-w24-core-spec-reconciliation.md`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/blob/main/plans/34-w24-core-spec-reconciliation.md)

### [x] W25 — Simulation Kind Seam Reconciliation
Brings `10-simulation-kind.md` up to date against the conventions W24 codified and closes gaps
against the `Kind` interface it never addressed: folds `initialState`/`InitialStateResult` into
§3, adds a deferred §14 Validation (matching the `history` deferral's own idiom), narrows the
`GameStatus` mapping in §2 to match `12-world-graph-kind.md` §8's identical resolution, and
replaces `outcome()`'s shape — dropping an `endingId` this kind never had a concept for,
widening `resolution` to three values, and adding `goalsFailed`. Completes §15 ("What Remains
Upstream"), which accounted for one of `SimulationKindState`'s ten fields before this.
- **Spec:** [10 §2](10-simulation-kind.md#2-kindstate--what-belongs-here), [§3](10-simulation-kind.md#3-the-turn-is-a-week),
      [§12](10-simulation-kind.md#12-terminal-identity), [§14](10-simulation-kind.md#14-validation),
      [§15](10-simulation-kind.md#15-what-was-ported-and-what-was-found-along-the-way).
- **Depends on:** [W24](#x-w24--core-spec-reconciliation).
- **Status:** Done — [PR #80](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/80).
- **Done when:** every field `SimulationKindState` names has a row in §15; `outcome()`'s shape
      is justified against the upstream source rather than assumed (confirmed by full-text
      search that this kind has no ending concept); a review finding that the
      `week_limit_reached`/goal precedence is unresolved is flagged explicitly rather than
      guessed at; no file under `src/engine/` changes.
- **Plan:** [`plans/32-w25-simulation-kind-seam-reconciliation.md`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/blob/main/plans/32-w25-simulation-kind-seam-reconciliation.md)

### [x] W26 — Toolchain Upgrade
`vitest` 2.1.9 → 4.1.10, `eslint` 9.39.5 → 10.8.0. `typescript-eslint` did **not** need to
move — 8.65.0 already declares `eslint: "^8.57.0 || ^9.0.0 || ^10.0.0"` as a valid peer, so the
plan's anticipated three-package bump was actually two. `npm audit` went from 6 vulnerabilities
(3 moderate, 2 high, 1 critical) to **0** — better than the "partial clear is fine" outcome the
plan allowed for. The determinism guard's specific rules (`no-restricted-properties`,
`no-restricted-globals`, `no-restricted-imports`) are unchanged in eslint 10's migration guide;
Node 24 already satisfies its new floor (`>=20.19`/`>=22.13`/`>=24`).
- **Spec:** none — tooling only.
- **Depends on:** [W18](#x-w18--determinism-harness), [W22](#x-w22--replay-oracle-the-corpus) —
      both done, the entry's own stated precondition, met twice over once W20–W23 added the
      replay oracle as a second instrument.
- **Status:** Done — [PR #82](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/82).
- **Done when:** 39 files / 445 tests pass unchanged; the determinism guard is proven still
      live by a deliberate red-path test (a `Math.random()` and a banned core→kind import each
      independently fail lint, both reverted); the replay corpus and the W18 event-stream golden
      are verified byte-unmodified by the upgrade, not merely unregenerated; `v0.2.0` — tagged
      ahead of this unit specifically so a real predecessor corpus would exist — precedes the
      tag this unit cuts.
- **Plan:** [`plans/35-w26-toolchain-upgrade.md`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/blob/main/plans/35-w26-toolchain-upgrade.md)

### Rigour: Session Capture

Turning a played session into a fixture, per
[`08-session-capture.md`](08-session-capture.md). **Gated on the hosting layer**, which
MVP §4 defers — there is nothing to capture from a local client the developer drives
themselves.

- [ ] Capture emits a `ReplayFixture` and no new format ([08 §2](08-session-capture.md#2-what-is-captured)).
- [ ] The refusal rules hold under test: no identity, only kind-declared params, no timing
      ([08 §3](08-session-capture.md#3-what-is-refused)). A fixture built from a submission carrying undeclared keys drops them.
- [ ] Capture triggers only on an `error`-severity event or an explicit report — never as
      background collection ([08 §5](08-session-capture.md#5-when-a-capture-may-be-taken)).
- [ ] Promotion into the replay corpus is a reviewed human step, never automatic ([08 §7](08-session-capture.md#7-promotion-is-a-one-way-door)).

### Depth: Life in the Fast Lane (The `simulation` Kind)

- [x] **Specify the kind first, in this repository.** Done across W25 (seam reconciliation)
      and the four-unit programme W32–W35 (field-level port). The simulation equivalent of
      [`03-story-graph-kind.md`](03-story-graph-kind.md) now exists in
      [`10-simulation-kind.md`](10-simulation-kind.md), reconciled with `04` §3, the
      `GameState` envelope, `Kind.outcome`, and the `kind.simulation.*` event namespace
      ([05 §9](05-observability.md#9-kind-events)) — see
      [`plans/36-simulation-kind-programme.md`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/blob/main/plans/36-simulation-kind-programme.md)
      for the full split and findings.
- [x] **Build the engine-owned simulation kind.** Done across W36–W40: state and variables,
      the weekly pipeline, content definitions, the vertical slice, validation, and the real
      `Kind<SimulationKindState>` assembly all run through the core engine seam.
- [x] **Engine-owned "Stable Life" fixture reaches a win and a loss through the replay
      oracle.** W40 commits both paths and records the remaining honest gap: simulation
      projection is not implemented, so neither path is playable through the text client or
      MCP yet. That is separate from the engine/replay milestone and remains part of the full
      game Definition of Done below.
- [ ] **From a proven loop to a played game — W50–W57 below.** W36–W40 proved the kind
      through the engine seam and the replay oracle; it is still not playable by a person,
      and eleven of §3's fifteen end-of-week systems, twenty-eight of §4.2's thirty
      `ActionType`s, §6.1's derived-value layer and §9's projection are all specified and
      unbuilt. Those eight units are that gap, sliced.
- [ ] Its Definition of Done: `games/life-in-the-fast-lane.md`.

### Depth: Sun Trap (The `world-graph` Kind)

The third kind, and the first spatial one. **Specified —**
[`12-world-graph-kind.md`](12-world-graph-kind.md) fixes the seam; the game it serves lives
in [SubZeroDev.SunTrap](https://github.com/The-Running-Dev/SubZeroDev.SunTrap) ([12 §17](12-world-graph-kind.md#17-what-remains-in-the-game-repository)).

**Now has its own programme doc**, the same milestone `simulation` reached with `plans/36`:
[`plans/39-world-graph-kind-programme.md`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/blob/main/plans/39-world-graph-kind-programme.md),
proposing **W41–W49** (one consumer-boundary unit, three contract units, five build units),
cut once Sun Trap's own
design docs (`content-and-systems.md`, `game-design.md`, `mvp.md`, `client-specification.md`)
existed to size it against — the precondition `plans/33`'s own Decision 3 named as missing
when it declined a programme doc for this kind.

- [x] **`KindContext.derive` and the `tick` stream — already built, since W1/W2.** Not a gap
      this kind needs to close: `KindContext.derive` (04 §3.1) and all four `StreamId`
      variants, including `tick` and `agent`, exist in `core/kernel/types.ts`,
      `core/kernel/engine.ts`, `core/determinism/types.ts` and `core/determinism/rng.ts`
      (the encoder, exhaustiveness-guarded). `simulation`'s NPC draws and this kind's tick
      draws already have a reachable home — 04 §3.1's own callout box already documents
      `derive` closing exactly the reachability gap this checkbox describes as still open.
<a id="w41"></a>

- [x] **W41 — companion-package consumer boundary: built, merged, and published.**
      [PR #108](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/108) landed the
      whole boundary: the package renamed to `@the-running-dev/game-engine`, one root export
      (`src/engine/src/index.ts`, explicit named re-exports only), `exports` with `types` and
      `import` targets, `files: ["dist"]` plus a `tsconfig.build.json` that excludes tests and
      `campaigns/` from the emit, a `consumer-smoke/` project that installs the **packed
      tarball** rather than linking the source, three new required-CI steps (pack, tarball
      inspection, consumer smoke — all three verified running green on `main` at `db9c62a`),
      and `release-engine-package.yml` publishing on a `v*` tag with `packages: write` and no
      stored credential. Review also corrected a drift this unit made live: `package.json`
      had never tracked the release tags (`v0.1.0` shipped `0.0.0`; `v0.2.0` and `v0.3.0` both
      shipped `0.1.0`), harmless while private and unpublished, fatal once `npm publish` ships
      what the manifest says. Set to `0.3.0`; tag and manifest move together from here.
      **Now complete.** `@the-running-dev/game-engine@0.4.0` published on the `v0.4.0` tag
      (2026-08-02), verified against the packages API rather than inferred from the workflow's
      exit status; the coordinate is recorded in `plans/40`'s Done-When, and milestone **T0**
      is reached. One deviation, recorded rather than waved through: it published **public**
      where `plans/39` and `plans/40` specify private. That also surfaced a stale claim in
      this file's own introduction, which described every companion repository as private when
      this one and Sun Trap are public — corrected in the same change
      ([`OPEN-QUESTIONS.md`](OPEN-QUESTIONS.md) §2). No read-access grant was needed as a
      result.
      **Plan:** [`plans/40-w41-engine-consumer-boundary.md`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/blob/main/plans/40-w41-engine-consumer-boundary.md)
<a id="w42"></a>

- [x] **W42 — runtime-state contract: merged in
      [PR #116](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/116).** Authoritative
      map, guest, building, queue, staff, construction and finance shapes now live in
      [`12-world-graph-kind.md`](12-world-graph-kind.md) §3. The plan remains the evidence trail:
      [`plans/42-w42-world-graph-state-contract.md`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/blob/main/plans/42-w42-world-graph-state-contract.md),
      including the correction to `plans/39`'s original sizing: six types in
      `WorldGraphKindState`'s closure
      (`Incident`, `ObjectiveProgress`, `Alert`, `TerrainCell`, `PathCell`, `Zone`) are
      drafted in neither repository, so this is design work, not a port.
<a id="w43"></a>

- [x] **W43 — content-definition contract: merged in
      [PR #119](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/119).** Maps,
      archetypes, buildings, products, terrain, incidents, scenarios, objectives, policies,
      and achievements now have their complete source/runtime schema, W42 reconciliation,
      validation tiers, and worked fixtures in `design/20-contract.md`'s
      `engine/12-world-graph-kind.md` block and its generated reader copy. The execution
      record and evidence checklist live in
      [`plans/43-w43-world-graph-content-contract.md`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/blob/main/plans/43-w43-world-graph-content-contract.md),
      which is historical rather than a second contract authority.
<a id="w44"></a>

- [x] **W44 — resolution contract: merged in
      [PR #120](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/120).** The
      20-system pipeline, utility scoring, canonical pathfinding, queue/service and staff-task
      semantics, simultaneous terminal precedence, and deep batch invariance are in
      `design/20-contract.md`'s `engine/12-world-graph-kind.md` block and its generated
      reader copy. Its execution record is
      [`plans/44-w44-world-graph-resolution-contract.md`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/blob/main/plans/44-w44-world-graph-resolution-contract.md),
      which is historical rather than a second contract authority.
<a id="w45"></a>

- [x] **W45 — kind skeleton and immediate actions: merged in
      [PR #125](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/125).** The source/runtime builder,
      total validation, shared spatial substrate, deterministic initial state, read surfaces,
      production assembly, package exports, and nine no-time-passes reducers are reconciled
      in [PR #125](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/125), with
      [PR #124](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/124) retained as
      the original implementation review. The execution record is
      [`plans/45-w45-world-graph-kind-skeleton.md`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/blob/main/plans/45-w45-world-graph-kind-skeleton.md),
      which is historical rather than a second contract authority.
<a id="w46"></a>

- [x] **W46 — deterministic tick pipeline:** fixed-order systems, bounded
      `advance_ticks`, derived streams and batch invariance are delivered in
      [PR #128](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/128), merged to
      `main` at `6301a49`. Its implementation plan is
      [`plans/46-w46-world-graph-tick-pipeline.md`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/blob/main/plans/46-w46-world-graph-tick-pipeline.md);
      it follows the canonical world-graph contract and does not supersede it.
<a id="w47"></a>

- [x] **W47 — MVP vertical slice:** the synthetic guest journey — spawn → walk → queue →
      buy → litter → clean → objective → win/lose — is delivered in
      [PR #131](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/131), merged
      to `main` at `2390750`. It follows the canonical world-graph contract and does not
      supersede it.
<a id="w48"></a>

- [x] **W48 — preview/client parity:** `previewAction` across Engine, session, text and MCP
      surfaces, with 09 §4 and `MVP.md` §5 amended in the same unit, is delivered in
      [PR #133](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/133).
<a id="w49"></a>

- [x] **W49 — validation, scenario and replay guard:** the canonical engine-owned MVP
      fixture and its Tier 1/Tier 2 validation landed in
      [PR #134](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/134); deterministic
      winning and losing replay pairs and release-corpus coverage landed in
      [PR #136](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/136).
      Session-parity replay cases, a clean-build serialization proof, and a consumer-smoke
      rerun landed in [PR #138](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/138).
      W49's engineering scope is complete. Package version selection and publication remain
      external release actions, not evidence this unit claims.
- [ ] **T4 programme gate:** batch invariance and determinism beyond the seed pass; an
      immutable package version must carry the replay-guarded third kind so Sun Trap can
      install it without a sibling checkout.
- **Plan:** [`plans/39-world-graph-kind-programme.md`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/blob/main/plans/39-world-graph-kind-programme.md)

### Depth: Finish the Bulgaria Adventure

### [x] W27 — Bulgaria Adventure: The Driving Arc
The second real arc: `src/engine/src/campaigns/bulgaria-driving.ts`, authored from
`games/bulgaria.md`'s "Driving" and "BMW Ownership" scenes, mirroring
`bulgaria-bureaucracy.ts`'s established pattern. Picked over the other three remaining arcs
because reading the actual built Bureaucracy campaign against the design doc surfaced two real
discrepancies affecting Enterprise and Return specifically — both recorded in
[`OPEN-QUESTIONS.md`](OPEN-QUESTIONS.md) §2, neither resolved here. Demonstrates a branching
ending (two endings, gated by an earlier choice via `showWhen`) that Bureaucracy's single-ending
design never exercised.
- **Spec:** [03 §4](03-story-graph-kind.md#4-choices-and-transitions) (`showWhen`);
      `games/bulgaria.md`, `games/bulgaria-adventure.md`.
- **Depends on:** nothing engine-side — `story-graph` is fully built; this is content only.
- **Status:** Done — [PR #86](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/86).
- **Done when:** both endings are reachable and the wrong-branch choice is absent, not merely
      disabled, verified by test; `serialize()` output for each path is golden-filed and
      round-trips; the determinism harness's sink-independence and replay-byte-identity checks
      pass; test count grows from 39 files/445 tests. Replay-corpus fixtures were found not to
      be cheap for a second campaign — the existing harness assumes one campaign per corpus
      directory (`OPEN-QUESTIONS.md` §2) — so this unit has none; not blocking.
- **Plan:** [`plans/37-w27-bulgaria-driving-arc.md`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/blob/main/plans/37-w27-bulgaria-driving-arc.md)

### [x] W28 — Bulgaria Adventure: The Return Arc
The third real arc: `src/engine/src/campaigns/bulgaria-return.ts`, authored from
`games/bulgaria.md`'s single "Expat Returns" scene. No separate plan file — the pattern was
proven twice by W27, and this arc's own design had no open question to resolve: unlike Driving,
`games/bulgaria-adventure.md` names no mechanic for Return beyond "seeds variables the other
arcs read," already found (`OPEN-QUESTIONS.md` §2, W27) not to be mechanically achievable. The
correct minimal design is therefore a single `choice` node whose four options (matching the
source scene's own four reactions) all converge on one shared `ending` — no invented flag or
branch. Deliberately the smallest arc built so far: one node, no variables, no achievement.
- **Spec:** `games/bulgaria.md`, `games/bulgaria-adventure.md`.
- **Depends on:** nothing engine-side — content only, same as W27.
- **Status:** Done — [PR #87](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/87).
- **Done when:** all four choices reach the one ending; `serialize()` output is golden-filed and
      round-trips; the determinism harness's sink-independence and replay-byte-identity checks
      pass; test count grows from 41 files/478 tests.

### [x] W29 — Bulgaria Adventure: The Inheritance Arc
The fourth real arc: `src/engine/src/campaigns/bulgaria-inheritance.ts`, authored from
`games/bulgaria.md`'s three scenes ("Property Inheritance", "Village Life", "Family Meeting").
Larger than the two before it — `games/bulgaria-adventure.md` names this arc's own exercise as
"branching on prior choices, relationship variables, an ending," which needed real design, not
just transcription. Two variables carry it: `family_tension` (int, visible) accumulates the way
Bureaucracy's own counters do, without gating anything; `has_documentation` (bool, set only by
`request_records` or `consult_lawyer` in the first scene) gates the one choice at the climax
that actually resolves the plot (`bring_out_documents`, via `showWhen`) — that option does not
exist at all for a player who never sought documentation, the clearest possible instance of
"branching on prior choices." A second, different kind of branch: `pretend_never_inherited` in
the second scene skips the climax entirely via an immediate `goto`, rather than a gate. Three
endings result: an early opt-out, an ungated "nothing resolved," and the one gated "documents
settle it" (`outcome: "win"`).
- **Spec:** `games/bulgaria.md`, `games/bulgaria-adventure.md`;
      [03 §4](03-story-graph-kind.md#4-choices-and-transitions) (`showWhen`).
- **Depends on:** nothing engine-side — content only, same as W27/W28.
- **Status:** Done — [PR #88](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/88).
- **Done when:** the gated choice is confirmed absent (not disabled) without prior
      documentation, and present and leading to the win ending with it; the early-opt-out branch
      is confirmed to skip the climax node entirely; `family_tension` accumulates and clamps at
      its floor; `serialize()` output for each of the four fixtures is golden-filed and
      round-trips; the determinism harness's sink-independence and replay-byte-identity checks
      pass; test count grows from 43 files/497 tests.

### [x] W30 — Bulgaria Adventure: The Enterprise Arc
The fifth and final real arc: `src/engine/src/campaigns/bulgaria-enterprise.ts`, authored from
`games/bulgaria.md`'s "Starting a Business" and "Entrepreneur" scenes only — the arc's own third
scene, "Ultimate Reward," and its "It Builds Character" achievement, are already spent by
Bureaucracy (`OPEN-QUESTIONS.md` §2, found during W27). Design proposed for sign-off before
implementation, since inventing closing content is a bigger step than transcribing existing
scenes: `debt_cents` (int, visible) carries what remains of the named exercise
("accumulating debt"), as a running stat in the same idiom as Bureaucracy's own counters, not a
gate; no achievement, since the game's Definition of Done needs only "at least one" across the
whole game; one shared ending rather than a branch, since `games/bulgaria-adventure.md` names
"an ending" for this arc singular, same as the others, and with the achievement gone nothing
remaining calls for more structure. The ending's own prose is new, not adapted from any
`bulgaria.md` scene, since the one this arc was assigned is unavailable.

**All five Bulgaria Adventure arcs are now built** — Bureaucracy (MVP), Driving (W27), Return
(W28), Inheritance (W29), Enterprise (W30).
- **Spec:** `games/bulgaria.md`, `games/bulgaria-adventure.md`.
- **Depends on:** nothing engine-side — content only, same as W27–W29.
- **Status:** Done — [PR #89](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/89).
- **Done when:** all four `starting_a_business` choices proceed to `entrepreneur`; each
      `entrepreneur` choice's `debt_cents` effect is confirmed independently (0, 5000, or
      20000) and all four reach the one ending; `serialize()` output for the high-debt and
      no-debt paths is golden-filed and round-trips; the determinism harness's
      sink-independence and replay-byte-identity checks pass; test count grows from 45
      files/537 tests.

- [ ] Its full Definition of Done beyond content: `games/bulgaria-adventure.md` lists MCP
      parity, gated choices, seeded random, achievement persistence, save/load, validation, and
      byte-identical replay as separate checkboxes, but all seven are platform capabilities
      already proven generically (W7, W14, W16–W18) against Bureaucracy and re-exercised by
      every arc's own test suite since — not separate work per arc.

### [x] W31 — Save Migration
Builds the real save-migration mechanism `04-core.md` §10.2 specifies, closing the gap this
list carried since W3. `Kind` gains `version` and an optional `migrateState`; `Campaign` gains
an optional `migrateState` for content-id renames — neither is a new port
([06 §6](06-extensibility.md#6-adding-a-port)'s own rule rules that out, since a migration
function's whole purpose is to change what `serialize()` produces. `SessionStore.saveGame`
now stamps a real `SaveEnvelope` (`core/persistence/envelope.ts`) instead of a bare blob;
`loadGame` verifies its checksum and all five stamped fields, dispatching to `Kind.migrateState`
then `Campaign.migrateState` on a version mismatch, and failing loudly
(`save_requires_migration` / `migration_failed`) when no migration path resolves one. Proven
against a synthetic kind/campaign fixture, not a real Bulgaria campaign republish — every
shipped campaign is still at `1.0.0`.
- **Spec:** [04 §3](04-core.md#3-the-kind-interface--the-seam), [§10.2](04-core.md#102-save-envelope-and-migration); [06 §6](06-extensibility.md#6-adding-a-port).
- **Depends on:** nothing engine-side.
- **Status:** Done — [PR #92](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/92).
- **Done when:** every base-case save/load test still passes unmodified (the envelope is
      transparent to `SessionStore`'s public surface); a kind-version mismatch with a
      registered migration succeeds and flips `replayCompatible: false`; the same with no
      migration registered fails loudly; a campaign-version mismatch does the same; both axes
      moving at once run kind migration before campaign migration, proven by an ordering
      guard, not just an assertion; a `saveFormatVersion`/`serializationVersion` mismatch fails
      loudly (neither has ever moved); an `engineVersion` mismatch never gates a load; `npm run
      typecheck && npm run lint && npm test` all pass.
- **Plan:** [`plans/38-save-migration-programme.md`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/blob/main/plans/38-save-migration-programme.md)

### [x] W32 — Simulation Kind: State Types
The first contract unit of the simulation-kind programme
([`plans/36-simulation-kind-programme.md`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/blob/main/plans/36-simulation-kind-programme.md),
proposed there as W27). Doc-only — ports upstream §5.1, §5.3–§5.6 and §9.1 into
`10-simulation-kind.md` as new §2.1–§2.5 and §4.1: `CalendarState`, `WorldState` (with its
world-strangeness and chain-scope subsections), `StatusEffect`/`Opportunity`/`ScheduledEvent`/
`PendingEventResponse` (with both lifecycle subsections), `GoalState`, `EconomyState`, and
`WeeklyActionPlan`'s own shape. Introduces this kind's `Cents`/`BasisPoints` primitives and its
sorted-`Record`-iteration rule, both reused by later units. Eight of `SimulationKindState`'s ten
fields are now specified in this repository; only `PlayerState` (W28, next) and the `GameAction`
schema `WeeklyActionPlan.actions` holds (W30) remain.
- **Spec:** [10 §2](10-simulation-kind.md#2-kindstate--what-belongs-here), [§4.1](10-simulation-kind.md#41-the-weekly-action-plan),
      [§15](10-simulation-kind.md#15-what-was-ported-and-what-was-found-along-the-way).
- **Depends on:** [W25](#x-w25--simulation-kind-seam-reconciliation) (the seam must be complete
      before field detail hangs off it, per `plans/36`).
- **Status:** Done — [PR #94](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/94).
- **Done when:** every field named in `SimulationKindState` (§2) except `PlayerState` has a
      full type restated in this repository, reconciled against envelope-duplication and
      forward-referencing not-yet-ported types (`NPCState`, `AgentState`, `GameAction`,
      `Modifier`, `OpportunityDefinition`) by name rather than inventing placeholder shapes;
      §15's table drops the rows this unit closes and gains no new ones; a genuine new open
      item found during the port (`ChainScope`'s `"profile"` value has nowhere to persist) is
      recorded in `OPEN-QUESTIONS.md`, not silently absorbed or dropped; no file under
      `src/engine/` changes; `build/Test-Documentation.ps1` passes.
- **Plan:** [`plans/36-simulation-kind-programme.md`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/blob/main/plans/36-simulation-kind-programme.md)

### [x] W33 — Simulation Kind: Actor State
The second contract unit of the simulation-kind programme
([`plans/36-simulation-kind-programme.md`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/blob/main/plans/36-simulation-kind-programme.md),
proposed there as W28). Doc-only — ports upstream §7 and §8.1–§8.9 into `10-simulation-kind.md`
as new §6.1–§6.11: the base/derived-value layer (`DerivedPath`, application order, stacking,
expiry), the shared `ActorState`/`PlayerState` shape, and its nine areas (identity, finances,
needs, attributes, education, career, housing, inventory, relationships). `ActorState` comes
over whole, shared verbatim by the player and every rival (`plans/36` Finding 1) — not ported
"for the player" with rival support deferred. Every field `SimulationKindState` (§2) names now
has a full shape in this repository.
- **Spec:** [10 §6](10-simulation-kind.md#6-player-state), [§15](10-simulation-kind.md#15-what-was-ported-and-what-was-found-along-the-way).
- **Depends on:** [W32](#x-w32--simulation-kind-state-types).
- **Status:** Done — [PR #95](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/95).
- **Done when:** `ActorState`'s open-keyed `Record` fields (`skills`, `reputation`, `flags`,
      `counters`) are explicitly reconciled against `02-architecture.md` N6 ("the loose bag is
      banned") rather than left to look like an unexamined exception; not-yet-ported types
      (`AgentState`, `NPCState`, `JobDefinition`, `CourseDefinition`, `HousingDefinition`,
      `ItemDefinition`, `BackgroundDefinition`) are forward-referenced by name; the integer
      `0–100` range rule for needs/skills/attributes/reputation is stated somewhere, not
      silently dropped; §15's table drops every row this unit closes; no file under
      `src/engine/` changes; `build/Test-Documentation.ps1` passes.
- **Plan:** [`plans/36-simulation-kind-programme.md`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/blob/main/plans/36-simulation-kind-programme.md)

### [x] W34 — Simulation Kind: Content Definition Types
The third and largest contract unit of the simulation-kind programme
([`plans/36-simulation-kind-programme.md`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/blob/main/plans/36-simulation-kind-programme.md),
proposed there as W29). Doc-only — ports upstream §13.3–§13.4 and §14.1–§14.9 into
`10-simulation-kind.md` as new §7.1–§7.10: `Modifier`/`Reward`, then jobs, courses, housing,
items, events, NPCs, goals/scenarios/difficulty, supporting definitions (opportunities,
achievements, headlines, employers, locations, backgrounds, traits, skills), and agents.
Corrects a factual error in `plans/32`'s Finding H and `plans/36`'s own Finding 2 — both claimed
upstream specifies no rounding rule for `Modifier.operation: "multiply"` against integer-cents
money; checked directly against the primary source while drafting §7.1, and it does ("rounded
half-away-from-zero after the full chain"). Both plan documents corrected in place. Every
upstream section this contract needs except the last unit's own (`ActionType`/`GameAction`,
`Requirement`, end-of-week ordering) is now specified in this repository.
- **Spec:** [10 §7](10-simulation-kind.md#7-content-definition-types), [§8](10-simulation-kind.md#8-conditions-and-requirements),
      [§15](10-simulation-kind.md#15-what-was-ported-and-what-was-found-along-the-way).
- **Depends on:** [W33](#x-w33--simulation-kind-actor-state).
- **Status:** Done — [PR #96](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/96).
- **Done when:** every content type upstream §14.1–§14.9 names has a full shape in this
      repository, with identity fields (`id`/`version`/`titleKey`) excluded per the
      envelope-duplication rule; `Modifier`'s `multiply` semantics are stated precisely
      (basis-points-shaped `value`, round-half-away-from-zero once after the full chain), not
      merely flagged as unresolved; the `plans/32`/`plans/36` correction is recorded in both
      plan documents, not only in the new spec content; not-yet-ported types (`Requirement`,
      `GameAction`, `ActionOutcome`) are forward-referenced by name; §15's table drops every
      row this unit closes and states that exactly one contract unit remains; no file under
      `src/engine/` changes; `build/Test-Documentation.ps1` passes.
- **Plan:** [`plans/36-simulation-kind-programme.md`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/blob/main/plans/36-simulation-kind-programme.md)

### [x] W35 — Simulation Kind: Resolution and Systems
The fourth and final contract unit of the simulation-kind programme
([`plans/36-simulation-kind-programme.md`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/blob/main/plans/36-simulation-kind-programme.md),
proposed there as W30). Doc-only — ports upstream §9, §10, §12.2–§12.3 and §13.2 into
`10-simulation-kind.md`: `ActionType`/`GameAction` (§4.2), the resolver dispatch mechanism and
per-action outcome (§5.1–§5.3, reconciled against `04-core.md`'s already-adopted
`StateChange`/`ValidationError`/`ValidationWarning` rather than restating upstream's own
divergent pre-adoption shapes), end-of-week system order and goal/failure precedence (§3), and
`Requirement`/`RequirementType` (§8.1). Closes **S1** of the programme's milestones — every
type `SimulationKindState` names, every content definition type, and the mechanics that
dispatch on both are now specified in this repository; `10-simulation-kind.md` stops being
"the seam only."

Three reconciliation findings, not plain transcription: this kind's own runtime-validation
result needed a name (`ActionValidation`) distinct from `04-core.md`'s load-time
`ValidationResult` — upstream never had to disambiguate the two, having no campaign-validation
concept of its own to collide with. `ResolutionDebugInfo` (upstream §3.3) is superseded, not
ported — this platform's `trace`-severity observability channel already serves its purpose, and
the `metadata.transparency` field it would gate on lives outside `SimulationKindState` entirely.
And `wrong_location` — load-bearing in `LocationDefinition`'s own prose since W34 — was missing
from §10's reason-code table, a real gap caught while finishing this unit, not a pre-existing
one reported from elsewhere.
- **Spec:** [10 §3](10-simulation-kind.md#3-the-turn-is-a-week), [§4.2](10-simulation-kind.md#42-action-types),
      [§5.1](10-simulation-kind.md#51-resolver-dispatch), [§8.1](10-simulation-kind.md#81-requirements),
      [§15](10-simulation-kind.md#15-what-was-ported-and-what-was-found-along-the-way).
- **Depends on:** [W34](#x-w34--simulation-kind-content-definition-types).
- **Status:** Done — [PR #97](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/97).
- **Done when:** `ActionType`/`GameAction` are specified with no client-supplied cost fields;
      the resolver dispatch mechanism (`ActionResolver`, `ResolverTable`) is reconciled against
      `KindContext` (04 §3.1) rather than upstream's own bespoke `ResolutionContext`; per-action
      outcome types reuse `04-core.md`'s `StateChange`/`OutcomeMessage`/`ValidationError`/
      `ValidationWarning` verbatim rather than restating upstream's divergent versions;
      end-of-week ordering states plainly that `weekLimit` has no scheduled check anywhere in
      it, reinforcing rather than merely repeating §12's existing open callout; every stale
      "§7/§9, once ported" forward reference written across W32–W34 (16+ instances) is fixed to
      point at a real section; §15 is rewritten from "what remains" to a historical record with
      no open rows; no file under `src/engine/` changes; `build/Test-Documentation.ps1` passes.
- **Plan:** [`plans/36-simulation-kind-programme.md`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/blob/main/plans/36-simulation-kind-programme.md)

### [x] W36 — Simulation Kind: State, Variables, and the Plan
First **build** unit of the simulation-kind programme (`plans/36-simulation-kind-programme.md`,
proposed there as W31, mirroring story-graph's W9). `SimulationKindState` and every nested
runtime-state type (`src/engine/src/kinds/simulation/state.ts`, `actor.ts`) as real TypeScript,
plus `ActionType`/`GameAction`/`WeeklyActionPlan` and pure `plan.add`/`remove`/`clear` reducers
(`plan.ts`) — standalone functions, not wired into `Kind.advance` yet, the same precedent W9
set for `applyConsequences`. `removeAction` rejects an out-of-range index as a genuine runtime
rejection (`action_not_planned`), not a throw — a stale client index is ordinary play, unlike
W9's undeclared-variable case.
- **Spec:** [10 §2](10-simulation-kind.md#2-kindstate--what-belongs-here), [§4.1](10-simulation-kind.md#41-the-weekly-action-plan),
      [§4.2](10-simulation-kind.md#42-action-types), [§6](10-simulation-kind.md#6-player-state).
- **Depends on:** [W35](#x-w35--simulation-kind-resolution-and-systems).
- **Status:** Done — [PR #98](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/98).
- **Done when:** every field `SimulationKindState`/`ActorState` names in the contract has a
      real TypeScript type; `addAction`/`clearPlan` never mutate their input plan;
      `removeAction` rejects a negative index, an index equal to the plan's length, and a
      non-integer index, all with `action_not_planned`; no `Kind.advance`/`kernel/engine.ts`
      wiring exists yet; `npm run typecheck && npm run lint && npm test` all pass.
- **Plan:** [`plans/36-simulation-kind-programme.md`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/blob/main/plans/36-simulation-kind-programme.md)

### [x] W37 — Simulation Kind: The Week
Second build unit of the simulation-kind programme (`plans/36-simulation-kind-programme.md`,
proposed there as W32, mirroring story-graph's W11+W12 combined). `Kind.initialState`,
`Kind.advance` (`plan.add`/`remove`/`clear`/`end_week`), the resolver dispatch table, and
the full 4-step start-of-week + 14-step end-of-week system pipeline, all real and wired
through `createEngine`/`submitAction` for the first time.

Most end-of-week systems (`employment`, `education`, `housing`, `finance_*`, `opportunities`'
offer/revoke, `events`, `headline`, `goals`, `failure`, `achievements`) are explicit,
individually-documented stubs — each needs a content type (`JobDefinition`,
`CourseDefinition`, …) that doesn't exist until the content-definition-types build unit, a
genuine dependency this unit's own research surfaced rather than one story-graph's W11/W12
ever had to solve (its "content" — the node graph — already existed by then). `needs` drift
and opportunity expiry are real logic; every stub is documented at its own definition site,
not silently doing nothing. The `ResolverTable` (`resolvers.ts`) uses one shared stub
resolver for all 30 `ActionType`s, built as a real object literal (not `Object.fromEntries` +
a cast) specifically so TypeScript's own exhaustiveness check has teeth — verified directly
by temporarily deleting an entry and confirming the compiler catches it.
- **Spec:** [10 §3](10-simulation-kind.md#3-the-turn-is-a-week), [§5](10-simulation-kind.md#5-resolution-and-statechange),
      [§5.1](10-simulation-kind.md#51-resolver-dispatch).
- **Depends on:** [W36](#x-w36--simulation-kind-state-variables-and-the-plan).
- **Status:** Done — [PR #99](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/99).
- **Done when:** `initialState` builds week-one state from a synthetic `SimulationCampaign`;
      start-of-week increments the week, resets spent time, and expires effects correctly;
      end-of-week runs all fourteen named systems in the documented order (verified via
      `kind.simulation.system.ran`'s own emitted order, since most systems are stubs and
      can't be distinguished by their state effects alone); needs drift clamps to `0–100`
      and emits one `StateChange` per touched need; a real `createEngine`/`submitAction`
      round trip runs `plan.add` then `end_week` and lands on the next week with a fresh,
      empty plan; `npm run typecheck && npm run lint && npm test` all pass (641 tests, was
      607).
- **Plan:** [`plans/36-simulation-kind-programme.md`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/blob/main/plans/36-simulation-kind-programme.md)

### [x] W38 — Simulation Kind: Content-Definition Types
Third build unit of the simulation-kind programme — but no longer the single unit
`plans/36-simulation-kind-programme.md` originally proposed as W33. That unit assumed
story-graph's own precedent — *author content against already-coded types* — held here; it
doesn't, since this kind's content-definition types (contract §7) were deferred to the
doc-only contract phase (W34) rather than built as code the way story-graph's were across
W9–W13. `plans/36` now splits W33 into W38–W40; see that document's own callout under *Build*
for the reasoning. This unit is the first: port contract §7 to
`src/engine/src/kinds/simulation/content.ts` — `Reward`, `JobDefinition` (+6 nested types), `CourseDefinition`,
`HousingDefinition`, `ItemDefinition` (+1 nested), `EventDefinition` (+5 nested),
`NPCDefinition`, `GoalDefinition`/`ScenarioDefinition`/`DifficultyDefinition`,
`OpportunityDefinition`/`AchievementDefinition`/`HeadlineDefinition`/`EmployerDefinition`/
`LocationDefinition`/`BackgroundDefinition`/`TraitDefinition`/`SkillDefinition`, and
`AgentStrategy`. `NPCState`/`AgentState`/`NPCMemory`/`NPCRelationship`/`AvailabilityRule`/
`Modifier` already exist (`state.ts`, W36) as runtime state — this unit ports only their
content-side counterparts, and everything else §7 names. No system/resolver wiring here —
that's W39's job, against a settled type surface, the same "contract before code" discipline
the four contract units (W32–W35) already used one level up.
- **Spec:** [10 §7](10-simulation-kind.md#7-content-definition-types), [§7.1](10-simulation-kind.md#71-modifiers-and-rewards)–[§7.10](10-simulation-kind.md#710-agents--engine-owned-strategy-definition-and-runtime-state).
- **Depends on:** [W37](#x-w37--simulation-kind-the-week).
- **Status:** Done — [PR #100](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/100).
- **Done when:** every type §7 names that isn't already runtime state in `state.ts`/`actor.ts`
      exists in `content.ts`; `AvailabilityRule.condition` — `unknown` since W36, deferred per
      its own comment there — is narrowed to the real core `Condition` type, this unit's
      natural import point for it; `npm run typecheck && npm run lint && npm test` all pass
      with no new runtime logic — this unit is types only.
- **Plan:** [`plans/36-simulation-kind-programme.md`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/blob/main/plans/36-simulation-kind-programme.md)

### [x] W39 — Simulation Kind: Wiring the "Stable Life" Vertical Slice {#w39}
Fourth build unit — the second half of the W33 split. Wires real logic into exactly the
systems and `RESOLVER_TABLE` entries a goal-driven win/loss loop needs, against W38's
content types — not all twelve stubbed end-of-week systems or all thirty `ActionType`s.
Real now: `goals` and `failure` (evaluate `GoalDefinition.conditions`/`failureConditions`
via a new `conditions.ts`, tracking `GoalState`'s persistent-goal fields per §2.4 —
`consecutiveWeeksSatisfied` resets to zero on any unsatisfied week, `status` becomes
`"completed"` once it reaches `requiredDurationWeeks`, default 1); `eat`/`rest` (the two
resolvers give the player any way to counter `needs` drift at all — without them no
needs-based goal could ever be won); `Kind.outcome` (`outcome.ts`, §12's terminal-identity
shape); and `advance.ts`'s `end_week` now reports `status: "ended"` once `outcome()`
resolves non-null. Everything else (`employment`, `education`, `housing`, `finance_*`,
`inventory`, `relationships`, `opportunities`' offer/revoke, `events`, `headline`,
`achievements`) stays an honest, documented stub — the same discipline W37 established.

**This is deliberately a smaller loop than the real game's own "Stable Life," not a first
pass at the whole thing.** The real scenario (`games/03-game-design.md` §16.3 in the
companion `SubZeroDev.GameOfLife` repo) needs six completion criteria across employment,
education, housing and finance together — wiring all of that is its own multi-unit depth
effort, not this unit's job. This mirrors story-graph's own W15 Bureaucracy-campaign
precedent: the engine repo proves the mechanism with a synthetic fixture; the real,
full-depth flagship content is a companion-repo concern layered on afterward.

Two acknowledged, documented gaps carried from `outcome.ts`: `week_limit_reached` is never
returned (`state` alone carries no `weekLimit` to compare against, and §12 itself calls the
precedence question upstream-unresolved), and a mixed multi-goal outcome (some completed,
some failed) resolves conservatively to `"failed"` — verified only against this unit's own
single-goal tests, not a settled rule.

`SimulationCampaign` (`campaign.ts`) gained exactly two fields for this: `goals: readonly
GoalDefinition[]` and `goalFailurePrecedence` — still not the real authoring surface
(`ScenarioDefinition` integration is W40's job), just what this unit's own wiring needs.
- **Spec:** [10 §5](10-simulation-kind.md#5-resolution-and-statechange), [§3](10-simulation-kind.md#3-the-turn-is-a-week),
      [§12](10-simulation-kind.md#12-terminal-identity).
- **Depends on:** [W38](#x-w38--simulation-kind-content-definition-types).
- **Status:** Done — [PR #101](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/101).
- **Done when:** a goal with no `requiredDurationWeeks` completes the first week its
      condition is met; a persistent goal requires that many consecutive satisfied weeks,
      resetting on any miss; `goalFailurePrecedence` resolves a goal whose completion and
      failure conditions trip the same week (`"goals_win"`, the default, completes it
      anyway; `"failure_wins"` fails it instead); `eat`/`rest` restore the needs they target,
      clamped; `advance`'s `end_week` reports `status: "ended"` once `outcome()` resolves;
      every stub is still individually documented; `npm run typecheck && npm run lint &&
      npm test` all pass (669 tests, was 644).
- **Plan:** [`plans/36-simulation-kind-programme.md`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/blob/main/plans/36-simulation-kind-programme.md)

### [x] W40 — Simulation Kind: The "Stable Life" Scenario, Validation, and Corpus
Fifth build unit — the third and last piece of the W33 split, mirroring story-graph's
W14+W15+W22 combined (the original mirror `plans/36` gave W33 as a whole), now that W38/W39
give it real types and real logic to author and validate against. Authors the "Stable Life"
fixture `SimulationCampaign` (`campaigns/stable-life.ts` — one goal, "Well Rested": maintain
`player.needs.energy` at or above 70 for two consecutive weeks, failing outright below 40),
Tier 1/2 `validateCampaign` for the simulation kind (`kinds/simulation/validate.ts`), the
real `Kind<SimulationKindState>` assembly (`kinds/simulation/kind.ts`, mirroring
`kinds/story-graph/kind.ts`'s own role), and commits replay-corpus fixtures
(`fixtures/replay/stable-life-{win,loss}.*.json`) for both paths — folded together per
`plans/36`'s own original reasoning: the scenario *is* the test subject. Reaches this
programme's **S3**/**S4** milestones — with one criterion honestly short, below.

**Validation is scoped to what `SimulationCampaign` actually carries** (`goals`,
`goalFailurePrecedence`) — not §14's full list across every content-definition type, most
of which this campaign shape has no field for yet. `kinds/simulation/validate.ts`'s own
header names exactly what's checked (goal id uniqueness, `LocKey` resolution) and defers
the rest to whichever future unit adds the collection each check needs.

**Two committed fixtures, both captured by running the real engine once, not hand-typed:**
`stable-life-win` (three weeks of `rest`, completing the goal — two consecutive satisfied
weeks, not one, is the actual proof of `endOfWeek.ts`'s persistence tracking) and
`stable-life-loss` (four weeks of nothing, tripping `failureConditions`). Fixing these
fixtures also surfaced a real, previously-latent bug: `bulgaria-bureaucracy.replay.test.ts`
(W22) enumerated *every* `*.fixture.json` in the shared `fixtures/replay/` directory,
having never anticipated a second kind landing fixtures beside its own — it then tried to
replay `stable-life-*` through the story-graph-only registry and failed with
`campaign_withdrawn`. Fixed by prefix-filtering both suites (`bureaucracy-`/`stable-life-`)
and wiring `stable-life.replay.test.ts` into `ci.yml`'s release-tag-replay job alongside
bureaucracy's, with the same `skipIf`-style guard for a baseline tag that predates this
corpus entirely.

**Honest scope gap: win/loss are not reachable through the text client or MCP.** The
original "Done when" below asked for that; `scene`/`availableActions`/`project`
(`kinds/simulation/kind.ts`) are placeholders, because §9 (Projection) is still prose-only
in the contract — no `SimulationView`/`PublicWorldState` shape exists to implement against.
This unit's actual consumer, the replay oracle, never calls those three methods (only
`createGame`/`submitAction`), so it doesn't need them — but a text-client/MCP playthrough
does, and that's a real, separate future unit (story-graph's own equivalent, W16/W17, came
*after* its turn loop already worked, not bundled into W14/W15). Recorded here rather than
quietly dropped from the criteria.
- **Spec:** [10 §14](10-simulation-kind.md#14-validation), [07 §4](07-replay.md#4-the-corpus).
- **Depends on:** [W39](#w39).
- **Status:** Done — [PR #102](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/102).
- **Done when:** Tier 1/2 validation rejects a duplicate goal id and an unresolved `LocKey`
      for this kind's own content; one win fixture and one loss fixture are committed under
      `fixtures/replay/` and pass the replay oracle, including the release-tag-replay CI job;
      `npm run typecheck && npm run lint && npm test` all pass (677 tests, was 669). Win/loss
      through the text client and MCP is **not** met — see the gap noted above.
- **Plan:** [`plans/36-simulation-kind-programme.md`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/blob/main/plans/36-simulation-kind-programme.md)

### Depth: Life in the Fast Lane Becomes Playable

Eight units taking the `simulation` kind from *proven through the replay oracle* to *played by
a person*. W36–W40 built the state, the week pipeline, the content types and a minimal
goal-driven loop; everything below is contract that exists and code that does not.

**Ordered so the riskiest assumption goes first.** The platform's central claim is that a
client is a projection of the session store (09 §1) — and one of three kinds currently cannot
be projected at all, which W40 recorded honestly rather than dropping. W50 tests that claim.
W51 comes second because the derived-value layer is what every unit after it reads through,
and its rounding rule is the most replay-sensitive line in the kind.

### [ ] W50 — Simulation Kind: Projection and Client Parity {#w50}

**Delivers:** Makes Life in the Fast Lane something a person can actually play. Today the
simulation kind runs only inside the replay harness — a game starts, a week is planned and
ended, and nothing can show you the result, because `scene`, `availableActions` and `project`
are placeholders returning empty values. This unit fixes what a client is allowed to see and
builds it, so the "Stable Life" scenario can be won and lost through the text client and
through MCP.

W40 named this gap in its own done-criteria rather than quietly meeting a weaker bar.
[10 §9](10-simulation-kind.md#9-projection) is prose-only: it states the rule — `SimulationView`
carries **only what the generic surface does not**, the rule
[03 §9](03-story-graph-kind.md#9-projection--what-a-client-sees) already follows — but declares
no shape. `PublicWorldState`, which
[§7.10](10-simulation-kind.md#710-agents--engine-owned-strategy-definition-and-runtime-state)'s
`AgentStrategy.selectActions` takes as its first parameter, is referenced in the contract and
declared nowhere at all.

**This unit amends §9 in the same change that implements it**, the precedent W48 set when it
amended [09 §4](09-clients.md#4-the-api-coverage-checklist) and
`MVP.md` §5 alongside `previewAction`. That is deliberate and narrow: §9's *rule* is settled,
and what is missing is the field list it implies — not a design decision. If drafting the shape
turns out to require one, that is `/contract`'s call, not this unit's.

**The envelope-duplication ledger is the live risk, and it has bitten the view side before** —
entry 3, `StoryGraphView` duplicating scene and status fields. `SimulationView` has ten
`SimulationKindState` fields to choose from, next to a `GameState` envelope and a generic
`Scene`/`PlayerView` that already carry identity, status and turn.
- **Spec:** [10 §9](10-simulation-kind.md#9-projection),
      [§2](10-simulation-kind.md#2-kindstate--what-belongs-here),
      [§4](10-simulation-kind.md#4-actions--one-model-richer-verbs),
      [§10](10-simulation-kind.md#10-reason-codes), [§11](10-simulation-kind.md#11-events);
      [03 §9](03-story-graph-kind.md#9-projection--what-a-client-sees) (the rule to follow);
      [04 §6](04-core.md#6-scenes-and-actions-generic), [§9](04-core.md#9-projection);
      [09 §4](09-clients.md#4-the-api-coverage-checklist),
      [§6](09-clients.md#6-projection-is-not-optional).
- **Touches:** `design/20-contract.md` (the `engine/10-simulation-kind.md` block, §9 and §11);
      `src/engine/src/kinds/simulation/` — new `view.ts`, `scene.ts`, `available.ts`, and
      `kind.ts`'s three placeholders; `src/engine/src/clients/text/render.ts`;
      `src/engine/src/mcp/server.ts`; `design/10-design.md` (09 §4's checklist).
- **Depends on:** [W40](#x-w40--simulation-kind-the-stable-life-scenario-validation-and-corpus).
- **Status:** Not started.
- **Done when:**
  - W50.1 Contract §9 declares `SimulationView` and `PublicWorldState` as complete TypeScript
        interfaces with every field named, and `AgentStrategy.selectActions` (§7.10) resolves
        against the declared `PublicWorldState` rather than an undeclared name.
  - W50.2 No `SimulationView` field repeats one the `GameState` envelope, the generic `Scene`,
        or `PlayerView` already carries — asserted by a test that names the envelope fields and
        checks each is absent, not by review.
  - W50.3 `project` never emits `seed`, `actionLog`, raw `kindState`, `AgentState.strategy`,
        `RelationshipState.resentment`, or an unrevealed `Opportunity`, for either audience;
        each is asserted by name, and the `ai` audience is not wider than `player`.
  - W50.4 `availableActions` returns `plan.add`, `plan.remove`, `plan.clear` and `end_week`
        with the params §4 declares for each; where the campaign forbids an empty plan,
        `end_week` renders disabled with `plan_empty` rather than being hidden.
  - W50.5 `scene` renders from registry strings only; a `LocKey` it references but the registry
        does not resolve fails registry construction rather than rendering a raw key at play.
  - W50.6 Playing `stable-life` to its committed win through the text client and through MCP,
        under the same seed and the same counting `IdSource`, produces **byte-identical**
        `serialize()` output — 09 §1's proof, now exercised for the first kind whose actions
        carry declared `params`.
  - W50.7 [09 §4](09-clients.md#4-the-api-coverage-checklist)'s coverage checklist has a
        simulation column complete for all ten operations, each ticked against a named passing
        test rather than an assertion of intent.
  - W50.8 All eight events [§11](10-simulation-kind.md#11-events) declares are emitted at the
        points that section names and listed in `Kind.eventNames`; a golden event stream for a
        full `stable-life` win covers their order, and a name outside `kind.simulation.*` fails.
- **Out of scope:** wiring any additional resolver or end-of-week system — the projection shows
      what the kind already computes, and W51–W57 add behaviour behind it. Also out of scope:
      a rival agent actually running. `PublicWorldState` is declared here because
      `AgentStrategy` cannot typecheck without it, not because this unit builds agents — how a
      scenario configures rivals is an open gap §7.10 states outright.

### [ ] W51 — Simulation Kind: Derived Values, Modifiers, and Effects {#w51}

**Delivers:** Makes a status effect or a trait actually change what the player can do — a
"reduced hours" effect really lowers the time available that week, a bonus really shifts a
cost — instead of every number in the game being the raw stored one.

[§6.1](10-simulation-kind.md#61-base-and-derived-values)'s base/derived layer is the substrate
every resolver and every end-of-week system in W52–W57 reads through, and none of it exists:
`DerivedPath`, `DerivedValueResolver`, application order, stacking and expiry are absent from
`src/engine/src/kinds/simulation/` entirely.
[§7.1](10-simulation-kind.md#71-modifiers-and-rewards)'s `Modifier`/`Reward` application is
likewise unbuilt — including the `multiply` rounding rule W34 checked against the primary
source and corrected two plan documents over (basis-points `value`, round half-away-from-zero
**once** after the full chain), which is the single most replay-sensitive line in this kind.

A substrate on its own is not a vertical slice, so this one is paired with the place it is
already observable without any new content: start-of-week `time_commit`
([§3](10-simulation-kind.md#3-the-turn-is-a-week)), whose two-phase split exists precisely so
an expiring effect changes committed time correctly. That makes the unit provable end to end
rather than a layer added on faith.
- **Spec:** [10 §6.1](10-simulation-kind.md#61-base-and-derived-values),
      [§7.1](10-simulation-kind.md#71-modifiers-and-rewards),
      [§2.3](10-simulation-kind.md#23-effects-opportunities-and-scheduled-events),
      [§3](10-simulation-kind.md#3-the-turn-is-a-week),
      [§13](10-simulation-kind.md#13-determinism).
- **Touches:** `src/engine/src/kinds/simulation/` — new `derived.ts` and `modifiers.ts`, plus
      `startOfWeek.ts`, `endOfWeek.ts`, `state.ts`; `src/engine/fixtures/replay/`.
- **Depends on:** [W50](#w50).
- **Status:** Not started.
- **Done when:**
  - W51.1 Every `DerivedPath` §6.1 names resolves through `DerivedValueResolver`; a path that
        is not a declared derived path fails at load with its path, not at read.
  - W51.2 Modifier application follows §6.1's stated order and stacking rule: two modifiers
        touching the same path produce the identical result in either registration order,
        proven by a test that applies them both ways round.
  - W51.3 `Modifier.operation: "multiply"` against integer `Cents` rounds half-away-from-zero
        exactly once after the full chain — a test shows a three-multiply chain differing from
        three separately-rounded multiplies, so the rule is proven rather than assumed.
  - W51.4 An `activeEffect` reducing committed time changes the budget in `time_commit` and
        not in `time_advance`; a fixture where that effect expires the same week shows the
        un-reduced budget, proving the two phases have not been collapsed.
  - W51.5 A derived value is visible through `SimulationView` (W50) and never persisted —
        `serialize()` output contains base values only, asserted over the canonical string.
  - W51.6 A replay fixture covering an effect applying and expiring is committed and passes
        the oracle; the determinism harness's sink-independence and byte-identity checks pass.
- **Out of scope:** the content that grants effects. Jobs, courses and items arrive with their
      own units; this one proves the mechanism against a hand-authored effect on the existing
      "Stable Life" fixture, the same way W39 proved goals against a single synthetic goal.

### [ ] W52 — Simulation Kind: The Scenario Campaign and Full Validation {#w52}

**Delivers:** Replaces the hand-assembled test fixture with a real authored scenario — a
starting background, home, job, location, inventory and week cap that a content author writes
— and makes the loader reject a broken one with a path to the mistake instead of failing at
play.

`SimulationCampaign` carries five starting-state blobs plus `goals` and
`goalFailurePrecedence`, and its own header says it is "deliberately minimal, not the real
authoring surface." Every [§7](10-simulation-kind.md#7-content-definition-types) content
collection exists as a type and has nowhere to live. There is no source/runtime split for this
kind at all — `story-graph` and `world-graph` each have one — so
[04 §10.1](04-core.md#101-content-registry)'s authoring boundary is asserted for two kinds and
proven for two of three. And [§14](10-simulation-kind.md#14-validation)'s Tier 1 list names
seventeen content types whose ids must be unique and whose cross-references must resolve;
what is implemented is goal-id uniqueness and one `LocKey`.
- **Spec:** [10 §7.8](10-simulation-kind.md#78-goals-scenarios-and-difficulty),
      [§7.9](10-simulation-kind.md#79-supporting-definitions),
      [§14](10-simulation-kind.md#14-validation);
      [04 §10.1](04-core.md#101-content-registry), [§11](04-core.md#11-tiered-validation),
      [§17](04-core.md#17-identifier-conventions).
- **Touches:** `src/engine/src/kinds/simulation/` — `campaign.ts`, `validate.ts`, `initial.ts`,
      and a new `source.ts`; `src/engine/src/campaigns/stable-life.ts` and new broken fixtures
      beside it.
- **Depends on:** [W50](#w50).
- **Status:** Not started.
- **Done when:**
  - W52.1 `SimulationCampaignSource` → `SimulationCampaign` is a pure builder performing no
        file or network I/O, and every §7 collection §14 validates has a field on the runtime
        root.
  - W52.2 `initialState` builds week one from a `ScenarioDefinition` — starting backgrounds,
        housing, location, inventory and week cap — rather than from five literal state blobs.
  - W52.3 Each of §14's Tier 1 checks fails with a path: a duplicate id within every one of
        the seventeen content types independently, and each named cross-reference
        (`PromotionPath.toJobId`, `ScenarioDefinition.startingBackgroundIds`,
        `startingHousingId`, `startingLocationId`, `goalIds`,
        `startingInventory[].definitionId`) pointing at an id that does not exist.
  - W52.4 Each of §14's Tier 2 checks warns and still loads, reported rather than swallowed.
  - W52.5 A deliberately broken campaign fixture exists per Tier 1 family — the same
        instrument W15 built for `story-graph` — and each produces its expected tier and path.
  - W52.6 The re-authored "Stable Life" campaign reaches its committed win and loss fixtures
        byte-identically; if a fixture legitimately changes, it is regenerated by the
        deliberate per-fixture command ([07 §7](07-replay.md#7-intended-change-versus-regression))
        and named in the PR — never an automatic sweep.
- **Out of scope:** making any newly authorable content *do* anything. A `JobDefinition` this
      unit lets an author write and the validator accept is still resolved by `stubResolver`
      until W53. This is the authoring and loading surface, not behaviour.

### [ ] W53 — Simulation Kind: Employment and Income {#w53}

**Delivers:** The player can look for work, apply for a job, negotiate its terms and then
actually work it — and be paid for it at the end of the week.
- **Spec:** [10 §7.2](10-simulation-kind.md#72-jobs),
      [§7.9](10-simulation-kind.md#79-supporting-definitions) (employers),
      [§6.8](10-simulation-kind.md#68-career), [§3](10-simulation-kind.md#3-the-turn-is-a-week)
      (`employment`, `finance_income`), [§5.1](10-simulation-kind.md#51-resolver-dispatch)–[§5.3](10-simulation-kind.md#53-per-action-outcome),
      [§10](10-simulation-kind.md#10-reason-codes).
- **Touches:** `src/engine/src/kinds/simulation/` — `resolvers.ts`, `endOfWeek.ts`,
      `reasons.ts`; `src/engine/src/campaigns/stable-life.ts`;
      `src/engine/fixtures/replay/`.
- **Depends on:** [W51](#w51), [W52](#w52).
- **Status:** Not started.
- **Done when:**
  - W53.1 `work`, `work_overtime`, `search_for_work`, `apply_for_job` and
        `negotiate_job_terms` each have a real `ActionResolver` — `canExecute`, `calculate`,
        `apply` — and none of the five is `stubResolver`.
  - W53.2 Time and money cost are computed by `calculate` from state and content; a plan
        exceeding the week's time units is rejected with `insufficient_time`, leaving state
        byte-identical and the action log unadvanced.
  - W53.3 `apply_for_job` against a job whose requirements are unmet is rejected with
        `requirement_unmet`; an employment action whose type is not in the current location's
        `actionTypes` is rejected with `wrong_location`.
  - W53.4 The `employment` system advances `Employment.performance` and any `PromotionPath` it
        satisfies; `finance_income` pays wages **before** `housing` runs, proven by a fixture
        whose rent is payable only out of that same week's wages.
  - W53.5 Every random draw comes from `ctx.rng`; adding a draw to one resolver does not shift
        another's results, proven by a substream test rather than asserted from §13.
  - W53.6 A replay fixture covering a full search → apply → hire → first paycheque arc is
        committed and passes the oracle.
- **Out of scope:** education, housing costs, debt and possessions — W54 to W56. A job's
      training requirement may name a `CourseDefinition` id the validator resolves, but taking
      the course is W54's work.

### [ ] W54 — Simulation Kind: Education and Skills {#w54}

**Delivers:** The player can enrol on a course, attend it, study for it, and come out with a
skill that changes which jobs they can hold — or withdraw and lose the fees.
- **Spec:** [10 §7.3](10-simulation-kind.md#73-courses),
      [§7.9](10-simulation-kind.md#79-supporting-definitions) (skills),
      [§6.7](10-simulation-kind.md#67-education),
      [§3](10-simulation-kind.md#3-the-turn-is-a-week) (`education`),
      [§8.1](10-simulation-kind.md#81-requirements).
- **Touches:** `src/engine/src/kinds/simulation/` — `resolvers.ts`, `endOfWeek.ts`,
      `startOfWeek.ts`; `src/engine/src/campaigns/stable-life.ts`;
      `src/engine/fixtures/replay/`.
- **Depends on:** [W53](#w53).
- **Status:** Not started.
- **Done when:**
  - W54.1 `enroll_course`, `attend_class`, `study` and `withdraw_course` each have a real
        resolver, and none is `stubResolver`.
  - W54.2 Enrolling adds a course commitment that start-of-week `time_commit` includes in
        committed time, and withdrawing removes it the same week — exercised by a fixture in
        which one course ends the week another begins.
  - W54.3 The `education` system advances progress only for courses attended that week, and
        awards the course's skill exactly once on completion however many weeks follow.
  - W54.4 A skill awarded here satisfies a `JobDefinition` requirement W53 built, proven by a
        fixture where `apply_for_job` is rejected before the course and accepted after it.
  - W54.5 Enrolling without the fee is rejected with `insufficient_funds`; enrolling twice on
        the same course is rejected and leaves the existing enrolment untouched.
  - W54.6 A replay fixture covering enrol → attend → complete → qualify is committed and
        passes the oracle.
- **Out of scope:** careers beyond what W53 built, and rival actors studying — agents are
      unbuilt for the reason W50's *Out of scope* records.

### [ ] W55 — Simulation Kind: Housing, Debt, and Reconciliation {#w55}

**Delivers:** Rent, bills, borrowing and eviction — the half of the week that happens whether
the player plans for it or not.

This is where the contract's most carefully argued ordering rule lands.
[§3](10-simulation-kind.md#3-the-turn-is-a-week) splits finance into `finance_income` before
`housing` and `finance_reconcile` after it, and states exactly what each single-pass
alternative breaks: rent charged before wages arrive produces false overdrafts for a solvent
player, while reconciling before housing lags eviction escalation by a full week. W53 built
the first of the three; this unit builds the other two, and is the first that can prove the
split was necessary rather than merely argued.
- **Spec:** [10 §7.4](10-simulation-kind.md#74-housing),
      [§6.4](10-simulation-kind.md#64-finances), [§6.9](10-simulation-kind.md#69-housing),
      [§3](10-simulation-kind.md#3-the-turn-is-a-week) (`housing`, `finance_reconcile`),
      [§10](10-simulation-kind.md#10-reason-codes).
- **Touches:** `src/engine/src/kinds/simulation/` — `resolvers.ts`, `endOfWeek.ts`;
      `src/engine/src/campaigns/stable-life.ts`; `src/engine/fixtures/replay/`.
- **Depends on:** [W53](#w53).
- **Status:** Not started.
- **Done when:**
  - W55.1 `move_housing`, `pay_bills`, `borrow_money`, `repay_debt`, `deposit_savings` and
        `invest` each have a real resolver, and none is `stubResolver`.
  - W55.2 `housing` levies `HousingDefinition.weeklyCostCents` after `finance_income` has paid
        wages: a fixture whose only income arrives that week pays rent successfully, and the
        same inputs with the two systems' order swapped overdraw — the ordering is proven by
        outcome, not by reading the list.
  - W55.3 `finance_reconcile` applies late fees and advances eviction only against balances
        `housing` charged this week; a first missed rent advances eviction by exactly one step.
  - W55.4 Every money value is integer `Cents`; no floating-point money value appears in
        `serialize()` output, checked over the canonical string rather than by inspection.
  - W55.5 `move_housing` to a home the player cannot afford is rejected with
        `insufficient_funds` and leaves the current housing untouched.
  - W55.6 Two replay fixtures are committed and pass: one reaching eviction, one avoiding it
        by a single week's wages.
- **Out of scope:** items and their upkeep (W56), and any economy-wide drift in prices or
      wages — `EconomyState` moves only where a system this unit builds moves it.

### [ ] W56 — Simulation Kind: Possessions, Places, and People {#w56}

**Delivers:** Shopping, keeping what you own working, getting around town, and having a social
life — the actions that make a week feel like a life rather than a spreadsheet.
- **Spec:** [10 §7.5](10-simulation-kind.md#75-items),
      [§7.7](10-simulation-kind.md#77-npcs--definition-and-runtime-state),
      [§7.9](10-simulation-kind.md#79-supporting-definitions) (locations),
      [§6.5](10-simulation-kind.md#65-needs), [§6.10](10-simulation-kind.md#610-inventory),
      [§6.11](10-simulation-kind.md#611-relationships),
      [§3](10-simulation-kind.md#3-the-turn-is-a-week) (`inventory`),
      [§10](10-simulation-kind.md#10-reason-codes) (`wrong_location`).
- **Touches:** `src/engine/src/kinds/simulation/` — `resolvers.ts`, `endOfWeek.ts`;
      `src/engine/src/campaigns/stable-life.ts`; `src/engine/fixtures/replay/`.
- **Depends on:** [W55](#w55).
- **Status:** Not started.
- **Done when:**
  - W56.1 `shop`, `maintain_item`, `repair_item`, `sell_item`, `travel`, `socialize` and
        `exercise` each have a real resolver, and none is `stubResolver`.
  - W56.2 Both halves of `wrong_location` are covered: `travel` to a location absent from the
        current location's `connections` is rejected with it, and so is any action whose type
        is absent from the current location's `actionTypes`.
  - W56.3 The `inventory` system applies per-item condition decay, and an item at zero
        condition stops contributing its modifiers rather than being removed from inventory.
  - W56.4 `socialize` moves the named `RelationshipState` and is rejected when that NPC is not
        present at the current location. The `relationships` end-of-week system stays an
        explicit, documented stub — no weekly relationship rule exists in the contract to
        implement (see *Known Open Items Carried In*).
  - W56.5 `exercise` moves the needs §6.5 names, clamped to `0–100` the same way W39's
        `eat`/`rest` are, emitting one `StateChange` per touched need.
  - W56.6 A replay fixture covering buy → use → decay → repair → sell is committed and passes.
- **Out of scope:** events that fire *because* of a relationship or a possession — that is
      W57's `events` system. Also out of scope: writing the missing weekly-relationship rule,
      which is `/contract`'s, not a slice's.

### [ ] W57 — Simulation Kind: Events, Opportunities, Headlines, and Achievements {#w57}

**Delivers:** The world starts acting on the player — random events arrive and demand a
response, opportunities appear and expire, the weekly headline reflects what actually
happened, and achievements unlock and persist across sessions.

Closes the last of [§3](10-simulation-kind.md#3-the-turn-is-a-week)'s stubbed systems and
[§2.3](10-simulation-kind.md#23-effects-opportunities-and-scheduled-events)'s two lifecycles.
Ordering is load-bearing again and stated: `headline` runs after `events` so a week's headline
can reference the strangeness that week's own events moved; `achievements` runs second-to-last
so a condition can depend on a counter `goals`/`failure` just incremented; and §2.3's revoke
and expire both run before offer.

**This unit is blocked on one contract decision and must not start without it.**
[§12](10-simulation-kind.md#12-terminal-identity)'s callout states that whether a week which
simultaneously exhausts `weekLimit` *and* resolves every goal reports `week_limit_reached` or
`goals_met` is genuinely unresolved — not undocumented here, but unresolved in the upstream
source — and §3 confirms `END_WEEK_SYSTEM_ORDER` has no slot for the check at all.
`week_limit_reached` is one of `outcome()`'s three non-null values and is currently
unreachable. Route that to `/contract` first; do not guess an ordering, and do not invent a
system position upstream never named.
- **Spec:** [10 §7.6](10-simulation-kind.md#76-events),
      [§7.9](10-simulation-kind.md#79-supporting-definitions) (opportunities, achievements,
      headlines), [§2.3](10-simulation-kind.md#23-effects-opportunities-and-scheduled-events),
      [§3](10-simulation-kind.md#3-the-turn-is-a-week),
      [§11](10-simulation-kind.md#11-events), [§12](10-simulation-kind.md#12-terminal-identity);
      [04 §7.1](04-core.md#71-the-profile-store).
- **Touches:** `src/engine/src/kinds/simulation/` — `resolvers.ts`, `endOfWeek.ts`,
      `startOfWeek.ts`, `outcome.ts`; `src/engine/src/campaigns/stable-life.ts`;
      `src/engine/fixtures/replay/`.
- **Depends on:** [W56](#w56), **and** a contract decision on §12's `week_limit_reached`
      precedence callout.
- **Status:** Not started — blocked on the contract decision above.
- **Done when:**
  - W57.1 `respond_to_event`, `accept_opportunity` and `decline_opportunity` each have a real
        resolver, and `"custom"` still reaches resolution nowhere — a `GameAction` typed
        `"custom"` fails, with no route around the `ResolverTable`.
  - W57.2 The `events` system fires scheduled and seeded random events in the order §2.3
        states, and a deferred `PendingEventResponse` is presented by the *next* week's
        start-of-week `events` phase, never the same week it was deferred in.
  - W57.3 The `opportunities` system runs revoke and expire before offer (§2.3); an
        opportunity offered and expired within one week is never visible in `SimulationView`.
  - W57.4 `headline` reads world strangeness after `events` has moved it, proven by a fixture
        whose headline changes only because an event fired that week.
  - W57.5 `achievements` evaluates `AchievementDefinition.condition` after `goals`/`failure`,
        unlocks exactly once across repeated weeks, and upserts through `ProfileStore` so the
        unlock survives a new session with the same `profileId`.
  - W57.6 `week_limit_reached` is reachable and returned by `outcome()` under the precedence
        the contract decision fixed, with its own committed replay fixture — the third terminal
        path, previously unreachable by construction.
  - W57.7 No end-of-week system in §3's list remains a stub except `relationships` and
        `history`, each still documented at its own definition site with its reason.
- **Out of scope:** rival agents.
      [§7.10](10-simulation-kind.md#710-agents--engine-owned-strategy-definition-and-runtime-state)
      states plainly that how a scenario configures rivals is an open gap — no
      `ScenarioDefinition` field names them, and upstream declares none either — so agents stay
      unbuilt until that is decided.

### Breadth: Content Packs, Experiments, and Locales

Three units against contracts that are fully specified and entirely unbuilt.
[`11-content-packs.md`](11-content-packs.md) is the customization story
[`02-architecture.md`](02-architecture.md) §4a promised and 04 §10.1 cannot express; the locale
unit is the cheapest available test of a claim 04 §10.1 makes and nothing currently checks.

### [ ] W58 — Content Pack Resolution and Content Identity {#w58}

**Delivers:** Lets a game be assembled from several content packs — a base campaign plus, say,
a culture pack that restyles its text — and makes a save record exactly which mix it was
played against, so replaying one player's game never silently runs it against another's
content.

The fold is the easy half. **The load-bearing part is
[§6](11-content-packs.md#6-identity-and-why-determinism-needs-it)'s identity argument:** two
players on the same `campaignVersion` with different packs resolved are playing different
games, and the envelope had no way to say so. The resolution is that `resolvePacks` stamps
every campaign's `version` with a `ResolutionId` digest over the ordered `{id, version}` list —
which adds no envelope field and makes [07 §6](07-replay.md#6-the-runner-and-its-verdicts)'s
`unrunnable: campaign_version_missing` reachable for the reason it was written.

`ContentRegistry` gains exactly one field. That is the whole change to 04 §10.1, and a second
one is a signal this unit has grown a design decision it should route rather than absorb.
- **Spec:** [11 §2](11-content-packs.md#2-what-a-pack-is),
      [§3](11-content-packs.md#3-resolution),
      [§4](11-content-packs.md#4-the-one-change-to-contentregistry),
      [§5](11-content-packs.md#5-dependencies),
      [§6](11-content-packs.md#6-identity-and-why-determinism-needs-it),
      [§7](11-content-packs.md#7-validation); [04 §10.1](04-core.md#101-content-registry),
      [§11](04-core.md#11-tiered-validation); [07 §6](07-replay.md#6-the-runner-and-its-verdicts).
- **Touches:** `src/engine/src/core/registry/` — `types.ts`, `build.ts`, and a new `packs.ts`;
      `src/engine/src/core/validation/tiered.ts`.
- **Depends on:** nothing engine-side.
- **Status:** Not started.
- **Done when:**
  - W58.1 `resolvePacks` is pure and total — no file or network I/O, and it returns either a
        registry or a complete list of conflicts, never a partial registry.
  - W58.2 A later pack replaces a campaign wholesale by `campaign.id` and never field-merges
        it; a later pack replaces a string per key. A two-pack campaign collision yields
        exactly one of the two campaigns, asserted directly rather than by absence of a merge.
  - W58.3 `dependsOn` is topologically sorted before the fold; a cycle fails, and two packs
        requiring different versions of a third fails rather than picking one.
  - W58.4 The same ordered `{id, version}` list produces the same `ResolutionId` across
        processes, and the same list in a different order produces a different one.
  - W58.5 Every campaign `resolvePacks` produces carries the `ResolutionId` as its
        `Campaign.version`, and `GameState` gains no field.
  - W58.6 Loading a replay fixture whose `campaignVersion` no longer resolves returns
        `unrunnable` with `campaign_version_missing` — not `diverged`.
  - W58.7 Each of §7's three checks fires: Tier 1 for a `kindId` mismatch, an unresolvable
        `dependsOn` and a cycle; Tier 1 for a campaign id colliding *within* one pack; Tier 2
        for a pack overriding a campaign or string no earlier pack supplied.
  - W58.8 Every existing single-campaign registry test passes unmodified, and the campaigns
        W15–W40 committed still serialize byte-identically.
- **Out of scope:** experiment gates (W59); pack discovery and distribution, partial or lazy
      loading, community trust, and per-locale pack splitting —
      [§8](11-content-packs.md#8-what-is-deferred) defers all four by name.

### [ ] W59 — Experiment Gates and the `ExperimentSource` Port {#w59}

**Delivers:** Turns A/B tests and feature flags into one mechanism rather than two — a pack is
simply in the set or not, decided before resolution — and gives a host the seam that decides
which variant a player is in.

[§5a](11-content-packs.md#5a-experiment-gates)'s design is deliberately small:
`applyExperimentGates` filters the pack array *before* `resolvePacks` sees it, so nothing about
the fold's signature or purity changes and it never learns gates exist. `ExperimentSource` is
the last unbuilt port in [06 §5](06-extensibility.md#5-the-port-catalogue)'s catalogue — W1's
`src/engine/src/core/composition/types.ts` predates that design and declares `IdSource`,
`Clock`, `EngineHost` and a `SessionHost` with no `experiments` field.

The safety property is worth restating because it is easy to lose in implementation: a gated
pack is included only when `assignments[gate.experimentId] === gate.variant`, which is never
true for `null` ("not enrolled") or a missing key — so "no `ExperimentSource` supplied" is safe
by construction rather than by luck of which default string someone picked.
- **Spec:** [11 §5a](11-content-packs.md#5a-experiment-gates);
      [06 §4](06-extensibility.md#4-the-composition-root),
      [§5.5](06-extensibility.md#experimentsource).
- **Touches:** `src/engine/src/core/composition/types.ts`;
      `src/engine/src/core/registry/packs.ts`; `src/engine/src/core/session/store.ts`.
- **Depends on:** [W58](#w58).
- **Status:** Not started.
- **Done when:**
  - W59.1 `ExperimentSource` is declared in `composition/types.ts` and `SessionHost` gains an
        optional `experiments`, with a working default meaning "no experiments running".
  - W59.2 An ungated pack is always included; a gated pack is included only on an exact
        variant match and excluded for `null`, for a missing key, and for a different variant
        — each asserted as its own case.
  - W59.3 With no `ExperimentSource` supplied, every gated pack is excluded and every ungated
        pack included; no gated pack reaches a registry by default.
  - W59.4 `resolvePacks`' signature, purity and W58 tests are unchanged, and a test asserts it
        never receives a gated-out pack.
  - W59.5 Assignments resolve once per session — one call per distinct `experimentId` across
        the candidate packs, keyed by `profileId` where present and `seed` otherwise — proven
        by a counting `ExperimentSource` rather than asserted.
  - W59.6 Two sessions in different variants produce different `campaignVersion`s through
        W58's existing digest, with no further mechanism added.
- **Out of scope:** bucketing algorithms, rollout percentages, sticky-session semantics beyond
      `bucketKey`, and outcome measurement — §5a and §8 place all four outside this contract.

### [ ] W60 — A Second Locale, End to End {#w60}

**Delivers:** Proves the platform is not accidentally English-only — the same campaign plays
through in a second language with the engine unchanged, and a missing translation is caught at
load rather than shown to a player as a raw key.

[04 §10.1](04-core.md#101-content-registry) states the authoring→registry types already support
more than one locale and that the MVP ships English only, so this is string tables plus tooling
with no type change. **No test currently makes that claim**, and it is a small vertical slice
that would find out cheaply: the protected `core.reason.*` merge, `LocKey` resolution, the text
client's rendering and the MCP surface all sit on the path.
- **Spec:** [04 §10.1](04-core.md#101-content-registry),
      [§12](04-core.md#12-reason-codes-state-changes-messages),
      [§17](04-core.md#17-identifier-conventions);
      [09 §5](09-clients.md#5-reason-codes-and-messages).
- **Touches:** `src/engine/src/core/localization/resolve.ts`;
      `src/engine/src/core/registry/build.ts` and `strings.ts`;
      `src/engine/src/campaigns/`; `src/engine/src/clients/text/render.ts`.
- **Depends on:** nothing engine-side.
- **Status:** Not started.
- **Done when:**
  - W60.1 One shipped campaign has a complete second-locale string table and the registry
        builds for both locales with no change to any type in `core/registry/types.ts`.
  - W60.2 A key present in English and absent in the second locale fails Tier 1 with the key's
        path — never a silent fallback to English, never a raw key rendered at play.
  - W60.3 `core.reason.*` messages resolve in the second locale, and a campaign attempting to
        override one is still rejected.
  - W60.4 The same seed and the same choices under either locale produce byte-identical
        `serialize()` output — locale is presentation and reaches no persisted state.
  - W60.5 The text client and the MCP surface both render the second locale from the registry,
        and neither contains a translated string in its own source.
- **Out of scope:** string-table extraction, translation workflow and coverage reporting —
      those belong to the *Content Tooling* workstream below. Per-locale content packs are
      [11 §8](11-content-packs.md#8-what-is-deferred)'s deferral, not this unit's.

### [ ] W61 — Consume the Reusable Landing-Page Package {#w61}

**Delivers:** Keeps the Engine's existing landing page and roadmap exactly as visitors see
them, while replacing its repository-owned Vite build and PowerShell merge machinery with the
reusable landing-page package Platform already publishes. The Engine continues to own its
React pages, visual identity, metadata and tests; the package owns route builds and the
protected documentation merge.

The site is already an exceptional custom frontend, not a README-driven generic page. It
therefore consumes the package's published custom-adapter seam: two Engine-owned entry modules,
two independently declared metadata sets, the existing static assets, and no copied Platform
component or stylesheet. This is a toolchain extraction, not a landing-page redesign.
- **Spec:** none — site toolchain only. The consumed contract is
      `subzerodev-platform-ui-landing-page@0.2.0`'s published `defineLandingPage` adapter and
      protected `merge` command.
- **Touches:** `site/landing.config.ts` (new); `site/package.json`, `site/package-lock.json`,
      `site/vitest.config.ts` (new), `site/README.md`, `site/scripts/verify-build.mjs`, and a
      merge-verification script under `site/scripts/`; the obsolete `site/vite.config.ts`,
      `site/index.html` and `site/roadmap/index.html`; `build/Merge-LandingPage.ps1`;
      `.github/workflows/docs-ci.yml` and `.github/workflows/docs-deploy.yml`.
- **Depends on:** nothing Engine-side. The immutable external prerequisite is
      `subzerodev-platform-ui-landing-page@0.2.0`, whose adapter preserves route-specific
      canonical, Open Graph, X/Twitter, icon, theme-colour and no-script metadata.
- **Status:** Not started.
- **Done when:**
  - W61.1 `site/package.json` pins `subzerodev-platform-ui-landing-page` exactly at `0.2.0`,
        the lockfile resolves that version, and the site no longer declares Vite or the React
        Vite plugin directly; Vitest retains its existing jsdom setup through a dedicated
        test configuration.
  - W61.2 `site/landing.config.ts` declares exactly `/` and `/roadmap/`, each pointing at its
        existing Engine-owned entry module and carrying the complete metadata currently in
        that route's HTML: title, description, canonical URL, Open Graph fields, X/Twitter
        card, icons, theme colour and no-script text.
  - W61.3 `npm --prefix site run build` emits `site/dist/index.html` and
        `site/dist/roadmap/index.html`, copies every referenced public asset, and leaves no
        development-only `/src/` reference in either built document.
  - W61.4 The existing landing and roadmap component tests pass unchanged, and no Engine
        component, page copy, stylesheet or public asset changes; adopting the package causes
        no rendered-content or visual redesign.
  - W61.5 The site scripts use the package CLI for `dev`, `build` and `merge`; the handwritten
        Vite route inputs and `build/Merge-LandingPage.ps1` have no remaining caller or copy in
        the repository.
  - W61.6 A merge test starts from a real landing build and a fixture documentation output,
        then proves the result contains `/`, `/roadmap/` and `/docs/` while every file under
        the protected `docs/` subtree remains byte-identical. A landing fixture containing a
        top-level `docs/` path is rejected, proving the guard's negative path.
  - W61.7 Both documentation workflows install the pinned site dependencies, run the full site
        check, and invoke the package-backed merge. Their triggers, Pages permissions,
        concurrency and deployment environment remain caller-owned and unchanged.
  - W61.8 `npm --prefix site run check`, `build/Test-Documentation.ps1` and
        `git diff --check` pass; the production documentation build remains a separately
        reported Docker-dependent gate.
- **Out of scope:** changing landing-page or roadmap content, visual design, routes, roadmap
      delivery status, documentation information architecture, GitHub Pages policy, or the
      reusable package itself; adopting the package's generic README renderer; copying any
      Platform page component, style or token into Engine.

### Breadth: The First Culture Pack

- [ ] Bulgaria culture pack over the simulation kind — Jones-in-Bulgaria content,
      no engine change ([`02-architecture.md`](02-architecture.md) §4a). Needs
      [W58](#w58) for the pack mechanism and [W50](#w50)–[W57](#w57) for a simulation game
      worth reskinning; not sliced until both land.

### Breadth: The Platform

- [ ] Interactive CLI play-test harness — a stdin/stdout loop over the existing
      `TextClient` and `SessionStore` (`src/engine/src/clients/text/client.ts`), so a human
      can play a committed campaign (e.g. `stable-life`, the Bulgaria arcs) without writing a
      test. Manual play-testing tooling, not a shipped client surface — distinct from "more
      clients" below, no projection or store change, no contract change. Not required by any
      Definition-of-Done item; exists purely so the engine can be seen running.

### [ ] W61 — Public Playable Web Demo {#w61}

**Delivers:** Turns the completed Bureaucracy MVP into a public `/play/` route a visitor can
finish without cloning the repository. The engine runs locally in the browser behind a real
client over `SessionStore`; the page renders scenes, shown choices, disabled reasons, visible
state and achievements, offers non-committing previews and same-page checkpoints, and reaches
the existing ending with no React-owned game rule.

This is deliberately one campaign and one route. The five story campaigns, Stable Life, and
the world-graph MVP already prove useful engine breadth, but putting all of them in a picker
would turn the first browser boundary into three rendering problems and still leave the
load-bearing question unanswered: can the package, session store, save envelope, registry and
client contract run together in a production browser bundle? [`13-playable-web-demo.md`](13-playable-web-demo.md)
fixes that product and architecture boundary.

The browser currently exposes three real portability defects hidden by the Node.js CLI:
`version.ts` reads `node:fs`, `envelope.ts` uses `node:crypto`, and `emitter.ts` reads an
unguarded `process.env`. Close those in the shared runtime, not with a reduced browser fork.
The checksum stays SHA-256 over the same canonical bytes, and the pure engine remains
synchronous; only the already-async store boundary may await platform crypto.

- **Spec:** [`13-playable-web-demo.md`](13-playable-web-demo.md);
      [09 §1](09-clients.md#1-the-rule-made-testable),
      [§2](09-clients.md#2-the-only-surface),
      [§4](09-clients.md#4-the-api-coverage-checklist),
      [§6](09-clients.md#6-projection-is-not-optional);
      [04 §7](04-core.md#7-the-session-store-and-the-platform-api),
      [§9](04-core.md#9-projection), [§10.2](04-core.md#102-save-envelope-and-migration).
- **Touches:** `src/engine/src/version.ts`, `core/persistence/envelope.ts`,
      `core/observability/emitter.ts`, the package root and browser-bundle smoke test;
      `site/` — a new play entry, composition root, browser adapter, React page, shared
      navigation, styles and tests; the static-build/merge verification; factual status copy
      in `README.md`, `src/engine/README.md`, and the landing page.
- **Depends on:** [W19](#x-w19--mvp-acceptance), [W31](#x-w31--save-migration), and W41.
      Implement against whichever
      landing build/merge mechanism is on `main` when the unit starts; issue #179's package
      migration is not a semantic dependency and must not be reimplemented here.
- **Status:** Not started.
- **Done when:**
  - W61.1 The supported engine entry graph used by the site produces a real browser bundle
        with no `node:` import, unguarded Node.js global, runtime filesystem read, or second
        browser-only engine path; Node.js typecheck, lint, tests and package build remain green.
  - W61.2 `ENGINE_VERSION` still has package metadata as its single owner, and save/load under
        Node.js and a browser produce the same lowercase SHA-256 checksum for the same
        `{ state, replayCompatible }` canonical bytes without changing any committed replay or
        serialization fixture.
  - W61.3 The package root exports the committed Bureaucracy builder needed by the site
        composition root; React and the browser adapter import only `SessionStore` types and
        call no engine, kind, registry, validation, projection, or persistence helper.
  - W61.4 A direct static request to `/play/` succeeds; the production artifact contains
        `/`, `/roadmap/`, `/play/`, and `/docs/`, and the protected merge proves the docs
        subtree byte-identical before and after overlay.
  - W61.5 A visitor can start Bureaucracy, traverse the `office_visits >= 3` loop, see the
        gated choice with its reason, exercise the seeded transition, reach the existing
        ending, see `it_builds_character`, and start again. No raw `LocKey` appears in any
        ready, playing, rejected, preview, or ended state.
  - W61.6 Previewing an enabled choice shows the labelled prospective scene without changing
        the committed scene, view, action sequence or checkpoint; committing it afterwards
        reaches the same result as choosing it without a preview.
  - W61.7 Save/load is presented honestly as a same-page checkpoint. Restoring it loses no
        state; refreshing starts a new demo and the UI says so. No component writes raw state
        or a save envelope to browser storage.
  - W61.8 [09 §4](09-clients.md#4-the-api-coverage-checklist)'s browser column is checked
        against ten named adapter tests. The full Bureaucracy path through the browser adapter
        and text client, under the same seed and counting `IdSource`, produces identical
        `Scene`/`PlayerView` steps and byte-identical final `serialize()` output.
  - W61.9 The page is keyboard-complete and usable at 320 px, 390 px, 768 px and 1280 px:
        native action controls, adjacent disabled reasons, visible focus, announced committed
        scene changes, no colour-only state, no horizontal overflow, and complete reduced-motion
        behavior.
  - W61.10 The public header and landing page expose `Play`; stale claims that nothing is
        playable are corrected without calling the demo a finished game. Site checks,
        documentation checks, engine gates, `git diff --check`, and the exact-merge deployment
        verification all pass before the route is announced.
- **Out of scope:** additional campaigns or kinds; durable browser storage; profiles across
      reloads; accounts, cloud sync or any backend; new gameplay; art, audio, analytics,
      session capture, service workers, a PWA, or a generic reusable web-client package.

### [ ] W62 — Platform Static Host Image {#w62}

**Delivers:** Adds a product-owned ASP.NET Core host under `src/host/`, composed with
`SubZeroDev.Platform.Hosting`, and packages W61's verified combined static artifact into a
stateless container. Pull requests build, run, and smoke the image. Merges to `main` publish a
new immutable GHCR image when relevant hosting inputs change, but do not deploy it; GitHub Pages
remains the public host.

This is the first Platform consumer and deliberately the smaller half of hosting. The engine
continues to execute in the browser. A later hosted-engine-edge slice owns the `.NET Platform
edge → Node engine workload`, JSON/HTTP boundary, MCP projection, and remote session semantics.

- **Spec:** [`15-platform-static-host.md`](15-platform-static-host.md);
      [`13-playable-web-demo.md`](13-playable-web-demo.md) §6;
      the Platform repository's `platform-identity.md`, `engine-hosting-contract.md`, ADR-002,
      ADR-005, and D3 implementation plan.
- **Touches:** new `src/host/` web project and tests; the multi-stage container definition and
      build context; static artifact/route smoke scripts; CI and GHCR publication workflows;
      package-source configuration without credentials; hosting documentation.
- **Depends on:** [W61](#w61) and SubZeroDev.Platform S9 package publication. A temporary sibling
      `ProjectReference` may unblock local development, but W62 cannot merge until the project
      uses one exact released `SubZeroDev.Platform.Hosting` package version and a clean CI clone
      restores without `../SubZeroDev.Platform`.
- **Status:** Not started.
- **Done when:**
  - W62.1 `src/host/` is the product composition root. It calls `AddPlatformWebHost()` and maps
        Platform probes; Platform gains no GameEngine dependency, and the host adds no worker,
        persistence, migration, outbox, account, or session service.
  - W62.2 The committed project pins an exact released `SubZeroDev.Platform.Hosting` NuGet
        version. CI restores it with a short-lived secret that is absent from repository files,
        Docker arguments, environment layers, runtime image history, and build output.
  - W62.3 One multi-stage build constructs the site and documentation from the same commit, runs
        the protected merge, proves the docs subtree byte-identical, publishes the host, and
        copies only the verified combined artifact into `wwwroot` in the runtime stage.
  - W62.4 Direct container requests to `/`, `/roadmap/`, `/play/`, and `/docs/` return the
        expected documents; Platform liveness and readiness succeed; a named unknown route
        returns `404` with no SPA fallback.
  - W62.5 The browser demo remains W61's local `SessionStore` client: the container exposes no
        engine API, game action, or runtime content endpoint, and a production browser smoke
        observes no such network request.
  - W62.6 The runtime image contains no Node.js, package-manager cache, source tree, build tools,
        or registry credential; it runs non-root, supports a read-only root filesystem, writes no
        product data, performs no normal outbound request, and stops gracefully on `SIGTERM`.
  - W62.7 PR CI builds and starts the exact image, runs positive route/probe/browser checks, and
        contains a deliberate missing-or-corrupt-artifact case that proves the gate fails red.
  - W62.8 A path-filtered `main` workflow publishes a new GHCR image only when host, site,
        documentation-build, merge, container, or locked dependency inputs change. It records an
        immutable full-commit tag and digest, creates no `latest` tag, and performs no deployment.
  - W62.9 The existing GitHub Pages exact-merge workflow and public routes remain unchanged and
        green; an image publication failure cannot alter the live site or an earlier image.
- **Out of scope:** public deployment, DNS/TLS/custom domain, traffic cutover or rollback;
      hosted Node engine/API/MCP/session behavior (a later hosted-engine-edge slice); persistence,
      auth, accounts, databases, worker processes; gameplay, campaign, browser-client, or
      serialization changes; a generic static-site facility in Platform.

### [x] W63 — Absurd Game Interface {#w63}

**Delivers:** Rebuilds the public story shelf and story-graph play surface so it reads as a
game rather than a styled form. The interface becomes an original absurd adventure cabinet:
a theatrical scene viewport, tactile action deck, satirical status console, dossier-like story
shelf, and brief mechanical transitions. Its inspiration is the graphic-adventure staging of
*Indiana Jones and the Fate of Atlantis* and the busy life-board energy of *Jones in the Fast
Lane*; it copies neither game's assets, layout, characters, logos, fonts, sounds, or trade dress.

The slice is presentation-only. Existing `BrowserClient` DTOs and `SessionStore` remain the
only game-facing boundary, and the redesign may not add rules, rewrite campaign text, infer
hidden state, reorder actions, or change serialized outcomes. “Absurd” is a controlled visual
language, not maximum noise: one hero joke and at most two minor jokes per visible state.

- **Spec:** [`14-game-interface.md`](14-game-interface.md);
      [`13-playable-web-demo.md`](13-playable-web-demo.md) §§1–3, §7–§9;
      [09 §1](09-clients.md#1-the-rule-made-testable),
      [§2](09-clients.md#2-the-only-surface),
      [§6](09-clients.md#6-projection-is-not-optional).
- **Touches:** `site/src/play/` — shelf, game cabinet, action deck, status console, transitions,
      responsive states, original local assets, component/browser/visual/accessibility tests;
      static-build verification for asset budgets and the direct `/play/` route. No engine,
      campaign, replay-fixture, or contract-type change.
- **Depends on:** [W61](#w61) and the multi-campaign story shelf already present on `main`.
- **Status:** Done — implemented via #188 and #190. W63.7 (visual snapshots) and W63.8
      (automated accessibility, forced-colours, 200% zoom, and long-text checks) were verified
      by manual review at 320/390/768/1280 px rather than a dedicated automated suite; see
      [OPEN-QUESTIONS.md §3](OPEN-QUESTIONS.md#3-judgement-calls-to-revisit-settled-for-the-mvp).
- **Done when:**
  - W63.1 Ready, playing, busy, unavailable, rejected, persistence-warning, and ended states
        all use the cabinet visual grammar and remain distinguishable without colour or motion.
  - W63.2 The story shelf is a keyboard-navigable dossier/archive composition; selecting a
        story opens a labelled briefing, content notices remain plain and accessible, and
        returning from play restores the selected dossier and shelf position.
  - W63.3 The scene viewport renders authored text unchanged; the action deck preserves action
        order and full labels; the status console renders only `PlayerView`. No raw node id,
        `LocKey`, seed, action log, hidden variable, or opaque kind state appears.
  - W63.4 Every visible-stat control prints its value in addition to any gauge treatment. A
        campaign with no visible stats receives an honest empty-state prop, not a fabricated
        score or progress measure.
  - W63.5 All art is original local PNG/JPG or CSS-native decoration. A missing decorative
        asset leaves a complete readable cabinet; no reference-game asset, font, logo, sound,
        character, screenshot, traced composition, or trade dress ships.
  - W63.6 One full Bureaucracy run and both Lucifer roles are playable through the redesigned
        UI. Existing browser/text-client parity still produces byte-identical serialized
        outcomes, proving presentation did not become game logic.
  - W63.7 Visual snapshots cover ready, playing, unavailable-choice, persistence-warning, and
        ended states at 320 px, 390 px, 768 px, and 1280 px, with no clipped authored text,
        horizontal overflow, or action below an inaccessible internal scroll region.
  - W63.8 Keyboard-only, automated accessibility, forced-colours, 200% zoom, long-text, and
        missing-asset checks pass. Focus moves after committed scenes, restores after a
        briefing/dialog closes, and never moves merely because decoration animates.
  - W63.9 Motion is limited to brief state punctuation; reduced motion removes transforms,
        parallax, wipes, flicker, and staged delay. No action waits for animation and no
        permanent timer runs while the page is idle.
  - W63.10 Initial decorative payload is at most 1.5 MB compressed, no single decorative asset
        exceeds 500 KB, phone layouts do not fetch desktop backdrops, `/play/` remains a direct
        static route, and the page performs no runtime request for engine or campaign content.
- **Out of scope:** new campaigns, mechanics, projections, engine APIs, a visual language for
      simulation/world-graph, copied reference material, canvas/WebGL, point-and-click movement,
      a verb parser, mandatory audio, voice acting, cut-scenes, or procedural art.

### Depth: Story Campaigns Become Adventures

### [x] W64 — Replayable Story Campaign Expansion {#w64}

**Delivers:** Reauthors the six story-graph campaigns already on the public shelf as
replayable narrative adventures and presents them as a playable choose-your-own-adventure
casebook. Return, Bureaucracy, Driving, Inheritance, Enterprise, and Lucifer Chronicles gain
routes that stay apart long enough to feel different, optional scenes, delayed consequences,
hidden discoveries, seeded flavour events, stat-dependent choices, and multiple endings. A
first playthrough must leave authored content undiscovered, while the interface makes the
causal link between the choice just made and the scene that followed unmistakable.

This is a content slice over the existing `story-graph` contract, not a new narrative runtime.
Money, documents, relationships, attention, and character memory are typed campaign variables;
secrets use `showWhen`; visible obstacles use `requirements`; delayed consequences are earlier
effects read by later conditions; and random events are seeded `random` nodes. A random draw may
change flavour or open an optional detour, but it may not make a planned route unwinnable.

For this unit, a **visible scene** is a reachable `choice` or `ending` node. `auto` and `random`
nodes settle before projection and therefore do not count toward a campaign's scene target. A
**material route** reaches a different ending or traverses at least two consecutive visible
scenes that another route skips before the routes rejoin. A **delayed consequence** is a choice
effect consulted by a `showWhen`, `requirements`, achievement, or later route at least three
player submissions after it was applied. These definitions keep node inflation and immediate
reconvergence from masquerading as depth.

The expansion keeps each campaign standalone. Recurring clerks, mechanics, police, relatives,
coffee, flies, and locations make the catalog feel like one universe, but no campaign reads
another campaign's save, profile achievements, or variables. Existing campaign, node, ending,
choice, and achievement ids are published identifiers: retain them where the corresponding
content remains, and cover every necessary rename through campaign migration rather than
silently stranding a v1 save.

The W63 cabinet remains the outer game shell; its scene viewport becomes an open **adventure
casebook** rather than another disconnected slide. The current scene is the current page, the
action deck is a numbered set of “turn to your choice” passages, visible stats read as a compact
character sheet, achievements arrive as stamps/bookmarks, and an ending closes the volume with
its authored title. CSS-native paper, ink, marginalia, tabs, page edges, and brief page-turn
punctuation may strengthen the game metaphor without copying a published book or hiding the
text inside a decorative texture.

Every committed transition produces a visible **arrival receipt**: “You chose …” followed by
“which brought you here.” A persistent, read-only **Journey so far** display lists only pages
and choices this player has already seen, links the previous entry to the current page, and
offers “Where I came from” without exposing node ids, hidden choices, conditions, seed, or the
engine action log. The journal is presentation memory assembled from successful projected
scenes and resolved action labels. Previewed and rejected actions never enter it; browsing an
old entry never rewinds or resubmits the game.

- **Campaign shape:**
  - **Return:** at least 20 visible scenes across Returning Home, Reality, and Settling; the
        airport/customs arrival, first bureaucracy, neighbours and old connections, and the
        rent/village/apartment/family/hotel decision form different routes. At least optimistic,
        sceptical, and exhausted endings are reachable.
  - **Bureaucracy:** 20–30 visible scenes spanning municipality, cadastral, tax, civil-registry,
        archives, notary, and translation-office routes. Helpful/angry clerk and supervisor
        memory pays off later; document obtained, gave up, lawyer solved, miracle, and system
        failure endings are all reachable.
  - **Driving:** at least 25 visible scenes covering inspection, mechanic trust, insurance and
        tax, fuel/LPG, road and weather trouble, police, parking, parts, marketplace, towing, and
        the insurer. Reliable car, endless repairs, sold car, collector item, and abandoned
        project endings are all reachable.
  - **Inheritance:** at least 25 visible scenes across news, documents, village, neighbours,
        family, police, lawyers, court, settlement, and aftermath. Evidence, support, cost,
        tension, and property condition expose old-document, helpful-neighbour, lost-deed,
        police-report, and secret-agreement paths. Court, settlement, abandonment, buyout,
        family peace, and family war endings are all reachable.
  - **Enterprise:** at least 30 visible scenes across registration, first client, tax and
        invoicing, cashflow, hiring, competition, government, growth, and failure. Seeded late
        payment, audit, tax letter, lucky client, bad review, server outage, and opportunity
        events alter pressure without erasing deliberate preparation. Consultant, agency,
        successful company, platform company, bankruptcy, and sale endings are all reachable.
  - **Lucifer Chronicles:** Ben and Lucifer remain genuinely different perspectives, not a
        shared route with renamed prose. Every act decision scene offers four to six authored
        choices, earlier interactions alter later availability or dialogue, and every recurring
        character with more than one appearance remembers at least one prior interaction.
        Generic numbered conclusions are replaced by authored philosophical endings, including
        The Bureaucrat, The Observer, The Escapist, The Builder, The Stoic, The Entertainer,
        Customer Support Manager of Hell, The One Who Asked One Question, and The Guy Who Just
        Wanted to Fix a House.
- **Spec:** [03 §§2–7](03-story-graph-kind.md) for variables, nodes, gates, effects,
      conditions and achievements; [§8.2](03-story-graph-kind.md) for settle semantics;
      [§10](03-story-graph-kind.md) for determinism, save and versioning;
      [04 §10.2](04-core.md#102-save-envelope-and-migration) for campaign migration;
      [09 §1](09-clients.md#1-the-rule-made-testable) for client parity.
- **Touches:** the six `src/engine/src/campaigns/` sources and their focused tests,
      determinism snapshots and replay fixtures; campaign exports only if composition needs
      them; `/play/` catalog metadata, duration/content notices, casebook/journey presentation,
      styles, and browser tests. No core, kind, projection, session, or client contract changes.
- **Depends on:** [W31](#x-w31--save-migration) for the v1 → v2 campaign boundary and
      [W61](#w61) for public browser proof. The story-graph mechanics themselves are already
      complete in W9–W14.
- **Status:** Done — implemented via #189 and #191.
- **Done when:**
  - W64.1 Each campaign has at least three material routes, three optional visible scenes,
        three delayed consequences, three `showWhen` discoveries driven by different state,
        two seeded random-event points whose outcomes are both exercised, and two later gates
        driven by stats or remembered interactions. Static graph assertions and named
        playthroughs prove the counts; source-line or raw-node counts do not.
  - W64.2 All six campaign-shape targets above are met using reachable visible scenes. No
        promised consequence is authored only as pass-through text that settle prevents a
        client from seeing, and no route pads its length with repeated “continue” decisions.
  - W64.3 Two playthroughs of each campaign diverge for at least two consecutive visible
        scenes before any reconvergence, and no single valid playthrough visits more than 70%
        of that campaign's reachable visible scenes. At least one tested ending per campaign
        requires an earlier choice made three or more submissions before the ending path opens.
  - W64.4 Every named ending above is reachable by an intentional route, with an authored
        label and ending text rather than a numbered placeholder. Exploration achievements
        unlock exactly once for optional content and do not become resolution inputs across
        sessions.
  - W64.5 Every campaign publishes version `2.0.0`. A v1 active save, a v1 ended save, and a
        v1 save with achievements migrate or fail with a deliberately tested published-id
        decision; no save resumes on a missing node, and migrated saves are marked
        `replayCompatible: false` as W31 requires.
  - W64.6 Each source builds with no Tier 1 findings and no unexplained Tier 2 warning. A graph
        test detects unreachable scenes, exitless settle cycles, duplicate ids, endings that
        cannot be reached, hidden choices that can never appear, and random branches that can
        remove every route to a planned objective.
  - W64.7 At least three committed route fixtures per campaign cover materially different
        paths and endings; separate seeds cover every authored random transition. Replaying a
        fixture twice is byte-identical, sink-independent, and stable across save/load at a
        delayed-consequence checkpoint.
  - W64.8 One representative alternate route through each campaign produces the same ordered
        scenes, available actions, visible view, and final serialized state through the text
        client and browser adapter. A hidden choice remains absent and returns
        `unknown_action` if probed; the browser never gains campaign-specific rules.
  - W64.9 Recurring-universe references are prose and stable authored ids only. A test registry
        containing all six campaigns builds without string-key conflicts, and running any
        campaign with a fresh profile produces the same initial state regardless of which
        other campaigns were previously played.
  - W64.10 `/play/` exposes all six v2 campaigns with truthful duration and content notices;
        one full route in each is keyboard-complete at the W63 breakpoints, renders every
        visible stat as text, and shows no raw `LocKey`, internal node id, or hidden state.
  - W64.11 The initial page says “Your story begins here.” After every successful choice, the
        next page names the resolved label under “You chose” and visually connects it to the
        new scene under “which brought you here.” Preview, unavailable, rejected, save, and
        load operations cannot create a false transition receipt; rapid double submission
        cannot duplicate one.
  - W64.12 “Journey so far” records the ordered projected scene excerpt and committed choice
        label for the current live route, highlights the current page, and lets the player
        inspect a prior entry read-only before returning focus to the current choice. It stores
        no `Scene.id`, action id, condition, raw `PlayerView`, seed, or serialized state. A
        checkpoint may carry a separate presentation-only journal beside the save handle; if
        that journal is missing or invalid, load succeeds and displays “Journey resumed at this
        checkpoint” rather than inventing earlier steps. Journal presence or absence produces
        byte-identical engine serialization.
  - W64.13 The casebook is recognisably playable before decoration loads: current page,
        consequence link, numbered choices, character sheet, journey control, and ending action
        remain in that reading order. Page-turn motion lasts no longer than state punctuation,
        never delays an action, and becomes an instant page replacement under reduced motion.
        At 320 px the book becomes one page with the same semantic order; it never requires a
        two-page spread, hover, drag, sound, or a page-flip gesture.
- **Out of scope:** a new node kind, conditional-transition operator, inventory or relationship
      subsystem, cross-campaign saves or unlocks, procedural/AI-authored prose, new campaigns,
      simulation/world-graph content, localization, voice/audio, canvas/WebGL, undo/backtracking,
      a fabricated completion percentage, and any journal field that participates in game
      resolution.

### [ ] W65 — Browser Test Harness for the Site {#w65}

**Delivers:** Gives `site/` the ability to prove anything about how a page actually renders.
Its tests run in jsdom today, which performs no layout: `getBoundingClientRect` returns zeros
and stylesheet CSS is never cascaded, so no computed size, hit area, overflow, or contrast can
be asserted. That is why [W63](#w63) was accepted on manual inspection at four widths, recorded
as known-and-retained in [`OPEN-QUESTIONS.md`](OPEN-QUESTIONS.md), whose stated revisit trigger is
exactly this: extend `site/` with real-browser tooling, and extend it to `/play/` first.

W65 adds a real-browser runner, an accessibility scanner, and visual snapshots, then **captures
the currently shipped rendering as the baseline**. Ordering matters: [W66](#w66) recomposes the
play surface and promises the desktop compositions survive untouched, and that promise is only
provable against a baseline taken before the CSS moves. A harness stood up alongside the
redesign would baseline the changed rendering and prove nothing.

The harness is test infrastructure. It ships no product behaviour, no page change, and no
engine change. Where an existing jsdom test is adequate it stays put; this is not a migration
of the whole site suite.

- **Spec:** [`14-game-interface.md`](14-game-interface.md) §10 for the proof list this must be
      able to execute, and §8 for the widths and states it must reach;
      [13 §7–§8](13-playable-web-demo.md#7-client-proof-and-tests).
- **Touches:** `site/package.json`, `site/vite.config.ts`, a browser-test setup file, new
      specs under `site/src/play/` and `site/src/`, committed baseline snapshots, and the CI
      workflow that runs the site's check script. No `src/engine/`, `design/` contract, or
      product-code change beyond a test id where a control is otherwise unaddressable.
- **Depends on:** [W63](#w63) and [W64](#w64) being on `main`, since the baseline is of what
      they shipped. No engine dependency.
- **Done when:**
  - W65.1 `site/` runs specs in a real browser engine, driven by the package's existing check
        script and by CI, with a documented single command. A deliberately failing computed-style
        assertion fails that command; a jsdom-only run cannot silently satisfy it.
  - W65.2 The runner can set viewport width and height, so a spec can assert at 320, 360, 390,
        414, 768, and 1280 px in portrait and at one landscape phone size, and can emulate
        `prefers-reduced-motion` and forced colours.
  - W65.3 A spec can read a **computed** style and a real hit area from a rendered control, and
        can assert the document does not scroll horizontally. Each of those three capabilities
        has a self-test proving it fails when the condition is violated.
  - W65.4 An automated accessibility scan runs against the shelf, briefing, content notice,
        playing, unavailable-choice, rejected, and ended states, and fails the build on a
        violation at the agreed severity. Existing violations, if any, are recorded explicitly
        rather than silenced by lowering the threshold.
  - W65.5 Visual snapshots of the shipped `/play/` rendering are captured and committed for
        playing, unavailable-choice, persistence-warning, and ended states at 320, 390, 768, and
        1280 px. Snapshot review and update are documented, and a snapshot diff fails the build.
  - W65.6 The harness is deterministic enough to run in CI without flake: fonts, animation, and
        any time-dependent rendering are pinned or disabled for capture, and a repeated run on an
        unchanged tree produces no diff.
  - W65.7 Engine gates, documentation checks, the existing jsdom suite, the production site
        build, and `git diff --check` all still pass, and the added tooling does not enter the
        shipped `/play/` bundle.
  - W65.8 The known-and-retained W63.7/W63.8 entry in [`OPEN-QUESTIONS.md`](OPEN-QUESTIONS.md) is closed
        or narrowed to whatever genuinely remains, rather than left standing beside a harness
        that resolves it.
- **Out of scope:** any `/play/` visual, layout, type, or markup change — that is [W66](#w66);
      migrating the existing jsdom suite wholesale; a harness for `docs/`; performance
      budgets, Lighthouse scoring, or cross-browser matrices beyond the one engine needed to
      make the assertions real; and any engine or campaign change.

### [ ] W66 — The Play Surface on a Phone {#w66}

**Delivers:** Recomposes `/play/` for the device most visitors actually hold. The W63 cabinet
and the W64 casebook were both measured on a desktop and then allowed to shrink: authored
prose renders at 16 px and choice labels at about 13 px on a phone, cabinet controls stand
roughly 34 px tall against a 44 px comfortable touch target, the cabinet's 8 px offset shadow
sits outside a nearly full-width element at 320 px, panels are sized in `vh` under a collapsing
mobile toolbar, no edge respects a device safe area, and every turn requires scrolling past the
scene to reach the choices — after which committing one scrolls the player back to the top.

W66 makes the phone the composed case rather than the degraded one. Below 768 px a turn becomes
**two scroll-snapped pages** in one ordinary scrolling column: a scene page that fills the
viewport and names how many choices wait below it, then a choice page of full-width cards under
a pinned one-line echo of the scene. Type and hit-area floors from
[14 §8.1](14-game-interface.md#81-type-and-target-floors) raise every width, including desktop,
because a 0.68–0.82 rem control scale was never comfortable there either.

**The retro look is a fixed input, not a variable.** The palette, the terminal type family, the
scan lines, stamped uppercase labels, offset shadows, double borders, and campaign accents all
survive unchanged. This slice moves size, spacing, safe areas, and reading order. A submission
that reads as a modern mobile app has failed even if every measurement passes.

The slice stays presentation-only under the boundary
[13 §3](13-playable-web-demo.md#3-composition-and-dependency-direction) and
[14 §1](14-game-interface.md#1-outcome-and-boundary) already set. No engine, kind, campaign,
projection, DTO, session, persistence, or client-parity change; no new gesture, route, bundle,
component tree, or user-agent branch.

One correction rides along because it is a phone problem specifically: the authored scene body
is currently marked up as an `h2`, which makes the screen-reader heading rotor — the primary
navigation mechanism on a phone — return a wall of story instead of a landmark. The scene
becomes a labelled region with a short real heading, and the post-commit focus target moves
with it. Rendered authored text is unchanged.

- **Spec:** [`14-game-interface.md`](14-game-interface.md) §1 and §8 (Revision 2), with §§2–7
      unchanged; [`13-playable-web-demo.md`](13-playable-web-demo.md) §3, §7–§9;
      [09 §1](09-clients.md#1-the-rule-made-testable),
      [§2](09-clients.md#2-the-only-surface),
      [§6](09-clients.md#6-projection-is-not-optional).
- **Touches:** `site/src/play/play.css` (type scale, hit areas, snap pages, safe areas,
      full-bleed trim, breakpoints), `site/src/play/PlayApp.tsx` (scene region and heading,
      choice-count cue, post-commit scroll target), `site/src/play/PlayApp.test.tsx` and the
      site's browser/visual checks, and `site/play/index.html` only if a viewport or
      `theme-color` correction is needed. No `src/engine/` change of any kind.
- **Depends on:** [W65](#w65) — hard, not preferential. Every measured criterion below needs a
      real browser, and the promise that the desktop compositions survive is only checkable
      against a baseline W65 captures before this slice moves any CSS. Also [W63](#w63) for the
      cabinet grammar and [W64](#w64) for the casebook, journey log, and arrival receipt that
      must survive the recomposition. No engine dependency.
- **Done when:**
  - W66.1 Every §8.1 role meets its floor as a **computed** style at 320 px — authored prose
        1.125 rem at line-height 1.6 or more, choice labels 1.0625 rem, cabinet controls and
        dossier titles 1 rem, stat labels and values 0.9375 rem, reason/receipt/journey/save
        text 0.875 rem. Assertions read computed values from a rendered tree; matching the
        stylesheet's source text does not count. Only stamped marquee, eyebrow, and disk labels
        sit below that, and each is decorative or duplicated by larger text nearby.
  - W66.2 Every interactive control — choice card, cabinet button, dossier, notice button,
        journey control, scene-echo cue — presents at least a 44 × 44 px hit area at 320 px and
        at 1280 px, produced by padding rather than a transparent overlay, with at least 8 px of
        non-actionable space between adjacent choice controls.
  - W66.3 Below 768 px a turn renders as two scroll-snap stops: a scene page that fills the
        viewport and names the shown-choice count, then a choice page of full-width cards under
        a pinned single-line scene echo that returns to the scene page when activated. At
        768 px and above no snapping applies, and the 1280 px composition differs from the
        W65 baseline only in the type and spacing W66.1 and W66.2 require — every other
        difference is either justified in the pull request or reverted.
  - W66.4 With scroll-snap unsupported, with smooth scrolling unavailable, and with the cue's
        script path disabled, the scene, every choice, and the status console all remain
        reachable by ordinary vertical scrolling in that order. Both pages are in the DOM at
        all times; no choice is conditionally unmounted, gesture-gated, or revealed only by
        animation.
  - W66.5 Committing an action lands the player on the new turn's scene page with focus on the
        scene, never on a stale choice page and never mid-transition. A rejected action leaves
        the player where they were with the scene still authoritative, and cannot produce a
        false arrival receipt or journey entry — W64.11 and W64.12 still hold verbatim.
  - W66.6 No gesture is introduced: no swipe, horizontal paging, carousel, drag, long-press,
        edge gesture, or pull-to-refresh interception. Pinch zoom is not disabled and the
        viewport is not pinned to a fixed width.
  - W66.7 Full-height panels use dynamic viewport units, every inset-facing edge adds
        `env(safe-area-inset-*)` padding, and below 768 px the cabinet is full-bleed with its
        offset shadow and double border collapsed to a single edge. The document does not
        scroll horizontally at 320, 360, 390, 414, or 768 px in portrait, in landscape, or at
        200% zoom; at 200% zoom on a 390 px viewport the narrow composition is retained.
  - W66.8 The authored scene renders inside a labelled region with a short real heading; the
        prose itself is not a heading. The page keeps one H1, a coherent heading order, and its
        existing live-region announcements. Automated accessibility checks pass on shelf,
        briefing, notice, playing, unavailable-choice, rejected, and ended states, and a
        keyboard-only pass completes a full turn without a pointer.
  - W66.9 The retro identity is preserved and shown to be: the palette custom properties, type
        family, scan-line overlay, stamped uppercase labels, offset shadows, double borders,
        and the six campaign accent themes are all still present and applied. No colour token
        changes value. Uppercase transformation appears on stamped labels only — never on
        authored prose, choice labels, reasons, or error text.
  - W66.10 Reduced motion makes the cue jump and the post-commit return instant, removes
        smooth scrolling, and leaves snapping and every authored transition already governed by
        W63.9 intact. No action waits on an animation and no permanent timer runs while idle.
  - W66.11 One full route through Bureaucracy and one through each Lucifer role complete at
        320 px, 390 px, 768 px portrait and one landscape phone, with no clipped authored text,
        no truncated or ellipsised choice label, and no action stranded below an inaccessible
        internal scroll region. Visual snapshots cover playing, unavailable-choice,
        persistence-warning, and ended states at each of those sizes.
  - W66.12 Browser/text-client parity still produces byte-identical serialized outcomes, the
        engine package is untouched, `/play/` remains a direct static route making no runtime
        request, and the decorative payload does not grow. Site checks, documentation checks,
        engine gates, and `git diff --check` all pass.
- **Out of scope:** any engine, kind, campaign, projection, DTO, reason-code, session, or
      persistence change; new campaigns, scenes, endings, or mechanics; a palette, type-family,
      or voice refresh; a separate mobile route, bundle, component tree, or user-agent branch;
      a native shell, PWA, service worker, install prompt, or offline mode; gesture navigation,
      a bottom-sheet choices modal, or a carousel; durable storage, accounts, analytics, audio,
      new art beyond CSS-native trim adjustments, and a mobile visual language for the
      simulation or world-graph kinds.

### Correctness Debt Found by Reconciliation

### [ ] W67 — Restore the Story-Graph Regression Evidence {#w67}

**Delivers:** The replay corpus, determinism goldens, and observability acceptance test that
the [W64](#w64) campaign rewrite removed for the flagship kind. Story-graph is currently the
only shipped kind with no cross-version oracle, and nothing reports that: the suite is green,
because the tests that would have failed were deleted along with the campaigns they covered.

Three separate losses, one cause. `bulgaria-bureaucracy.replay.test.ts` was the only reader of
`fixtures/replay/bureaucracy-*.{fixture,outcome}.json`; those six files are still on disk,
still pinned at `campaignVersion: "1.0.0"`, and now orphaned. Five
`__snapshots__/*.determinism.test.ts.snap` golden files went with their tests. And
`bulgaria-bureaucracy.observability.test.ts` — the executable form of `MVP.md` §5's
*Observable* box, proving a human reading the `jsonl` stream can diagnose the gate's visit
counts and the random transition's pick — has no replacement; `nullEmitter` now appears only
in two unit suites, against no real campaign.

The corpus files could not have survived the rewrite unchanged, since the campaigns now publish
`2.0.0`. That is the reason to regenerate them deliberately, not the reason to leave them.

**A regenerated `.outcome.json` is a statement that the game changed**
([07 §4](07-replay.md#4-the-corpus)) and is reviewed as one. This unit produces new outcome
files against v2 routes; each is read on its merits, not accepted because the runner emitted it.

- **Spec:** [`07-replay.md`](07-replay.md) §4, §6, §7; [04 §14](04-core.md#14-determinism-harness);
      [`05-observability.md`](05-observability.md) §12; `MVP.md` §5.
- **Touches:** `src/engine/fixtures/replay/bureaucracy-*.{fixture,outcome}.json`,
      a restored replay suite and determinism suite beside the campaigns, and a restored
      `jsonl` observability suite. No `design/` change — this unit implements what the
      documents already require.
- **Depends on:** [W64](#w64) being on `main`, since the fixtures are regenerated against its
      v2 campaign graphs.
- **Done when:**
  - W67.1 Three `bureaucracy-*` fixture/outcome pairs exist against `campaignVersion: "2.0.0"`,
        covering materially different routes and matching [07 §4](07-replay.md#4-the-corpus)'s
        own priority order: a Definition-of-Done arc, a gated choice, and one deliberate edge
        case. Each outcome file is reviewed as content, not regenerated in bulk.
  - W67.2 A replay suite enumerates the corpus by prefix from `fixtures/replay/`, so a new
        fixture pair needs no test-file edit, and honours `REPLAY_BASELINE_DIR` the same way the
        `stable-life` and `world-graph-mvp` suites do — the W23 release-tag job must cover
        story-graph again.
  - W67.3 **The corpus asserts its own membership.** A test fails when an expected fixture
        prefix is absent and when a `.fixture.json` has no matching `.outcome.json`, or vice
        versa. Directory enumeration alone is what made the original deletion invisible; this
        criterion is the whole lesson of that loss and is not optional.
  - W67.4 A story-graph determinism suite commits a golden `serialize()` output for at least
        one campaign and replays it under `nullEmitter` and `recordingEmitter` with
        byte-identical output — [04 §14](04-core.md#14-determinism-harness)'s golden-file and
        sink-independence rows, against a real campaign rather than a synthetic state.
  - W67.5 Stream reproducibility holds: the same fixture under `recordingEmitter` twice yields
        the identical event sequence, with `gameId` normalized out
        ([05 §12](05-observability.md#12-validation-and-tests)).
  - W67.6 A `jsonl` observability suite restores `MVP.md` §5's *Observable* claim against a real
        campaign: the stream is unfiltered, and both a gate's visit counts and a random
        transition's pick are readable from it.
  - W67.7 Engine gates, documentation checks, and `git diff --check` all pass, and no orphaned
        fixture file remains in `fixtures/replay/`.
- **Out of scope:** campaign content changes; a new corpus for `simulation` or `world-graph`,
      both of which still have theirs; the cross-repository replay corpus; any change to the
      runner's verdict vocabulary or to `Outcome`'s shape.

### [ ] W68 — Make the Browser Save Adapter Actually Restore {#w68}

**Delivers:** The working half of the durable local checkpoint that
[13 §5](13-playable-web-demo.md#5-checkpoints-and-lifetime) Revision 2 now specifies. The
`SessionPersistence` port and a `localStorage` adapter shipped with [W61](#w61); the adapter
writes under `record.campaignId` and reads by `saveId`, so every write succeeds, every read
misses, and no gate notices. Nothing on the page ever attempts a restore, and the session half
of the adapter is an in-memory `Map`, so nothing survives a reload today regardless.

The design was written after the code here, which is the defect and is recorded as such in
`design/90-decisions.md`. This unit brings the code up to the specification that
now exists.

- **Spec:** [`13-playable-web-demo.md`](13-playable-web-demo.md) §5 (Revision 2);
      [04 §7.2](04-core.md#72-host-persistence--the-record-store-beneath-the-session-store);
      [06 §5.2](06-extensibility.md#52-sessionpersistence-and-profilestore);
      [09 §3](09-clients.md#3-what-a-client-may-and-may-not-do).
- **Touches:** `site/src/play/composition.ts` (the adapter), `site/src/play/PlayApp.tsx`
      (resume offer and honest save state), `site/src/play/browser-client.test.ts` and
      `PlayApp.test.tsx`. `src/engine/` only if `SaveRecordStore.delete` is resolved by removing
      it.
- **Depends on:** [W61](#w61). Independent of [W65](#w65)/[W66](#w66) — it changes behaviour,
      not layout — but should land before them so the resume path is in the visual baseline.
- **Done when:**
  - W68.1 The adapter addresses a save by `saveId` for both `get` and `put`, and a test writes
        a save, reconstructs the store from a fresh adapter over the same backing storage, and
        loads it back — the round trip the current implementation cannot perform.
  - W68.2 `/play/` offers to resume a stored checkpoint on load, per campaign, and declining it
        starts a new run without destroying the stored one until the player commits to that.
  - W68.3 Storage failure is honest and non-fatal: a quota error, disabled storage, or private
        browsing surfaces `storage_failure` rendered through the string table — never a raw
        English message — and the run continues in memory. A run with `SessionPersistence`
        omitted entirely still satisfies all ten rows of [09 §4](09-clients.md#4-the-api-coverage-checklist).
  - W68.4 The save state the page shows is truthful: "saved" is claimed only after a write the
        adapter confirmed, and the existing warning copy no longer implies a durable write that
        did not happen.
  - W68.5 `SaveRecordStore.delete` is resolved — either the store calls it on a path that needs
        it, or it is removed from the port. A required method with no caller obliges every host
        to implement nothing.
  - W68.6 The client still persists nothing: React holds a `SessionStore` and never sees a blob,
        an envelope, or a storage key. The adapter lives in the site composition root.
  - W68.7 Browser/text-client parity still produces byte-identical serialized outcomes, and
        engine gates, site checks, documentation checks, and `git diff --check` all pass.
- **Out of scope:** accounts, cloud sync, cross-device resume, multiple named save slots per
      campaign, a server-held session, or any storage-format migration mechanism — the format is
      the existing `SaveEnvelope` and §10.2 already owns its versioning.

- [ ] More clients (Discord; the first web client is [W61](#w61)).
- [ ] **Additional locales — sliced as [W60](#w60).** The MVP ships English only; the
      authoring→registry types already support more
      ([04 §10.1](04-core.md#101-content-registry)), so this is string tables plus tooling,
      no type change.
- [ ] AI-assisted authoring (content only; engine validates).
- [ ] **W63 proposed — Hosted engine edge.** Follow W62 with the real
      `.NET Platform edge → Node engine workload` process boundary: generated JSON/HTTP service
      contract first, MCP as a projection, one in-memory remote session before persistence,
      accounts, catalogue, or metering. Slice it only after W62 and the Platform package gate are
      proven ([`neaas-platform-vision.md`](https://github.com/The-Running-Dev/SubZeroDev.Platform)).
- [ ] Content packs — **sliced as [W58](#w58) and [W59](#w59)** — per
      [`11-content-packs.md`](11-content-packs.md): `resolvePacks` as a
      pure ordered fold; campaigns replace wholesale, strings per key; exact-version
      dependencies with no range solving; `campaignVersion` stamped with the `ResolutionId`
      so a game records the content it actually ran against; experiment gates (§5a) as the
      one mechanism for both A/B testing and feature flags, filtered before the fold via
      `ExperimentSource` ([06 §5.5](06-extensibility.md#experimentsource)). Before mods, not before MVP
      ([`neaas-platform-vision.md`](https://github.com/The-Running-Dev/SubZeroDev.Platform) → Known deferred gaps).
      W1's `src/engine/src/core/composition/types.ts` predates this design and does not yet
      declare `ExperimentSource`; add it there when this unit is implemented in code.

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


- [ ] **`SessionHost`/`createSessionLayer` ([06 §4](06-extensibility.md#4-the-composition-root)) don't reconcile as written.**
      Moved to [`OPEN-QUESTIONS.md`](OPEN-QUESTIONS.md) §2, since the replay regression oracle
      (W21) is now a second real call site that bypasses the same gap rather than closing it —
      see [`07-replay.md`](07-replay.md) §3.2. See `plans/14-w7-session-store.md`, Decision 1,
      for the original reasoning.
- [ ] `wisdom` attribute has no consumer in the simulation kind — needs one to earn its
      place (`games/04-engine-specification.md` §8.4).
- [ ] **Four simulation `ActionType`s have no content-definition type to resolve against.**
      `start_project`, `work_on_project`, `start_business` and `operate_business` are members
      of [10 §4.2](10-simulation-kind.md#42-action-types)'s closed union, so `ResolverTable`'s
      completeness check compels a resolver for each — but
      [§7](10-simulation-kind.md#7-content-definition-types) declares no `ProjectDefinition` or
      `BusinessDefinition`, and nothing in §7.2–§7.10 covers them. They are the only four of
      the thirty that no unit W53–W57 can implement. **Revisit when** a scenario needs one:
      either §7 gains the definitions or the union loses the members, and deciding that is
      `/contract`'s work, not a slice's. Found while slicing W53–W57.
- [ ] **The simulation `relationships` end-of-week system has no rule to implement.**
      [10 §3](10-simulation-kind.md#3-the-turn-is-a-week) names it in `END_WEEK_SYSTEM_ORDER`
      and [§6.11](10-simulation-kind.md#611-relationships) gives `RelationshipState` its full
      shape, but no weekly movement rule for it is stated anywhere in the contract — the stub's
      own comment in `src/engine/src/kinds/simulation/endOfWeek.ts` has said so since W37.
      W56 builds `socialize` against the shape and leaves the system a documented stub for
      exactly this reason. **Revisit when** the rule is written, which is `/contract`'s work.
- [ ] Provisional numbers across the simulation kind (drift rates, scenario economics,
      `demandBand` thresholds, housing-quality formula, travel costs) need a balancing
      pass once the sim harness runs.
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
<!-- human-doc:end -->
