# SubZeroDev.NarrativeEngine

The specs for a **deterministic, game-agnostic narrative-game platform** — its
architecture, API, the flagship kind, the MVP, and the hosting vision.

The model is **core → kinds → campaigns**: one shared deterministic core, game-*type*
logic (`kinds`), and content (`campaigns`) as data. v1 targets two kinds — `story-graph`
(flagship) and `simulation`.

> **This repo is the platform (engine) specs only.** The games built on it (Life in the
> Fast Lane and the Bulgaria adventure) and the current engine **implementation**
> (`src/engine/`) live in the companion project,
> [SubZeroDev.GameOfLife](https://github.com/The-Running-Dev/SubZeroDev.GameOfLife).
> References to `games/…` in these docs point there.

## What's here

The specs are a [Docusaurus](https://docusaurus.io) site; content is under
`docs/docs/engine/`:

| Doc | Holds |
|---|---|
| [`01-vision.md`](docs/docs/engine/01-vision.md) | Why the platform exists; the core/kind/campaign model |
| [`02-architecture.md`](docs/docs/engine/02-architecture.md) | Every settled architecture decision — the contract (decisions) |
| [`04-core.md`](docs/docs/engine/04-core.md) | The platform core as types — the API, session store, projection, validation, MCP schemas (the contract) |
| [`03-story-graph-kind.md`](docs/docs/engine/03-story-graph-kind.md) | The flagship kind's content model |
| [`MVP.md`](docs/docs/engine/MVP.md) | The smallest slice that proves the platform + Definition of Done |
| [`TODO.md`](docs/docs/engine/TODO.md) | Ordered task list; the MVP boundary is marked |
| [`OPEN-QUESTIONS.md`](docs/docs/engine/OPEN-QUESTIONS.md) | Living register of unknowns, gaps, deferred decisions |
| [`neaas-platform-vision.md`](docs/docs/engine/neaas-platform-vision.md) | Deferred hosting / SaaS / business layer |

## Build the docs site

Requires Docker Desktop (base image `ghcr.io/the-running-dev/docs-template`, overlaid
with the local config).

```powershell
./docs.ps1            # build + serve at http://localhost:3000/docs
./docs.ps1 -Live      # + hot-reload while editing docs/
./docs.ps1 -BuildOnly # build the image only
```

## Where to start reading

1. [Vision](docs/docs/engine/01-vision.md) — why the platform exists
2. [Architecture](docs/docs/engine/02-architecture.md) — every settled decision
3. [The core](docs/docs/engine/04-core.md) — the platform as types
4. [Story-graph kind](docs/docs/engine/03-story-graph-kind.md) — the flagship content model
5. [MVP](docs/docs/engine/MVP.md) + [TODO](docs/docs/engine/TODO.md) — what ships first, in order

---

Private, work in progress. Companion:
[SubZeroDev.GameOfLife](https://github.com/The-Running-Dev/SubZeroDev.GameOfLife).
