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
      All private.
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
      column — all nine operations exercised by automated tests, not by inspection; it
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
- [ ] Then build it, per that contract (upstream Phases 1–4 remain a useful build order).
- [ ] "Stable Life" scenario playable to a win and a loss.
- [ ] Its Definition of Done: `games/life-in-the-fast-lane.md`.

### Depth: Sun Trap (The `world-graph` Kind)

The third kind, and the first spatial one. **Specified —**
[`12-world-graph-kind.md`](12-world-graph-kind.md) fixes the seam; the game it serves lives
in [SubZeroDev.SunTrap](https://github.com/The-Running-Dev/SubZeroDev.SunTrap) ([12 §17](12-world-graph-kind.md#17-what-remains-in-the-game-repository)).

- [x] **`KindContext.derive` and the `tick` stream — already built, since W1/W2.** Not a gap
      this kind needs to close: `KindContext.derive` (04 §3.1) and all four `StreamId`
      variants, including `tick` and `agent`, exist in `core/kernel/types.ts`,
      `core/kernel/engine.ts`, `core/determinism/types.ts` and `core/determinism/rng.ts`
      (the encoder, exhaustiveness-guarded). `simulation`'s NPC draws and this kind's tick
      draws already have a reachable home — 04 §3.1's own callout box already documents
      `derive` closing exactly the reachability gap this checkbox describes as still open.
- [ ] Build the kind per 12: tick pipeline, guest and staff agents, pathfinding, queues,
      construction, economy, incidents, objectives — **including `previewAction` and the
      tenth API pairing** ([`OPEN-QUESTIONS.md`](OPEN-QUESTIONS.md) §2), amending 09 §4,
      `MVP.md` §5 and the MCP surface ([04 §13](04-core.md#13-the-mcp-surface)) together in
      the same change this kind lands in — not scheduled as a separate, earlier checkbox,
      since both 12 §7 and `OPEN-QUESTIONS.md` §2 are explicit it is deferred until this
      kind actually needs it.
- [ ] **Batch invariance is the acceptance test with teeth** ([12 §5](12-world-graph-kind.md#5-batch-invariance--and-the-two-seam-changes-it-forced)): `advance_ticks n`
      reaches the same world as any split of it, compared as an `Outcome` ([07 §3](07-replay.md#3-what-the-same-outcome-means)) rather
      than as bytes, since the action logs legitimately differ.
- [ ] Determinism beyond the seed ([12 §9](12-world-graph-kind.md#9-determinism-beyond-the-seed)): integer arithmetic, no `Math.sqrt` in distance,
      ties by entity id, canonical iteration order, derived entity ids, no serialized caches.
- [ ] Its Definition of Done lives with the game, not here.

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

### Breadth: The First Culture Pack

- [ ] Bulgaria culture pack over the simulation kind — Jones-in-Bulgaria content,
      no engine change ([`02-architecture.md`](02-architecture.md) §4a).

### Breadth: The Platform

- [ ] More clients (web, Discord).
- [ ] **Additional locales.** The MVP ships English only; the authoring→registry types
      already support more ([04 §10.1](04-core.md#101-content-registry)), so this is string tables plus tooling, no type
      change.
- [ ] AI-assisted authoring (content only; engine validates).
- [ ] The hosted service — only once all of the above works
      ([`neaas-platform-vision.md`](https://github.com/The-Running-Dev/SubZeroDev.Platform)).
- [ ] Content packs, per [`11-content-packs.md`](11-content-packs.md) — `resolvePacks` as a
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
