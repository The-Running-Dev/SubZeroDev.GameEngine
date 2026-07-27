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
  ([`03`](https://game-engine.subzerodev.com/docs/engine/story-graph-kind)) and the core
  ([`04-core`](https://game-engine.subzerodev.com/docs/engine/core)). See [MVP.md](https://game-engine.subzerodev.com/docs/engine/mvp).
  Every MVP-blocking gap is now decided; the register
  ([OPEN-QUESTIONS.md](https://game-engine.subzerodev.com/docs/engine/open-questions) §1) is a decision log.
- **Code:** [`src/engine/`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/tree/main/src/engine) — seeded PCG32 RNG and canonical serialization,
  verified bit-identical to reference vectors; toolchain green (15 tests).
- **Next:** [TODO.md](https://game-engine.subzerodev.com/docs/engine/todo) breaks the MVP into ordered units of work
  (W0–W19). W0 adds CI and docs-build gates; W1 then adds the core contract types and
  module skeleton.

## Layout

| Path | What |
|---|---|
| [`docs/docs/engine/`](https://game-engine.subzerodev.com/docs/engine/vision) | The specs — `01-vision`, `02-architecture`, `04-core` (the API/types), `03-story-graph-kind`, `MVP`, `TODO`, `OPEN-QUESTIONS` |
| [`src/engine/`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/tree/main/src/engine) | The implementation (TypeScript strict, vitest, determinism-guard eslint) |
| `docs/` | The specs are a Docusaurus site; `docs/docs/` is its content root |
| [`docs.ps1`](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/blob/main/docs.ps1) | Build & serve the docs site |

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

1. [Vision](https://game-engine.subzerodev.com/docs/engine/vision) — why the platform exists
2. [Architecture](https://game-engine.subzerodev.com/docs/engine/architecture) — every settled decision
3. [The core](https://game-engine.subzerodev.com/docs/engine/core) — the platform as types
4. [Story-graph kind](https://game-engine.subzerodev.com/docs/engine/story-graph-kind) — the flagship content model
5. [MVP](https://game-engine.subzerodev.com/docs/engine/mvp) + [TODO](https://game-engine.subzerodev.com/docs/engine/todo) — what ships first, in order

---

Private, work in progress.
