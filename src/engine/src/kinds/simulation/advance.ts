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
 * Two seams reconciliation (2026-08-08) wired here, both specified and neither previously
 * connected: each resolver's `ActionOutcome.messages` (§5.3) now reaches
 * `AdvanceResult.messages` instead of being dropped, and §6.2's automatic
 * `counters[change.reason]` fold now runs over every emitted `StateChange`. See
 * `foldCounters` below for the timing boundary the contract leaves open.
 *
 * Emits four of §11's eight events directly: `plan.changed` (debug) after any successful
 * `plan.*` action, `action.resolved` (debug) per planned action resolved during `end_week`,
 * and `week.ended` (info) once `end_week`'s own resolution completes — after
 * `runEndOfWeek`/`runStartOfWeek` have each emitted their own (`system.ran`/`effect.expired`
 * from both, `week.started` from `startOfWeek.ts`, `goal.achieved`/`goal.failed` from
 * `endOfWeek.ts`), so the full per-`end_week` stream is emitted in §3's own order.
 */

import type { ActionParams, AdvanceResult, KindContext } from "../../core/kernel/types.js";
import type { OutcomeMessage, StateChange } from "../../core/kernel/reasons.js";
import { SIMULATION_EVENTS } from "./events.js";
import type { GameAction } from "./plan.js";
import { addAction, removeAction, clearPlan, isActionType } from "./plan.js";
import { RESOLVER_TABLE } from "./resolvers.js";
import { runStartOfWeek } from "./startOfWeek.js";
import { runEndOfWeek } from "./endOfWeek.js";
import { outcome as computeOutcome } from "./outcome.js";
import type { SimulationCampaign } from "./campaign.js";
import type { SimulationKindState } from "./state.js";
import { unaddressedPendingResponses } from "./state.js";

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

/**
 * §6.2's **automatic** half of `counters`: one increment of `counters[change.reason]` per
 * emitted `StateChange`. The reason-code vocabulary is already a taxonomy of things that
 * happen, so "times evicted" and "checks failed" come free rather than needing a bespoke
 * counter each. The explicit half — a `"counter"`-type `Reward` (§7.1) — is separate and
 * unwired.
 *
 * Folding produces **no `StateChange` of its own**, deliberately: a counter that audited
 * itself would count its own audit record, and every emitted change would then emit
 * another. The count is bookkeeping *about* the audit trail, not part of it.
 *
 * Rebuilt in sorted key order per §2's sorted-iteration rule. `canonicalStringify` already
 * sorts keys, so this cannot change `serialize()` output — it is here because §2 states the
 * rule over `counters` (§6.2 calls it "the newest and the easiest to forget"), and a reader
 * should not have to know the serializer's behaviour to see the rule being kept.
 */
function foldCounters(state: SimulationKindState, changes: readonly StateChange[]): SimulationKindState {
  if (changes.length === 0) return state;

  const tallied: Record<string, number> = { ...state.player.counters };
  for (const change of changes) {
    tallied[change.reason] = (tallied[change.reason] ?? 0) + 1;
  }

  const counters: Record<string, number> = {};
  for (const key of Object.keys(tallied).sort()) counters[key] = tallied[key]!;

  return { ...state, player: { ...state.player, counters } };
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
      if (action.type !== "respond_to_event" && unaddressedPendingResponses(state).length > 0) {
        return rejected(state, "event_response_pending", "simulation.reason.event_response_pending");
      }
      const plan = addAction(requirePlan(state), action);
      ctx.emit.emit(SIMULATION_EVENTS.planChanged.name, SIMULATION_EVENTS.planChanged.severity, { data: { actionId: "plan.add" } });
      return { state: { ...state, plan }, status: "active", changes: [], messages: [] };
    }

    case "plan.remove": {
      const index = params?.["index"];
      const result = removeAction(requirePlan(state), typeof index === "number" ? index : NaN);
      if (!result.ok || !result.value) {
        const err = result.errors[0]!;
        return rejected(state, err.code, err.messageKey);
      }
      ctx.emit.emit(SIMULATION_EVENTS.planChanged.name, SIMULATION_EVENTS.planChanged.severity, { data: { actionId: "plan.remove" } });
      return { state: { ...state, plan: result.value }, status: "active", changes: [], messages: [] };
    }

    case "plan.clear": {
      const plan = clearPlan(requirePlan(state));
      ctx.emit.emit(SIMULATION_EVENTS.planChanged.name, SIMULATION_EVENTS.planChanged.severity, { data: { actionId: "plan.clear" } });
      return { state: { ...state, plan }, status: "active", changes: [], messages: [] };
    }

    case "end_week": {
      if (unaddressedPendingResponses(state).length > 0) {
        return rejected(state, "event_response_pending", "simulation.reason.event_response_pending");
      }
      const plan = requirePlan(state);
      const content = ctx.campaign.content as SimulationCampaign;
      if (plan.actions.length === 0 && content.emptyPlanPolicy === "forbid") {
        return rejected(state, "plan_empty", "simulation.reason.plan_empty");
      }
      let working = state;
      const changes: StateChange[] = [];
      const messages: OutcomeMessage[] = [];
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
        // §5.3 declares `ActionOutcome.messages` and 04 §12 makes it the player-facing
        // channel; every resolver returns `[]` today, so this collects nothing yet. It is
        // wired anyway because the alternative is that the first resolver to produce a
        // message loses it silently, with the drop three files away from the symptom.
        messages.push(...outcome.messages);
        resolvedEvents.push({ actionId: action.id, actionType: action.type, degree: outcome.degree });
      }

      for (const data of resolvedEvents) {
        ctx.emit.emit(SIMULATION_EVENTS.actionResolved.name, SIMULATION_EVENTS.actionResolved.severity, { data });
      }

      // Folded before the end-of-week pass, not after it, so a `goals`/`failure`/
      // `achievements` condition reading `player.counters.<reason>` sees what the player
      // actually did *this* week. §6.2 fixes the rule and not its timing; the boundary this
      // draws is that an end-of-week system's own changes are counted after the pass
      // (below) and so are not readable within it. Recorded in `90-decisions.md`.
      working = foldCounters(working, changes);

      // `content.items` joins `jobs`/`courses` as a plain parameter (W56) — `endOfWeek.ts`'s
      // `inventory` system needs `ItemDefinition` for decay and effect sync, the same way
      // `employment` needed `jobs` and `education` needed `courses`.
      //
      // W57's four systems need four more collections, the scenario's own `weekLimit`, and —
      // uniquely among the end-of-week systems — randomness. They arrive in one `world`
      // object rather than six more positional parameters. The stream is
      // `{ kind: "system", system: "end_of_week", seq }` via `ctx.derive` (04 §3.1): the
      // week's draws must not share `ctx.rng`, which is the *action* stream this same
      // `end_week` already spent on resolvers, or adding a planned action would silently
      // reroll the week's events. `seq` keeps successive weeks on different streams.
      const scenario = content.scenarios.find((s) => s.id === content.scenarioId);
      const endOfWeekResult = runEndOfWeek(
        working, ctx.emit, content.goals, content.goalFailurePrecedence,
        content.jobs, content.courses, content.items,
        {
          events: content.events,
          opportunities: content.opportunities,
          headlines: content.headlines,
          achievements: content.achievements,
          ...(scenario?.weekLimit !== undefined ? { weekLimit: scenario.weekLimit } : {}),
          ...(content.relationshipDrift !== undefined ? { relationshipDrift: content.relationshipDrift } : {}),
          ...(content.attendanceTracking !== undefined ? { attendanceTracking: content.attendanceTracking } : {}),
          rng: ctx.derive({ kind: "system", system: "end_of_week", seq: ctx.seq }),
        },
      );
      // An `EventOutcome`'s authored `messages` (§7.6) join the resolvers' own on the one
      // player-facing channel (04 §12) — the end-of-week pass is the only place they can
      // enter, and dropping them meant authored event text reached nobody.
      messages.push(...endOfWeekResult.messages);
      ctx.emit.emit(SIMULATION_EVENTS.weekEnded.name, SIMULATION_EVENTS.weekEnded.severity, { data: { week: working.calendar.currentWeek } });

      const counted = foldCounters(endOfWeekResult.state, endOfWeekResult.changes);
      const nextWeek = runStartOfWeek(counted, ctx.emit, content.courses);
      const finalState: SimulationKindState = {
        ...nextWeek,
        plan: { week: nextWeek.calendar.currentWeek, actions: [] },
      };

      const result = computeOutcome(finalState);

      return {
        state: finalState,
        status: result.resolution === null ? "active" : "ended",
        changes: [...changes, ...endOfWeekResult.changes],
        messages,
      };
    }

    default:
      return rejected(state, "unknown_action", "core.reason.unknown_action");
  }
}
