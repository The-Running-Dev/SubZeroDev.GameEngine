import type { AdvanceResult, KindContext } from "../../../core/kernel/types.js";
import type { StateChange } from "../../../core/kernel/reasons.js";
import { worldGraphContent } from "../content.js";
import type { WorldGraphKindState } from "../state.js";
import { accepted, change, emit, optionalStringParam, params, rejected, spend, stringParam } from "./common.js";

export function hireStaff(state: WorldGraphKindState, raw: Parameters<typeof params>[0], ctx: KindContext): AdvanceResult<WorldGraphKindState> {
  const values = params(raw);
  const definitionId = values ? stringParam(values, "definitionId") : null;
  if (definitionId === null) return rejected(state, "core.reason.unknown_action");
  const content = worldGraphContent(ctx.campaign.content);
  const definition = content.staffRoles.find((entry) => entry.id === definitionId);
  if (!definition) return rejected(state, "unknown_entity");
  const scenario = content.scenarios.find((entry) => entry.id === content.startScenarioId);
  if (!scenario) throw new Error(`Validated world-graph scenario missing: ${content.startScenarioId}`);
  const limit = scenario.staffLimits.find((entry) => entry.definitionId === definitionId)?.maximum;
  if (limit !== undefined && state.staff.filter((entry) => entry.roleId === definitionId).length >= limit) return rejected(state, "staff_limit_reached");
  if (definition.hireCostCents > state.finances.cashCents) return rejected(state, "insufficient_funds");
  const exit = state.map.exits[0];
  if (!exit) throw new Error("Validated world-graph map has no exit");
  const staffId = `staff:${state.nextEntityOrdinal}`;
  const finances = spend(state, definition.hireCostCents);
  const next: WorldGraphKindState = {
    ...state,
    finances,
    nextEntityOrdinal: state.nextEntityOrdinal + 1,
    staff: [...state.staff, {
      id: staffId, roleId: definitionId, x: exit.x, y: exit.y, status: "idle",
      path: [], pathIndex: 0, moveProgressTicks: 0,
      assignedBuildingId: null, assignedZoneId: null, drawCount: 0, task: null, tasksCompleted: 0,
    }],
  };
  emit(ctx, "staff.hired", "info", { staffId, definitionId });
  return accepted(next, [
    change("finances.cashCents", finances.cashCents, "staff_hired", true, state.finances.cashCents),
    change(`staff.${staffId}.exists`, true, "staff_hired", false),
  ]);
}

export function fireStaff(state: WorldGraphKindState, raw: Parameters<typeof params>[0], ctx: KindContext): AdvanceResult<WorldGraphKindState> {
  const values = params(raw);
  const staffId = values ? stringParam(values, "staffId") : null;
  if (staffId === null) return rejected(state, "core.reason.unknown_action");
  if (!state.staff.some((entry) => entry.id === staffId)) return rejected(state, "unknown_entity");
  const next = { ...state, staff: state.staff.filter((entry) => entry.id !== staffId) };
  emit(ctx, "staff.fired", "debug", { staffId });
  return accepted(next, [change(`staff.${staffId}.exists`, false, "staff_fired", false, true)]);
}

export function assignStaff(state: WorldGraphKindState, raw: Parameters<typeof params>[0], ctx: KindContext): AdvanceResult<WorldGraphKindState> {
  const values = params(raw);
  if (!values) return rejected(state, "core.reason.unknown_action");
  const staffId = stringParam(values, "staffId");
  const buildingParam = optionalStringParam(values, "buildingId");
  const zoneParam = optionalStringParam(values, "zoneId");
  if (staffId === null || buildingParam === null || zoneParam === null) return rejected(state, "core.reason.unknown_action");
  const target = state.staff.find((entry) => entry.id === staffId);
  if (!target) return rejected(state, "unknown_entity");
  const buildingId = buildingParam ?? null;
  const zoneId = zoneParam ?? null;
  if (buildingId !== null && !state.buildings.some((entry) => entry.id === buildingId)) return rejected(state, "unknown_entity");
  if (zoneId !== null && !state.map.zones.some((entry) => entry.id === zoneId)) return rejected(state, "unknown_entity");
  const buildingChanged = target.assignedBuildingId !== buildingId;
  const zoneChanged = target.assignedZoneId !== zoneId;
  if (!buildingChanged && !zoneChanged && target.task === null) return accepted(state, []);
  const next = {
    ...state,
    staff: state.staff.map((entry) => entry.id === staffId ? {
      ...entry, assignedBuildingId: buildingId, assignedZoneId: zoneId,
      status: "idle" as const, task: null, path: [], pathIndex: 0, moveProgressTicks: 0,
    } : entry),
  };
  emit(ctx, "staff.assigned", "trace", { staffId, ...(buildingId === null ? {} : { buildingId }), ...(zoneId === null ? {} : { zoneId }) });
  const changes: StateChange[] = [];
  if (buildingChanged) changes.push(change(`staff.${staffId}.assignedBuildingId`, buildingId ?? "", "staff_assigned", false, target.assignedBuildingId ?? ""));
  if (zoneChanged) changes.push(change(`staff.${staffId}.assignedZoneId`, zoneId ?? "", "staff_assigned", false, target.assignedZoneId ?? ""));
  return accepted(next, changes);
}
