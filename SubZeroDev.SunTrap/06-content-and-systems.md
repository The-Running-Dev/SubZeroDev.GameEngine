# Sun Trap — Content and Systems Detail

**Document status:** Draft

> **Scope**
> Field-level shapes for the entities this game simulates, and the systems that update them.
>
> **These are `kindState` internals.** The engine treats game state as an opaque payload and
> never reads inside it, so the shapes below are this game's to define — subject to the
> rules in §1, which are not negotiable.

---

## 1. The Rules These Shapes Must Obey

Taken from the kind contract; every shape below is written to satisfy them.

| Rule | Consequence here |
|---|---|
| No envelope duplication | No `version`, `gameId`, `seed`, `status`, `metadata` or command log in any shape below — the engine owns all six |
| No persisted RNG state | No generator state anywhere. Randomness derives from the seed and a stream id |
| Integers only | Every numeric field below is an integer. Money is cents; fractional quantities are fixed-point with a stated scale |
| Derived values are computed, not stored | No totals, no averages, no cached distances in state |
| Entity ids are engine-derived | Ids come from the state's own ordinal counter, formatted `<prefix>:<ordinal>`. Never from a host id source, never random |
| Ties break by id | Any comparison that can tie states its tiebreaker as the entity id |

---

## 2. Clock

The kind's state carries `tick` and nothing else. Minute, hour and day are **computed on
read** from `tick` and the campaign's `ticksPerMinute`. There is no paused flag — the engine
advances only when an action tells it to.

---

## 3. Map

```typescript
interface ResortMap {
  width: number;
  height: number;

  terrain: readonly TerrainCell[];
  paths: readonly PathCell[];
  zones: readonly Zone[];
  spawnPoints: readonly Position[];
  exits: readonly Position[];

  revision: number;        // increments when walkability changes
}

interface Position { x: number; y: number; }

interface Footprint {
  width: number;
  height: number;
  rotation: 0 | 90 | 180 | 270;
}
```

`revision` is the cache key for pathfinding. **The caches themselves are not part of state** —
they are rebuilt when `revision` changes.

---

## 4. Guests

```typescript
interface Guest {
  id: string;                       // "g:<ordinal>"
  archetypeId: string;

  position: Position;
  lifecycle: GuestLifecycle;

  cashCents: number;
  arrivalTick: number;
  departureTick: number;

  needs: GuestNeeds;
  conditions: GuestConditions;
  opinions: GuestOpinions;
  preferences: Readonly<Record<string, number>>;

  intent?: GuestIntent;
  path?: readonly Position[];       // the route committed to, not a cache
  queueId?: string;
  groupId?: string;

  satisfaction: number;
  patience: number;

  drawCount: number;                // this guest's own RNG draw counter
}

type GuestLifecycle =
  | "arriving" | "active" | "walking" | "queued"
  | "being_served" | "leaving" | "departed" | "removed";

interface GuestNeeds {
  hunger: number; thirst: number; toilet: number; rest: number;
  entertainment: number; social: number; comfort: number;
}

interface GuestConditions {
  drunkenness: number; sunburn: number; headache: number;
  nausea: number; injury: number; anger: number;
}

interface GuestOpinions {
  price: number; variety: number; cleanliness: number; safety: number;
  attractiveness: number; queues: number; service: number;
}

type GuestIntentKind =
  | "seek_food" | "seek_drink" | "seek_toilet" | "seek_rest"
  | "seek_entertainment" | "seek_social" | "seek_medical" | "leave_resort";

interface GuestIntent {
  kind: GuestIntentKind;
  targetBuildingId?: string;
  utility: number;
  createdTick: number;
}
```

All need, condition and opinion values are integers on a fixed scale, clamped at both ends.

> **`drawCount` is load-bearing.** A guest's randomness is keyed by its id and this counter,
> never by how many actions the player has submitted. Without it, building something on the
> far side of the map would change what an unrelated guest does next.

> **`path` is state, not cache.** The guest committed to that route; a later map change must
> not retroactively rewrite where it has been walking. Distance fields and A\* scratch data
> *are* caches and are excluded from state.

---

## 5. Buildings and Queues

```typescript
interface Building {
  id: string;                       // "b:<ordinal>"
  definitionId: string;

  position: Position;
  footprint: Footprint;
  entrances: readonly Position[];

  status: "under_construction" | "open" | "closed"
        | "broken" | "damaged" | "demolishing";

  condition: number;
  cleanliness: number;

  assignedStaffIds: readonly string[];
  queue: Queue;

  pricesCents: Readonly<Record<string, number>>;
  inventory: Readonly<Record<string, number>>;

  revenueCents: number;
  operatingCostCents: number;

  openedTick?: number;
}

interface Queue {
  id: string;                       // "q:<ordinal>"
  buildingId: string;
  guestIds: readonly string[];      // ordered; order is stable
  capacity: number;
  servingGuestIds: readonly string[];
  lastServiceTick: number;
}
```

---

## 6. Staff and Construction

```typescript
interface Staff {
  id: string;                       // "s:<ordinal>"
  definitionId: string;
  role: StaffRole;

  position: Position;
  status: "idle" | "walking" | "working" | "off_shift" | "unavailable";

  wageCentsPerHour: number;
  fatigue: number;
  morale: number;
  skill: number;

  assignedZoneId?: string;
  assignedBuildingId?: string;

  task?: StaffTask;
  drawCount: number;                // as for guests — §4
}

type StaffRole =
  | "builder" | "cleaner" | "mechanic" | "security" | "service" | "medical";

interface StaffTask {
  id: string;                       // "t:<ordinal>"
  kind: string;
  targetId: string;
  priority: number;
  createdTick: number;
}

interface ConstructionSite {
  id: string;                       // "c:<ordinal>"
  buildingDefinitionId: string;
  position: Position;
  footprint: Footprint;
  progress: number;
  workRequired: number;
  assignedBuilderIds: readonly string[];
  paidCostCents: number;
}
```

---

## 7. Finances

```typescript
interface Finances {
  cashCents: number;
  debtCents: number;

  revenueTodayCents: number;
  expensesTodayCents: number;

  lifetimeRevenueCents: number;
  lifetimeExpensesCents: number;

  loans: readonly Loan[];
}

interface Loan {
  id: string;                       // "l:<ordinal>"
  principalCents: number;
  outstandingCents: number;
  interestBasisPoints: number;      // integer basis points, never a float rate
  paymentIntervalTicks: number;
  nextPaymentTick: number;
}
```

---

## 8. Pathfinding

Deterministic, grid-based initially, with stable tie-breaking, multiple entrances,
unreachable-target detection, caching by map revision, and bounded work per tick.

A\* for individual paths with a **fixed neighbour order**; shared distance fields later for
popular destinations.

**No `Math.sqrt`.** Distance comparisons use squared Euclidean, Manhattan or Chebyshev
metrics — all integer, all order-preserving where it matters. Costs are integers.

---

## 9. Utility Scoring

```typescript
interface UtilityComponent { code: string; value: number; }

interface GuestDecisionTrace {
  guestId: string;
  candidates: readonly {
    targetBuildingId: string;
    utility: number;
    components: readonly UtilityComponent[];
  }[];
  selectedTargetBuildingId?: string;
}
```

Scores are integers on a fixed scale. Ties break by building id.

**This trace never reaches a client by default.** It crosses the projection boundary only
under a campaign-declared transparency mode, and it is otherwise carried on the event stream
where it can be dropped entirely.

---

## 10. Content Definitions

Guest archetypes, staff roles, buildings, products, terrain, scenery, incidents, scenarios,
objectives, policies, achievements and localization strings.

All are campaign data loaded through the engine's content registry. **Identity fields —
`id`, `version`, `titleKey` — belong to the engine's campaign envelope and must not be
repeated inside these definitions.**

---

## 11. Validation

Tier 1 hard failures: duplicate ids, missing references, invalid footprints, missing
localization, invalid price ranges, unsupported roles, invalid objective fields, invalid
spawn points, buildings with no entrance, negative capacity, invalid terrain requirements,
and a missing or non-positive tick-batch cap.

Tier 2 warnings: unreachable building unlocks, a scenario with no completion path, map
regions disconnected from every spawn, a building category with no guest demand, a staff
role with no task generator, incidents with no resolution path.

**Balance findings are not a validation tier.** Dominant buildings, infinite-money loops,
queue deadlock and unavoidable bankruptcy come from the balance harness, which is a
long-running search, not a load-time check.

---

## 12. Testing

**Unit** — placement, prices, utility scores, queue order, service cycle, staff assignment,
pathfinding, finances, objective evaluation, serialization.

**Integration** — a guest enters, buys and leaves; a queue forms and clears; a cleaner
resolves dirt; a mechanic repairs a building; security resolves an incident; a scenario
wins; bankruptcy fails.

**Determinism** — same seed and actions produce byte-identical saves; save and load mid-run
continues identically; a tick batch equals the same ticks taken singly.

**Performance** — 100, 500 and 1,000 guests; a large map; a dense queue; mass rerouting
after a demolition. Measured as the latency of one `advance_ticks` call, per §2.1 of the
roadmap.
