---
title: 'Game Engine'
sidebar_position: 1
---

# SubZeroDev.GameEngine

The **Game Engine** — a deterministic, game-agnostic narrative-game platform: its
**source** (`src/engine/`) and its **specs** (`docs/docs/engine/`) in one place.

The model is **core → kinds → campaigns**: one shared deterministic core, game-*type*
logic (`kinds`), and content (`campaigns`) as data. v1 targets two kinds — `story-graph`
(flagship) and `simulation`.

> **Companions.** The flagship **game** (Life in the Fast Lane) lives in
> [SubZeroDev.GameOfLife](https://github.com/The-Running-Dev/SubZeroDev.GameOfLife); the
> deferred **hosting / NEaaS** layer in
> [SubZeroDev.Platform](https://github.com/The-Running-Dev/SubZeroDev.Platform). `games/…`
> references in these docs point to the game repo.

## Status

- **Specs:** the MVP contracts are finalized — the story-graph kind
  ([`03`](docs/docs/engine/03-story-graph-kind.md)) and the core
  ([`04-core`](docs/docs/engine/04-core.md)). See [MVP.md](docs/docs/engine/MVP.md).
  Every MVP-blocking gap is now decided; the register
  ([OPEN-QUESTIONS.md](docs/docs/engine/OPEN-QUESTIONS.md) §1) is a decision log.
- **Code:** [`src/engine/`](src/engine/) — seeded PCG32 RNG and canonical serialization,
  verified bit-identical to reference vectors; toolchain green (15 tests).
- **Next:** [TODO.md](docs/docs/engine/TODO.md) breaks the MVP into ordered units of work
  (W0–W19). W0 adds CI and docs-build gates; W1 then adds the core contract types and
  module skeleton.

## Layout

| Path | What |
|---|---|
| [`docs/docs/engine/`](docs/docs/engine/) | The specs — `01-vision`, `02-architecture`, `04-core` (the API/types), `03-story-graph-kind`, `MVP`, `TODO`, `OPEN-QUESTIONS` |
| [`src/engine/`](src/engine/) | The implementation (TypeScript strict, vitest, determinism-guard eslint) |
| `docs/` | The specs are a Docusaurus site; `docs/docs/` is its content root |
| [`docs.ps1`](docs.ps1) | Build & serve the docs site |

## Build the Docs Site

Requires Docker Desktop (base image `ghcr.io/the-running-dev/docs-template`, overlaid with
the local config).

```powershell
./docs.ps1            # build + serve at http://localhost:3000/docs/engine/vision
./docs.ps1 -Live      # + hot-reload while editing docs/
./docs.ps1 -BuildOnly # build the image only
```

## Developing the Engine

```bash
cd src/engine
npm install
npm test        # vitest
npm run lint    # determinism guard + typescript-eslint
npm run typecheck
```

Determinism is enforced, not hoped for: the eslint config bans `Math.random`, the
non-bit-stable `Math.*` functions, and `Date.now` in `src/`, and the core replays
byte-for-byte from a seed and its inputs.

## Where to Start Reading

1. [Vision](docs/docs/engine/01-vision.md) — why the platform exists
2. [Architecture](docs/docs/engine/02-architecture.md) — every settled decision
3. [The core](docs/docs/engine/04-core.md) — the platform as types
4. [Story-graph kind](docs/docs/engine/03-story-graph-kind.md) — the flagship content model
5. [MVP](docs/docs/engine/MVP.md) + [TODO](docs/docs/engine/TODO.md) — what ships first, in order

---

Private, work in progress.
