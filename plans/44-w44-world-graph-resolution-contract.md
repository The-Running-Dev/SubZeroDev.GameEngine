# W44 — The World-Graph Resolution and Systems Contract

**Scope:** Plan the final doc-only contract unit for the `world-graph` kind: turn the named
20-system tick pipeline into an executable specification, including utility scoring,
pathfinding, queues, service, staff work, finance, incidents, objectives, terminal timing,
events, and batch invariance. No engine code.

**Depends on:** W42's merged runtime-state contract (PR #116) and the completed W43
content-definition contract. W43's planning change is currently
[PR #119](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/119); execute this plan
only after the W43 contract itself has merged, then audit the merged types rather than the
planning branch.

**Programme:** [`plans/39-world-graph-kind-programme.md`](39-world-graph-kind-programme.md),
W44. This is the third and final contract unit. W45 is the first code unit.

**Status:** Execution complete in
[PR #120](https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/120). Its canonical
home is the marked `engine/12-world-graph-kind.md` block in `design/20-contract.md`; the
generated reader copy is `docs/docs/engine/12-world-graph-kind.md`. This plan is execution
history, not a second source of truth.

---

## Historical Handoff — Completed

### The prompt

> This completed W44 pass was doc-only. Its 20-system pipeline, algorithms, reconciliation,
> events, and verification rules are canonical in `design/20-contract.md`. Do not treat this
> record as an alternate editing surface, begin W45, or extract a shared core pipeline from it.

### Where to work

- **Primary contract:** `design/20-contract.md`'s `engine/12-world-graph-kind.md` block,
  especially §§3–5 and §§9–13.
- **Merged content dependency:** the W43 additions to §14 and any narrow §3 reconciliation.
- **Core rules to reuse:** `04-core.md` §§3.1, 8, 12, and 14; `05-observability.md` for event
  isolation and names.
- **Programme ledger:** `plans/39-world-graph-kind-programme.md` and
  `design/30-slices.md`'s generated `engine/TODO.md` block.
- **Game sources, read-only:** Sun Trap's `game-design.md` §§3–14,
  `content-and-systems.md` §§8–9, and `mvp.md`.
- **Precedent, not a mechanical template:** `10-simulation-kind.md` §§3 and 5. Its
  load-bearing two-phase time ordering is the lesson; its weekly mechanics are not portable.

### Working rules that are easy to violate here

1. Specify **one tick**, then define a batch as repetition. No system may observe the caller's
   requested batch size, action sequence, or whether another batch call preceded it.
2. `state.tick` is the tick being processed at pipeline entry. Systems 1–19 operate at that
   value; system 20 finalizes the tick and increments it exactly once.
3. Every system gets a stable id, inputs, outputs, canonical iteration order, no-op condition,
   events, and state-change responsibility. A system name alone is not a contract.
4. Every comparator is a complete tuple. “Tie by id” is insufficient for coordinates,
   definitions, queue arrival, path nodes, and transient task candidates.
5. Campaign balance chooses values. This contract owns arithmetic, rounding, evaluation
   order, bounds, and the meaning of those values.
6. Runtime caches and per-tick scratch are allowed only when removing them changes neither
   state, events, changes, nor outcome. They are rebuilt from state plus validated content.
7. No event may feed a later system. Dropping the emitter must change nothing.
8. If a system requires state W42/W43 cannot represent, amend the contract now and list the
   correction. W45 may not invent a field.

### The one way to do this wrong

Do not describe systems with verbs such as “update”, “resolve”, or “handle” and stop there.
For example, “update queues deterministically” leaves unanswered who joins first, when
patience is checked, when service starts, what happens when a building closes, and whether a
guest may requeue ahead of someone who arrived earlier. W44 exists to make those answers
reviewable before they become code.

---

## Findings That Shape the Contract

### 1. The 20 names are an order, not yet an executable pipeline

§4 fixes the order, but only three systems have more than a sentence elsewhere: pathfinding,
utility selection, and incidents. None of the 20 names currently states its full read/write
set, no-op condition, or emitted records. W45/W46 would therefore have to invent behavior
despite the programme gate saying they must not.

### 2. Five state gaps are already measurable

These are contract gaps, not implementation discoveries:

| Gap | Evidence | Consequence if deferred |
|---|---|---|
| Queue order is canonicalized by guest id | §3.4 | A guest that leaves and rejoins can jump ahead because its entity id is old; stable queue order is semantic state, not storage order |
| Service had no unambiguous in-progress record | The pre-W44 queue start clock was ambiguous; no serving guest field existed | Systems 4 and 5 could not agree who was being served or when service completed |
| Staff have position but no path/path index | `Staff` lacks the fields `Guest` has | System 11 cannot move spatial staff reproducibly or resume after save/load |
| Litter has no runtime representation | No litter/waste collection or map amount exists | The MVP's serve → litter → cleaner chain cannot be represented or replayed |
| Failure identity has no guaranteed stored source | `outcome()` promises `failureId`, while W42 has only objective progress | A non-objective failure can end the game without leaving a published id in state |

W43 may close some of these while reconciling content references. W44 starts by re-auditing
the merged W43 type closure and records only the gaps that remain.

### 3. Two current rules can break batch invariance

**Guest pruning says “end of the tick batch.”** A two-tick call would retain a departed guest
during its second tick, while two one-tick calls would prune it between calls. That can alter
iteration, objectives, capacity, and entity allocation. Pruning must happen at the end of the
**tick that finalizes departure**, independent of API batching.

**The test language is weaker than the property.** §5 defines batch invariance as identical
`kindState`, then points to `Outcome` comparison. Equal terminal ids can hide different cash,
queues, paths, or counters. W44 must require deep canonical `kindState` equality after
ignoring only the envelope action log; `Outcome` remains an additional cross-version check,
not the batch-invariance oracle.

### 4. “Every tie uses entity id” does not cover the real ties

A* compares coordinates and costs. Content definitions have ids but are not entities. A queue
compares arrival order before guest identity. Task candidates do not have entity ids until
assignment. W44 needs a comparator registry, not a slogan.

### 5. System 9 cannot persist candidates where system 10 can read them

`StaffTask` is nested under assigned staff and there is no top-level unassigned-task
collection. Adding one would make derived work demand into save state and create a second
lifecycle to maintain. The cleaner answer is tick-local scratch: system 9 derives canonical
`TaskCandidate`s from durable dirt, incidents, queues, buildings, and sites; system 10 assigns
them and only then allocates a persisted `StaffTask` id.

### 6. Integer values still need proration and rounding rules

Wages, operating costs, service rates, curves, and percentage effects can all be authored as
integers and still diverge if each system rounds differently. Integer-only is necessary, not
sufficient. W44 must define cumulative proration and round-half-away-from-zero where signed
fixed-point multiplication is actually required.

---

## Decisions

### 1. A batch is a loop around one atomic tick

At the start of each tick iteration:

```text
processingTick = state.tick
```

Systems 1–19 read that value. System 20 performs tick-local cleanup and commits
`state.tick = processingTick + 1`. No system reads the requested batch length. A terminal
resolution does not abort midway through a tick: systems 19 and 20 still run, then the outer
loop stops before beginning another tick.

This makes initial `tick: 0` mean “zero ticks completed; tick 0 is next to process.” Scheduled
changes, day boundaries, and tick streams all use `processingTick`. The first tick of day
`d` is the tick where `floor(processingTick / ticksPerDay) === d` and
`processingTick % ticksPerDay === 0`.

### 2. Tick scratch is explicit and disposable

W44 may name a `TickScratch` contract containing only derived data passed between systems in
one tick:

- validated content indexes;
- path/distance caches keyed by `map.revision`;
- task candidates from system 9 for system 10;
- service, construction, finance, and cleanliness deltas awaiting their owning system;
- batch-level state-change aggregation metadata.

Scratch is initialized from state/content, never serialized, never projected, and never read
by `outcome()`. Running with caches disabled must produce identical observable results.

### 3. Use a complete comparator registry

The contract declares these canonical orders once and references them from every system:

| Domain | Comparator |
|---|---|
| Runtime entity id | prefix, then numeric ordinal; identical to §3.4 |
| Definition id | ordinal Unicode/ASCII lexicographic order over validated ids |
| Position | row-major `(y, x)` |
| Queue | persisted arrival sequence; guests admitted in the same tick tie by runtime entity id |
| Utility candidate | utility descending, then building entity id, then product definition id |
| Task candidate | priority descending, path cost ascending, task kind, target entity/position, source definition id |
| A* open node | `f` ascending, `h` ascending, `g` ascending, then position row-major |
| Same-cost A* parent | predecessor position row-major |
| Scheduled effect | due tick, authored priority, source definition id, authored effect index |

If W43 introduces another ordered domain, W44 adds it here rather than choosing locally.

### 4. Queue order is semantic and persisted

`Queue.guestIds` is FIFO arrival order, not re-sorted globally. Systems append simultaneous
arrivals in runtime entity-id order. Removing a guest preserves the relative order of all
others. Rejoining appends at the tail.

The merged state contract must carry one unambiguous service clock for the current head —
either a named `serviceStartedAtTick` plus head-by-position semantics, or an equivalent typed
service record. W44 chooses the former and removes the ambiguous legacy queue clock; it does
not add both a head id and a duplicate queue position. Service starts in system 5 at
`processingTick` and, for positive integer `serviceDurationTicks`, completes in system 4 of
the first tick where
`processingTick - serviceStartedAtTick >= serviceDurationTicks`. It never completes in the
same tick it starts.

System 3 decrements queued patience before system 4. A service that completes on the tick
patience reaches zero wins; system 5 abandons only guests still queued afterward. System 5
also uses the same pure utility evaluator as system 6 for “better alternative” checks: a
guest abandons when the best eligible alternative exceeds the current queue candidate by the
content-declared integer switch threshold, then system 6 may select the replacement intent in
that tick. There is no second scoring formula and no random draw for reconsideration.

### 5. Utility eligibility precedes utility arithmetic

A candidate is excluded before scoring when it is locked, closed, full, unaffordable,
product-incompatible, terrain/path unreachable, or invalid under a content condition.
Unreachable is not a large negative score; it is not a candidate.

For each remaining candidate, components are evaluated in this fixed order:

```text
need urgency
preference match
social relevance
quality
attractiveness
- price resistance
- travel cost
- queue penalty
- safety concern
```

W43 owns each component's integer curve/weight and valid range. W44 owns evaluation and sums
the already-scaled integer components with checked safe-integer arithmetic; Tier 1 rejects a
campaign whose declared bounds can exceed the safe-integer range. A component is
rounded once at its curve/multiplier boundary; the final sum is not renormalized. Utility ties
use the registry above. The optional decision trace lists components in this order and is
event/debug data, never state.

If no candidate remains, the guest selects the content-declared fallback intent. The MVP
fallback is `leave`; W43 may admit a bounded `wait` policy, but it must be typed and may not be
an implicit retry loop.

### 6. A* uses the authored directed graph with a canonical grid heuristic

Nodes are positions. Outgoing neighbors are allowed `PathCell` edges whose `from` equals the
current node and whose destination terrain is walkable under validated content. Occupied
building/site footprint cells are blocked; authored entrance approach cells remain outside
the footprint and therefore reachable.

For edge `current → next`:

```text
stepCost = edge.edgeCost + terrain(next).moveCost
```

Both terms are non-negative integers and Tier 1 guarantees `stepCost > 0`. The heuristic is
Manhattan distance to the nearest goal multiplied by the campaign's minimum traversable step
cost. It is therefore admissible; if the minimum is zero in a future contract, the heuristic
must be zero and the search becomes Dijkstra rather than silently overestimating.

The open-set and equal-parent comparators are the registry's. A node already closed is reopened
only for a strictly smaller `g`; equal `g` replaces its parent only when the new predecessor is
row-major smaller. Multiple entrances are goal nodes; equal-cost entrances tie row-major.
Unreachable returns a typed failure, clears no existing committed path until the caller's
system says so, and emits `guest.path.failed` only for an actual attempted commitment.

Path caches may memoize by `(map.revision, start, ordered goals, movement profile)` but never
change which equal-cost path the algorithm returns.

### 7. Time-based integer charges use cumulative proration

For a non-negative integer rate `amountPerPeriod`, period length `ticksPerPeriod`, and
zero-based `processingTick`, the amount due on this tick is:

```text
floor(amountPerPeriod * (processingTick + 1) / ticksPerPeriod)
- floor(amountPerPeriod * processingTick / ticksPerPeriod)
```

This distributes remainder cents deterministically, sums to the exact authored rate at each
period boundary, needs no persisted remainder, and is invariant to batch partitioning. Use it
for wages and passive operating costs. Tier 1 validates that both cumulative products remain
safe integers at the campaign's maximum tick. Product sales remain atomic integer-cent
transfers.

Signed fixed-point effects use round-half-away-from-zero exactly once after the full product
is formed. Intermediate rounding is forbidden.

### 8. Task demand is derived; assigned work is state

System 9 creates transient candidates from durable facts. A candidate has a typed task kind,
target, priority, required effort, and source definition id, but no entity id. System 10
greedily considers available staff in runtime entity-id order and assigns each the highest
compatible candidate under the task comparator, removing that candidate from scratch. Only
assignment allocates a `StaffTask` id.

An assigned task persists until completed, cancelled because its target vanished, or made
invalid by a deterministic rule. Staff need a committed path and path index equivalent to
guests so save/load cannot teleport or reroute them. System 11 owns staff movement and work;
it moves at most one graph edge per tick in v1, then applies one integer work unit when at the
target. Faster movement/work requires explicit content plus state for any remainder and is
post-MVP.

### 9. Resolution and cleanup finish the tick; they never finish the API batch

Systems 17 and 18 evaluate objectives and failures against the same post-incident state.
W43 must provide, or W44 must add, an explicit scenario precedence for simultaneous success
and failure. The selected published resolution/failure identity is persisted once and is
immutable thereafter.

System 20 prunes guests finalized as departed/removed **this tick**, clears cancelled or
completed nested work according to its retention rule, applies the documented bounded
retention policy for resolved incidents/dismissed alerts, and increments the tick. Cleanup is
per tick, never per `advance_ticks` call.

### 10. Do not extract a core `SystemPipeline`

W44 specifies this kind's pipeline. W46 implements it. The shared-substrate question is
revisited only after two real tick-driven implementations exist, as `OPEN-QUESTIONS.md`
already requires. A doc-only resemblance is not a second implementation.

---

## Required Per-System Contract

The W44 execution change must give every row a named subsection with inputs, outputs,
canonical iteration, no-op conditions, events, and `StateChange` ownership.

| # | Stable system id | Required behavior |
|---|---|---|
| 1 | `scenario` | Select effects due at `processingTick`; evaluate their conditions against system-entry state; apply in scheduled-effect order; reset daily accumulators when this is a day boundary before new-tick revenue/costs |
| 2 | `guest-spawn` | Evaluate spawn rules in definition-id order; use only `tick:{processingTick}:guest-spawn`; select archetype/spawn deterministically; allocate ids only for successful spawns; initialize per-agent draws from the new guest's own counter |
| 3 | `guest-needs` | Iterate active guests by entity id; apply W43 need/condition curves, elapsed-time counters, clamps, and content effects; mark a typed departure/fallback intent but do not prune |
| 4 | `guest-service` | Iterate buildings/queues canonically; resolve only services whose clock completes now; atomically verify guest/product/price/stock/staff, transfer cents, apply product effects, generate durable litter/cleanliness demand, and emit one served event |
| 5 | `queues` | Remove invalid/abandoning guests without reordering survivors; apply patience at a stated boundary; admit arrivals FIFO with same-tick id ties; establish the current head's service clock only when the building can serve |
| 6 | `guest-intent` | Score only eligible/reachable candidates with the fixed component order; tie by building then product; update intent/targets and agent draw counter only for draws actually specified by content |
| 7 | `guest-path` | Commit canonical A* paths for guests whose target changed or path became invalid; retain or clear prior paths according to a named failure rule; emit path failures |
| 8 | `guest-move` | Move at most one edge per eligible guest; allow overlap while congestion is deferred; transition arrivals to queue eligibility and exit arrivals to departed; never enqueue here because system 5 has already run |
| 9 | `task-generate` | Derive canonical transient candidates from litter/cleanliness, sites, broken buildings, service demand, and incidents; allocate no ids and persist nothing |
| 10 | `task-assign` | Preserve valid active assignments; assign idle compatible staff greedily using the comparator registry; allocate task ids only on assignment; plan staff paths canonically |
| 11 | `staff-work` | Move staff on committed paths, then apply one work unit at target; complete/cancel tasks deterministically; emit lifecycle events; expose construction/cleaning/service deltas to their owning later systems |
| 12 | `construction` | Apply builder work, decrement remaining effort, and complete sites in entity-id order; use the future building id reserved when the site was created so completion order cannot renumber entities |
| 13 | `buildings` | Apply passive typed building production/restock and non-wear status transitions; no-op for definitions without passive behavior; do not duplicate service or cleanliness work |
| 14 | `cleanliness-wear` | Combine service/litter/traffic/incident/staff deltas in a fixed source order, clamp once, update litter/waste entities, and perform typed broken/closure transitions |
| 15 | `finance` | Charge wages and passive operating costs with cumulative proration; apply due loan behavior if enabled; preserve integer cents and let system 18 interpret failure thresholds |
| 16 | `incidents` | Build eligible definitions in id order, draw only from `tick:{processingTick}:incidents`, apply the typed occurrence model once per declared scope, allocate ids in resolved selection order, and emit raised events |
| 17 | `objectives` | Evaluate every objective against the same post-system-16 state; update duration/progress in definition-id order; emit only actual transitions/progress changes |
| 18 | `failure` | Evaluate typed failure conditions, objective completion, and simultaneous precedence; persist terminal identity once; never abort systems 19–20 midway through the tick |
| 19 | `alerts` | Derive player-facing alerts from post-resolution state; deduplicate by typed semantic key; create only newly active alerts; never make alert delivery load-bearing |
| 20 | `tick-finalize` | Perform per-tick pruning/retention and referential cleanup, assert no dangling queue/task references, then set `tick = processingTick + 1` exactly once |

Every subsection must also say what it does when the relevant content collection is empty.
For post-MVP mechanics, the honest answer is a specified no-op, not an empty heading.

---

## Required State Reconciliation Audit

After W43 merges, compare its actual types against this list. Add only what remains missing,
and show the before/after in the W44 contract:

- queue service start/current-head representation and FIFO semantics;
- staff committed path and path index;
- durable litter/waste or an equally explicit spatial cleanliness target for the MVP;
- guest affordability/budget state required for an atomic purchase;
- building stock/capacity state required by service;
- persisted terminal resolution/failure identity;
- objective consecutive-duration state if W43 conditions require it;
- active policy/achievement references used by systems;
- bounded retention for incidents and alerts;
- any field whose value must survive save/load between two systems or ticks.

Transient task candidates, A* open sets, distance fields, content indexes, and aggregation
buffers are explicitly **not** state.

---

## StateChange and Event Contract

### Tick events

Events emit in causal system order, then entity/content comparator order within a system.
`batch.started`/`batch.ended` remain API-call diagnostics and therefore legitimately differ
under partitioned batches. Tick/entity events must otherwise match when the same ticks are
processed with the same state/content/seed.

World-level randomness uses only the stable system ids in the table. Agent streams consume
one `agent:{id}:{drawCount}` handle per declared draw and increment the counter immediately
after that draw. A rejected candidate or no-op system consumes no draw unless the contract
explicitly defines a trial at that point.

### Batch-grain changes

`advance_ticks` returns aggregated `StateChange`s, not one row per tick or agent. Aggregate by
resolved scalar path plus reason:

- `previous` is the first value before the batch;
- `value` is the final value after the batch;
- omit a row when final equals previous and no membership transition occurred;
- membership `.exists` rows remain separate creation/removal transitions;
- sort output by first causal system, then path, then reason.

Different batch partitions may return different change arrays because they are different API
calls. They may not return different final kind state.

The event catalog and reason-code table must be reconciled against every system path. Add a
name/code only where a consumer can distinguish a new fact; do not emit synonyms from two
systems for the same transition.

---

## Validation and Verification Matrix

### Contract examples

The W44 change adds one worked tick trace over the minimum W43/Sun Trap fixture:

```text
guest need rises → intent selects drink stand → A* path commits → movement reaches entrance
→ next tick queues guest → service completes → cents transfer → litter appears
→ cleaner task derives/assigns/completes → cleanliness recovers → objective updates
```

Each arrow names the responsible system and whether it happens in the same or a later tick.
Also include one simultaneous terminal example proving the scenario precedence rule.

### Required tests for W46/W47

- One focused test per system: mutation, no-op, canonical ordering, events, and changes.
- Deep `kindState` equality for `advance(a + b)` versus `advance(a)` then `advance(b)` over
  multiple partitions, including a departure/prune boundary, day reset, service completion,
  construction completion, incident roll, and terminal tick.
- Same result with path caches enabled/disabled and with emitter/nullEmitter.
- Same result from shuffled input arrays after canonicalization, except FIFO queue arrays whose
  order is semantic and must be preserved.
- A* fixtures for equal paths, multiple entrances, directed edges, blocked footprint,
  unreachable target, and map revision invalidation.
- Queue fixtures for simultaneous arrival, abandonment, close/reopen, requeue, capacity, and
  save/load during service.
- Utility fixtures for every component, ineligible/unreachable candidates, negative totals,
  exact ties, and safe-integer boundaries.
- Staff fixtures for competing tasks/staff, path save/load, target removal, cancellation, and
  completion ordering.
- Finance fixtures proving cumulative proration sums exactly across a period and every batch
  partition.
- Objective/failure fixtures for both precedence values and immutable terminal identity.

---

## Sequence

1. **Sync after W43's contract merge.** Re-read §3 and §14; replace every anticipated type
   name in this plan with the merged name before editing the contract.
2. **Run the state reconciliation audit.** Fix the minimum missing durable fields first so
   every later system can be described against real types.
3. **Define the one-tick frame, scratch boundary, comparator registry, and stable system ids.**
4. **Specify systems 1–8** through the worked guest path: scheduling, spawn, needs, service,
   queue, utility, A*, movement.
5. **Specify systems 9–16:** transient task generation, assignment, staff movement/work,
   construction, buildings, cleanliness/wear, proration, incidents.
6. **Specify systems 17–20:** objectives, simultaneous failure precedence, alerts, per-tick
   cleanup, tick commit.
7. **Reconcile events, `StateChange`, reason codes, and randomness** against the completed
   system table.
8. **Correct batch-invariance wording and pruning semantics** everywhere they appear,
   including the W46 programme gate if it still says Outcome where kind-state equality is
   required.
9. **Add the worked tick and simultaneous-terminal examples**, then complete the validation
   and future-test matrix.
10. **Update the programme/TODO ledgers** to mark W44's plan/contract accurately and declare
    T1 reached only when the W44 contract itself merges.

---

## Done-When

- [ ] The one-tick frame defines `processingTick`, day boundaries, terminal behavior, cleanup,
      and the single tick increment without reference to API batch size.
- [ ] Every one of the 20 systems has a stable id, reads, writes, iteration order, no-op
      conditions, events, and `StateChange` ownership.
- [ ] The merged W43 content types are referenced directly; no W44 type is based only on the
      planning branch's anticipated name.
- [ ] Queue FIFO/service timing, staff paths/work, litter/cleaning, affordability/stock, and
      terminal identity are representable across save/load.
- [ ] Utility eligibility, component order, scaling, rounding, fallback, and complete tie tuple
      are normative.
- [ ] A* neighborhood, directed-edge use, cost, heuristic, open-set ordering, equal-parent
      behavior, entrance selection, unreachable result, and cache key are normative.
- [ ] Task generation is transient and task assignment/work persistence is explicit.
- [ ] Wage/operating-cost proration is batch-invariant and exact at period boundaries.
- [ ] Incident selection, objective evaluation, simultaneous resolution precedence, alerts,
      and retention rules are explicit.
- [ ] Guest and other cleanup occurs per tick, not per `advance_ticks` call.
- [ ] Batch invariance requires deep canonical kind-state equality; Outcome remains an
      additional replay assertion rather than the sole oracle.
- [ ] The worked guest/service/litter/cleaner trace and simultaneous-terminal example name
      their system/tick boundaries.
- [ ] Every event/reason code is produced or intentionally reserved; no system invents an
      undeclared synonym.
- [ ] The future-test matrix covers ordering, cache/emitter isolation, save/load, partitions,
      and boundary arithmetic.
- [ ] `plans/39` and `TODO.md` show W44 correctly, and T1 is claimed only with merged contract
      evidence.
- [ ] `./build/Test-Documentation.ps1` passes; `git diff --check` is clean; no
      `src/engine/` file changed.

---

## Explicitly Not In Scope

- **No engine code.** W45/W46 implement the merged W42–W44 contract.
- **No W43 content design.** W44 consumes its conditions, effects, curves, definitions, and
  scales; missing content shape goes back to W43 before W44 execution.
- **No balance values.** Sun Trap chooses weights, rates, prices, thresholds, spawn chances,
  `ticksPerDay`, and scenario content.
- **No path congestion or collision avoidance.** Guest overlap is allowed in v1; congestion
  is post-MVP, matching Sun Trap's design.
- **No groups, weather implementation, complex inventory, loans, or advanced incidents.**
  Their systems/types may have honest no-ops where the contract already admits them.
- **No `previewAction`.** That cross-cutting API/client/MCP work remains W48.
- **No shared core pipeline.** Revisit after W46 produces the second real implementation.
- **No Sun Trap repository edits.** Its documents are design sources and balance authority.
