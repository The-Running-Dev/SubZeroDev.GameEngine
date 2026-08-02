/**
 * World-graph kind — terminal outcome projection (12-world-graph-kind.md §8).
 */

import type { ObjectiveProgress } from "./state.js";

export interface WorldGraphOutcome {
  resolution: "objectives_met" | "failed" | null;
  objectivesMet: readonly string[];
  failureId: string | null;
}

function isObjectiveMet(objective: ObjectiveProgress): boolean {
  return objective.state === "met";
}

function isObjectiveFailed(objective: ObjectiveProgress): boolean {
  return objective.state === "failed";
}

export function resolveOutcome(state: { readonly objectives: readonly ObjectiveProgress[] }): WorldGraphOutcome {
  const objectivesMet = state.objectives.filter(isObjectiveMet).map((objective) => objective.id).sort();
  const failureId = state.objectives.find(isObjectiveFailed)?.id ?? null;
  const hasActiveObjective = state.objectives.some((objective) => objective.state === "active");

  if (hasActiveObjective) {
    return {
      resolution: null,
      objectivesMet,
      failureId,
    };
  }

  return {
    resolution: failureId === null ? "objectives_met" : "failed",
    objectivesMet,
    failureId,
  };
}

export function outcome(state: { readonly objectives: readonly ObjectiveProgress[] }): WorldGraphOutcome {
  return resolveOutcome(state);
}

export function resolveStatus(state: { readonly objectives: readonly ObjectiveProgress[] }): "active" | "ended" {
  return resolveOutcome(state).resolution === null ? "active" : "ended";
}
