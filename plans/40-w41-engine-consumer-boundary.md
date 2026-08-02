# W41 — The Engine Consumer Boundary

**Unit:** [`docs/docs/engine/TODO.md`](../docs/docs/engine/TODO.md) — *Depth: Sun Trap*, the
W41 checkbox.

**Scope:** Turn `src/engine/` from a repository-internal package into one a companion
repository can install, import and typecheck against — a public root export, a build that
emits only what ships, a packed-tarball consumer smoke test, and private publication to
GitHub Packages. **No `world-graph` code.** This is delivery infrastructure around the
already-built core and kinds.

**Depends on:** Nothing outstanding. Every symbol this unit exposes already exists and is
already tested.

**Programme:** [`plans/39-world-graph-kind-programme.md`](39-world-graph-kind-programme.md),
the consumer-boundary unit that precedes the contract units.

**Companion gate:** `SubZeroDev.SunTrap`'s own implementation programme, **M1 — Engine
Consumer Boundary**. Its M1 leaves one decision open ("whether the package remains private in
a package registry or is distributed by immutable Git reference"); `plans/39` Decision 4
closes it, and this unit implements that decision.

---

## Handoff — Start Here

This section is the whole brief for whoever executes this unit, including an agent starting
cold. Everything it needs is in this repository; nothing depends on a chat transcript.

**Read in this order:** [`CLAUDE.md`](../CLAUDE.md) (project conventions — they override your
defaults), [`agent.md`](../agent.md) (lessons learned the hard way here), then the rest of
this plan.

**Then work the *Sequence* below (8 steps) until every *Done-When* box (11) is satisfied.**
The *Decisions* section says why each choice was made. If you believe one is wrong, say so
and stop — do not quietly substitute a different design.

**Trust, but re-verify.** *Current State (measured, not recalled)* and *The Prototype* were
verified against the working tree, so you need not re-derive them. Do re-run anything you are
about to depend on.

### Working rules that are easy to violate here

- **Stage by explicit named path.** Never `git add -A`, `git add .`, or a bare directory.
  `.gitignore`'s own comment records the near-miss this rule exists to prevent.
- **Branch off `main`; do not merge.** Open the PR, report the check outcomes, leave the
  merge to the repository owner. Auto-merge is deliberately not used.
- **Three required checks:** `engine`, `Documentation links and terminology`,
  `Verify Documentation Build`.
- **Run before pushing**, and never claim a gate passed that did not run:
  ```bash
  cd src/engine && npm run typecheck && npm run lint && npm test
  ./build/Test-Documentation.ps1     # from the repository root
  ```
- **`npm test` must report 57 files / 677 tests.** If you see 114 / 1354, `dist/` is present
  and vitest is double-collecting — that is the defect step 1 fixes, not a real result.
- **The determinism guard is not negotiable.** `eslint.config.js` bans `Math.random`, the
  non-bit-stable `Math.*` functions and `Date.now` under `src/`. Do not work around it.

### Two ways to do this wrong

Both look like reasonable simplifications and both silently destroy the point of the unit.

1. **Excluding tests in `tsconfig.json` instead of adding `tsconfig.build.json`.** It is the
   obvious one-line fix for test files in `dist/`, and it also stops *typechecking* the
   tests — losing coverage silently while appearing to succeed. The build and the typecheck
   must diverge: `tsconfig.build.json` excludes tests, `tsconfig.json` keeps covering them.
2. **Pointing the smoke test at the source instead of the packed tarball.** A `file:`
   dependency or workspace link resolves through `src/`, so it passes while `exports`,
   `files` and the declaration emit are all still broken — proving nothing about the artefact
   that ships. If the smoke test passes on its first run without a tarball having been built,
   it is not testing anything.

### Out of scope — do not do these

Any `world-graph` code or contract edit (that is W42 onward); any fix to the unguarded
`campaign.content as X` cast (see *Explicitly Not In Scope* for why); any change to the
`SubZeroDev.SunTrap` repository.

---

## Why This Is Now Actionable, and Why It Is Interesting

Every campaign this engine has ever proven — Bureaucracy, the four Bulgaria arcs, Stable
Life — was built *inside* this repository, imported by relative path, and tested by fixtures
committed beside the code. That is three kinds and seven campaigns of evidence that the
engine works, and **zero** evidence that anything outside this repository can consume it.

Sun Trap is the first real consumer, and its own programme now blocks on this. The
interesting part is not the packaging mechanics; it is that packing the engine is the first
time its public surface has to be *named*. Until now every symbol was equally reachable by
relative path, so "what is API and what is internal" has never had to be answered. This unit
answers it.

---

## Current State (measured, not recalled)

Every line below was verified against the working tree at `2fc791b`, not remembered.

### The package manifest

`src/engine/package.json` is 24 lines. It declares `"name": "game-engine"`,
`"private": true`, `"version": "0.1.0"`, `"type": "module"`, `engines.node >= 24`, five
scripts (`build`, `typecheck`, `test`, `test:watch`, `lint`) and five devDependencies. It has
**no `exports`, no `files`, no `repository`, no `publishConfig`, and no runtime
dependencies** — the engine's only imports are Node built-ins and its own modules.

### The build works, and emits test files

```bash
cd src/engine && npm run build       # exit 0
```

`tsconfig.json` already sets `declaration: true`, `sourceMap: true`, `outDir: "dist"`,
`rootDir: "src"`. It emits `.js`, `.d.ts` and `.js.map` correctly.

It also emits **176 test artifacts** into `dist/`, because `include` is `["src"]` and nothing
excludes `*.test.ts`. Those compiled tests `import ... from "vitest"` — a devDependency — so
shipping them would put a broken import path inside the tarball for anything that resolved
it.

> **This is already actively harmful, not merely untidy.** With `dist/` present, `npm test`
> reports **114 files / 1354 tests** — exactly double the true **57 / 677** — because vitest
> collects both `src/**/*.test.ts` and the compiled `dist/**/*.test.js`. Every assertion runs
> twice, the suite takes twice as long, and any figure quoted from a run that happened to
> follow a build is wrong. Measured directly: deleting `dist/` returns the count to 57 / 677.
> Step 1 of the sequence fixes this as a side effect of fixing the packaging.

### The emitted ESM already runs under Node — a real de-risking

`moduleResolution` is `"Bundler"`, which does *not* require file extensions on relative
imports. This repository writes them anyway (`from "../determinism/rng.js"`), so the emitted
output is valid Node ESM as-is:

```bash
node -e "import('./dist/core/kernel/engine.js').then(m=>console.log(Object.keys(m)))"
# → [ 'createEngine', 'isValidGameStateShape' ]
```

**No import-specifier rewrite, bundler, or `moduleResolution` change is needed.** This was
the single largest risk in the unit and it is already discharged.

### `version.ts`'s `readFileSync` survives packaging

`src/version.ts` reads `../package.json` at import time to source `ENGINE_VERSION`. From
`dist/version.js` that resolves to the package root, and from inside an installed tarball it
resolves to the *installed* manifest — confirmed by the prototype below, which reported
`0.1.0-proto.0`, the staged version, not a stale literal. **`package.json` must therefore be
in the packed files** (npm always includes it) and `ENGINE_VERSION` needs no change.

### What `npm pack` ships today: the whole source tree, and no build output

```bash
cd src/engine && npm pack --dry-run
# → 540 files, 2.2 MB unpacked
```

It ships every `src/**/*.ts` *including every `.test.ts`*, plus `tsconfig.json` — and **no
`dist/` at all**, because `dist/` is in `.gitignore` (line 5) and npm falls back to
`.gitignore` when there is no `files` field or `.npmignore`. Today's tarball is therefore
simultaneously bloated and unusable: a consumer installing it gets TypeScript sources with no
compiled entry point.

### CI

`.github/workflows/ci.yml`'s `engine` job runs `checkout → change-detection → setup-node 24
→ npm ci → typecheck → lint → test`, every step `working-directory: src/engine` and gated on
`steps.changed.outputs.changed == 'true'` (a documentation-only PR skips the expensive steps
while still reporting, deliberately — the job must always report because it is a required
check). New package steps belong inside that same gate.

---

## The Prototype — Proven, Not Assumed

The whole boundary was built end-to-end in a scratch directory before this plan was written,
to establish that the approach works rather than proposing it on faith. Nothing in the
repository was modified.

**Method.** Built `dist/`, staged it minus test artifacts (216 files), hand-wrote the root
barrel that §"The Public Surface" below specifies, wrote a manifest with `exports`/`files`/
`publishConfig`, `npm pack`ed it, then installed the tarball into a clean consumer project
with its own `tsconfig.json` (`strict`, `verbatimModuleSyntax`, `moduleResolution: Bundler`)
and a smoke source importing **only** the root specifier.

**Results.**

| Check | Result |
|---|---|
| Tarball | **219 files, 584 kB** unpacked (vs. 540 files / 2.2 MB today). The real one is one file larger — the prototype staging directory had no `README.md`, and npm force-includes it (step 5) |
| Consumer `tsc --noEmit` | **exit 0** — values *and* types resolve from the root specifier |
| Consumer runtime | **exit 0** — `createGame` returned `ok: true`, session store constructed |
| `ENGINE_VERSION` | reported the packaged version, proving the boundary read survives packing |

**One live finding the smoke test surfaced.** The first prototype passed `content: {}` and
`buildValidatedContentRegistry` **threw** — `Object.keys(content.nodes)` on `undefined` —
instead of returning a `ValidationResult`. That is exactly the unguarded
`campaign.content as X` cast recorded in
[`OPEN-QUESTIONS.md`](../docs/docs/engine/OPEN-QUESTIONS.md) §3, and it is worth noting that
**a consumer smoke test is the first thing in this repository's history to hit it**, because
constructing a possibly-malformed campaign from outside is precisely a companion's first act.
This unit does not fix it (see *Explicitly Not In Scope*), but it should be re-linked from
the smoke test so the next reader finds the register entry rather than rediscovering the
crash.

---

## The Public Surface

The inventory below is the proposed `src/index.ts`, derived by reading every non-test module's
`export` statements. It is the whole of what a companion may import; everything else stays
reachable only inside this repository.

**Runtime values.**

| Symbol | Module | Why public |
|---|---|---|
| `createEngine`, `isValidGameStateShape` | `core/kernel/engine.ts` | The pure engine — the composition root a game builds on |
| `buildCampaign`, `buildContentRegistry` | `core/registry/build.ts` | The authoring → registry path a campaign is assembled through |
| `buildValidatedContentRegistry` | `core/validation/tiered.ts` | The validated variant every real consumer should prefer |
| `createInMemorySessionStore`, `upsertAchievements` | `core/session/store.ts` | The client-facing surface (09 §1); a CLI talks to this, never to `Engine` |
| `createInMemoryProfileStore` | `core/session/profile-store.ts` | Achievements across sessions |
| `defaultIdSource`, `defaultClock` | `core/composition/defaults.ts` | The default ports (06 §5) |
| `createCountingIds` | `core/determinism/counting-ids.ts` | Required for byte-identical fixtures (07 §5) |
| `nullEmitter`, `createRecordingEmitter`, `jsonlEmitter` | `core/observability/emitter.ts` | Sinks a host supplies (05 §2) |
| `resolveLocKey` | `core/localization/resolve.ts` | Rendering a `LocKey` without reimplementing lookup |
| `storyGraphKind`, `simulationKind` | `kinds/*/kind.ts` | The built kinds; `worldGraphKind` joins them at W45 |
| `ENGINE_VERSION` | `version.ts` | Fixture stamping (07 §2) |

**Types.** `Engine`, `EngineHost`, `SessionHost`, `IdSource`, `Clock`, `GameState`,
`GameStatus`, `Kind`, `KindContext`, `KindRegistry`, `ActionParams`, `ActionResult`,
`AvailableAction`, `Scene`, `SceneBody`, `PlayerView`, `Campaign`, `BuiltCampaign`,
`ContentRegistry`, `AuthoredText`, `SessionStore`, `ProfileStore`, `SessionHandle`,
`SessionActionResult`, `CreateSessionConfig`, `ValidationResult`, `ValidationError`,
`ValidationWarning`, `CommandResult`, `StateChange`, `ReasonCode`, `LocKey`, `Condition`,
`Emitter`, `EngineEvent`.

**Deliberately not exported, and why.**

| Excluded | Reason |
|---|---|
| `campaigns/*` (Bureaucracy, the Bulgaria arcs, Stable Life) | Engine-owned test fixtures, not content a companion should import. Verified as leaf modules — **nothing shipped imports them** — so they can also be excluded from the build entirely |
| `mcp/server.ts`, `clients/text/*` | Reference clients proving the contract (09 §4). Sun Trap M8 writes its own CLI against `SessionStore`; exporting these invites copying rather than implementing |
| `core/replay/*`, `core/determinism/harness.ts` | Test instruments. Sun Trap's own replay work goes through committed fixtures, not by importing the runner |
| Everything under `kinds/*/` except the assembled `Kind` | Kind internals are engine-owned (architecture N2). A companion supplies *content*, never reaches into resolution |
| Deep paths generally | The `exports` map exposes `"."` only, so `@the-running-dev/game-engine/dist/...` is unresolvable rather than merely discouraged |

---

## Sequence

**1 — Split the build from the typecheck.** Add `tsconfig.build.json` extending
`tsconfig.json` with `"exclude": ["**/*.test.ts", "src/campaigns/**"]`, and point
`npm run build` at it. `npm run typecheck` keeps using `tsconfig.json` so tests stay
typechecked. Verify `find dist -name '*.test.*'` is empty.

**2 — Write `src/index.ts`.** The inventory above, as explicit named re-exports — never
`export *`, so the public surface is a reviewable list and adding to it is a deliberate diff.
Keep the file comment short and point at this plan.

**3 — Rewrite the manifest.** `name` → `@the-running-dev/game-engine` (npm scopes are
lowercase; GitHub Packages requires the scope to match the owner, `The-Running-Dev`). Drop
`"private": true`. Add `repository`, `files: ["dist"]`, `publishConfig.registry:
"https://npm.pkg.github.com"`, and:

```json
"exports": { ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" } }
```

Add a `prepack` script running the build, so a tarball can never be cut from stale output.

**4 — Add the consumer smoke project.** A directory (`consumer-smoke/`, outside
`src/engine/src` so it is not compiled by the engine's own tsconfig) with its own
`package.json`/`tsconfig.json` and one source file importing only the root specifier,
constructing a registry and an engine, and calling `createGame`. It must **install the packed
tarball**, not link the source — a `file:` link resolves through `src/`, which is exactly the
failure mode this unit exists to prevent. Assert the throw-instead-of-`ValidationResult`
finding is still the known behaviour, linking `OPEN-QUESTIONS.md` §3.

**5 — Wire CI.** Inside the existing `engine` job, after `Test`, add `Build package`,
`Inspect tarball`, and `Consumer smoke`. Same `if: steps.changed.outputs.changed == 'true'`
gate as every other step.

`Inspect tarball` asserts on the *absence* of what must not ship — any `*.test.*`, any
`src/`, any `tsconfig*.json` — rather than on an exact allowlist.

> **`files: ["dist"]` does not mean "only `dist`".** npm force-includes `package.json`, the
> README and a LICENSE regardless of `files`; there is no way to exclude them and no reason
> to want to. Verified directly: a scratch package with `files: ["dist"]` plus a `README.md`
> and a stray file packs `dist/`, `package.json` **and `README.md`** — the stray is dropped,
> the README is not. `src/engine/README.md` exists, so it will ship, and a package with no
> README is worse than one with it. An allowlist gate written as "`dist/` and `package.json`
> only" would therefore be unsatisfiable — which is exactly what an earlier draft of this
> plan's own Done-When said before review caught it.

**6 — Add the release workflow.** A separate workflow on `v*` tags (or
`workflow_dispatch`), `permissions: { contents: read, packages: write }`, publishing with the
repository's own `GITHUB_TOKEN`. No stored credential.

**7 — Publish, then hand off.** Publish the first version, grant Sun Trap Actions read
access, and record the exact coordinate and version in this plan's Done-When. **Sun Trap's
own dependency and CI change is that repository's work, not this unit's** — `plans/39`'s
non-goals are explicit that this plan does not modify the companion.

**8 — Documentation.** Update `docs/docs/guide/engine-package.md`'s *Companion Consumption*
section from "the decided delivery target is…" (future tense, written when this was a plan)
to what actually shipped, with the install snippet and the authentication note.

---

## Decisions

### 1. One root export, not a subpath map

A `"./kinds"`, `"./session"`, `"./testing"` subpath map is the obvious alternative and is
declined for now. Every subpath is a compatibility commitment, and this package has exactly
one consumer whose needs are known. A flat root barrel makes the whole public surface one
reviewable list; subpaths can be added later without breaking anyone, whereas removing them
cannot.

### 2. The smoke test installs a tarball; it never links the source

A `file:` dependency or workspace link resolves to `src/`, so it would pass while `exports`,
`files`, the declaration emit and the build split were all still broken — proving nothing
about the artefact that actually ships. `plans/39` Decision 4 already states this; it is
repeated here because it is the single thing that makes the gate meaningful.

### 3. `campaigns/` is excluded from the build, not merely unexported

Verified that nothing shipped imports them, so excluding them costs nothing and keeps the
Bulgaria and Stable Life fixtures — which are *this repository's* test material — out of a
companion's `node_modules`. They remain fully available to the engine's own tests, which
compile through `tsconfig.json`, not `tsconfig.build.json`.

### 4. `prepack`, not a hand-run build

A tarball cut from a stale `dist/` is the classic packaging defect and it fails silently —
the consumer smoke test would pass against yesterday's output. `prepack` makes staleness
structurally impossible rather than a discipline someone has to remember.

### 5. ~~The version is not bumped in this unit~~ — **wrong, corrected during review**

> The original reasoning: *"`0.1.0` publishes as-is. The first published version is a delivery
> event, not a content change, and conflating them would make the changelog claim engine
> behaviour changed when it did not."* That argument is fine in the abstract and **was
> written without checking the tags**, which is what makes it wrong here.

`package.json` had never tracked the release tags:

| Tag | `package.json` at that tag |
|---|---|
| `v0.1.0` | `0.0.0` |
| `v0.2.0` | `0.1.0` |
| `v0.3.0` | `0.1.0` |

Harmless while the package was `private: true` and never published — the tag was the release
marker and `ENGINE_VERSION` only stamped replay fixtures. **This unit is what makes it a
live defect**, because `release-engine-package.yml` triggers on `v*` and `npm publish` ships
what the *manifest* says, not what the tag says. Cutting `v0.4.0` would publish `0.1.0`; the
tag after that would fail outright, since a registry refuses to republish an existing
version. A published version matching no tag also breaks the exact-semver consumption
contract this whole unit exists to establish.

**Corrected to: `package.json` is set to `0.3.0`, matching the newest existing tag.** Nothing
had been published, so there was no artefact to collide with and no consumer to disrupt —
the drift was bookkeeping, and this treats it as such rather than spending a fresh version
number on a correction. From here, tag and manifest move together; the next release cuts
`v0.4.0` *and* sets `0.4.0`.

The original decision's point still stands in its narrow form — publishing is a delivery
event, and `plans/39`'s **T0** keeps "W41 merged" and "first version published" as two
separate facts. It just did not license leaving the manifest three tags behind.

---

## Done-When

**Merged as [PR #108](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/108).**
Boxes ticked below were re-verified on `main` at `db9c62a` — locally by a clean
`npm ci && npm run build && npm pack --dry-run`, and remotely against that commit's own
workflow run, which shows the three new steps executing rather than merely existing.

- [x] `npm run build` emits **zero** `*.test.*` files and zero `campaigns/` output.
      Measured: 66 `.js`, 66 `.d.ts`, 66 `.js.map`, no `dist/campaigns/`.
- [x] `npm run typecheck` still covers test files (`tsconfig.json` unchanged in that respect).
      `tsconfig.build.json` carries the exclusions; `tsconfig.json` was not touched.
- [x] `src/index.ts` exists, uses only explicit named re-exports, and matches the inventory
      above. No `export *` anywhere in it.
- [x] `npm pack --dry-run` ships `dist/`, `package.json` and `README.md` — **and nothing
      else**: no `src/`, no `*.test.*`, no `tsconfig*.json`. The file count is in the low
      hundreds rather than 540. Measured: **200 files, 508.2 kB unpacked** (143.5 kB packed).
- [x] A clean consumer installs the **packed tarball**, imports only
      `@the-running-dev/game-engine`, and both `tsc --noEmit` and a runtime `createGame`
      succeed. `consumer-smoke/`, via `install-engine.mjs`.
- [x] The consumer smoke project runs in CI inside the `engine` job's existing change gate.
- [x] CI fails if a test artefact appears in the tarball. *Inspect tarball* asserts on the
      absence of `src/`, `tsconfig*.json` and test artefacts.
- [x] A release workflow publishes to GitHub Packages with `packages: write` and no stored
      credential. `release-engine-package.yml`, on `v*` and `workflow_dispatch`.
- [ ] The first version is published, Sun Trap has read access, and the exact coordinate and
      version are recorded here. **Open — owner-only.** Verified nothing is published; the
      three existing tags (`v0.1.0`, `v0.2.0`, `v0.3.0`) all predate this workflow, so the
      first publication is a `v0.4.0` tag push with `package.json` moved to match, per the
      corrected Decision 5. Record the coordinate here when it lands.
- [x] `docs/docs/guide/engine-package.md` describes what shipped, in past tense. Corrected
      afterwards: it named `@0.1.0` (the manifest is `0.3.0`) and claimed present-tense
      publication that has not happened — both fixed alongside `plans/41`.
- [x] `npm run typecheck && npm run lint && npm test` all pass; the doc gate passes. All
      three required checks green on PR #108 and on the `main` merge.

---

## Explicitly Not In Scope

- **No `world-graph` code, types or contract edits.** Those are W42 onward.
- **No fix for the unguarded `campaign.content as X` cast.** The smoke test surfaces it and
  links `OPEN-QUESTIONS.md` §3; fixing it is a cross-cutting decision across every kind, as
  that entry already records. Changing it here would smuggle a semantics change into a
  packaging unit.
- **No changes to `SubZeroDev.SunTrap`.** Its M1 dependency and CI work is its own.
- **No monorepo/workspace restructure.** `src/engine/` stays where it is; the `packages/`
  question stays closed as `OPEN-QUESTIONS.md` §2 now records, revisited only when a second
  independently versioned package exists.
- **No public npm publication.** Private GitHub Packages only.
- **No API surface beyond the inventory.** If a companion needs a symbol that is not listed,
  that is a deliberate follow-up diff, not an improvisation during this unit.
