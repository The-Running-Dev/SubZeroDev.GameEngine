/**
 * World-graph kind — runtime state and shared structural types.
 *
 * This file captures the `WorldGraphKindState` shape plus all nested runtime entities
 * from `12-world-graph-kind.md` so `initialState`, reducers, validation and projection
 * use a single, shared type graph.
 */

export type Position = {
  x: number;
  y: number;
};

export type TerrainKind = "empty" | "path" | "wall" | "water" | "restricted";
export type MapEdgeKind = "walkable" | "blocked";
export type StaffStatus = "idle" | "to_work" | "working" | "off_duty";
export type GuestLifecycle = "arriving" | "seeking" | "queued" | "served" | "departed" | "removed";
export type BuildingStatus = "construction" | "open" | "closed" | "broken";
export type LoanStatus = "active" | "defaulted" | "repaid";
export type IncidentType = "fire" | "breakdown" | "theft" | "spill" | "litter" | "complaint" | "power" | "weather";
export type IncidentSeverity = "info" | "minor" | "major" | "critical";
export type AlertSeverity = "info" | "warning" | "critical";
export type ObjectiveProgressState = "active" | "met" | "failed";
export type StaffTaskType = "service" | "clean" | "restock" | "build";
export type StaffTaskStatus = "queued" | "assigned" | "in_progress" | "completed" | "cancelled";
export type Rotation = 0 | 90 | 180 | 270;

export interface WorldGraphKindState {
  tick: number;
  map: WorldMap;
  finances: Finances;

  buildings: readonly Building[];
  constructionSites: readonly ConstructionSite[];
  guests: readonly Guest[];
  staff: readonly Staff[];

  incidents: readonly Incident[];
  objectives: readonly ObjectiveProgress[];
  alerts: readonly Alert[];

  nextEntityOrdinal: number;
}

export interface TerrainCell {
  x: number;
  y: number;
  terrain: TerrainKind;
  edge: MapEdgeKind;
  moveCost: number;
}

export interface PathCell {
  from: Position;
  to: Position;
  edgeCost: number;
  allowed: boolean;
}

export interface Zone {
  id: string;
  nameKey: string;
  cells: readonly Position[];
  serviceRadius: number;
  maxOccupancy: number | null;
}

export interface WorldMap {
  width: number;
  height: number;
  revision: number;
  terrain: readonly TerrainCell[];
  paths: readonly PathCell[];
  zones: readonly Zone[];
  spawnPoints: readonly Position[];
  exits: readonly Position[];
}

export interface Building {
  id: string;
  definitionId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: Rotation;
  status: BuildingStatus;
  isOpen: boolean;
  buildStartTick: number;
  wear: number;
  cleanliness: number;
  queue: Queue;
  products: readonly string[];
  /**
   * Product id → integer cents, written by `set_price` and read by projection.
   *
   * Not the loose bag `02-architecture.md` N6 bans: the keys are exactly the ids in
   * `products`, which come from the validated definition, so Tier 1 closes the key set at
   * load — the argument `10 §6.2` already made for `ActorState`'s `skills`/`counters`
   * (12 §3.3).
   */
  pricesCents: Readonly<Record<string, number>>;
  serviceTickSeq: number;
}

export interface ConstructionSite {
  id: string;
  definitionId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: Rotation;
  startedAtTick: number;
  buildTicksRemaining: number;
  totalCostCents: number;
  completedBuildingId: string | null;
}

export interface Queue {
  id: string;
  productId: string;
  guestIds: readonly string[];
  maxLength: number | null;
  patienceTicks: number;
  startedAtTick: number;
}

export interface Guest {
  id: string;
  archetypeId: string;
  lifecycle: GuestLifecycle;
  tickEntered: number;
  x: number;
  y: number;
  path: readonly Position[];
  pathIndex: number;
  drawCount: number;
  targetBuildingId: string | null;
  targetQueueId: string | null;
  targetProductId: string | null;
  /** Non-negative integer *ticks* this guest tolerates waiting. Never seconds: §3 collapses
   *  the clock to `tick`, and a tick's simulated duration is campaign balance data. */
  targetWaitTicks: number;
  needs: GuestNeeds;
  conditions: GuestConditions;
  opinions: GuestOpinions;
  preferences: GuestPreferences;
}

export interface GuestNeeds {
  hunger: number;
  rest: number;
  social: number;
  comfort: number;
  hygiene: number;
  safety: number;
}

export interface GuestConditions {
  /** Integer -100..100; the sign is the utility trend. */
  mood: number;
  patienceRemainingTicks: number;
  lastServedTick: number | null;
  spentTicks: number;
  // No `arrivalTick`: `Guest.tickEntered` already records it, and two fields for one fact
  // are free to disagree (12 §3.3).
}

export interface GuestOpinions {
  price: number;
  variety: number;
  cleanliness: number;
  safety: number;
  attractiveness: number;
  queues: number;
  service: number;
}

export interface GuestPreferences {
  noiseTolerance: number;
  spendingCategory: "budget" | "balanced" | "premium";
  loyaltyMultiplier: number;
}

export interface Staff {
  id: string;
  roleId: string;
  x: number;
  y: number;
  status: StaffStatus;
  assignedBuildingId: string | null;
  /** The only stored zone membership. A second, derived `zoneId` "current zone at read
   *  time" would be a derived value beside the field it derives from — banned by the same
   *  rule that removed `Building.entrances` (12 §3.3). */
  assignedZoneId: string | null;
  drawCount: number;
  task: StaffTask | null;
  tasksCompleted: number;
}

export interface StaffTask {
  id: string;
  type: StaffTaskType;
  status: StaffTaskStatus;
  guestId: string | null;
  queueId: string | null;
  buildingId: string | null;
  targetProductId: string | null;
  startedAtTick: number;
  endedAtTick: number | null;
  priority: number;
  effortTicks: number;
}

export interface Finances {
  cashCents: number;
  revenueTodayCents: number;
  expensesTodayCents: number;
  revenueTotalCents: number;
  expensesTotalCents: number;
  loan: Loan | null;
}

export interface Loan {
  id: string;
  principalCents: number;
  balanceCents: number;
  interestBasisPoints: number;
  accruedInterestCents: number;
  status: LoanStatus;
  startedAtTick: number;
  durationTicks: number;
  nextPaymentTick: number | null;
}

export interface Incident {
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

export interface ObjectiveProgress {
  id: string;
  state: ObjectiveProgressState;
  value: number;
  target: number;
  updatedAtTick: number;
}

export interface Alert {
  id: string;
  type: string;
  severity: AlertSeverity;
  titleKey: string;
  messageKey: string;
  entityId: string | null;
  issuedAtTick: number;
  dismissedAtTick: number | null;
}

export interface WorldGraphView {
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
    blockedBy: readonly string[];
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
  queuedGuests: number;
}
