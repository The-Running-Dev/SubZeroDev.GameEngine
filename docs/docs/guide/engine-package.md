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
| `src/engine/src/core/determinism/` | Seeded PCG32 and stream derivation |
| `src/engine/src/core/persistence/` | Canonical serialization |
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

Node 24 is the floor. `engines.node` declares it and CI selects it explicitly, but npm treats
`engines` as advisory unless `engine-strict` is set — which this repository does not set — so a
local install on an older Node will warn rather than stop. The declaration states the floor;
it does not enforce it.

## Determinism is enforced, not hoped for

The eslint configuration **fails the build** on `Math.random`, on the `Math.*` functions that
are not bit-stable across engines, and on `Date.now` anywhere under `src/`. Randomness comes
from a seeded generator and nowhere else, so a session replays byte-for-byte from its seed and
its inputs.

That constraint is the reason for the seeded PCG32 and the canonical serializer: given the
same seed and the same actions, every run must produce the same bytes. See
[the core](/docs/engine/core) for how that surfaces in the engine API, and
[architecture](/docs/engine/architecture) for why the platform is built on it.

## Versioning and Releases

`src/engine/package.json`'s `version` is a real semver, and a git tag `vX.Y.Z` marks the
commit each release was cut at — plain tags, since the engine is currently the only thing in
this repository that is versioned at all. `src/engine/src/version.ts` exports
`ENGINE_VERSION`, read from `package.json` at import time rather than duplicated as a second
literal, so a release only ever bumps the version in one place.

This is what the replay regression oracle's `capturedUnder` reads
([`07-replay.md`](/docs/engine/replay) §2) — every committed fixture is stamped with the
`ENGINE_VERSION` that was current when its outcome was recorded, and the oracle's release-tag
comparison (07 §8) runs the corpus against the previous tag.

## Companion Consumption

The package is not a supported cross-repository dependency yet: it is still named
`game-engine`, marked `private`, and has no public export map or publication workflow.
Companion repositories must not make deep imports from `src/` or treat a sibling checkout as
their CI contract.

The decided delivery target is a private GitHub Packages npm package named
`@the-running-dev/game-engine`, published from the existing `src/engine/` directory. It will
provide one declaration-bearing ESM root export, be linked to this repository, and be consumed
by exact semver plus a committed lockfile. GitHub Actions in an explicitly granted companion
repository will install it with package-read permission; release publication will use this
repository's short-lived `GITHUB_TOKEN`, not a committed credential.

The first unit in the [world-graph programme](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/blob/main/plans/39-world-graph-kind-programme.md)
implements and proves that boundary with a packed-tarball consumer smoke test before any
companion game relies on it. Local `file:` links may remain a developer convenience, but they
do not satisfy the consumer gate because they are mutable and depend on checkout layout.

## Where the work is going

[TODO](/docs/engine/todo) breaks the work into ordered units. The MVP and replay oracle are
done; the next proposed programme starts with the companion consumer boundary and then builds
the `world-graph` kind.
