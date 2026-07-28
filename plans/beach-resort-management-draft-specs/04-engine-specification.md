# Management-Simulation Kind — Engine Specification

**Document status:** Draft  
**Implementation language:** TypeScript  
**Runtime:** Node.js

---

## 1. Core State

```typescript
interface ResortGameState {
  version: number;
  gameId: string;
  seed: string;
  rng: RngState;

  status: "active" | "completed" | "failed" | "abandoned";

  clock: ResortClock;
  map: ResortMapState;
  finances: ResortFinancialState;

  guests: GuestState[];
  staff: StaffState[];
  buildings: BuildingState[];
  constructionSites: ConstructionSite[];

  incidents: IncidentState[];
  objectives: ObjectiveState[];
  alerts: ResortAlert[];

  history: ResortHistoryEntry[];
  commandLog: LoggedResortCommand[];

  metadata: ResortMetadata;
}
```

---

## 2. Clock

```typescript
interface ResortClock {
  tick: number;
  ticksPerMinute: number;
  minute: number;
  hour: number;
  day: number;
  paused: boolean;
}
```

Only `tick` is authoritative. Other values may be derived.

---

## 3. Map

```typescript
interface ResortMapState {
  width: number;
  height: number;

  terrain: TerrainCell[];
  paths: PathCell[];
  zones: ZoneState[];
  spawnPoints: SpawnPoint[];
  exits: ExitPoint[];

  revision: number;
}
```

`revision` increments when walkability changes and may invalidate path caches.

---

## 4. Position and Footprints

```typescript
interface Position {
  x: number;
  y: number;
}

interface Footprint {
  width: number;
  height: number;
  rotation: 0 | 90 | 180 | 270;
}
```

---

## 5. Guests

```typescript
interface GuestState {
  id: string;
  archetypeId: string;

  position: Position;
  state: GuestLifecycleState;

  cashCents: number;
  arrivalTick: number;
  departureTick: number;

  needs: GuestNeeds;
  conditions: GuestConditions;
  opinions: GuestOpinions;

  preferences: Record<string, number>;

  currentIntent?: GuestIntent;
  currentPath?: Position[];
  queueId?: string;
  groupId?: string;

  satisfaction: number;
  patience: number;

  decisionIndex: number;
}

type GuestLifecycleState =
  | "arriving"
  | "active"
  | "walking"
  | "queued"
  | "being_served"
  | "leaving"
  | "removed"
  | "departed";

interface GuestNeeds {
  hunger: number;
  thirst: number;
  toilet: number;
  rest: number;
  entertainment: number;
  social: number;
  comfort: number;
}

interface GuestConditions {
  drunkenness: number;
  sunburn: number;
  headache: number;
  nausea: number;
  injury: number;
  anger: number;
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
```

All values are integer and clamped.

---

## 6. Guest Intent

```typescript
type GuestIntentKind =
  | "seek_food"
  | "seek_drink"
  | "seek_toilet"
  | "seek_rest"
  | "seek_entertainment"
  | "seek_social"
  | "seek_medical"
  | "leave_resort";

interface GuestIntent {
  kind: GuestIntentKind;
  targetBuildingId?: string;
  utility: number;
  createdTick: number;
}
```

---

## 7. Buildings

```typescript
interface BuildingState {
  id: string;
  definitionId: string;

  position: Position;
  footprint: Footprint;
  entrancePositions: Position[];

  status:
    | "under_construction"
    | "open"
    | "closed"
    | "broken"
    | "damaged"
    | "demolishing";

  condition: number;
  cleanliness: number;

  assignedStaffIds: string[];
  queue: QueueState;

  pricesCents: Record<string, number>;
  inventory: Record<string, number>;

  revenueCents: number;
  operatingCostCents: number;

  openedTick?: number;
}
```

---

## 8. Queues

```typescript
interface QueueState {
  id: string;
  buildingId: string;

  guestIds: string[];
  capacity: number;

  activeServiceGuestIds: string[];
  lastServiceTick: number;
}
```

Queue order must be stable.

---

## 9. Staff

```typescript
interface StaffState {
  id: string;
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

  currentTask?: StaffTask;
  taskIndex: number;
}

type StaffRole =
  | "builder"
  | "cleaner"
  | "mechanic"
  | "security"
  | "service"
  | "medical";

interface StaffTask {
  id: string;
  kind: string;
  targetId: string;
  priority: number;
  createdTick: number;
}
```

---

## 10. Construction

```typescript
interface ConstructionSite {
  id: string;
  buildingDefinitionId: string;

  position: Position;
  footprint: Footprint;

  progress: number;
  workRequired: number;

  assignedBuilderIds: string[];
  paidCostCents: number;
}
```

---

## 11. Finances

```typescript
interface ResortFinancialState {
  cashCents: number;
  debtCents: number;

  revenueTodayCents: number;
  expensesTodayCents: number;

  lifetimeRevenueCents: number;
  lifetimeExpensesCents: number;

  loans: ResortLoan[];
}

interface ResortLoan {
  id: string;
  principalCents: number;
  outstandingCents: number;
  interestBasisPoints: number;
  paymentIntervalTicks: number;
  nextPaymentTick: number;
}
```

---

## 12. Commands

```typescript
type ResortCommand =
  | {
      id: string;
      type: "build";
      buildingDefinitionId: string;
      position: Position;
      rotation: 0 | 90 | 180 | 270;
    }
  | {
      id: string;
      type: "demolish";
      buildingId: string;
    }
  | {
      id: string;
      type: "hire_staff";
      staffDefinitionId: string;
    }
  | {
      id: string;
      type: "fire_staff";
      staffId: string;
    }
  | {
      id: string;
      type: "assign_staff";
      staffId: string;
      buildingId?: string;
      zoneId?: string;
    }
  | {
      id: string;
      type: "set_price";
      buildingId: string;
      productId: string;
      priceCents: number;
    }
  | {
      id: string;
      type: "open_building";
      buildingId: string;
    }
  | {
      id: string;
      type: "close_building";
      buildingId: string;
    }
  | {
      id: string;
      type: "advance_ticks";
      ticks: number;
    };
```

---

## 13. Engine API

```typescript
interface ManagementSimulationEngine {
  createGame(config: NewResortGameConfig): CommandResult<ResortGameState>;

  getPlayerView(state: ResortGameState): ResortPlayerView;
  getAvailableCommands(state: ResortGameState): AvailableResortCommand[];

  validateCommand(
    state: ResortGameState,
    command: ResortCommand
  ): ValidationResult;

  executeCommand(
    state: ResortGameState,
    command: ResortCommand
  ): ResortCommandResult;

  advanceTicks(
    state: ResortGameState,
    ticks: number
  ): TickAdvanceResult;

  serialize(state: ResortGameState): string;
  deserialize(data: string): CommandResult<ResortGameState>;
}
```

---

## 14. Tick Pipeline

Draft order:

```text
1. apply scheduled scenario changes
2. spawn guests
3. update guest needs and conditions
4. resolve guests currently being served
5. update queues
6. select new guest intents
7. path guests
8. move guests
9. generate staff tasks
10. assign staff tasks
11. perform staff work
12. update construction
13. update buildings
14. update cleanliness and wear
15. charge operating costs and wages
16. roll incidents
17. update objectives
18. evaluate failure
19. emit history and alerts
20. increment tick
```

The exact order must be fixed and tested.

---

## 15. Pathfinding

Requirements:

- Deterministic.
- Grid-based initially.
- Stable tie-breaking.
- Multiple entrances.
- Unreachable target detection.
- Cache by map revision.
- Bounded work per tick.

Suggested algorithm:

- A* for individual paths.
- Deterministic neighbor order.
- Shared distance fields later for popular destinations.

---

## 16. Utility Scoring

```typescript
interface UtilityComponent {
  code: string;
  value: number;
}

interface GuestDecisionDebug {
  guestId: string;
  candidates: Array<{
    targetBuildingId: string;
    utility: number;
    components: UtilityComponent[];
  }>;
  selectedTargetBuildingId?: string;
}
```

Debug detail should be available only in transparency or development mode.

---

## 17. Content Definitions

Required initial definitions:

- Guest archetypes.
- Staff roles.
- Buildings.
- Products.
- Terrain.
- Scenery.
- Incidents.
- Scenarios.
- Objectives.
- Policies.
- Achievements.
- Localization strings.

---

## 18. Content Validation

Tier 1 hard failures:

- Duplicate IDs.
- Missing references.
- Invalid footprints.
- Missing localization.
- Invalid price ranges.
- Unsupported roles.
- Invalid objective fields.
- Invalid spawn points.
- Buildings with no entrance.
- Negative capacity.
- Invalid terrain requirements.

Tier 2 warnings:

- Unreachable building unlocks.
- Scenario with no completion path.
- Map regions disconnected from all spawns.
- Building category with no guest demand.
- Staff role with no task generators.
- Incidents with no resolution path.

Tier 3 simulation findings:

- Dominant building.
- Infinite-money exploit.
- Permanent queue deadlock.
- Unavoidable bankruptcy.
- Staff starvation.
- Pathfinding collapse.
- Objective impossible under normal play.

---

## 19. Testing

Unit tests:

- Placement.
- Prices.
- Utility scores.
- Queue order.
- Service cycle.
- Staff assignment.
- Pathfinding.
- Finances.
- Objective evaluation.
- Serialization.

Integration tests:

- Guest enters, buys, and leaves.
- Queue forms and clears.
- Cleaner resolves dirt.
- Mechanic repairs a building.
- Security resolves an incident.
- Scenario win.
- Bankruptcy failure.

Determinism tests:

- Same seed and commands produce byte-identical save.
- Save/load mid-run produces identical continuation.
- Different client stepping speeds produce identical state after the same tick count.

Performance tests:

- 100 guests.
- 500 guests.
- 1,000 guests.
- Large map.
- Dense queue.
- Mass rerouting after demolition.

---

## 20. Draft Acceptance Criteria

The prototype is complete when it can:

1. Load one map and one scenario.
2. Build one service building.
3. Spawn guests.
4. Move guests deterministically.
5. Let guests select a building.
6. Form a queue.
7. Serve guests.
8. Transfer money.
9. Update needs.
10. Hire one staff type.
11. Generate and complete one staff task.
12. Trigger one incident.
13. Evaluate one objective.
14. Fail through bankruptcy.
15. Save and load.
16. Replay identically.
17. Run without a visual client.
18. Expose a safe player projection.
