import type { WorldGraphKindState } from "./state.js";

export interface WorldGraphOutcome {
  readonly resolution: "objectives_met" | "failed" | null;
  readonly objectivesMet: readonly string[];
  readonly failureId: string | null;
}

export function outcome(state: Pick<WorldGraphKindState, "resolution">): WorldGraphOutcome {
  return {
    resolution: state.resolution?.resolution ?? null,
    objectivesMet: state.resolution?.objectiveIds ?? [],
    failureId: state.resolution?.failureId ?? null,
  };
}

export function resolveStatus(state: Pick<WorldGraphKindState, "resolution">): "active" | "ended" {
  return state.resolution === null ? "active" : "ended";
}
