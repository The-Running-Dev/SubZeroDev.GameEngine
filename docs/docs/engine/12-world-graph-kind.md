---
sidebar_label: World-Graph Kind
---

# World-Graph Kind — Contract

**Document status:** Revision 4 — **authoritative runtime-state, campaign-content, and
resolution contract.** Concrete content and balance live with the game; §17 says exactly
what and why.

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
  resolution: WorldResolution | null;              // immutable once system 18 sets it

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
counters, objective/failure progress, empty achievement unlocks, `map.revision: 0`,
`resolution: null`, and `tick: 0`. Queues start empty with no service clock, and no guest or
staff exists before later actions/systems create one. The conversion is deterministic:
terrain cells are emitted in row-major `(y, x)` order; derived grid edges use W44's fixed
neighbour order; scenario placements are allocated in their authored order.

Two rules the seam already implies, stated because a spatial kind is the first place they
bite:

- **Pre-placed buildings, their queues, and scenery take ids from `nextEntityOrdinal` like
  any other** (§9), assigned in authored order: building then queue for every
  `buildingPlacement`, followed by all `sceneryPlacements`. A scenario with three buildings
  and two scenery placements starts with `nextEntityOrdinal: 8`; ids are a pure function of
  the campaign, never load order or a host id source.
- **Any randomness in setup draws from `ctx.derive({ kind: "tick", tick: 0, system })`**, not
  from `ctx.rng`. `initialState` is not an action and has no `seq`; keying setup by tick 0
  keeps §5's rule — *this kind never touches the action stream* — true without exception.

`InitialStateResult.status` may be `"ended"` at creation, exactly as `story-graph` may settle
onto an ending before the player acts (04 §3). For this kind that means a scenario whose
objectives are already satisfied or whose failure condition already holds at tick 0 — a valid
campaign that Tier 2 should warn about (§15), not a crash. Setup evaluates both sets against
the same initialized state, applies `resolutionPrecedence`, and stores the same immutable
`WorldResolution` system 18 would; it does not run the tick pipeline.

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

  buildings: readonly Building[];                    // includes nested Queue
  constructionSites: readonly ConstructionSite[];
  guests: readonly Guest[];                          // includes full guest path, need, and condition state
  staff: readonly Staff[];                           // includes nested StaffTask

  incidents: readonly Incident[];
  objectives: readonly ObjectiveProgress[];
  failures: readonly FailureProgress[];
  alerts: readonly Alert[];
  resolution: WorldResolution | null;                // immutable once system 18 sets it

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
type BuildingStatus = "open" | "closed" | "broken";
type LoanStatus = "active" | "defaulted" | "repaid";
type IncidentSeverity = "info" | "minor" | "major" | "critical";
type AlertSeverity = "info" | "warning" | "critical";
type AlertType = "incident_active" | "building_broken" | "scenario_resolved";
type ObjectiveProgressState = "active" | "met" | "failed";
type FailureProgressState = "active" | "triggered";
type StaffTaskType = "service" | "clean" | "restock" | "build";
type StaffTaskStatus = "assigned" | "in_progress" | "completed" | "cancelled";
type Rotation = 0 | 90 | 180 | 270;
type GuestNeedValue = number;      // integer within the referenced NeedDefinition range
type PercentBasis = number;        // integer basis points, where 10000 = 100%
type GuestDepartureReason =
  | "stay_complete" | "unaffordable" | "unreachable" | "dissatisfied"
  | "unsafe" | "critical_need" | "ejected" | "scenario";

type GuestIntent =
  | {
      kind: "seek_service";
      buildingId: string;
      productId: string | null;              // null for a non-product service
      selectedAtTick: number;
    }
  | { kind: "leave"; exit: Position; reason: GuestDepartureReason; selectedAtTick: number }
  | { kind: "wait"; untilTick: number; selectedAtTick: number };

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
  status: BuildingStatus;                    // sole open/closed/broken authority
  buildStartTick: number;                   // inclusive tick when building entered state
  wear: number;                             // integer 0..100, higher is healthier
  cleanliness: number;                      // integer 0..100, higher is cleaner
  queue: Queue;
  pricesCents: Readonly<Record<string, number>>;  // product id → integer cents; definition-closed keys
  inventory: Readonly<Record<string, number | null>>; // product id → units; null = unlimited
}

interface ConstructionSite {
  id: string;                               // `<construction-site>:<ordinal>`
  definitionId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: Rotation;                       // must match building rotation shape
  startedAtTick: number;
  workRemaining: number;                    // non-negative integer builder-effort units
  completedBuildingId: string;              // reserved when the site is created
  completedQueueId: string;                 // reserved with the building id
}

interface Queue {
  id: string;                               // `<queue>:<ordinal>` from `nextEntityOrdinal`
  guestIds: readonly string[];              // semantic FIFO arrival order; never globally sorted
  serviceStartedAtTick: number | null;       // clock for current head; null when no service runs
}

interface Guest {
  id: string;                               // `<guest>:<ordinal>`
  archetypeId: string;                      // content contract
  lifecycle: GuestLifecycle;
  tickEntered: number;                      // authoritative timeline event
  stayDurationTicks: number;                // positive sampled archetype stay duration
  x: number;
  y: number;
  path: readonly Position[];                // stateful route, excluding cached distance fields
  pathIndex: number;                        // index into `path`, non-negative integer
  drawCount: number;                        // next agent-stream sequence number
  cashCents: number;                        // non-negative integer cents
  intent: GuestIntent;                      // one authoritative destination/fallback choice
  needs: Readonly<Record<string, GuestNeedValue>>; // NeedDefinition id → declared-scale value
  conditions: Readonly<Record<string, number>>;    // GuestConditionDefinition id → declared-scale value
  opinions: Readonly<Record<string, number>>;      // OpinionDefinition id → declared-scale value
  preferences: Readonly<Record<string, number>>;   // PreferenceDefinition id → declared-scale value
  satisfaction: number;                     // integer 0..100
  patienceCapacityTicks: number;             // sampled non-negative per-queue patience
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
  path: readonly Position[];                // committed route, same persistence rule as Guest.path
  pathIndex: number;                        // non-negative index into path
  moveProgressTicks: number;                // ticks accrued toward the next edge
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
  constructionSiteId: string | null;
  incidentId: string | null;
  targetProductId: string | null;
  startedAtTick: number;
  endedAtTick: number | null;
  priority: number;                         // deterministic tie-break source for dispatch
  effortRemaining: number | null;           // null = continuing service duty; otherwise work units
}

// Runtime invariant by type:
// service → buildingId + queueId, null effort
// clean   → incidentId, finite effort
// restock → buildingId + targetProductId, finite effort
// build   → constructionSiteId, finite effort

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
  buildingId: string | null;
  guestId: string | null;
  zoneId: string | null;
  position: Position | null;                // durable target when no surviving entity owns it
  amount: number;                           // positive integer occurrence units; litter uses this
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
  type: AlertType;                          // closed system-19 family
  semanticKey: string;                      // engine-derived dedup key; never player/authored text
  severity: AlertSeverity;
  titleKey: LocKey;
  messageKey: LocKey;
  entityId: string | null;                  // owning entity when applicable
  issuedAtTick: number;
  dismissedAtTick: number | null;
  clearedAtTick: number | null;             // source condition no longer active
}

interface WorldResolution {
  resolution: "objectives_met" | "failed";
  objectiveIds: readonly string[];          // objectives met at terminal, definition-id order
  failureId: string | null;                 // non-null exactly for failed resolution
  resolvedAtTick: number;                   // processing tick that system 18 resolved
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
from `guests` by system 20 of the tick that finalized that lifecycle state. API batch
boundaries are irrelevant (§5). Without this, state grows without bound across a scenario —
and every departed guest still carries
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
> key set at load.** Building record keys are exactly the placed definition's service
> product ids (empty for non-service operations); guest record keys are exactly those in
> the archetype profiles, which must resolve in their definition
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
- For each `Building`, `queue.guestIds` is semantic FIFO order. Same-tick arrivals append by
  guest entity id; removal preserves survivors and rejoining appends at the tail.
- For each `Staff`, `task` is singularly active in this unit, but if history snapshots are stored in
  a future extension, they must be canonical by `StaffTask.id`.

This rule keeps unrelated entities stable under insertion/removal while preserving the one
collection whose order is itself gameplay state.

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

### 4.1 One atomic tick

**The pipeline order is normative.** At the beginning of every loop iteration:

```typescript
const processingTick = state.tick;
```

Systems 1–19 read that immutable value. System 20 performs cleanup and sets
`state.tick = processingTick + 1` exactly once. No system reads the requested batch size,
`ctx.seq`, or whether a previous API call processed the preceding tick. A terminal result
does not interrupt the tick: systems 19 and 20 still run, then the outer loop stops before
starting another iteration.

Initial `tick: 0` therefore means zero completed ticks and tick 0 is next. Day `d` begins
when `floor(processingTick / ticksPerDay) === d` and
`processingTick % ticksPerDay === 0`; system 1 resets the daily accumulators before any
new-tick amount is recorded.

```text
 1  scenario             11  staff-work
 2  guest-spawn          12  construction
 3  guest-needs          13  buildings
 4  guest-service        14  cleanliness-wear
 5  queues               15  finance
 6  guest-intent         16  incidents
 7  guest-path           17  objectives
 8  guest-move           18  failure
 9  task-generate        19  alerts
10  task-assign          20  tick-finalize
```

### 4.2 Tick scratch and complete comparators

`TickScratch` is a disposable value initialized for one tick. It may carry validated
content indexes, path/distance caches keyed by `map.revision`, transient `TaskCandidate`s,
typed service/construction/finance/cleanliness deltas, and batch-change aggregation
metadata. It is never serialized, projected, or read by `outcome()`. Disabling every cache
must leave state, changes, messages, events, and outcome identical.

The following comparators are the only canonical orders systems may use:

| Domain | Complete comparator |
|---|---|
| Runtime entity | prefix lexicographic, then numeric ordinal |
| Definition | validated id, ordinal-code-unit lexicographic |
| Position | row-major `(y, x)` |
| Queue | persisted FIFO arrival position; same-tick admissions by runtime entity id |
| Utility candidate | utility descending, building entity id, product id (`null` first) |
| Task candidate | priority descending, path cost ascending, task-kind order, target entity id or position, source definition id, required role id (`null` first), slot ordinal |
| A* open node | `f`, `h`, `g` ascending, then position row-major |
| Equal-cost A* parent | predecessor position row-major |
| Scheduled effect | due tick, priority descending, source definition id, authored change index, authored effect index |

The task-kind order is `service`, `clean`, `restock`, `build`. A definition id is not an
entity id, and a coordinate has no id; “ties use entity id” is therefore not a complete
rule and is superseded by this registry.

### 4.3 System 1 — `scenario`

**Reads:** `processingTick`, the selected scenario's scheduled changes, active policies,
and their conditions. **Writes:** daily finance resets and typed effects. **Order:** reset
daily accumulators first at a day boundary; snapshot conditions against system-entry state;
then apply due changes by the scheduled-effect comparator. Finally apply active policies by
definition id, with `whileActive` effects in authored order. Effects never change another
condition snapshot in this system. **No-op:** no boundary, due change, or active-policy tick effect.
**Records:** `scenario.effect.applied`; scalar effects join the batch `StateChange`
aggregator under `scenario_effect`.

### 4.4 System 2 — `guest-spawn`

**Reads:** the scenario spawn rule, active guest count, spawn points, and archetype pool.
**Writes:** new guests, `guestsEntered`, and `nextEntityOrdinal`. **Order:** one spawn rule
per scenario; spawn points row-major and pool entries by archetype id before weighted
selection. The only RNG is `tick:${processingTick}:guest-spawn`. A successful spawn gets
the next entity id; cash, stay, patience, satisfaction, and ranged meters then draw in field
order from `agent:${guestId}:${drawCount}`, incrementing after each draw. It starts with a
`lifecycle: "arriving"` and a `wait` intent expiring now. Failed capacity/schedule checks
allocate nothing and draw
nothing. **No-op:** terminal state, non-spawn tick, or active cap reached. **Records:**
`guest.spawned`; membership change is hidden and batch-aggregated.

### 4.5 System 3 — `guest-needs`

**Reads:** active guests, meter definitions/profiles, and active typed effects. **Writes:**
meter values, `spentTicks`, satisfaction, queued patience, and a typed leave/wait intent
when a configured threshold is crossed. **Order:** guests by entity id; meter kinds in
`need`, `condition`, `opinion`, `preference` order; definition ids within each kind. Sum all
deltas for one meter, then clamp once. Queued patience decrements before system 4, never
below zero. Reaching `stayDurationTicks` selects leave with `stay_complete` unless the guest
is already in a service that completes in system 4; that completion wins, then system 5
materializes leave. An arriving guest becomes `seeking` after its first update. **No-op:**
no non-terminal guests. **Records:** trace-only
`guest.meter.changed`; no per-meter `StateChange`.

### 4.6 System 4 — `guest-service`

**Reads:** buildings, FIFO queue heads, `serviceStartedAtTick`, head intents, prices,
inventory, product/service definitions, and staff requirements. **Writes:** guest/building
cash and stock, finance totals, product effects, service/litter incidents, counters, and
guest lifecycle. **Order:** buildings by entity id. A positive-duration service started at
tick `s` completes on the first tick where
`processingTick - s >= serviceDurationTicks`; it cannot finish where it starts. At
completion revalidate the same guest, product, price, stock, and staff facts atomically. A
staff requirement counts only staff at the building with a valid `service` duty task; an
assignment alone is not labor. A
product sale subtracts price from guest cash, adds price minus unit cost to world cash,
adds price to revenue, adds unit cost to expenses, and decrements finite stock. Litter is a
durable incident occurrence at the guest position with the serving building id; its amount
increments `litterCreated` exactly once. **No-op:**
no due valid head. **Records:** `guest.served` and `incident.raised`; finance changes are
batch-aggregated, agent detail is event-only.

### 4.7 System 5 — `queues`

**Reads:** queues, guest intents/positions/patience, entrances, service eligibility, and
the pure utility evaluator from §9. **Writes:** FIFO membership, lifecycle, abandonment
intent, and `serviceStartedAtTick`. **Order:** buildings by entity id; preserve surviving
FIFO order; guests reaching one entrance in the same tick are admitted by entity id.
First remove the head completed by system 4 and every invalid member. Next abandon still-
queued guests whose patience is zero or whose best eligible alternative exceeds the current
candidate by `switchThresholdUtility`. Then admit arrivals up to capacity and start the
head clock only when the building can serve; clear an existing clock whenever its head or
service eligibility changes, so resumed service starts a full new duration. Completion on
the tick patience reaches zero wins because system 4 ran first. Admission resets
`patienceRemainingTicks` to the guest's sampled capacity. A served guest becomes `seeking`
with `wait.untilTick = processingTick` so system 6 must choose again, unless its
stay/threshold state requires leave. Abandonment uses the same immediate wait intent;
rejoining always appends. **No-op:** no queue mutation or start. **Records:**
`queue.joined`, `queue.abandoned`, `service.started`; membership detail is event-only.

### 4.8 System 6 — `guest-intent`

**Reads:** seeking guests, content, finances, buildings, queues, incidents, and canonical
path costs. **Writes:** the single `Guest.intent`; a changed destination clears the
committed path and resets its index. **Order:** guests by entity id; candidates use §9's
eligibility, component, and comparator rules. Queued and currently served guests are not
rescored. If no candidate survives, materialize the archetype's typed fallback. Any
content-declared random choice uses `agent:${guest.id}:${guest.drawCount}` and increments
the counter immediately; deterministic scoring consumes no draw. **No-op:** no guest needs
a decision. **Records:** `guest.intent.selected` with optional trace components; no audit
row.

### 4.9 System 7 — `guest-path`

**Reads:** service/leave intents, committed paths, map revision, dynamic footprints, and
definition entrances. **Writes:** `Guest.path` and `pathIndex`. **Order:** guests by id;
goals row-major; A* follows §9. A changed target has no old path to preserve. A path made
invalid by a map revision remains committed only until canonical replanning succeeds; on
failure it is cleared and the archetype fallback is materialized. **No-op:** waiting,
queued, served, already-at-goal, or still-valid path. **Records:**
`guest.path.committed` or `guest.path.failed` for an actual attempted commitment.

### 4.10 System 8 — `guest-move`

**Reads:** guest paths and lifecycle. **Writes:** position, path index, and departure
lifecycle. **Order:** guests by id. An eligible guest moves at most one directed edge per
tick; overlap is allowed in v1. Reaching a service entrance makes the guest eligible for
system 5 on the next tick—it does not enqueue here because queues already ran. Reaching an
exit under a leave intent marks `departed`, increments departure counters, and leaves
pruning to system 20. **No-op:** no movable guest. **Records:** `guest.moved` at trace and
`guest.departed` at debug; no per-edge audit row.

### 4.11 System 9 — `task-generate`

**Reads:** unresolved staff-resolvable incidents, finite inventory, queue demand,
construction sites, role capabilities, and path costs. **Writes:** canonical transient
`TaskCandidate`s in scratch only. A candidate has task kind, typed target, priority,
required effort (`null` for continuing service duty), path cost, source definition id,
required role id, and slot ordinal; it has no entity id. Service demand creates one
candidate for each missing `(roleId, slot)` from `StaffRequirement.count`. Priority comes
directly from the owning service operation, service
product, building definition, or incident definition—systems add no hidden weighting.
Finite effort is incident amount for clean, missing units to capacity for restock, and site
work remaining for build. `path cost` in the comparator is calculated from the currently
considered staff member; it is scratch, not candidate state shared across staff.
**Order:** generate by the task tuple with path omitted; system 10 inserts the current
staff's path cost and applies the complete comparator. **No-op:** no demand or compatible role.
**Records:** optional `task.candidate.generated` trace; no state, event at normal levels, or
`StateChange`.

### 4.12 System 10 — `task-assign`

**Reads:** staff, valid existing tasks, and scratch candidates. **Writes:** new persisted
tasks, staff paths/status, and `nextEntityOrdinal`. **Order:** preserve valid assignments;
when service demand shrinks, preserve the lowest staff ids up to each role count and cancel
the rest;
canonically replan a preserved task whose committed path was invalidated, cancelling it if
the target is now unreachable; then idle staff by id greedily take their highest compatible
candidate. Remove a candidate
after assignment. Only assignment allocates a task id. Plan the canonical staff path at
the same moment; unreachable candidates were ineligible in system 9. **No-op:** no
assignment, replan, or cancellation. **Records:** `staff.task.assigned`; hidden membership
audit only; invalid preserved work emits `staff.task.cancelled`.

### 4.13 System 11 — `staff-work`

**Reads:** assigned tasks, role work/movement rates, committed paths, and targets.
**Writes:** staff position/path/status, task effort/status, incident resolution, and typed
work deltas for systems 12–14. **Order:** staff by id. Away from target, increment
`moveProgressTicks`; when it reaches `moveTicksPerTile`, traverse one edge and reset it.
At target, subtract the role's positive `effortPerTick` once, clamped at zero. A `null`
effort is continuing service duty and remains valid while its queue demand exists. Missing
targets cancel deterministically. Cleaning resolves its incident and applies `onResolve`
effects now, deferring only building-meter deltas to system 14; construction/restock deltas
wait for their owning systems.
**No-op:** off-duty or taskless staff. **Records:** task moved/completed/cancelled events;
no per-work-unit audit.

### 4.14 System 12 — `construction`

**Reads:** sites and builder deltas. **Writes:** remaining work, completed buildings/queues,
site removal, building counters, and `map.revision`. **Order:** sites by id; apply all
builder work, clamp once, then complete zero-effort sites in that order. Completion uses
the building and queue ids reserved when the site was created, so completion timing cannot
renumber later entities. The new building materializes definition defaults, and the site is
removed. Immediate-MVP construction bypasses sites in the `build` reducer. **No-op:** no
site receives work. **Records:** `construction.progressed`/`construction.completed` and
batch-grain entity/status changes.

### 4.15 System 13 — `buildings`

**Reads:** building operations and restock work. **Writes:** finite inventory
and non-wear operational status allowed by typed operation data. **Order:** buildings by id,
then product id. Restock moves units up to capacity; product unit cost is recognized exactly
once, atomically at service in system 4, not again here. Definitions with no restock source,
decorative and unsupported post-MVP operations are honest no-ops. This system never serves
guests or applies cleanliness/wear. **No-op:** no typed production/restock/status delta.
**Records:** `building.status.changed` and batch-grain scalar changes only when a public
status changes.

### 4.16 System 14 — `cleanliness-wear`

**Reads:** service, litter/incident, staff, policy, and typed effect deltas in scratch.
**Writes:** building cleanliness/wear, litter occurrence amounts, and broken/closure status.
**Order:** buildings by id; for each meter apply sources in `service`, `litter`, `incident`,
`staff`, `policy` order, sum, then clamp once to 0..100. Incident amounts are
updated by incident id. A zero amount resolves the occurrence; transition effects run once.
Cleaning increments `litterCleaned` by the amount removed, independently of definition
effects.
Wear reaching zero changes an open/closed building to `broken`; cleanliness alone never
inventively closes a building—the scenario may fail on it through content. **No-op:** no
delta. **Records:** `building.meter.changed` and `incident.resolved`; batch audit only
for status transitions, not noisy meter steps.

### 4.17 System 15 — `finance`

**Reads:** staff roles, open buildings, loan state, and `ticksPerDay`.
**Writes:** cash and expense totals plus enabled loan fields. **Order:** wages by staff id,
building operating costs by building id, then the one loan. Passive
rates use §9.4 cumulative proration. The MVP loan is `null`; no synthetic loan behavior is
invented. **No-op:** no due amount. **Records:** `finance.charged`; coalesced scalar audit
rows use first-before/final-after values.

### 4.18 System 16 — `incidents`

**Reads:** definitions, active/retained occurrences, trigger/resolution conditions, roll
scopes, and post-finance state. **Writes:** incident resolutions, new occurrences, grouped
effects, counters, and entity ids. **Order:** first resolve active occurrences by id when
`expiresAtTick <= processingTick` or their resolution condition is true, applying resolve
effects once. Then visit scopes in world, zone id, then building id order; eligible
definitions are by id.
An active occurrence, or a retained occurrence with
`processingTick < startedAtTick + cooldownTicks`, makes the same definition/scope
ineligible.
For each declared scope, draw chance and then weighted choice only from
`tick:${processingTick}:incidents`; no eligible scope consumes no draw. Allocate selected
occurrences in resolved scope order, then apply their grouped start effects before system 17.
Effect-started incidents from earlier systems are not rolled again. **No-op:** no eligible
resolution or successful roll. **Records:** `incident.resolved` and `incident.raised`.

### 4.19 System 17 — `objectives`

**Reads:** every objective and one immutable post-system-16 metric/condition snapshot shared
with system 18. **Writes:** progress value,
`satisfiedSinceTick`, state, completion effects, and timestamps. **Order:** evaluate every
objective against the snapshot first; then commit transitions/effects by definition id.
For a non-null `progressMetric`, the evaluator projects an integer value; exact rational
averages compare by cross multiplication and project by truncation toward zero. A null
metric preserves the value changed by ordered `objective_progress` effects. Tier 1 forbids
those effects from targeting metric-driven objectives. A duration of `n` is met on
the `n`th consecutive true tick, counting the current tick as one; false clears the start.
Completion effects run once. **No-op:** no changed value/condition/state. **Records:**
`objective.progressed`/`objective.met`; batch audit is coalesced per objective scalar.

### 4.20 System 18 — `failure`

**Reads:** all failure definitions/progress, objective states, scenario precedence, and the
same immutable post-system-16 snapshot as system 17. Objective completion effects do not
retroactively alter this tick's failure facts.
**Writes:** failure duration/state, unresolved objective terminal states, and immutable
`WorldResolution`. **Order:** failures by
definition id. Update all failure durations against the same system-entry state, then form
success (at least one objective and all met) and failure candidates. A scenario time limit
adds `timeLimitFailureId` when `processingTick + 1 >= timeLimitTicks`, so exactly the
declared number of ticks completes before the deadline fires; that referenced progress row
becomes `triggered` even when its own condition is false. If success and failure both
exist, apply `resolutionPrecedence`; multiple failures choose definition-id first. On a
failed result, mark every still-active objective `failed` after capturing the already-met
ids. Apply every newly triggered failure's `onTriggered` effects once in definition order,
even when `objectives_win` selects the terminal identity; then persist resolution once and
never rewrite it. Do not stop systems 19–20. **No-op:** no
progress or terminal change. **Records:** `failure.progressed`, `failure.triggered`, and
`scenario.resolved`; resolution identity is a visible batch audit.

### 4.21 System 19 — `alerts`

**Reads:** post-resolution incidents, finance, buildings, objectives, failures,
achievements, and current alerts. **Writes:** newly unlocked achievement ids, new alerts,
and `clearedAtTick`. **Order:** first evaluate still-locked achievements by definition id
against the post-resolution state and insert unlocks canonically; profile mirroring occurs
only after the whole action succeeds. Then process alert semantic keys and existing alert
ids. A semantic key is derived only from a closed alert family plus published ids; it
contains no player/authored text. Mark a source no longer active as cleared; create only a
newly active key not represented by an uncleared alert. Alert delivery never feeds another
system. **No-op:** no achievement or active-set transition. **Records:**
`achievement.unlocked`, `alert.raised`, and `alert.cleared`; alert creation/removal audits
are hidden.

The closed keys are `incident:<incidentId>`, `building-broken:<buildingId>`, and one
`scenario-resolved`. Incident alerts reuse the definition's name/description keys; the
other two use kind-owned `world-graph.alert.<type>.title|message` strings validated with
the kind's built-in content. No balance threshold is smuggled into alert derivation.

### 4.22 System 20 — `tick-finalize`

**Reads:** lifecycle, queues, tasks, resolved incidents, cleared/dismissed alerts, and
`processingTick`. **Writes:** referential cleanup and the sole tick increment. **Order:**
entity collections by id; queue survivors retain FIFO order. Remove departed/removed guests
now, not at API-batch end; clear their queue references; clear completed/cancelled nested
tasks. Retain a resolved incident until
`max(resolvedAtTick + 1, startedAtTick + cooldownTicks)`, then prune it; this preserves both
one following audit tick and cooldown memory without a second state table. Retain a cleared
or dismissed alert while its timestamp is greater than or equal to `processingTick`; prune
it once the timestamp is smaller. This makes both lifecycle fields observable across a save
boundary without retaining alert history. Assert no queue/task reference dangles, then
set `tick = processingTick + 1`. **No-op:** cleanup may be empty, but the tick increment is
unconditional. **Records:** `tick.finalized`; only the coalesced tick audit is returned.

### 4.23 Worked causal trace

The minimum W43 fixture takes several ticks; arrows are not permission to collapse phases:

```text
t0  guest-spawn creates guest → guest-needs drifts thirst → guest-intent selects stand
    → guest-path commits A* → guest-move advances one edge → tick-finalize commits t1
t1+ guest-move eventually reaches entrance
next queues admits FIFO and starts service
later guest-service transfers cents, applies drink effect, and creates litter incident
    → queues removes served head → task-generate derives clean task
    → task-assign gives it to cleaner → staff-work begins route
later staff-work resolves litter → cleanliness-wear applies recovery
    → objectives updates the shared post-incident facts → failure resolves if terminal
    → alerts reflects the result → tick-finalize commits and only then stops the batch
```

If the final objective and `bankrupt` both become true on the same tick, system 17 records
the objective, system 18 records the failure, and the scenario's
`resolutionPrecedence` selects exactly one immutable result. Under `objectives_win`, outcome
is `objectives_met` with all published objective ids and `failureId: null`; under
`failure_wins`, it is `failed` with the lexicographically first triggered failure id. Both
facts remain in progress state for audit; only terminal identity is singular.

---

## 5. Batch Invariance — and the Two Seam Changes It Forced

> **Batch invariance.** For any `a, b ≥ 0`, starting from identical kind state, campaign,
> and seed, `advance_ticks (a + b)` and `advance_ticks a` followed by `advance_ticks b`
> finish with deeply equal canonical `WorldGraphKindState`.

This is a kind-state property, not byte identity: the envelope action logs legitimately
differ. It is also stronger than `Outcome` equality—two worlds can share terminal ids while
cash, queues, paths, counters, or cleanup differ. W46 therefore compares the complete
canonical kind state after removing only the envelope action log; the replay oracle's
`Outcome` comparison remains an additional cross-version assertion.

Four rules make the property hold:

1. A batch is only the loop in §4.1; no system observes its requested length.
2. Cleanup occurs in `tick-finalize`, never after the outer loop.
3. This kind draws nothing from `ctx.rng` and never references `ctx.seq`.
4. World draws use `ctx.derive({ kind: "tick", tick: processingTick, system })`; agent
   draws use `ctx.derive({ kind: "agent", agentId, seq: drawCount })` and increment the
   stored counter immediately.

The last two rely on the already-built seam changes: `KindContext.derive` (04 §3.1) and
`StreamId`'s `tick` variant (04 §8). `derive` closes over the seed and persists nothing, so
`{ seed, actionLog }` remains the complete replay input.

Events are compared separately. Tick/entity events are identical across partitions;
`batch.started` and `batch.ended` legitimately differ because they diagnose API calls.
`StateChange[]` may also be partitioned differently because each call returns its own batch
audit. Neither difference may reach final kind state.

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

Allocation is part of action semantics. Immediate build reserves building then queue id;
timed build reserves site, future building, then future queue id in that order. Both build
paths increment `map.revision` when the footprint becomes blocked. Hiring creates one staff
entity at the row-major first exit with an empty committed path, zero movement progress, and
no task. Demolition/fire cancel dangling queue/task/assignment references in the same
reducer; they never wait for a tick to restore referential integrity.

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
} {
  const terminal = state.resolution;
  return {
    resolution: terminal?.resolution ?? null,
    objectivesMet: terminal?.objectiveIds ?? [],
    failureId: terminal?.failureId ?? null,
  };
}
```

**A win requires at least one objective and every one must be `"met"`.** A triggered
`FailureProgress` produces `"failed"` and its published id; a scenario that declares no
objectives has nothing to win. Vacuous truth is the wrong reading—it would end a sandbox
before the player saw one tick—so §15 warns instead. System 18 applies the scenario's
`resolutionPrecedence` when success and failure become true together and stores one
`WorldResolution`. `outcome()` reads that immutable fact; it never reconstructs a possibly
different winner from progress arrays after the fact.

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

**Every tie uses §4.2's complete comparator.** Entity id is only one domain; positions,
definitions, FIFO arrivals, A* nodes, and transient task candidates have their own complete
tuples. Iteration order is likewise canonical except where FIFO/authored order is semantic.

**Entity ids are derived, never supplied.** Guests, staff, buildings, sites, queues and
tasks take ids from `nextEntityOrdinal` in `kindState`, formatted `<prefix>:<ordinal>`.
They may **not** come from the `IdSource` port — 06 §2's rule is that a host may supply
anything that *cannot change `serialize()` output*, and entity ids are serialized. `gameId`
and `seed` come from `IdSource` precisely because they are inputs; these are not.

**Derived caches are never serialized.** Path caches and distance fields keyed by
`map.revision` are recomputed, not persisted — a cache in serialized state is a field free
to drift, the same objection §3 makes to `rng`.

### 9.1 Utility eligibility and score

Eligibility is a filter before arithmetic. A candidate is absent—not assigned a very
negative score—when its content is locked, building is not `open`, queue is full, guest
cannot afford the price, product is not offered/in stock, a typed condition rejects it, or
no canonical path reaches an entrance. The path-cost query uses the same A* rules as §9.3;
it may share scratch cache but not a second reachability rule.

For each survivor evaluate these signed integer components in order:

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

- **Need urgency** is the greatest `NeedProfile.utilityByCurrentValue` output among need
  deltas the service can satisfy; a service satisfying none contributes zero.
- **Preference match** sums matching preference meter values for definitions whose
  `targetTags` intersect product/building tags, then multiplies once by
  `preferenceUtilityPerPoint`.
- **Social relevance** is exactly zero in v1 because groups are not represented; adding
  groups must add a typed input before this component can become non-zero.
- **Quality** is truncation-toward-zero of `(cleanliness + wear) / 2`, multiplied by
  `qualityUtilityPerPoint`.
- **Attractiveness** is the canonically summed applicable adjacency input multiplied by
  `attractivenessUtilityPerPoint`.
- **Price resistance** is the non-negative `priceResistance` curve output at the actual
  integer-cent price.
- **Travel cost** is canonical path cost multiplied by non-negative
  `travelPenaltyPerCost`.
- **Queue penalty** is estimated wait ticks multiplied by non-negative
  `queuePenaltyPerTick`. Estimated wait is the sum of remaining head service time and the
  declared duration for each guest ahead; unlimited capacity does not mean zero wait.
- **Safety concern** sums active incident severity points within the building footprint or
  entrance cells (`info: 0`, `minor: 1`, `major: 10`, `critical: 100`), then multiplies by
  `safetyPenaltyPerPoint`. The severity ladder is engine-mechanical and code-owned.

Each curve/multiplication boundary rounds once; the final sum is not normalized or rounded.
Checked safe-integer addition is mandatory. Tier 1 derives worst-case bounds from validated
meter ranges, curves, map path bounds, queue caps, prices, and incident severity points and
rejects a campaign whose candidate score can leave JavaScript's safe-integer range.

The highest score wins by the utility comparator. A queued guest switches only when
`alternativeUtility - currentUtility > switchThresholdUtility`; equality stays put. With
the current queued candidate, eligibility ignores queue capacity for that guest but still
checks closure, product, affordability, stock, and reachability.
With
no candidate, `fallback.kind: "leave"` selects the row-major nearest equal-cost exit, while
`"wait"` stores `untilTick = processingTick + ticks` and cannot create an implicit retry
inside the current tick. The optional decision trace reports components in the order above
and is trace event data, never state or projection.

### 9.2 Curves, multiplication, and rounding

Step curves select the point with greatest `input <= x`, clamping outside the authored
domain to the nearest endpoint. Linear interpolation between `(x0, y0)` and `(x1, y1)` is
evaluated as one exact rational:

```text
y0 + ((y1 - y0) * (x - x0)) / (x1 - x0)
```

and rounded once **half away from zero**. Signed fixed-point multiplication follows the
same rule after the complete product; intermediate rounding is forbidden. Implementations
may use `bigint` for scratch numerators/products, but the checked result returned to state
or scoring is a safe integer `number`. This is deterministic integer arithmetic, not
serialized BigInt state.

Conditions read one immutable system-entry snapshot. `all`/`any` children evaluate in
authored order without short-circuiting (useful for identical traces even though leaves are
pure); `not` evaluates its one child. Integer metrics compare directly. Rational averages
compare by cross multiplication, never division. An unavailable aggregate follows §14.2.
`tick` is `processingTick`; `day` is `floor(processingTick / ticksPerDay)`; entity counts
include persisted buildings/staff and guests not marked departed/removed; queue length is
persisted FIFO length; incident state uses the active/retained meanings in §14.10.

Effects apply in their owning system's declared order and select runtime targets by the
relevant canonical comparator. Ordered `unlock`/`lock` or policy writes to the same id use
last-write-wins. Each producing system groups numeric deltas by target/scalar, sums, then
clamps once before it exits; systems 1, 4, and 11 explicitly defer building-meter deltas to
system 14 so policy/service/litter/staff sources compose there. Systems after 14 apply their own
group locally—effects never wait for the next tick without persisted state.
Finance/counter/objective deltas use checked addition. An effect cannot emit another effect
or call a system recursively. If starting an incident must sample
a non-constant duration range, it draws from the owning system's
`tick:${processingTick}:<stable-system-id>` handle in effect/target order; a constant range
and `null` duration consume no draw.

### 9.3 Canonical A*

Nodes are `Position`s. Outgoing neighbours are allowed authored `PathCell`s whose `from`
matches the current node, ordered by destination row-major. The destination terrain must be
walkable. Building and construction-site footprint cells are blocked; entrance approach
cells remain outside footprints and are valid goals. Guest overlap does not block a cell.

```text
stepCost(current, next) = edge.edgeCost + terrain(next).moveCost
```

Both terms are non-negative and Tier 1 requires every traversable sum to be positive. The
heuristic is Manhattan distance to the nearest goal multiplied by the campaign's minimum
traversable step cost, so it is admissible. If a future contract admits a zero minimum, the
heuristic is zero and the search is Dijkstra; it may never silently overestimate.

Open nodes and equal-cost parents use §4.2. A closed node reopens only for smaller `g`;
equal `g` replaces its parent only for a row-major-smaller predecessor. Multiple entrances
are goals and equal total cost chooses row-major. The returned committed path includes the
start at index 0 and chosen goal at the final index. Unreachable returns a typed failure,
not an empty successful path.

A cache key is `(map.revision, start, orderedGoals, movementProfile)`, where v1 profiles are
the literal `guest` and `staff` (speed never changes route cost). It may memoize the
canonical answer only; cache enabled/disabled must return the same path and events. A map
mutation increments `revision`, invalidating all old keys without serializing a cache.

### 9.4 Exact passive-rate proration

For non-negative integer `amountPerPeriod`, positive `ticksPerPeriod`, and zero-based
`processingTick`, the amount due is:

```text
floor(amountPerPeriod * (processingTick + 1) / ticksPerPeriod)
- floor(amountPerPeriod * processingTick / ticksPerPeriod)
```

This applies to wages and passive operating cost. It distributes remainder cents
deterministically and sums to exactly `amountPerPeriod` at every period boundary without a
persisted remainder. Implementations evaluate the cumulative products as exact scratch
integers (or by an algebraically equivalent quotient/remainder form), then safe-check the
per-tick result. Product sales and restock costs remain atomic integer-cent transfers.

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
| `batch.started` / `batch.ended` | `debug` | Around `advance_ticks`, with requested and actually processed ticks |
| `building.placed` / `building.demolished` | `info` / `debug` | The `build` and `demolish` reducers |
| `staff.hired` / `staff.fired` / `staff.assigned` | `info` / `debug` / `trace` | The staff reducers |
| `alert.dismissed` | `trace` | The `dismiss_alert` reducer |
| `scenario.effect.applied` | `debug` | System 1 applied one scheduled/policy effect |
| `guest.spawned` / `guest.meter.changed` | `trace` | Systems 2–3 |
| `guest.served` / `service.started` | `trace` | Systems 4–5 |
| `queue.joined` / `queue.abandoned` | `trace` | FIFO membership changes in system 5 |
| `guest.intent.selected` | `trace` | System 6, with optional ordered component trace |
| `guest.path.committed` / `guest.path.failed` | `trace` / `debug` | System 7 attempted a commitment |
| `guest.moved` / `guest.departed` | `trace` / `debug` | System 8 |
| `task.candidate.generated` | `trace` | Optional system-9 diagnostic; never state |
| `staff.task.assigned` / `staff.task.completed` / `staff.task.cancelled` | `trace` | Systems 10–11 |
| `staff.moved` | `trace` | System 11 traversed one edge |
| `construction.progressed` / `construction.completed` | `trace` / `info` | System 12 |
| `building.status.changed` / `building.meter.changed` | `debug` / `trace` | Systems 13–14 and immediate reducers |
| `finance.charged` | `debug` | System 15 coalesced one charge family |
| `incident.raised` / `incident.resolved` | `info` / `debug` | Systems 4, 11, 14, or 16 own the transition |
| `objective.progressed` / `objective.met` | `debug` / `info` | System 17 |
| `failure.progressed` / `failure.triggered` | `debug` / `info` | System 18 |
| `scenario.resolved` | `info` | Win or failure, with the `outcome` ids (§8) |
| `achievement.unlocked` | `info` | System 19, before alert derivation |
| `alert.raised` / `alert.cleared` | `debug` / `trace` | System 19 active-set transition |
| `tick.finalized` | `trace` | System 20, after cleanup and increment |

**`guest.path.failed` earns its place.** A resort where guests silently cannot reach a
building looks identical to one where they do not want to — the failure is invisible in the
projection and obvious in the stream.

Events emit in system order, then the owning comparator order. World draws use only the
stable system ids in §4. A system derives at most one tick handle per tick and threads that
handle through all its draws in declared order; deriving the same id twice would restart the
stream and is forbidden. Agent draws increment their stored counter immediately. A no-op or
rejected candidate consumes no draw unless its content type explicitly declares a trial. No
event feeds a later system.

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

Within one `advance_ticks` call, aggregate by resolved scalar path plus reason. `previous`
is the first value before the batch and `value` is the final value after it; omit the row
when they are equal and no membership transition occurred. Creation/removal `.exists`
records remain separate transitions. Sort returned rows by first causal system, then path,
then reason. Different batch partitions may therefore return different audit arrays; §5
requires their final kind state, not their per-call presentation records, to agree.

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
| `open_building` / `close_building` | `buildings.<id>.status` | `"open"` / `"closed"` (previous) | `building_opened` / `building_closed` |
| `dismiss_alert` | `alerts.<id>.dismissedAtTick` | the tick | `alert_dismissed` |
| `advance_ticks` | `tick` | tick after (tick before) | `ticks_advanced` |
| — terminal | `resolution.resolution` | `"objectives_met"` / `"failed"` (`""`) | `scenario_resolved` |
| — achievement | `unlockedAchievementIds.<id>.exists` | `true` | `achievement_unlocked` |

**`build` writes one of two entity rows.** §6 lets it place a building *or* open a
construction site; which one depends on whether the definition carries required construction
work, and system 12 applies builder work to the site's `workRemaining`. Both rows are
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
> | **Member-scoped** | `<collection>.<memberId>.<field>` or `.exists` | `buildings.b:3.status`, `unlockedAchievementIds.first-sale.exists` |
>
> `<memberId>` is the entity's own id (§9), or the string value in a canonical id set such
> as `unlockedAchievementIds`; it is never an array index. An index is a property of how the
> collection is stored, and §3.4's whole point is that storage order is not addressable. A
> `null` assignment is `""` for the same reason the collection rule exists: the type has no
> null.
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
> not fields of any type in §3.2 — a removed entity or string-set member has no field left
> to carry the news. So `<collection>.<memberId>.exists` is a boolean assertion about
> membership: resolve an entity by its id or an id-set entry by its value, then report
> whether the collection holds it. Everything else in a path is a real field, and no second
> synthetic leaf may be added without amending this paragraph.
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
> **One field is reachable by that rule and still never audited.** `nextEntityOrdinal` is
> an id source, not player-facing state — auditing it would emit a row on every creation
> saying a counter moved. Stated because "derivable from the state type" would otherwise
> imply it should appear. `map.revision` is different: build, completion, and demolition
> mutate dynamic blockage and audit that scalar when it changes.

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
`WorldEffect`. §§4 and 9 own evaluation order, aggregation, rounding, and competing-effect
precedence.

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
      state: "active" | "resolved";              // resolved = retained cooldown/audit window
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

type BuildingSelector =
  | { kind: "all" }
  | { kind: "definition"; buildingDefinitionId: string }
  | { kind: "current_service_building" }
  | { kind: "current_incident_building" };

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
  | {
      kind: "building_meter_delta";
      meter: "cleanliness" | "wear";
      delta: number;
      buildings: BuildingSelector;
    }
  | {
      kind: "start_incident";
      incidentDefinitionId: string;
      target: IncidentTarget;
      amount: number;                             // positive occurrence units
    }
  | {
      kind: "resolve_incident";
      incidentDefinitionId: string;
      incidents: "current" | "all_active";
    }
  | { kind: "set_policy_active"; policyId: string; active: boolean };
```

Every `number` in §14 is an integer. `*Cents` fields are cents, `*Ticks` fields are ticks,
`*Tiles` fields are grid tiles, meter values use their referenced definition range, curve
inputs/outputs use the field that owns the curve, and utility/weight/delta fields are signed
integer scoring units unless a narrower comment says otherwise.

All meters use the range on their referenced definition. `average` is an exact rational
during comparison—§9.2 states the cross-multiplication/rounding rule—so no floating-point
value enters state. Empty `all`/`any`, an aggregate selector that cannot match any reachable
definition, or a metric whose dependent id does not resolve is Tier 1 rather than an
implicit identity value. §9.2 defines the result when a valid selector temporarily has no
runtime entities: `sum`/`entity_count` yield zero; `min`, `max`, and `average` are
unavailable, so a comparison using them is false and objective progress projects as zero.

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

`orthogonal_grid` materializes a directed edge from each row-major origin to every in-bounds
orthogonal neighbour, destinations row-major, with `edgeCost: 0` and `allowed: true`.
Terrain supplies the positive traversable cost required by §9.3. An explicit topology owns
both directions separately; authoring `a → b` never implies `b → a`.

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
  restockTaskPriority: number;                     // signed integer candidate priority
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
      staffingTaskPriority: number;                 // signed integer candidate priority
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
  constructionWork: number;                          // effort units; 0 = immediate MVP construction
  constructionTaskPriority: number;                  // signed integer candidate priority
  operatingCostCentsPerDay: number;                  // non-negative integer cents
  initialWear: number;                               // integer 0..100
  initialCleanliness: number;                        // integer 0..100
  placementRules: readonly PlacementRule[];
  adjacencyEffects: readonly AdjacencyEffect[];
  operation: BuildingOperation;
  tags: readonly string[];
}
```

One placed building owns one stable shared queue; its head guest's `seek_service` intent says
what that guest will buy. That is why W43 removes W42's single `Queue.productId`: it
contradicted a building definition with several products. `pricesCents` and `inventory` are
materialized from `operation.products`; both key sets must equal the definition's product-id
set. Non-service buildings materialize those records empty; their structural queue can
never become a utility/service candidate.

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

interface PreferenceDefinitionBase<TText> extends MeterDefinitionBase<TText> {
  targetTags: readonly string[];                    // non-empty tags scored by §9.1
}

interface NeedProfile {
  needId: string;
  initial: IntegerRange;
  driftByCurrentValue: IntegerCurve;              // current value → integer delta per tick
  utilityByCurrentValue: IntegerCurve;            // current value → non-negative urgency
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
  priceResistance: IntegerCurve;                   // actual price cents → non-negative penalty
  preferenceUtilityPerPoint: number;               // non-negative utility per meter point
  qualityUtilityPerPoint: number;                  // non-negative utility per quality point
  attractivenessUtilityPerPoint: number;           // integer utility units per point
  travelPenaltyPerCost: number;                    // non-negative penalty per path-cost unit
  queuePenaltyPerTick: number;                     // non-negative penalty per estimated wait tick
  safetyPenaltyPerPoint: number;                   // non-negative penalty per severity point
  switchThresholdUtility: number;                  // non-negative strict improvement required
  fallback: { kind: "leave" } | { kind: "wait"; ticks: number }; // wait ticks positive
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

Scenario setup draws use the named tick-0 setup stream (§3.1). Guest archetype ranges are
materialized only after system 2 allocates a guest id, then draw from that guest's own stream
in the fixed order named by §4.4. `StaffTaskType` remains a closed engine union because
dispatch selects a resolver by it; campaigns extend roles and rates by id, not the resolver
vocabulary.

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

interface ScheduledScenarioChange {
  dueTick: number;                                  // non-negative processing tick
  priority: number;                                 // signed integer; higher applies first
  condition: WorldCondition;
  effects: readonly WorldEffect[];                  // authored order
}

type ResolutionPrecedence = "objectives_win" | "failure_wins";

interface ScenarioDefinitionBase<TText> {
  id: string;
  text: TText;
  mapId: string;
  startingCashCents: number;                       // integer cents
  unlockedContent: readonly ContentReference[];
  activePolicyIds: readonly string[];              // MVP-inert
  scheduledChanges: readonly ScheduledScenarioChange[];
  buildingPlacements: readonly BuildingPlacement[];
  sceneryPlacements: readonly SceneryPlacement[];  // MVP-inert
  guestSpawning: ScenarioGuestSpawning;
  objectiveIds: readonly string[];
  failureIds: readonly string[];
  timeLimitTicks: number | null;                   // null = no deadline
  timeLimitFailureId: string | null;               // paired with timeLimitTicks; targets failureIds
  resolutionPrecedence: ResolutionPrecedence;
  buildingLimits: readonly DefinitionLimit[];
  staffLimits: readonly DefinitionLimit[];
  tags: readonly string[];
}

interface ObjectiveDefinitionBase<TText> {
  id: string;
  text: TText;
  completion: WorldCondition;
  progressMetric: WorldMetric | null;              // null = effect-driven persisted progress
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

type IncidentRollScope = "world" | "zone" | "building";

interface IncidentDefinitionBase<TText> {
  id: string;
  text: TText;
  kind: IncidentKind;                              // engine-mechanical resolver family
  severity: IncidentSeverity;
  triggerCondition: WorldCondition | null;         // null = started only by an effect
  rollScope: IncidentRollScope;
  rollChanceBasisPoints: number;                   // integer 0..10000 per scope/tick
  selectionWeight: number;                         // non-negative integer; 0 disables rolling
  cooldownTicks: number;                           // non-negative integer
  durationTicks: IntegerRange | null;               // null = no automatic expiry
  resolutionCondition: WorldCondition | null;
  resolverTaskType: StaffTaskType | null;
  resolverTaskPriority: number | null;               // null iff resolverTaskType is null
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
`(from.y, from.x, to.y, to.x)`; curve points sort by `input`; scheduled changes sort by
§4.2 while retaining authored indexes as final ties. Effects, `all`/`any` children, and
scenario placements preserve authored order: effects have §9.2 order semantics, condition
children are trace-stable, and placements allocate ids. Runtime content remains arrays and
plain objects—ephemeral indexes may be built by W45 but are neither campaign data nor saved
state.

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

### 14.10 W44 reconciliation

The executable system audit found these durable facts absent or duplicated after W43. They
are the only W44 state/content corrections; A* open sets, task candidates, indexes, deltas,
and aggregation buffers remain scratch (§4.2).

| Pre-W44 surface | W44 correction | System proof |
|---|---|---|
| queue globally sorted by guest id; ambiguous `startedAtTick` plus queue patience | semantic FIFO and nullable `serviceStartedAtTick`; patience remains per guest | systems 4–5 must preserve arrival/rejoin order and resume one head service after save/load |
| three nullable guest target ids plus wait ticks | one closed `GuestIntent` union | systems 5–8 require exactly one service/leave/wait destination, not contradictory nullable combinations |
| staff has position but no route | persisted `path`, `pathIndex`, `moveProgressTicks` | system 11 must resume slow movement after save/load without teleporting or rerouting |
| task effort always numeric | `effortRemaining: number | null` | finite clean/restock/build work differs from continuing service duty |
| site completion may allocate later ids; tick-named construction effort | reserved building/queue ids and `workRemaining`; content uses `constructionWork` | system 12 completion order may not renumber entities; builders supply effort, not elapsed time |
| `Building.status` plus derived `isOpen` | `status` is sole authority; construction sites are not buildings | systems 4, 5, 13, and actions cannot disagree about openness |
| copied queue capacity, product-id list, incident severity, and site cost | resolve immutable definitions; runtime retains only mutable records/occurrence facts | no W44 system writes the copies, so they could only drift from their authoritative content/action result |
| litter occurrence has no durable position/amount | `Incident.position` and positive `amount` | systems 4, 9, 11, and 14 need one replayable spatial cleanup target |
| terminal identity reconstructed from mutable progress | immutable `WorldResolution` | system 18 must persist simultaneous precedence and published failure identity once |
| alerts cannot distinguish cleared from dismissed or deduplicate a recurrence | engine-derived `semanticKey` and `clearedAtTick` | system 19 needs a bounded, replayable active-set lifecycle |
| pipeline names scheduled effects, utility inputs, incident rolls, and simultaneous resolution without content fields | scheduled changes, resolution precedence, urgency/fallback/penalty inputs, roll scope/chance, and building-meter effects | systems 1, 6, 14, 16, and 18 otherwise invent campaign rules in code |

Resolved incidents remain through at least the following tick and through their declared
cooldown, which makes `incident_count(state: "resolved")` a retained recent/cooldown-window
metric; cumulative cross-scenario facts use `WorldCounters`. Cleared/dismissed alerts remain
through the first completed tick after their timestamp, then are removed at system 20. Those
retention meanings are engine mechanics, not hidden cache behavior.

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
  in-bounds endpoints and no duplicate directed `(from, to)` pair. Every traversable
  `edgeCost + destination.moveCost` is positive, and worst-case simple path cost is safe.
- Footprints are positive; rotations are unique and supported; every building has an
  entrance exactly one orthogonal cell outside one unrotated edge; placement rules have
  non-empty target ids and valid distance bounds.
- Scenario placements reference real definitions, fit the selected map after rotation,
  satisfy terrain/zone rules, do not overlap, and leave each building with at least one
  walkable approach cell. Building placements are checked by the same pure geometry used by
  `build`, never a scenario-only approximation.
- Building service product ids are unique; each runtime building's price/inventory key sets
  equal its definition's product-id set. A non-product service may have an empty product
  list; any other empty list or
  unresolved staff requirement is invalid. Task priorities are integers;
  `resolverTaskPriority` is null iff `resolverTaskType` is null.
- An archetype declares unique meter entries, every initial range fits its meter definition,
  and runtime guest records have exactly those keys. Urgency and price-resistance curves
  have non-negative outputs; penalty/threshold/fallback fields satisfy §14; the derived
  worst-case utility score is safe. A staff role has one positive work rate for every
  supported task and no extra rate.
- `WorldCondition`/`WorldEffect` discriminators and payloads match. `all`/`any` are non-empty;
  expression depth is at most 32; finance metrics select numeric fields; inventory metrics
  name a product; aggregate and selector references resolve. Context selectors occur only
  where that context exists—for example, `current_incident_building` in incident effects.
  No arbitrary state path exists to validate or execute.
- Objectives/failures have positive duration; non-null objective progress metrics can be
  compared to their targets, and progress effects target only null-metric objectives;
  incident ranges, cooldowns, weights, roll scope/chance, target modes, task
  kinds, and policy costs satisfy their declared domains.
- A scenario's time limit is null or positive and `timeLimitFailureId` is null iff the limit
  is null; otherwise it resolves within that scenario's `failureIds`. Its guest pool is
  non-empty with unique archetypes and positive weights, and definition limits are unique
  and non-negative. Scheduled due ticks are non-negative, effects are non-empty, and
  `resolutionPrecedence` is recognized.

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
      constructionWork: 0,
      constructionTaskPriority: 0,
      operatingCostCentsPerDay: 100,
      initialWear: 100,
      initialCleanliness: 100,
      placementRules: [{ kind: "terrain", terrainIds: ["sand"] }],
      adjacencyEffects: [],
      operation: {
        kind: "service",
        products: [{
          productId: "soft-drink",
          serviceTicks: 2,
          initialUnits: null,
          capacity: null,
          restockTaskPriority: 0,
        }],
        queueMaxLength: 8,
        baseServiceTicks: 2,
        staffRequirements: [],
        staffingTaskPriority: 0,
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
      constructionWork: 0,
      constructionTaskPriority: 0,
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
        staffingTaskPriority: 0,
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
      constructionWork: 0,
      constructionTaskPriority: 0,
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
        utilityByCurrentValue: {
          interpolation: "linear",
          points: [{ input: 0, output: 100 }, { input: 100, output: 0 }],
        },
      },
      {
        needId: "toilet",
        initial: { min: 40, max: 70 },
        driftByCurrentValue: {
          interpolation: "step",
          points: [{ input: 0, output: -1 }, { input: 100, output: -1 }],
        },
        utilityByCurrentValue: {
          interpolation: "linear",
          points: [{ input: 0, output: 100 }, { input: 100, output: 0 }],
        },
      },
    ],
    conditions: [],
    opinions: [{ definitionId: "price", initial: { min: 0, max: 0 } }],
    preferences: [],
    priceResistance: {
      interpolation: "linear",
      points: [{ input: 0, output: 0 }, { input: 1000, output: 100 }],
    },
    preferenceUtilityPerPoint: 1,
    qualityUtilityPerPoint: 1,
    attractivenessUtilityPerPoint: 1,
    travelPenaltyPerCost: 1,
    queuePenaltyPerTick: 2,
    safetyPenaltyPerPoint: 10,
    switchThresholdUtility: 10,
    fallback: { kind: "leave" },
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
    rollScope: "world",
    rollChanceBasisPoints: 0,
    selectionWeight: 0,
    cooldownTicks: 0,
    durationTicks: null,
    resolutionCondition: null,
    resolverTaskType: "clean",
    resolverTaskPriority: 100,
    onStart: [
      {
        kind: "building_meter_delta",
        meter: "cleanliness",
        delta: -5,
        buildings: { kind: "current_incident_building" },
      },
    ],
    onResolve: [
      {
        kind: "building_meter_delta",
        meter: "cleanliness",
        delta: 5,
        buildings: { kind: "current_incident_building" },
      },
    ],
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
    scheduledChanges: [],
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
    resolutionPrecedence: "objectives_win",
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

### 15.3 Resolution verification matrix for W46/W47

- One focused test per system covers mutation, no-op, comparator order, events, and changes.
- Deep canonical state equality covers `advance(a + b)` against `advance(a)` then
  `advance(b)` across departure cleanup, day reset, service/construction completion,
  incident roll, and terminal boundaries.
- Cache-on/cache-off and `recordingEmitter`/`nullEmitter` runs produce identical state;
  tick/entity events also match across batch partitions while batch diagnostics may differ.
- Canonicalized content input may be shuffled without effect; FIFO queue arrays may not,
  because their order is state.
- A* fixtures cover equal paths/parents, multiple entrances, directed edges, blocked
  footprints, unreachable goals, and map-revision invalidation.
- Queue fixtures cover simultaneous arrival, abandonment, close/reopen, rejoin, capacity,
  and save/load during service.
- Utility fixtures cover every component, every eligibility exclusion, negative totals,
  exact ties, fallback, switch threshold, rational/curve rounding, and safe-integer bounds.
- Staff fixtures cover competing staff/tasks, persisted slow movement, target removal,
  continuing service duty, cancellation, and completion order.
- Finance fixtures prove cumulative proration sums exactly at period boundaries under every
  batch partition.
- Objective/failure fixtures cover both precedence values, the exact time-limit boundary,
  progress duration, and immutable terminal identity.
- Save/load fixtures cut between every adjacent system-owned durable handoff represented in
  state: queue service, staff movement/work, incident cleanup, and terminal finalize.

---

## 16. Replay

A `ReplayFixture` (07 §2) records `submissions` including every `advance_ticks` with its
`ticks` parameter, so replay reproduces the exact batching and is exact.

Batch invariance (§5) is the **stronger** property, and it is what makes captured sessions
portable: a fixture recorded from a client running at 4× compares equal to the same play at
1× by deep canonical kind-state equality. `Outcome` equality is asserted as well, but cannot
substitute for the state comparison because it intentionally omits balance-sensitive facts.

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
