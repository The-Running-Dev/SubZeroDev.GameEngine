# W19 — MVP Acceptance

**Unit:** [`docs/docs/engine/TODO.md`](../docs/docs/engine/TODO.md) — W19

**Scope:** Walk [`MVP.md`](../docs/docs/engine/MVP.md) §5 and attach test evidence to each
box.

**Depends on:** Every unit above (W1–W18) — all done.

## What This Unit Actually Does

Not new engine behavior — an audit. §5 has 26 boxes across 8 categories. Each one either
already has a real test proving it (built across W1–W18, mostly without anyone tracking
which test proves which box explicitly), or it doesn't yet, in which case W19's own job
is to write the missing test before checking the box — "every box is checked with a named
test" is TODO's own done-when, and a box checked without one would make this unit
theater, not acceptance.

Audited every box against the actual test suite (not by re-reading old plan documents —
by opening each candidate test file and confirming the assertions really prove the
claim). Two gaps found; both closed as part of this unit, described below. The other 24
boxes already had real coverage; those get a citation only, no new code.

## Gaps Found and Closed

### 1. "The `jsonl` sink at `trace`... the gate's visit counts and the random pick are both readable" — genuinely untested

Every existing `jsonlEmitter` test used either hand-built synthetic `EmittedRecord`s
(`observability/emitter.test.ts`) or the generic `test-campaign` fixture
(`session/store.test.ts`) — asserting only that lines are non-empty, parseable JSON.
Nothing played the *real* Bureaucracy arc through `jsonlEmitter` and confirmed a human
(or a log pipeline) could actually recover the two things 03 §8.4 names events for.

New: `campaigns/bulgaria-bureaucracy.observability.test.ts`. Plays `wait, continue_cycle
×2, go_home` through a `jsonlEmitter`-backed store, parses every emitted line back into
an `EmittedRecord`, and asserts directly against the parsed data — the random pick
(`clerk_review → room_14`) and `room_14`'s own `visitCount` climbing `[1, 2, 3]`, which
is exactly what `office_visits` tracks in this campaign (`room_14`'s own effect
increments it once per entry) — the observable signal a diagnosing developer would
actually look for, not `office_visits` itself, since `StateChange` and the event stream
are deliberately separate channels (05 §1) and no event carries a variable's value.

### 2. "Same seed, choices, and counting `IdSource`" — the existing cross-client test used a constant, not a counter

`mcp/server.test.ts`'s client-contract proof (09 §1) used a fixed-but-constant
`IdSource` (`newGameId: () => "fixed-game-id"`), not a literal counting one — 09 §1 and
06 §5.1 both specifically name a *counting* source as part of the fixture. For a test
that creates exactly one game per run, a constant and a fresh-per-run counter starting at
0 are behaviorally identical, which is presumably why this went unnoticed — but the
terminology matters for a test that might grow to create more than one game later, and
matching the spec's own words exactly is cheap here.

Fixed: replaced the constant with `createCountingIds()`, a real counter starting at 0,
called once per independent run (so both runs' first-and-only `createGame` still lands
on the same count and produces the same `gameId`). No behavior change in what the test
proves; the fixture now matches what 09 §1 actually asks for.

### 3. (Recorded, not fixed) "No `profileId`... anonymous... still plays to its ending" was two separate proofs, not one

`session/store.test.ts` already proved "no `profileId` means zero `ProfileStore` calls"
and, separately, every client-arc test proved "reaches an ending without a `profileId`"
— but no single test asserted both together. Extended the existing no-read/no-write test
to also submit an `end` action and assert `status: "ended"`, so the box now has one
citation instead of an inferred combination of two.

## Design

MVP.md §5 itself is edited: every `- [ ]` becomes `- [x]`, with a trailing citation —
file path plus the exact `it(...)` title — so the claim is checkable by anyone without
re-deriving which test proves it. Categories whose proof is structural rather than a
runtime test ("Portable" — no DOM/network/AI dependency) are cited against
`package.json`/the absence of a `vitest.config.*`, not invented as a pointless assertion
of an already-impossible failure mode.

### Explicit Non-Goals

- No changes to the engine, a kind, a client, or the session store beyond the two test
  additions above.
- No renumbering, no restructuring of MVP.md beyond checking boxes and adding citations.
