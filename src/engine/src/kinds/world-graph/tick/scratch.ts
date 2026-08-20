import type { RngHandle } from "../../../core/determinism/types.js";
import type { StaffTaskType, WorldGraphKindState } from "../state.js";
import type { WorldGraphSystemId } from "./order.js";

/** Systems 1, 4, and 11 defer their building-meter effects here (20-contract.md §9, §4.13); system 14 composes them. */
export type DeferredBuildingMeterSource = "service" | "staff" | "policy";

export interface DeferredBuildingMeterDelta {
  readonly source: DeferredBuildingMeterSource;
  readonly buildingId: string;
  readonly meter: "cleanliness" | "wear";
  readonly delta: number;
}

/** Disposable storage owned by exactly one atomic tick. */
export interface TickScratch {
  readonly tickRngHandles: Map<WorldGraphSystemId, RngHandle>;
  readonly taskCandidates: TickTaskCandidate[];
  readonly objectiveFailureSnapshot: { state: WorldGraphKindState | null };
  readonly deferredBuildingMeterDeltas: DeferredBuildingMeterDelta[];
}

export interface TickTaskCandidate {
  readonly type: StaffTaskType;
  readonly priority: number;
  readonly effort: number | null;
  readonly buildingId: string | null;
  readonly incidentId: string | null;
  readonly constructionSiteId: string | null;
  readonly productId: string | null;
  readonly requiredRoleId: string | null;
  readonly slot: number;
}

export function createTickScratch(): TickScratch {
  return {
    tickRngHandles: new Map(), taskCandidates: [],
    objectiveFailureSnapshot: { state: null }, deferredBuildingMeterDeltas: [],
  };
}
