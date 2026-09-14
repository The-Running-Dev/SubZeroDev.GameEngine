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

The package is `@the-running-dev/game-engine`, published publicly to GitHub Packages. The
registry holds `0.4.0`, `0.5.0` and `0.8.0`, so the latest published version is **`0.8.0`**;
source is prepared as `0.11.0` for the next tagged release. `0.10.0` was tagged and never
published — its release run failed before the publish step — which is why the version on the
registry is two releases behind the source.

`release-engine-package.yml` runs on a `v*` tag push and ships whatever
`src/engine/package.json` says at that tag, so the manifest version and the tag move together.
Release tags are expected to match `src/engine/package.json` exactly; the release workflow
verifies that relationship before publication.

It also runs in a **non-publishing validation mode** — on `workflow_dispatch` with a
prospective tag, and on any pull request that touches the package manifest, the lockfile, the
guards or the workflow. Validation runs the same guards, the same clean pack, the same archive
inspection and the same packed-consumer smoke, then proves each guard rejects: a mismatched
tag, a dirty candidate tree, and an archive modified after its digest was recorded. The publish
step is unreachable there, because the mode is derived from the trigger rather than from an
input — only a real `refs/tags/v*` push returns `publish`.

The guards themselves are `src/engine/scripts/verify-release.mjs`, unit-tested alongside the
engine, so they can be run and fixed without pushing a tag. That matters: the previous inline
shell version could only execute by doing the one thing a release-readiness check must not do.
Two of its behaviours were wrong until the guards moved here — `npm publish` re-packed instead
of publishing the inspected archive, and a failing `npm view` was read as "this version is
free" when an unauthenticated, forbidden or unreachable registry fails identically.

> **On visibility.** The package is deliberately public. The repository and its companion
> consumers are public, so private package visibility would add authentication without adding a
> meaningful boundary.

Companion projects consume it by registry from a tarball built and published in
`release-engine-package.yml`, not by source-tree `file:` links — a `file:` link resolves
through `src/` and would pass while `exports`, `files` and the declaration emit were all still
broken. The package has one declaration-bearing ESM root export, defined at
`src/engine/src/index.ts` and reached through `exports["."]` in `package.json`; deep paths
into `dist/` are deliberately unresolvable rather than merely discouraged.

Consume it with:

```bash
npm config set @the-running-dev:registry https://npm.pkg.github.com
npm install @the-running-dev/game-engine@0.8.0
```

Pin the exact version rather than a range. The whole point of the boundary is that a companion
records which engine it was proven against.

The engine repository's release workflow publishes with `GITHUB_TOKEN` and stores no
credential. A consumer needs no token while the package is public; if it is made private
(see the visibility note above), companion workflows will need a repository-scoped token with
package read permission.

## Where the work is going

[TODO](/docs/engine/todo) breaks the work into ordered units. The MVP, the replay oracle and
the companion consumer boundary above are done — the last of those including its first
published version, which the programme tracked as a separate fact from the boundary being
merged. The programme in progress builds the `world-graph` kind, contract first.
