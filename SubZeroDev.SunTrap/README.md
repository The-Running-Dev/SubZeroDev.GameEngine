# SubZeroDev.SunTrap

**Sun Trap** — a satirical resort-management simulation. Build a holiday paradise, then
discover that people, alcohol, plumbing, weather, queues, staffing and basic geometry have
formed an alliance against you.

> **Status:** design documents only. No code yet. Staged inside the Game Engine repository
> for review; move to its own repository before any implementation begins.

---

## What This Repository Is

The **game**. It is content and design, built on an engine that lives elsewhere.

```text
SubZeroDev.GameEngine     the deterministic platform
  └── world-graph         the kind — engine-owned code, engine repository
        └── Sun Trap      this repository — campaigns, design, client, balance
```

The engine is
[SubZeroDev.GameEngine](https://github.com/The-Running-Dev/SubZeroDev.GameEngine). This
mirrors the relationship
[SubZeroDev.GameOfLife](https://github.com/The-Running-Dev/SubZeroDev.GameOfLife) has with
the `simulation` kind: the kind contract lives in the engine, the game lives here.

**The engine owns** determinism, seeded randomness, canonical serialization, save and
migration, the content registry, validation, localization, projection, sessions,
achievements, replay, and the API and MCP surfaces. None of it is re-implemented here.

**The kind owns** the tick pipeline, guest and staff agents, pathfinding, queues,
construction, the resort economy, incidents and objectives — as reviewed engine code, in
the engine repository.

**This repository owns** maps, scenarios, building and product definitions, guest
archetypes, balance, narrative voice, the visual client, and the game's own definition of
done.

## The Engine Contract

The kind this game runs on is specified at
[World-Graph Kind](https://game-engine.subzerodev.com/docs/engine/world-graph-kind) — the
document to read before adding anything here that looks like engine behaviour. Several
things that feel like game decisions are already fixed there:

| Already decided by the engine | Where |
|---|---|
| What may live in game state, and what may not | [§3](https://game-engine.subzerodev.com/docs/engine/world-graph-kind) |
| That a batch of ticks equals the same ticks taken singly | [§5](https://game-engine.subzerodev.com/docs/engine/world-graph-kind) |
| The action list and their parameters | [§6](https://game-engine.subzerodev.com/docs/engine/world-graph-kind) |
| That win and loss are not engine statuses | [§8](https://game-engine.subzerodev.com/docs/engine/world-graph-kind) |
| Integer-only arithmetic, tie-breaking by id, derived entity ids | [§9](https://game-engine.subzerodev.com/docs/engine/world-graph-kind) |
| Reason codes and event names | [§11, §12](https://game-engine.subzerodev.com/docs/engine/world-graph-kind) |
| That content packs merge campaigns wholesale and strings per key | [§14](https://game-engine.subzerodev.com/docs/engine/world-graph-kind) |

The wider engine contract, when a question is not kind-specific:

| Document | Answers |
|---|---|
| [Architecture](https://game-engine.subzerodev.com/docs/engine/architecture) | Every settled decision, including §1a — the test for whether something is a kind or a campaign |
| [The Core](https://game-engine.subzerodev.com/docs/engine/core) | The `GameState` envelope, the Kind seam, the engine API, projection, validation |
| [Clients](https://game-engine.subzerodev.com/docs/engine/clients) | What a client may and may not do, and the coverage checklist that proves it |
| [Content Packs](https://game-engine.subzerodev.com/docs/engine/content-packs) | How packs resolve, and why `campaignVersion` becomes a digest |

## Documents

| Document | Holds |
|---|---|
| [`01-vision.md`](01-vision.md) | Why this game exists, what it should feel like, what is out of scope |
| [`02-game-design.md`](02-game-design.md) | The gameplay: map, guests, buildings, queues, staff, economy, incidents, objectives |
| [`03-client-specification.md`](03-client-specification.md) | The visual client — what it renders and what it may never do |
| [`04-mvp.md`](04-mvp.md) | The smallest slice that proves the game, and its definition of done |
| [`05-roadmap-risks-and-open-questions.md`](05-roadmap-risks-and-open-questions.md) | Phases, risks, and what is still undecided |
| [`06-content-and-systems.md`](06-content-and-systems.md) | Field-level detail: guest, building, staff, queue and construction shapes |

## Originality

This game is **inspired by the resort-management genre and reproduces none of it.**
Identity, art, writing, scenarios, building names, maps, balance and UI are original. No
proprietary names, assets, text or expression from any existing title appear in this
repository, and none may be added.
