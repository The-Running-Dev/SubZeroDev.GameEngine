import type { RngHandle } from "../../../core/determinism/types.js";
import type { StaffTaskType, WorldGraphKindState } from "../state.js";
import type { WorldGraphSystemId } from "./order.js";

/** Disposable storage owned by exactly one atomic tick. */
export interface TickScratch {
  readonly tickRngHandles: Map<WorldGraphSystemId, RngHandle>;
  readonly taskCandidates: TickTaskCandidate[];
  readonly objectiveFailureSnapshot: { state: WorldGraphKindState | null };
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
  return { tickRngHandles: new Map(), taskCandidates: [], objectiveFailureSnapshot: { state: null } };
}
