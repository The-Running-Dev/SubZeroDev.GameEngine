# The `world-graph` Kind — Programme

**Units:** [`docs/docs/engine/TODO.md`](../docs/docs/engine/TODO.md) — *Depth: Sun Trap*.
Proposed as **W41–W48**, numbers assigned when each is cut.

**Scope:** Umbrella plan for the third engine-owned kind: finishing its contract in this
repository, then building it against that contract. Records how the work splits and why,
against the actual source material now available in both repos. Planning only.

**Depends on:** Nothing outstanding. `KindContext.derive` and the `tick`/`agent` stream
variants this kind needs have existed since W1/W2 (`plans/33` Finding 1); no core change is
required before this programme starts.

**Programme:** [`plans/33-post-mvp-programme.md`](33-post-mvp-programme.md), Tranche B.

**Precedent:** [`plans/36-simulation-kind-programme.md`](36-simulation-kind-programme.md) —
same structure, same reason: the programme doc records the split and the decisions: each
unit gets its own plan when it is executed.

---

## Why This Programme Exists Now, and Not When `plans/33` Was Written

`plans/33`'s own Decision 3 declined a world-graph programme doc at the time, for a stated
reason: *"the world-graph kind's content (maps, scenarios, balance, client) lives in
`SubZeroDev.SunTrap` and is design-only with no code... Splitting that build now would be
sizing work against a document that does not exist yet."*

That document now exists. `SubZeroDev.SunTrap`'s `docs/docs/design/content-and-systems.md`
(344 lines) is not a narrative description — it is a set of near-code-ready TypeScript
interfaces (`ResortMap`, `Guest`, `Building`, `Queue`, `Staff`, `ConstructionSite`,
`Finances`, `Loan`) explicitly written *to* the engine's own `12-world-graph-kind.md`
contract, with its own header stating "where this table and it disagree, [the engine
contract] is right and this is stale" — i.e., it already defers to the engine the same way
`games/04-engine-specification.md` did for `simulation`, and is sized similarly (`game-
design.md` 329 lines, `mvp.md` 143 lines, `client-specification.md` 166 lines — around 980
lines total design material, roughly 60% of `10-simulation-kind.md`'s pre-port source,
consistent with a narrower MVP). `plans/33` Decision 3's blocking precondition is resolved;
sizing this programme against real source material is now possible, the same milestone that
let `plans/36` exist for `simulation`.

---

## Findings That Shape the Split

### 1. A genuine contract ambiguity: does the engine own the field-level *shapes*, or just the seam?

`12-world-graph-kind.md` §17 says field-level guest/staff/building/queue/construction detail
"lives with the game" as "content schema, not seam." Read alone, that could mean the engine
never sees concrete shapes at all — which cannot be literally true, since §2's own
justification for this being a kind rather than campaign data is code the campaign tier
*cannot* carry (A\* pathfinding, guest utility scoring), and that code must type-check
against something.

`SubZeroDev.SunTrap/docs/docs/design/content-and-systems.md` resolves the ambiguity by
example, not by restating the rule: its own header calls its shapes "these are `kindState`
internals," yet it writes them as complete, contract-compliant TypeScript ready to be read
by engine code, and explicitly defers to the engine contract wherever the two disagree. This
is the same relationship `games/04-engine-specification.md` had to `10-simulation-kind.md`
before W32–W35 ported it: a design source the engine kind ports from and then owns, not a
type surface the game repo maintains in parallel forever. **`state.ts`/`content.ts`-
equivalent files in `kinds/world-graph/` are the engine's own code, compiled once, in this
repository — SunTrap owns the concrete values (which drink stand, which map, which
archetype), not a second copy of the interfaces.** This should be stated in
`12-world-graph-kind.md` §17 explicitly, not left to be inferred from precedent — the same
one-sentence tightening `10-simulation-kind.md` §15 already gives its own equivalent
relationship.

### 2. Content-definition types are undrafted in *both* repos — unlike state types

`content-and-systems.md` §§2–9 draft the **runtime state** shapes (`ResortMap`, `Guest`,
`Building`, `Queue`, `Staff`, `ConstructionSite`, `Finances`, `Loan`) in essentially
port-ready form. Its §10, "Content Definitions," is one paragraph of nouns — "guest
archetypes, staff roles, buildings, products, terrain, scenery, incidents, scenarios,
objectives, policies, achievements" — with no type declarations at all. Unlike `simulation`,
where upstream's `games/04-engine-specification.md` §14 already had full type drafts for
every content cluster the engine later ported (W38 transcribed more than it designed),
world-graph's content-definition types (`GuestArchetypeDefinition`, `BuildingDefinition`,
`StaffRoleDefinition`, `ScenarioDefinition`, `ObjectiveDefinition`, `IncidentDefinition`, …)
do not exist as drafts anywhere. This unit is real design work grounded in `game-design.md`'s
narrative (needs, opinions, adjacency effects, placement validation, incidents), not a
transcription pass — sized and reviewed as such, not assumed to be as mechanical as W38 was.

### 3. There is no "plan" concept here — mutation and resolution are already separated by the contract

`simulation`'s build needed its own `plan.add`/`remove`/`clear` reducers (W36) before
`end_week` (W37) had anything to resolve. `12-world-graph-kind.md` §4 already splits actions
this way at the **contract** level: `build`/`demolish`/`hire_staff`/`fire_staff`/
`assign_staff`/`set_price`/`open_building`/`close_building` mutate immediately, no time
passes; only `advance_ticks` resolves. There is no pending-plan state to design or build —
the immediate-mutation actions are direct, single-step reducers from day one. This makes the
build's first unit smaller than `simulation`'s W36 by exactly that scope.

### 4. `previewAction` is cross-cutting, not kind-internal, and `plans/33` already said so

`plans/33` Finding 4 declined `previewAction` as a standalone unit but was explicit that it
is *"folded into the world-graph build, not scheduled separately"* — not that it disappears
into an ordinary build unit unremarked. It touches `Engine`, `SessionStore`, the text client,
and the MCP server (confirmed absent from all four by direct search), plus `09-clients.md`
§4's coverage checklist and `MVP.md` §5, which `12-world-graph-kind.md` §7 requires change
"in one change, not three." That is real, cross-cutting surface area — kept as its own build
unit here (B4) rather than folded silently into validation/corpus (B5), so its own review
doesn't have to compete with an unrelated concern for attention.

### 5. The tick-substrate deferral's own "revisit when" condition is now met — and the answer is still "not yet"

`OPEN-QUESTIONS.md` §2 (echoed in `plans/33` Decision 2) declines a shared tick-pipeline
substrate with a stated trigger: *"revisit when the second tick-driven kind is
implemented."* This programme is that kind, cut before implementation, not after — the
condition names *implemented*, not merely scheduled. The call stands unchanged: extract
nothing until this kind's own tick pipeline (B2) is real code and a second, independent data
point exists to generalize from. Restated here rather than silently re-applied, since the
trigger being *close* is exactly the situation `OPEN-QUESTIONS.md` itself asks to be
recorded, not just remembered.

### 6. Package consumability is real, but does not block this programme

Auditing the engine's own consumability (`src/engine/package.json`'s `"private": true`, no
export barrel, no publish workflow — every existing campaign, `story-graph` and
`simulation` alike, has been proven entirely with fixtures committed inside this repository,
never consumed cross-repo) found a genuine gap peer review surfaced. It does not block
*this* programme: `SubZeroDev.SunTrap/docs/docs/product/mvp.md` §0 states plainly that
"nothing here starts until that kind exists," so Sun Trap will not attempt to consume this
package before the Build phase below produces something to consume. **Explicit non-goal**,
below — revisited when Sun Trap is actually ready to write real campaign code, not before.

### 7. A small doc defect, fixed alongside this plan: `tick_limit_exceeded` vs `tick_limit_reached`

`12-world-graph-kind.md` §6 refers to the tick-cap rejection as `tick_limit_exceeded`; §11's
own canonical reason-code table names it `tick_limit_reached`. One is a stale cross-
reference to the other — §11's table is the canonical list (the same role `10-simulation-
kind.md` §10's table plays), so §6 is corrected to match. Fixed in the same commit as this
plan; too small to hold up behind a full unit.

---

## The Split

### Contract (doc-only, must complete before any code)

| W | Unit | Source | Scope |
|---|---|---|---|
| **W41** | State types | `content-and-systems.md` §§2–9 | `ResortMap`, `Guest`, `Building`, `Queue`, `Staff`, `ConstructionSite`, `Finances`, `Loan` — ported into `12-world-graph-kind.md` §3, replacing today's top-level-only sketch |
| **W42** | Content-definition types | `game-design.md` (needs, opinions, adjacency, placement, incidents), `content-and-systems.md` §10's one-paragraph list | `GuestArchetypeDefinition`, `BuildingDefinition`, `StaffRoleDefinition`, `ProductDefinition`, `ScenarioDefinition`, `ObjectiveDefinition`, `IncidentDefinition`, `TerrainDefinition`, `PolicyDefinition`, `AchievementDefinition` — genuinely new design, not transcription (Finding 2) |
| **W43** | Resolution and systems detail | `12-world-graph-kind.md` §4, §9, `content-and-systems.md` §§8–9 | The 20-system tick-pipeline order restated against real types; utility-scoring and pathfinding cost-model shapes; tie-breaking rules already normative in §9, restated alongside the functions that implement them |

Split by type cluster with a natural review boundary, the same reasoning `plans/36` gave for
its own four-way split: each is reviewable on its own, and W42 in particular needs room to be
judged as design, not skimmed as a port.

### Build (code, against the completed contract)

| W | Unit | Mirrors |
|---|---|---|
| **W44** | State types as code, `initialState`, the eight immediate-mutation actions | `simulation`'s W36, minus the plan concept (Finding 3) |
| **W45** | The 20-system tick pipeline | `simulation`'s W37 — pipeline + honest stubs, the same discipline |
| **W46** | The MVP vertical slice: spawn → walk → queue → buy → litter → clean → win/lose | `simulation`'s W39 |
| **W47** | `previewAction` across `Engine`/`SessionStore`/text client/MCP, plus the ten-operation amendment to `09-clients.md` §4 and `MVP.md` §5 | Not mirrored by `simulation` — genuinely new, cross-cutting (Finding 4) |
| **W48** | Validation, the MVP scenario, replay corpus | `simulation`'s W40 |

Five build units against three contract units — one more on each side than `simulation`'s
3-and-3, for reasons Findings 2 and 4 already state: content-definition types are real
design work here, not transcription, and `previewAction` is real cross-cutting surface area
`simulation` never had to touch.

---

## Decisions

### 1. Contract fully before code — no interleaving, same reasoning as `simulation`

`12-world-graph-kind.md` §2 states this kind's own closest relative is `simulation`, not
`story-graph`, for exactly the reason that makes contract-first matter: `Guest`/`Staff`
fields are referenced pervasively across pathfinding, utility scoring, queueing and service
— there is no prefix of that type graph safe to build against before it is settled.

### 2. Runtime state and content-definition types are two separate contract units, not one

Finding 2 is the reason: state types (W41) are a port with an existing, near-ready draft;
content-definition types (W42) are new design work grounded in prose, not code. Conflating
them would let the easy half's readiness disguise the hard half's actual size — precisely
the risk `plans/36`'s own Finding 3 flagged for a different reason (an incomplete upstream
table understating simulation's port by half). Keeping them apart keeps each honestly sized.

### 3. `previewAction` is its own build unit (W47), per Finding 4

`plans/33` folded it into "the world-graph build" as a whole, not into any one unit within
it. Given it touches four surfaces outside the kind itself (`Engine`, `SessionStore`, text
client, MCP) plus two Definition-of-Done documents, it earns independent review rather than
riding along inside W46 or W48.

### 4. Package consumability is an explicit non-goal of this programme

Finding 6. Sun Trap's own MVP document defers starting until this kind exists in code, so
there is no consumer waiting on a publish mechanism during W41–W48. Revisit when Sun Trap
is actually about to write real campaign code against this kind — a decision with its own
tradeoffs (a `file:`/workspace link for development versus a published package) that
deserves being made against a concrete need, not speculated about here.

### 5. No shared tick-pipeline substrate, restated, not re-litigated

Finding 5. `OPEN-QUESTIONS.md` §2's trigger names *implemented*, and this programme is that
implementation, not yet complete. The decision does not change; it is restated because the
trigger condition being close enough to name is itself worth recording.

### 6. `tick_limit_exceeded` → `tick_limit_reached`, fixed now

Finding 7. A one-line correction, landed with this plan rather than left for whichever unit
happens to touch that paragraph next.

---

## Milestones

| # | Reached when | Meaning |
|---|---|---|
| **T1 — The contract is whole** | W43 merged | Every type `WorldGraphKindState` and its content-definition surface names is specified in this repository. `12-world-graph-kind.md` stops being "the seam only" |
| **T2 — A tick batch resolves** | W45 merged | The loop runs: mutate, `advance_ticks`, twenty systems, next tick. Batch invariance (§5) has a test with teeth |
| **T3 — Sun Trap's MVP plays** | W48 merged | The MVP scenario (`SubZeroDev.SunTrap/docs/docs/product/mvp.md` §3) is winnable and losable through the replay oracle — the same honest scope this repo already recorded for `simulation`'s own S3 (`plans/36`): proven through `createGame`/`submitAction`, not yet through a client, since W47 (`previewAction`) lands the missing session operation but a full client-facing projection is a further, later unit exactly the way it was for `simulation` |
| **T4 — Guarded** | W48's fixtures in the corpus | The replay oracle covers a third kind |

---

## Explicit Non-Goals

- **No core changes.** `KindContext.derive` and the `tick`/`agent` stream variants already
  exist (`plans/33` Finding 1). If a unit finds otherwise, that is a core unit with its own
  plan, not a change smuggled into this kind.
- **No shared tick substrate.** Decision 5.
- **No package publication mechanism.** Decision 4.
- **No Sun Trap repository changes.** This plan is scoped to `SubZeroDev.GameEngine`; Sun
  Trap's own scaffold, balance harness, and visual client are that repository's own
  decisions to sequence, informed by this plan but not directed by it.
- **No re-porting of core material.** `04-core.md`'s conventions (randomness, projection,
  the frozen `Condition` set, save/migration) stay reused, not re-derived, the same rule
  `10-simulation-kind.md` follows and `CLAUDE.md`'s envelope-duplication ledger tracks.
- **No W-numbers treated as fixed.** W41–W48 are proposed. They are assigned when each unit
  is cut, per `TODO.md`'s positional-numbering note.
