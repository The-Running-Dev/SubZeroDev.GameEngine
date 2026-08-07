/**
 * Simulation kind — `Kind.advance` (10-simulation-kind.md §4, §5).
 *
 * Contract: `10-simulation-kind.md` §4, §5.
 *
 * `plan.add`/`plan.remove`/`plan.clear` wrap `plan.ts`'s pure reducers; `end_week`
 * resolves every planned action through `RESOLVER_TABLE` (`resolvers.ts`, mostly still
 * stubs — §5's own callout), runs the end-of-week pipeline (`endOfWeek.ts`), then the next
 * week's start-of-week pipeline (`startOfWeek.ts`), and hands the player a fresh, empty
 * plan for the week that just started. `status` becomes `"ended"` when `outcome.ts`'s own
 * read of the resulting state resolves to a non-`null` `resolution` — real now that
 * `goals`/`failure` (`endOfWeek.ts`) are wired, where before nothing in this unit's own
 * logic could end a game.
 *
 * Emits four of §11's eight events directly: `plan.changed` (debug) after any successful
 * `plan.*` action, `action.resolved` (debug) per planned action resolved during `end_week`,
 * and `week.ended` (info) once `end_week`'s own resolution completes — after
 * `runEndOfWeek`/`runStartOfWeek` have each emitted their own (`system.ran`/`effect.expired`
 * from both, `week.started` from `startOfWeek.ts`, `goal.achieved`/`goal.failed` from
 * `endOfWeek.ts`), so the full per-`end_week` stream is emitted in §3's own order.
 */

import type { ActionParams, AdvanceResult, KindContext } from "../../core/kernel/types.js";
import type { StateChange } from "../../core/kernel/reasons.js";
import type { GameAction } from "./plan.js";
import { addAction, removeAction, clearPlan, isActionType } from "./plan.js";
import { RESOLVER_TABLE } from "./resolvers.js";
import { runStartOfWeek } from "./startOfWeek.js";
import { runEndOfWeek } from "./endOfWeek.js";
import { outcome as computeOutcome } from "./outcome.js";
import type { SimulationCampaign } from "./campaign.js";
import type { SimulationKindState } from "./state.js";

const PLAN_CHANGED_EVENT = "kind.simulation.plan.changed";
const ACTION_RESOLVED_EVENT = "kind.simulation.action.resolved";
const WEEK_ENDED_EVENT = "kind.simulation.week.ended";

/** A rejection carries the player-facing message as well as the error (04 §3): `error`
 *  tells the core *that* the action failed, `messages` is what tells the player, and a
 *  client that renders only `messages` must not be handed silence. Same convention as
 *  `story-graph/advance.ts` and `world-graph/actions/common.ts`. */
function rejected(state: SimulationKindState, code: string, messageKey: string): AdvanceResult<SimulationKindState> {
  return {
    state,
    status: "active",
    changes: [],
    messages: [{ key: messageKey, visible: true }],
    error: { code, messageKey },
  };
}

/** Structurally unreachable given this kind's own invariant (`initial.ts`: a live game
 *  always has a live plan) — thrown, the same defensive class as `mustDeserialize`'s own
 *  "can only happen via a foreign state" checks elsewhere in this engine. */
function requirePlan(state: SimulationKindState): NonNullable<SimulationKindState["plan"]> {
  if (state.plan === null) {
    throw new Error("simulation advance: state.plan is null — no unit in this kind ever produces that");
  }
  return state.plan;
}

function buildAction(id: string, params: ActionParams | undefined): GameAction | undefined {
  const actionType = params?.["actionType"];
  if (typeof actionType !== "string" || !isActionType(actionType)) return undefined;

  const targetId = params?.["targetId"];
  const rest: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params ?? {})) {
    if (key === "actionType" || key === "targetId") continue;
    rest[key] = value;
  }

  return {
    id,
    type: actionType,
    actorId: "player",
    ...(typeof targetId === "string" ? { targetId } : {}),
    parameters: rest,
  };
}

export function advance(
  state: SimulationKindState,
  actionId: string,
  params: ActionParams | undefined,
  ctx: KindContext,
): AdvanceResult<SimulationKindState> {
  switch (actionId) {
    case "plan.add": {
      const action = buildAction(`action-${ctx.seq}`, params);
      if (!action) {
        return rejected(state, "unknown_action", "core.reason.unknown_action");
      }
      const plan = addAction(requirePlan(state), action);
      ctx.emit.emit(PLAN_CHANGED_EVENT, "debug", { data: { actionId: "plan.add" } });
      return { state: { ...state, plan }, status: "active", changes: [], messages: [] };
    }

    case "plan.remove": {
      const index = params?.["index"];
      const result = removeAction(requirePlan(state), typeof index === "number" ? index : NaN);
      if (!result.ok || !result.value) {
        const err = result.errors[0]!;
        return rejected(state, err.code, err.messageKey);
      }
      ctx.emit.emit(PLAN_CHANGED_EVENT, "debug", { data: { actionId: "plan.remove" } });
      return { state: { ...state, plan: result.value }, status: "active", changes: [], messages: [] };
    }

    case "plan.clear": {
      const plan = clearPlan(requirePlan(state));
      ctx.emit.emit(PLAN_CHANGED_EVENT, "debug", { data: { actionId: "plan.clear" } });
      return { state: { ...state, plan }, status: "active", changes: [], messages: [] };
    }

    case "end_week": {
      const plan = requirePlan(state);
      let working = state;
      const changes: StateChange[] = [];
      const resolvedEvents: { actionId: string; actionType: string; degree: string }[] = [];

      for (const action of plan.actions) {
        if (action.type === "custom") {
          return rejected(state, "action_not_available", "core.reason.action_not_available");
        }
        const resolver = RESOLVER_TABLE[action.type];
        const validation = resolver.canExecute(working, action, ctx);
        if (!validation.valid) {
          const err = validation.errors[0]!;
          return rejected(state, err.code, err.messageKey);
        }
        const outcome = resolver.calculate(working, action, ctx);
        working = resolver.apply(working, outcome);
        changes.push(...outcome.changes);
        resolvedEvents.push({ actionId: action.id, actionType: action.type, degree: outcome.degree });
      }

      for (const data of resolvedEvents) {
        ctx.emit.emit(ACTION_RESOLVED_EVENT, "debug", { data });
      }

      const content = ctx.campaign.content as SimulationCampaign;
      const endOfWeekResult = runEndOfWeek(working, ctx.emit, content.goals, content.goalFailurePrecedence);
      ctx.emit.emit(WEEK_ENDED_EVENT, "info", { data: { week: working.calendar.currentWeek } });

      const nextWeek = runStartOfWeek(endOfWeekResult.state, ctx.emit);
      const finalState: SimulationKindState = {
        ...nextWeek,
        plan: { week: nextWeek.calendar.currentWeek, actions: [] },
      };

      const result = computeOutcome(finalState);

      return {
        state: finalState,
        status: result.resolution === null ? "active" : "ended",
        changes: [...changes, ...endOfWeekResult.changes],
        messages: [],
      };
    }

    default:
      return rejected(state, "unknown_action", "core.reason.unknown_action");
  }
}
