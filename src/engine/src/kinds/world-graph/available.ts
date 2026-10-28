import type { AvailableAction, ProjectionContext, SceneBody } from "../../core/kernel/types.js";
import { buildBlockers } from "./actions/build.js";
import { worldGraphContent } from "./content.js";
import type { WorldGraphKindState } from "./state.js";

const labels: Readonly<Record<string, string>> = {
  build: "world-graph.action.build", demolish: "world-graph.action.demolish",
  hire_staff: "world-graph.action.hire_staff", fire_staff: "world-graph.action.fire_staff",
  assign_staff: "world-graph.action.assign_staff", set_price: "world-graph.action.set_price",
  open_building: "world-graph.action.open_building", close_building: "world-graph.action.close_building",
  dismiss_alert: "world-graph.action.dismiss_alert", advance_ticks: "world-graph.action.advance_ticks",
};

function action(ctx: ProjectionContext, id: string, available: boolean, reasonKey?: string): AvailableAction {
  return { id, labelKey: ctx.engineRef(labels[id] ?? "world-graph.scene.summary"), available, ...(available || reasonKey === undefined ? {} : { reasonKey }) };
}

export function availableActions(state: WorldGraphKindState, ctx: ProjectionContext): AvailableAction[] {
  const reason = (code: string): string => ctx.engineRef(`world-graph.reason.${code}`);
  const content = worldGraphContent(ctx.campaign.content);
  const scenario = content.scenarios.find((entry) => entry.id === content.startScenarioId);
  if (!scenario) throw new Error(`Validated world-graph scenario missing: ${content.startScenarioId}`);
  const buildReasons = content.buildings.map((definition) => buildBlockers(state, definition, scenario));
  const buildable = buildReasons.some((entry) => entry.length === 0);
  const firstBuildReason = buildReasons.flat()[0] ?? "unknown_entity";
  const hasBuildings = state.buildings.length > 0;
  const hasStaff = state.staff.length > 0;
  const affordableRoleExists = content.staffRoles.some((role) => {
    const limit = scenario.staffLimits.find((entry) => entry.definitionId === role.id)?.maximum;
    return (limit === undefined || state.staff.filter((entry) => entry.roleId === role.id).length < limit) && role.hireCostCents <= state.finances.cashCents;
  });
  const roleBelowLimitExists = content.staffRoles.some((role) => {
    const limit = scenario.staffLimits.find((entry) => entry.definitionId === role.id)?.maximum;
    return limit === undefined || state.staff.filter((entry) => entry.roleId === role.id).length < limit;
  });
  const priceable = state.buildings.some((building) => {
    const definition = content.buildings.find((entry) => entry.id === building.definitionId);
    return building.status === "open" && definition?.operation.kind === "service" && definition.operation.products.length > 0;
  });
  return [
    action(ctx, "build", buildable, reason(firstBuildReason)),
    action(ctx, "demolish", hasBuildings, reason("unknown_entity")),
    action(ctx, "hire_staff", affordableRoleExists, reason(roleBelowLimitExists ? "insufficient_funds" : "staff_limit_reached")),
    action(ctx, "fire_staff", hasStaff, reason("unknown_entity")),
    action(ctx, "assign_staff", hasStaff, reason("unknown_entity")),
    action(ctx, "set_price", priceable, reason("building_not_open")),
    action(ctx, "open_building", state.buildings.some((entry) => entry.status === "closed"), reason("unknown_entity")),
    action(ctx, "close_building", state.buildings.some((entry) => entry.status === "open"), reason("unknown_entity")),
    action(ctx, "dismiss_alert", state.alerts.some((entry) => entry.dismissedAtTick === null && entry.clearedAtTick === null), reason("unknown_entity")),
    action(ctx, "advance_ticks", true),
  ];
}

export function scene(state: WorldGraphKindState, ctx: ProjectionContext): SceneBody {
  return {
    textKey: ctx.engineRef("world-graph.scene.summary"),
    text: `Tick ${state.tick} • cash ${(state.finances.cashCents / 100).toFixed(2)} • guests ${state.guests.length} • buildings ${state.buildings.length} • objectives ${state.objectives.map((entry) => `${entry.id}:${entry.value}/${entry.target}`).join(", ")}`,
  };
}
