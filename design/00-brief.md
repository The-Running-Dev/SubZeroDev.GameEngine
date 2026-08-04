# Brief

> Canonical agent-kit brief for SubZeroDev.GameEngine. The marked blocks below are the single
> source for the generated Vision and MVP pages under `docs/docs/engine/`.

## Scope map

- Product purpose, layers, goals, clients, and non-goals: [Vision](#vision)
- Minimum proof and definition of done: [MVP](#mvp)

<!-- human-doc:start path="engine/01-vision.md" -->
---
---

# Vision

**Document status:** Revision 1 — architecture settled

**Project stage:** Design

> **Scope of this document**
>
> Why this platform exists and what it is. No types, no API shapes — those are in
> [`02-architecture.md`](02-architecture.md).
>
> - The architecture and every settled decision: [`02-architecture.md`](02-architecture.md)
> - The platform core as types (the Kind seam, the API): [`04-core.md`](04-core.md)
> - The two games built on it: `games/life-in-the-fast-lane.md` · `games/bulgaria-adventure.md`
> - What to build first, and when it's done: [`MVP.md`](MVP.md) · [`TODO.md`](TODO.md)
> - The flagship kind's content model: [`03-story-graph-kind.md`](03-story-graph-kind.md)
> - Shared Bulgarian source material: `games/bulgaria.md`
> - Deferred hosting/business layer: [`neaas-platform-vision.md`](https://github.com/The-Running-Dev/SubZeroDev.Platform)
> - The engine specification these docs were **derived from**:
>   `games/04-engine-specification.md`. Superseded here for everything the core owns; still
>   the only place the `simulation` kind's own rules are written ([`04-core.md`](04-core.md),
>   *Reused, not re-derived*)
>
> The `games/…` docs above — the two games, the simulation kind, and the shared source —
> live in the **companion game project**,
> [SubZeroDev.GameOfLife](https://github.com/The-Running-Dev/SubZeroDev.GameOfLife). A
> second game, Sun Trap, sits on the `world-graph` kind in
> [SubZeroDev.SunTrap](https://github.com/The-Running-Dev/SubZeroDev.SunTrap); the
> hosting/NEaaS layer is [SubZeroDev.Platform](https://github.com/The-Running-Dev/SubZeroDev.Platform).
> **This repo is the engine — its source (`src/engine/`) and its specs (these docs).**
> The source is not part of this site; [Engine Package](/docs/guide/engine-package)
> is the route to it.

---

## 1. What This Is

Game engines solved rendering, physics, animation, audio, and networking, once each.
Every new game still rewrites gameplay from scratch. This platform exists to ask
whether gameplay itself can be reusable — and answers it as a **deterministic engine
with interchangeable clients**. One engine powers many games; one API serves every
client — web, mobile, CLI, Discord, chat, and MCP-compatible AI agents. The UI is a
replaceable client that holds no game logic.

The central principle, unchanged from the source specification:

> The engine owns the truth. The UI is disposable. Campaigns are content. Build once,
> reuse everywhere.

---

## 2. The One Idea That Shapes Everything: Kinds

The source specification treated "the engine" as a single branching-story engine and
"a campaign" as story nodes plus choices. That model cannot host every game it wants
to — a weekly-budget life simulation is not a story graph, and forcing one into the
other explodes combinatorially.

So the platform is built in two layers:

- **The core** — the game-agnostic deterministic core: session state, seeded
  randomness, the visible-state projection, save and migration, the condition
  language, the content registry, and the single client/MCP API.
- **A kind** — a game-logic module, written as reviewed engine code, that sits on the
  core and defines how one *category* of game actually plays.

A **campaign** is a *kind plus its data*. Two kinds ship in v1:

| Kind | What it is | Flagship campaign |
|---|---|---|
| `simulation` | Weekly-tick life simulation: time budget, needs, economy, systems | Life in the Fast Lane |
| `story-graph` | Branching narrative: nodes, choices, typed variables, requirements, consequences | Bulgaria: Make-Your-Own-Adventure |

The Game Engine is the platform; **Life in the Fast Lane is a campaign on it** —
specifically, the flagship campaign of the `simulation` kind, already specified in
full under `games/`.

**Two games are being built on this engine**, each in its own document under
`games/`:

1. **Life in the Fast Lane** — the `simulation` kind.
   The Jones clone. Its Bulgarian culture pack is the customization example. The deep
   game; the depth milestone.
2. **Bulgaria: Make-Your-Own-Adventure** — the
   `story-graph` kind. A branching game. The simplest to build, and therefore the MVP.

They share only the Bulgarian setting and the deadpan voice — nothing mechanical.
Building both is the sharpest demonstration that the engine/kind/campaign separation
works: one setting, two genuinely different games, one engine.

The full reasoning behind this two-layer split, and every other architectural
decision, is in [`02-architecture.md`](02-architecture.md).

---

## 3. Goals

- Deterministic game logic (each kind declares its own determinism contract).
- Branching narrative as the flagship kind.
- Persistent sessions with save and resume.
- Platform-independent: one API, many clients.
- AI-friendly and human-friendly through the *same* game — no special AI version.
- MCP as a first-class client, not an afterthought.
- Extensible through content (new campaigns) without touching the engine.

---

## 4. What a Client Does

Every client — human or AI — does exactly three things: request the current scene and
state, present it, and submit the player's choice. It never computes an outcome, never
holds authoritative state, and never contains game rules. An AI agent playing through
MCP plays the identical game a human plays through a browser, because both go through
the same API to the same engine.

---

## 5. Non-Goals for V1

- The hosted service, accounts, billing, cloud sync, analytics, multiplayer, and
  white-labelling. All of that is real long-term intent and is recorded in
  [`neaas-platform-vision.md`](https://github.com/The-Running-Dev/SubZeroDev.Platform) — but it is **deferred**. The
  engine is a pure library first. (This is the source specification's own §33.1
  scope-creep risk, applied to itself.)
- New game *kinds* authored by third parties. A kind is engine code; v1 ships two.
  Adding a kind is a deliberate engine feature, not a content upload.
- Graphics. Text first, exactly as the source specification insists.

---

## 6. The Bet

Prove the core and the two kinds through automated tests and a plain text client,
with no UI and no AI in the loop. Once that works, every client is presentation and
every new game is content.

The engine is the product. Campaigns are the catalogue.
<!-- human-doc:end -->

<!-- human-doc:start path="engine/MVP.md" -->
---
slug: mvp
---

# MVP

**Status:** Agreed. The Definition of Done (§5) is finalized — it is the build target.

> **Scope of this document**
>
> The minimum viable product: the smallest build that proves the platform end to end.
> What is in, what is out, and what "done" means.
>
> - Architecture: [`02-architecture.md`](02-architecture.md)
> - The task list: [`TODO.md`](TODO.md)

---

## 1. The MVP in One Sentence

**A player — human or AI — plays the Bureaucracy arc of the Bulgaria adventure to an
ending, through a text client and through MCP, on a deterministic engine with
save/resume.**

That single slice exercises every load-bearing part of the platform: the pure engine
core, session storage, the typed variable schema, requirement-gated choices, seeded
random transitions, an achievement, the projection boundary, save/load, content
validation, the client API, and the MCP surface.

## 2. Why Story-Graph, Not Jones

Jones (Life in the Fast Lane) is where the project started and it is the deepest game —
but it is the **largest build**, ~150 KB of engine spec. An MVP is the *minimum* that
proves the thesis, and the thesis — *write the engine once, expose many clients,
campaigns as data, MCP as a first-class client* — is proven far more cheaply by the
story-graph slice.

Everything the MVP builds is **shared core** (§1–§10 of the architecture): session
model, projection, save, validation, API, MCP. Proving it with the cheap kind first
de-risks the platform for *both* games. Jones is the very next milestone
(`games/life-in-the-fast-lane.md`), building on a
core already proven.

**Decided: story-graph-first.** Jones-first was weighed and rejected — it makes the MVP
an order of magnitude larger (~150 KB of engine spec) without proving more of the
platform. Jones is the next milestone, on a core this slice already proves.

## 3. In Scope

- The **core layer**: the pure engine (`advance(state, action) → state`), a session
  store keyed by id and a profile store beside it (04-core §7/§7.1), seeded RNG
  (PCG32; two streams — `action` and `system:"start"`, 04-core §4/§8), the projection,
  save/load, canonical serialization, and the authoring→registry builder (04-core §10.1).
- The **`story-graph` kind**: nodes, choices, typed-variable schema, requirements
  (reusing the simulation kind's `Condition` tree), consequences, endings,
  achievements, seeded random-transition nodes. Specified first in
  `03-story-graph-kind.md`.
- **Content**: the Bulgaria **Bureaucracy arc only** — roughly 6–8 nodes (Municipality,
  Government Office, Room 14/6), a few typed variables, requirement-gated retries, one
  ending, the "It Builds Character" achievement.
- **One text client** — the plain proving instrument.
- **The MCP server** — the same operations as tools.
- **Observability**: the operational event channel — the `Emitter`, the core and
  story-graph event sets, timestamp and trace stamping at the session-store boundary, and
  the three MVP sinks (05-observability §10). Deterministic by construction and asserted
  by the harness; the OpenTelemetry exporter is deferred with the hosting layer (§4).
- **Tests**: the determinism harness (golden file + property test), sink independence,
  and Tier 1/2 content validation.

## 4. Out of Scope (Explicitly)

- The `simulation` kind and Life in the Fast Lane — the next milestone, not the MVP.
- Culture packs.
- The other four Bulgaria arcs.
- Everything in [`neaas-platform-vision.md`](https://github.com/The-Running-Dev/SubZeroDev.Platform): hosting,
  accounts, billing, cloud sync, analytics, multiplayer, white-label.
- Web / mobile / Discord clients — one text client is enough to prove the API.
- AI-assisted authoring.
- Migration between campaign versions (the *mechanism* is specified; the MVP does not
  exercise it).

## 5. Definition of Done — The MVP

*Finalized (agreed this session). This is the build target for the MVP.*

> **MVP DONE.** Every box below is checked against a named test — see `TODO.md` W19 and
> [`plans/26-w19-mvp-acceptance.md`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/blob/main/plans/26-w19-mvp-acceptance.md)
> for the full audit, including the two real gaps it found and closed.

**Playable**
- [x] A player starts a session, plays the Bureaucracy arc, and reaches its ending.
      — `src/engine/src/campaigns/bulgaria-bureaucracy.test.ts`: *"go_home at the gate ends the game,
      unlocking it_builds_character"*.
- [x] Requirement-gated choices are shown as unavailable **with a reason**, not hidden.
      — `src/engine/src/kinds/story-graph/scene.test.ts`: *"shows a gated choice with available: false
      and its requirementFailKey"*; real-arc proof in
      `src/engine/src/clients/text/client.test.ts`: *"7. submitAction — success renders the new scene;
      a gated choice renders unavailable with its real reason"*.
- [x] At least one seeded random-transition node behaves and reproduces.
      — `src/engine/src/campaigns/bulgaria-bureaucracy.test.ts`: *"the seeded clerk_review transition
      reproduces across two independent createGame calls"*.
- [x] The "It Builds Character" achievement unlocks exactly once.
      — `src/engine/src/kinds/story-graph/achievements.test.ts`: *"fires exactly once — a second
      evaluation on an already-unlocked state doesn't re-add or re-emit"*.
- [x] The Bureaucracy **loop** is traversed and its `office_visits ≥ 3` gate is reached —
      loops, self-`goto`, and visit counts all exercised.
      — `src/engine/src/campaigns/bulgaria-bureaucracy.test.ts`: *"wait, then two continue_cycle passes,
      reaches the office_visits >= 3 gate"*.

**Two clients, one game**
- [x] The identical arc is completable through the **text client**.
      — `src/engine/src/clients/text/client.test.ts`: *"7. submitAction — success renders the new
      scene; a gated choice renders unavailable with its real reason"* (reaches the
      ending in the same flow).
- [x] The identical arc is completable through the **MCP server** — same operations,
      same result, no AI-specific path.
      — `src/engine/src/mcp/server.test.ts`: *"completes the Bureaucracy arc through choose alone,
      reaching the ending and the achievement"*.

**Deterministic**
- [x] Two runs from the same seed and choice log produce **byte-identical**
      `serialize()` output.
      — `src/engine/src/core/determinism/harness.test.ts`: *"the same fixture run twice produces
      byte-identical serialize() output"*; real-campaign version:
      `src/engine/src/campaigns/bulgaria-bureaucracy.determinism.test.ts`: *"$name: serialize() output
      is golden-filed"*.
- [x] `deserialize(serialize(state))` is deep-equal to `state`.
      — `src/engine/src/core/kernel/engine.test.ts`: *"round-trips a valid envelope"*; real-campaign
      version: `src/engine/src/campaigns/bulgaria-bureaucracy.determinism.test.ts`: *"$name:
      deserialize(serialize(state)) round-trips"*.
- [x] A committed **golden-file fixture** (`{config, actionLog}` → expected `serialize()`)
      runs green in the suite; a one-byte diff fails it (04-core §14).
      — `src/engine/src/campaigns/bulgaria-bureaucracy.determinism.test.ts`: *"$name: serialize()
      output is golden-filed"* (the committed snapshot) plus *"a one-character
      difference is detectable — the sensitivity toMatchSnapshot() itself relies on"*.

**Observable**
- [x] Every golden fixture replays byte-identically under `nullEmitter` and under
      `recordingEmitter` — logging cannot change the game (05 §2).
      — `src/engine/src/campaigns/bulgaria-bureaucracy.determinism.test.ts`: *"$name: replays
      byte-identically under nullEmitter and recordingEmitter"*.
- [x] The same fixture replayed twice produces the **identical event stream** — same
      names, order, and data, compared modulo `gameId`, which a replay legitimately
      changes (05 §5).
      — `src/engine/src/campaigns/bulgaria-bureaucracy.determinism.test.ts`: *"$name: replayed twice
      under recordingEmitter yields the identical event sequence"*.
- [x] A sink that throws on every call does not break a game; the fixture still completes
      with byte-identical output, because the core isolates every `emit` (05 §10).
      — `src/engine/src/core/kernel/engine.test.ts`: *"a sink that throws on every call does not fail a
      game"*.
- [x] Submitting an action id that matches nothing emits no `actionId` — the
      no-player-text rule holds against arbitrary caller input (05 §3.2, §8).
      — `src/engine/src/core/kernel/engine.test.ts`: *"omits actionId for an unresolved action,
      includes it for a resolved-but-rejected one"*.
- [x] Two concurrent session-store commands never cross-attribute an event (05 §6.1).
      — `src/engine/src/core/session/store.test.ts`: *"two concurrent submitAction calls against
      different sessions never cross-attribute an emitted record's sessionId"*.
- [x] A kind emitting outside its `kind.<kindId>.*` namespace, or an event name it did not
      declare, fails (05 §9).
      — `src/engine/src/core/kernel/engine.test.ts`: *"createEngine rejects a kind whose eventNames
      escape its own namespace"*; runtime paths in
      `src/engine/src/core/observability/emitter.test.ts`: *"forKind view rejects a name outside its
      own kind namespace"* and *"forKind view rejects a name not in declaredEventNames
      even if in-namespace"*.
- [x] Playing the arc with the `jsonl` sink at `trace` yields a stream in which the
      Bureaucracy gate's visit counts and the random transition's pick are both readable —
      the events earn their place by making a real failure diagnosable (03 §8.4).
      — `src/engine/src/campaigns/bulgaria-bureaucracy.observability.test.ts`: *"plays wait,
      continue_cycle x2, go_home and finds both in the parsed stream"* (new for W19 —
      see `plans/26-w19-mvp-acceptance.md`, gap 1).

**Persistent**
- [x] Save mid-arc, load, and continue with no state loss.
      — `src/engine/src/core/session/store.test.ts`: *"save mid-session, load, and continue loses no
      state"*.
- [x] With a `profileId`, the unlocked achievement **persists to the `PlayerProfile`**
      across sessions (04-core §7.1); a missing or corrupt profile degrades to "no
      achievements", never a broken game (03 §7).
      — `src/engine/src/core/session/store.test.ts`: *"an unlock survives a new session with the same
      profileId, read directly from the ProfileStore"*, *"a missing profile surfaces
      profile_missing as a warning on the unlocking SessionActionResult"*, *"a corrupt
      profile surfaces profile_corrupt as a warning"*; degradation shape in
      `src/engine/src/core/session/profile-store.test.ts`: *"a missing profile loads empty with
      formatVersion 1 and a profile_missing warning"* and *"a corrupt profile loads
      empty with a profile_corrupt warning"*.
- [x] Without a `profileId` the session is **anonymous** — no profile read or write, and
      the game still plays to its ending.
      — `src/engine/src/core/session/store.test.ts`: *"no profileId means no read and no write — the
      ProfileStore is never called, and the session still plays to its ending"*
      (extended for W19 to prove both halves together — see
      `plans/26-w19-mvp-acceptance.md`, gap 3).

**Sound**
- [x] Tier 1 validation rejects a deliberately broken campaign (dangling node id,
      undeclared variable) at load.
      — `src/engine/src/campaigns/bulgaria-bureaucracy.test.ts`: *"dangling node: Tier 1
      dangling_reference at the retargeted goto, campaign does not load"* and
      *"undeclared variable: Tier 1 undeclared_variable at the rewritten effect,
      campaign does not load"*.
- [x] Tier 2 flags an unreachable node as a warning.
      — `src/engine/src/campaigns/bulgaria-bureaucracy.test.ts`: *"unreachable node: Tier 2
      unreachable_node, campaign still loads"*.
- [x] The projection never exposes a hidden variable to either client.
      — `src/engine/src/core/kernel/projection.test.ts`: *"view and scene never contain the seed, the
      logged action id, or the kind's hidden field"*; kind-level:
      `src/engine/src/kinds/story-graph/view.test.ts`: *"excludes non-visible variables and
      visitedCounts entirely"*.

**Portable**
- [x] The full suite passes in Node with **no DOM and no network/AI adapter installed** —
      the platform has no hidden client or provider dependency.
      — Structural, not a runtime test: `src/engine/package.json` has no `dependencies`
      key at all, and its `devDependencies` are only `@types/node`, `eslint`,
      `typescript`, `typescript-eslint`, `vitest` — no DOM, HTTP, or AI client library
      exists to install. No `vitest.config.*` file exists either, so the test
      environment defaults to plain `node`, never `jsdom`.

**Honest**
- [x] No game logic lives in either client — verified by the **API coverage checklist**
      ([`09-clients.md`](09-clients.md) §4): every `SessionStore` operation exercised by an
      automated test through the text client *and* through its MCP tool, one-to-one, with no
      tool that is not an operation and no client-side workaround for a missing one.
      — `src/engine/src/clients/text/client.test.ts`: `describe("TextClient — the API coverage
      checklist (09-clients.md §4)")`, ten numbered tests; `src/engine/src/mcp/server.test.ts`:
      `describe("McpTools — the API coverage checklist (09-clients.md §4)")`, the
      matching ten.
- [x] The client contract's own proof: the same arc, seed, **counting `IdSource`** and
      choices driven through both clients serialize **identically** (09 §1). The id source
      is part of the fixture, not an afterthought — `gameId` is serialized and random by
      default (06 §5.1), so without fixing it the comparison can never pass. This is what "no game logic" means
      operationally — a client contributes nothing but the order of the actions it submits.
      — `src/engine/src/mcp/server.test.ts`: *"the same seed and choices, under the same counting
      IdSource, produce identical scene/view sequences through TextClient and
      McpTools"* (fixed for W19 to use a genuinely counting `IdSource`, not a constant —
      see `plans/26-w19-mvp-acceptance.md`, gap 2).

When every box is checked, the platform is proven. Depth (Jones) and breadth (more
campaigns, more clients, hosting) build on a foundation that already works.
<!-- human-doc:end -->
