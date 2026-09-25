import type { LocKey } from "../../core/localization/types.js";
import type { ReasonCode } from "../../core/kernel/reasons.js";
import type { ContentReference, IncidentKind } from "./content.js";

export type Position = { readonly x: number; readonly y: number };
export type Rotation = 0 | 90 | 180 | 270;
export type StaffStatus = "idle" | "to_work" | "working" | "off_duty";
export type GuestLifecycle = "arriving" | "seeking" | "queued" | "served" | "departed" | "removed";
export type BuildingStatus = "open" | "closed" | "broken";
export type LoanStatus = "active" | "defaulted" | "repaid";
export type IncidentSeverity = "info" | "minor" | "major" | "critical";
export type AlertSeverity = "info" | "warning" | "critical";
export type AlertType = "incident_active" | "building_broken" | "scenario_resolved";
export type ObjectiveProgressState = "active" | "met" | "failed";
export type FailureProgressState = "active" | "triggered";
export type StaffTaskType = "service" | "clean" | "restock" | "build";
export type StaffTaskStatus = "assigned" | "in_progress" | "completed" | "cancelled";
export type GuestDepartureReason =
  | "stay_complete" | "unaffordable" | "unreachable" | "dissatisfied"
  | "unsafe" | "critical_need" | "ejected" | "scenario";

export type GuestIntent =
  | { readonly kind: "seek_service"; readonly buildingId: string; readonly productId: string | null; readonly selectedAtTick: number }
  | { readonly kind: "leave"; readonly exit: Position; readonly reason: GuestDepartureReason; readonly selectedAtTick: number }
  | { readonly kind: "wait"; readonly untilTick: number; readonly selectedAtTick: number };

export interface WorldGraphKindState {
  readonly tick: number;
  readonly map: WorldMap;
  readonly finances: Finances;
  readonly buildings: readonly Building[];
  readonly constructionSites: readonly ConstructionSite[];
  readonly guests: readonly Guest[];
  readonly staff: readonly Staff[];
  readonly incidents: readonly Incident[];
  readonly objectives: readonly ObjectiveProgress[];
  readonly failures: readonly FailureProgress[];
  readonly alerts: readonly Alert[];
  readonly resolution: WorldResolution | null;
  readonly counters: WorldCounters;
  readonly unlockedContent: readonly ContentReference[];
  readonly activePolicyIds: readonly string[];
  readonly unlockedAchievementIds: readonly string[];
  readonly nextEntityOrdinal: number;
}

export interface WorldMap {
  readonly width: number;
  readonly height: number;
  readonly revision: number;
  readonly terrain: readonly TerrainCell[];
  readonly paths: readonly PathCell[];
  readonly zones: readonly Zone[];
  readonly spawnPoints: readonly Position[];
  readonly exits: readonly Position[];
  readonly scenery: readonly Scenery[];
}

export interface TerrainCell { readonly x: number; readonly y: number; readonly terrainId: string }
export interface PathCell { readonly from: Position; readonly to: Position; readonly edgeCost: number; readonly allowed: boolean }
export interface Zone {
  readonly id: string;
  readonly nameKey: LocKey;
  readonly cells: readonly Position[];
  readonly serviceRadius: number;
  readonly maxOccupancy: number | null;
}
export interface Scenery {
  readonly id: string;
  readonly definitionId: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly rotation: Rotation;
}

export interface Building {
  readonly id: string;
  readonly definitionId: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly rotation: Rotation;
  readonly status: BuildingStatus;
  readonly buildStartTick: number;
  readonly wear: number;
  readonly cleanliness: number;
  readonly queue: Queue;
  readonly pricesCents: Readonly<Record<string, number>>;
  readonly inventory: Readonly<Record<string, number | null>>;
}

export interface ConstructionSite {
  readonly id: string;
  readonly definitionId: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly rotation: Rotation;
  readonly startedAtTick: number;
  readonly workRemaining: number;
  readonly completedBuildingId: string;
  readonly completedQueueId: string;
}

export interface Queue {
  readonly id: string;
  readonly guestIds: readonly string[];
  readonly serviceStartedAtTick: number | null;
}

export interface Guest {
  readonly id: string;
  readonly archetypeId: string;
  readonly lifecycle: GuestLifecycle;
  readonly tickEntered: number;
  readonly stayDurationTicks: number;
  readonly x: number;
  readonly y: number;
  readonly path: readonly Position[];
  readonly pathIndex: number;
  readonly drawCount: number;
  readonly cashCents: number;
  readonly intent: GuestIntent;
  readonly needs: Readonly<Record<string, number>>;
  readonly conditions: Readonly<Record<string, number>>;
  readonly opinions: Readonly<Record<string, number>>;
  readonly preferences: Readonly<Record<string, number>>;
  readonly satisfaction: number;
  readonly patienceCapacityTicks: number;
  readonly patienceRemainingTicks: number;
  readonly lastServedTick: number | null;
  readonly spentTicks: number;
}

export interface Staff {
  readonly id: string;
  readonly roleId: string;
  readonly x: number;
  readonly y: number;
  readonly status: StaffStatus;
  readonly path: readonly Position[];
  readonly pathIndex: number;
  readonly moveProgressTicks: number;
  readonly assignedBuildingId: string | null;
  readonly assignedZoneId: string | null;
  readonly drawCount: number;
  readonly task: StaffTask | null;
  readonly tasksCompleted: number;
}

export interface StaffTask {
  readonly id: string;
  readonly type: StaffTaskType;
  readonly status: StaffTaskStatus;
  readonly guestId: string | null;
  readonly queueId: string | null;
  readonly buildingId: string | null;
  readonly constructionSiteId: string | null;
  readonly incidentId: string | null;
  readonly targetProductId: string | null;
  readonly startedAtTick: number;
  readonly endedAtTick: number | null;
  readonly priority: number;
  readonly effortRemaining: number | null;
}

export interface Finances {
  readonly cashCents: number;
  readonly revenueTodayCents: number;
  readonly expensesTodayCents: number;
  readonly revenueTotalCents: number;
  readonly expensesTotalCents: number;
  readonly loan: Loan | null;
}
export interface Loan {
  readonly id: string;
  readonly principalCents: number;
  readonly balanceCents: number;
  readonly interestBasisPoints: number;
  readonly accruedInterestCents: number;
  readonly status: LoanStatus;
  readonly startedAtTick: number;
  readonly durationTicks: number;
  readonly nextPaymentTick: number | null;
}
export interface Incident {
  readonly id: string;
  readonly definitionId: string;
  readonly buildingId: string | null;
  readonly guestId: string | null;
  readonly zoneId: string | null;
  readonly position: Position | null;
  readonly amount: number;
  readonly startedAtTick: number;
  readonly expiresAtTick: number | null;
  readonly resolvedAtTick: number | null;
}
export interface ObjectiveProgress {
  readonly id: string;
  readonly state: ObjectiveProgressState;
  readonly value: number;
  readonly target: number;
  readonly satisfiedSinceTick: number | null;
  readonly updatedAtTick: number;
}
export interface FailureProgress {
  readonly id: string;
  readonly state: FailureProgressState;
  readonly satisfiedSinceTick: number | null;
  readonly updatedAtTick: number;
}
export interface Alert {
  readonly id: string;
  readonly type: AlertType;
  readonly semanticKey: string;
  readonly severity: AlertSeverity;
  readonly titleKey: LocKey;
  readonly messageKey: LocKey;
  readonly entityId: string | null;
  readonly issuedAtTick: number;
  readonly dismissedAtTick: number | null;
  readonly clearedAtTick: number | null;
}
export interface WorldResolution {
  readonly resolution: "objectives_met" | "failed";
  readonly objectiveIds: readonly string[];
  readonly failureId: string | null;
  readonly resolvedAtTick: number;
}
export interface WorldCounters {
  readonly guestsEntered: number;
  readonly guestsDeparted: number;
  readonly guestsDissatisfied: number;
  readonly servicesCompleted: number;
  readonly buildingsCompleted: number;
  readonly incidentsRaised: number;
  readonly litterCreated: number;
  readonly litterCleaned: number;
}

export interface WorldGraphViewText {
  readonly id: string;
  readonly nameKey: LocKey;
  readonly descriptionKey: LocKey;
}

export type WorldGraphViewMeterDefinition =
  | (WorldGraphViewText & {
      readonly kind: "need";
      readonly minimum: number;
      readonly maximum: number;
      readonly criticalBelow: number;
      readonly satisfiedAtOrAbove: number;
    })
  | (WorldGraphViewText & {
      readonly kind: "condition";
      readonly minimum: number;
      readonly maximum: number;
    })
  | (WorldGraphViewText & {
      readonly kind: "opinion";
      readonly minimum: number;
      readonly maximum: number;
      readonly neutral: number;
    });

export interface WorldGraphViewValue {
  readonly definitionId: string;
  readonly value: number;
}

export interface WorldGraphBuildOption extends WorldGraphViewText {
  readonly footprint: { readonly width: number; readonly height: number };
  readonly allowedRotations: readonly Rotation[];
  readonly constructionCostCents: number;
  readonly operatingCostCentsPerDay: number;
  readonly operation:
    | {
        readonly kind: "service";
        readonly products: readonly {
          readonly productId: string;
          readonly serviceTicks: number | null;
          readonly initialUnits: number | null;
          readonly capacity: number | null;
        }[];
        readonly queueMaxLength: number | null;
        readonly baseServiceTicks: number;
        readonly staffRequirements: readonly { readonly roleId: string; readonly count: number }[];
      }
    | { readonly kind: "waste"; readonly capacity: number | null }
    | { readonly kind: "decorative" }
    | { readonly kind: "support"; readonly generatedTaskKinds: readonly StaffTaskType[] };
  readonly canBuild: boolean;
  /** Every §11 code that rejects this definition regardless of placement. */
  readonly blockedBy: readonly ReasonCode[];
}

export interface WorldGraphStaffOption extends WorldGraphViewText {
  readonly hireCostCents: number;
  readonly wageCentsPerDay: number;
  readonly supportedTaskKinds: readonly StaffTaskType[];
  readonly canHire: boolean;
  /** Every §11 code that rejects this role regardless of assignment. */
  readonly blockedBy: readonly ReasonCode[];
}

export interface WorldGraphView {
  readonly tick: number;
  readonly finances: Pick<Finances, "cashCents" | "revenueTodayCents" | "expensesTodayCents" | "revenueTotalCents" | "expensesTotalCents">;

  readonly scenario: WorldGraphViewText & {
    readonly mapId: string;
    readonly ticksPerDay: number;
    readonly maxTicksPerAction: number;
    readonly timeLimitTicks: number | null;
  };

  readonly definitions: {
    readonly terrain: readonly (WorldGraphViewText & {
      readonly walkable: boolean;
      readonly buildable: boolean;
      readonly moveCost: number;
    })[];
    readonly scenery: readonly (WorldGraphViewText & {
      readonly footprint: { readonly width: number; readonly height: number };
      readonly allowedRotations: readonly Rotation[];
    })[];
    readonly products: readonly (WorldGraphViewText & {
      readonly unitCostCents: number;
      readonly price: {
        readonly minimumCents: number;
        readonly maximumCents: number;
        readonly defaultCents: number;
      };
    })[];
    readonly guestArchetypes: readonly WorldGraphViewText[];
    readonly meters: readonly WorldGraphViewMeterDefinition[];
    readonly objectives: readonly WorldGraphViewText[];
    readonly incidents: readonly (WorldGraphViewText & {
      readonly kind: IncidentKind;
      readonly severity: IncidentSeverity;
    })[];
  };

  readonly map: {
    readonly id: string;
    readonly nameKey: LocKey;
    readonly descriptionKey: LocKey;
    readonly width: number;
    readonly height: number;
    readonly revision: number;
    readonly terrain: readonly TerrainCell[];
    readonly paths: readonly PathCell[];
    readonly zones: readonly Zone[];
    readonly spawnPoints: readonly Position[];
    readonly exits: readonly Position[];
    readonly scenery: readonly Scenery[];
    readonly buildingCount: number;
    readonly guestCount: number;
    readonly staffCount: number;
  };

  readonly buildOptions: readonly WorldGraphBuildOption[];
  readonly staffOptions: readonly WorldGraphStaffOption[];

  readonly buildings: readonly {
    readonly id: string;
    readonly definitionId: string;
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly rotation: Rotation;
    readonly status: BuildingStatus;
    readonly queue: {
      readonly id: string;
      readonly guestIds: readonly string[];
      readonly serviceStartedAtTick: number | null;
    };
    readonly prices: readonly { readonly productId: string; readonly priceCents: number }[];
    readonly inventory: readonly { readonly productId: string; readonly units: number | null }[];
    readonly cleanliness: number;
    readonly wear: number;
  }[];

  readonly constructionSites: readonly ConstructionSite[];

  readonly guests: readonly {
    readonly id: string;
    readonly archetypeId: string;
    readonly lifecycle: GuestLifecycle;
    readonly x: number;
    readonly y: number;
    readonly cashCents: number;
    readonly intent: GuestIntent;
    readonly needs: readonly WorldGraphViewValue[];
    readonly conditions: readonly WorldGraphViewValue[];
    readonly opinions: readonly WorldGraphViewValue[];
    readonly satisfaction: number;
    readonly patienceCapacityTicks: number;
    readonly patienceRemainingTicks: number;
  }[];

  readonly staff: readonly {
    readonly id: string;
    readonly roleId: string;
    readonly status: StaffStatus;
    readonly x: number;
    readonly y: number;
    readonly assignedZoneId: string | null;
    readonly assignedBuildingId: string | null;
    readonly task: StaffTask | null;
    readonly tasksCompleted: number;
  }[];

  readonly incidents: readonly Incident[];
  readonly objectives: readonly Pick<ObjectiveProgress, "id" | "state" | "value" | "target">[];
  readonly alerts: readonly Pick<Alert, "id" | "type" | "severity" | "titleKey" | "messageKey" | "entityId" | "issuedAtTick">[];
  readonly queuedGuests: number;
}
