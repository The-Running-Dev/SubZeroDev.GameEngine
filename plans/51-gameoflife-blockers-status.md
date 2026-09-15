# Plan — Closing out the GameOfLife engine blockers (#107–#110)

**Status:** D1–D4 decided and acted on 2026-09-15. Written against engine `origin/main` @ `ef8abff`.
Follows [`50-gameoflife-engine-blockers.md`](50-gameoflife-engine-blockers.md).

**Outcome:**
- D1 — engine #484 (merged), closed #418.
- D2 — engine #485 (merged): computer resolved via `Requirement`; toolkit/sewing kit deferred
  in `design/90-decisions.md`, next to the bicycle. GameOfLife #108 commented.
- D3 — engine #486 (merged): `commandRegistry()`'s `fetch()` bounded to 3s; the unreachable-
  registry test moved off DNS onto local sockets. Closed #482 as a duplicate of #480.
- D4 — GameOfLife [#121](https://github.com/The-Running-Dev/SubZeroDev.GameOfLife/pull/121)
  (open): `engine` pin bumped `6910bf5` → `b017f06` (past W109–W111, #418's test, #108's
  decision, #486's fix).

The sequence steps below (`/track`, W112, W113, G1–G5) were not started; the GameOfLife pin was
found at `54e2467` (W95-era) rather than the `6910bf5` this plan assumed, corrected in D4's PR.

## What is true today (verified against the trackers and the tree)

W111 merged at 05:44Z today (PR #481, closes #467), so three units have landed and two are left.

| Unit | Engine issue | PR | GameOfLife issue | Engine side | GameOfLife side |
|---|---|---|---|---|---|
| W109 reputation modifier target | #465 closed | #478 | #108, first half | Landed | Pin predates it |
| W110 `startingMemories` | #466 closed | #479 | #110 | Landed | Pin predates it |
| W111 `exists`/`count` over §8.2's seven collections | #467 closed | #481 | #107 | Landed | Pin predates it |
| W112 item `weeklyCostCents` charged | #468 open | — | #108, second half | Not started | — |
| W113 housing utilities/transport | #469 open | — | #109 | Not started | — |

**None of the three landed surfaces is usable by GameOfLife yet.** Its `engine` submodule is pinned at
`6910bf5` (W108, #471), which comes before W109, W110 and W111. So #110 is not "practically usable
pending their wiring": the submodule bump comes first. #107 was not "untouched" either. W111 is
its whole engine-side prerequisite.

GameOfLife #107–#110 all have zero comments and were last updated 2026-08-31. Nothing has been
recorded there since the engine work began.

### Findings the status note did not cover

1. **#418 is still open, and it is not fully satisfied.** W111's slice says "Closes engine issue
   #418". The PR closed only #467. #418's third criterion needs a regression test that uses
   `player.relationships` keyed by NPC id and `player.education.enrollments` keyed by course id
   (filtered on `status`) against a built campaign. W111's tests reach those two collections only
   through a trivial `where` on a hand-built state. Only `player.inventory` is tested with a real
   field (`definitionId`). Two of #107's four events, `event-landlord-inspection` and
   `event-neighbor-borrows-again`, depend on exactly that untested addressing.
2. **#108 names six items, and W105.1 covers two of them.** The 2026-09-07 W105.1 entry covers the
   uniform (and, by extension, the coat) through reputation, and defers the bicycle's travel time.
   `item-basic-computer` ("unlocks remote jobs and online courses") and `item-basic-toolkit` /
   `item-sewing-kit` ("maintenance easier") are never addressed. No decision, slice or open item
   names them.
3. **#480 and #482 are the same defect.** Both are the `verify-release.test.ts`
   unreachable-registry timeout. #480 was filed 2026-09-13 and #482 was filed again by W111's
   `/verify` on 2026-09-15. Until it is fixed, every `/verify` reports a red `engine` test suite.
4. **The ledger lags the merges.** `design/30-slices.md` still shows W109–W111 as `[ ]` with
   "Status: Not started". No `/track` pass has run since #481.
5. **#107's car event depends on how content ids are listed.** W111.5 pins that `category` does not
   reach the resolver, so "owns a car" must be written as `definitionId in [<every car id>]`. A
   new car definition that is not added to that list silently fails to match. This is accepted
   behaviour under W111's out-of-scope clause, but GameOfLife authors need to be told.

## Decisions needed (one at a time)

**D1 — #418: close as satisfied, or add the missing test?** *Recommend:* add the test, not a new
unit. Write one `/fix`-sized test that runs `exists` over `player.relationships` with
`where: { all: [npcId equals, resentment greater_than 50] }` and over enrollments with
`status: "active"`, against a built campaign. Then close #418. This costs one small PR. The
alternative is closing #418 by decision, which leaves the addressing that #107's two NPC events
depend on untested until GameOfLife finds a failure.

**D2 — #108's computer, toolkit and sewing kit.** *Recommend:*
- **Computer:** no engine change. W111 already lets a job or course condition ask
  `exists player.inventory where definitionId equals item-basic-computer`. Record that in
  GameOfLife #108 as the resolution for that item.
- **Toolkit and sewing kit:** record in `design/90-decisions.md` that they are unexpressible and
  deferred alongside the bicycle. *(Corrected when D2 was recorded: the candidate mechanism is
  `MaintenanceRule.skillCheck` with a `CheckModifier { source: "item" }`. Both are declared, and
  neither is read, because `maintain_item` never runs a check. `maintenanceRisk` is a housing field.)*
  Contracting a reader now is the same objection W105.1 already upheld for travel time.
- *Alternative:* a new slice to wire `maintenanceRisk` modifiers. That means a contract amendment
  and a new unit, which is more than #108 asks for.

**D3 — #480/#482.** *Recommend:* close #482 as a duplicate of #480 and fix #480 (bound
`commandRegistry()`'s `fetch()` with its own timeout) **before W112**. That way W112 and W113's
`/verify` reports stay clean. Fixture-moving units are exactly where a pre-existing red test hides
a real regression.

**D4 — When GameOfLife bumps its pin.** *Recommend:* bump twice.
- **Now, to `ef8abff`.** W109–W111 cause no fixture churn and no `kindVersion` change, and the
  bump unblocks #107, #110 and the uniform/coat half of #108.
- **Again after W113.** That bump carries the kind-version migration and both cash-trajectory
  changes together.
- *Alternative:* one bump after W113. That holds three landed units back for two more sessions
  and folds the harmless bump into the risky one.

## Sequence

Each numbered step is its own session unless it is marked *same session*.

### Engine

1. **`/track`**, fresh (Sonnet, medium). Tick W109–W111 in the ledger and the mirror, and record
   the D1 outcome against #418.
2. **D1 test, then close #418** (`/fix`, Sonnet, medium).
3. **D3: `/fix #480`** (Sonnet, medium). Close #482 as a duplicate.
4. **D2 decision entry.** Add the toolkit/sewing-kit deferral next to W105.1's travel-time open
   item, then regenerate the human docs.
5. **`/slice W112`** → `/verify` → `/pr`, *same session* (Sonnet, medium). W112.6 requires every
   regenerated fixture to be named with its cash delta.
6. **`/track`**, fresh.
7. **`/slice W113`** → `/verify` → `/pr`, *same session*, alone (Sonnet, high). This bumps
   `kindVersion`, adds a migration, and moves fixtures.
8. **`/track`**, then **`/reconcile`**, each fresh. That completes the 0.12 engine blocker set.

### GameOfLife (after D4's first bump, in parallel with engine steps 5–7)

- G1. Bump `engine` → `ef8abff`, run `npm run setup && npm run check`.
- G2. #110: author `startingMemories` where `03` §12.3 calls for one; close #110.
- G3. #107: rewrite the four events using W111 conditions (the car event by an explicit
  `definitionId` list, per finding 5). Wait for step 2 before relying on the two relationship
  events. Close #107.
- G4. #108 (partial): uniform/coat → `player.reputation.employability` modifiers; computer →
  conditions on the relevant jobs/courses; leave bicycle/toolkit/sewing kit named per CP10 with
  the D2 decision cited.

### GameOfLife (after engine step 7)

- G5. Bump `engine` again, then finish #108 (vehicle `weeklyCostCents`, `"vehicle"` tag on the car)
  and #109 (`utilitiesCents`/`transportCents` per §16.4's $18/$15 baseline). Re-export content and
  close both issues.

## Done when

- GameOfLife #107, #109 and #110 are closed. #108 is closed with the bicycle, toolkit and sewing
  kit resolved by recorded decision.
- Engine #418, #468, #469 and #480 are closed, and #482 is closed as a duplicate.
- GameOfLife's `engine` pin includes W113, and its `npm run check` passes.
