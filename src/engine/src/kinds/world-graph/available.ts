/**
 * World-graph kind — `availableActions` and `scene` (12-world-graph-kind.md §7).
 *
 * `availableActions` returns the *verbs*, never their parameter domain — enumerating
 * `build` × every definition × every cell × four rotations is combinatorial. The domain is
 * projection's job (§10), and the two must agree about what is blocked.
 */

import type { AvailableAction, KindContext, SceneBody } from "../../core/kernel/types.js";
import type { WorldGraphCampaign } from "./campaign.js";
import type { WorldGraphKindState } from "./state.js";
import { buildBlockers } from "./view.js";

const WORLD_GRAPH_SCENE_KEY = "world-graph.scene.summary";

/**
 * One key per verb. A shared label would render as ten identically-titled buttons in any
 * client that does what §7 says and shows unavailable actions disabled-with-a-reason.
 */
const ACTION_LABEL_KEYS: Readonly<Record<string, string>> = {
  build: "world-graph.action.build",
  demolish: "world-graph.action.demolish",
  hire_staff: "world-graph.action.hire_staff",
  fire_staff: "world-graph.action.fire_staff",
  assign_staff: "world-graph.action.assign_staff",
  set_price: "world-graph.action.set_price",
  open_building: "world-graph.action.open_building",
  close_building: "world-graph.action.close_building",
  dismiss_alert: "world-graph.action.dismiss_alert",
  advance_ticks: "world-graph.action.advance_ticks",
};

function hasRoleCapacity(state: WorldGraphKindState, campaign: WorldGraphCampaign): boolean {
  return campaign.staffRoleDefinitions.some((role) => {
    if (role.maxCount === null) {
      return true;
    }

    const existing = state.staff.filter((member) => member.roleId === role.id).length;
    return existing < role.maxCount;
  });
}

function hasActiveAlerts(alerts: WorldGraphKindState["alerts"]): boolean {
  return alerts.some((alert) => alert.dismissedAtTick === null);
}

function action(id: string, available: boolean, reasonKey?: string): AvailableAction {
  return {
    id,
    labelKey: ACTION_LABEL_KEYS[id] ?? WORLD_GRAPH_SCENE_KEY,
    available,
    ...(available || reasonKey === undefined ? {} : { reasonKey }),
  };
}

/**
 * `build` is available when at least one definition has no placement-independent blocker —
 * the same predicate `buildOptions` publishes, so the verb and the catalogue cannot
 * disagree about which definitions the reducer would accept.
 */
function buildability(
  state: WorldGraphKindState,
  campaign: WorldGraphCampaign,
): { available: boolean; reasonKey?: string } {
  const perDefinition = campaign.buildingDefinitions.map((definition) => buildBlockers(state, definition));
  const buildable = perDefinition.find((blockers) => blockers.length === 0);
  if (buildable !== undefined) {
    return { available: true };
  }

  // Every definition is blocked; report the first definition's first reason rather than an
  // invented one, so the verb's reason is a code the reducer actually returns.
  const firstBlocker = perDefinition.flat()[0];
  return firstBlocker === undefined
    ? { available: false, reasonKey: "world-graph.reason.unknown_entity" }
    : { available: false, reasonKey: `world-graph.reason.${firstBlocker}` };
}

export function availableActions(state: WorldGraphKindState, ctx: KindContext): AvailableAction[] {
  const campaign = ctx.campaign.content as WorldGraphCampaign;
  const build = buildability(state, campaign);
  const hasBuildings = state.buildings.length > 0;
  const hasStaff = state.staff.length > 0;
  const roleCapacity = hasRoleCapacity(state, campaign);
  const priceable = state.buildings.some((building) => building.isOpen && building.products.length > 0);
  const closable = state.buildings.some((building) => building.isOpen);
  const openable = state.buildings.some((building) => !building.isOpen);
  const alerts = hasActiveAlerts(state.alerts);

  return [
    action("build", build.available, build.reasonKey),
    action("demolish", hasBuildings, "world-graph.reason.unknown_entity"),
    action("hire_staff", roleCapacity, "world-graph.reason.staff_limit_reached"),
    action("fire_staff", hasStaff, "world-graph.reason.unknown_entity"),
    action("assign_staff", hasStaff && (hasBuildings || state.map.zones.length > 0), "world-graph.reason.unknown_entity"),
    action("set_price", priceable, "world-graph.reason.building_not_open"),
    action("open_building", openable, "world-graph.reason.unknown_entity"),
    action("close_building", closable, "world-graph.reason.unknown_entity"),
    action("dismiss_alert", alerts, "world-graph.reason.unknown_entity"),
    action("advance_ticks", campaign.maxAdvanceTicksPerAction > 0, "world-graph.reason.tick_limit_reached"),
  ];
}

export function scene(state: WorldGraphKindState): SceneBody {
  const objectives = state.objectives
    .map((objective) => `${objective.id}:${objective.state}`)
    .join(", ");

  return {
    textKey: WORLD_GRAPH_SCENE_KEY,
    text: `Tick ${state.tick} • cash ${(state.finances.cashCents / 100).toFixed(2)} • buildings ${state.buildings.length} • staff ${state.staff.length} • objectives ${objectives}`,
  };
}
