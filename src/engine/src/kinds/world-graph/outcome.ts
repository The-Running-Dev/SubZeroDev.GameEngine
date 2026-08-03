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

  // Failure is immediate and does not wait for the rest of the board to settle. A run that
  // has already failed but reports `resolution: null` is an active game carrying a
  // non-null `failureId` — a state the player can keep acting in after losing.
  if (failureId !== null) {
    return {
      resolution: "failed",
      objectivesMet,
      failureId,
    };
  }

  // A resolution requires at least one objective (12 §8). Reading "none active" as a win
  // would make an objective-less campaign `ended` before the player saw a tick; such a
  // campaign is a sandbox, and validation warns about it at Tier 2 instead.
  if (state.objectives.length === 0 || hasActiveObjective) {
    return {
      resolution: null,
      objectivesMet,
      failureId,
    };
  }

  return {
    resolution: "objectives_met",
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
