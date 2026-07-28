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

**Playable**
- [ ] A player starts a session, plays the Bureaucracy arc, and reaches its ending.
- [ ] Requirement-gated choices are shown as unavailable **with a reason**, not hidden.
- [ ] At least one seeded random-transition node behaves and reproduces.
- [ ] The "It Builds Character" achievement unlocks exactly once.
- [ ] The Bureaucracy **loop** is traversed and its `office_visits ≥ 3` gate is reached —
      loops, self-`goto`, and visit counts all exercised.

**Two clients, one game**
- [ ] The identical arc is completable through the **text client**.
- [ ] The identical arc is completable through the **MCP server** — same operations,
      same result, no AI-specific path.

**Deterministic**
- [ ] Two runs from the same seed and choice log produce **byte-identical**
      `serialize()` output.
- [ ] `deserialize(serialize(state))` is deep-equal to `state`.
- [ ] A committed **golden-file fixture** (`{config, actionLog}` → expected `serialize()`)
      runs green in the suite; a one-byte diff fails it (04-core §14).

**Observable**
- [ ] Every golden fixture replays byte-identically under `nullEmitter` and under
      `recordingEmitter` — logging cannot change the game (05 §2).
- [ ] The same fixture replayed twice produces the **identical event stream** — same
      names, order, and data, compared modulo `gameId`, which a replay legitimately
      changes (05 §5).
- [ ] A sink that throws on every call does not break a game; the fixture still completes
      with byte-identical output, because the core isolates every `emit` (05 §10).
- [ ] Submitting an action id that matches nothing emits no `actionId` — the
      no-player-text rule holds against arbitrary caller input (05 §3.2, §8).
- [ ] Two concurrent session-store commands never cross-attribute an event (05 §6.1).
- [ ] A kind emitting outside its `kind.<kindId>.*` namespace, or an event name it did not
      declare, fails (05 §9).
- [ ] Playing the arc with the `jsonl` sink at `trace` yields a stream in which the
      Bureaucracy gate's visit counts and the random transition's pick are both readable —
      the events earn their place by making a real failure diagnosable (03 §8.4).

**Persistent**
- [ ] Save mid-arc, load, and continue with no state loss.
- [ ] With a `profileId`, the unlocked achievement **persists to the `PlayerProfile`**
      across sessions (04-core §7.1); a missing or corrupt profile degrades to "no
      achievements", never a broken game (03 §7).
- [ ] Without a `profileId` the session is **anonymous** — no profile read or write, and
      the game still plays to its ending.

**Sound**
- [ ] Tier 1 validation rejects a deliberately broken campaign (dangling node id,
      undeclared variable) at load.
- [ ] Tier 2 flags an unreachable node as a warning.
- [ ] The projection never exposes a hidden variable to either client.

**Portable**
- [ ] The full suite passes in Node with **no DOM and no network/AI adapter installed** —
      the platform has no hidden client or provider dependency.

**Honest**
- [ ] No game logic lives in either client — verified by the **API coverage checklist**
      ([`09-clients.md`](09-clients.md) §4): every one of the eight `SessionStore`
      operations exercised by an automated test through the text client *and* through its
      MCP tool, with no ninth operation and no tool that is not one.
- [ ] The client contract's own proof: the same arc, seed and choices driven through both
      clients serialize **identically** (09 §1). This is what "no game logic" means
      operationally — a client contributes nothing but the order of the actions it submits.

When every box is checked, the platform is proven. Depth (Jones) and breadth (more
campaigns, more clients, hosting) build on a foundation that already works.
