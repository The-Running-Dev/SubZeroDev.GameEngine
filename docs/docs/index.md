---
title: 'Game Engine'
---

# The Docs

The **Game Engine** is a deterministic, game-agnostic narrative-game platform. This is its
documentation, in the order the sidebar presents it. The project's front page — what it is,
where the code lives — is [the site root](/).

## Orientation

Start here. Two documents, and between them the shape of the whole thing.

| Document | Holds |
|---|---|
| [Vision](engine/01-vision.md) | Why the platform exists; the core/kind/campaign model |
| [Architecture](engine/02-architecture.md) | Every settled architecture decision, with rationale — **the contract (decisions)** |

## Contracts

What the engine *is*, as types. Each is scoped deliberately and cross-references the other by
section number.

| Document | Holds |
|---|---|
| [The Core](engine/04-core.md) | The core as **types**: the Kind interface, the `GameState` envelope, the engine API, projection, validation — **the contract (types)** |
| [Story-Graph Kind](engine/03-story-graph-kind.md) | The flagship kind: nodes, choices, typed variables, consequences, endings, turn and settle semantics |
| [Observability](engine/05-observability.md) | Logging and tracing: the operational event channel, and the rules that keep it from breaking determinism |
| [Extensibility](engine/06-extensibility.md) | Where the engine can be extended and by whom: the ports a host supplies, and why the determinism boundary is the trust boundary |
| [Replay](engine/07-replay.md) | The regression oracle: replaying committed fixtures across engine versions, and what "the same game" means when the bytes may differ |
| [Session Capture](engine/08-session-capture.md) | Turning a played session into a fixture: what may be taken from a person, what is refused, and how long it lives |
| [Clients](engine/09-clients.md) | The client contract: what a client may and may not do, and the API coverage checklist that verifies it |
| [Simulation Kind](engine/10-simulation-kind.md) | The second kind, expressed against the Kind seam: the week as a turn, plan actions, and what its state must not duplicate |
| [Content Packs](engine/11-content-packs.md) | Resolving many packs into one frozen registry — merge, override, dependency — and the identity that keeps a game reproducible |
| [Management-Simulation Kind](engine/12-management-simulation-kind.md) | The third kind: a tick batch as a turn, spatial verbs, and the batch-invariance property that keeps presentation speed out of the results |

**The Core** comes first deliberately: `04` implements `03` as types, and the core is the
shorter way in. The two drift apart more easily than anything else here — an edit to one that
is not mirrored in the other is this project's most common defect.

## Delivery

What ships first, in what order, and what is still undecided.

| Document | Holds |
|---|---|
| [MVP](engine/MVP.md) | The smallest slice that proves the platform, and its Definition of Done |
| [TODO](engine/TODO.md) | The MVP as ordered units of work (W0–W19), with contract references and done-criteria |
| [Open Questions](engine/OPEN-QUESTIONS.md) | Living register of unknowns and deferred decisions; §1 is a decision log |

## Working on It

Not specifications — how to build, run, and check what the specifications describe.

| Document | Holds |
|---|---|
| [Engine Package](guide/engine-package.md) | The npm package: layout, commands, the determinism guard |
| [Documentation Site](guide/documentation-site.md) | Previewing this site, what is generated, and the two link checks |
