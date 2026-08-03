import type { LocKey } from "../../core/localization/types.js";
import type { ReasonCode } from "../../core/kernel/reasons.js";
import type { ContentReference } from "./content.js";

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

export interface WorldGraphView {
  readonly tick: number;
  readonly finances: Pick<Finances, "cashCents" | "revenueTodayCents" | "expensesTodayCents">;
  readonly map: {
    readonly width: number; readonly height: number; readonly revision: number;
    readonly spawnPoints: readonly Position[]; readonly exits: readonly Position[];
    readonly zones: readonly string[]; readonly buildingCount: number;
    readonly guestCount: number; readonly staffCount: number;
  };
  readonly buildOptions: readonly {
    readonly definitionId: string; readonly canBuild: boolean; readonly blockedBy: readonly ReasonCode[];
  }[];
  readonly buildings: readonly {
    readonly id: string; readonly definitionId: string; readonly status: BuildingStatus;
    readonly queueLength: number; readonly cleanliness: number; readonly wear: number;
  }[];
  readonly staff: readonly {
    readonly id: string; readonly roleId: string; readonly status: StaffStatus;
    readonly zoneId: string | null; readonly buildingId: string | null;
  }[];
  readonly objectives: readonly Pick<ObjectiveProgress, "id" | "state" | "value" | "target">[];
  readonly alerts: readonly Pick<Alert, "id" | "type" | "severity" | "titleKey" | "messageKey" | "issuedAtTick">[];
  readonly queuedGuests: number;
}
