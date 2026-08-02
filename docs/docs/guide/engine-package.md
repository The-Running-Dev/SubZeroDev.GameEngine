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

The package is `@the-running-dev/game-engine`, published to GitHub Packages as the **public**
`0.4.0` release on the `v0.4.0` tag (2026-08-02). The publication was verified against the
packages API. `release-engine-package.yml` runs on a `v*` tag push, so the manifest version and
the release tag must move together for future releases. The visibility decision is recorded in
[OPEN-QUESTIONS](/docs/engine/open-questions) §2 because the repository's earlier plans called
for private publication.

Companion projects consume it by registry from a tarball built and published in
`release-engine-package.yml`, not by source-tree `file:` links — a `file:` link resolves
through `src/` and would pass while `exports`, `files` and the declaration emit were all still
broken. The package has one declaration-bearing ESM root export, defined at
`src/engine/src/index.ts` and reached through `exports["."]` in `package.json`; deep paths
into `dist/` are deliberately unresolvable rather than merely discouraged.

Consume the published package with:

```bash
npm config set @the-running-dev:registry https://npm.pkg.github.com
npm install @the-running-dev/game-engine@0.4.0
```

The release workflow publishes with `GITHUB_TOKEN`. If the registry requests authentication,
use a token with package read permission; the visibility question and its implications for
companion CI are tracked in [OPEN-QUESTIONS](/docs/engine/open-questions) §2.

## Where the work is going

[TODO](/docs/engine/todo) breaks the work into ordered units. The MVP and replay oracle are
done. The companion consumer boundary above is **merged, gated in CI, and published as
`@the-running-dev/game-engine@0.4.0`**. The programme in progress builds the `world-graph` kind,
contract first.
