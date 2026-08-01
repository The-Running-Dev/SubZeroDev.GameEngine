# W24 — Core Spec Reconciliation

**Unit:** [`docs/docs/engine/TODO.md`](../docs/docs/engine/TODO.md) — proposed as W24. Closes
six entries under *Known Open Items Carried In* and one stale checkbox under *Depth: Sun Trap*.

**Scope:** Doc-only. Codify in `04-core.md` and `03-story-graph-kind.md` the conventions the
code already implements and depends on, restate one type whose only citation points at another
repository, resolve one intra-document contradiction, and correct six stale TODO.md entries.
No code changes — every item here is the documentation half of something already built and
tested.

**Depends on:** Nothing.

**Blocks:** **W25** ([`plans/32`](32-w25-simulation-kind-seam-reconciliation.md)) — three of
the conventions codified here are ones W25 needs to cite.

**Programme:** [`plans/33-post-mvp-programme.md`](33-post-mvp-programme.md), Tranche A.

---

## Why This Unit Exists

Six of TODO.md's twelve *Known Open Items* say a version of the same thing: **a convention is
real in code, exercised by tests, and stated in no contract.** They accumulated one per unit
across W8–W13, each correctly deferred at the time ("a documentation follow-up, not blocking"),
and none has been picked up since because no unit owned them.

That is a specific, named risk in this repository. `CLAUDE.md`'s *Where Drift Happens* records
that envelope-duplication recurred five times, and that the ledger tracking it **itself
drifted** because four documents carried four different counts, each written from memory rather
than from the list. Conventions that live only in code are the same failure one level down: the
next kind to be built (`simulation`, W25→W27) has to either rediscover them by reading
`kinds/story-graph/*.ts` or invent its own second versions.

Batching them into one unit is deliberate. Each is a few lines; separately they are six PRs
of near-identical shape with six reviews. Together they are one coherent statement: *the core
contract now says what the core actually does.*

---

## The Items

Every shape below was read out of the current code, not from the TODO entry describing it.

### 1. The achievement-unlock `StateChange` shape → `04-core.md` §12

**TODO says:** both docs say a kind "emits an `achievement_unlocked` `StateChange`" but neither
fixes its `path`/`op`/`value`. `StateChange.reason` is a bare `ReasonCode` (`type ReasonCode =
string`), so a kind-agnostic session store has no contract to detect one by.

**The code** (`kinds/story-graph/achievements.ts:55–61`):

```typescript
{ path: `achieved.${achievement.id}`, op: "set", value: true,
  reason: "achievement_unlocked", visible: true }
```

Note `visible: true`, which TODO.md's description of the W8 convention omits — a small
illustration of the point, since TODO.md is itself now a from-memory record of a shape.

**Change:** state this shape in §12 next to the `StateChange` interface. The `achieved.<id>`
path reuses 03 §6's already-fixed condition-field name, so nothing new is invented — only
written down. W13 is the real caller and `achievements.test.ts` the proof.

### 2. The consequence-applied `StateChange` shape → `04-core.md` §12

**The code** (`kinds/story-graph/variables.ts:159–174`) — one coalesced change per touched
variable per batch, iterated in sorted key order:

```typescript
{ path: `var.${name}`, op: "set", value: <final>, previous: <before>,
  reason: "consequence_applied", visible: decl.visible ?? false }
```

`op: "set"` regardless of which typed ops ran, because the batch is coalesced after clamping —
03 §5's clamp-after-all-effects rule means the intermediate `increment`/`decrement` ops have no
individually meaningful audit value. That reasoning is load-bearing and currently exists only
as a code comment.

**Change:** state the shape and the coalescing rule in §12. TODO.md already flags this as "now
load-bearing, not just provisional" — W12's `advance` attaches these to `AdvanceResult.changes`,
so it is exercised, not predicted.

### 3. The `<kindId>.reason.*` messageKey namespace → `04-core.md` §12

**TODO says:** §12 reserves `core.reason.*` for the base set only; `kind.<kindId>.*` (05 §9) is
*event-name* namespacing, a different vocabulary. Kind-owned reason-code message keys have no
stated namespace at all.

**The code** (`kinds/story-graph/reasons.ts:60–63`) uses `story-graph.reason.<code>` — kind id,
no `kind.` wrapper — and mirrors `core/kernel/reasons.ts`'s structure exactly (a const array, a
compiler-forced-complete message table, a `ReadonlyMap` built from both).

**Change:** §12 states `<kindId>.reason.<code>` as the convention for kind-owned message keys,
and notes explicitly that it is *not* the same namespace as 05 §9's `kind.<kindId>.*` event
names — the near-collision is the reason this needs saying rather than assuming.

**This is the item W25 is blocked on.** With it stated in the core contract, W25's §10 cites it
in one line; without it, W25 would have `10-simulation-kind.md` asserting a rule that neither
`04-core.md` nor `03-story-graph-kind.md` states.

### 4. Restate the `Condition` shape in `04-core.md` §18

**TODO says:** §18 declares the operator set frozen and cites `games/04-engine-specification.md`
§13.1 for the full surface — but that document is in the companion `SubZeroDev.GameOfLife`
repository, not this one. A reader of the published docs site cannot open it.

Verified: §18 (lines 998–1006) names the eleven operators, the three combinators and the two
quantifiers in prose, then defers the actual *shape* to the sibling repo. W10 ported the shape
into `core/condition/types.ts`, dropping the ancestor's `CollectionSelector` (a closed union of
simulation-kind paths with no kind-agnostic meaning).

**Change:** §18 restates the ported `Condition` / `ComparisonOperator` / `ExistsCondition` /
`CountCondition` shapes inline, and records the `CollectionSelector` omission with its reason.
The ancestor citation stays as provenance — per `CLAUDE.md`, every `games/…` citation is
provenance — but stops being load-bearing.

### 5. Fix `03-story-graph-kind.md` §9's field comment (narrower than TODO.md thinks)

**TODO says:** "03 §7 and §9 read in tension over whether a `hidden` achievement appears in
`StoryGraphView.unlockedAchievements` once unlocked."

**What is actually there** — and this sharpens the item usefully. §9 has *two* statements:

- The field comment: `unlockedAchievements: string[];  // non-hidden, unlocked` — contradicts §7.
- The prose, four paragraphs down: "**Excluded from the projection:** … any hidden achievement
  **not yet unlocked**" — **agrees with §7**.

So §9's prose and §7 are already consistent; only the three-word inline gloss is out of step,
and it predates `AchievementDefinition` existing at all. W13 resolved it in code in §7's favour
(`kinds/story-graph/view.ts:33–41` carries a nine-line comment explaining exactly this).

**Change:** one comment. `// unlocked — including hidden ones, from the moment they unlock (§7)`.
The tension is a typo's worth of drift, not a design disagreement, and saying so is more useful
than leaving a *Known Open Item* implying a decision is outstanding.

### 6. Close the doc-tree numbering item

**TODO says:** the engine specs and the game specs both start at `01-`; "largely obviated by
the repo split — confirm and close, or restate the remaining problem."

**Confirm:** the two trees are in separate repositories with separate Docusaurus sites. The
engine specs never link into `games/…` as routes (per `CLAUDE.md`, `games/…` references are
prose provenance, and both link checks are `'throw'`, so a real cross-repo link would fail the
build). There is no merged numbering to collide.

**Change:** close it in `OPEN-QUESTIONS.md` §2 and remove the TODO entry, with one sentence
recording *why* it closed rather than deleting it silently.

### 7. Correct six stale TODO.md entries

Full evidence for the first four in [`plans/33`](33-post-mvp-programme.md), Findings 1–4. The
fifth was found after that plan was written — by this unit's own PR, see below. Summarised:

| Entry | Correction |
|---|---|
| "`KindContext.derive` and the `tick` stream… both are gaps" | **Both built** since W1/W2. `kernel/types.ts:82`, `kernel/engine.ts:66`, `determinism/types.ts:27–31`, `determinism/rng.ts:15–33` (all four variants encoded, exhaustiveness-guarded). Check the box, cite the code |
| "`npm audit` reports 10 (3 moderate, 6 high, 1 critical)" | Now **6 (3 moderate, 2 high, 1 critical)**. Precondition ("once W18 can prove the upgrade changed no behaviour") is **met** — W18 and W20–W23 both exist. Re-point the entry at W26 |
| "`previewAction` and the tenth API pairing" as a standalone checkbox | Reads as schedulable; 12 §7 and `OPEN-QUESTIONS.md` §2 both say it is deliberately deferred *and* must change 09/`MVP.md`/04 §13 in one edit. Reword as folded into the world-graph build |
| The `04 §3.1` reference behind the `derive` checkbox | 04 §3.1 declares `derive` on `KindContext`; check that its prose actually says the `tick` and `agent` variants are reachable, since the checkbox's claim that they were not came from somewhere |
| W23's description: "`pull_request` gained a `paths: [src/engine/**]` filter" (TODO.md:446) | **The filter never shipped.** `ci.yml` lines 13–22 record it as "tried and reverted": a path-filtered `pull_request` means a required check never *starts*, and GitHub leaves the PR waiting on a report that never arrives rather than treating it as satisfied. The equivalent skip moved *inside* the job ("Determine whether the engine package changed", `ci.yml:59`), so `engine` always reports while skipping the expensive steps |
| W23's status note: "it needs **a second real tag** to exercise end to end" (TODO.md:460), and `plans/27`'s M3 saying the same | **Off by one.** `v0.1.0` points at `96586bf`, which predates W22 and carries no corpus, so a second tag hits `ci.yml`'s `has_fixtures=false` guard and *skips* the comparison. The oracle needs a predecessor that carries a corpus — `e26fa9d` is the first such commit. Fix in [`plans/35`](35-w26-toolchain-upgrade.md), Decision 4 |

The `04 §3.1` row is a check, not a known defect — flagged so it is looked at rather than assumed.

**The fifth row was found by this unit's own pull request**, which is the cleanest possible
demonstration of it: a `plans/`-only PR saw the `engine` check report **pass in 22s**. Under the
filter TODO.md describes, that job would not have run at all. `git log -S 'paths:' --
.github/workflows/ci.yml` returns nothing, confirming the filter was reverted during W23's
development and never committed — but W23's TODO.md text (written earlier in that branch, commit
`72391f3`) was never updated to match and survived the squash into `e26fa9d`.

Worth noting *why* this one matters beyond tidiness: TODO.md's W23 done-criteria include "it does
not run on documentation-only changes," and read against the described-but-absent filter, a
reviewer would conclude the criterion is unmet every time `engine` reports on a docs PR. The
criterion **is** met — just by a different mechanism than the entry claims.

---

## Decisions

### 1. One unit, not six

Justified above: six near-identical small PRs cost six reviews to make one coherent statement.
The counter-argument — that a batched doc PR is harder to review — is weaker here than usual
because every item is *additive prose describing already-tested code*, and each carries a named
test or source line as its evidence. There is no behaviour to disagree about.

### 2. Codify the shapes as they are; do not improve them

Items 1–3 write down what the code does. Two of them (the `StateChange` shapes) are conventions
this project *invented*, and there is a real temptation to fix them while they are in hand —
`op: "set"` for a coalesced batch of increments is arguably lossy, and a bare-string
`reason: "achievement_unlocked"` is arguably too weak for a kind-agnostic store to key on.

**Both are out of scope.** Changing either is a behaviour change with a replay-corpus
consequence (`StateChange` flows into `AdvanceResult`), which makes it a code unit with its own
done-criteria, not a doc pass. Codifying first is also what makes a later change *reviewable* —
a diff against a stated contract, rather than a diff against a convention nobody wrote down.
If either shape should change, it becomes a Tranche B unit with the corpus regenerated
deliberately per `07-replay.md` §7.

### 3. Fix the stale TODO entries here rather than in a housekeeping commit

`plans/33` Decision 1 in full. Short version: three of the four are stale *because a contract
document is also silent or wrong*, so fixing the checkbox alone relocates the defect instead of
removing it.

### 4. `04-core.md` §12 takes all three conventions, not §17 (Identifier Conventions)

§17 was considered — `<kindId>.reason.<code>` is arguably an identifier convention. Rejected:
all three items are about **reason codes, state changes and messages**, which is exactly §12's
title and existing content, and the two `StateChange` shapes have no home but §12. Splitting
one of three across sections would make the namespace collision with 05 §9 harder to state in
one place, which is the point of item 3.

---

## Done-When

- `04-core.md` §12 states the `achievement_unlocked` and `consequence_applied` `StateChange`
  shapes, each matching the code exactly (including `visible`), with the coalescing rule.
- §12 states the `<kindId>.reason.<code>` convention and distinguishes it from 05 §9's
  `kind.<kindId>.*` event namespace.
- §18 carries the `Condition` shape inline; the `games/…` citation remains as provenance only.
- 03 §9's `unlockedAchievements` comment agrees with §7 and with `view.ts`.
- The doc-tree numbering item is closed in `OPEN-QUESTIONS.md` §2 with its reason.
- All six stale TODO.md entries are corrected, each citing the code or plan that proves it.
- `./docs.ps1 -BuildOnly` passes — both Docusaurus link checks are `'throw'` and
  `build/Test-Documentation.ps1` is the second gate.
- **No file under `src/engine/` is modified.** If any item appears to require a code change,
  that item is wrong and gets re-scoped rather than implemented here.

---

## Explicitly Not In Scope

- **Any behaviour change.** See Decision 2. The replay corpus must be byte-unchanged; if it
  moves, something in this unit was not doc-only.
- **The remaining six *Known Open Items*** — `SessionHost`/`createSessionLayer` (gated on a
  second `SessionStore` implementation), the migration mechanism (its own Tranche B unit), the
  `wisdom` attribute and the provisional simulation numbers (both belong with the simulation
  kind), the dev-dependency advisories (W26), and the `docs-template` findings (a PR against
  the template repo).
- **`10-simulation-kind.md`** — that is W25, and it depends on this unit landing first.
- **Renumbering or reordering any spec document.** Numbering is positional; `docs/sidebar.ts`
  makes reordering free but inserting is not, and nothing here needs either.
