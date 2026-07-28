---
title: 'The Engine Package'
sidebar_label: Engine Package
---

# The Engine Package

The implementation lives in `src/engine/` as a standalone npm package. This page covers
working on it. What it must *do* is the specs' job — start with
[the core](/docs/engine/core).

## Layout

| Path | What |
|---|---|
| `src/engine/src/core/rng/` | Seeded PCG32 and stream derivation |
| `src/engine/src/core/serialize/` | Canonical serialization |
| `src/engine/package.json` | Scripts and the Node floor |
| `src/engine/eslint.config.js` | The determinism guard |

Tests sit beside the code they cover as `.test.ts`, rather than in a parallel tree.

## Commands

Run everything from `src/engine/`, not the repository root — the package is not at the root
and npm will not find it from there.

```bash
cd src/engine
npm install
npm test        # vitest
npm run lint    # determinism guard + typescript-eslint
npm run typecheck
```

Node 24 is the floor, enforced by `engines.node` so a local install and CI cannot drift apart.

## Determinism is enforced, not hoped for

The eslint configuration **fails the build** on `Math.random`, on the `Math.*` functions that
are not bit-stable across engines, and on `Date.now` anywhere under `src/`. Randomness comes
from a seeded generator and nowhere else, so a session replays byte-for-byte from its seed and
its inputs.

That constraint is the reason for the seeded PCG32 and the canonical serializer: given the
same seed and the same actions, every run must produce the same bytes. See
[the core](/docs/engine/core) for how that surfaces in the engine API, and
[architecture](/docs/engine/architecture) for why the platform is built on it.

## Where the work is going

[TODO](/docs/engine/todo) breaks the MVP into ordered units. The package currently holds the
two verified primitives above; the next unit adds the core contract types and the module
skeleton.
