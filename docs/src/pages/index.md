---
title: 'Game Engine'
---

# SubZeroDev.GameEngine

The **Game Engine** — a deterministic, game-agnostic narrative-game platform: its
**source** (`src/engine/`) and its **specs** (`docs/docs/engine/`) in one place.

The model is **core → kinds → campaigns**: one shared deterministic core, game-*type*
logic (`kinds`), and content (`campaigns`) as data. v1 targets two kinds — `story-graph`
(flagship) and `simulation`.

**Documentation:** **[game-engine.subzerodev.com](/)** —
the site root, which publishes this README. The specs are rendered and cross-linked under
**[/docs](/docs/)**.

> **Companions.** The flagship **game** (Life in the Fast Lane, on the `simulation` kind)
> lives in
> [SubZeroDev.GameOfLife](https://github.com/The-Running-Dev/SubZeroDev.GameOfLife); the
> second (Sun Trap, on the `world-graph` kind) in
> [SubZeroDev.SunTrap](https://github.com/The-Running-Dev/SubZeroDev.SunTrap); the
> deferred **hosting / NEaaS** layer in
> [SubZeroDev.Platform](https://github.com/The-Running-Dev/SubZeroDev.Platform). `games/…`
> references in these docs point to SubZeroDev.GameOfLife specifically.

## Status

- **Specs:** the MVP contracts are finalized — the story-graph kind
  ([`03`](/docs/engine/story-graph-kind#1-the-campaign)) and the core
  ([`04-core`](/docs/engine/core#2-the-gamestate-envelope)). See [MVP.md](/docs/engine/mvp#1-the-mvp-in-one-sentence).
  Every MVP-blocking gap is now decided; the register
  ([OPEN-QUESTIONS.md](/docs/engine/open-questions#1-mvp-relevant-gaps--all-resolved) §1) is a decision log.
- **Code:** [`src/engine/`](/docs/guide/engine-package) — seeded PCG32 RNG and canonical serialization,
  verified bit-identical to reference vectors; toolchain green (15 tests).
- **Next:** [TODO.md](/docs/engine/todo#core) breaks the MVP into ordered units of work
  (W0–W19). W0 adds CI and docs-build gates; W1 then adds the core contract types and
  module skeleton.

## Layout

| Path | What |
|---|---|
| [`docs/docs/engine/`](/docs/engine/vision) | The specs — `01-vision`, `02-architecture`, `04-core` (the API/types), `03-story-graph-kind`, `MVP`, `TODO`, `OPEN-QUESTIONS` |
| [`src/engine/`](/docs/guide/engine-package) | The implementation (TypeScript strict, vitest, determinism-guard eslint) |
| `docs/` | The specs are a Docusaurus site; `docs/docs/` is its content root |
| [`docs.ps1`](/docs/guide/documentation-site#previewing-locally) | Build & serve the docs site |

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

1. [Vision](/docs/engine/vision#1-what-this-is) — why the platform exists
2. [Architecture](/docs/engine/architecture#1-the-three-layers) — every settled decision
3. [The core](/docs/engine/core#1-the-two-layers-of-engine) — the platform as types
4. [Story-graph kind](/docs/engine/story-graph-kind#3-nodes--the-single-content-type-n7) — the flagship content model
5. [MVP](/docs/engine/mvp#3-in-scope) + [TODO](/docs/engine/todo#core) — what ships first, in order

---

Private, work in progress.

[View the documentation](/docs/)
