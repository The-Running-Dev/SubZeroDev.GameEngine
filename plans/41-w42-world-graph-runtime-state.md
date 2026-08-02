# W42 — The World-Graph Runtime-State Contract

**Unit:** [`docs/docs/engine/TODO.md`](../docs/docs/engine/TODO.md) — *Depth: Sun Trap*, the
W42 checkbox.

**Scope:** Turn `12-world-graph-kind.md` §3 from a top-level sketch into the authoritative
runtime-state contract — every field of every collection `WorldGraphKindState` names, plus
`WorldGraphView` in §10. **Doc-only. No code.** The first of three contract units, mirroring
`simulation`'s W32.

**Depends on:** Nothing outstanding. W41 gave the programme its consumer boundary; this unit
touches no package surface.

**Programme:** [`plans/39-world-graph-kind-programme.md`](39-world-graph-kind-programme.md),
the first contract unit. Reaches no milestone on its own — **T1** needs W42–W44 together.

**Precedent:** `simulation`'s W32 (`plans/36`, PR #94) — same shape, same discipline: port
the drafted state types into this repository, reconcile them against the envelope, and
forward-reference the not-yet-ported content types by name rather than inventing placeholder
shapes.

---

## Handoff — Start Here

This section is the whole brief for whoever executes this unit, including an agent starting
cold. Everything it needs is in this repository or in the sibling `SubZeroDev.SunTrap`
checkout; nothing depends on a chat transcript.

**Read in this order:** [`CLAUDE.md`](../CLAUDE.md) (project conventions — they override your
defaults), [`agent.md`](../agent.md) (lessons learned the hard way here),
[`docs/docs/engine/12-world-graph-kind.md`](../docs/docs/engine/12-world-graph-kind.md) in
full, then the rest of this plan. Then read the two source documents named under *Sources*
below, in full, before writing a line — **this repository's recurring defect is editing from
memory rather than from the artifact**, and this unit is a port, which is exactly where that
defect lands.

**Then work the *Sequence* below (9 steps) until every *Done-When* box (12) is satisfied.**
The *Decisions* section says why each choice was made. If you believe one is wrong, say so
and stop — do not quietly substitute a different design.

**Trust, but re-verify.** *Current State (measured, not recalled)* and every *Finding* were
checked against both working trees at `db9c62a`, so you need not re-derive them. Do re-read
anything you are about to change.

### Sources

| Source | Holds | Repository |
|---|---|---|
| `docs/docs/design/content-and-systems.md` §§2–9 (344 lines) | The eight drafted state shapes, written to this contract's own rules and deferring to it on disagreement | `SubZeroDev.SunTrap` |
| `docs/docs/design/game-design.md` §§2–14 (330 lines) | The prose the undrafted types have to be designed from — needs, opinions, incidents, objectives, failure | `SubZeroDev.SunTrap` |
| `docs/docs/product/mvp.md` §§3–4 | What the MVP actually needs, and what is explicitly out of scope | `SubZeroDev.SunTrap` |
| `10-simulation-kind.md` §2, §6 | The house style this port must match | here |

The Sun Trap documents are **source material this kind ports from and then owns** — 12 §17
already states that relationship explicitly. They are not a second type surface maintained in
parallel, and after this unit they are stale wherever they disagree.

### Working rules that are easy to violate here

- **Stage by explicit named path.** Never `git add -A`, `git add .`, or a bare directory.
  `.gitignore`'s own comment records the near-miss this rule exists to prevent.
- **Branch off `main`; do not merge.** Open the PR, report the check outcomes, leave the
  merge to the repository owner. Auto-merge is deliberately not used.
- **Three required checks:** `engine`, `Documentation links and terminology`,
  `Verify Documentation Build`. The `engine` job reports green in ~25s on a docs-only change
  — that is the change gate working, not the suite being skipped by accident.
- **Run before pushing**, and never claim a gate passed that did not run:
  ```bash
  ./build/Test-Documentation.ps1
  ```
- **No file under `src/engine/` changes.** If you find yourself editing code, you have left
  this unit. Same rule W32–W35 held to across four units.

### Three ways to do this wrong

Each looks like a reasonable simplification and each silently destroys the point of the unit.

1. **Transcribing `content-and-systems.md` §§2–9 and calling the unit done.** Six types the
   contract *names* are declared nowhere in either repository (Finding 1). A port that stops
   at the drafted eight leaves this unit's own gate — *every runtime field read by a planned
   system has one authoritative type and one documented owner* — unreachable, and hands W45
   three collections it has to invent under implementation pressure.
2. **Copying `Readonly<Record<string, number>>` across without reconciling it.**
   `02-architecture.md` N6 bans the loose bag. W33 had to answer this exact question for
   `ActorState`'s `skills`/`reputation`/`flags`/`counters` and answered it in writing; three
   fields here need the same treatment (Finding 4). Copying it unexamined looks like a port
   and is actually an unrecorded architecture exception.
3. **Letting `WorldGraphView` repeat what `Scene` and `PlayerView` already carry.**
   `CLAUDE.md`'s envelope-duplication ledger has five entries and **entry 3 is a view**
   (`StoryGraphView` duplicating scene and status fields). This is the first view written
   since that entry was recorded. Check it against 04 §6/§9 field by field.

### Out of scope — do not do these

Content-definition types (`BuildingDefinition`, `GuestArchetypeDefinition`,
`ScenarioDefinition`, …) — that is W43, and Decision 2 of `plans/39` is explicit that
conflating the two lets the easy half's readiness disguise the hard half's size. System
behaviour, formulas, tie-break rules and pipeline ordering — that is W44. Any code. Any
change to the `SubZeroDev.SunTrap` repository.

---

## Why This Is Now Actionable, and Why It Is Interesting

`12-world-graph-kind.md` is 398 lines and its own status line says **"Revision 1 — the seam
only."** It fixes where every field lives without saying what any field is. That was the
right scope when it was written: it was reconciling a draft engine against the envelope, and
`plans/33` Decision 3 declined to size a build against design documents that did not exist.

They exist now, and the interesting part is what reading them together revealed. The
programme sized W42 as the easy contract unit — a port of eight near-code-ready interfaces,
with the *design* work quarantined in W43. That sizing is wrong in a specific, checkable way:
**six of the types this kind's own state names have no declaration in either repository**,
three of them nested inside a type that *is* drafted. The port and the design work are
interleaved, not separated by unit boundary.

This is the same failure mode `plans/36` Finding 3 caught for `simulation` — an incomplete
upstream table understating the port by half — arriving from the opposite direction. There it
was a table that omitted rows. Here it is a set of interfaces that reference types nobody
wrote. Both are only visible by reading the source rather than its summary.

---

## Current State (measured, not recalled)

Every line below was verified against both working trees at `db9c62a`.

### What `12-world-graph-kind.md` §3 has today

The envelope-reconciliation table (seven rows, the fifth entry in `CLAUDE.md`'s
duplication ledger), one `WorldGraphKindState` interface naming **eleven fields**, three
explanatory callouts (`tick` collapsing the clock, `history` not adopted, `alerts` retained),
and §3.1 `initialState`. **No nested type is declared anywhere in the document.** `ResortMap`,
`Finances`, `Building`, `ConstructionSite`, `Guest`, `Staff`, `Incident`, `ObjectiveProgress`
and `Alert` all appear only as the element type of a field.

### What Sun Trap drafts, and what it does not

`content-and-systems.md` §§2–9 declares **twenty-two** types across five clusters:

| § | Declares |
|---|---|
| 3 | `ResortMap`, `Position`, `Footprint` |
| 4 | `Guest`, `GuestLifecycle`, `GuestNeeds`, `GuestConditions`, `GuestOpinions`, `GuestIntentKind`, `GuestIntent` |
| 5 | `Building`, `Queue` |
| 6 | `Staff`, `StaffRole`, `StaffTask`, `ConstructionSite` |
| 7 | `Finances`, `Loan` |
| 9 | `UtilityComponent`, `GuestDecisionTrace` |

§2 (Clock) and §8 (Pathfinding) declare nothing — both are prose restating rules this
contract already fixes in §3 and §9. `GuestDecisionTrace` (§9) is **not state**: its own
prose says it rides the event stream and crosses the projection boundary only under a
campaign-declared transparency mode, which 12 §10 already says too.

### Six types named but declared nowhere

Verified by full-text search across all nine Sun Trap documents and this repository: every
occurrence of each name below is prose or a field type, never a declaration.

| Undeclared type | Named by | Prose to design from |
|---|---|---|
| `TerrainCell` | `ResortMap.terrain` (Sun Trap §3) | `game-design.md` §2 (terrain, walkable areas, water, construction zones), 12 §11 `placement_terrain_unsuitable` |
| `PathCell` | `ResortMap.paths` (Sun Trap §3) | `game-design.md` §2, §6 (path congestion, deferred) |
| `Zone` | `ResortMap.zones` (Sun Trap §3) | `game-design.md` §2 (service zones, restricted zones), 12 §6 `assign_staff { zoneId }` |
| `Incident` | `WorldGraphKindState.incidents` (12 §3) | `game-design.md` §11 |
| `ObjectiveProgress` | `WorldGraphKindState.objectives` (12 §3) | `game-design.md` §13, 12 §8 (`objectivesMet`) |
| `Alert` | `WorldGraphKindState.alerts` (12 §3) | 12 §3's own callout, 12 §6 `dismiss_alert` |

The first three are nested inside a type that *is* drafted, which is why the gap survives a
skim of `content-and-systems.md` §3 — the interface looks complete because its own fields are
all present.

### The document's own line budget

`12-world-graph-kind.md` is 398 lines. `10-simulation-kind.md` is 2,057 after four contract
units against a source roughly 60% larger. Expect §3 alone to roughly triple this document.
That is not a reason to compress: `10 §6`'s eleven subsections are the readable precedent, and
a single 400-line code block is not.

---

## Findings That Shape the Unit

### 1. The unit is part port, part design — and the split does not follow the programme's rows

Six types (above) have no draft. Three of them (`Incident`, `ObjectiveProgress`, `Alert`) are
top-level collections in `WorldGraphKindState`; three (`TerrainCell`, `PathCell`, `Zone`) are
nested inside `ResortMap`. `plans/39`'s W42 row names only the eight drafted shapes, and its
Decision 2 explains the W42/W43 split as *"state types are a port with an existing,
near-ready draft; content-definition types are new design work."* That distinction is real
but it does not partition cleanly along the state/content line, because part of the state is
undrafted too.

**Resolution: W42 owns all eleven collections, including designing the six undeclared types.**
Deferring them to W43 would leave this unit's gate unreachable by three collections and would
put *runtime state* inside a *content-definition* unit — a worse boundary than the one it
would be avoiding. The unit is sized accordingly and reviewed as design where it is design.
This finding supersedes the scope implied by `plans/39`'s W42 row; the row is corrected in
the same commit as this plan rather than left to disagree.

### 2. `Queue` carries a back-pointer to the building that contains it

`content-and-systems.md` §5 nests `queue: Queue` **inside** `Building`, and `Queue` declares
both its own `id` (`"q:<ordinal>"`) and `buildingId: string`. The containment relationship is
therefore recorded twice, and the two are free to disagree — a queue nested in `b:3` whose
`buildingId` says `b:7` is representable, and nothing can adjudicate it.

That is precisely the objection 12 §3 already makes to a persisted `rng`, and the one
`10 §2` makes to `totalTimeCost`: *a field written every tick, read by nothing, free to drift
from the derivable truth.* It is the same defect class as the envelope-duplication ledger,
one level down — duplication inside `kindState` rather than against the envelope.

`Guest.queueId` is **not** the same problem: a guest is not contained by a queue, so the
reference is the only record of the relationship and has to exist.

### 3. Guest conditions and opinions disagree between the two Sun Trap documents

Neither document notes the other, and the engine contract has to pick:

| | `content-and-systems.md` (drafted) | `game-design.md` (prose) |
|---|---|---|
| Conditions | 6 — drunkenness, sunburn, headache, nausea, injury, anger | 7 — the same six **plus confusion** (§3.1) |
| Opinions | 7 — price, variety, cleanliness, safety, attractiveness, queues, service | 10 — the same seven **plus staff behaviour, accessibility, noise** (§3.2) |

This is exactly what the ledger's *"reconcile nullability, units, integer ranges and tick
semantics across both repositories"* box is for, and it is a decision rather than
bookkeeping — a field added here is a field every system in W44 may read and every
projection in W45 must consider. See Decision 4.

### 4. Three open-keyed records need the N6 reconciliation W33 already wrote

`Guest.preferences`, `Building.pricesCents` and `Building.inventory` are all
`Readonly<Record<string, number>>`. `02-architecture.md` N6 bans the loose bag, and
`10 §6.2` had to reconcile the identical shape for `ActorState`'s `skills`, `reputation`,
`flags` and `counters` — the argument being that a record whose **keys are declared by
validated content** is not a loose bag, because Tier 1 validation closes the key set at load.

That argument transfers to all three fields here (product ids and archetype preference keys
are content-declared), but it has to be *written*, not assumed — an unexamined
`Record<string, number>` is indistinguishable from the thing N6 bans. Follow `10 §6.2`'s
wording rather than re-deriving it.

### 5. `dismiss_alert` is missing from §4's action split — and the undercount has propagated

12 §4 lists eight actions that mutate without advancing time. 12 §6's table lists **nine** —
the same eight plus `dismiss_alert`, which §3's own `alerts` callout requires
(*"an alert persists until dismissed and dismissal is a player action"*). §4 is the stale one.

The undercount has since been copied into two more places: `plans/39`'s W45 row
(*"Implement build/demolish, hire/fire, assign, set-price and open/close reducers"*) and
`TODO.md`'s W45 bullet (*"the eight no-time-passes reducers"*). W42 is the natural place to
fix it, because this unit is what gives `Alert` a type for `dismiss_alert` to operate on.
Three one-line corrections, landed here rather than left for W45 to discover while
implementing.

### 6. `WorldGraphView` has no shape, and §7 makes it load-bearing

12 §10 is prose: it says what never crosses the boundary and what is carried, and declares no
type. That is tolerable for a seam-only revision and not for a contract, because §7 makes
this kind's projection *the parameter domain* — `AvailableAction` carries no parameter
schema, so a client renders its build menu from the projection or not at all. A view with no
declared shape means W45 has to invent the one surface every client depends on.

The ledger assigns this to W42 and it belongs here: a view is a function of state, and this
is the unit that fixes the state. `Kind.outcome`'s shape is **already** declared in §8, so
"terminal outcome data" needs verifying against the new types, not designing.

### 7. `drawCount` and `StreamId.seq` are the same counter under two names

12 §5 rule 3 requires agent-level draws to key on `ctx.derive({ kind: "agent", agentId, seq })`
where `seq` is *"that agent's own draw counter, stored on the agent and incremented per
draw."* Sun Trap names that stored field `drawCount` on both `Guest` and `Staff`.

They are the same thing and nothing currently says so. State it once, at the field, or W45
risks carrying a `drawCount` **and** passing something else as `seq` — a divergence that
would not fail a typecheck and would quietly break batch invariance, the one property this
kind exists to guarantee.

### 8. The MVP needs a fraction of these fields, and only W43's ledger says to mark that

Sun Trap's `mvp.md` §3 scopes guests to two needs (thirst, toilet) and one opinion (price);
§4 puts groups, loans, staff fatigue, multiple archetypes and complex inventory out of scope.
The drafted types carry all of it — seven needs, seven opinions, `Guest.groupId`,
`Finances.loans`, `Staff.fatigue`.

The programme ledger has *"Mark fields required for the MVP versus valid post-MVP extension
points"* under **W43**, not W42 — but these are W42's fields. Specify all of them (the
`simulation` precedent is unambiguous: W32–W35 ported the whole upstream contract, far beyond
what "Stable Life" ever used), and mark the MVP-inert ones so W45–W47 know what may stay
inert without that looking like an omission. See Decision 5.

---

## Decisions

### 1. `ResortMap` is renamed `WorldMap`

`12 §1` rejects the name `management-simulation` on the explicit grounds that *"a colony sim,
an ecosystem model or a transport network would run on this identical kind."* A type called
`ResortMap` in engine-owned code contradicts that argument in the one place it is most
visible — the state interface. The two built kinds both use structural names (`Node`,
`Choice`; `ActorState`, `PlayerState`), never themed ones.

`Guest`, `Staff` and `Building` **stay**. They name structural roles the kind actually
models — an autonomous visitor who arrives with needs and departs, an employee the player
pays and assigns, a placed structure with a footprint — and they read correctly for a colony
or a transport network. `Resort` names a *theme*; the other three name *roles*.

Costed deliberately: renaming now is a find-and-replace in one document. Renaming after W45
is a code change across a kind, its fixtures and its replay corpus.

### 2. `Queue.buildingId` is dropped; queues stay nested in `Building`

Finding 2. Of the two available fixes — lift queues to a top-level `queues` collection keyed
by id, or drop the back-pointer — dropping is correct here. A queue has no independent
lifecycle: it is created with its building and destroyed with it, and every system that
touches a queue reaches it through the building it belongs to. A top-level collection would
add a twelfth field to `WorldGraphKindState` and a referential-integrity check to validation,
buying nothing.

`Queue.id` **stays**, because `Guest.queueId` needs a referent and 12 §9's ordinal id rule
applies to queues by name. Containment is then recorded exactly once, and the building a
queue belongs to is derived by lookup — the same treatment 12 §3 gives every other derived
value.

### 3. The six undeclared types are designed in this unit, minimally

Finding 1. Design them at the smallest shape the named consumers actually require — 12 §4's
twenty systems, 12 §6's action table, 12 §11's reason codes — and no wider. Specifically:
`TerrainCell` and `PathCell` exist to answer *walkable?* and *what may be built here?*
(`placement_terrain_unsuitable`, `placement_unreachable`); `Zone` exists because
`assign_staff { zoneId }` names one; `Incident` exists because pipeline step 16 rolls them and
step 19 raises alerts from them; `ObjectiveProgress` exists because step 17 updates it and
§8's `objectivesMet` publishes from it; `Alert` exists because `dismiss_alert` clears it.

**Every field must trace to a named consumer.** A field that no system in §4 reads and no
action in §6 writes does not belong in a runtime-state contract — it is content (W43) or
speculation. Record the consumer beside each type, the way `10 §2.4` records `GoalState`'s.

### 4. Take the drafted field sets, and record the prose supersets as W43 content

Finding 3. `GuestConditions` keeps six fields and `GuestOpinions` keeps seven — the drafted
sets, not the prose supersets.

The reasoning is not "the code-shaped document wins by default." It is that
`game-design.md` §3.2's three extra opinions (staff behaviour, accessibility, noise) and
§3.1's *confusion* are named in a list of things guests *evaluate*, with no system in 12 §4
that would update them and no reason code or projection that reads them. Under Decision 3's
own rule they fail the consumer test. Adding a field to serialized state that nothing writes
is how the `rng` and `totalTimeCost` defects happened.

They are not dropped: record them in `OPEN-QUESTIONS.md` as candidate extensions with the
condition that admits them — a system in §4 that updates the value, added by the same unit.
That is the same treatment `plans/36` gave `ChainScope`'s `"profile"` value in W32.

### 5. Specify every field; mark the MVP-inert ones inline

Finding 8. A `Marked post-MVP` note at the field, not a separate table that will drift from
the fields it describes. `Guest.groupId`, `Finances.loans`, `Staff.fatigue` and the five
needs beyond thirst and toilet are the known set; re-derive it from `mvp.md` §4 rather than
trusting this list.

### 6. §3.1 `initialState` moves to the end of §3

The nine new subsections come first, so `initialState` reads after the types it constructs.
Verified cost: **one** in-document reference (§15, line 472) and no cross-document anchor
link anywhere in the repository points at `#31-initialstate`. Renumbering is otherwise free
here, which is not true of the document-level numbering `CLAUDE.md` warns about.

### 7. Sun Trap is not edited, and is not synchronised afterwards

`plans/39`'s non-goals are explicit. After this unit, `content-and-systems.md` §§2–9 is stale
wherever it disagrees — which its own header already anticipates (*"where this table and it
disagree, [the engine contract] is right and this is stale"*). Whether that repository
retires those sections and links here instead is its own decision to make, in its own PR.

---

## Sequence

**1 — Read both source documents in full**, plus `10-simulation-kind.md` §2 and §6 for house
style. Do not start from this plan's summaries.

**2 — Port the five drafted clusters** into new §3.1–§3.5: map and geometry, guests,
buildings and queues, staff and construction, finances. Apply Decisions 1 and 2 as you go.
Each subsection carries the interface, then the prose that makes its non-obvious fields
answerable — the `10 §6` pattern, not a bare code block.

**3 — Design §3.6, the three undrafted top-level types** — `Incident`, `ObjectiveProgress`,
`Alert` — under Decision 3's consumer rule, from `game-design.md` §§11, 13, 14 and 12 §3's own
`alerts` callout. Design `TerrainCell`, `PathCell` and `Zone` inside §3.1 where they are
named.

**4 — Write §3.7, collections and canonical order.** Which collections are arrays, which are
records, what their canonical iteration order is, and who owns `nextEntityOrdinal`'s
allocation. 12 §9 already fixes the rules; this states them per collection so no
implementation unit has to infer them.

**5 — Write §3.8, units, ranges and nullability.** Integer scales and their clamps, cents
for money, basis points for rates, ticks for time, and which optional fields are genuinely
optional versus absent-until-a-lifecycle-stage. Fold in Finding 4's N6 reconciliation and
Finding 7's `drawCount`/`seq` identity here.

**6 — Move §3.1 `initialState`** to §3.9 and fix the one §15 reference (Decision 6).

**7 — Declare `WorldGraphView` in §10**, checked field by field against 04 §6's `Scene` and
04 §9's `PlayerView` so it repeats nothing they carry (Finding 6). Confirm §8's `outcome()`
shape still resolves against the now-real `ObjectiveProgress`.

**8 — Land the three corrections** Findings 3 and 5 turned up: `dismiss_alert` added to §4's
split, `plans/39`'s W45 row and `TODO.md`'s W45 bullet corrected from eight to nine. Record
Decision 4's deferred fields in `OPEN-QUESTIONS.md`.

**9 — Update the document's status line.** It says *"Revision 1 — the seam only."* After
W44 that is false; after W42 it is partially false. State what is specified and what is not,
the way `10 §15` tracked its own port across four units — do not simply delete the caveat.

---

## Done-When

- [ ] Every one of `WorldGraphKindState`'s eleven fields has a fully declared type in
      `12-world-graph-kind.md`, including the six that were declared nowhere before.
- [ ] Every field of every new type traces to a named consumer — a system in §4, an action in
      §6, a reason code in §11, or a projection field in §10 — and the consumer is recorded.
- [ ] `ResortMap` does not appear in the document; `WorldMap` does (Decision 1).
- [ ] `Queue` has no `buildingId`, and `Guest.queueId` still resolves (Decision 2).
- [ ] The three open-keyed records carry the N6 reconciliation in the wording `10 §6.2` uses,
      not a fresh derivation (Finding 4).
- [ ] `drawCount` is stated to be the `seq` of `StreamId.agent`, at the field (Finding 7).
- [ ] MVP-inert fields are marked at the field (Decision 5).
- [ ] `WorldGraphView` is declared and repeats nothing `Scene` or `PlayerView` carries,
      verified field by field against 04 §6 and §9 — the sixth check against the
      envelope-duplication ledger, and the second on the view side.
- [ ] `initialState` is §3.9 and the §15 reference points at it (Decision 6).
- [ ] `dismiss_alert` appears in §4, and `plans/39` and `TODO.md` say nine reducers, not
      eight (Finding 5).
- [ ] The deferred condition and opinion fields are in `OPEN-QUESTIONS.md` with the condition
      that would admit them (Decision 4).
- [ ] No file under `src/engine/` changes. `./build/Test-Documentation.ps1` passes, and all
      three required checks are green.

---

## Explicitly Not In Scope

- **No content-definition types.** `BuildingDefinition`, `GuestArchetypeDefinition`,
  `StaffRoleDefinition`, `ProductDefinition`, `ScenarioDefinition`, `ObjectiveDefinition`,
  `IncidentDefinition`, `TerrainDefinition`, `PolicyDefinition`, `AchievementDefinition` are
  W43. Forward-reference them by name, exactly as W32 forward-referenced `NPCState`,
  `GameAction` and `Modifier` rather than inventing placeholder shapes.
- **No system behaviour, formulas, or ordering.** Utility scoring, A\* cost model, queue
  admission, tie-break rules and the twenty-system pipeline detail are W44. This unit says
  what a field *is*, never what updates it — beyond naming the consumer that does.
- **No code.** Not a type file, not a test, not a fixture. W45 is the first code unit.
- **No core changes.** `plans/39`'s non-goals: if this unit finds the seam genuinely
  insufficient, that is a core unit with its own plan, not a change smuggled in here.
- **No `SubZeroDev.SunTrap` changes** (Decision 7).
- **No revisiting the shared tick-substrate deferral.** `OPEN-QUESTIONS.md` §2's trigger names
  *implemented*, and W46 is that trigger. Restated in `plans/39` Decision 5, not re-litigated
  here.
