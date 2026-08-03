import type { AggregateOperation, WorldCondition, WorldGraphCampaign, WorldMetric } from "./content.js";
import type { WorldGraphKindState } from "./state.js";

function aggregate(values: readonly number[], operation: AggregateOperation): number | null {
  if (values.length === 0) return operation === "sum" ? 0 : null;
  if (operation === "sum") return values.reduce((sum, value) => sum + value, 0);
  if (operation === "min") return Math.min(...values);
  if (operation === "max") return Math.max(...values);
  return Math.trunc(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function evaluateMetric(metric: WorldMetric, state: WorldGraphKindState, content: WorldGraphCampaign): number | null {
  switch (metric.kind) {
    case "tick": return state.tick;
    case "day": return Math.floor(state.tick / content.ticksPerDay);
    case "finance": return state.finances[metric.field];
    case "counter": return state.counters[metric.counter];
    case "objective_progress": return state.objectives.find((entry) => entry.id === metric.objectiveId)?.value ?? null;
    case "entity_count": {
      if (metric.entity === "building") return state.buildings.filter((entry) => metric.definitionId === null || entry.definitionId === metric.definitionId).length;
      if (metric.entity === "staff") return state.staff.filter((entry) => metric.definitionId === null || entry.roleId === metric.definitionId).length;
      return state.guests.filter((entry) => metric.definitionId === null || entry.archetypeId === metric.definitionId).length;
    }
    case "guest_meter": {
      const guests = state.guests.filter((guest) => metric.archetypeId === null || guest.archetypeId === metric.archetypeId);
      const values = guests.map((guest) => {
        switch (metric.meter) {
          case "need": return guest.needs[metric.definitionId];
          case "condition": return guest.conditions[metric.definitionId];
          case "opinion": return guest.opinions[metric.definitionId];
          case "preference": return guest.preferences[metric.definitionId];
        }
      }).filter((value): value is number => value !== undefined);
      return aggregate(values, metric.aggregate);
    }
    case "building_metric": {
      const buildings = state.buildings.filter((entry) => metric.buildingDefinitionId === null || entry.definitionId === metric.buildingDefinitionId);
      const values = buildings.map((building) => {
        if (metric.metric === "cleanliness" || metric.metric === "wear") return building[metric.metric];
        if (metric.metric === "queue_length") return building.queue.guestIds.length;
        return metric.productId === null ? undefined : building.inventory[metric.productId] ?? undefined;
      }).filter((value): value is number => value !== undefined);
      return aggregate(values, metric.aggregate);
    }
    case "incident_count": return state.incidents.filter((incident) =>
      (metric.incidentDefinitionId === null || incident.definitionId === metric.incidentDefinitionId)
      && (metric.state === "active" ? incident.resolvedAtTick === null : incident.resolvedAtTick !== null)).length;
  }
}

export function evaluateCondition(condition: WorldCondition, state: WorldGraphKindState, content: WorldGraphCampaign): boolean {
  switch (condition.kind) {
    case "constant": return condition.value;
    case "all": return condition.conditions.every((child) => evaluateCondition(child, state, content));
    case "any": return condition.conditions.some((child) => evaluateCondition(child, state, content));
    case "not": return !evaluateCondition(condition.condition, state, content);
    case "compare": {
      const value = evaluateMetric(condition.metric, state, content);
      if (value === null) return false;
      switch (condition.op) {
        case "eq": return value === condition.value;
        case "ne": return value !== condition.value;
        case "lt": return value < condition.value;
        case "lte": return value <= condition.value;
        case "gt": return value > condition.value;
        case "gte": return value >= condition.value;
      }
    }
    case "objective_state": return state.objectives.some((entry) => entry.id === condition.objectiveId && entry.state === condition.state);
    case "content_unlocked": return state.unlockedContent.some((entry) => entry.kind === condition.content.kind && entry.id === condition.content.id);
    case "policy_active": return state.activePolicyIds.includes(condition.policyId);
    case "incident_active": return state.incidents.some((entry) => entry.definitionId === condition.incidentDefinitionId && entry.resolvedAtTick === null);
  }
}
