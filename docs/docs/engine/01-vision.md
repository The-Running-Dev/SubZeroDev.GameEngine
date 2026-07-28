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
> [SubZeroDev.GameOfLife](https://github.com/The-Running-Dev/SubZeroDev.GameOfLife); the
> hosting/NEaaS layer is [SubZeroDev.Platform](https://github.com/The-Running-Dev/SubZeroDev.Platform).
> **This repo is the engine — its source (`src/engine/`) and its specs (these docs).**
> The source is not part of this site; [Engine Package](/docs/guide/engine-package)
> is the route to it.

---

## 1. What This Is

A narrative game platform built as a **deterministic engine with interchangeable
clients**. One engine powers many games; one API serves every client — web, mobile,
CLI, Discord, chat, and MCP-compatible AI agents. The UI is a replaceable client that
holds no game logic.

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
