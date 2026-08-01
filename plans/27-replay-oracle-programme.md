# The Replay Regression Oracle — Programme

**Units:** [`docs/docs/engine/TODO.md`](../docs/docs/engine/TODO.md) — W20, W21, W22, W23

**Scope:** Umbrella plan for building [`07-replay.md`](../docs/docs/engine/07-replay.md)
against real code. Records why the oracle is split into four units instead of one, and the
decisions each unit resolved before any engine code was written. Each unit gets its own
`plans/28…31-*.md` when it is actually executed, following the convention every W-unit above
this one used.

**Depends on:** W0–W19 (the MVP) — all done.

## Why Now

TODO.md's own rationale (§ *Rigour: The Replay Regression Oracle*, pre-W20): the oracle
compares engine **versions**, and W19 just produced the first one. Building it now means every
change from here is guarded; deferring it means a gap in the corpus during the period the
engine changes fastest — the same argument that put the determinism harness (W18) directly
ahead of MVP acceptance rather than after it.

## What This Programme Actually Does

Not new engine behavior in the W18 sense — but not pure audit either. Exploration for this plan
found `07-replay.md` describes two things that were never built (`createSessionLayer`, a real
engine version) and omits crediting two things that already were (`Kind.outcome`, a counting
`IdSource`). The programme's first job was reconciling the spec with the code before any unit
plan could be trusted; that reconciliation is `07-replay.md`'s own diff, described below, not a
separate deliverable.

| 07 §  | Spec claimed | Code actually had |
|---|---|---|
| §3.3 | `Kind` gains an `outcome` member (future tense) | **Built.** `kernel/types.ts` §3 already carries it; all five real-kind-assembly copies implement it identically as `outcome: (state) => ({ endingId: state.endingId ?? null })` |
| §5 | The runner needs a counting `IdSource` | **Built**, but test-local. `createCountingIds()` lives in `mcp/server.test.ts`, independent counters fixed in PR #72 |
| §3.2, §6 | Compose `createSessionLayer(host: SessionHost)` (06 §4) | **Does not exist**, and turned out `createInMemorySessionStore` couldn't serve either — its `SessionStore` surface returns only `Scene`/`PlayerView`, never the raw `GameState` `finalStatus`/`terminal` need. W7 built `createInMemorySessionStore(options)` against `session/types.ts`; `06 §4`'s composition-root generality was never built (`plans/14-w7-session-store.md`, Decision 1) |
| §2 | `capturedUnder` is "the engine version that recorded the outcome" | **No source.** `src/engine/package.json` is `"version": "0.0.0"`; zero git tags exist in the repository |

## Decisions

### 1. Four units, not one — W20 first because the other three depend on what it produces

W21's `Outcome` and W22's corpus can be built and tested without a real version scheme —
`capturedUnder` just needs *a* string. But W23's CI half (§8: "on every release tag, against
the previous tag's corpus") is meaningless without one, and retrofitting a version scheme onto
an already-built corpus would mean rewriting every committed fixture's `capturedUnder`. Cutting
W20 first, even though nothing downstream strictly blocks on it until W23, avoids that rework
and gives W21/W22 a real value to write from day one rather than a placeholder.

The W21/W22/W23 split itself mirrors W16→W17→(CI never got its own unit, it's part of W0)
— mechanics, then real content, then wiring — and keeps each PR reviewable on its own, the same
reasoning `plans/25-w18-determinism-harness.md` gives for splitting the synthetic-kind harness
from the real Bureaucracy golden-file suite.

### 2. Amend 07 to compose `Engine` and `ProfileStore` directly; do not build `createSessionLayer`

`07-replay.md` §3.2/§6 as written assumes an abstraction that was speced (`06-extensibility.md`
§4) but never built, and building it here would mean drawing a composition-root generality from
exactly one real call site — the same anti-pattern `OPEN-QUESTIONS.md` §2 already declines for
the shared tick-pipeline substrate ("one built instance is not a pattern"). The original plan
here was to route through `createInMemorySessionStore({ engine, registry, profiles })` instead
— the exact composition `mcp/server.test.ts`'s `buildStore()` helper already exercises — but
implementing W21 found that doesn't work either: `SessionStore`'s client-facing surface returns
a `Scene`/`PlayerView` projection, never the raw `GameState`, and `Outcome.finalStatus`/
`terminal` both need the state itself (`state.status`, `kind.outcome(state.kindState)`). The
runner ended up composed the way `core/determinism/harness.ts`'s `runFixture` already is —
directly against `Engine` — with `session/store.ts`'s `upsertAchievements` exported so
achievements still go through the one tested path rather than a second reimplementation.

The open item does not disappear; it moves to `OPEN-QUESTIONS.md` §2 with a concrete
**revisit when**: a second `SessionStore` implementation. The replay runner becomes that
category's second real call site (alongside W7's session store), which is worth recording even
though it doesn't close the question — two call sites of `createInMemorySessionStore` is still
one implementation, not two.

### 3. Semver + git tags as their own unit (W20), scoped narrowly

This is a repository-wide release-process decision wearing a test-harness hat. Keeping it out
of W21/W22 means those units' reviews stay about runner mechanics and fixture content, not
versioning policy. W20's own scope is deliberately narrow: a real version, a tag scheme, and a
first tag at the MVP-done commit — not a changelog generator, not semantic-release tooling,
not a publishing pipeline. Those are enhancements this programme does not need and are not
implied by anything W21–W23 depend on.

### 4. Plain JSON corpus files, diverging deliberately from W18's vitest snapshots

`07-replay.md` §7 states the workflow's central rule: regenerating a committed outcome is
"never automatic... a command that silently rewrites every outcome file turns the oracle into
a rubber stamp." `vitest -u` is exactly that command — one keystroke rewrites every
`toMatchSnapshot()` in the suite, with no per-fixture granularity. W18 could accept that because
a golden `serialize()` blob has no reviewable content of its own regardless of tooling; an
`Outcome` diff is the opposite — per §7's own framing, *the diff is the deliverable*. Plain
committed JSON, regenerated one file at a time (by a named script taking a fixture name, or a
manual edit), keeps "deliberate, per-fixture, reviewed" true structurally rather than by
discipline that erodes under time pressure. This is recorded as an explicit divergence in
`07-replay.md` §4 rather than left for a reviewer to notice and question later.

### 5. Extract the shared `story-graph` kind assembly (folded into W22)

Five test files (`mcp/server.test.ts`, `clients/text/client.test.ts`, the three
`campaigns/bulgaria-bureaucracy.*.test.ts`) each defined a byte-identical
`makeStoryGraphKind()` — confirmed by diffing them during implementation, which also
corrected this plan's original count: `core/kernel/engine.test.ts`'s own `id: "story-graph"`
match turned out to be an unrelated synthetic `makeTestKind`, not a sixth copy of the real
one. W22's corpus test needs the same real kind again, which would have made it a sixth.
Copying it again crosses from "tolerable test duplication" into "this is actually the
production kind, just never named as such" — the same judgment call this codebase's own
envelope-duplication ledger (`CLAUDE.md`, *Where Drift Happens*) exists to catch before it
recurs. `kinds/story-graph/kind.ts` is now the one definition; all five original test files
import it instead of redefining it, and the corpus test (`bulgaria-bureaucracy.replay.test.ts`)
imports it too rather than becoming what would have been the sixth. This is pure
de-duplication of identical code, not a new abstraction — nothing about the shape changes,
only where it lives.

`createCountingIds()` moves the same way, out of `mcp/server.test.ts` and into
`core/determinism/counting-ids.ts` (with its own direct unit test), since the corpus test
needs the exact same reproducible `IdSource` the MCP test already proved correct. W21's own
mechanics tests use a simpler fixed `IdSource` instead — a counting source is only load-bearing
once more than one game gets created per run, which the corpus test's per-fixture context does
and the synthetic-kind mechanics tests do not.

## Unit Summary

Full **Spec** / **Depends on** / **Done when** for each unit lives in
[`TODO.md`](../docs/docs/engine/TODO.md) under *Rigour: The Replay Regression Oracle* (W20–W23).
Restated briefly:

- **W20 — Engine Versioning and Release Tags.** Real semver, a tag scheme, first tag at the
  current MVP-done commit.
- **W21 — Replay Oracle: Outcome and the Runner.** `Outcome`/`Decision`/`ReplayVerdict` and the
  runner, proved against a synthetic kind first — `core/replay/types.ts`,
  `core/replay/runner.ts`, `core/replay/runner.test.ts`, mirroring `core/determinism/harness.ts`'s
  own split.
- **W22 — Replay Oracle: The Corpus.** `fixtures/replay/*.{fixture,outcome}.json` against the
  real Bureaucracy campaign, covering every `MVP.md` §5 *Playable* box plus at least one
  deliberate edge case; the `kinds/story-graph/kind.ts` and `createCountingIds` extractions
  ride along here since this unit's own corpus test is what would have made each a sixth and
  a second duplicate, respectively.
- **W23 — Replay Oracle: CI Wiring.** `pull_request` gained a `paths: [src/engine/**]` filter
  — broader than just `core/`/`kinds/`, since a campaign-, client-, or MCP-only PR still needs
  the full `engine` job and scoping to only `core/`/`kinds/` would silently skip it; `push` to
  `main` stays unfiltered (path filters and tag pushes don't reliably combine). A new
  `release-tag-replay` job runs only on `v*` tags, extracts the previous tag's committed
  `.outcome.json` files via `git show`, and points the corpus test's
  `REPLAY_EXPECTED_OUTCOMES_DIR` override at them — the actual cross-version comparison.

## Milestones

| # | Reached when | Meaning |
|---|---|---|
| **M1 — The oracle runs** | W21 + W22 merged | A divergence is detectable locally; the corpus exists and is reviewable as a diff |
| **M2 — The oracle guards** | W23 merged | Core and kind changes cannot land without the corpus agreeing |
| **M3 — Cross-version proof** | The *second* release tag is cut | The first genuine previous-version comparison. Until two tags exist, the oracle only compares a build against a committed outcome file — useful, but not yet the thing `07-replay.md` §1 distinguishes from W18 |

M3 is a scheduling fact worth stating plainly: the oracle's headline capability — comparing
this build against a *previous* one — cannot be demonstrated until a second version exists, no
matter how well W20–W23 land individually.

## Explicit Non-Goals

- No engine behavior changes. `Kind.outcome` and the counting `IdSource` already exist; this
  programme wires existing pieces into a new runner and corpus, it does not add new gameplay
  or core semantics.
- No resolution of `SessionHost`/`createSessionLayer` (06 §4) — Decision 2 amends the spec
  around the gap rather than closing it.
- No changelog automation, semantic-release tooling, or publishing pipeline in W20 — version
  and tag only.
- No session-capture work (`08-session-capture.md`) — gated on hosting, unrelated to this
  programme beyond sharing the `ReplayFixture` shape (07 §9).
