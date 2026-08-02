# W43 — The World-Graph Content-Definition Contract

**Scope:** Plan the doc-only contract unit that turns §14's list of content nouns into the
complete, typed campaign schema the `world-graph` kind will build against. No engine code.

**Depends on:** W42's merged runtime-state contract
([PR #116](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/116)); the core
authoring-to-registry boundary in `04-core.md` §10.1; Sun Trap's `game-design.md`,
`content-and-systems.md`, and `mvp.md` as design authority for the flagship content.

**Programme:** [`plans/39-world-graph-kind-programme.md`](39-world-graph-kind-programme.md),
W43. This is the second of three contract units; W44 still owns system order, pathfinding,
utility arithmetic, queue/service timing, and deterministic resolution.

**Status:** Planning only. This file decides the boundary, sequence, and review gates. The
contract changes themselves belong to the W43 execution change.

---

## Handoff — Start Here

### The prompt

> Execute W43 from `plans/43-w43-world-graph-content-contract.md`. Keep it doc-only. Replace
> the noun list in `docs/docs/engine/12-world-graph-kind.md` §14 with the source/runtime
> campaign types, definition types, reference rules, validation rules, and worked examples
> this plan requires. Make only the narrowly necessary §3 corrections exposed by the content
> contract. Do not design W44's formulas or write files under `src/engine/`.

### Where to work

- **Primary contract:** `docs/docs/engine/12-world-graph-kind.md`, especially §§3, 14, 15,
  and 17.
- **Core boundary to reuse:** `docs/docs/engine/04-core.md` §10.1. Do not invent a second
  loader or localization model.
- **Programme ledger:** this plan plus `plans/39-world-graph-kind-programme.md` and
  `docs/docs/engine/TODO.md`.
- **Primary game sources, read-only:**
  `SubZeroDev.SunTrap/docs/docs/design/game-design.md`,
  `docs/docs/design/content-and-systems.md`, and `docs/docs/product/mvp.md`.
- **Precedent, not a template to copy mechanically:** `03-story-graph-kind.md` §1/§7 and
  `10-simulation-kind.md` §7/§14.

### Working rules that are easy to violate here

1. A campaign's envelope identity and a nested definition's identity are different things.
   Do not remove definition ids in the name of avoiding envelope duplication.
2. Source types carry `AuthoredText`; runtime types carry `LocKey`. Apply defaults in the
   pure build step so tick resolution never depends on an omitted-field convention.
3. Campaign content must remain serializable data. No functions, classes, `Map`, `unknown`
   extension bags, or unvalidated string paths in the contract.
4. Keep balance **values** in Sun Trap. This contract owns the shape and scale of the fields
   that carry those values.
5. If a definition cannot be consumed without changing a W42 state reference, state the
   correction and make it in §3 now. Do not reopen unrelated W42 decisions.
6. W44 owns evaluation order and arithmetic. W43 may define a curve, condition, effect, or
   adjacency input, but not when systems apply it or how competing results compose.
7. Every collection and cross-reference has a canonical order or an explicit statement that
   order is semantically irrelevant and canonicalized by id.

### The one way to do this wrong

Do not produce eleven interfaces whose interesting fields are `Record<string, unknown>`,
`condition: string`, `effects: unknown[]`, or `parameters?: object`. That would make the
document look complete while forcing W44/W45 to invent the actual language of the kind. The
W43 gate is that the MVP scenario is authorable and validatable without an escape hatch.

---

## Why This Is Design Work

### 1. §14 names content but defines none of it

The current contract lists guest archetypes, staff roles, buildings, products, terrain,
scenery, incidents, scenarios, objectives, policies, and achievements. Neither repository
declares types for them. Sun Trap provides one example building in YAML and narrative rules;
that is enough to ground a design, not enough to transcribe one.

### 2. The current identity sentence is over-broad

§14 says `id`, `version`, and `titleKey` live on the core `Campaign` envelope and must not be
repeated in this kind's content types. That is correct only for the campaign itself. A
campaign contains many building, product, objective, and incident definitions; each requires
its own stable id. `10-simulation-kind.md` §7 already records the distinction explicitly.

W43 must replace the ambiguous sentence with the precise rule:

- `Campaign.id` / `version` / `titleKey` are envelope-owned and never repeated by
  `WorldGraphCampaign`.
- Every nested definition has its own id, unique within its definition namespace, because
  runtime state and other definitions reference it.

### 3. W42 exposed content references before their vocabularies existed

Three runtime shapes cannot be accepted unchanged once content is typed:

| W42 shape | Content pressure | W43 question |
|---|---|---|
| `TerrainCell.terrain: TerrainKind` | Terrain is declared campaign data | Is the stored value a definition id, with mechanical traits on `TerrainDefinition`? |
| `Incident.incidentType: IncidentType` | Incidents are declared definitions | Which properties are definition identity versus runtime incident state? |
| fixed `GuestNeeds` fields | Sun Trap's MVP requires thirst and toilet, which the current fields omit | Are needs a content-declared vocabulary with validated record keys? |

The default answer is **content ids plus typed definition data**, not a growing closed union
inside runtime state. Keep a closed union only for a genuinely engine-mechanical
discriminator that systems branch on independently of campaign content.

The same audit must cover `StaffTaskType`, building categories, guest opinions/conditions,
and any other content-shaped union before the section is called complete.

### 4. Four named content clusters have no runtime consumer yet

Scenery, policies, achievements, and scenario-authored map placements are absent from W42's
state closure. W43 must not hide this with inert prose. For each one it must either:

- add the minimum state reference required by an already-planned system or `initialState`, or
- mark the definition post-MVP and state the exact future consumer/revisit condition.

Policies may start active through scenario data even before a player action can change them.
Achievements need deterministic unlocked identity if conditions can affect play or profile
mirroring. Scenery needs an authored placement if it influences adjacency. Those are contract
questions, not implementation details.

### 5. Objectives, incidents, policies, and achievements need one data language

All four need to test world facts; three may also cause changes. Separate ad-hoc expression
formats would drift immediately. W43 therefore owns a shared, serializable, discriminated
condition/effect vocabulary. W44 owns evaluation timing, precedence, and arithmetic.

### 6. The MVP is narrow, but the schema must admit the programme

Sun Trap's MVP needs one map, one guest archetype, thirst/toilet, a drink stand, toilet,
trash point, cleaner, drink product, litter, one objective, and two failure paths. Weather,
groups, loans, multiple archetypes, complex inventory, policies, and most incidents are out.

The contract must mark which fields are required to author that slice and which are valid
post-MVP extensions. It must not make every future system mandatory in the minimum-valid
campaign, and it must not use `unknown` to postpone their design.

---

## Decisions

### 1. Pair one source type with one runtime type

Declare `WorldGraphCampaignSource` and `WorldGraphCampaign`, following `04-core.md` §10.1:

- source player-facing text is `AuthoredText`;
- runtime player-facing text is `LocKey`;
- the pure builder lifts strings, rejects conflicting key/text pairs, fills documented
  defaults, canonicalizes definition collections, and returns `BuiltCampaign`;
- parsing YAML/JSON remains outside the engine;
- runtime content remains plain serializable data, not an indexed `Map` graph.

The campaign root owns a required canonical `maps` catalog. Each source entry is a
`MapDefinitionSource`; the builder produces its `MapDefinition` runtime counterpart. A
scenario stores only `mapId`, which must resolve in that catalog. `Kind.initialState` turns
the selected definition into the mutable `WorldMap`; neither the scenario nor runtime state
owns a second copy of the authored map definition.

Do not add a third "compiled content" model in W43. W45 may build ephemeral indexes from
validated runtime arrays; caches are not campaign data or saved state.

### 2. Nested definitions own stable ids

Every definition has an `id: string`. Ids are opaque, non-empty, contain no `.`, and are
unique within their definition namespace. Cross-references always state the namespace they
target. Canonical definition order is lexicographic by id after the pure build step.

Map definitions have their own namespace. `WorldGraphCampaign.maps` is the sole catalog;
`ScenarioDefinition.mapId` targets it, and the source/runtime map pair owns dimensions,
topology, zones, and spawn/exit cells that seed `WorldMap`. Scenario placement entries stay
scenario-owned and reference the campaign's building/scenery catalogs instead of embedding
those definitions.

Defaults are not identity. A missing optional source field may become an explicit runtime
value, but a missing id or unresolved reference is always Tier 1.

### 3. Content ids replace content-shaped runtime unions

Use definition ids for terrain, incidents, needs, products, staff roles, buildings,
objectives, policies, and achievements. Where the engine needs a mechanical discriminator,
put a small closed `kind`/`operation` union on the definition and document why it is code-owned.

This decision allows the flagship campaign to add content without recompiling the kind while
keeping the system vocabulary exhaustively typed. It also brings the MVP's thirst/toilet
needs back into the schema without widening `GuestNeeds` for every new campaign.

### 4. An entrance is an authored approach cell

`BuildingDefinition` owns one or more footprint-relative entrance offsets. An offset names
the **walkable approach cell immediately outside** one edge of the unrotated rectangular
footprint. Tier 1 rejects an offset that is diagonal, inside the footprint, or more than one
orthogonal tile from its edge.

W42's exact integer rotation transform applies to the offset and then adds the placed
building origin. This gives placement validation and A* one unambiguous target cell without
storing derived absolute entrances on every `Building`.

### 5. Conditions and effects are closed discriminated unions

Define recursive `all` / `any` / `not` condition composition over a closed set of typed leaf
conditions. Leaves may reference counters, finance values, objective ids, entity/definition
counts, incident state, aggregate guest metrics, tick/day bounds, and content unlock state.
Each leaf states its value scale and target namespace.

Define effects as a separate closed union for the changes content may request: money,
unlock/lock content, objective progress, guest need/condition/opinion deltas, incident
start/resolve, and policy activation where supported. No arbitrary state path and no generic
`value: unknown`.

W43 defines the data shapes and validation. W44 defines evaluation order, aggregation,
rounding, precedence, and emitted events.

### 6. Curves are integer point sets; formulas remain W44's

Need drift, price resistance, patience, budget, service rate, litter generation, and
adjacency inputs use integers with named scales. When a non-linear response is required,
author it as an ordered set of integer `(input, output)` points with an explicit step or
linear interpolation discriminator. Duplicate/unsorted inputs are Tier 1.

W43 does not choose Sun Trap's point values or utility weights. W44 decides how these inputs
combine and where rounding occurs.

### 7. W42 corrections are permitted only when content makes them necessary

The W43 change may amend §3 for definition ids, content-declared record keys, active policy
ids, unlocked achievement ids, or scenery/map references that the new types require. Every
such amendment must appear in a small reconciliation table in §14.

No other W42 state shape is in scope. This keeps the contract coherent without turning W43
into a second state-design pass.

### 8. MVP requirements are marked at the field and definition level

Use the same `MVP-required` / `MVP-inert` discipline W42 uses for state fields. A minimum-valid
campaign must require only what Sun Trap's `mvp.md` exercises. Post-MVP definitions remain
fully typed but may be absent from that campaign.

---

## Required Type Inventory

The execution change may rename a type for clarity, but it may not silently drop a row.

| Cluster | Required contract surface |
|---|---|
| Root | `WorldGraphCampaignSource`, `WorldGraphCampaign`, required canonical `MapDefinitionSource`/`MapDefinition` catalog, scenario selection, tick limits, `ticksPerDay`, definition catalogs |
| Shared | authored/runtime text pairing, definition ids, integer curve, condition, effect, tags/categories, canonical ordering |
| Spatial | `MapDefinitionSource`, `MapDefinition`, dimensions/topology/zones/spawns/exits, `TerrainDefinition`, `SceneryDefinition`, scenery/building map placement, placement rule, adjacency input/effect, footprint, entrance offset, allowed rotations |
| Service | `BuildingDefinition`, `ProductDefinition`, queue/service configuration, staff requirements, prices/costs, product effects, litter output |
| Agents | `GuestArchetypeDefinition`, need profiles/curves, budgets, patience, preferences, spawn/arrival inputs; `StaffRoleDefinition`, wages, supported task kinds, work rates |
| Scenario | `ScenarioDefinition`, `mapId` reference into the campaign-owned map catalog, pre-placed buildings/scenery, starting cash/unlocks/policies, objective/failure references, time limits |
| Rules | `ObjectiveDefinition`, failure definition or explicit failure branch, `IncidentDefinition`, `PolicyDefinition`, `AchievementDefinition` |
| Localization | every player-facing source field as `AuthoredText`; every runtime counterpart as `LocKey`; no inline runtime strings |

The root type must make each catalog's presence/absence explicit. A campaign with no policies
or achievements may use an empty canonical array; it may not omit a property whose runtime
code would otherwise need a default.

---

## Sequence

1. **Correct §14's identity wording** and introduce the source/runtime campaign pair before
   adding leaf definitions.
2. **Inventory every W42 content reference** and label it definition id, mechanical
   discriminator, or runtime entity id. Resolve the terrain/incident/needs conflicts first.
3. **Define the shared data language:** ids, text, conditions, effects, integer curves,
   scales, and canonical collection rules.
4. **Define the spatial/service cluster:** the source/runtime map pair and campaign-owned map
   catalog first, then terrain, scenery, building, product, footprint, entrance, placement,
   adjacency, queue, service, and litter inputs. State that each scenario's `mapId` resolves
   in that catalog and that `initialState` combines the selected definition with the
   scenario's placements to materialize `WorldMap`.
5. **Define the agent cluster:** guest archetype and staff role, including MVP needs,
   budgets, patience, wages, task capabilities, and fixed-point scales.
6. **Define the scenario/rules cluster:** scenario, objectives/failures, incidents, policies,
   and achievements, all through the shared condition/effect vocabulary.
7. **Reconcile §3 narrowly** for content references the new types prove are missing or
   wrongly closed. Record each change next to the content contract.
8. **Expand §15 validation** with id uniqueness, reference resolution, localization,
   geometry, scale/range, default, condition/effect, and MVP-minimum checks.
9. **Add two worked fixtures in documentation:** the smallest valid Sun Trap MVP content
   slice and a compact invalid source with representative Tier 1 failures. The examples must
   exercise the source/runtime text boundary and entrance validation.
10. **Update §17 and the ledgers** so Sun Trap owns concrete values and balance while the
    engine owns the compiled TypeScript schema. Leave W44 as the next unit.

---

## Validation Matrix

### Tier 1 — hard failure

- Duplicate or malformed definition ids; a reference that does not resolve in its declared
  namespace, including a scenario `mapId` absent from the campaign's map catalog.
- Missing/conflicting localization; a runtime player-facing string that bypasses `LocKey`.
- Non-integer, out-of-range, or incorrectly ordered curve/price/service/patience values.
- Invalid map dimensions/topology, missing spawn/exit cells, empty/invalid footprints,
  unsupported rotations, invalid entrance offsets, no entrance, impossible terrain
  requirements, or overlapping/out-of-bounds map pre-placements.
- Record keys not declared by validated content, including guest need/opinion/effect targets.
- Invalid condition/effect discriminators or payloads; recursive expressions with an empty
  `all`/`any` where the contract does not define an identity value.
- Scenario references to missing map, objectives, failures, unlocks, policies, buildings,
  products, roles, terrain, or archetypes.
- Missing/non-positive tick cap or `ticksPerDay`; negative capacities/costs; default prices
  outside their allowed integer-cent bands.

### Tier 2 — warning

- Unreachable unlocks, definitions never reachable from a scenario, terrain disconnected
  from every spawn/exit, or a building category with no guest demand.
- A staff role with no task source; an incident with no resolution path; an achievement whose
  condition references a fact no authored effect/system can change.
- A scenario already resolved at tick 0 or one with no objectives.

Balance search remains outside registry validation: dominant buildings, infinite-money loops,
queue deadlock, and unavoidable bankruptcy are harness findings, not W43 Tier 3.

---

## Done-When

- [ ] `12-world-graph-kind.md` §14 declares the complete source and runtime campaign shapes.
- [ ] Every definition in the Required Type Inventory is fully typed or explicitly replaced
      by a named, typed equivalent.
- [ ] `WorldGraphCampaign` owns one canonical `MapDefinition` catalog;
      `ScenarioDefinition.mapId` resolves into it; and `initialState` has one documented,
      deterministic conversion from the selected definition plus scenario placements to
      mutable `WorldMap` state.
- [ ] Campaign envelope identity is distinguished from nested definition identity.
- [ ] Source text, runtime `LocKey`s, default materialization, and canonical order follow
      `04-core.md` §10.1 with no second loader model.
- [ ] Terrain, incidents, and guest needs are reconciled against W42; the MVP can represent
      thirst and toilet without an engine code change per campaign.
- [ ] Building entrance offsets have one coordinate meaning and use W42's rotation transform.
- [ ] Conditions, effects, placement rules, and adjacency inputs are discriminated unions,
      not string expressions or extension bags.
- [ ] Every numeric field states units, scale, range, and null/optional meaning.
- [ ] MVP-required and post-MVP fields are distinguishable at their definitions.
- [ ] The minimum-valid example can author the Sun Trap slice: map, one archetype, drink
      stand, toilet/trash point, drink, cleaner, litter, objective, and failure.
- [ ] The invalid example demonstrates malformed id/reference, localization, footprint/
      entrance, and range failures with exact validation paths.
- [ ] Every necessary §3 amendment is listed in the W43 reconciliation table; unrelated W42
      state is unchanged.
- [ ] §15 contains checkable Tier 1/Tier 2 rules for every new type and reference.
- [ ] `plans/39` and `TODO.md` mark W43 planned/ready and leave W44 as next after execution.
- [ ] `./build/Test-Documentation.ps1` passes and `git diff --check` is clean; no
      `src/engine/` file changed.

---

## Explicitly Not In Scope

- **No engine code.** W45 reviews the existing `feature/w45-world-graph-kind-skeleton`
  draft against the merged W42–W44 contract, then aligns the world-graph state/content
  modules, `initialState`, validation, projection/outcome, assembly, and nine immediate
  reducers. The 20-system tick pipeline remains W46.
- **No W44 resolution design.** System order, A*, utility formula composition, queue/service
  timing, simultaneous events, rounding, and tie-breaking remain W44.
- **No balance values.** Sun Trap chooses weights, prices, rates, thresholds, `ticksPerDay`,
  and authored content instances.
- **No companion-repository edits.** Sun Trap's design docs are primary sources and may need
  a later retirement/reconciliation change after this contract merges.
- **No preview/client work.** `previewAction` and the ten-operation client/MCP parity change
  remain W48.
- **No pack mechanism.** `11-content-packs.md` already owns resolution and identity.
