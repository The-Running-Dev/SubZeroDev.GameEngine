# The `world-graph` Kind — Programme

**Units:** [`docs/docs/engine/TODO.md`](../docs/docs/engine/TODO.md) — *Depth: Sun Trap*.
Proposed as **W41–W49**, numbers assigned when each is cut.

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
unit here (W48) rather than folded silently into validation/corpus (W49), so its own review
doesn't have to compete with an unrelated concern for attention.

### 5. The tick-substrate deferral's own "revisit when" condition is now met — and the answer is still "not yet"

`OPEN-QUESTIONS.md` §2 (echoed in `plans/33` Decision 2) declines a shared tick-pipeline
substrate with a stated trigger: *"revisit when the second tick-driven kind is
implemented."* This programme is that kind, cut before implementation, not after — the
condition names *implemented*, not merely scheduled. The call stands unchanged: extract
nothing until this kind's own tick pipeline (W46) is real code and a second, independent data
point exists to generalize from. Restated here rather than silently re-applied, since the
trigger being *close* is exactly the situation `OPEN-QUESTIONS.md` itself asks to be
recorded, not just remembered.

### 6. Package consumability is the programme's entry unit, not a postscript

Auditing the engine's own consumability found a genuine gap: `src/engine/package.json` is
`"private": true`, has no export map or public barrel, and has no publish workflow. Every
existing campaign and kind has therefore been proven only by fixtures inside this repository,
never by a real companion consumer. Sun Trap's implementation programme now makes that gap
an explicit M1 gate before its world-graph work.

The mechanism is decided here rather than deferred: keep the current `src/engine/` source
layout and publish **`@the-running-dev/game-engine` as a private npm package in GitHub
Packages**, linked to this repository. Companion CI installs an exact semver through the npm
registry with package read access; local sibling links may be convenient experiments but are
never acceptance evidence. GitHub Packages requires a scoped, lowercase npm name, supports a
repository-linked private package, and permits a separately granted companion repository to
read it with `GITHUB_TOKEN`. That makes a Git reference or a mutable `file:` dependency
unnecessary and gives both repositories one immutable boundary.

This does not require world-graph code to exist first. W41 proves the public surface with the
already-built core and kinds; later units add world-graph exports as those symbols become
real. It is therefore safe infrastructure before the contract units, not an exception to
contract-first implementation.

### 7. A small doc defect, fixed alongside this plan: `tick_limit_exceeded` vs `tick_limit_reached`

`12-world-graph-kind.md` §6 refers to the tick-cap rejection as `tick_limit_exceeded`; §11's
own canonical reason-code table names it `tick_limit_reached`. One is a stale cross-
reference to the other — §11's table is the canonical list (the same role `10-simulation-
kind.md` §10's table plays), so §6 is corrected to match. Fixed in the same commit as this
plan; too small to hold up behind a full unit.

---

## The Split

### Consumer boundary (before kind contract and code)

| W | Unit | Scope |
|---|---|---|
| **W41** | Companion-package consumer boundary | Public root entry point and export map; declaration-bearing ESM artefact; private GitHub Packages publication; packed-tarball consumer smoke test; CI build/publish gates; companion authentication and exact-version contract |

This is infrastructure around already-built code, not world-graph implementation. It can
land before the kind contract without violating Decision 1.

### Contract (doc-only, must complete before any code)

| W | Unit | Source | Scope |
|---|---|---|---|
| **W42** | State types | `content-and-systems.md` §§2–9 | `ResortMap`, `Guest`, `Building`, `Queue`, `Staff`, `ConstructionSite`, `Finances`, `Loan` — ported into `12-world-graph-kind.md` §3, replacing today's top-level-only sketch |
| **W43** | Content-definition types | `game-design.md` (needs, opinions, adjacency, placement, incidents), `content-and-systems.md` §10's one-paragraph list | `GuestArchetypeDefinition`, `BuildingDefinition`, `StaffRoleDefinition`, `ProductDefinition`, `ScenarioDefinition`, `ObjectiveDefinition`, `IncidentDefinition`, `TerrainDefinition`, `PolicyDefinition`, `AchievementDefinition` — genuinely new design, not transcription (Finding 2) |
| **W44** | Resolution and systems detail | `12-world-graph-kind.md` §4, §9, `content-and-systems.md` §§8–9 | The 20-system tick-pipeline order restated against real types; utility-scoring and pathfinding cost-model shapes; tie-breaking rules already normative in §9, restated alongside the functions that implement them |

Split by type cluster with a natural review boundary, the same reasoning `plans/36` gave for
its own four-way split: each is reviewable on its own, and W43 in particular needs room to be
judged as design, not skimmed as a port.

### Build (code, against the completed contract)

| W | Unit | Mirrors |
|---|---|---|
| **W45** | State types as code, `initialState`, the eight immediate-mutation actions | `simulation`'s W36, minus the plan concept (Finding 3) |
| **W46** | The 20-system tick pipeline | `simulation`'s W37 — pipeline + honest stubs, the same discipline |
| **W47** | The MVP vertical slice: spawn → walk → queue → buy → litter → clean → win/lose | `simulation`'s W39 |
| **W48** | `previewAction` across `Engine`/`SessionStore`/text client/MCP, plus the ten-operation amendment to `09-clients.md` §4 and `MVP.md` §5 | Not mirrored by `simulation` — genuinely new, cross-cutting (Finding 4) |
| **W49** | Validation, the MVP scenario, replay corpus | `simulation`'s W40 |

Five build units against three contract units — one more on each side than `simulation`'s
3-and-3, for reasons Findings 2 and 4 already state: content-definition types are real
design work here, not transcription, and `previewAction` is real cross-cutting surface area
`simulation` never had to touch. W41 is a delivery unit around the whole engine rather than
a sixth kind build unit.

---

## Checkable Delivery Ledger

This is the programme-level source of truth. A unit may expand these items in its own plan,
but it may not silently drop them. Check a box only when merged evidence exists.

### Baseline — evidenced before implementation

- [x] Sun Trap has an implementation programme and an MVP boundary to size against.
- [x] `tick_limit_reached` is the single canonical tick-cap reason code in the contract.
- [x] Engine-owned mechanical types versus game-owned concrete values is explicit in §17.
- [x] `KindContext.derive` and the `tick`/`agent` stream variants already exist.
- [x] The current package gap and current package layout have been audited.
- [x] The companion delivery mechanism is decided: private GitHub Packages npm artefact.

### W41 — companion-package consumer boundary

**Plan:** [`plans/40-w41-engine-consumer-boundary.md`](40-w41-engine-consumer-boundary.md) —
current package state measured rather than recalled, the public API inventory, and a
scratch-directory prototype that proved the whole boundary end to end (packed tarball →
clean consumer → `tsc --noEmit` exit 0 → runtime `createGame` exit 0) before any repository
file was changed.

**Merged:** [PR #108](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/108).
Everything below is ticked against merged evidence verified on `main` at `db9c62a` — the
three new CI steps were confirmed running (not merely present) in that commit's own workflow
run. The two publication boxes are the repository owner's and remain open.

- [x] Cut a focused W41 plan with current package contents and intended public API inventory.
- [x] Rename the npm package to the lowercase scoped name `@the-running-dev/game-engine`.
- [x] Keep `src/engine/` as the source package; do not relocate it to satisfy stale `packages/` prose.
- [x] Add one root public entry point that exports only supported core, registry, session,
      projection, client and built-kind symbols.
- [x] Add `types` and ESM `import` targets through `package.json#exports`; deep source imports
      remain unsupported.
- [x] Restrict the packed artefact to runtime output, declarations, package metadata and
      required documentation; exclude tests, fixtures and source-only internals.
- [x] Link package metadata to this repository and configure publication to
      `https://npm.pkg.github.com`.
- [x] Make a clean package build produce complete JavaScript, declarations and source maps.
- [x] Add a consumer smoke project that installs the packed tarball and imports only the root
      package name.
- [x] Make the smoke project construct an engine/registry path and typecheck under Node 24.
- [x] Run package build, tarball inspection and consumer smoke in required CI.
- [x] Add a tag/manual release workflow with least-privilege `packages: write` permission.
- [x] Document developer authentication without committing credentials or tokens.
- [x] Publish the first package version and grant Sun Trap Actions read access. Published as
      `@the-running-dev/game-engine@0.4.0` on the `v0.4.0` tag, 2026-08-02. **No grant was
      needed: it published public, not private as Decision 4 specified** — see the visibility
      entry in [`OPEN-QUESTIONS.md`](../docs/docs/engine/OPEN-QUESTIONS.md).
- [x] Record the exact package coordinate, version and permissions for Sun Trap's M1 handoff;
      the companion repository owns its own dependency and CI change. Recorded in
      [`plans/40`](40-w41-engine-consumer-boundary.md)'s Done-When.
- [x] **Gate:** a clean external consumer installs, imports, typechecks and constructs the
      engine using only supported exports. Met by `consumer-smoke/`, which installs the packed
      tarball rather than linking the source — the distinction Decision 4 turns on.

**T0 is reached.** W41 is merged and `@the-running-dev/game-engine@0.4.0` is published — the
two facts T0 names. A clean companion can install and construct the engine through one
supported public surface, which is what the milestone was for. The visibility deviation is
recorded rather than waved through, and it does not affect installability.

<details>
<summary>Superseded wording, kept because it dated the milestone</summary>

**T0 is therefore not reached.** W41 is merged; the first version is not published, and T0
names both.

</details>

### W42 — authoritative runtime-state contract

- [ ] Cut the W42 doc-only plan and inventory every field in Sun Trap §§2–9.
- [ ] Specify map dimensions, tiles, entrances, occupancy and deterministic coordinate rules.
- [ ] Specify guest identity, position, needs, target, path, inventory, opinions and lifecycle.
- [ ] Specify building, product, queue and service state without embedding content definitions.
- [ ] Specify staff role, assignment, position, path, task and lifecycle.
- [ ] Specify construction, finances, loans, counters and `nextEntityOrdinal` ownership.
- [ ] Define which collections are records, arrays or ordered lists and their canonical order.
- [ ] Reconcile nullability, units, integer ranges and tick semantics across both repositories.
- [ ] Define `WorldGraphView` and terminal outcome data without leaking hidden state.
- [ ] **Gate:** every runtime field read by a planned system has one authoritative type and
      one documented owner.

### W43 — content-definition contract

- [ ] Cut the W43 doc-only design plan; do not treat this unit as a mechanical port.
- [ ] Separate authoring/source definitions from validated runtime content where necessary.
- [ ] Define terrain, scenery, building, product, staff-role and guest-archetype definitions.
- [ ] Define scenario, objective, incident, policy and achievement definitions.
- [ ] Define stable ids, cross-reference rules, localization/text ownership and defaults.
- [ ] Define footprint rotations, entrances, placement constraints and adjacency effects.
- [ ] Define need curves, utility inputs, patience, budgets, service rates and litter effects.
- [ ] Mark fields required for the MVP versus valid post-MVP extension points.
- [ ] Add worked minimum-valid and representative-invalid content examples.
- [ ] **Gate:** the MVP scenario can be authored without an untyped extension object or a
      duplicate Sun Trap interface.

### W44 — resolution and systems contract

- [ ] Cut the W44 doc-only plan and freeze the named 20-system order.
- [ ] Define each system's inputs, outputs, no-op conditions and emitted state changes/events.
- [ ] Define utility scoring, integer scaling, tie-breaking and unreachable-target behaviour.
- [ ] Define A* neighbourhood, cost model, heuristic, canonical open-set ordering and cache rule.
- [ ] Define queue admission, abandonment, service ordering and simultaneous-event semantics.
- [ ] Define staff task selection, movement, work completion and deterministic tie-breaks.
- [ ] Define construction, finance, incident, objective and terminal-check timing.
- [ ] Define batch-invariance comparison and action-log differences that are intentionally ignored.
- [ ] Reconcile reason-code and event-name registries with every action and rejection path.
- [ ] **Gate:** no implementation unit needs to invent a state field, ordering rule, formula
      shape or tie-break.

### W45 — kind skeleton and immediate actions

- [ ] Cut the W45 code plan against the merged W42–W44 contract.
- [ ] Add world-graph state/content modules and export their supported symbols publicly.
- [ ] Implement total campaign narrowing and Tier 1/Tier 2 validation without unchecked throws.
- [ ] Implement deterministic `initialState`, projection, outcome and reason/event registries.
- [ ] Assemble and register the production `worldGraphKind`.
- [ ] Implement build/demolish, hire/fire, assign, set-price and open/close reducers.
- [ ] Derive entity ids only from the seed-safe ordinal rule; never from array length or time.
- [ ] Add synthetic minimum campaign fixtures owned by this repository.
- [ ] Test every immediate action's success, rejection and no-time-passes invariant.
- [ ] **Gate:** `createGame` produces a valid deterministic tick-zero world and all immediate
      actions pass through the real engine seam.

### W46 — deterministic tick pipeline

- [ ] Cut the W46 code plan with one function/module owner for each normative system.
- [ ] Implement bounded `advance_ticks` and `tick_limit_reached` rejection.
- [ ] Execute all 20 systems in fixed order, using explicit honest no-ops where scope is deferred.
- [ ] Derive per-tick/per-agent random streams without carrying hidden generator state.
- [ ] Enforce canonical entity iteration and deterministic id/tie ordering.
- [ ] Keep pathfinding caches derived and unserialized.
- [ ] Emit state changes and events in deterministic causal order.
- [ ] Add one-tick, multi-tick and split-batch equivalence tests.
- [ ] Run the complete determinism, lint, typecheck and replay suites.
- [ ] **Gate:** any partition of the same tick count reaches the same defined Outcome.

### W47 — playable MVP vertical slice

- [ ] Cut the W47 code plan around one end-to-end guest journey.
- [ ] Implement spawn/entry and deterministic need evolution.
- [ ] Implement target utility selection and pathfinding to a reachable building.
- [ ] Implement movement, queue join, patience and abandonment.
- [ ] Implement service, purchase, stock/capacity and finance transfer.
- [ ] Implement litter generation, cleanliness effects and staff cleaning work.
- [ ] Implement the minimum construction/economy hooks required by the slice.
- [ ] Implement objective progress plus win and financial-loss transitions.
- [ ] Test the causal chain at system seams as well as end to end.
- [ ] **Gate:** the synthetic MVP can win and lose through `createGame`/`submitAction`.

### W48 — preview and client parity

- [ ] Cut the W48 cross-cutting plan and inventory every affected client/session surface.
- [ ] Implement `previewAction` by calling the authoritative action path and discarding state.
- [ ] Guarantee preview appends no action log entry, persists no session and consumes no state.
- [ ] Add the operation to `Engine`, `SessionStore`, text client and MCP surfaces together.
- [ ] Amend `09-clients.md`, `MVP.md` and the MCP operation count in the same unit.
- [ ] Test preview/submit parity for accepted and rejected parameterized actions.
- [ ] Test concurrency/version behaviour so preview cannot masquerade as a committed write.
- [ ] **Gate:** clients can validate placement without duplicating a mechanical rule.

### W49 — validation, scenario and replay guard

- [ ] Cut the W49 hardening plan and enumerate every contract invariant as a test target.
- [ ] Complete Tier 1 source validation and Tier 2 semantic/cross-reference validation.
- [ ] Reject malformed maps, references, ranges, caps and impossible starts without throwing.
- [ ] Author the canonical engine-owned MVP scenario fixture from Sun Trap's MVP contract.
- [ ] Record a deterministic winning replay and a deterministic losing replay.
- [ ] Add batch-partition, save/restore and preview/no-mutation replay cases.
- [ ] Add the world-graph fixtures to the release-tag comparison corpus.
- [ ] Prove canonical serialization and replay equality across a clean build.
- [ ] Run package consumer smoke again with the world-graph public exports.
- [ ] Publish and pin the first engine version that carries the completed world-graph kind.
- [ ] **Gate:** the third kind is playable, guarded by the replay oracle and consumable by
      Sun Trap as an immutable package version.

---

## Decisions

### 1. Contract fully before code — no interleaving, same reasoning as `simulation`

`12-world-graph-kind.md` §2 states this kind's own closest relative is `simulation`, not
`story-graph`, for exactly the reason that makes contract-first matter: `Guest`/`Staff`
fields are referenced pervasively across pathfinding, utility scoring, queueing and service
— there is no prefix of that type graph safe to build against before it is settled.
W41 changes package delivery around already-built code and therefore does not interleave
world-graph implementation with its contract.

### 2. Runtime state and content-definition types are two separate contract units, not one

Finding 2 is the reason: state types (W42) are a port with an existing, near-ready draft;
content-definition types (W43) are new design work grounded in prose, not code. Conflating
them would let the easy half's readiness disguise the hard half's actual size — precisely
the risk `plans/36`'s own Finding 3 flagged for a different reason (an incomplete upstream
table understating simulation's port by half). Keeping them apart keeps each honestly sized.

### 3. `previewAction` is its own build unit (W48), per Finding 4

`plans/33` folded it into "the world-graph build" as a whole, not into any one unit within
it. Given it touches four surfaces outside the kind itself (`Engine`, `SessionStore`, text
client, MCP) plus two Definition-of-Done documents, it earns independent review rather than
riding along inside W47 or W49.

### 4. The companion boundary is a private GitHub Packages npm package

Finding 6. W41 keeps the existing source layout and makes the delivery boundary explicit:
`@the-running-dev/game-engine`, declaration-bearing ESM, one supported root export, private
GitHub Packages publication and exact semver consumption. The package is linked to this
repository; the Sun Trap repository receives Actions read access. A sibling `file:` link may
speed local iteration but cannot satisfy either repository's gate, and a Git dependency is
rejected because it couples consumers to repository layout and package-build side effects.

> **What shipped differs on one point: the package published *public*, not private.** Every
> other element of this decision held — scoped name, GitHub Packages, declaration-bearing ESM,
> one root export, exact-semver consumption. The visibility deviation and the two ways to
> resolve it are recorded in
> [`OPEN-QUESTIONS.md`](../docs/docs/engine/OPEN-QUESTIONS.md) §2 rather than silently
> normalised here, because the reasoning above is what a reader would otherwise take as
> current fact.

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
| **T0 — Consumable** | W41 merged and first package version published | A clean companion can install and construct the existing engine through one supported, immutable public surface |
| **T1 — The contract is whole** | W44 merged | Every type `WorldGraphKindState` and its content-definition surface names is specified in this repository. `12-world-graph-kind.md` stops being "the seam only" |
| **T2 — A tick batch resolves** | W46 merged | The loop runs: mutate, `advance_ticks`, twenty systems, next tick. Batch invariance (§5) has a test with teeth |
| **T3 — Sun Trap's MVP plays** | W49 merged | The MVP scenario (`SubZeroDev.SunTrap/docs/docs/product/mvp.md` §3) is winnable and losable through the replay oracle — proven through `createGame`/`submitAction`, the same honest scope this repository used for `simulation` |
| **T4 — Guarded and deliverable** | W49's fixtures are in the corpus and its package version is published | The replay oracle covers a third kind, and Sun Trap can pin the exact version that passed it |

---

## Explicit Non-Goals

- **No core changes.** `KindContext.derive` and the `tick`/`agent` stream variants already
  exist (`plans/33` Finding 1). If a unit finds otherwise, that is a core unit with its own
  plan, not a change smuggled into this kind.
- **No shared tick substrate.** Decision 5.
- **No second delivery mechanism.** Git URLs and sibling `file:` links are not parallel
  supported channels; Decision 4 names the one release boundary.
- **No Sun Trap repository changes.** This plan is scoped to `SubZeroDev.GameEngine`; Sun
  Trap's own scaffold, balance harness, and visual client are that repository's own
  decisions to sequence, informed by this plan but not directed by it.
- **No re-porting of core material.** `04-core.md`'s conventions (randomness, projection,
  the frozen `Condition` set, save/migration) stay reused, not re-derived, the same rule
  `10-simulation-kind.md` follows and `CLAUDE.md`'s envelope-duplication ledger tracks.
- **No W-numbers treated as fixed.** W41–W49 are proposed. They are assigned when each unit
  is cut, per `TODO.md`'s positional-numbering note.
