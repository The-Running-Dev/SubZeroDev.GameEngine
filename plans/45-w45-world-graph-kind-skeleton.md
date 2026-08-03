# W45 — The World-Graph Kind Skeleton and Immediate Actions

**Scope:** Plan the first code unit for the `world-graph` kind: align the preserved
implementation draft with the completed W42–W44 contract, implement the source/runtime
content boundary and total validation, materialize deterministic tick-zero state, assemble
the production kind, expose its supported package surface, and implement the nine actions
that do not pass time. The 20-system tick pipeline remains W46.

**Depends on:** W42's merged runtime-state contract (PR #116), the consolidated W43 contract
([PR #119](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/119)), and the
consolidated W44 contract
([PR #120](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/120)). This PR is
stacked on #120 so its review diff contains only W45 planning and implementation.

**Programme:** [`plans/39-world-graph-kind-programme.md`](39-world-graph-kind-programme.md),
W45. This is the kind skeleton and immediate-action unit. W46 owns elapsed-time behavior.

**Status:** Implemented and reconciled in
[PR #125](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/125), with
[PR #124](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/124) retained as the
original implementation review. The canonical contract is the marked
`engine/12-world-graph-kind.md` block in `design/20-contract.md`; this plan is execution
history and verification context, not a second contract authority.

---

## Historical Handoff — Completed

### The prompt

> This completed W45 pass reconciled the preserved implementation against the merged contract.
> Its implementation history and evidence remain here; edit the canonical contract in
> `design/20-contract.md`, not this record. W46 owns the tick pipeline.

### Where to work

- **Existing implementation draft:** `feature/w45-world-graph-kind-skeleton`, currently
  commit `0135e30`.
- **Authoritative contract:** `design/20-contract.md`'s `engine/12-world-graph-kind.md`
  block, especially §§3 and 6–15.
- **Core seam:** `src/engine/src/core/kernel/types.ts`, registry/build/validation modules,
  and the production story-graph/simulation kind assemblies.
- **Public boundary:** `src/engine/src/index.ts` and W41's explicit root-export rule in
  [`plans/40-w41-engine-consumer-boundary.md`](40-w41-engine-consumer-boundary.md).
- **Programme ledgers:** `plans/39-world-graph-kind-programme.md` and
  `design/30-slices.md`'s generated `engine/TODO.md` block.

### Working rules that are easy to violate here

1. The merged contract wins over the preserved branch, even where the branch has a passing
   test for the old behavior.
2. Reuse a draft helper only after its types, invariants, and rejection ordering have been
   checked against the final contract. Passing pre-W43 tests are evidence of internal
   consistency, not specification compliance.
3. Keep `advance_ticks` unavailable in W45. Incrementing `tick` without running systems
   changes canonical state to a world the contract can never produce.
4. Every runtime id comes from `nextEntityOrdinal` in the exact allocation order named by
   §§3.1 and 6. No alert, helper object, array length, clock, or host id source may consume
   an ordinal accidentally.
5. Validation, scenario placement, the `build` reducer, build options, and W46 pathfinding
   share spatial primitives. A second geometry or reachability rule is a defect.
6. `Campaign.content` enters as `unknown`. Validation must reject malformed roots and nested
   values as structured findings rather than throwing through an unchecked cast.
7. The source builder is mechanical and pure; Tier 1/Tier 2 validation remains a separate
   pass. Neither parses files, simulates ticks, or performs I/O.
8. The root package barrel uses explicit named exports only. Do not expose every internal
   helper merely because it exists.
9. No accepted immediate action advances `tick`, invokes a tick system, draws randomness,
   or reads `ctx.seq`/`ctx.rng`.
10. Do not extract a core spatial/action framework. One implemented world-graph kind is not
    a cross-kind abstraction.

---

## Measured Starting Point

The preserved branch is not speculative. Against its current W42-era base it contains 13
changed files, 2,842 inserted lines, and these checks pass:

```text
npm run typecheck  → pass
npm run lint       → pass
npm test           → 59 files, 712 tests passed
```

That baseline is worth keeping because it proves the dispatcher, engine-seam integration,
event plumbing, `StateChange` path tests, rejection immutability, and immediate-action test
harness can work together. It does **not** prove alignment with W43/W44, which did not exist
when most of the draft was written.

### Salvage boundary

| Draft area | Disposition | Why |
|---|---|---|
| accepted/rejected result helpers | Keep after typing/reason audit | They already preserve rejected state and return `set`-with-previous audit rows |
| primitive parameter parsing | Keep and tighten | The action envelope still carries only primitive values, but parameter names and exact optionality changed |
| reason-code message table | Keep after completeness check | Its 13 kind codes match §11; registration/default-string integration still needs proof |
| event emission wrapper and namespace | Keep after catalog audit | The core emitter seam is unchanged; payloads and producing reducers need correction |
| `StateChange` path grammar tests | Keep and expand | They captured a real contract rule and should guard all new state paths |
| production `Kind` assembly pattern | Keep structurally | The object shape is correct, but its content, event list, source builder, and public exports are incomplete |
| runtime state types | Replace against §3.2 | The draft predates W43/W44 and carries removed duplicates while missing required durable state |
| campaign types and validator | Replace against §§14–15 | The draft models a small bespoke campaign rather than the source/runtime contract and is not total over `unknown` |
| initial state | Rewrite | It copies an authored runtime map, skips invalid entries, omits scenario selection/setup resolution, and does not receive `ctx` |
| geometry/reachability | Rewrite as shared primitives | It hard-codes four-neighbor BFS and terrain strings rather than authored directed topology, definition entrances, and canonical path rules |
| immediate reducers | Reconcile one by one | Their basic dispatcher is useful, but allocation, cleanup, status, and definition lookups follow obsolete types |
| projection/available actions/outcome | Rewrite against §§7–10 | They read removed fields and reconstruct terminal identity instead of reading immutable resolution |
| counter-only `advance_ticks` | Delete | It makes batch invariance vacuously green while skipping every normative system |

---

## Findings That Shape the Implementation

### 1. The old state graph is not a partial version of the final one

The draft is missing `failures`, `resolution`, counters, unlocks, policies, achievements,
scenery, inventory, typed guest intent, staff paths, incident position/amount, alert semantic
identity/clear state, and construction's reserved queue id. It still stores removed
definition copies and aliases: terrain traits, `Building.isOpen`, product ids,
`Queue.productId`/capacity/patience, incident severity/text, and tick-named construction
effort. Incremental patching would leave the most drift-prone type closure half old and half
new. `state.ts` must be re-derived field-for-field from §3.2.

### 2. The content implementation is the largest part of W45, not incidental scaffolding

The draft's `campaign.ts` has one embedded map plus three small definition arrays. The final
contract has a source/runtime pair, a campaign-owned map catalog, five documented source
defaults, 17 definition catalogs, a shared condition/effect/metric language, scenario
selection, and localization lifting. W45 must implement those shapes and the pure
`buildWorldGraphCampaign` walker before `initialState` or reducers can honestly resolve
content.

### 3. Total validation starts at the unknown root

The current validator immediately casts `campaign.content as WorldGraphCampaign` and then
dereferences arrays. `null`, a scalar, or a malformed hand-authored object can throw rather
than return Tier-1 findings. W45 is the programme's explicit revisit point for this problem:
the world-graph validator first performs structural narrowing over `unknown`, accumulates
path-specific findings, and only then runs semantic/reference checks. The core remains
kind-agnostic and the other two kinds are not silently changed in this unit.

Runtime functions may consume a validated `WorldGraphCampaign` because
`buildValidatedContentRegistry` is the sanctioned registry boundary. Centralize that
assumption in one internal accessor/type guard rather than repeating bare casts throughout
the kind. A lower-level caller that deliberately uses unvalidated `buildContentRegistry`
continues to own the risk already documented by the core.

### 4. W45 needs the canonical spatial substrate even though guest movement is W46

`build`, scenario placement, projection blockers, and validation already need footprint
rotation, authored entrances, placement rules, directed reachability, and dynamic blockage.
Leaving canonical A* entirely to W46 would force W45 to ship a temporary BFS rule and replace
it one unit later—the exact duplicate the contract forbids. W45 therefore implements the
pure graph/materialization/placement/path primitive now; W46 later calls it from systems 6,
7, 9, 10, and 11. W45 does not implement any agent movement system.

### 5. The current build reducer consumes the wrong ids and invents an alert

The draft allocates building, queue, and a construction alert, then advances the ordinal by
three. §6 requires building+queue for immediate work or site+reserved-building+reserved-queue
for timed work. Alerts are derived by system 19 from its three closed families; placement is
not one of them. W45 must remove that alert, implement both construction paths, charge once,
and increment `map.revision` when the footprint becomes blocked.

### 6. Several apparently small reducers encode obsolete authority

- `hire_staff` accepts `roleId`, spawns at `(0,0)`, and lacks path progress; the contract
  accepts `definitionId` and starts at the row-major first exit with empty route state.
- open/close writes both `isOpen` and `status`; only `status` exists now.
- `set_price` reads copied product lists instead of the placed definition's service products.
- demolition clears old nullable guest targets but not the final intent/task/incident graph,
  and does not update map revision.
- outcome derives failure from a failed objective; final identity lives only in
  `WorldResolution` and separate `FailureProgress`.

These are not cleanup tasks. Each reducer needs a before/after invariant and exact reference
cleanup test against the final types.

### 7. A fake clock is worse than a temporarily unavailable verb

The current `advance_ticks` adds the requested count directly to `tick`. It passes a split-
batch test because nothing else changes, but it produces state unreachable by the normative
pipeline. In W45 the verb remains present in the action registry and is disabled with the
base `action_not_available` reason. W46 replaces that deliberate rejection with the bounded
20-system loop and its `ticks_not_positive`/`tick_limit_reached` validation.

---

## Decisions

### 1. Preserve the execution history in the consolidated PR

Merge the published `feature/w45-world-graph-kind-skeleton` history into #124's branch. Do
not rebase, force-push, cherry-pick only the useful commits, or delete the old work. Its
history explains why W42 contract corrections happened. #124 contains the plan and final
implementation together and targets #120 for an exact W45 review diff.

### 2. Split by ownership, not by one file per interface

The final implementation should use these responsibilities (exact filenames may combine
only when the ownership remains obvious):

| Owner | Responsibility |
|---|---|
| `state.ts` | Exact §3.2 runtime closure and state-only invariants |
| `content.ts` | Runtime definitions, shared closed unions, and campaign root |
| `source.ts` | Source aliases/types, localization extraction, defaults, canonicalization, and `buildWorldGraphCampaign` |
| `spatial.ts` | Map materialization, rotation, footprint/entrance resolution, placement rules, blockage, and canonical path query |
| `conditions.ts` | Pure metric/condition evaluation reusable by setup and W46; no effects/system timing |
| `validate.ts` plus focused helpers | Unknown-root narrowing, Tier 1 semantic/reference checks, Tier 2 warnings, safe-integer/depth checks |
| `initial.ts` | Scenario/map selection, state materialization, setup resolution, and exact id allocation |
| `actions/*` | Parsed immediate reducers grouped as build/demolish, staff, building operation, and alerts; shared result/change helpers |
| `advance.ts` | Dispatcher only, including deliberate W45 rejection of `advance_ticks` |
| `available.ts`, `view.ts`, `outcome.ts` | Read surfaces with one placement-independent blocker source and immutable terminal identity |
| `reasons.ts`, `kind.ts`, root `index.ts` | Registries, production assembly, and explicit public surface |

Do not preserve the 834-line all-actions file merely to minimize the diff. Conversely, do
not split every type into a directory tree that makes the contract harder to trace.

### 3. The source builder performs exactly the W43 mechanical conversion

`buildWorldGraphCampaign(source)`:

1. walks every `AuthoredDefinitionText` in stable source traversal order;
2. collects `AuthoredText` and replaces it with `LocKey`s;
3. materializes only the five documented omitted catalogs as empty arrays;
4. passes its collected text to the existing generic `buildCampaign` path, which rejects
   conflicting key/text pairs;
5. canonicalizes definition catalogs, ids, tags, positions, explicit edges, curves, and
   scheduled changes exactly as §14.8 states;
6. preserves authored order only for effects, condition children, and scenario placements;
7. returns plain arrays/objects—no serialized `Map`, indexes, caches, or class instances.

Builder tests compare source input, runtime output, lifted string table, defaults, and
canonical order independently of validation.

### 4. Validation is exhaustive in behavior, not one monolithic function

Validation proceeds in four passes:

1. **Shape narrowing:** object/array/discriminator/primitive presence with exact array-index
   paths; invalid structure never throws and does not cause unsafe deeper traversal.
2. **Local domain checks:** integers/ranges, ids, text keys, geometry, curves, capacities,
   task/incident pairings, and expression depth.
3. **Reference and cross-field checks:** every namespace, definition-closed record/key set,
   selector context, scenario pairing, placement parity, and safe-integer bounds.
4. **Tier 2 graph/reachability checks:** legal but suspicious disconnected/unreachable or
   inert content, without simulating ticks.

Use small path-aware validators and catalog indexes built in local scratch. Report every
independent finding reachable without guessing a malformed value's intended type. Do not
short-circuit the whole campaign after the first error, and do not manufacture partial
runtime content as a fallback.

### 5. `initialState` materializes one complete, canonical tick-zero world

Setup must:

- resolve `startScenarioId` and its `mapId` from already validated runtime content;
- expand terrain overrides and topology into row-major terrain and canonical directed edges;
- apply starting cash, unlocks, active policies, zeroed counters, objective/failure rows,
  empty achievements/alerts/incidents/agents, `resolution: null`, and `map.revision: 0`;
- allocate every pre-placed building then its queue in authored placement order, then every
  scenery id, leaving the exact next ordinal;
- materialize prices/inventory from definitions and status from the placement's `open` flag;
- evaluate objective/failure facts once against the completed setup snapshot, apply scenario
  precedence, and persist progress plus immutable resolution without running completion
  effects or any tick system;
- use only `ctx.derive({ kind: "tick", tick: 0, system })` if a setup rule explicitly needs a
  draw; current deterministic placement/setup consumes none.

No invalid placement is silently skipped. A validated campaign makes every lookup total;
defensive invariant failure should be explicit in development/tests rather than producing a
smaller world whose ids no longer match the authored scenario.

### 6. One spatial rule serves validation, setup, reducers, and later systems

The spatial module owns:

- §3.3's exact integer rotation transform for footprints and entrance offsets;
- orthogonal-grid and explicit directed-edge materialization;
- terrain lookup through `TerrainDefinition`, not hard-coded terrain names;
- dynamic blocking by buildings/sites and `map.revision` invalidation;
- universal bounds/non-overlap plus every typed `PlacementRule`;
- at least one valid walkable entrance approach and canonical reachability from a spawn;
- canonical path cost/tie behavior from §9.3, with cache disabled by default in W45 tests.

Scenario validation and `build` call the same placement function and receive typed failure
causes mapped to §11 reason codes. Projection asks only the placement-independent blocker
helper. W48's future preview calls the reducer itself; it gets no separate validator.

### 7. Immediate reducers have exact allocation and cleanup semantics

All nine reducers parse only declared primitive params, reject before mutation/allocation,
return the original state object on rejection, emit no accepted event/change for a no-op,
and leave `tick` unchanged.

| Action | Required W45 behavior |
|---|---|
| `build` | Resolve unlocked definition and scenario limit; check funds and shared placement; charge construction cost once; immediate path allocates building then queue, timed path allocates site then reserved building then reserved queue; block footprint and increment revision; immediate placement emits `building.placed`, while timed work emits no invented `construction.started` event |
| `demolish` | Remove the building, preserve FIFO survivors only where their queue survives (it does not here), materialize deterministic fallback intents for affected guests, clear staff assignments/tasks and incident ownership without dangling ids, increment revision, and emit the declared removal records |
| `hire_staff` | Accept `{ definitionId }`; resolve scenario role limit and funds; allocate one staff at the row-major first exit with empty path, zero indexes/progress, no assignment/task, and charge once |
| `fire_staff` | Remove one staff member and its nested task; clear any other state reference proven to target that staff; allocate nothing |
| `assign_staff` | Accept independently optional building/zone ids; validate each supplied id; omitted both clears both assignments; replace assignment atomically and cancel incompatible active work rather than leave a dangling target; W46 replans later work |
| `set_price` | Require an existing open service building and product from its definition; validate integer cents against the product band; write the one closed record key and one scalar audit |
| `open_building` / `close_building` | Use `status` as sole authority; only closed↔open is a player toggle; a broken building cannot be opened by this action; clear an invalid service clock on closure |
| `dismiss_alert` | Timestamp an existing uncleared/undismissed alert; repeat dismissal is an accepted no-op; allocate nothing |

Reducer cleanup must pass a referential-integrity assertion over queues, guest intents,
staff tasks/assignments, incidents, and alerts after every accepted mutation. Do not defer
repair to system 20: no time passes in these actions.

### 8. Read surfaces share authoritative helpers

- `outcome` reads `state.resolution` only and returns published objective/failure ids.
- `project` matches §10 exactly: no `isOpen`, hidden triggers, caches, or utility traces.
- `buildOptions` and `availableActions` call the same placement-independent blocker helper
  as the reducer; blocker order is stable and contains only §11 codes.
- `availableActions` lists every verb. `advance_ticks` is present but unavailable in W45
  with `core.reason.action_not_available` until W46 replaces the guard.
- `scene` renders tick/cash/count/objective summary from integer state without introducing a
  second view model or balance-sensitive hidden facts.
- dismissed/cleared alerts are filtered according to the persisted lifecycle fields, not
  deleted by projection.

### 9. Public exports are the consumer contract

Add explicit root exports for:

- runtime values: `worldGraphKind`, `buildWorldGraphCampaign`;
- authoring/runtime roots: `WorldGraphCampaignSource`, `WorldGraphCampaign`;
- consumer-visible kind types: `WorldGraphKindState`, `WorldGraphView`,
  `WorldGraphOutcome`.

Keep definition leaf types internal unless Sun Trap must name one to author typed content;
when it does, export that exact named type explicitly rather than `export *`. Add a packed-
tarball smoke assertion that these declarations and runtime values resolve from the package
root. Internal validators, action helpers, indexes, and spatial caches are not public API.

### 10. Preserve only events and changes W45 can really emit

`Kind.eventNames` in W45 declares only the action events its reducers actually emit and no
tick-system names it cannot emit. It may add `batch.started`/`batch.ended` only when W46 lands; declaring them
while every batch is rejected makes the registry overstate current behavior. Reason codes
remain the §11 set, with base codes reused for malformed params, unavailable actions, ended
sessions, and unmet requirements.

Every accepted state mutation uses §13's scalar/member path grammar, `op: "set"`, after
value, optional previous value, and documented visibility. Test every emitted path by
resolving it against the returned state or the one synthetic `.exists` membership rule.

---

## Verification Matrix

### Content and validation

- The minimum §15.1 source builds to the exact runtime shape, lifts every string, applies
  exactly five defaults, and remains stable under canonicalizable input shuffles.
- Conflicting source text fails through the composed world-graph plus generic campaign-build
  path; malformed `unknown` roots/nested values return Tier-1 findings without throwing.
- One focused fixture covers each §15 Tier-1 family and Tier-2 warning family, including
  exact array-index paths, expression depth, safe-integer bounds, and selector context.
- Scenario placement validation and the build reducer return the same geometry result for
  the same definition/map/position/rotation.

### Initial state and read surfaces

- Two creations with identical campaign/seed serialize byte-identically and allocate the
  exact placement/scenery ids and next ordinal.
- Setup covers orthogonal and explicit topology, terrain overrides, rotations/entrances,
  finite/unlimited inventory, starting open/closed status, objectives/failures, and both
  simultaneous precedence values.
- Cache/emitter choice does not alter initial state, view, actions, scene, or outcome.
- Projection has no envelope duplicates or hidden fields; outcome does not reconstruct a
  winner from mutable progress.

### Immediate actions

- Every action covers success, every distinct rejection code/order, accepted no-op, event,
  changes, exact allocation, and the no-time-passes invariant through the real engine seam.
- Immediate/timed build and pre-placement ids remain numeric-ordinal canonical beyond 9;
  rejected actions allocate nothing and append no action log entry.
- Build tests cover bounds, terrain/zone/distance rules, rotation, overlap, directed
  reachability, locked/limited/unaffordable definitions, reserved completion ids, and map
  revision.
- Demolish/fire/assign/close tests seed guests, queues, tasks, incidents, and alerts to prove
  no dangling reference survives.
- `buildOptions`, verb availability, and reducer placement-independent rejections agree for
  every definition.
- `advance_ticks` is advertised unavailable and rejection leaves state/action log unchanged;
  there is no counter-only success test.

### Package and repository gates

- `worldGraphKind` works through `createEngine`, `buildWorldGraphCampaign`,
  `buildValidatedContentRegistry`, `createGame`, scene/view/action calls, serialization, and
  the recording/null emitters.
- The packed-tarball consumer imports every supported W45 root symbol with no deep path.
- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, documentation checks,
  `git diff --check`, and all three required PR checks pass.

---

## Sequence

1. **Wait for and merge the complete prerequisite chain.** Sync `main`, merge it into the
   preserved W45 branch, and rerun the pre-reconciliation baseline.
2. **Replace the state/content type graphs** from merged §§3 and 14 before touching reducers.
3. **Implement the source builder and fixtures** so later tests create content through the
   same public boundary Sun Trap will use.
4. **Implement total narrowing and Tier-1 local/reference validation**, then Tier-2 graph
   warnings. Close or update the world-graph part of the unguarded-content entry in
   `OPEN-QUESTIONS.md` without claiming the other kinds are fixed.
5. **Build the shared spatial foundation** and prove validation/setup/reducer parity.
6. **Rewrite `initialState` and condition/setup resolution**, then projection, outcome,
   available actions, and scene.
7. **Reconcile immediate reducers in allocation order:** build/demolish, hire/fire/assign,
   set price/open/close, dismiss alert. Remove the counter-only batch implementation.
8. **Assemble registries and public exports**, including default reason strings and packed-
   artifact coverage.
9. **Expand integration/determinism tests** through the real engine seam; keep W46 system
   fixtures absent.
10. **Update programme/TODO review status** only after the execution PR exists. Do not mark
    W45 delivered or advance the public roadmap until merge.

---

## Done-When

- [x] The existing W45 branch is merged forward from current `main` without rewritten
      published history, and its old green baseline is recorded before reconciliation.
- [x] Runtime state and content source/runtime types match the merged W42–W44 contract with
      no removed alias/copy remaining.
- [x] `buildWorldGraphCampaign` lifts localization, applies exactly five defaults, and
      canonicalizes only the collections §14.8 names.
- [x] Validation is pure, total over `Campaign.content: unknown`, path-specific, and covers
      every §15 Tier-1/Tier-2 family without simulation or I/O.
- [x] One shared spatial implementation serves topology materialization, placement,
      validation, reachability, and later W46 path consumers.
- [x] `initialState` resolves scenario/map content, allocates every initial id exactly,
      initializes the complete state closure, and persists correct tick-zero resolution.
- [x] Projection, scene, action availability, and outcome match §§7–10 and leak no hidden or
      duplicated envelope state.
- [x] All nine no-time-passes reducers use final content/state authority, exact allocation,
      complete reference cleanup, declared events, and resolvable audit paths.
- [x] No accepted immediate action changes `tick`, draws randomness, invokes a system, or
      reads the caller's action sequence.
- [x] `advance_ticks` cannot succeed until W46 supplies the complete one-tick pipeline.
- [x] The production `worldGraphKind`, authoring builder, and supported types are explicit
      root exports and pass the packed-tarball consumer test.
- [x] The engine-owned minimum campaign reaches `createGame` and every immediate action
      through the validated registry and real engine seam.
- [x] Rejected actions preserve object/state/action-log identity and allocate/emit nothing;
      accepted no-ops emit no false mutation.
- [x] The retained draft helpers/tests are individually reconciled; no old test survives
      solely by asserting superseded behavior.
- [x] Programme/TODO ledgers show W45 accurately, while public delivery remains unchanged
      until the implementation merges.
- [ ] Engine typecheck, lint, tests, build, packed-artifact smoke, documentation gate,
      `git diff --check`, and all three required PR checks pass.

---

## Explicitly Not In Scope

- **No 20-system tick pipeline.** W46 implements systems 1–20, bounded batch execution,
  derived tick/agent streams, batch aggregation, and real batch invariance.
- **No successful `advance_ticks`.** W45 must not preserve or replace the draft's counter-
  only shortcut.
- **No Sun Trap balance/content.** The engine owns types and the synthetic minimum fixture;
  the companion owns concrete maps, scenarios, prices, curves, and play balance.
- **No client/MCP preview operation.** `previewAction` and ten-operation parity remain W48.
- **No replay-corpus scenario.** Winning/losing world-graph fixtures remain W49; W45 tests
  construction and immediate actions, not playability.
- **No content-pack mechanism.** `11-content-packs.md` already owns resolution and identity.
- **No save migration.** This is the first production version of the kind state. Add a
  migration only after a released version needs one.
- **No repo-wide content-cast rewrite.** W45 establishes a total world-graph boundary at its
  explicit programme revisit point; story-graph/simulation migration to that convention is
  a separately reviewed core/kind concern.
- **No shared core spatial/action framework.** Revisit only after a second implemented
  consumer proves a common abstraction.
- **No public roadmap completion claim.** Planning and an open execution PR are not merged
  delivery.
