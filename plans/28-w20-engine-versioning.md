# W20 — Engine Versioning and Release Tags

**Unit:** [`docs/docs/engine/TODO.md`](../docs/docs/engine/TODO.md) — W20

**Scope:** A real semver on the engine package, a documented tag scheme, and a way to read
the version from code without a runtime dependency.

**Depends on:** Nothing. Cut first in the programme (`plans/27-replay-oracle-programme.md`,
Decision 1) because W23's release-tag comparison is meaningless without it, and retrofitting
a version scheme onto an already-built corpus would mean rewriting every fixture's
`capturedUnder`.

## What This Unit Builds

`src/engine/package.json`'s `version` moves from the placeholder `0.0.0` to `0.1.0` — the
MVP is done (W0–W19), so this is a real first release, not a bump for its own sake.
`package-lock.json`'s two `version` fields (root and the `""` package entry) were patched
to match by hand, not via `npm install --package-lock-only` — that was tried first and
reverted after it rewrote unrelated `libc` platform-dependency metadata elsewhere in the
lockfile, apparently from a local npm version difference, unrelated churn worth avoiding in
a PR about versioning the package itself. (Found on review, PR #73 — the lockfile was
initially missed entirely.)

`src/engine/src/version.ts` exports `ENGINE_VERSION`, read from `package.json` at import
time via `fs.readFileSync` rather than duplicated as a second literal. This is a boundary
read, not an engine-logic one — nothing under `advance` reaches it, so it does not reopen
the determinism guard's `Date.now`/`Math.random` boundary (`eslint.config.js`); it is release
metadata, not game state.

A `v0.1.0` annotated git tag marks the MVP-done commit (`96586bf`, the tip of `main` at the
time this unit was cut, past PR #71's own MVP-DONE commit and its PR #72 follow-up fixes).

## Decisions

### 1. Read the version from `package.json`, don't duplicate it as a literal

The alternative — a hand-written `export const ENGINE_VERSION = "0.1.0"` — creates exactly
the two-places-to-update problem this repo's envelope-duplication ledger exists to flag.
`resolveJsonModule` importing `package.json` directly was considered and rejected: it sits
outside `tsconfig.json`'s `rootDir: "src"`, and letting tsc extend the effective root to
cover it would change `dist/`'s output layout for every other file. `fs.readFileSync` against
a path resolved via `import.meta.url` needs no tsconfig change and resolves identically from
both `src/version.ts` (vitest, uncompiled) and `dist/version.js` (built) because `version.ts`
sits directly at `rootDir`'s top level — one directory up from `package.json` in both cases.

### 2. Document the tag scheme on the guide page, not the (already stale) package README

`docs/docs/guide/engine-package.md` gained a **Versioning and Releases** section: plain
`vX.Y.Z` tags, since the engine is currently the only thing in this repository that is
versioned at all. `src/engine/README.md` was the other candidate and was rejected — it
already reads "Phase 1 in progress... no game is playable yet," badly stale against the
done MVP, and adding a new section next to that contradiction would read worse than adding
it to the guide page, which Docusaurus actually publishes and keeps current elsewhere in
this same edit.

### 3. Tag `96586bf`, not `dcb7803`

`dcb7803` ("W19 — MVP Acceptance (MVP DONE)") is the commit that made the MVP-done claim
true, but `96586bf` (PR #72) landed immediately after, fixing two real Qodo review findings
against it. Tagging the fixed commit rather than the one it fixed avoids a `v0.1.0` that is
retroactively known-wrong the moment it's cut.

## Design

### New files

| File | Contents |
|---|---|
| `src/engine/src/version.ts` **(new)** | `ENGINE_VERSION`, read from `package.json`. |
| `src/engine/src/version.test.ts` **(new)** | Asserts `ENGINE_VERSION` matches `package.json`'s own value (not a hardcoded duplicate) and is a real semver, not `0.0.0`. |

### Test Plan

- [x] `ENGINE_VERSION === ` the value independently read from `package.json` in the test.
- [x] `ENGINE_VERSION` matches `/^\d+\.\d+\.\d+$/` and is not `"0.0.0"`.

### Explicit Non-Goals

- No changelog automation, semantic-release tooling, or publishing pipeline — version and
  tag only, per `plans/27`, Decision 3.
- The `v0.1.0` tag is created locally; pushing it to the remote is a separate, explicit step
  (tags are shared, visible state).
