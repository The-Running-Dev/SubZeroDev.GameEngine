import type { KindOutcome } from "../../core/kernel/types.js";
import type { WorldGraphKindState } from "./state.js";

/** Exported from the package root (04 §3.2), so the `extends` relationship is stated
 *  here rather than left to structural inference. */
export interface WorldGraphOutcome extends KindOutcome {
  readonly resolution: "objectives_met" | "failed" | null;
  readonly objectivesMet: readonly string[];
  readonly failureId: string | null;
}

export function outcome(state: Pick<WorldGraphKindState, "resolution">): WorldGraphOutcome {
  const terminal = state.resolution;
  return {
    terminal: terminal !== null,
    // `resolution`, not `failureId` — `failureId` is present only on the losing branch,
    // and `terminalId` must be total across a win too (04 §3.2).
    terminalId: terminal?.resolution ?? null,
    resolution: terminal?.resolution ?? null,
    objectivesMet: terminal?.objectiveIds ?? [],
    failureId: terminal?.failureId ?? null,
  };
}

export function resolveStatus(state: Pick<WorldGraphKindState, "resolution">): "active" | "ended" {
  return state.resolution === null ? "active" : "ended";
}
