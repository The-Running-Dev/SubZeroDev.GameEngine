import type { AdvanceResult, KindContext } from "../../../core/kernel/types.js";
import type { WorldGraphKindState } from "../state.js";
import { WORLD_GRAPH_EVENTS } from "../events.js";
import { accepted, change, emit, params, rejected, stringParam } from "./common.js";

export function dismissAlert(state: WorldGraphKindState, raw: Parameters<typeof params>[0], ctx: KindContext): AdvanceResult<WorldGraphKindState> {
  const values = params(raw);
  const alertId = values ? stringParam(values, "alertId") : null;
  if (alertId === null) return rejected(state, "core.reason.unknown_action");
  const alert = state.alerts.find((entry) => entry.id === alertId);
  if (!alert) return rejected(state, "unknown_entity");
  if (alert.dismissedAtTick !== null || alert.clearedAtTick !== null) return accepted(state, []);
  const next = { ...state, alerts: state.alerts.map((entry) => entry.id === alertId ? { ...entry, dismissedAtTick: state.tick } : entry) };
  emit(ctx, WORLD_GRAPH_EVENTS.alertDismissed, { alertId });
  return accepted(next, [change(`alerts.${alertId}.dismissedAtTick`, state.tick, "alert_dismissed", false)]);
}
