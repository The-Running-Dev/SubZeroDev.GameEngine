---
title: 'Game Engine'
sidebar_position: 1
---

# The Specs

The **Game Engine** is a deterministic, game-agnostic narrative-game platform. These are its
specifications. The project's front page — what it is, how to build it, where the code lives
— is [the site root](/).

Read them in this order. Each file is scoped deliberately and cross-references the others by
section number.

| Document | Holds |
|---|---|
| [Vision](engine/01-vision.md) | Why the platform exists; the core/kind/campaign model |
| [Architecture](engine/02-architecture.md) | Every settled architecture decision, with rationale — **the contract (decisions)** |
| [The Core](engine/04-core.md) | The core as **types**: the Kind interface, the `GameState` envelope, the engine API, projection, validation — **the contract (types)** |
| [Story-Graph Kind](engine/03-story-graph-kind.md) | The flagship kind: nodes, choices, typed variables, consequences, endings, turn and settle semantics |
| [MVP](engine/MVP.md) | The smallest slice that proves the platform, and its Definition of Done |
| [TODO](engine/TODO.md) | The MVP as ordered units of work (W0–W19), with contract references and done-criteria |
| [Open Questions](engine/OPEN-QUESTIONS.md) | Living register of unknowns and deferred decisions; §1 is a decision log |

**The Core** sits before **Story-Graph Kind** deliberately: `04` implements `03` as types, and
the core is the shorter way in. The sidebar follows that reading order rather than the
filename prefixes.
