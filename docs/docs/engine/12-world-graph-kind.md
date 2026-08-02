---
sidebar_label: World-Graph Kind
---

# World-Graph Kind — Contract

**Document status:** Revision 2 — **authoritative runtime-state contract.** Field-level
content detail lives with the game; §17 says exactly what and why.
the game; §17 says exactly what and why.

**Kind:** `world-graph`

**Reading order:** after [`04-core.md`](04-core.md) §3 (the seam) and
[`10-simulation-kind.md`](10-simulation-kind.md), which this most closely resembles.

> **Scope of this document**
>
> The third engine-owned kind, expressed against the Kind seam. It reconciles a spatial,
> many-agent, tick-driven world with the `GameState` envelope, the
> one-action model, projection, reason codes, events and terminal identity.
>
> It is **not** a game design. The flagship game built on this kind — **Sun Trap** — lives
> in [SubZeroDev.SunTrap](https://github.com/The-Running-Dev/SubZeroDev.SunTrap), the way
> Life in the Fast Lane lives in
> [SubZeroDev.GameOfLife](https://github.com/The-Running-Dev/SubZeroDev.GameOfLife) — §17.

---

## 1. What This Kind Is

**A navigable world with autonomous inhabitants.** The player shapes the world — placing,
pricing, staffing — and never commands the inhabitants; they route themselves across it and
act on their own preferences. The world advances in fixed ticks through an ordered system
pipeline.

Where `story-graph`'s unit of play is *one choice* and `simulation`'s is *one week*, this
kind's is **a batch of ticks the caller chooses**.

> **`world-graph` and `story-graph` are not related, despite the names.** Both name the
> structure their `advance` walks, which is the naming convention — but a story graph is
> **authored**: its edges are choices a writer wrote, and traversal is the player picking
> one. A world graph is **navigated**: its edges are adjacency, and traversal is
> pathfinding by entities the player does not control. Sharing a suffix means they answer
> the same question about themselves, not that they share a mechanism. They share no code.

> **Why not `management-simulation`, the name the draft proposed.** It fails §1a twice.
> *Management* is a theme, and §1a says themes are campaigns — a colony sim, an ecosystem
> model or a transport network would run on this identical kind and none of them is
> management. And the `-simulation` suffix implies a specialization of the `simulation`
> kind, which it is not: they are siblings with entirely different `advance` bodies.

---

## 2. Why It Is a Kind

Applied against the test in [`02-architecture.md`](02-architecture.md) §1a, and it reaches
step 3 — but **not** for the reason the original draft gave.

The draft argued from state: spatial maps, hundreds of agents, queues, pathfinding,
construction. Every one of those is `kindState`, which is `unknown` to the core (04 §2), and
§1a's table disqualifies state richness explicitly. Had that argument been accepted, it
would equally have licensed a separate kind per resort theme.

What actually qualifies it is **code the campaign tier cannot carry**: A\* pathfinding and
guest utility scoring. Putting those behind a data-driven switch is the universal rules DSL
architecture N2 rejected. So one kind — and every hotel, theme park, nightclub district and
festival ground after it is a **campaign** of that kind.

> **Its closest relative is `simulation`, not `story-graph`.** Both are *mutate pending
> configuration, then resolve a block of simulated time through an ordered pipeline*. They
> differ by the size of the block, which §1a's table says is a parameter, not a model. That
> shared archetype is why every seam change this kind forced (§5) turned out to be one
> `simulation` needed too.

---

## 3. `KindState` — What Belongs Here

**The draft's `ResortGameState` is not this kind's state.** It was written as a standalone
engine's envelope and carries six fields the core owns, plus one the core bans. Reproducing
it would be the envelope-duplication defect `CLAUDE.md` names as this project's recurring
one — this is its **fifth** occurrence, after 03 §8.1, 04 §10.1, 03 §9 and 10 §2.
`CLAUDE.md` carries the full ledger.

| Draft field | Where it belongs now |
|---|---|
| `version` | `GameState.formatVersion` — the envelope (04 §2) |
| `gameId` | The envelope, from the `IdSource` port (06 §5.1) |
| `seed` | The envelope — the *only* randomness state |
| `status` | The envelope — and its union is wrong; see §8 |
| `commandLog` | `GameState.actionLog` — the replay spine |
| `metadata` | The session-store record, outside replayable state (04 §7) |
| **`rng: RngState`** | **Nowhere.** 04 §2 bans persisted generator state: streams derive from `(seed, streamId)`, so a stored `RngState` is written every action, read by nothing, and free to drift from the derivable truth |

What remains is the kind's own:

```typescript
interface WorldGraphKindState {
  tick: number;                                   // §4 — the only authoritative clock field

  map: WorldMap;                                  // terrain, zones, spawns, exits, revision
  finances: Finances;

  buildings: readonly Building[];
  constructionSites: readonly ConstructionSite[];
  guests: readonly Guest[];
  staff: readonly Staff[];

  incidents: readonly Incident[];
  objectives: readonly ObjectiveProgress[];
  alerts: readonly Alert[];

  nextEntityOrdinal: number;                      // §9 — the deterministic id source
}
```

> **The clock collapses to `tick`.** The draft's `ResortClock` carries
> `ticksPerMinute`, `minute`, `hour`, `day` and `paused`, then states that "only `tick` is
> authoritative. Other values may be derived." Derived values do not belong in serialized
> state — they can disagree with what they summarise, and the disagreement is unresolvable
> (the rule 10 §2 applied to `totalTimeCost`). `ticksPerMinute` is campaign data; the rest
> are computed on read. **`paused` is a client concern** — the engine advances only when
> told to (§4), so there is nothing for the engine to pause.

> **`history` is not adopted**, for the reason 10 §2 gives: it overlaps `StateChange[]`
> (04 §12) and the event stream (05). Three records of the same events is what the
> duplication rule exists to prevent. Carried in
> [`OPEN-QUESTIONS.md`](OPEN-QUESTIONS.md) alongside the same question for `simulation`.

> **`alerts` is retained and is genuinely state**, because an alert persists until
> dismissed and dismissal is a player action. It is not a duplicate of `OutcomeMessage`,
> which is per-resolution and not persisted.

### 3.1 `initialState`

`Kind.initialState(campaign, ctx)` (04 §3) builds the starting world from campaign data: the
authored map, starting cash, the scenario's unlocked definitions, any pre-placed buildings,
and `tick: 0`.

Two rules the seam already implies, stated because a spatial kind is the first place they
bite:

- **Pre-placed buildings take ids from `nextEntityOrdinal` like any other** (§9), assigned in
  authored order. A scenario that pre-places three buildings starts with
  `nextEntityOrdinal: 3` and ids that are a pure function of the campaign — never of load
  order or a host id source.
- **Any randomness in setup draws from `ctx.derive({ kind: "tick", tick: 0, system })`**, not
  from `ctx.rng`. `initialState` is not an action and has no `seq`; keying setup by tick 0
  keeps §5's rule — *this kind never touches the action stream* — true without exception.

`InitialStateResult.status` may be `"ended"` at creation, exactly as `story-graph` may settle
onto an ending before the player acts (04 §3). For this kind that means a scenario whose
objectives are already satisfied or whose failure condition already holds at tick 0 — a valid
campaign that Tier 2 should warn about (§15), not a crash.

### 3.2 Runtime-State Type Contract (engine-owned)

The types below are now the complete closure required by §3. **All identifiers are opaque
strings unless a dedicated namespace is stated.**

```typescript
interface WorldGraphKindState {
  tick: number;                                      // authoritative tick counter
  map: ResortMap;                                    // terrain, zones, spawns, exits, revision
  finances: Finances;

  buildings: readonly Building[];                    // includes nested Queue + StaffTask
  constructionSites: readonly ConstructionSite[];
  guests: readonly Guest[];                          // includes full guest path, need, and condition state
  staff: readonly Staff[];                           // includes nested StaffTask

  incidents: readonly Incident[];
  objectives: readonly ObjectiveProgress[];
  alerts: readonly Alert[];

  nextEntityOrdinal: number;                         // deterministic id source, never `IdSource`
}

type Position = {
  x: number;         // integer grid coordinate, same origin as map terrain
  y: number;         // integer grid coordinate, same origin as map terrain
};

type TerrainKind = "empty" | "path" | "wall" | "water" | "restricted";
type MapEdgeKind = "walkable" | "blocked";
type StaffStatus = "idle" | "to_work" | "working" | "off_duty";
type GuestLifecycle = "arriving" | "seeking" | "queued" | "served" | "departed" | "removed";
type BuildingStatus = "construction" | "open" | "closed" | "broken";
type LoanStatus = "active" | "defaulted" | "repaid";
type IncidentType = "fire" | "breakdown" | "theft" | "spill" | "litter" | "complaint"
  | "power" | "weather";
type IncidentSeverity = "info" | "minor" | "major" | "critical";
type AlertSeverity = "info" | "warning" | "critical";
type ObjectiveProgressState = "active" | "met" | "failed";
type StaffTaskType = "service" | "clean" | "restock" | "build";
type StaffTaskStatus = "queued" | "assigned" | "in_progress" | "completed" | "cancelled";
type Rotation = 0 | 90 | 180 | 270;
type GuestNeedValue = number;      // 0..100, where 0 is fully depleted
type UtilityScore = number;        // fixed-point integer by design
type PercentBasis = number;        // integer basis points, where 10000 = 100%

interface WorldMap {
  width: number;                             // positive integer, map width in tiles
  height: number;                            // positive integer, map height in tiles
  revision: number;                          // integer, changes whenever authored map topology changes
  terrain: readonly TerrainCell[];           // deterministic terrain graph
  paths: readonly PathCell[];                // explicit path graph edges, derived caches must be recomputed
  zones: readonly Zone[];                    // zones of operation and policy scope
  spawnPoints: readonly Position[];           // at least one guest-spawn point required
  exits: readonly Position[];                // at least one exit point required
}

interface TerrainCell {
  x: number;                                // integer [0, width)
  y: number;                                // integer [0, height)
  terrain: TerrainKind;                      // walkability and utility context source
  edge: MapEdgeKind;                        // precomputed if authored edge map exists
  moveCost: number;                         // non-negative integer travel-cost scale
}

interface PathCell {
  from: Position;
  to: Position;
  edgeCost: number;                         // non-negative integer; distance-only, no float metrics in state
  allowed: boolean;                         // if false, this edge is never traversed
}

interface Zone {
  id: string;
  nameKey: string;                          // localization key for projection/debug
  cells: readonly Position[];               // canonical zone footprint, ordered by id rules
  serviceRadius: number;                    // integer tile radius from zone centroid
  maxOccupancy: number | null;              // null = unlimited
}

interface Building {
  id: string;                               // `<building>:<ordinal>` from `nextEntityOrdinal`
  definitionId: string;                     // campaign content contract
  x: number;                                // integer tile x of anchored origin
  y: number;                                // integer tile y of anchored origin
  width: number;                            // integer tile width from definition
  height: number;                           // integer tile height from definition
  rotation: Rotation;                       // quarter-turn footprint rotation
  status: BuildingStatus;
  isOpen: boolean;
  buildStartTick: number;                   // inclusive tick when building entered state
  wear: number;                             // 0..100, higher is healthier
  cleanliness: number;                      // 0..100, higher is cleaner
  queue: Queue;
  products: readonly string[];              // product ids offered by this building
  serviceTickSeq: number;                   // deterministic service tie-break source
}

interface ConstructionSite {
  id: string;                               // `<construction-site>:<ordinal>` if surfaced
  definitionId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: Rotation;                       // must match building rotation shape
  startedAtTick: number;
  buildTicksRemaining: number;              // non-negative integer countdown to open
  totalCostCents: number;                  // must be non-negative integer
  completedBuildingId: string | null;       // pre-placed id when construction completes
}

interface Queue {
  id: string;                               // `<queue>:<ordinal>` from `nextEntityOrdinal`
  productId: string;
  guestIds: readonly string[];              // canonical order by guest.id
  maxLength: number | null;                 // null = unlimited
  patienceTicks: number;                    // mutable queue patience counter
  startedAtTick: number;
}

interface Guest {
  id: string;                               // `<guest>:<ordinal>`
  archetypeId: string;                      // content contract
  lifecycle: GuestLifecycle;
  tickEntered: number;                      // authoritative timeline event
  x: number;
  y: number;
  path: readonly Position[];                // stateful route, excluding cached distance fields
  pathIndex: number;                        // index into `path`, non-negative integer
  drawCount: number;                        // agent-level deterministic draw counter (ticks + system only)
  targetBuildingId: string | null;           // active target, if currently navigating
  targetQueueId: string | null;             // queue destination, if queued
  targetProductId: string | null;           // purchase target, if any
  targetWaitSeconds: number;                // integer seconds desired tolerance
  needs: GuestNeeds;
  conditions: GuestConditions;
  opinions: GuestOpinions;
  preferences: GuestPreferences;
}

interface GuestNeeds {
  hunger: GuestNeedValue;
  rest: GuestNeedValue;
  social: GuestNeedValue;
  comfort: GuestNeedValue;
  hygiene: GuestNeedValue;
  safety: GuestNeedValue;
}

interface GuestConditions {
  mood: number;                             // -100..100, sign indicates positive or negative utility trend
  patienceRemainingTicks: number;            // non-negative integer, decrements while queued/unserved
  arrivalTick: number;
  lastServedTick: number | null;
  spentTicks: number;                       // total lifecycle spend in world
}

interface GuestOpinions {
  price: number;
  variety: number;
  cleanliness: number;
  safety: number;
  attractiveness: number;
  queues: number;
  service: number;
}

interface GuestPreferences {
  noiseTolerance: number;                   // -10..10 preference offset
  spendingCategory: "budget" | "balanced" | "premium";
  loyaltyMultiplier: number;                 // integer utility scaling band
}

interface Staff {
  id: string;                               // `<staff>:<ordinal>`
  roleId: string;                           // content contract
  x: number;
  y: number;
  status: StaffStatus;
  assignedBuildingId: string | null;
  assignedZoneId: string | null;
  zoneId: string | null;                    // alias for current zone membership at read time
  drawCount: number;                        // agent-level deterministic draw counter
  task: StaffTask | null;                   // singular active task
  tasksCompleted: number;                   // cumulative counter, monotonic
}

interface StaffTask {
  id: string;                               // `<staff-task>:<ordinal>` (nested entity id)
  kind: StaffTaskType;
  status: StaffTaskStatus;
  guestId: string | null;
  queueId: string | null;
  buildingId: string | null;
  targetProductId: string | null;
  startedAtTick: number;
  endedAtTick: number | null;
  priority: number;                         // deterministic tie-break source for dispatch
  effortTicks: number;                      // non-negative integer
}

interface Finances {
  cashCents: number;                        // integer cents
  revenueTodayCents: number;                // integer cents, resets by tick-interval boundary
  expensesTodayCents: number;               // integer cents, resets by tick-interval boundary
  revenueTotalCents: number;                // integer cents
  expensesTotalCents: number;               // integer cents
  loan: Loan | null;
}

interface Loan {
  id: string;
  principalCents: number;                   // integer cents
  balanceCents: number;                     // integer cents
  interestBasisPoints: PercentBasis;         // integer bps
  accruedInterestCents: number;             // integer cents
  status: LoanStatus;
  startedAtTick: number;
  durationTicks: number;                    // integer, total duration
  nextPaymentTick: number | null;           // null while settled
}

interface Incident {
  id: string;
  incidentType: IncidentType;
  severity: IncidentSeverity;
  buildingId: string | null;
  guestId: string | null;
  zoneId: string | null;
  titleKey: string;
  descriptionKey: string;
  startedAtTick: number;
  expiresAtTick: number | null;
  resolvedAtTick: number | null;
}

interface ObjectiveProgress {
  id: string;                               // objective id (published)
  state: ObjectiveProgressState;
  value: number;                            // integer accumulator
  target: number;                           // integer target threshold
  updatedAtTick: number;
}

interface Alert {
  id: string;                               // `<alert>:<ordinal>`
  type: string;                             // gameplay-specific alert discriminator
  severity: AlertSeverity;
  titleKey: string;
  messageKey: string;
  entityId: string | null;                  // owning entity when applicable
  issuedAtTick: number;
  dismissedAtTick: number | null;
}
```

### 3.3 Structural Answers

This section is normative. Entrances are not runtime state: W43 content definitions provide
footprint-relative authored offsets, and world entrance positions are derived purely from the
building origin and rotation (with quarter-turn integer transforms) when needed. Guest opinions
store the seven slowly-changing impressions defined above; additional evaluation inputs are not
serialized state.

We define the following handling for values that are campaign configuration:

- **Guest pruning.** Departed/removed guests are pruned from `guests` at the end of the tick
  batch that finalized that lifecycle state. The contract therefore prevents unbounded
  serialized growth while preserving historical objective calculations via `ObjectiveProgress`.
- **`today` accumulator boundary.** `revenueTodayCents` and `expensesTodayCents` reset on each
  campaign-defined day boundary computed from `tick` and the published `ticksPerMinute`/minutes
  per day settings. Tier 1 validation rejects non-positive or non-finite boundary settings,
  including `0/0`; implementations must not calculate a day boundary from them.

`queue`, `staff task`, and nested entity collections are not top-level collections. Their ids are
still derived from `nextEntityOrdinal` at creation.

### 3.4 Canonical collection order

All serialized arrays are iterated in canonical id order for contract behavior, not insertion
order. Compare an id's prefix using ASCII/UTF-8 code-unit lexicographic order; when prefixes
match, parse the ordinal after the colon as a base-10 integer and compare it numerically (with
exactly the same rule for ties). This ordering is locale-independent:

- `buildings`, `constructionSites`, `guests`, `staff`, `incidents`,
  `objectives`, and `alerts` are all canonicalized by each element's `id`
  before any system touch.
- For each `Building`, `queue.guestIds` is canonical by `guest.id`, and service selection uses
  the `queue.id` order then `guest.id` within each queue.
- For each `Staff`, `task` is singularly active in this unit, but if history snapshots are stored in
  a future extension, they must be canonical by `StaffTask.id`.

This rule is what keeps unrelated entities’ behavior stable under insertion or removal operations.

---

## 4. The Turn Is a Tick Batch

Actions split into two groups, exactly as `simulation`'s do:

```text
build · demolish · hire_staff · fire_staff · assign_staff ·
set_price · open_building · close_building        → mutate the world, no time passes

advance_ticks { ticks }                            → run the tick pipeline `ticks` times
```

**The tick pipeline order is normative.** It is fixed, tested, and may not be reordered
without a version change, for the same reason `simulation`'s two-phase start-of-week
ordering is normative (10 §3): a reordering that is wrong fails silently.

```text
 1  apply scheduled scenario changes      11  perform staff work
 2  spawn guests                          12  update construction
 3  update guest needs and conditions     13  update buildings
 4  resolve guests being served           14  update cleanliness and wear
 5  update queues                         15  charge operating costs and wages
 6  select new guest intents              16  roll incidents
 7  path guests                           17  update objectives
 8  move guests                           18  evaluate failure
 9  generate staff tasks                  19  raise alerts
10  assign staff tasks                    20  increment tick
```

---

## 5. Batch Invariance — and the Two Seam Changes It Forced

This is the load-bearing property of the kind, and the reason this document required
changes to `04-core` at all.

> **Batch invariance.** For any `a, b ≥ 0`, submitting `advance_ticks a` then
> `advance_ticks b` produces the **same `kindState`** as submitting `advance_ticks (a + b)`.

It is what makes "presentation speed must not affect results" true — a claim the draft
asserted twice and could not have satisfied.

**It is a `kindState` property, not a byte property.** The two runs differ in `actionLog`,
so `serialize()` legitimately differs. The instrument that tests it is the replay oracle's
`Outcome` comparison ([`07-replay.md`](07-replay.md) §3), not the byte-identity harness
(04 §14) — which is exactly the distinction 07 exists to draw.

**Under the previous contract it could not hold.** Every draw came from `ctx.rng`, the
handle on `action:${seq}` (04 §8). So `advance_ticks 60` drew from one stream and sixty
`advance_ticks 1` drew from sixty different ones. Same inputs, different world.

Three rules make it hold, and the first is structural rather than disciplinary:

1. **This kind draws nothing from `ctx.rng`.** The action stream is unused. No draw may
   reference `ctx.seq`.
2. **World-level draws are keyed by simulated time** —
   `ctx.derive({ kind: "tick", tick, system })` for guest spawning, incident rolls and
   weather. `system` names the drawing system so two systems on the same tick stay
   independent.
3. **Agent-level draws are keyed by the agent** —
   `ctx.derive({ kind: "agent", agentId, seq })`, where `seq` is that agent's *own* draw
   counter, stored on the agent and incremented per draw. Never the action seq.

**The two changes to `04-core`:**

| Change | Why it is not special pleading |
|---|---|
| `KindContext.derive(streamId)` (04 §3.1) | §8 defined `agent` and `system` stream variants that **no kind could reach** — `ctx.rng` was the only handle. `simulation` has the same gap today for its NPC draws |
| `StreamId` gains `{ kind: "tick"; tick; system }` (04 §8) | The encoding was already open by design; this adds the one keying a time-advancing kind needs |

Neither persists anything. `derive` closes over the seed, so `{ seed, actionLog }` remains
the complete replay input.

---

## 6. Actions — One Model, Spatial Verbs

04 §3's action is a string `actionId` plus optional `params`. The mapping:

| `actionId` | `params` | Effect |
|---|---|---|
| `build` | `{ definitionId, x, y, rotation }` | Place a building or open a construction site |
| `demolish` | `{ buildingId }` | Remove a building |
| `hire_staff` | `{ definitionId }` | Add a staff member |
| `fire_staff` | `{ staffId }` | Remove a staff member |
| `assign_staff` | `{ staffId, zoneId? , buildingId? }` | Change an assignment |
| `set_price` | `{ buildingId, productId, priceCents }` | Set one price |
| `open_building` / `close_building` | `{ buildingId }` | Toggle operation |
| `dismiss_alert` | `{ alertId }` | Clear a persisted alert (§3) |
| `advance_ticks` | `{ ticks }` | Run the pipeline (§4) |

Every one is a `submitAction` appending one `LoggedAction`. All parameters are **declared
ids, integers, or enumerated rotations** — none is free text, which keeps
[`08-session-capture.md`](08-session-capture.md) §3.2's refusal rule cheap to satisfy.

**`ticks` is bounded.** `submitAction` is synchronous and pure, so an unbounded tick count
is an unbounded pure computation inside one call. The cap is campaign data, Tier 1
validated, and exceeding it is `tick_limit_reached` (§11) — a rejection, not a truncation,
because a silently shortened batch would break §5.

---

## 7. Scene, Available Actions, and the Parameter Problem

`AvailableAction` (04 §6) is `{ id, labelKey, available, reasonKey }`. **It carries no
parameter schema**, and for this kind that is load-bearing: enumerating `build` × every
definition × every map cell × four rotations is combinatorial.

So the seam splits cleanly:

- **`availableActions` returns the verbs** in §6, each with `available` and a `reasonKey` —
  `build` is unavailable with `insufficient_funds` when nothing is affordable.
- **The parameter domain is projection** (§10): the build catalogue with costs and unlock
  state, the staff roster, the price ranges. A client renders a build menu from the
  projection, not from `availableActions`.
- **`scene` renders a status summary** — tick, cash, guest count, objective progress — as
  a `SceneBody`, the generic surface every client can show without knowing this kind.

**One session operation is missing, and this kind is the first to need it.** A spatial
placement must be checkable before it is committed. Today the only check is to submit and
rely on rejection leaving state unchanged (04 §4 step 5) — correct, but it routes a read
through a write path, and clients hold projections rather than state (09 §1) so they cannot
call the pure engine themselves.

```typescript
previewAction(sessionId: string, actionId: string, params?: ActionParams)
  : Promise<SessionActionResult>;      // runs kind.advance, discards the state
```

It **cannot drift from the real rules** because it is literally the same `advance` call with
the result discarded — which is why a separate `validateCommand` of the sort the draft
proposed is rejected: that is a second copy of the ruleset.

> **Consequence, stated rather than smuggled in.** This makes the API coverage checklist
> ([`09-clients.md`](09-clients.md) §4) ten operations and ten MCP tools rather than nine
> and nine. That checklist is an MVP Definition-of-Done item and this kind is post-MVP, so
> **09 is not amended now**; the pairing is added when this kind is built. Recorded in
> [`OPEN-QUESTIONS.md`](OPEN-QUESTIONS.md) §2.

---

## 8. Status, Win, Loss, and Terminal Identity

The draft's `"active" | "completed" | "failed" | "abandoned"` conflicts with the envelope's
`GameStatus = "active" | "ended" | "abandoned"` (04 §2). `completed` and `failed` do not
exist at the envelope level, and should not: **the core has no concept of winning.**

Both map to `ended`. The win/loss distinction is **terminal identity**, which is what
`Kind.outcome` is for ([`07-replay.md`](07-replay.md) §3.3):

```typescript
outcome(state: WorldGraphKindState): {
  resolution: "objectives_met" | "failed" | null;   // null while active
  objectivesMet: readonly string[];                  // published objective ids
  failureId: string | null;                          // published failure-condition id
}
```

Published ids only. **Cash, guest counts, satisfaction and the tick it ended on are
deliberately excluded** — every one changes legitimately under a balance pass, and a
regression oracle that treated a balance change as a defect would be abandoned within a
month (07 §3.4).

---

## 9. Determinism Beyond the Seed

`story-graph` and `simulation` get determinism almost free: few draws, small state, no
geometry. This kind does not, and the rules below are the contract.

**Integer arithmetic only.** Utility scores, path costs, condition and cleanliness values,
and all money are integers — fixed-point where a fraction is needed, with the scaling
factor part of the content contract. The determinism guard in `src/engine/eslint.config.js`
([Engine Package](/docs/guide/engine-package)) already bans the non-bit-stable `Math.*`
functions; this states the positive rule those bans imply.

**No `Math.sqrt` in distance.** Comparisons use squared Euclidean, Manhattan or Chebyshev
distance — all integer, all order-preserving for the comparisons that matter.

**Every tie has an explicit rule, and the rule is the entity id.** Utility ties, path
neighbour order, queue position, staff task priority. The draft's own §2.4 names this as a
top risk; naming the tiebreaker once, here, is what discharges it.

**Iteration order is canonical, not insertion order.** Entity collections are iterated in
id order regardless of how they are stored, so an insertion or removal never perturbs an
unrelated entity's behaviour.

**Entity ids are derived, never supplied.** Guests, staff, buildings, sites, queues and
tasks take ids from `nextEntityOrdinal` in `kindState`, formatted `<prefix>:<ordinal>`.
They may **not** come from the `IdSource` port — 06 §2's rule is that a host may supply
anything that *cannot change `serialize()` output*, and entity ids are serialized. `gameId`
and `seed` come from `IdSource` precisely because they are inputs; these are not.

**Derived caches are never serialized.** Path caches and distance fields keyed by
`map.revision` are recomputed, not persisted — a cache in serialized state is a field free
to drift, the same objection §3 makes to `rng`.

---

## 10. Projection

`WorldGraphView` is the `kindView` inside the core's `PlayerView` (04 §9), and it carries only what
the generic surface does not. It does not include:

- seed or any RNG/stream state
- future incident weights or hidden scenario triggers
- undiscovered preferences/thresholds
- internal path caches
- per-candidate utility breakdowns

```typescript
interface WorldGraphView {
  tick: number;
  finances: {
    cashCents: number;
    revenueTodayCents: number;
    expensesTodayCents: number;
  };

  map: {
    width: number;
    height: number;
    revision: number;
    spawnPoints: readonly Position[];
    exits: readonly Position[];
    zones: readonly string[];
    buildingCount: number;
    guestCount: number;
    staffCount: number;
  };

  buildOptions: readonly {
    definitionId: string;
    canBuild: boolean;
    blockedBy: string[];
  }[];

  buildings: readonly {
    id: string;
    definitionId: string;
    isOpen: boolean;
    status: BuildingStatus;
    queueLength: number;
    cleanliness: number;
    wear: number;
  }[];

  staff: readonly {
    id: string;
    roleId: string;
    status: StaffStatus;
    zoneId: string | null;
    buildingId: string | null;
  }[];

  objectives: readonly Pick<ObjectiveProgress, "id" | "state" | "value" | "target">[];
  alerts: readonly Pick<Alert, "id" | "type" | "severity" | "titleKey" | "messageKey" | "issuedAtTick">[];
  queuedGuests: number; // across all building queues
}
```

`outcome(state)` in §8 is reconciled with this view by using only published objective ids for
`objectivesMet` and `failureId`, and excluding all other runtime internals.

---

## 11. Reason Codes

Codes this kind adds to the base set (`Kind.reasonCodes`, 04 §3, §12). Each needs a
localized message or registry validation fails:

| Code | When |
|---|---|
| `insufficient_funds` | Cost exceeds available cash |
| `placement_overlaps` | Footprint intersects an existing building or site |
| `placement_terrain_unsuitable` | Terrain does not satisfy the definition's requirement |
| `placement_out_of_bounds` | Footprint leaves the map |
| `placement_unreachable` | No walkable path from any spawn to any entrance |
| `building_locked` | The scenario has not unlocked this definition |
| `unknown_entity` | A `params` id names no building, staff member, zone or alert |
| `building_not_open` | The operation requires an open building |
| `price_out_of_range` | Outside the definition's permitted band |
| `staff_limit_reached` | The scenario caps this role |
| `ticks_not_positive` | `advance_ticks` with `ticks` less than 1 |
| `tick_limit_reached` | `ticks` exceeds the campaign's per-call cap (§6) |

Reused from the base set: `unknown_action`, `requirement_unmet`, `session_ended`,
`action_not_available`.

---

## 12. Events

Namespaced `kind.world-graph.*` (05 §9), declared as `Kind.eventNames`:

| Name (after the namespace) | Severity | Emitted at |
|---|---|---|
| `batch.started` / `batch.ended` | `debug` | Around an `advance_ticks` batch, with `ticks` |
| `guest.spawned` | `trace` | Guest spawn system |
| `guest.intent.selected` | `trace` | With the chosen target and winning utility |
| `guest.path.failed` | `debug` | Target unreachable — the diagnosable failure |
| `guest.queue.abandoned` | `trace` | Patience exceeded or a better option appeared |
| `guest.served` | `trace` | Service completed, with amount |
| `guest.departed` | `debug` | With the departure reason |
| `staff.task.assigned` / `staff.task.completed` | `trace` | Task lifecycle |
| `building.placed` / `building.status.changed` | `info` / `debug` | Construction and operation |
| `incident.raised` | `info` | Incident system |
| `objective.progressed` | `debug` | Objective evaluation |
| `scenario.resolved` | `info` | Win or failure, with the `outcome` ids (§8) |

**`guest.path.failed` earns its place.** A resort where guests silently cannot reach a
building looks identical to one where they do not want to — the failure is invisible in the
projection and obvious in the stream.

> **Volume is real here and severity is how it is managed.** A 360-tick batch with 500
> guests emits on the order of 10⁵ `trace` events. That is acceptable only because 05 §2
> guarantees dropping every event changes nothing: a host runs `nullEmitter` normally and
> raises the level to diagnose. No event may be load-bearing.

---

## 13. `StateChange` at Batch Grain

`advance_ticks 360` cannot return a `StateChange` per guest transaction — `StateChange` is
a player-facing audit record whose `visible` flag gates client display (04 §12), and no
client renders 10⁵ rows.

**So `StateChange` carries batch-grain audit only**: money aggregated per category, building
status transitions, objective progress, scenario resolution. Per-guest and per-tick detail
is an **event** (§12), where it is discardable by design. This is the boundary 05 §1 draws,
applied to the first kind with the volume to test it.

---

## 14. Content, Definitions, and Packs

Guest archetypes, staff roles, buildings, products, terrain, scenery, incidents, scenarios,
objectives, policies and achievements are **campaign data**, loaded through the content
registry (04 §10.1) exactly as story-graph campaigns are.

Identity fields — `id`, `version`, `titleKey` — live on the core `Campaign` envelope and
**not** in this kind's content types, the correction already applied twice (04 §10.1,
10 §7).

**The draft's open question on packs is closed.** Its §10 says "the merge strategy is not
yet decided"; [`11-content-packs.md`](11-content-packs.md) decides it — campaigns replace
wholesale, strings replace per key, dependencies are exact-version and acyclic, and
`campaignVersion` becomes a digest of the resolution. This kind needs no pack mechanism of
its own.

---

## 15. Validation

`Kind.validateCampaign(campaign, strings)` (04 §3) is where all of this is implemented. It
runs at registry construction, before the registry is frozen, and it is pure and total —
no simulation, no search, no I/O.

The draft's Tier 1 and Tier 2 lists map onto the tiered validator (04 §11) unchanged:
duplicate ids, missing references, invalid footprints, missing localization, buildings with
no entrance, negative capacity are Tier 1; unreachable unlocks, map regions disconnected
from every spawn, building categories with no demand, staff roles with no task generator
are Tier 2.

Three additions this contract requires. At **Tier 1**: the `advance_ticks` cap (§6) must be
present and positive, and every price band must be a valid integer-cent range. At **Tier
2**: a scenario already resolved at tick 0 — objectives satisfied or a failure condition met
before the player acts (§3.1). That is a legal campaign, so it warns rather than fails, but
it is almost always an authoring error.

> **The draft's "Tier 3 simulation findings" is not validation.** Dominant buildings,
> infinite-money loops, queue deadlock and unavoidable bankruptcy are **content-balance**
> findings from a simulation harness, not load-time checks over a campaign. Calling them a
> validation tier would put a long-running search inside registry construction, which 04
> §10.1 requires to be pure and total. They belong to the balance harness, which is a game
> concern (§17).

---

## 16. Replay

A `ReplayFixture` (07 §2) records `submissions` including every `advance_ticks` with its
`ticks` parameter, so replay reproduces the exact batching and is exact.

Batch invariance (§5) is the **stronger** property, and it is what makes captured sessions
portable: a fixture recorded from a client running at 4× compares equal to the same play at
1×, because the comparison is over `Outcome`, not bytes.

---

## 17. What Remains in the Game Repository

This is the seam, not the game. **Sun Trap** — its vision, design, guest and building field
detail, client specification, MVP, roadmap and balance harness — lives in
[SubZeroDev.SunTrap](https://github.com/The-Running-Dev/SubZeroDev.SunTrap), exactly as Life
in the Fast Lane does for `simulation` (10 §15).

| Lives with the game | Why not here |
|---|---|
| Guest, staff, building, queue and construction field detail | Content schema, not seam. §3 fixes where it lives; the fields themselves are game material |
| The tick duration, utility formula weights, price elasticity | Balance, revisited every playtest |
| Map authoring, scenarios, objectives, incidents | Campaign data |
| The visual client and its renderer choice | 09 already fixes the client contract; the renderer is a game decision |
| The balance harness (§15) | Searches for dominant strategies — a game tool, not an engine gate |

**"Field detail lives with the game" names *design authority*, not a permanent split of the
TypeScript itself.** The shapes in this table are still engine code once built — `Guest`,
`Building`, `ResortMap` and the rest compile inside this kind's own package the same way
`simulation`'s `ActorState`/content-definition types do (10 §7, §15), not as a second copy
Sun Trap maintains in parallel. What "lives with the game" is the *content this schema
carries* — which guest archetype, which drink stand, which map — and the design decisions
behind field values, exactly as 10 §15 states for `simulation`. `SubZeroDev.SunTrap/docs/
docs/design/content-and-systems.md` already writes its own state shapes to this contract's
rules and defers to it on every disagreement — that draft is source material this kind's own
build ports from and then owns, the same relationship upstream's engine specification had to
`10-simulation-kind.md` before it was ported (`plans/39-world-graph-kind-programme.md`).

**Nothing above changes this contract's shape.** Each is detail hanging off a seam this
document fixes — the same relationship, and the same reasoning, as 10 §15.
