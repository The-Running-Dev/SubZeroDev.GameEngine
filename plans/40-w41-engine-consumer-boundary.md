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
| Tarball | **219 files, 584 kB** unpacked (vs. 540 files / 2.2 MB today) |
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
`Inspect tarball` (fail if any `*.test.*` is present), and `Consumer smoke`. Same
`if: steps.changed.outputs.changed == 'true'` gate as every other step.

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

### 5. The version is not bumped in this unit

`0.1.0` publishes as-is. The first published version is a delivery event, not a content
change, and conflating them would make the changelog claim engine behaviour changed when it
did not. `plans/39`'s **T0** milestone is "W41 merged *and* first package version published"
— two facts, and this keeps them separable.

---

## Done-When

- [ ] `npm run build` emits **zero** `*.test.*` files and zero `campaigns/` output.
- [ ] `npm run typecheck` still covers test files (`tsconfig.json` unchanged in that respect).
- [ ] `src/index.ts` exists, uses only explicit named re-exports, and matches the inventory
      above.
- [ ] `npm pack --dry-run` ships `dist/`, `package.json`, and npm-mandated package metadata
      (such as the package README), with the file count in the low hundreds rather than 540.
- [ ] A clean consumer installs the **packed tarball**, imports only
      `@the-running-dev/game-engine`, and both `tsc --noEmit` and a runtime `createGame`
      succeed.
- [ ] The consumer smoke project runs in CI inside the `engine` job's existing change gate.
- [ ] CI fails if a test artefact appears in the tarball.
- [ ] A release workflow publishes to GitHub Packages with `packages: write` and no stored
      credential.
- [ ] The first version is published, Sun Trap has read access, and the exact coordinate and
      version are recorded here.
- [ ] `docs/docs/guide/engine-package.md` describes what shipped, in past tense.
- [ ] `npm run typecheck && npm run lint && npm test` all pass; the doc gate passes.

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
