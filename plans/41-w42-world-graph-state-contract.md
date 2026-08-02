# W42 — The World-Graph Runtime-State Contract

**Unit:** [`docs/docs/engine/TODO.md`](../docs/docs/engine/TODO.md) — *Depth: Sun Trap*, the
W42 checkbox.

**Scope:** Replace `12-world-graph-kind.md` §3's eleven-field sketch of
`WorldGraphKindState` with the complete, authoritative runtime-state contract — every type it
names, fully specified, reconciled against `SubZeroDev.SunTrap`'s own draft and against this
engine's determinism and envelope rules. **Doc-only. No code, no `src/engine` change.**

**Depends on:** Nothing in this repository. Four decisions **owned by Sun Trap** bear on it —
see *Blocked On Someone Else's Decisions* — and two of them must land before this unit can
finish honestly.

**Programme:** [`plans/39-world-graph-kind-programme.md`](39-world-graph-kind-programme.md),
the first of three contract units.

**Companion gate:** `SubZeroDev.SunTrap`'s **M2 — World Graph Types and Kind Skeleton**, whose
first task is "define authoritative map, entity, finance and world-state types." This unit is
the specification half of that; W45 is the code half.

---

## Handoff — Start Here

This section is the whole brief for whoever executes this unit, including an agent starting
cold.

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
two design documents disagree about a seventh.

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
prevent.

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

## Blocked On Someone Else's Decisions

Sun Trap's implementation programme lists four decision gates "Before M2", **none currently
checked**, and two of them determine field shapes this unit must specify:

| Sun Trap gate | What it decides here |
|---|---|
| "Decide how building entrances are authored" | `Building.entrances: readonly Position[]` — authored absolutely, or as footprint-relative offsets rotated with the building? |
| "Decide whether MVP building rotation is `0` only or all four contract rotations" | Whether `Footprint.rotation` is the full `0 \| 90 \| 180 \| 270` union or MVP-narrowed |
| "Confirm one tick's provisional simulated duration" | Bears on the `revenueTodayCents` reset boundary above |
| "Fix the authored content-id convention" | W43's problem, not this unit's |

**These are Sun Trap's to answer, not this repository's** — `plans/39`'s non-goals are
explicit that this programme does not direct the companion. The unit's job is to *ask them
precisely*, and to specify the type so that the engine-side shape is correct under either
answer where that is possible (rotation: declare all four, let content and Tier 1 validation
narrow) and to block only where it genuinely is not (entrances: absolute versus relative
changes what the field means, and guessing wrong makes every placement test wrong).

---

## Sequence

**1 — Inventory before writing.** Produce the field-by-field list of everything §3 must
specify: the eight drafted types, the six undefined ones, and every nested type they reach.
Confirm nothing else is transitively required.

**2 — Raise the questions with Sun Trap in one pass.** The `GuestOpinions` 7-vs-10 and
`GuestConditions` 6-vs-7 disagreements (one question, not two), the two structural questions,
and the four M2 gates. One message — they are all "what did you mean" questions and answering
them together is cheaper for the person answering. Apply the consumer test when asking, so
each is answerable rather than open-ended. Record answers in this plan.

**3 — Port the eight drafted types into §3**, adjusted only where an engine rule requires it,
with each adjustment stated rather than silently applied. Four adjustments are already known
and decided: `ResortMap` → `WorldMap` (Decision 4 — do it on this pass), `Queue.buildingId`
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

### 1. Ask Sun Trap; do not resolve their questions unilaterally

The `GuestOpinions` disagreement and the M2 gates are content-design questions, and
`12-world-graph-kind.md` §17 puts field *detail* with the game. Picking the seven-field list
because it is already typed would silently overrule `game-design.md`, which is the document
describing what the game is *for*. Ask, wait, record.

### 2. Specify the engine-side shape permissively where the answer does not change the seam

Rotation is the clean case: declaring `0 | 90 | 180 | 270` costs nothing if the MVP only ever
authors `0`, and Tier 1 validation is where a scenario narrows it. Entrances are the opposite
case — absolute versus footprint-relative changes what the field *means*, so it blocks. Apply
the distinction deliberately rather than treating every open question as equally blocking.

### 3. The six undefined types are designed here, not deferred to W45

The temptation is to leave `Incident`/`Alert`/`ObjectiveProgress` as `unknown` and let the
implementation unit settle them. That is exactly what `plans/39` Decision 1 forbids and what
`10-simulation-kind.md`'s own history argues against: `AvailabilityRule.condition` shipped as
`unknown` in W36 and had to be narrowed later in W38, and the intervening code was written
against a type that could not be checked. Design them now, while the cost is a paragraph.

### 4. `ResortMap` is renamed `WorldMap` — and this one cannot wait

`12-world-graph-kind.md` §1 rejects the name `management-simulation` on the explicit grounds
that *"a colony sim, an ecosystem model or a transport network would run on this identical
kind."* A type called `ResortMap` in engine-owned code contradicts that argument in the most
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

### 5. `history` stays out, restated not reopened

§3 already declines a `history` field, for the reason `10-simulation-kind.md` §2 gives —
it overlaps `StateChange[]` and the event stream, and three records of the same events is what
the duplication rule exists to prevent. The audit in this unit will make the absence
conspicuous; it is deliberate.

---

## Done-When

- [ ] §3 specifies every type `WorldGraphKindState` names, and every type those reach.
- [ ] The six previously-undefined types (`Incident`, `ObjectiveProgress`, `Alert`,
      `TerrainCell`, `PathCell`, `Zone`) each have a full shape and a stated purpose.
- [ ] The `GuestOpinions` 7-vs-10 and `GuestConditions` 6-vs-7 disagreements are resolved by
      Sun Trap's answer, and §3 records which document was authoritative and why.
- [ ] `ResortMap` appears nowhere in the document; `WorldMap` does (Decision 4).
- [ ] `Queue` has no `buildingId`, and `Guest.queueId` still resolves.
- [ ] The three open-keyed records (`Guest.preferences`, `Building.pricesCents`,
      `Building.inventory`) carry the N6 reconciliation in `10 §6.2`'s wording, not a fresh
      derivation.
- [ ] MVP-inert fields are marked at the field, per `mvp.md` §4.
- [ ] `dismiss_alert` appears in §4's action split, and `plans/39`'s W45 row and `TODO.md`'s
      W45 bullet say nine reducers rather than eight.
- [ ] Guest pruning is answered in the contract, with the unbounded-growth reasoning stated.
- [ ] The `revenueTodayCents` / `expensesTodayCents` reset boundary is defined against the
      tick-only clock.
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
- **No changes to `SubZeroDev.SunTrap`.** Questions go to that repository as questions; its
  answers are its own commits.
- **No balance numbers.** Need decay rates, patience thresholds, utility weights and prices
  are balance, revisited every playtest (§17), and belong to the game.
