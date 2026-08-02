# W42 — The World-Graph Runtime-State Contract

**Unit:** [`docs/docs/engine/TODO.md`](../docs/docs/engine/TODO.md) — *Depth: Sun Trap*, the
W42 checkbox.

**Scope:** Replace `12-world-graph-kind.md` §3's eleven-field sketch of
`WorldGraphKindState` with the complete, authoritative runtime-state contract — every type it
names, fully specified, reconciled against `SubZeroDev.SunTrap`'s own draft and against this
engine's determinism and envelope rules. **Doc-only. No code, no `src/engine` change.**

**Depends on:** Nothing. Four decisions owned by Sun Trap were thought to bear on it, two of
them blocking — **none of them does.** Three are settled by rules this contract already owns,
and the fourth is W43's. See *The Four Gates, and Why None of Them Blocks*. This unit can be
executed end to end today.

**Programme:** [`plans/39-world-graph-kind-programme.md`](39-world-graph-kind-programme.md),
the first of three contract units.

**Companion gate:** `SubZeroDev.SunTrap`'s **M2 — World Graph Types and Kind Skeleton**, whose
first task is "define authoritative map, entity, finance and world-state types." This unit is
the specification half of that; W45 is the code half.

---

## Handoff — Start Here

This section is the whole brief for whoever executes this unit, including an agent starting
cold.

### The prompt

Paste this to start the unit. It carries only what an agent cannot read off the branch — where
to work, and that nothing is waiting on an answer. Everything else it needs is below.

```text
Implement W42 on branch feature/w42-world-graph-state-contract. Start with
plans/42-w42-world-graph-state-contract.md; its "Handoff — Start Here" section is your
brief.

First, check whether the branch is current: if `git log origin/main..HEAD` shows main
has moved ahead, merge origin/main into the branch before starting. Do not rebase.

Nothing blocks: all four Sun Trap gates are resolved in the plan's Decisions. Sequence
step 2 sends a message that informs rather than asks — do not wait for a reply.

Doc-only. The only files that may change are docs/docs/engine/12-world-graph-kind.md,
docs/docs/engine/OPEN-QUESTIONS.md, and — for the reducer-count fix in step 9 only —
docs/docs/engine/TODO.md and plans/39-world-graph-kind-programme.md. Do not open the PR
until Done-When is satisfied.
```

> **Why the prompt asks rather than asserts.** It used to say "it is already synced with
> main — do not rebase," which was true when written and false twice within the same day,
> because another branch kept merging. A claim about a moving branch has a shelf life; an
> instruction to *check* does not. The same reasoning applies to any figure or state a prompt
> hard-codes.

**Read in this order:** [`CLAUDE.md`](../CLAUDE.md) (project conventions — they override your
defaults), [`agent.md`](../agent.md), `docs/docs/engine/12-world-graph-kind.md` in full
(especially §3, §5, §9 and §17), then `SubZeroDev.SunTrap/docs/docs/design/content-and-systems.md`
§§2–9, then the rest of this plan.

**Then work the *Sequence* below until every *Done-When* box is satisfied.** The *Decisions*
section says why each choice was made; if you think one is wrong, say so and stop.

**This is a doc-only unit.** The files that change are
`docs/docs/engine/12-world-graph-kind.md`; `docs/docs/engine/OPEN-QUESTIONS.md` if a genuinely
open question surfaces; and `docs/docs/engine/TODO.md` plus
[`plans/39-world-graph-kind-programme.md`](39-world-graph-kind-programme.md) for the
eight-versus-nine reducer correction in Sequence step 9, and for nothing else. If you find
yourself editing `src/engine/`, stop — that is W45.

### Where to work

**Commit onto `feature/w42-world-graph-state-contract` — the branch this plan is already on.
Do not create a new branch.** That branch exists to carry this unit end to end: the plan
first, the contract edits on top, one PR at the end covering both. If `git branch --show-current`
says anything else, switch before you start.

This differs from the previous unit deliberately. W41 was planned and implemented as two
separate PRs; this one is a single branch, so the plan and what it produced stay reviewable
together.

### Working rules that are easy to violate here

- **Stage by explicit named path.** Never `git add -A`, `git add .`, or a bare directory —
  and be aware other work may be in flight on adjacent branches in this repository.
- **Do not merge, and do not open the PR until the unit is done.** The branch accumulates;
  the PR comes once *Done-When* is satisfied. Report check outcomes and leave the merge to
  the repository owner.
- **Verify with the doc gate**, from the repository root, and do not claim it passed if it
  did not run:
  ```bash
  ./build/Test-Documentation.ps1
  ```
- **Spec docs name `src/engine/` code by repository-root path in prose** — never a relative
  traversal, never a markdown link. `docs/` is the whole Docker build context, so a relative
  link out of it resolves to nothing and fails the production build.
- **Numbering is positional.** Adding a §3.2 renumbers nothing, but inserting a section
  *between* existing ones rewrites every cross-reference. Prefer appending.

### The one way to do this wrong

**Treating this as transcription.** `plans/39` sized W42 as a port of an existing draft, and
that sizing is materially wrong — six of the types `WorldGraphKindState` transitively needs
are defined in *neither* repository, and one is internally inconsistent between Sun Trap's own
two documents. Copying `content-and-systems.md` §§2–9 into §3 and calling the unit done would
leave a contract that still cannot be compiled against. *Current State* below has the
evidence; treat this as design work with a strong draft to start from.

---

## Why This Is Not the Port `plans/39` Called It

`plans/39`'s split table describes W42 as:

> `ResortMap`, `Guest`, `Building`, `Queue`, `Staff`, `ConstructionSite`, `Finances`, `Loan`
> — ported into `12-world-graph-kind.md` §3, replacing today's top-level-only sketch

Those eight types are indeed drafted and near-ready. But `WorldGraphKindState` names **eleven**
fields, and the transitive closure of what §3 must specify is larger than the eight. Measured
against both repositories, six types in that closure do not exist anywhere, and Sun Trap's own
two design documents disagree about the field sets of two more (`GuestOpinions` and
`GuestConditions`).

This is the same class of finding as `plans/36`'s own Finding — where `10-simulation-kind.md`
§14's table accounted for two of ten types and understated the port by roughly half. It is
worth stating at plan level because it changes what "done" means for this unit, and because
the same optimistic sizing has now happened twice.

---

## Current State (measured, not recalled)

Verified against `12-world-graph-kind.md` at `4120525` and `SubZeroDev.SunTrap` at `7a145df`.

### What §3 declares today

```typescript
interface WorldGraphKindState {
  tick: number;
  map: ResortMap;
  finances: Finances;
  buildings: readonly Building[];
  constructionSites: readonly ConstructionSite[];
  guests: readonly Guest[];
  staff: readonly Staff[];
  incidents: readonly Incident[];
  objectives: readonly ObjectiveProgress[];
  alerts: readonly Alert[];
  nextEntityOrdinal: number;
}
```

Eleven fields, ten referenced types, **zero of which §3 defines**. The section's own status
line says "Revision 1 — the seam only," so this is by design, not neglect; W42 is where it
stops being true.

### Six types are defined in neither repository

| Type | Referenced by | Defined in engine? | Defined in Sun Trap? |
|---|---|---|---|
| `Incident` | `WorldGraphKindState.incidents` | **No** | **No** |
| `ObjectiveProgress` | `WorldGraphKindState.objectives` | **No** | **No** |
| `Alert` | `WorldGraphKindState.alerts` | **No** | **No** |
| `TerrainCell` | `ResortMap.terrain` | **No** | **No** (referenced by its own draft) |
| `PathCell` | `ResortMap.paths` | **No** | **No** (same) |
| `Zone` | `ResortMap.zones`, `Staff.assignedZoneId` | **No** | **No** (same) |

Verified by searching both documentation trees for `interface <T>` / `type <T>`. Each is
referenced and never declared. `Alert` in particular is *argued for* in §3 — "an alert
persists until dismissed and dismissal is a player action" — and `dismiss_alert` is a real
action in §6 with `alertId` as its parameter, so the type is load-bearing in three places and
specified in none.

### Sun Trap's own two documents disagree about `GuestOpinions`

`content-and-systems.md` §4 types it with **seven** fields:

```typescript
interface GuestOpinions {
  price: number; variety: number; cleanliness: number; safety: number;
  attractiveness: number; queues: number; service: number;
}
```

`game-design.md` §3.2 says guests evaluate **ten**: the seven above plus *staff behaviour*,
*accessibility* and *noise*. Neither document acknowledges the other. `content-and-systems.md`
is the more specific and defers to the engine contract on disagreement, but it does not claim
precedence over `game-design.md` — so this is a real question for the unit to put to Sun Trap
rather than silently resolve by picking the shorter list.

**`GuestConditions` disagrees the same way, and is easy to miss because the gap is one field.**
`content-and-systems.md` §4 types **six** — drunkenness, sunburn, headache, nausea, injury,
anger. `game-design.md` §3.1 lists **seven** potential conditions: those six plus *confusion*.
Same shape of disagreement, same silence in both directions. Put it in the same question, not
a second one.

> **One test does cut through both, and it is worth applying before asking.** A field that no
> system in §4 updates, no reason code in §11 reads and no projection in §10 carries is not
> state — adding it to `serialize()` output is how the `rng` and `totalTimeCost` defects
> happened. If the extra opinions and *confusion* fail that test today, say so when asking:
> the question becomes "is a system coming for these, or are they design vocabulary?", which
> is far easier to answer than "seven or ten?".

### Two structural questions the draft does not answer

**1. Do departed guests ever leave the array?** `GuestLifecycle` includes `"departed"` and
`"removed"` and nothing anywhere states whether such guests are pruned from
`WorldGraphKindState.guests`. If they are not, state grows without bound across a scenario —
and §13 already establishes that this kind's volume is the thing that breaks naive
assumptions ("a 360-tick batch with 500 guests emits on the order of 10⁵ `trace` events").
Every departed guest also carries `path`, `needs`, `conditions`, `opinions` and `preferences`,
so the per-guest cost is not small. A serialized save is `serialize()` output, so unbounded
growth is a determinism-adjacent correctness concern, not merely a performance one.

**2. When does "today" reset?** `Finances` carries `revenueTodayCents` and
`expensesTodayCents`, but §3 is explicit that the clock collapses to `tick` alone and that day
and hour are *derived on read* from `ticksPerMinute`. So "today" is a derived boundary applied
to a stored accumulator, and nothing states which tick resets it. That is precisely the
disagreement-between-a-value-and-what-it-summarises that §3's own clock rule exists to
prevent. **Answered in Decision 7** — the accumulators stay, and the boundary is defined
without needing the tick duration Sun Trap has not confirmed.

### Four more defects, in the draft and in this contract

Found while reconciling W41's status against the same two documents. None blocks on Sun Trap;
all four are this repository's to fix.

**1. `Queue` records its containment twice.** `content-and-systems.md` §5 nests
`queue: Queue` **inside** `Building`, and `Queue` declares both its own `id` (`"q:<ordinal>"`)
and `buildingId: string`. A queue nested in `b:3` whose `buildingId` says `b:7` is
representable and nothing can adjudicate it — the same objection §3 already makes to a
persisted `rng` and `10 §2` makes to `totalTimeCost`, one level down: duplication *inside*
`kindState` rather than against the envelope.

Drop `buildingId`; keep `Queue.id`, because `Guest.queueId` needs a referent and §9's ordinal
rule names queues. Lifting queues into a twelfth top-level collection is the other available
fix and is worse — a queue has no independent lifecycle, so it would buy a referential-
integrity check and nothing else. `Guest.queueId` is **not** the same problem: a guest is not
contained by a queue, so the reference is the only record of the relationship.

**2. `dismiss_alert` is missing from §4's action split, and the undercount has spread.** §4
lists eight actions that mutate without advancing time; §6's table lists **nine** — the same
eight plus `dismiss_alert`, which §3's own `alerts` callout requires ("an alert persists until
dismissed and dismissal is a player action"). §4 is the stale one. The undercount has since
been copied into `plans/39`'s W45 row and `TODO.md`'s W45 bullet ("the eight no-time-passes
reducers"). This unit is where it gets fixed, because this unit is what gives `Alert` a type
for `dismiss_alert` to operate on.

**3. Three open-keyed records need the N6 reconciliation, not a copy-paste.**
`Guest.preferences`, `Building.pricesCents` and `Building.inventory` are all
`Readonly<Record<string, number>>`, and `02-architecture.md` N6 bans the loose bag. `10 §6.2`
already answered this for `ActorState`'s `skills`/`reputation`/`flags`/`counters`: a record
whose **keys are declared by validated content** is not a loose bag, because Tier 1 closes the
key set at load. That argument transfers here — product ids and archetype preference keys are
content-declared — but it has to be *written*. An unexamined `Record<string, number>` is
indistinguishable on the page from the thing N6 bans. Reuse `10 §6.2`'s wording rather than
re-deriving it.

**4. Most of these fields are out of the MVP, and nothing says which.** `mvp.md` §3 scopes
guests to two needs (thirst, toilet) and one opinion (price); §4 puts groups, loans, staff
fatigue, multiple archetypes and complex inventory out of scope. The drafted types carry all
of it — seven needs, seven opinions, `Guest.groupId`, `Finances.loans`, `Staff.fatigue`.

Specify all of them: the `simulation` precedent is unambiguous, since W32–W35 ported the whole
upstream contract far beyond what "Stable Life" ever used. But **mark the MVP-inert ones at
the field**, so W45–W47 know what may stay inert without it reading as an omission. At the
field, not in a separate table that will drift from the fields it describes.

### What is already correctly reconciled — do not re-litigate

Three things in Sun Trap's draft are already right against this engine's rules, and the unit
should preserve rather than revisit them:

- **`Guest.drawCount` / `Staff.drawCount`** implement §5's rule 3 exactly — agent-level draws
  keyed `{ kind: "agent", agentId, seq }` with `seq` being the agent's own counter, never the
  action seq. This is what makes batch invariance hold.
- **`Guest.path` is state, not cache**, and distance fields are explicitly excluded — matching
  §9's "derived caches are never serialized" while keeping a committed route stable.
- **Money is integer cents throughout**, and `Loan.interestBasisPoints` is integer basis
  points rather than a float rate — matching §9's integer-arithmetic rule.

---

## The Four Gates, and Why None of Them Blocks

Sun Trap's implementation programme lists four decision gates "Before M2", **all four still
unchecked** (verified directly). An earlier revision of this plan treated two as blocking. On
re-reading, they are not — because each turns out to be a question this contract's own rules
already answer, not a question about what the game should be.

| Sun Trap gate | Status here |
|---|---|
| "Decide how building entrances are authored" | **Settled — Decision 5.** Absolute entrances are a derived value; §3's own rule bans those from state. The field leaves `Building` entirely, which makes the authoring question W43's |
| "Decide whether MVP building rotation is `0` only or all four contract rotations" | **Settled — Decision 2.** Declare all four; Tier 1 narrows per scenario. The answer cannot change the seam |
| "Confirm one tick's provisional simulated duration" | **Settled — Decision 7.** The *number* is balance and stays Sun Trap's; the *reset rule* is a pure function of `tick` and campaign data, so the boundary is definable without it |
| "Fix the authored content-id convention" | W43's problem, and always was |

**This is not overruling the companion.** `plans/39`'s non-goals hold: field *detail* and
balance stay Sun Trap's. What moved is the boundary — three of these read as content-design
questions and are actually applications of rules the engine already owns (derived values stay
out of state; the seam is specified permissively where an answer cannot change it). Deciding
them here is this repository doing its own job, not answering for the game. Where a genuine
game-design answer is still wanted it is recorded as a question, not as a blocker.

---

## Sequence

**1 — Inventory before writing.** Produce the field-by-field list of everything §3 must
specify: the eight drafted types, the six undefined ones, and every nested type they reach.
Confirm nothing else is transitively required.

**2 — Write to Sun Trap once, to inform rather than to ask.** Nothing here waits on a reply
(*The Four Gates*). Send one message stating what was concluded and why: entrances leave
runtime state as derived (Decision 5), the opinion and condition "disagreements" resolve as
stored-versus-evaluated (Decision 6), the day boundary is defined without the tick duration
(Decision 7), and rotation is declared permissively (Decision 2). Two things genuinely remain
theirs — what an authored entrance offset looks like (W43) and the value of `ticksPerDay`
(balance). **Do not block on the reply.** If one arrives and contradicts a decision, that is a
follow-up commit, not a reason to stall.

**3 — Port the eight drafted types into §3**, adjusted only where an engine rule requires it,
with each adjustment stated rather than silently applied. Four adjustments are already known
and decided: use the engine-owned `WorldMap` name (Decision 4), `Queue.buildingId`
dropped, the three open-keyed records reconciled against N6 in `10 §6.2`'s wording, and
MVP-inert fields marked at the field.

**4 — Design the six undefined types.** `Incident`, `ObjectiveProgress`, `Alert`,
`TerrainCell`, `PathCell`, `Zone`. Ground each in what already references it — `Alert` in
§3's persistence argument and §6's `dismiss_alert`; `ObjectiveProgress` in §8's `outcome()`
returning `objectivesMet`/`failureId` as published ids; `Incident` in `game-design.md` §11's
eight named incident types.

**5 — Answer the two structural questions in the contract**, with the reasoning stated:
guest pruning and the `revenueTodayCents` boundary.

**6 — Specify `WorldGraphView` and terminal-outcome data.** §10 fixes the projection's
*rules* — what never crosses, what is carried — but declares no type. §8 already declares
`outcome()`'s return shape; check it against the now-specified `ObjectiveProgress` and
reconcile if they disagree.

Check the view field by field against 04 §6's `Scene` and 04 §9's `PlayerView` before calling
it done. `CLAUDE.md`'s envelope-duplication ledger has five entries and **entry 3 is a view** —
`StoryGraphView` duplicating scene and status fields — so this is the first view written since
that lesson was recorded, and the ledger's own note says the defect "recurs on the *view* side
too."

**7 — State the collection rules.** Which collections are arrays versus records, and their
canonical iteration order, per §9's "iteration order is canonical, not insertion order" and
"every tie has an explicit rule, and the rule is the entity id." Note explicitly that `Queue`
and `StaffTask` are entities with ordinal ids that live *nested* inside their parents rather
than in top-level collections — true in the draft and easy to lose.

**8 — Update §3's status line.** "Revision 1 — the seam only" stops being accurate the moment
this merges; say what it now is.

**9 — Land the `dismiss_alert` correction and its two copies.** Add `dismiss_alert` to §4's
action split, and fix `plans/39`'s W45 row and `TODO.md`'s W45 bullet from eight reducers to
nine. Three one-line edits; they belong here because this unit is what gives `Alert` a type.
`TODO.md` and `plans/39` are the only files outside `12-world-graph-kind.md` and
`OPEN-QUESTIONS.md` this unit may touch, and only for this.

---

## Decisions

### 1. Separate what is genuinely the game's from what only looks like it

`12-world-graph-kind.md` §17 puts field *detail* and balance with the game, and `plans/39`'s
non-goals say this programme does not direct the companion. That still holds. What an earlier
revision of this plan got wrong was the *scope* of it: four questions were filed as Sun Trap's
and two as blocking, when three of them turn out to be applications of rules this contract
already owns — derived values stay out of state, and a seam is specified permissively where an
answer cannot change it. Decisions 5, 6 and 7 settle those.

The test to apply before filing anything as theirs: **would a different answer change what the
engine is allowed to store, or only what the game contains?** The first is this repository's;
the second is Sun Trap's. Entrances read like the second and were the first. `ticksPerDay`'s
*value* is genuinely the second.

So the rule is not "ask about everything," and it is not "decide everything." It is: decide
what the contract's rules decide, ask about what is genuinely content, and never let the two
be confused — in either direction.

### 2. Specify the engine-side shape permissively where the answer does not change the seam

Rotation is the clean case: declaring `0 | 90 | 180 | 270` costs nothing if the MVP only ever
authors `0`, and Tier 1 validation is where a scenario narrows it.

Entrances looked like the opposite case and were filed as blocking on exactly that reading —
absolute versus footprint-relative changes what the field *means*. Decision 5 dissolves it
instead: the field is derived and leaves state altogether, so neither answer applies. Apply
this distinction deliberately rather than treating every open question as equally blocking —
and check first whether the field should exist at all, which is the cheaper question.

### 3. The six undefined types are designed here, not deferred to W45

The temptation is to leave `Incident`/`Alert`/`ObjectiveProgress` as `unknown` and let the
implementation unit settle them. That is exactly what `plans/39` Decision 1 forbids and what
`10-simulation-kind.md`'s own history argues against: `AvailabilityRule.condition` shipped as
`unknown` in W36 and had to be narrowed later in W38, and the intervening code was written
against a type that could not be checked. Design them now, while the cost is a paragraph.

### 4. `WorldMap` is the engine-owned map name

`12-world-graph-kind.md` §1 rejects the name `management-simulation` on the explicit grounds
that *"a colony sim, an ecosystem model or a transport network would run on this identical
kind."* A type called a resort-specific map name in engine-owned code contradicts that argument in the most
visible place it could — the state interface. Both built kinds use structural names (`Node`,
`Choice`; `ActorState`, `PlayerState`), never themed ones.

`Guest`, `Staff` and `Building` **stay.** They name structural roles this kind actually
models — an autonomous visitor who arrives with needs and departs, an employee the player pays
and assigns, a placed structure with a footprint — and they read correctly for a colony or a
transport network. `Resort` names a *theme*; the other three name *roles*.

**Do this on the first pass, not as a follow-up.** Right now it is a find-and-replace in one
document. After §3 is written it is a rewrite of the section; after W45 it is a change across
a kind, its fixtures and its replay corpus. It is also not Sun Trap's call to make — §17 gives
the game design authority over field *detail*, not over what this repository names its own
engine-owned types.

### 5. `Building.entrances` is removed from runtime state

The gate asked whether entrances are authored absolutely or as footprint-relative offsets. The
contract answers a prior question first: **an entrance position is derived** — `position` +
`footprint.rotation` + the definition's authored offsets — and §3's own clock callout bans
derived values from serialized state, *"they can disagree with what they summarise, and the
disagreement is unresolvable."* An absolute `entrances` array is the same defect as the
persisted `rng` it sits four fields away from.

So the field leaves `Building`. Authored offsets live on `BuildingDefinition` (**W43**), are
footprint-relative, and are rotated on read. State the rotation transform in §3 anyway, even
though the offsets themselves are W43's: rotating an integer offset is a determinism concern,
and leaving it to be re-derived per call site is how two call sites end up disagreeing.

Storing relative offsets on the instance is the third option and is also declined — it copies
the definition into every placed building, so a definition edit and its instances can diverge.

**This is what unblocks the unit.** The remaining question — what an authored offset looks
like — is real, and it is W43's, where a `BuildingDefinition` exists to hold it.

### 6. Stored opinions are not evaluated opinions

`game-design.md` §3.2 says guests *evaluate* price, variety, cleanliness, safety,
attractiveness, queue length, service quality, staff behaviour, accessibility and noise.
`content-and-systems.md` §4 types **seven** of those as `GuestOpinions`. Read as a
contradiction, it needs Sun Trap to adjudicate. Read carefully, **it is not one**: evaluating
is something the utility model does at decision time from world state, and it does not require
the guest to carry a field. A guest can weigh noise without storing a `noise` opinion.

So: `GuestOpinions` is the drafted **seven** — the slowly-changing impressions a guest
accumulates and carries between decisions. The other three are **evaluation inputs** to the
utility model, which is **W44**'s subject, not §3's. Same for `GuestConditions`: the drafted
six are state; `confusion` is either an evaluation input or a transient the pipeline computes.

Both documents are then right about different things, which is a better outcome than one of
them losing. Record the three-plus-one in `OPEN-QUESTIONS.md` with the condition that would
admit them to state: a system in §4 that *writes* the value between ticks. Until then, a field
no system writes is not state — see the consumer test in *Current State*.

Still worth telling Sun Trap what was concluded and why. As information, not as a gate.

### 7. The "today" boundary is a pure function of `tick`, so the tick duration does not gate it

`Finances.revenueTodayCents` / `expensesTodayCents` are genuine accumulators — today's revenue
cannot be recovered from cash — so unlike entrances they stay. What was missing is *when* they
reset, and the gate assumed that needed the confirmed simulated duration of a tick.

It does not. The reset is **the first tick of a new day**, where the day is
`floor(tick / ticksPerDay)` and `ticksPerDay` is campaign data. That is a pure function of
`tick` plus the campaign, needs no stored day field, and keeps §3's rule that the clock
collapses to `tick` alone. The *value* of `ticksPerDay` is balance and stays Sun Trap's; the
rule does not depend on it.

### 8. `history` stays out, restated not reopened

§3 already declines a `history` field, for the reason `10-simulation-kind.md` §2 gives —
it overlaps `StateChange[]` and the event stream, and three records of the same events is what
the duplication rule exists to prevent. The audit in this unit will make the absence
conspicuous; it is deliberate.

---

## Done-When

- [ ] §3 specifies every type `WorldGraphKindState` names, and every type those reach.
- [ ] The six previously-undefined types (`Incident`, `ObjectiveProgress`, `Alert`,
      `TerrainCell`, `PathCell`, `Zone`) each have a full shape and a stated purpose.
- [ ] `GuestOpinions` is the seven stored impressions and `GuestConditions` the six, with §3
      stating the stored-versus-evaluated distinction that makes both Sun Trap documents right
      (Decision 6); the three extra opinions and `confusion` are in `OPEN-QUESTIONS.md` with
      the condition that would admit them — a §4 system that writes the value.
- [ ] `Building` has no `entrances` field, §3 states the rotation transform for authored
      offsets, and the authoring shape is forward-referenced to W43 (Decision 5).
- [ ] The `revenueTodayCents` / `expensesTodayCents` reset is defined as the first tick of a
      new day via `floor(tick / ticksPerDay)`, with no stored day field (Decision 7).
- [ ] The contract and plan use the engine-owned `WorldMap` name (Decision 4).
- [ ] `Queue` has no `buildingId`, and `Guest.queueId` still resolves.
- [ ] The three open-keyed records (`Guest.preferences`, `Building.pricesCents`,
      `Building.inventory`) carry the N6 reconciliation in `10 §6.2`'s wording, not a fresh
      derivation.
- [ ] MVP-inert fields are marked at the field, per `mvp.md` §4.
- [ ] `dismiss_alert` appears in §4's action split, and `plans/39`'s W45 row and `TODO.md`'s
      W45 bullet say nine reducers rather than eight.
- [ ] Guest pruning is answered in the contract, with the unbounded-growth reasoning stated.
- [ ] Every collection's canonical iteration order is stated, and the nested-entity cases
      (`Queue`, `StaffTask`) are called out explicitly.
- [ ] `WorldGraphView` is declared, reconciled against §8's existing `outcome()` shape, and
      checked field by field against 04 §6's `Scene` and 04 §9's `PlayerView` so it repeats
      neither — the sixth check against `CLAUDE.md`'s envelope-duplication ledger, and the
      second on the view side.
- [ ] Every integer/units/range/nullability question in the ported types is answered — no
      bare `number` whose scale a reader has to guess.
- [ ] §3's "the seam only" status line is updated.
- [ ] Anything genuinely left open is in `OPEN-QUESTIONS.md` with a stated *revisit when*,
      not left implicit.
- [ ] `./build/Test-Documentation.ps1` passes; `git diff --check` is clean; no `src/engine`
      file changed.

---

## Explicitly Not In Scope

- **No code.** Not one file under `src/engine/`. `WorldGraphKindState` becomes real
  TypeScript in W45, against this contract.
- **No content-definition types.** `GuestArchetypeDefinition`, `BuildingDefinition`,
  `ScenarioDefinition` and the rest are W43. The boundary is the one §3 already draws:
  *runtime state* here, *campaign data* there. `Building.definitionId` is in scope; what a
  `BuildingDefinition` contains is not.
- **No resolution or systems detail.** The 20-system pipeline, utility scoring, pathfinding
  cost model and tie-break rules are W44 — even though this unit will be tempted, because
  specifying `Guest.intent` invites specifying how an intent is chosen. State the shape; leave
  the algorithm.
- **No changes to `SubZeroDev.SunTrap`.** What goes to that repository is the Sequence step 2
  message — what this contract concluded and why, plus the two things still genuinely theirs
  (the authored entrance-offset shape, and `ticksPerDay`'s value). Its answers, and any edit
  retiring `content-and-systems.md` §§2–9 in favour of this contract, are its own commits.
- **No balance numbers.** Need decay rates, patience thresholds, utility weights and prices
  are balance, revisited every playtest (§17), and belong to the game.
