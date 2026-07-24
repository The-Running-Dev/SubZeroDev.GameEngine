# Narrative Engine — MVP

**Status:** Agreed. The Definition of Done (§5) is finalized — it is the build target.

> **Scope of this document**
> The minimum viable product: the smallest build that proves the platform end to end.
> What is in, what is out, and what "done" means.
>
> - Architecture: [`02-architecture.md`](02-architecture.md)
> - The task list: [`TODO.md`](TODO.md)

---

## 1. The MVP in one sentence

**A player — human or AI — plays the Bureaucracy arc of the Bulgaria adventure to an
ending, through a text client and through MCP, on a deterministic engine with
save/resume.**

That single slice exercises every load-bearing part of the platform: the pure engine
core, session storage, the typed variable schema, requirement-gated choices, seeded
random transitions, an achievement, the projection boundary, save/load, content
validation, the client API, and the MCP surface.

## 2. Why story-graph, not Jones

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

## 3. In scope

- The **core layer**: the pure engine (`advance(state, action) → state`), a session
  store keyed by id, seeded RNG (PCG32, one substream is enough), the projection, save/
  load, canonical serialization.
- The **`story-graph` kind**: nodes, choices, typed-variable schema, requirements
  (reusing the simulation kind's `Condition` tree), consequences, endings,
  achievements, seeded random-transition nodes. Specified first in
  `03-story-graph-kind.md`.
- **Content**: the Bulgaria **Bureaucracy arc only** — roughly 6–8 nodes (Municipality,
  Government Office, Room 14/6), a few typed variables, requirement-gated retries, one
  ending, the "It Builds Character" achievement.
- **One text client** — the plain proving instrument.
- **The MCP server** — the same operations as tools.
- **Tests**: the determinism harness (golden file + property test) and Tier 1/2 content
  validation.

## 4. Out of scope (explicitly)

- The `simulation` kind and Life in the Fast Lane — the next milestone, not the MVP.
- Culture packs.
- The other four Bulgaria arcs.
- Everything in [`neaas-platform-vision.md`](https://github.com/The-Running-Dev/SubZeroDev.Platform): hosting,
  accounts, billing, cloud sync, analytics, multiplayer, white-label.
- Web / mobile / Discord clients — one text client is enough to prove the API.
- AI-assisted authoring.
- Migration between campaign versions (the *mechanism* is specified; the MVP does not
  exercise it).

## 5. Definition of Done — the MVP

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

**Persistent**
- [ ] Save mid-arc, load, and continue with no state loss.
- [ ] The unlocked achievement **persists to the `PlayerProfile`** across sessions; a
      missing or corrupt profile degrades to "no achievements", never a broken game (03 §7).

**Sound**
- [ ] Tier 1 validation rejects a deliberately broken campaign (dangling node id,
      undeclared variable) at load.
- [ ] Tier 2 flags an unreachable node as a warning.
- [ ] The projection never exposes a hidden variable to either client.

**Portable**
- [ ] The full suite passes in Node with **no DOM and no network/AI adapter installed** —
      the platform has no hidden client or provider dependency.

**Honest**
- [ ] No game logic lives in either client — verified by the API coverage checklist
      (the text client drives every public engine method).

When every box is checked, the platform is proven. Depth (Jones) and breadth (more
campaigns, more clients, hosting) build on a foundation that already works.
