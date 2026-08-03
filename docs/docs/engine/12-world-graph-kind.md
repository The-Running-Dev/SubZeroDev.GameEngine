---
sidebar_label: World-Graph Kind
---

# World-Graph Kind — Contract

**Document status:** Revision 3 — **authoritative runtime-state and campaign-content
contract.** Concrete content and balance live with the game; §17 says exactly what and why.

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
  failures: readonly FailureProgress[];
  alerts: readonly Alert[];

  counters: WorldCounters;
  unlockedContent: readonly ContentReference[];
  activePolicyIds: readonly string[];
  unlockedAchievementIds: readonly string[];

  nextEntityOrdinal: number;                      // §9 — the deterministic id source
}
```

> **The draft's `ResortMap` is named `WorldMap` here.** §1 rejects the name
> `management-simulation` on the grounds that *a colony sim, an ecosystem model or a
> transport network would run on this identical kind* — and a type called `ResortMap` in
> engine-owned code contradicts that argument in the most visible place it could, the state
> interface. Both built kinds use structural names (`Node`, `Choice`; `ActorState`,
> `PlayerState`), never themed ones. `Guest`, `Staff` and `Building` **stay**: they name
> structural roles this kind models — an autonomous visitor that arrives with needs and
> departs, an employee the player pays and assigns, a placed structure with a footprint —
> and they read correctly for a colony or a transport network. `Resort` names a *theme*;
> the other three name *roles*.

> **The clock collapses to `tick`.** The draft's `ResortClock` carries
> `ticksPerMinute`, `minute`, `hour`, `day` and `paused`, then states that "only `tick` is
> authoritative. Other values may be derived." Derived values do not belong in serialized
> state — they can disagree with what they summarise, and the disagreement is unresolvable
> (the rule 10 §2 applied to `totalTimeCost`). `ticksPerDay` is campaign data; the rest
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

`Kind.initialState(campaign, ctx)` (04 §3) resolves `WorldGraphCampaign.startScenarioId`,
resolves that scenario's `mapId`, materializes the selected `MapDefinition` as `WorldMap`,
then applies starting cash, unlocks, active policies, pre-placed buildings/scenery, zeroed
counters, objective/failure progress, empty achievement unlocks, `map.revision: 0`, and
`tick: 0`. The conversion is deterministic:
terrain cells are emitted in row-major `(y, x)` order; derived grid edges use W44's fixed
neighbour order; scenario placements are allocated in their authored order.

Two rules the seam already implies, stated because a spatial kind is the first place they
bite:

- **Pre-placed buildings and scenery take ids from `nextEntityOrdinal` like any other**
  (§9), assigned in authored order: all `buildingPlacements`, then all
  `sceneryPlacements`. A scenario with three buildings and two scenery placements starts
  with `nextEntityOrdinal: 5`; ids are a pure function of the campaign, never load order or
  a host id source.
- **Any randomness in setup draws from `ctx.derive({ kind: "tick", tick: 0, system })`**, not
  from `ctx.rng`. `initialState` is not an action and has no `seq`; keying setup by tick 0
  keeps §5's rule — *this kind never touches the action stream* — true without exception.

`InitialStateResult.status` may be `"ended"` at creation, exactly as `story-graph` may settle
onto an ending before the player acts (04 §3). For this kind that means a scenario whose
objectives are already satisfied or whose failure condition already holds at tick 0 — a valid
campaign that Tier 2 should warn about (§15), not a crash.

### 3.2 Runtime-State Type Contract (engine-owned)

The types below are now the complete closure required by §3. **All identifiers are opaque
strings unless a dedicated namespace is stated — opaque in *meaning*, with exactly one
constraint on their *shape*: no identifier may contain a `.`.** §13's audit paths are
dot-separated, so a dot inside an id makes a path parse two ways; the rule is stated at
Tier 1 in §15 and argued in §13. Nothing else about an id is constrained, and no code may
infer anything from one.

Two reading conventions:

- **`// MVP-inert`** marks a field the flagship game's own MVP (Sun Trap's `mvp.md` §4, in
  its repository — not this repository's [`MVP.md`](MVP.md)) puts out of
  scope. It is specified anyway — the `simulation` precedent is unambiguous, since W32–W35
  ported the whole upstream contract far beyond what "Stable Life" ever used — and marked
  **at the field** so the build units know what may stay inert without it reading as an
  omission. A separate table would drift from the fields it describes.
- **Every `number` states its scale**, because a bare one is a scale a reader has to guess.
  Money is integer cents, time is ticks, and anything bounded names its bounds.

```typescript
interface WorldGraphKindState {
  tick: number;                                      // authoritative tick counter
  map: WorldMap;                                     // terrain, zones, spawns, exits, revision
  finances: Finances;

  buildings: readonly Building[];                    // includes nested Queue + StaffTask
  constructionSites: readonly ConstructionSite[];
  guests: readonly Guest[];                          // includes full guest path, need, and condition state
  staff: readonly Staff[];                           // includes nested StaffTask

  incidents: readonly Incident[];
  objectives: readonly ObjectiveProgress[];
  failures: readonly FailureProgress[];
  alerts: readonly Alert[];

  counters: WorldCounters;
  unlockedContent: readonly ContentReference[];
  activePolicyIds: readonly string[];              // MVP-inert
  unlockedAchievementIds: readonly string[];       // MVP-inert; authoritative in-game mirror

  nextEntityOrdinal: number;                         // deterministic id source, never `IdSource`
}

type Position = {
  x: number;         // integer grid coordinate, same origin as map terrain
  y: number;         // integer grid coordinate, same origin as map terrain
};

type StaffStatus = "idle" | "to_work" | "working" | "off_duty";
type GuestLifecycle = "arriving" | "seeking" | "queued" | "served" | "departed" | "removed";
type BuildingStatus = "construction" | "open" | "closed" | "broken";
type LoanStatus = "active" | "defaulted" | "repaid";
type IncidentSeverity = "info" | "minor" | "major" | "critical";
type AlertSeverity = "info" | "warning" | "critical";
type ObjectiveProgressState = "active" | "met" | "failed";
type FailureProgressState = "active" | "triggered";
type StaffTaskType = "service" | "clean" | "restock" | "build";
type StaffTaskStatus = "queued" | "assigned" | "in_progress" | "completed" | "cancelled";
type Rotation = 0 | 90 | 180 | 270;
type GuestNeedValue = number;      // integer within the referenced NeedDefinition range
type PercentBasis = number;        // integer basis points, where 10000 = 100%

interface WorldMap {
  width: number;                             // positive integer, map width in tiles
  height: number;                            // positive integer, map height in tiles
  revision: number;                          // non-negative integer; changes whenever walkability changes
  terrain: readonly TerrainCell[];           // deterministic terrain graph
  paths: readonly PathCell[];                // explicit path graph edges, derived caches must be recomputed
  zones: readonly Zone[];                    // zones of operation and policy scope
  spawnPoints: readonly Position[];           // at least one guest-spawn point required
  exits: readonly Position[];                // at least one exit point required
  scenery: readonly Scenery[];               // scenario-authored placements, materialized at setup
}

interface TerrainCell {
  x: number;                                // integer [0, width)
  y: number;                                // integer [0, height)
  terrainId: string;                        // TerrainDefinition id; traits/cost stay in campaign content
}

interface PathCell {
  from: Position;
  to: Position;
  edgeCost: number;                         // non-negative integer; distance-only, no float metrics in state
  allowed: boolean;                         // if false, this edge is never traversed
}

interface Zone {
  id: string;
  nameKey: LocKey;                          // localization key for projection/debug
  cells: readonly Position[];               // canonical zone footprint, row-major by (y, x)
  serviceRadius: number;                    // integer tile radius from zone centroid
  maxOccupancy: number | null;              // null = unlimited
}

interface Scenery {
  id: string;                               // `<scenery>:<ordinal>` from `nextEntityOrdinal`
  definitionId: string;                     // SceneryDefinition id
  x: number;                                // integer tile x of anchored origin
  y: number;                                // integer tile y of anchored origin
  width: number;                            // positive integer tile width after rotation
  height: number;                           // positive integer tile height after rotation
  rotation: Rotation;
}

interface Building {
  id: string;                               // `<building>:<ordinal>` from `nextEntityOrdinal`
  definitionId: string;                     // campaign content contract
  x: number;                                // integer tile x of anchored origin
  y: number;                                // integer tile y of anchored origin
  width: number;                            // integer tile width from definition
  height: number;                           // integer tile height from definition
  rotation: Rotation;                       // all four declared; a scenario narrows it at Tier 1
  status: BuildingStatus;
  isOpen: boolean;
  buildStartTick: number;                   // inclusive tick when building entered state
  wear: number;                             // integer 0..100, higher is healthier
  cleanliness: number;                      // integer 0..100, higher is cleaner
  queue: Queue;
  products: readonly string[];              // product ids offered by this building
  pricesCents: Readonly<Record<string, number>>;  // product id → integer cents; keys are the ids in `products`
  inventory: Readonly<Record<string, number | null>>; // product id → units; null = unlimited
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
  cashCents: number;                        // non-negative integer cents
  targetBuildingId: string | null;           // active target, if currently navigating
  targetQueueId: string | null;             // queue destination, if queued
  targetProductId: string | null;           // purchase target, if any
  targetWaitTicks: number;                  // non-negative integer ticks this guest will tolerate waiting
  needs: Readonly<Record<string, GuestNeedValue>>; // NeedDefinition id → declared-scale value
  conditions: Readonly<Record<string, number>>;    // GuestConditionDefinition id → declared-scale value
  opinions: Readonly<Record<string, number>>;      // OpinionDefinition id → declared-scale value
  preferences: Readonly<Record<string, number>>;   // PreferenceDefinition id → declared-scale value
  satisfaction: number;                     // integer 0..100
  patienceRemainingTicks: number;            // non-negative integer, decrements while queued/unserved
  lastServedTick: number | null;            // null until first served
  spentTicks: number;                       // non-negative integer, ticks alive in the world
}

interface Staff {
  id: string;                               // `<staff>:<ordinal>`
  roleId: string;                           // content contract
  x: number;
  y: number;
  status: StaffStatus;
  assignedBuildingId: string | null;
  assignedZoneId: string | null;            // MVP-inert — the only stored zone membership
  drawCount: number;                        // agent-level deterministic draw counter
  task: StaffTask | null;                   // singular active task
  tasksCompleted: number;                   // cumulative counter, monotonic
}

interface StaffTask {
  id: string;                               // `<staff-task>:<ordinal>` (nested entity id)
  type: StaffTaskType;
  status: StaffTaskStatus;
  guestId: string | null;
  queueId: string | null;
  buildingId: string | null;
  incidentId: string | null;
  targetProductId: string | null;
  startedAtTick: number;
  endedAtTick: number | null;
  priority: number;                         // deterministic tie-break source for dispatch
  effortTicks: number;                      // non-negative integer
}

interface Finances {
  cashCents: number;                        // integer cents
  revenueTodayCents: number;                // integer cents, resets at each day boundary (§3.3)
  expensesTodayCents: number;               // integer cents, resets at each day boundary (§3.3)
  revenueTotalCents: number;                // integer cents
  expensesTotalCents: number;               // integer cents
  loan: Loan | null;                        // MVP-inert
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
  definitionId: string;                     // IncidentDefinition id
  severity: IncidentSeverity;
  buildingId: string | null;
  guestId: string | null;
  zoneId: string | null;
  startedAtTick: number;
  expiresAtTick: number | null;
  resolvedAtTick: number | null;
}

interface ObjectiveProgress {
  id: string;                               // objective id (published)
  state: ObjectiveProgressState;
  value: number;                            // W44's canonical integer projection of progress
  target: number;                           // integer target threshold
  satisfiedSinceTick: number | null;         // null until the completion condition becomes true
  updatedAtTick: number;
}

interface FailureProgress {
  id: string;                               // failure-definition id (published)
  state: FailureProgressState;
  satisfiedSinceTick: number | null;         // null until the failure condition becomes true
  updatedAtTick: number;
}

interface Alert {
  id: string;                               // `<alert>:<ordinal>`
  type: string;                             // gameplay-specific alert discriminator
  severity: AlertSeverity;
  titleKey: LocKey;
  messageKey: LocKey;
  entityId: string | null;                  // owning entity when applicable
  issuedAtTick: number;
  dismissedAtTick: number | null;
}

interface WorldCounters {
  guestsEntered: number;                     // non-negative monotonic count
  guestsDeparted: number;                    // non-negative monotonic count
  guestsDissatisfied: number;                // non-negative monotonic count
  servicesCompleted: number;                 // non-negative monotonic count
  buildingsCompleted: number;                // non-negative monotonic count
  incidentsRaised: number;                   // non-negative monotonic count
  litterCreated: number;                     // non-negative monotonic units
  litterCleaned: number;                     // non-negative monotonic units
}
```

### 3.3 Structural Answers, and What Remains the Game's

Five questions the draft left open, all settled here — because each turns out to be an
application of a rule this contract already owns rather than a question about what the game
contains — followed by two fields whose *absence* needs saying out loud.

The test that separates them: **would a different answer change what the engine is allowed
to store, or only what the game contains?** The first is this repository's; the second is
the game's. Three of these read as content-design questions and were the first kind.

**1 — `Building.entrances` is not runtime state.** An entrance position is *derived*:
`(x, y)` plus `rotation` plus the definition's authored offsets. §3's clock callout bans
derived values from serialized state — *they can disagree with what they summarise, and the
disagreement is unresolvable* — and an absolute `entrances` array is the same defect as the
persisted `rng` it sat four fields away from. Storing footprint-relative offsets on the
instance is the third option and is also declined: it copies the definition into every
placed building, so a definition edit and its instances can diverge.

The **rotation transform is stated here anyway**, even though the offsets themselves are
content (§14.3), because rotating an integer offset is a determinism concern and leaving it
to be re-derived per call site is how two call sites end up disagreeing. For a definition
of width `w` and height `h`, an authored offset `(ox, oy)` relative to the unrotated
footprint's origin maps to:

```text
  0°  → (ox,          oy)
 90°  → (h - 1 - oy,  ox)
180°  → (w - 1 - ox,  h - 1 - oy)
270°  → (oy,          w - 1 - ox)
```

and the absolute cell is the building's `(x, y)` plus that result. All integer, so the
transform is exact. §14.3 defines `EntranceOffset`, and `BuildingDefinition` owns the values.

**2 — Rotation declares all four values.** `0 | 90 | 180 | 270` costs nothing if a scenario
only ever authors `0`, and Tier 1 (§15) is where a scenario narrows it. This is the general
rule for a seam an answer cannot change: **specify permissively, and validate narrowly.**

**3 — Guest meters are content-declared records, not fixed engine vocabularies.** Sun Trap's
MVP needs `thirst` and `toilet`, while the W42 draft hard-coded neither; its wider design
also names conditions and opinions another campaign may never use. `Guest.needs`,
`conditions`, `opinions`, and `preferences` are therefore records whose keys are declared
by the four definition catalogs in §14. A guest archetype supplies every initial key/value;
Tier 1 rejects missing, extra, or out-of-range keys. The mechanical fields every campaign
shares — satisfaction, patience, service time, cash, targets — remain explicit fields on
`Guest`.

This does not turn evaluation into state. Staff behaviour, accessibility, noise, travel
cost, and queue length remain decision-time inputs W44 computes from the world. Only a meter
a system carries across ticks belongs in one of the four records. The membership test still
holds: a value no system writes, no condition reads, and no projection exposes does not earn
a serialized key merely because one game design names it.

**4 — Departed guests are pruned.** A guest reaching `"departed"` or `"removed"` is removed
from `guests` at the end of the tick batch that finalized that lifecycle state. Without
this, state grows without bound across a scenario — and every departed guest still carries
`path`, `needs`, `conditions`, `opinions` and `preferences`, so the per-guest cost is not
small. A serialized save *is* `serialize()` output, which makes unbounded growth a
correctness concern and not merely a performance one. Nothing is lost that matters:
objective accumulators live in `ObjectiveProgress`, and per-guest history is an **event**
(§12), where it is discardable by design.

**5 — The "today" boundary is a pure function of `tick`.** `revenueTodayCents` and
`expensesTodayCents` are genuine accumulators — today's revenue cannot be recovered from
cash — so unlike entrances they stay. They reset on **the first tick of a new day**, where
the day is `floor(tick / ticksPerDay)` and `ticksPerDay` is campaign data, validated
positive at Tier 1 (§15). No day field is stored, so §3's rule that the clock collapses to
`tick` alone holds. **The *value* of `ticksPerDay` is balance and belongs to the game; the
rule does not depend on it.**

**6 — Two fields are deliberately absent, and their absence is the point.** A `Staff.zoneId`
"current zone at read time" alias would be a derived value beside the stored
`assignedZoneId` it derives from — banned by the same rule as entrances. A
`Guest.arrivalTick` alias would restate `Guest.tickEntered`. Both are the
duplication defect one level down: *inside* `kindState` rather than against the envelope.

**What genuinely remains the game's** is the concrete content: which entrance offsets,
need/opinion vocabularies, prices, curves, and `ticksPerDay` value it authors. §14 owns the
shape and validation; §17 leaves the values and balance with the game.

`queue`, `staff task`, and nested entity collections are not top-level collections. Their ids are
still derived from `nextEntityOrdinal` at creation.

> **The open-keyed records, reconciled against N6.** `Building.pricesCents`/`inventory` and
> `Guest.needs`/`conditions`/`opinions`/`preferences` are `Readonly<Record<...>>`, which
> [`02-architecture.md`](02-architecture.md) N6
> bans as a loose bag. `10 §6.2` already answered this for `ActorState`'s
> `skills`/`reputation`/`flags`/`counters`, and the argument transfers unchanged: **a record
> whose keys are declared by validated content is not a loose bag, because Tier 1 closes the
> key set at load.** Building record keys are exactly `Building.products`; guest record keys
> are exactly those in the archetype profiles, which must resolve in their definition
> catalogs. A key outside either set is Tier 1, not a runtime surprise. Written out rather
> than assumed, because an unexamined `Record<string, number>` is indistinguishable on the
> page from the thing N6 bans.

### 3.4 Canonical collection order

All serialized arrays are iterated in id order for contract behavior, not insertion order:

- `buildings`, `constructionSites`, `guests`, `staff`, `incidents`,
  `objectives`, `failures`, and `alerts` are all canonicalized by each element's `id`
  before any system touch.
- `map.scenery` is canonical by its derived entity id; `unlockedContent` is canonical by
  `(kind, id)`; `activePolicyIds` and `unlockedAchievementIds` are lexicographic by id.
- For each `Building`, `queue.guestIds` is canonical by `guest.id`, and service selection uses
  the `queue.id` order then `guest.id` within each queue.
- For each `Staff`, `task` is singularly active in this unit, but if history snapshots are stored in
  a future extension, they must be canonical by `StaffTask.id`.

This rule is what keeps unrelated entities' behavior stable under insertion or removal operations.

**Id order is `(prefix, ordinal)` with the ordinal compared numerically, never
lexicographically.** `building:10` sorts *after* `building:2`, which a plain string
comparison gets backwards — and a comparator that gets it backwards is a determinism defect
that appears only once a scenario runs past nine entities of one prefix, which is precisely
the kind of bug this document exists to prevent.

**The reducers maintain the order rather than re-sorting for it.** Every entity collection
governed by `nextEntityOrdinal` appends in allocation order, so insertion order *is* id
order and removal preserves it. Content-reference and published-id arrays insert in their
declared canonical order; removing or toggling an entry preserves that order. Canonical
order is therefore an invariant to test rather than a sort to run on every system pass — a
500-guest sort per tick would be the dominant cost in a 360-tick batch.

---

## 4. The Turn Is a Tick Batch

Actions split into two groups, exactly as `simulation`'s do:

```text
build · demolish · hire_staff · fire_staff · assign_staff ·
set_price · open_building · close_building ·
dismiss_alert                                      → mutate the world, no time passes

advance_ticks { ticks }                            → run the tick pipeline `ticks` times
```

**Nine mutate without advancing time, not eight.** `dismiss_alert` is one of them: §3 makes
an alert state precisely because it persists until dismissed and dismissal is a player
action, and §6 has always listed it. An earlier revision of this split omitted it, and the
undercount spread to two other documents before it was caught.

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

**A win requires at least one objective and every one must be `"met"`.** A triggered
`FailureProgress` produces `"failed"` and its published id; a scenario that declares no
objectives has nothing to win. Vacuous truth is the wrong reading—it would end a sandbox
before the player saw one tick—so §15 warns instead. If the last objective becomes met on the
same tick a failure triggers, W44 owns the explicit precedence rule; W43 supplies both typed
facts and does not settle their evaluation order early.

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
    /** Every §11 code that would reject a build of this definition *regardless of where*
     *  it is placed: `building_locked`, `insufficient_funds`, `building_limit_reached`.
     *  Placement-dependent rejections — bounds, terrain, overlap, reachability — are not
     *  knowable without `(x, y, rotation)` and are what `previewAction` (§7) is for.
     *  Every entry is a §11 code; this list never invents one. */
    blockedBy: readonly ReasonCode[];
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
    zoneId: string | null;        // from `Staff.assignedZoneId` — there is no second, derived one (§3.3)
    buildingId: string | null;    // from `Staff.assignedBuildingId`
  }[];

  objectives: readonly Pick<ObjectiveProgress, "id" | "state" | "value" | "target">[];
  alerts: readonly Pick<Alert, "id" | "type" | "severity" | "titleKey" | "messageKey" | "issuedAtTick">[];
  queuedGuests: number; // across all building queues
}
```

`outcome(state)` in §8 is reconciled with this view by using only published objective ids for
`objectivesMet` and `failureId`, and excluding all other runtime internals.

**The view repeats nothing the generic surface already carries.** Checked field by field
against 04 §6's `Scene` and 04 §9's `PlayerView`: `gameId`, `status`, the scene body and the
action list all live there and appear nowhere above — the sixth check against `CLAUDE.md`'s
envelope-duplication ledger and the second on the view side, after `StoryGraphView`
duplicated scene and status fields (03 §9). `tick` is *not* a repeat: the envelope has no
clock, and §4 makes `tick` this kind's own.

**`buildOptions`, `availableActions` and the reducer must agree.** A definition the reducer
would reject for a placement-independent reason must be `canBuild: false` here and must
carry the same code in `blockedBy`; `build` is `available: false` in §7 only when *no*
definition can be built at all. §7 makes clients render the build menu from this projection,
so a disagreement is a client showing an option the engine will refuse — the failure mode
"shown-but-disabled with a reason" exists to prevent.

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
| `building_limit_reached` | The scenario caps this definition — the building-side twin of `staff_limit_reached`, and what `blockedBy` (§10) reports for a definition at its cap |
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
| `building.placed` / `building.demolished` | `info` / `debug` | The `build` and `demolish` reducers |
| `staff.hired` / `staff.fired` / `staff.assigned` | `info` / `debug` / `trace` | The staff reducers |
| `alert.dismissed` | `trace` | The `dismiss_alert` reducer |
| `guest.spawned` | `trace` | Guest spawn system |
| `guest.intent.selected` | `trace` | With the chosen target and winning utility |
| `guest.path.failed` | `debug` | Target unreachable — the diagnosable failure |
| `guest.queue.abandoned` | `trace` | Patience exceeded or a better option appeared |
| `guest.served` | `trace` | Service completed, with amount |
| `guest.departed` | `debug` | With the departure reason |
| `staff.task.assigned` / `staff.task.completed` | `trace` | Task lifecycle |
| `building.status.changed` | `debug` | `open_building` / `close_building`, and construction completion |
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

**Batch grain is about *which* records, not *whether*.** The nine no-time-passes actions
(§4) are single, player-initiated mutations with no volume problem at all, and each returns
its `StateChange`:

| Action | `path` | `value` (`previous`) | `reason` |
|---|---|---|---|
| `build` | `finances.cashCents` | cash after (cash before) | `building_placed` |
| — immediate | `buildings.<buildingId>.exists` | `true` | `building_placed` |
| — with build time | `constructionSites.<siteId>.exists` | `true` | `construction_started` |
| `demolish` | `buildings.<buildingId>.exists` | `false` (`true`) | `building_demolished` |
| `hire_staff` | `finances.cashCents` | cash after (cash before) | `staff_hired` |
| | `staff.<staffId>.exists` | `true` | `staff_hired` |
| `fire_staff` | `staff.<staffId>.exists` | `false` (`true`) | `staff_fired` |
| `assign_staff` | `staff.<id>.assignedBuildingId` / `.assignedZoneId` | the id, or `""` | `staff_assigned` |
| `set_price` | `buildings.<id>.pricesCents.<productId>` | integer cents (previous cents) | `price_set` |
| `open_building` / `close_building` | `buildings.<id>.isOpen` | boolean (previous) | `building_opened` / `building_closed` |
| `dismiss_alert` | `alerts.<id>.dismissedAtTick` | the tick | `alert_dismissed` |
| `advance_ticks` | `tick` | tick after (tick before) | `ticks_advanced` |

**`build` writes one of two entity rows.** §6 lets it place a building *or* open a
construction site; which one depends on whether the definition carries a build time, and the
site's own `buildTicksRemaining` is counted down by the tick pipeline (W46). Both rows are
listed so the second is not discovered later as a gap.

> **`op` is always `set`, and `value` is always the value after.** 04 §12 offers
> `increment`/`decrement`, but defines no meaning for `value` when they are used — is it the
> delta or the result? Its own worked examples only ever use `set` with `value` + `previous`,
> and 03 §5's variable write is explicit that `op` stays `set` "regardless of which
> increment/decrement/set operations actually ran". Following that: this kind emits `set`,
> `value` is the state after, `previous` is the state before, and a consumer wanting the
> delta subtracts. A `decrement` row whose `value` was the resulting balance would be read by
> half its consumers as the amount deducted.

> **Every path addresses one scalar field, and a collection is never a path.** That is
> forced rather than stylistic: 04 §12 types `StateChange.value` as
> `string | number | boolean`, so a row saying `path: "buildings"` has nothing legal to put
> in `value`, and "the array changed" is not an audit record a client could render anyway.
>
> **A path is the dotted traversal of `WorldGraphKindState` (§3.2) down to the scalar that
> changed** — which closes the valid set without a second list to maintain. Two shapes follow
> from the state's own shape, and only two:
>
> | Shape | Reaches | Examples |
> |---|---|---|
> | **Singleton** | a scalar not held in a collection | `tick`, `finances.cashCents`, `map.revision` |
> | **Entity-scoped** | `<collection>.<entityId>.<field>` | `buildings.b:3.isOpen`, `alerts.a:9.dismissedAtTick` |
>
> `<entityId>` is the entity's own id (§9), never its array index — an index is a property of
> how the collection is stored, and §3.4's whole point is that storage order is not
> addressable. A `null` assignment is `""` for the same reason the collection rule exists:
> the type has no null.
>
> **A dotted path is only unambiguous because no id may contain a dot.** §3.2 calls
> identifiers opaque, and opacity of *meaning* would otherwise imply freedom of *shape*.
> With a `productId` of `water.sparkling`:
>
> ```text
> buildings.b:3.pricesCents.water.sparkling
>                           └─ one segment, or two? The path resolves to a price, or to
>                              nothing, depending entirely on who parsed it.
> ```
>
> So **no path-addressable identifier may contain a `.`** — and that is all of them:
> authored content ids (building and product definitions, staff roles, objectives, zones),
> the keys of nested records like `pricesCents`, which *are* product ids, and entity ids.
> Entity ids satisfy it by construction, since §9 formats them `<prefix>:<ordinal>` and `:`
> is not a separator here; the rest are checked at Tier 1 (§15). With the rule, the same
> path is unambiguous:
>
> ```text
> buildings.b:3.pricesCents.sparkling-water   →  buildings[id=b:3].pricesCents["sparkling-water"]
> ```
>
> The alternative — a canonical escaping grammar for segments — buys nothing here: nothing
> needs a dot inside an id, and every producer and consumer would have to implement the
> unescaping identically or reintroduce the divergence this rule exists to remove.
>
> **`.exists` is the one synthetic leaf, and the only one.** Appearing and disappearing are
> not fields of any type in §3.2 — an entity that was removed has no field left to carry the
> news. So `<collection>.<entityId>.exists` is defined as a boolean assertion about
> *membership*: the traversal resolves the entity, and `.exists` reports whether the
> collection holds it. Everything else in a path is a real field, and no second synthetic
> leaf may be added without amending this paragraph — an open set of invented leaves would
> put the grammar right back where it started.
>
> **This is normative, and it is checkable.** 04 §12 types `path` as an unconstrained
> `string`, so nothing structural stops a producer inventing one; the rule above is what
> makes divergence a defect rather than a matter of taste. A path is valid iff it resolves
> against §3.2 — walk it segment by segment, taking `<entityId>` as a lookup by id, and it
> must land on a scalar. A path that does not resolve is a producer defect, not a consumer's
> to accommodate, and the check is cheap enough to assert in this kind's own tests. Adding a
> top-level scalar to `WorldGraphKindState` therefore extends the valid set automatically,
> which is the point of deriving it rather than listing it — a hand-maintained list of
> singleton paths would be one more thing to drift from the fields it describes.
>
> **Two fields are reachable by that rule and still never audited.** `nextEntityOrdinal` is
> an id source, not player-facing state — auditing it would emit a row on every creation
> saying a counter moved. `map.*` changes only when authored topology does (§3.2), which is
> not something an action does. Stated because "derivable from the state type" would
> otherwise imply they should appear.

`reason` is a descriptive code naming *why* the change happened, not a rejection code —
`simulation`'s `action_eat` and `story-graph`'s `achievement_unlocked` set that precedent,
and like those, these are `StateChange` vocabulary rather than additions to §11's
`Kind.reasonCodes`, which are what a *rejected* action returns.

`visible: true` for everything a player did deliberately and can see the result of; the
`.exists` records are `visible: false`, since the projection already carries the roster.

---

## 14. Content, Definitions, and Packs

Everything in this section is **campaign data**, loaded through the core content registry
(04 §10.1). It is the complete data language W45 implements; a campaign needs no
game-specific TypeScript and no extension object.

### 14.1 Source and runtime campaign roots

The source/runtime split is the one 04 §10.1 already owns. `AuthoredDefinitionText` carries
inline English at the authoring boundary; `RuntimeDefinitionText` carries only `LocKey`s.
Every `*DefinitionSource` below is the corresponding generic definition specialized with
the former, and every runtime `*Definition` specializes it with the latter.

```typescript
interface AuthoredDefinitionText {
  name: AuthoredText;
  description: AuthoredText;
}

interface RuntimeDefinitionText {
  nameKey: LocKey;
  descriptionKey: LocKey;
}

interface WorldGraphCampaignSource {
  startScenarioId: string;
  ticksPerDay: number;                         // positive integer; balance value
  maxTicksPerAction: number;                   // positive integer synchronous-work cap

  maps: readonly MapDefinitionSource[];        // MVP-required
  terrain: readonly TerrainDefinitionSource[]; // MVP-required
  scenery?: readonly SceneryDefinitionSource[]; // default [] — MVP-inert
  needs: readonly NeedDefinitionSource[];      // MVP-required
  guestConditions?: readonly GuestConditionDefinitionSource[]; // default [] — MVP-inert
  opinions: readonly OpinionDefinitionSource[]; // MVP-required (price in the MVP)
  preferences?: readonly PreferenceDefinitionSource[]; // default [] — MVP-inert
  products: readonly ProductDefinitionSource[]; // MVP-required
  buildings: readonly BuildingDefinitionSource[]; // MVP-required
  guestArchetypes: readonly GuestArchetypeDefinitionSource[]; // MVP-required
  staffRoles: readonly StaffRoleDefinitionSource[]; // MVP-required
  incidents: readonly IncidentDefinitionSource[]; // MVP-required (litter in the MVP)
  objectives: readonly ObjectiveDefinitionSource[]; // MVP-required
  failures: readonly FailureDefinitionSource[]; // MVP-required
  policies?: readonly PolicyDefinitionSource[]; // default [] — MVP-inert
  achievements?: readonly AchievementDefinitionSource[]; // default [] — MVP-inert
  scenarios: readonly ScenarioDefinitionSource[]; // MVP-required
}

interface WorldGraphCampaign {
  // Runtime form: every collection is present and contains LocKeys only.
  // Campaign.id/kindId/version/titleKey remain on the core Campaign envelope.
  startScenarioId: string;
  ticksPerDay: number;
  maxTicksPerAction: number;

  maps: readonly MapDefinition[];
  terrain: readonly TerrainDefinition[];
  scenery: readonly SceneryDefinition[];
  needs: readonly NeedDefinition[];
  guestConditions: readonly GuestConditionDefinition[];
  opinions: readonly OpinionDefinition[];
  preferences: readonly PreferenceDefinition[];
  products: readonly ProductDefinition[];
  buildings: readonly BuildingDefinition[];
  guestArchetypes: readonly GuestArchetypeDefinition[];
  staffRoles: readonly StaffRoleDefinition[];
  incidents: readonly IncidentDefinition[];
  objectives: readonly ObjectiveDefinition[];
  failures: readonly FailureDefinition[];
  policies: readonly PolicyDefinition[];
  achievements: readonly AchievementDefinition[];
  scenarios: readonly ScenarioDefinition[];
}
```

`WorldGraphCampaign` is the `content` inside the core `Campaign` envelope. Its lack of a
campaign id is deliberate; the ids on the nested definitions are equally deliberate. Each
is unique only within its own catalog and is what runtime state and other definitions use as
a foreign key.

### 14.2 Shared integer, reference, condition, and effect language

No type below addresses state with a free-form path. Numeric facts use the closed
`WorldMetric` union; booleans use the closed leaves of `WorldCondition`; writes use
`WorldEffect`. W44 owns evaluation order, aggregation, rounding, and competing-effect
precedence, not the vocabulary.

```typescript
interface IntegerRange {
  min: number;                                  // inclusive integer lower bound
  max: number;                                  // inclusive integer upper bound; max >= min
}

interface IntegerCurvePoint {
  input: number;
  output: number;
}

interface IntegerCurve {
  interpolation: "step" | "linear";
  points: readonly IntegerCurvePoint[];         // >= 1, strictly increasing input
}

type ComparisonOperator = "eq" | "ne" | "lt" | "lte" | "gt" | "gte";
type AggregateOperation = "min" | "max" | "average" | "sum";
type GuestMeterKind = "need" | "condition" | "opinion" | "preference";
type WorldCounterKey = keyof WorldCounters;
type FinanceMetricField =
  | "cashCents" | "revenueTodayCents" | "expensesTodayCents"
  | "revenueTotalCents" | "expensesTotalCents";

type ContentReference =
  | { kind: "map"; id: string }
  | { kind: "terrain"; id: string }
  | { kind: "scenery"; id: string }
  | { kind: "need"; id: string }
  | { kind: "guest_condition"; id: string }
  | { kind: "opinion"; id: string }
  | { kind: "preference"; id: string }
  | { kind: "product"; id: string }
  | { kind: "building"; id: string }
  | { kind: "guest_archetype"; id: string }
  | { kind: "staff_role"; id: string }
  | { kind: "incident"; id: string }
  | { kind: "objective"; id: string }
  | { kind: "failure"; id: string }
  | { kind: "policy"; id: string }
  | { kind: "scenario"; id: string };

type WorldMetric =
  | { kind: "tick" }
  | { kind: "day" }
  | { kind: "finance"; field: FinanceMetricField }
  | { kind: "counter"; counter: WorldCounterKey }
  | { kind: "objective_progress"; objectiveId: string }
  | {
      kind: "entity_count";
      entity: "building" | "guest" | "staff";
      definitionId: string | null;              // null = every definition in that catalog
    }
  | {
      kind: "guest_meter";
      meter: GuestMeterKind;
      definitionId: string;
      aggregate: AggregateOperation;
      archetypeId: string | null;                // null = every active guest
    }
  | {
      kind: "building_metric";
      metric: "cleanliness" | "wear" | "queue_length" | "inventory";
      aggregate: AggregateOperation;
      buildingDefinitionId: string | null;       // null = every placed building
      productId: string | null;                  // required only for inventory
    }
  | {
      kind: "incident_count";
      incidentDefinitionId: string | null;
      state: "active" | "resolved";
    };

type WorldCondition =
  | { kind: "constant"; value: boolean }
  | { kind: "all"; conditions: readonly WorldCondition[] }
  | { kind: "any"; conditions: readonly WorldCondition[] }
  | { kind: "not"; condition: WorldCondition }
  | { kind: "compare"; metric: WorldMetric; op: ComparisonOperator; value: number }
  | { kind: "objective_state"; objectiveId: string; state: ObjectiveProgressState }
  | { kind: "content_unlocked"; content: ContentReference }
  | { kind: "policy_active"; policyId: string }
  | { kind: "incident_active"; incidentDefinitionId: string };

type GuestSelector =
  | { kind: "all" }
  | { kind: "archetype"; archetypeId: string }
  | { kind: "current_service_guest" }
  | { kind: "current_incident_guest" }
  | { kind: "building_queue"; buildingDefinitionId: string };

type IncidentTarget =
  | { kind: "none" }
  | { kind: "current_guest" }
  | { kind: "current_building" }
  | { kind: "zone"; zoneId: string };

type WorldEffect =
  | { kind: "finance_delta"; field: "cashCents"; cents: number }
  | { kind: "counter_delta"; counter: WorldCounterKey; delta: number }
  | { kind: "unlock" | "lock"; content: ContentReference }
  | { kind: "objective_progress"; objectiveId: string; delta: number }
  | {
      kind: "guest_meter_delta";
      meter: GuestMeterKind;
      definitionId: string;
      delta: number;
      guests: GuestSelector;
    }
  | { kind: "start_incident"; incidentDefinitionId: string; target: IncidentTarget }
  | { kind: "resolve_incident"; incidentDefinitionId: string }
  | { kind: "set_policy_active"; policyId: string; active: boolean };
```

Every `number` in §14 is an integer. `*Cents` fields are cents, `*Ticks` fields are ticks,
`*Tiles` fields are grid tiles, meter values use their referenced definition range, curve
inputs/outputs use the field that owns the curve, and utility/weight/delta fields are signed
integer scoring units unless a narrower comment says otherwise.

All meters use the range on their referenced definition. `average` is an exact rational
during comparison—W44 states the cross-multiplication/rounding rule—so no floating-point
value enters state. Empty `all`/`any`, an aggregate selector that cannot match any reachable
definition, or a metric whose dependent id does not resolve is Tier 1 rather than an
implicit identity value. W44 defines the result when a valid selector temporarily has no
runtime entities—for example, cleanliness before the player builds anything.

### 14.3 Maps, terrain, scenery, placement, and adjacency

`WorldGraphCampaign.maps` is the sole authored-map catalog. A scenario stores `mapId`; it
does not embed a map. `initialState` expands the selected map's default terrain plus sparse
overrides into the complete `WorldMap.terrain`, materializes its topology, then applies the
scenario placements (§3.1).

```typescript
interface MapDefinitionBase<TText> {
  id: string;
  text: TText;
  width: number;                                  // positive integer tiles
  height: number;                                 // positive integer tiles
  defaultTerrainId: string;
  terrainOverrides: readonly TerrainOverride[];   // unique positions, row-major
  topology: MapTopology;
  zones: readonly ZoneDefinitionBase<TText>[];
  spawnPoints: readonly Position[];               // >= 1, row-major
  exits: readonly Position[];                     // >= 1, row-major
  tags: readonly string[];
}

interface TerrainOverride {
  position: Position;
  terrainId: string;
}

type MapTopology =
  | { kind: "orthogonal_grid" }
  | { kind: "explicit"; edges: readonly MapEdgeDefinition[] };

interface MapEdgeDefinition {
  from: Position;
  to: Position;
  edgeCost: number;                              // non-negative integer path-cost units
  allowed: boolean;
}

interface ZoneDefinitionBase<TText> {
  id: string;                                    // unique within this map
  text: TText;
  cells: readonly Position[];                    // non-empty, row-major
  serviceRadius: number;                         // non-negative integer tiles
  maxOccupancy: number | null;                   // null = unlimited; otherwise >= 0
}

interface TerrainDefinitionBase<TText> {
  id: string;
  text: TText;
  walkable: boolean;
  buildable: boolean;
  moveCost: number;                              // non-negative integer path-cost units
  tags: readonly string[];
}

interface FootprintDefinition {
  width: number;                                 // positive integer tiles, unrotated
  height: number;                                // positive integer tiles, unrotated
}

interface EntranceOffset {
  x: number;                                     // integer relative to unrotated origin
  y: number;                                     // immediately outside one footprint edge
}

type PlacementRule =
  | { kind: "terrain"; terrainIds: readonly string[] }
  | { kind: "adjacent_to_terrain"; terrainIds: readonly string[]; minimumEdges: number }
  | { kind: "zone"; zoneIds: readonly string[]; mode: "inside" | "outside" }
  | {
      kind: "distance_from_zone";
      zoneIds: readonly string[];
      minimumTiles: number;
      maximumTiles: number | null;               // null = no upper bound
    };

type AdjacencyTarget =
  | { kind: "building"; definitionIds: readonly string[] | null }
  | { kind: "guest"; archetypeIds: readonly string[] | null };

interface AdjacencyEffect {
  target: AdjacencyTarget;
  metric: "attractiveness" | "need_drift" | "incident_risk" | "service_demand" | "noise";
  radiusTiles: number;                            // positive integer Chebyshev radius
  delta: number;                                  // integer utility/basis-point input by metric
}

interface SceneryDefinitionBase<TText> {
  id: string;
  text: TText;
  footprint: FootprintDefinition;
  allowedRotations: readonly Rotation[];
  placementRules: readonly PlacementRule[];
  adjacencyEffects: readonly AdjacencyEffect[];
  tags: readonly string[];
}
```

Bounds and non-overlap are universal placement rules and are not repeated as authorable
switches. A `BuildingDefinition` additionally requires at least one entrance. Each entrance
is the walkable approach cell immediately outside the unrotated footprint (§3.3); the exact
integer rotation transform there is reused unchanged.

### 14.4 Products, buildings, queues, service, and litter

The `operation.kind` union is engine mechanical: systems branch on it. `tags` are content
classification only and may never select a resolver.

```typescript
interface PriceBand {
  minimumCents: number;                           // non-negative integer cents
  maximumCents: number;                           // >= minimumCents
  defaultCents: number;                           // inclusive within the band
}

interface ProductDefinitionBase<TText> {
  id: string;
  text: TText;
  unitCostCents: number;                           // non-negative integer cents
  price: PriceBand;
  effects: readonly WorldEffect[];
  litter: {
    incidentDefinitionId: string;
    unitsPerService: number;                       // non-negative integer litter units
  } | null;
  tags: readonly string[];
}

interface ServiceProduct {
  productId: string;
  serviceTicks: number | null;                     // null = operation base; otherwise positive
  initialUnits: number | null;                     // null = unlimited
  capacity: number | null;                         // null = unlimited; otherwise >= initialUnits
}

interface StaffRequirement {
  roleId: string;
  count: number;                                   // positive integer
}

type BuildingOperation =
  | {
      kind: "service";
      products: readonly ServiceProduct[];         // empty permits non-product service (toilet)
      queueMaxLength: number | null;                // null = unlimited
      baseServiceTicks: number;                     // positive integer; product may override
      staffRequirements: readonly StaffRequirement[];
      effects: readonly WorldEffect[];              // applied on every completed service
    }
  | {
      kind: "waste";
      capacity: number | null;                      // null = unlimited
      acceptedIncidentIds: readonly string[];
    }
  | { kind: "decorative" }
  | { kind: "support"; generatedTaskKinds: readonly StaffTaskType[] };

interface BuildingDefinitionBase<TText> {
  id: string;
  text: TText;
  footprint: FootprintDefinition;
  entrances: readonly EntranceOffset[];             // >= 1
  allowedRotations: readonly Rotation[];             // non-empty, unique
  constructionCostCents: number;                     // non-negative integer cents
  constructionTicks: number;                         // 0 = immediate MVP construction
  operatingCostCentsPerDay: number;                  // non-negative integer cents
  initialWear: number;                               // integer 0..100
  initialCleanliness: number;                        // integer 0..100
  placementRules: readonly PlacementRule[];
  adjacencyEffects: readonly AdjacencyEffect[];
  operation: BuildingOperation;
  tags: readonly string[];
}
```

One placed building owns one stable shared queue; a guest's `targetProductId` says what that
guest will buy. That is why W43 removes W42's single `Queue.productId`: it contradicted a
building definition with several products. `Building.products`, `pricesCents`, and
`inventory` are materialized from `operation.products`; the three key sets must be equal.

### 14.5 Guest vocabularies, archetypes, and staff roles

Needs, conditions, opinions, and preferences are definitions because campaigns declare the
keys; their ranges are contract data because validation and clamping need them. A guest
archetype must supply exactly one initial profile entry for every key it uses.

```typescript
interface MeterDefinitionBase<TText> {
  id: string;
  text: TText;
  minimum: number;
  maximum: number;                                // integer, >= minimum
}

interface NeedDefinitionBase<TText> extends MeterDefinitionBase<TText> {
  criticalBelow: number;                          // inclusive within range
  satisfiedAtOrAbove: number;                     // inclusive and >= criticalBelow
}

type GuestConditionDefinitionBase<TText> = MeterDefinitionBase<TText>;

interface OpinionDefinitionBase<TText> extends MeterDefinitionBase<TText> {
  neutral: number;                                // inclusive within range
}

type PreferenceDefinitionBase<TText> = MeterDefinitionBase<TText>;

interface NeedProfile {
  needId: string;
  initial: IntegerRange;
  driftByCurrentValue: IntegerCurve;              // current value → integer delta per tick
}

interface MeterProfile {
  definitionId: string;
  initial: IntegerRange;
}

interface GuestArchetypeDefinitionBase<TText> {
  id: string;
  text: TText;
  cashCents: IntegerRange;                         // non-negative integer cents
  stayTicks: IntegerRange;                         // positive integer ticks
  patienceTicks: IntegerRange;                     // non-negative integer ticks
  initialSatisfaction: IntegerRange;               // integers 0..100
  needs: readonly NeedProfile[];                   // MVP-required: thirst + toilet
  conditions: readonly MeterProfile[];
  opinions: readonly MeterProfile[];               // MVP-required: price
  preferences: readonly MeterProfile[];
  priceResistance: IntegerCurve;                   // price delta cents → utility delta
  travelUtilityPerCost: number;                    // integer utility units per path-cost unit
  queueUtilityPerTick: number;                     // integer utility units per wait tick
  attractivenessUtilityPerPoint: number;           // integer utility units per point
  tags: readonly string[];
}

interface StaffWorkRate {
  taskType: StaffTaskType;
  effortPerTick: number;                           // positive integer effort units
}

interface StaffRoleDefinitionBase<TText> {
  id: string;
  text: TText;
  hireCostCents: number;                            // non-negative integer cents
  wageCentsPerDay: number;                          // non-negative integer cents
  moveTicksPerTile: number;                         // positive integer ticks
  supportedTaskKinds: readonly StaffTaskType[];
  workRates: readonly StaffWorkRate[];              // exactly one per supported task
  tags: readonly string[];
}
```

Inclusive `IntegerRange` draws during setup use the tick-0 stream (§3.1). W44 defines the
integer curve evaluator and utility composition; W43 merely makes every input typed and
scaled. `StaffTaskType` remains a closed engine union because dispatch selects a resolver by
it; campaigns extend roles and rates by id, not the resolver vocabulary.

### 14.6 Scenarios, objectives, failures, incidents, policies, and achievements

Scenario placement arrays are the one catalog-adjacent collection whose authored order is
semantic: it allocates deterministic entity ids (§3.1). They therefore remain in authored
order rather than sorting by definition id.

```typescript
interface BuildingPlacement {
  definitionId: string;
  x: number;
  y: number;
  rotation: Rotation;
  open: boolean;
}

interface SceneryPlacement {
  definitionId: string;
  x: number;
  y: number;
  rotation: Rotation;
}

interface ScenarioGuestPoolEntry {
  archetypeId: string;
  weight: number;                                // positive integer relative weight
}

interface ScenarioGuestSpawning {
  everyTicks: number;                             // positive integer ticks
  maxActiveGuests: number;                        // positive integer
  pool: readonly ScenarioGuestPoolEntry[];        // non-empty, unique archetype ids
}

interface DefinitionLimit {
  definitionId: string;
  maximum: number;                                // non-negative integer
}

interface ScenarioDefinitionBase<TText> {
  id: string;
  text: TText;
  mapId: string;
  startingCashCents: number;                       // integer cents
  unlockedContent: readonly ContentReference[];
  activePolicyIds: readonly string[];              // MVP-inert
  buildingPlacements: readonly BuildingPlacement[];
  sceneryPlacements: readonly SceneryPlacement[];  // MVP-inert
  guestSpawning: ScenarioGuestSpawning;
  objectiveIds: readonly string[];
  failureIds: readonly string[];
  timeLimitTicks: number | null;                   // null = no deadline
  timeLimitFailureId: string | null;               // paired with timeLimitTicks; targets failureIds
  buildingLimits: readonly DefinitionLimit[];
  staffLimits: readonly DefinitionLimit[];
  tags: readonly string[];
}

interface ObjectiveDefinitionBase<TText> {
  id: string;
  text: TText;
  completion: WorldCondition;
  progressMetric: WorldMetric;
  target: number;
  requiredDurationTicks: number;                   // positive integer; 1 = immediate
  onCompleted: readonly WorldEffect[];
  tags: readonly string[];
}

interface FailureDefinitionBase<TText> {
  id: string;
  text: TText;
  condition: WorldCondition;
  requiredDurationTicks: number;                   // positive integer; 1 = immediate
  onTriggered: readonly WorldEffect[];
  tags: readonly string[];
}

type IncidentKind =
  | "litter" | "spill" | "breakdown" | "fire" | "security" | "weather" | "scripted";

interface IncidentDefinitionBase<TText> {
  id: string;
  text: TText;
  kind: IncidentKind;                              // engine-mechanical resolver family
  severity: IncidentSeverity;
  triggerCondition: WorldCondition | null;         // null = started only by an effect
  selectionWeight: number;                         // non-negative integer; 0 disables rolling
  cooldownTicks: number;                           // non-negative integer
  durationTicks: IntegerRange | null;               // null = no automatic expiry
  resolutionCondition: WorldCondition | null;
  resolverTaskType: StaffTaskType | null;
  onStart: readonly WorldEffect[];
  onResolve: readonly WorldEffect[];
  tags: readonly string[];
}

interface PolicyDefinitionBase<TText> {
  id: string;
  text: TText;
  availableWhen: WorldCondition;
  activationCostCents: number;                      // non-negative integer cents
  deactivationCostCents: number;                    // non-negative integer cents
  whileActive: readonly WorldEffect[];
  tags: readonly string[];
}

interface AchievementDefinitionBase<TText> {
  id: string;
  text: TText;
  condition: WorldCondition;
  hidden: boolean;
  scope: "profile";                                // v1; mirrored after a successful action
  tags: readonly string[];
}
```

Achievement unlocks land in `unlockedAchievementIds` first and are mirrored to the core
`ProfileStore` after the successful action, exactly as story-graph does (03 §7). Resolution
never reads the profile. Policies are fully typed but MVP-inert; a scenario may start one
active, while player policy actions remain a future unit. The named runtime consumers are:
scenery adjacency in guest-intent/incident inputs, active-policy effects in scheduled
scenario changes, and achievement conditions after objective/failure updates. W44 fixes
their exact position and precedence; empty MVP catalogs make those paths honest no-ops.

### 14.7 Source/runtime aliases

The aliases below are normative, not illustrative shorthand: they guarantee every nested
definition has one source shape and one runtime shape without duplicating the mechanical
fields between two declarations.

```typescript
type MapDefinitionSource = MapDefinitionBase<AuthoredDefinitionText>;
type MapDefinition = MapDefinitionBase<RuntimeDefinitionText>;
type TerrainDefinitionSource = TerrainDefinitionBase<AuthoredDefinitionText>;
type TerrainDefinition = TerrainDefinitionBase<RuntimeDefinitionText>;
type SceneryDefinitionSource = SceneryDefinitionBase<AuthoredDefinitionText>;
type SceneryDefinition = SceneryDefinitionBase<RuntimeDefinitionText>;
type NeedDefinitionSource = NeedDefinitionBase<AuthoredDefinitionText>;
type NeedDefinition = NeedDefinitionBase<RuntimeDefinitionText>;
type GuestConditionDefinitionSource = GuestConditionDefinitionBase<AuthoredDefinitionText>;
type GuestConditionDefinition = GuestConditionDefinitionBase<RuntimeDefinitionText>;
type OpinionDefinitionSource = OpinionDefinitionBase<AuthoredDefinitionText>;
type OpinionDefinition = OpinionDefinitionBase<RuntimeDefinitionText>;
type PreferenceDefinitionSource = PreferenceDefinitionBase<AuthoredDefinitionText>;
type PreferenceDefinition = PreferenceDefinitionBase<RuntimeDefinitionText>;
type ProductDefinitionSource = ProductDefinitionBase<AuthoredDefinitionText>;
type ProductDefinition = ProductDefinitionBase<RuntimeDefinitionText>;
type BuildingDefinitionSource = BuildingDefinitionBase<AuthoredDefinitionText>;
type BuildingDefinition = BuildingDefinitionBase<RuntimeDefinitionText>;
type GuestArchetypeDefinitionSource = GuestArchetypeDefinitionBase<AuthoredDefinitionText>;
type GuestArchetypeDefinition = GuestArchetypeDefinitionBase<RuntimeDefinitionText>;
type StaffRoleDefinitionSource = StaffRoleDefinitionBase<AuthoredDefinitionText>;
type StaffRoleDefinition = StaffRoleDefinitionBase<RuntimeDefinitionText>;
type ScenarioDefinitionSource = ScenarioDefinitionBase<AuthoredDefinitionText>;
type ScenarioDefinition = ScenarioDefinitionBase<RuntimeDefinitionText>;
type ObjectiveDefinitionSource = ObjectiveDefinitionBase<AuthoredDefinitionText>;
type ObjectiveDefinition = ObjectiveDefinitionBase<RuntimeDefinitionText>;
type FailureDefinitionSource = FailureDefinitionBase<AuthoredDefinitionText>;
type FailureDefinition = FailureDefinitionBase<RuntimeDefinitionText>;
type IncidentDefinitionSource = IncidentDefinitionBase<AuthoredDefinitionText>;
type IncidentDefinition = IncidentDefinitionBase<RuntimeDefinitionText>;
type PolicyDefinitionSource = PolicyDefinitionBase<AuthoredDefinitionText>;
type PolicyDefinition = PolicyDefinitionBase<RuntimeDefinitionText>;
type AchievementDefinitionSource = AchievementDefinitionBase<AuthoredDefinitionText>;
type AchievementDefinition = AchievementDefinitionBase<RuntimeDefinitionText>;
```

### 14.8 Build defaults and canonical order

The pure builder lifts every `AuthoredText`, rejects conflicting key/text pairs, and returns
`BuiltCampaign`. It applies exactly five defaults: omitted `scenery`, `guestConditions`,
`preferences`, `policies`, and `achievements` become explicit empty runtime arrays. There
are no other omitted-field conventions; absence elsewhere is represented by `null`.

Catalogs are sorted lexicographically by definition id. Duplicate nested definition-id
lists, tags, rotation lists, and scenario unlocks are rejected, then the accepted values are
sorted; map positions and terrain overrides are row-major `(y, x)`; explicit edges sort by
`(from.y, from.x, to.y, to.x)`; curve points sort by `input`. Effects, `all`/`any` children,
and scenario placements preserve authored order: effects will gain order/precedence
semantics in W44, condition evaluation is side-effect-free, and placements allocate ids.
Runtime content remains arrays and plain objects—ephemeral indexes may be built by W45 but
are neither campaign data nor saved state.

### 14.9 W42 reconciliation

These are the only §3 changes W43 makes:

| W42 surface | W43 correction | Why content requires it |
|---|---|---|
| `TerrainCell.terrain/edge/moveCost` | `terrainId`; traits and base cost move to `TerrainDefinition` | Terrain is campaign vocabulary; three copied traits could drift from their definition |
| fixed guest need/opinion/preference shapes | four content-declared records; add guest cash and satisfaction | The MVP requires thirst, toilet, price opinion, and a spendable budget without recompiling the kind |
| `Incident.incidentType` plus copied text | `definitionId`; localized text and resolver kind live on `IncidentDefinition` | Runtime stores occurrence state, not a second definition |
| no scenery runtime consumer | `WorldMap.scenery` with derived ids | Adjacency-affecting scenario placements must reach tick systems and projection |
| no litter-cleanup task target | `StaffTask.incidentId` | The MVP cleaner must resolve the litter incident that generated its task |
| no inventory state; single-product queue | content-closed `Building.inventory`; one shared queue, product selected by the guest | Product definitions admit multiple products while the MVP may use unlimited stock |
| no progression/achievement/policy state | `unlockedContent`, `activePolicyIds`, `unlockedAchievementIds` | Effects and starting policy data need deterministic persisted consumers |
| departed guests are pruned with no cumulative facts | closed `WorldCounters` | Objective/failure conditions must retain published aggregates without retaining every guest |
| objectives lack duration state; failures have none | objective `satisfiedSinceTick` plus `FailureProgress[]` | Sustained objective/failure conditions must survive save/load and split tick batches |

Everything else in §3 remains W42's state contract.

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

Validation paths address source/runtime fields exactly as written in §14: catalog array
index, then nested field (for example `buildings[0].entrances[1].x`). A validator may add
details, but it may not replace a precise path with an unstructured message.

**Tier 1 — load-time hard failure:**

- The root narrows to `WorldGraphCampaign`; `ticksPerDay` and `maxTicksPerAction` are positive
  integers; `startScenarioId` resolves.
- Every authored id the kind reads is non-empty and contains no `.`. Definition ids are
  unique within their catalog; map-local zone ids are unique within their map. Tags and
  referenced-id lists contain no duplicates.
- Every `RuntimeDefinitionText` key resolves in the registry string table. At the source
  boundary, duplicate `AuthoredText.key` values must carry byte-identical text; a conflict
  is a hard builder error before kind validation.
- Every foreign key resolves in its declared namespace: maps → terrain; scenarios → map,
  placements, unlocks, policies, objectives, failures, and guest pool; buildings → terrain,
  products, roles, incidents, zones, and adjacency targets; archetypes → meter catalogs;
  conditions/effects/metrics → their typed target catalogs.
- Every number is an integer and within its documented range. Ranges are ordered; curve
  inputs are unique and strictly increasing; price defaults lie inside their bands; stock
  capacity contains finite initial stock; costs/capacities/weights are non-negative or
  positive exactly where §14 says.
- Map dimensions are positive; every coordinate is in bounds; terrain overrides are unique;
  every spawn and exit is walkable; zone cells are non-empty and unique; explicit edges have
  in-bounds endpoints and no duplicate directed `(from, to)` pair.
- Footprints are positive; rotations are unique and supported; every building has an
  entrance exactly one orthogonal cell outside one unrotated edge; placement rules have
  non-empty target ids and valid distance bounds.
- Scenario placements reference real definitions, fit the selected map after rotation,
  satisfy terrain/zone rules, do not overlap, and leave each building with at least one
  walkable approach cell. Building placements are checked by the same pure geometry used by
  `build`, never a scenario-only approximation.
- Building service product ids are unique; their materialized product/price/inventory key
  sets agree. A non-product service may have an empty product list; any other empty list or
  unresolved staff requirement is invalid.
- An archetype declares unique meter entries, every initial range fits its meter definition,
  and runtime guest records have exactly those keys. A staff role has one positive work rate
  for every supported task and no extra rate.
- `WorldCondition`/`WorldEffect` discriminators and payloads match. `all`/`any` are non-empty;
  expression depth is at most 32; finance metrics select numeric fields; inventory metrics
  name a product; aggregate and selector references resolve. No arbitrary state path exists
  to validate or execute.
- Objectives/failures have positive duration; objective progress metrics can be compared to
  their targets; incident ranges, cooldowns, weights, target modes, task kinds, and policy
  costs satisfy their declared domains.
- A scenario's time limit is null or positive and `timeLimitFailureId` is null iff the limit
  is null; otherwise it resolves within that scenario's `failureIds`. Its guest pool is
  non-empty with unique archetypes and positive weights, and definition limits are unique
  and non-negative.

**Tier 2 — load-time warning:**

- A scenario already resolves at tick 0, or declares no objectives (a legal sandbox).
- A map region is disconnected from every spawn/exit, or a placed building has no reachable
  spawn even though a geometric approach cell exists.
- A definition is unreachable from every scenario through starting content, unlock effects,
  incident effects, objective/failure effects, or another reachable definition.
- A building service has no guest need/opinion demand; a staff role has no task source; an
  incident has neither expiry, resolution condition, nor supported resolver task.
- An achievement or policy condition references a counter/meter no reachable effect or
  system can change.

> **The draft's "Tier 3 simulation findings" is not validation.** Dominant buildings,
> infinite-money loops, queue deadlock and unavoidable bankruptcy are **content-balance**
> findings from a simulation harness, not load-time checks over a campaign. Calling them a
> validation tier would put a long-running search inside registry construction, which 04
> §10.1 requires to be pure and total. They belong to the balance harness, which is a game
> concern (§17).

### 15.1 Smallest valid Sun Trap-shaped source

This fixture is deliberately tiny and its numbers are illustrative, not recommended
balance. It proves the schema can author the flagship slice without `unknown`: one map,
thirst/toilet, price opinion, drink/toilet/waste buildings, a drink, a cleaner, litter, one
objective, and cash/cleanliness/deadline failure paths. The five omitted post-MVP catalogs
exercise the builder defaults in §14.8.

```typescript
const minimalMvpSource: WorldGraphCampaignSource = {
  startScenarioId: "beach-mvp",
  ticksPerDay: 360,
  maxTicksPerAction: 360,
  maps: [{
    id: "small-beach",
    text: {
      name: { key: "world.map.small-beach.name", text: "Small beach" },
      description: { key: "world.map.small-beach.description", text: "One quiet strip of sand." },
    },
    width: 8,
    height: 5,
    defaultTerrainId: "sand",
    terrainOverrides: [],
    topology: { kind: "orthogonal_grid" },
    zones: [],
    spawnPoints: [{ x: 0, y: 2 }],
    exits: [{ x: 7, y: 2 }],
    tags: ["mvp"],
  }],
  terrain: [{
    id: "sand",
    text: {
      name: { key: "world.terrain.sand.name", text: "Sand" },
      description: { key: "world.terrain.sand.description", text: "Walkable, buildable beach." },
    },
    walkable: true,
    buildable: true,
    moveCost: 10,
    tags: ["beach"],
  }],
  needs: [
    {
      id: "thirst",
      text: {
        name: { key: "world.need.thirst.name", text: "Thirst" },
        description: { key: "world.need.thirst.description", text: "Need for a drink." },
      },
      minimum: 0,
      maximum: 100,
      criticalBelow: 20,
      satisfiedAtOrAbove: 70,
    },
    {
      id: "toilet",
      text: {
        name: { key: "world.need.toilet.name", text: "Toilet" },
        description: { key: "world.need.toilet.description", text: "Need for facilities." },
      },
      minimum: 0,
      maximum: 100,
      criticalBelow: 20,
      satisfiedAtOrAbove: 70,
    },
  ],
  opinions: [{
    id: "price",
    text: {
      name: { key: "world.opinion.price.name", text: "Price" },
      description: { key: "world.opinion.price.description", text: "Perceived value for money." },
    },
    minimum: -100,
    maximum: 100,
    neutral: 0,
  }],
  products: [{
    id: "soft-drink",
    text: {
      name: { key: "world.product.soft-drink.name", text: "Soft drink" },
      description: { key: "world.product.soft-drink.description", text: "Cold and technically refreshing." },
    },
    unitCostCents: 100,
    price: { minimumCents: 100, maximumCents: 1000, defaultCents: 500 },
    effects: [{
      kind: "guest_meter_delta",
      meter: "need",
      definitionId: "thirst",
      delta: 25,
      guests: { kind: "current_service_guest" },
    }],
    litter: { incidentDefinitionId: "litter", unitsPerService: 1 },
    tags: ["drink"],
  }],
  buildings: [
    {
      id: "drink-stand",
      text: {
        name: { key: "world.building.drink-stand.name", text: "Drink stand" },
        description: { key: "world.building.drink-stand.description", text: "Sells one dependable drink." },
      },
      footprint: { width: 1, height: 1 },
      entrances: [{ x: -1, y: 0 }],
      allowedRotations: [0],
      constructionCostCents: 5000,
      constructionTicks: 0,
      operatingCostCentsPerDay: 100,
      initialWear: 100,
      initialCleanliness: 100,
      placementRules: [{ kind: "terrain", terrainIds: ["sand"] }],
      adjacencyEffects: [],
      operation: {
        kind: "service",
        products: [{ productId: "soft-drink", serviceTicks: 2, initialUnits: null, capacity: null }],
        queueMaxLength: 8,
        baseServiceTicks: 2,
        staffRequirements: [],
        effects: [],
      },
      tags: ["drink"],
    },
    {
      id: "toilet-block",
      text: {
        name: { key: "world.building.toilet-block.name", text: "Toilet block" },
        description: { key: "world.building.toilet-block.description", text: "A triumph of municipal plumbing." },
      },
      footprint: { width: 1, height: 1 },
      entrances: [{ x: -1, y: 0 }],
      allowedRotations: [0],
      constructionCostCents: 4000,
      constructionTicks: 0,
      operatingCostCentsPerDay: 50,
      initialWear: 100,
      initialCleanliness: 100,
      placementRules: [{ kind: "terrain", terrainIds: ["sand"] }],
      adjacencyEffects: [],
      operation: {
        kind: "service",
        products: [],
        queueMaxLength: 8,
        baseServiceTicks: 2,
        staffRequirements: [],
        effects: [{
          kind: "guest_meter_delta",
          meter: "need",
          definitionId: "toilet",
          delta: 25,
          guests: { kind: "current_service_guest" },
        }],
      },
      tags: ["toilet"],
    },
    {
      id: "waste-point",
      text: {
        name: { key: "world.building.waste-point.name", text: "Waste point" },
        description: { key: "world.building.waste-point.description", text: "Somewhere for the evidence." },
      },
      footprint: { width: 1, height: 1 },
      entrances: [{ x: -1, y: 0 }],
      allowedRotations: [0],
      constructionCostCents: 1000,
      constructionTicks: 0,
      operatingCostCentsPerDay: 0,
      initialWear: 100,
      initialCleanliness: 100,
      placementRules: [{ kind: "terrain", terrainIds: ["sand"] }],
      adjacencyEffects: [],
      operation: { kind: "waste", capacity: null, acceptedIncidentIds: ["litter"] },
      tags: ["waste"],
    },
  ],
  guestArchetypes: [{
    id: "day-guest",
    text: {
      name: { key: "world.guest.day-guest.name", text: "Day guest" },
      description: { key: "world.guest.day-guest.description", text: "Arrives optimistic and solvent." },
    },
    cashCents: { min: 1000, max: 2000 },
    stayTicks: { min: 120, max: 240 },
    patienceTicks: { min: 20, max: 40 },
    initialSatisfaction: { min: 50, max: 50 },
    needs: [
      {
        needId: "thirst",
        initial: { min: 40, max: 70 },
        driftByCurrentValue: {
          interpolation: "step",
          points: [{ input: 0, output: -1 }, { input: 100, output: -1 }],
        },
      },
      {
        needId: "toilet",
        initial: { min: 40, max: 70 },
        driftByCurrentValue: {
          interpolation: "step",
          points: [{ input: 0, output: -1 }, { input: 100, output: -1 }],
        },
      },
    ],
    conditions: [],
    opinions: [{ definitionId: "price", initial: { min: 0, max: 0 } }],
    preferences: [],
    priceResistance: {
      interpolation: "linear",
      points: [{ input: 0, output: 0 }, { input: 1000, output: -100 }],
    },
    travelUtilityPerCost: -1,
    queueUtilityPerTick: -2,
    attractivenessUtilityPerPoint: 1,
    tags: ["mvp"],
  }],
  staffRoles: [{
    id: "cleaner",
    text: {
      name: { key: "world.staff.cleaner.name", text: "Cleaner" },
      description: { key: "world.staff.cleaner.description", text: "Restores order one incident at a time." },
    },
    hireCostCents: 1000,
    wageCentsPerDay: 500,
    moveTicksPerTile: 1,
    supportedTaskKinds: ["clean"],
    workRates: [{ taskType: "clean", effortPerTick: 1 }],
    tags: ["mvp"],
  }],
  incidents: [{
    id: "litter",
    text: {
      name: { key: "world.incident.litter.name", text: "Litter" },
      description: { key: "world.incident.litter.description", text: "A cup has completed the easy part of its journey." },
    },
    kind: "litter",
    severity: "minor",
    triggerCondition: null,
    selectionWeight: 0,
    cooldownTicks: 0,
    durationTicks: null,
    resolutionCondition: null,
    resolverTaskType: "clean",
    onStart: [{ kind: "counter_delta", counter: "litterCreated", delta: 1 }],
    onResolve: [{ kind: "counter_delta", counter: "litterCleaned", delta: 1 }],
    tags: ["mvp"],
  }],
  objectives: [{
    id: "revenue-and-clean",
    text: {
      name: { key: "world.objective.revenue-and-clean.name", text: "Profitable cleanliness" },
      description: { key: "world.objective.revenue-and-clean.description", text: "Earn revenue without losing the beach." },
    },
    completion: {
      kind: "all",
      conditions: [
        { kind: "compare", metric: { kind: "finance", field: "revenueTotalCents" }, op: "gte", value: 100000 },
        {
          kind: "compare",
          metric: {
            kind: "building_metric",
            metric: "cleanliness",
            aggregate: "average",
            buildingDefinitionId: null,
            productId: null,
          },
          op: "gte",
          value: 50,
        },
      ],
    },
    progressMetric: { kind: "finance", field: "revenueTotalCents" },
    target: 100000,
    requiredDurationTicks: 1,
    onCompleted: [],
    tags: ["mvp"],
  }],
  failures: [
    {
      id: "bankrupt",
      text: {
        name: { key: "world.failure.bankrupt.name", text: "Bankrupt" },
        description: { key: "world.failure.bankrupt.description", text: "Cash fell below the emergency threshold." },
      },
      condition: { kind: "compare", metric: { kind: "finance", field: "cashCents" }, op: "lt", value: 0 },
      requiredDurationTicks: 1,
      onTriggered: [],
      tags: ["mvp"],
    },
    {
      id: "filthy-beach",
      text: {
        name: { key: "world.failure.filthy-beach.name", text: "Beach closed" },
        description: { key: "world.failure.filthy-beach.description", text: "Cleanliness remained at zero." },
      },
      condition: {
        kind: "compare",
        metric: {
          kind: "building_metric",
          metric: "cleanliness",
          aggregate: "average",
          buildingDefinitionId: null,
          productId: null,
        },
        op: "lte",
        value: 0,
      },
      requiredDurationTicks: 20,
      onTriggered: [],
      tags: ["mvp"],
    },
    {
      id: "deadline-missed",
      text: {
        name: { key: "world.failure.deadline-missed.name", text: "Deadline missed" },
        description: { key: "world.failure.deadline-missed.description", text: "Day 2 ended before the objective was met." },
      },
      condition: { kind: "compare", metric: { kind: "tick" }, op: "gte", value: 720 },
      requiredDurationTicks: 1,
      onTriggered: [],
      tags: ["mvp"],
    },
  ],
  scenarios: [{
    id: "beach-mvp",
    text: {
      name: { key: "world.scenario.beach-mvp.name", text: "Opening day" },
      description: { key: "world.scenario.beach-mvp.description", text: "Build small, serve quickly, clean afterward." },
    },
    mapId: "small-beach",
    startingCashCents: 20000,
    unlockedContent: [
      { kind: "product", id: "soft-drink" },
      { kind: "building", id: "drink-stand" },
      { kind: "building", id: "toilet-block" },
      { kind: "building", id: "waste-point" },
      { kind: "staff_role", id: "cleaner" },
    ],
    activePolicyIds: [],
    buildingPlacements: [],
    sceneryPlacements: [],
    guestSpawning: {
      everyTicks: 10,
      maxActiveGuests: 20,
      pool: [{ archetypeId: "day-guest", weight: 1 }],
    },
    objectiveIds: ["revenue-and-clean"],
    failureIds: ["bankrupt", "deadline-missed", "filthy-beach"],
    timeLimitTicks: 720,
    timeLimitFailureId: "deadline-missed",
    buildingLimits: [],
    staffLimits: [{ definitionId: "cleaner", maximum: 4 }],
    tags: ["mvp"],
  }],
};
```

### 15.2 Representative invalid source

Apply these replacements together to `minimalMvpSource`; the result remains JSON-shaped but
must fail before registry freeze. The exact paths make the fixture useful as a validator
test rather than merely an example of bad prose.

```typescript
const representativeInvalidReplacements = [
  { path: "maps[0].id", value: "small.beach" },
  { path: "scenarios[0].mapId", value: "missing-map" },
  { path: "buildings[0].entrances[0]", value: { x: 0, y: 0 } },
  { path: "products[0].price.maximumCents", value: 50 },
  { path: "guestArchetypes[0].cashCents", value: { min: 2000, max: 1000 } },
  { path: "buildings[0].text.name.key", value: "world.product.soft-drink.name" },
] as const;
```

Expected Tier-1 paths and findings:

| Path | Finding |
|---|---|
| `maps[0].id` | authored id contains `.`, which makes §13 paths ambiguous |
| `scenarios[0].mapId` | unresolved `MapDefinition` reference |
| `buildings[0].entrances[0]` | entrance is inside the 1×1 footprint, not an approach cell |
| `products[0].price.maximumCents` | maximum is below minimum/default |
| `guestArchetypes[0].cashCents` | inclusive integer range is reversed |
| `buildings[0].text.name.key` | same `AuthoredText.key` as the product name, different text |

---

## 16. Replay

A `ReplayFixture` (07 §2) records `submissions` including every `advance_ticks` with its
`ticks` parameter, so replay reproduces the exact batching and is exact.

Batch invariance (§5) is the **stronger** property, and it is what makes captured sessions
portable: a fixture recorded from a client running at 4× compares equal to the same play at
1×, because the comparison is over `Outcome`, not bytes.

---

## 17. What Remains in the Game Repository

This is the kind contract, not the game. **Sun Trap** — its vision, concrete content,
client specification, MVP, roadmap and balance harness — lives in
[SubZeroDev.SunTrap](https://github.com/The-Running-Dev/SubZeroDev.SunTrap), exactly as Life
in the Fast Lane does for `simulation` (10 §15).

| Lives with the game | Why not here |
|---|---|
| Concrete guest archetypes, roles, buildings, products, maps, scenarios, objectives and incidents | Campaign instances authored against §14; another game supplies different values without changing the kind |
| `ticksPerDay`, prices, curve points, utility weights and elasticity | Balance, revisited every playtest |
| The visual client and its renderer choice | 09 already fixes the client contract; the renderer is a game decision |
| The balance harness (§15) | Searches for dominant strategies — a game tool, not an engine gate |

**The TypeScript shapes live here.** `Guest`, `Building`, `WorldMap`,
`WorldGraphCampaignSource`, and every definition in §14 compile inside the engine-owned kind
the same way `simulation`'s state and content types do (10 §7, §15). Sun Trap does not keep a
second interface copy. Its existing `content-and-systems.md` draft was primary design input;
where it now disagrees, this contract is authoritative by that draft's own stated rule.

What remains with the game is the data carried by the schema and the balance decisions
behind it. That is the same contract/content split as every other kind, not a special
ownership exception for spatial games.
