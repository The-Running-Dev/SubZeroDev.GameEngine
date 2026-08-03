import type { AvailableAction, KindContext, SceneBody } from "../../core/kernel/types.js";
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

function action(id: string, available: boolean, reasonKey?: string): AvailableAction {
  return { id, labelKey: labels[id] ?? "world-graph.scene.summary", available, ...(available || reasonKey === undefined ? {} : { reasonKey }) };
}

export function availableActions(state: WorldGraphKindState, ctx: KindContext): AvailableAction[] {
  const content = worldGraphContent(ctx.campaign.content);
  const scenario = content.scenarios.find((entry) => entry.id === content.startScenarioId);
  if (!scenario) throw new Error(`Validated world-graph scenario missing: ${content.startScenarioId}`);
  const buildReasons = content.buildings.map((definition) => buildBlockers(state, definition, scenario));
  const buildable = buildReasons.some((entry) => entry.length === 0);
  const firstBuildReason = buildReasons.flat()[0] ?? "unknown_entity";
  const hasBuildings = state.buildings.length > 0;
  const hasStaff = state.staff.length > 0;
  const hireable = content.staffRoles.some((role) => {
    const limit = scenario.staffLimits.find((entry) => entry.definitionId === role.id)?.maximum;
    return role.hireCostCents <= state.finances.cashCents && (limit === undefined || state.staff.filter((entry) => entry.roleId === role.id).length < limit);
  });
  const priceable = state.buildings.some((building) => building.status === "open" && content.buildings.find((entry) => entry.id === building.definitionId)?.operation.kind === "service");
  return [
    action("build", buildable, `world-graph.reason.${firstBuildReason}`),
    action("demolish", hasBuildings, "world-graph.reason.unknown_entity"),
    action("hire_staff", hireable, "world-graph.reason.staff_limit_reached"),
    action("fire_staff", hasStaff, "world-graph.reason.unknown_entity"),
    action("assign_staff", hasStaff, "world-graph.reason.unknown_entity"),
    action("set_price", priceable, "world-graph.reason.building_not_open"),
    action("open_building", state.buildings.some((entry) => entry.status === "closed"), "world-graph.reason.unknown_entity"),
    action("close_building", state.buildings.some((entry) => entry.status === "open"), "world-graph.reason.unknown_entity"),
    action("dismiss_alert", state.alerts.some((entry) => entry.dismissedAtTick === null && entry.clearedAtTick === null), "world-graph.reason.unknown_entity"),
    action("advance_ticks", false, "core.reason.action_not_available"),
  ];
}

export function scene(state: WorldGraphKindState): SceneBody {
  return {
    textKey: "world-graph.scene.summary",
    text: `Tick ${state.tick} • cash ${(state.finances.cashCents / 100).toFixed(2)} • guests ${state.guests.length} • buildings ${state.buildings.length} • objectives ${state.objectives.map((entry) => `${entry.id}:${entry.value}/${entry.target}`).join(", ")}`,
  };
}
