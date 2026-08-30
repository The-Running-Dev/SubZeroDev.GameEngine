import type { ActionParams, AdvanceResult, KindContext } from "../../../core/kernel/types.js";
import { worldGraphContent } from "../content.js";
import type { WorldGraphKindState } from "../state.js";
import { WORLD_GRAPH_EVENTS } from "../events.js";
import { integerParam, params, rejected } from "../actions/common.js";
import { resolveStatus } from "../outcome.js";
import { BatchChanges, runWorldGraphTick } from "./pipeline.js";

export function advanceTicks(state: WorldGraphKindState, raw: ActionParams | undefined, ctx: KindContext): AdvanceResult<WorldGraphKindState> {
  const values = params(raw); const ticks = values ? integerParam(values, "ticks") : null;
  if (ticks === null) return rejected(state, "core.reason.unknown_action");
  if (ticks < 1) return rejected(state, "ticks_not_positive");
  const content = worldGraphContent(ctx.campaign.content);
  if (ticks > content.maxTicksPerAction) return rejected(state, "tick_limit_reached");
  const changes = new BatchChanges(); let next = state; let processedTicks = 0;
  ctx.emit.emit(WORLD_GRAPH_EVENTS.batchStarted.name, WORLD_GRAPH_EVENTS.batchStarted.severity, { data: { requestedTicks: ticks, startingTick: state.tick } });
  while (processedTicks < ticks && next.resolution === null) { next = runWorldGraphTick(next, content, ctx, changes); processedTicks += 1; }
  ctx.emit.emit(WORLD_GRAPH_EVENTS.batchEnded.name, WORLD_GRAPH_EVENTS.batchEnded.severity, { data: { requestedTicks: ticks, processedTicks, finalTick: next.tick } });
  return { state: next, status: resolveStatus(next), changes: changes.finish(), messages: [] };
}
