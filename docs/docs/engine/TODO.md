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

### W18 — Determinism Harness
The `PlaythroughFixture` runner, committed golden files, property tests, and the
sink-independence pass.
- **Spec:** [04 §14](04-core.md#14-determinism-harness); [05 §12](05-observability.md#12-validation-and-tests).
- **Depends on:** [W3a](#x-w3a--observability-emitter-events-and-sinks),
      [W15](#x-w15--the-bureaucracy-campaign-and-broken-fixtures).
- **Done when:** the same seed + action log serializes byte-identically; a one-byte golden
      edit fails the suite; N random seeds run twice match; `deserialize(serialize(state))`
      round-trips; every fixture replays byte-identically under `nullEmitter` and
      `recordingEmitter`; the event stream is golden-filed and a stream diff fails the suite
      on an unintended behavioural change; the suite passes in Node with no DOM, network, or
      AI adapter installed.

### W19 — MVP Acceptance
Walk [`MVP.md`](MVP.md) §5 and attach test evidence to each box.
- **Depends on:** every unit above.
- **Done when:** every box is checked with a named test. **MVP DONE.**

---

## Post-MVP — Depth

### Rigour: The Replay Regression Oracle

Replaying committed fixtures across **engine versions**, per
[`07-replay.md`](07-replay.md). Distinct from W18, which compares a build against itself.

- [ ] The `Outcome` projection and the three-verdict runner (07 §3, §6), driven by a
      counting `IdSource` ([06 §5.1](06-extensibility.md)) so `createGame` itself replays.
- [ ] A seed corpus: every MVP §5 playable box, plus a fixture for each bug fixed after W19
      — 05 §11 already makes a bug report a fixture, so this is capture, not authoring.
- [ ] Wired to run on `src/engine/src/core/` and `kinds/` changes and on release tags, not
      on every commit ([07 §8](07-replay.md#8-where-this-runs)).
- [ ] Regenerating a committed `.outcome.json` is a deliberate, reviewed step — never an
      automatic sweep ([07 §7](07-replay.md#7-intended-change-versus-regression)).

**Not MVP.** It compares versions, and before W19 there is only one. Sequenced here so the
contract is settled while the reasoning is fresh, which is the same call observability took.

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

- [ ] **Specify the kind first, in this repository.** `games/04-engine-specification.md` is
      an *engine* spec, not a kind spec — roughly half of it (§1–§3, §6, §11, §16–§18, §20)
      is core material [`04-core.md`](04-core.md) now owns, and the rest is written as a
      game's engine rather than against the Kind seam. The contract that belongs here is the
      simulation equivalent of [`03-story-graph-kind.md`](03-story-graph-kind.md), extracted
      from its §5, §7–§10, §12 and §14 and reconciled with `04` §3, the `GameState`
      envelope, `Kind.outcome`, and the `kind.simulation.*` event namespace ([05 §9](05-observability.md#9-kind-events)).
- [ ] Then build it, per that contract (upstream Phases 1–4 remain a useful build order).
- [ ] "Stable Life" scenario playable to a win and a loss.
- [ ] Its Definition of Done: `games/life-in-the-fast-lane.md`.

### Depth: Sun Trap (The `world-graph` Kind)

The third kind, and the first spatial one. **Specified —**
[`12-world-graph-kind.md`](12-world-graph-kind.md) fixes the seam; the game it serves lives
in [SubZeroDev.SunTrap](https://github.com/The-Running-Dev/SubZeroDev.SunTrap) ([12 §17](12-world-graph-kind.md#17-what-remains-in-the-game-repository)).

- [ ] **`KindContext.derive` and the `tick` stream** ([04 §3.1](04-core.md#31-kindcontext), [§8](04-core.md#8-randomness)). Both are specified and
      both are gaps `simulation` shares — its NPC draws need `agent` streams that no kind
      could reach either. Build them with whichever kind lands first, not twice.
- [ ] **`previewAction` and the tenth API pairing** — see
      [`OPEN-QUESTIONS.md`](OPEN-QUESTIONS.md) §2. Amend 09 §4, `MVP.md` §5 and the MCP
      surface ([04 §13](04-core.md#13-the-mcp-surface)) together.
- [ ] Build the kind per 12: tick pipeline, guest and staff agents, pathfinding, queues,
      construction, economy, incidents, objectives.
- [ ] **Batch invariance is the acceptance test with teeth** ([12 §5](12-world-graph-kind.md#5-batch-invariance--and-the-two-seam-changes-it-forced)): `advance_ticks n`
      reaches the same world as any split of it, compared as an `Outcome` ([07 §3](07-replay.md#3-what-the-same-outcome-means)) rather
      than as bytes, since the action logs legitimately differ.
- [ ] Determinism beyond the seed ([12 §9](12-world-graph-kind.md#9-determinism-beyond-the-seed)): integer arithmetic, no `Math.sqrt` in distance,
      ties by entity id, canonical iteration order, derived entity ids, no serialized caches.
- [ ] Its Definition of Done lives with the game, not here.

### Depth: Finish the Bulgaria Adventure

- [ ] The remaining four arcs (Inheritance, Enterprise, Driving, Return).
- [ ] Its full Definition of Done: `games/bulgaria-adventure.md`.

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


- [ ] **No unit owns the real migration mechanism.** W3's `Engine.migrate` is a
      pass-through to `deserialize` — correct for now, since `MVP.md` §4 excludes
      migration from the MVP and there is exactly one `formatVersion` in existence — but
      the mechanism 04 §10.2 describes (detect a version mismatch, remap old ids, mark
      `replayCompatible: false`) has no `W`-numbered unit building it. Post-MVP, before it's
      needed. See `plans/09-w3-pure-engine-kernel.md` (repository root), Decision 5.
- [ ] **`SessionHost`/`createSessionLayer` ([06 §4](06-extensibility.md#4-the-composition-root)) don't reconcile as written.**
      `SessionHost.sessions` is typed `SessionStore` — the full nine-operation API — but
      `createSessionLayer(host: SessionHost): SessionStore` reads as producing that same
      type from an input that already has it, which only makes sense if `sessions` was
      meant to be a lower-level, storage-only port that `createSessionLayer` wraps with
      the stamping ([05 §6.1](05-observability.md#61-how-per-command-context-reaches-an-event)) and profile-upsert ([04 §7.1](04-core.md#71-the-profile-store)) behaviour — a port `04-core.md`
      never separately names. W7 built `createInMemorySessionStore` directly against
      `session/types.ts`'s `SessionStore` instead, since TODO's own W7 done-criteria never
      name `SessionHost` or `createSessionLayer`. The composition-root generality
      `06-extensibility.md` §4 describes is still unbuilt. See
      `plans/14-w7-session-store.md`, Decision 1.
- [ ] **The achievement-unlock `StateChange` shape is a convention this unit invented, not
      one `04-core.md`/`03-story-graph-kind.md` pin.** Both docs say a kind "emits an
      `achievement_unlocked` `StateChange`" but neither fixes its `path`/`op`/`value` —
      `StateChange.reason` is a bare `ReasonCode` (`type ReasonCode = string`), so a
      kind-agnostic session store has no contract to detect one by. W8 built against
      `{ path: "achieved.<id>", op: "set", value: true, reason: "achievement_unlocked" }`
      (reusing 03 §6's already-fixed `achieved.<id>` condition-field name), and no real
      kind has implemented it yet to check the two sides against each other. Needs formal
      codification in `04-core.md` §12 once `story-graph` (W9–14) or `simulation` actually
      emits one. See `plans/15-w8-profile-store.md`, Decision 1.
- [ ] **The consequence-applied `StateChange` shape is also an invented convention —
      now load-bearing, not just provisional.** 03 §5/§8.4 describe the
      `consequence.applied` *event* (`data: variable, op, clamped`) but not the
      `StateChange` a variable write should produce. W9 built against one coalesced
      `StateChange` per touched variable per batch —
      `{ path: "var.<name>", op: "set", value: <final>, previous: <before>,
      reason: "consequence_applied", visible: <decl.visible> }` — reusing 03 §6's
      `var.<name>` condition-field name, `op: "set"` regardless of which typed ops ran,
      and W8's `reason` literal-string precedent. W12's `advance` (`submitChoice`) is now
      the real caller that attaches these to `AdvanceResult.changes` — the convention is
      exercised and tested, not merely predicted. Still needs formal codification in
      `04-core.md` §12 itself, which this unit deliberately left as a documentation
      follow-up rather than doing inline (`plans/19-w12-…`, Decision 3). See
      `plans/16-w9-variables-and-consequences.md`, Decision 3.
- [ ] **`04-core.md`'s ancestor citation for the `Condition` type is stale — the shape
      itself was never ported into this repo's docs.** §18 declares the operator set
      frozen and cites `games/04-engine-specification.md` §13.1 for the full surface, but
      that document lives in the companion `SubZeroDev.GameOfLife` repo, not here. W10
      ported the shape from it directly (`Condition`/`ComparisonOperator`/`ExistsCondition`/
      `CountCondition`) into `core/condition/types.ts`, dropping the ancestor's
      `CollectionSelector` (a closed union of simulation-kind paths with no kind-agnostic
      meaning). `04-core.md` §18 should restate the ported shape rather than pointing at a
      sibling repo a reader of this one can't open. See
      `plans/17-w10-conditions-and-requirements.md`, Decision 1.
- [ ] **Kind-owned reason-code `messageKey`s have no stated namespace in `04-core.md`
      itself — now registered and used, but only in code.** §12 reserves `core.reason.*`
      for the base set only; `kind.<kindId>.*` ([05 §9](05-observability.md#9-kind-events)) is event-name namespacing, a
      different vocabulary. W10 used `story-graph.reason.<code>` (kind id, no `kind.`
      wrapper) as the minimal-invention parallel, for `unknown_condition_field`. W12
      formalized it in code — `src/engine/src/kinds/story-graph/reasons.ts` mirrors
      `src/engine/src/core/kernel/reasons.ts`'s own pattern exactly (a const array, a
      compiler-forced-complete message table, a `ReadonlyMap` built from both) and is the
      real, tested caller this item was waiting
      on. `04-core.md` §12 itself still doesn't document the `<kindId>.reason.*`
      convention — a documentation follow-up, not blocking (`plans/19-w12-…`, Decision 3).
      See `plans/17-w10-conditions-and-requirements.md`, Decision 3.
- [ ] **03 §7 and §9 read in tension over whether a `hidden` achievement appears in
      `StoryGraphView.unlockedAchievements` once unlocked.** §9's field comment says
      "non-hidden, unlocked"; §7 defines `hidden` as "not listed **until unlocked**",
      which only makes sense if unlocking is what makes it listed. W13 resolved this in
      code in §7's favor — `project` passes every unlocked id through regardless of
      `hidden` — since §7 is the section that actually defines the field's semantics in
      full prose, and §9's comment predates `AchievementDefinition` existing at all (W12
      built `StoryGraphView` against a placeholder type, plan 19 Decision 5). Needs a doc
      pass to make §9's comment agree with §7 rather than contradict it. See
      `plans/20-w13-endings-and-achievements.md`, Decision 3.
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
