# W22 — Replay Oracle: The Corpus

**Unit:** [`docs/docs/engine/TODO.md`](../docs/docs/engine/TODO.md) — W22

**Scope:** The committed `fixtures/replay/*.{fixture,outcome}.json` set against the real
Bureaucracy campaign, plus the shared-kind extraction and `createCountingIds` promotion this
unit's own corpus test made necessary.

**Depends on:** W21.

## What This Unit Builds

`fixtures/replay/` (`src/engine/fixtures/replay/`, a sibling of `src/`, not under it — plain
data, not compiled source): three fixture/outcome pairs against the real Bureaucracy
campaign — `bureaucracy-full-arc` (the complete arc: `wait → continue_cycle ×2 → go_home`,
reusing W18's own seed and action log), `bureaucracy-mid-arc` (a non-terminal state after
one `wait`, also ported from W18), and `bureaucracy-gated-choice` (`wait`, then `go_home`
rejected with `requirement_unmet` while the `office_visits ≥ 3` gate is still shut,
`continue_cycle ×2`, then `go_home` again, this time accepted).

`kinds/story-graph/kind.ts` — the single `storyGraphKind` assembly, replacing five
byte-identical `makeStoryGraphKind()` copies (`mcp/server.test.ts`,
`clients/text/client.test.ts`, and the three `campaigns/bulgaria-bureaucracy.*.test.ts`
files) that this unit's own corpus test would otherwise have made a sixth of.

`core/determinism/counting-ids.ts` — `createCountingIds`, promoted out of
`mcp/server.test.ts`, with its own direct test (`counting-ids.test.ts`) proving the
independent-counters property PR #72 fixed.

`campaigns/bulgaria-bureaucracy.replay.test.ts` — the corpus runner: loads every
`*.fixture.json`, builds each `Outcome` against the real campaign, and asserts it matches
the committed `.outcome.json`. Lives beside the campaign, not under `core/replay/`, for the
same reason `bulgaria-bureaucracy.determinism.test.ts` does — `eslint.config.js`'s
dependency-arrow rule forbids `src/core/**` from importing a kind at all, even in a test,
and this suite needs the real `story-graph` kind.

## Decisions

### 1. Reused W18's two fixtures instead of authoring new seeds

The full-arc and mid-arc fixtures are the same `(seed, actionLog)` W18's determinism harness
already proved reproducible and byte-stable — `bulgaria-bureaucracy.determinism.test.ts`'s
own `FULL_ARC_FIXTURE`/`MID_ARC_FIXTURE`. Reusing them satisfies 07 §4's priority-2 source
("Definition-of-Done paths") without inventing a new seed whose behavior isn't already
scan-verified the way `bureaucracy-seed-3` is (`plans/22-w15-bureaucracy-campaign-and-broken-fixtures.md`).

### 2. The gated-choice fixture submits `go_home` after `wait`, not before

Submitting `go_home` at turn 0 — before the player has even reached the scene that offers
it — is rejected `unknown_action`, not `requirement_unmet`: it isn't a real gate, it's an
action that doesn't exist yet in the current scene, already covered by W21's own synthetic
mechanics tests. The fixture submits `wait` first (reaching `room_6`, where `go_home` is a
real but gated choice), *then* `go_home` — genuinely exercising `03-story-graph-kind.md`'s
requirement-gate rejection path, confirmed empirically by running the fixture through
`buildReplayOutcome` before committing its `.outcome.json`, not assumed from reading the
content alone.

### 3. Outcome files were captured, not hand-derived

Each `.outcome.json` was produced by actually running `buildReplayOutcome` against the real
engine and campaign (a throwaway generator script, deleted after use — never committed) and
copying its output verbatim. Hand-deriving the exact `Decision` sequence, `seq` numbering, or
achievement id casing would risk committing a "golden" file that was never actually golden.

### 4. Extracted the shared kind and promoted `createCountingIds` here, not in W21

Both existed as tolerable duplication before this unit (five copies of the kind, one copy of
the counting `IdSource`). This unit's own corpus test is what would have made the kind a
sixth copy and needed the counting `IdSource` as a second real consumer — the trigger for
promoting both, per `plans/27-replay-oracle-programme.md`, Decision 5. W21's mechanics tests
use a simpler fixed `IdSource` instead of the counting one: reproducibility only requires
*a* fixed identity for a run that creates exactly one game, and the corpus test's per-fixture
context (fresh `IdSource` per fixture, so cross-fixture identity never collides) is where a
genuinely *counting* source is load-bearing.

## Design

### New files

| File | Contents |
|---|---|
| `kinds/story-graph/kind.ts` **(new)** | `storyGraphKind`, the single real `Kind<StoryGraphKindState>`. |
| `core/determinism/counting-ids.ts` **(new)** | `createCountingIds`, promoted from `mcp/server.test.ts`. |
| `core/determinism/counting-ids.test.ts` **(new)** | Independent counters, fresh-instance isolation. |
| `fixtures/replay/*.fixture.json`, `*.outcome.json` **(new)** | Three pairs, captured against the real campaign. |
| `campaigns/bulgaria-bureaucracy.replay.test.ts` **(new)** | The corpus runner, plus a hand-edited-divergence check and both `unrunnable` paths against the real registry. |

### Changed files

`mcp/server.test.ts`, `clients/text/client.test.ts`, `campaigns/bulgaria-bureaucracy.test.ts`,
`campaigns/bulgaria-bureaucracy.determinism.test.ts`,
`campaigns/bulgaria-bureaucracy.observability.test.ts` — each now imports `storyGraphKind`
and (`mcp/server.test.ts` only) `createCountingIds`, instead of defining its own copy.

### Test Plan

- [x] Every `MVP.md` §5 *Playable* box has a fixture: the arc (full-arc), the gated choice
      (gated-choice), the seeded transition (all three, same seed), the achievement
      (full-arc, gated-choice), the loop gate (full-arc, gated-choice).
- [x] At least one deliberate edge case: the gated-choice fixture's `requirement_unmet`
      rejection, immediately followed by a recovering action.
- [x] `kinds/story-graph/kind.ts` is the single assembly; all five prior duplicates import
      it instead of redefining it.
- [x] A hand-edited `Outcome` (in-memory, not a committed file) produces `diverged` with the
      correct `at`.
- [x] `findDivergence(expected, expected)` is always `undefined` for every committed fixture
      — the comparator's own reflexivity.

### Explicit Non-Goals

- No CI wiring — W23.
- No fixture beyond the Bureaucracy campaign — there is only one real campaign in the MVP.
- No automatic outcome regeneration tooling — 07 §7 requires regeneration to stay a
  deliberate, single-fixture, reviewed step; none was built, on purpose.
