/**
 * Simulation kind — `Kind.initialState` (10-simulation-kind.md §3).
 *
 * Contract: `10-simulation-kind.md` §3.
 *
 * `status` is always `"active"` — unlike `story-graph`, where an authored chain can
 * settle straight to an ending before the player ever acts, this kind has no path from
 * `initialState` to a terminal state; every non-`null` `outcome()` value requires at
 * least one `end_week`, and week one has not run yet.
 */

import type { Campaign } from "../../core/registry/types.js";
import type { InitialStateResult } from "../../core/kernel/types.js";
import type { SimulationCampaign } from "./campaign.js";
import type { GoalState, SimulationKindState } from "./state.js";

/**
 * `plan` starts as a real, empty plan for the campaign's own starting week — not `null`.
 * `SimulationKindState.plan`'s type stays nullable per the contract, but nothing in this
 * unit's own pipeline ever produces `null`: `end_week` (`advance.ts`) builds the next
 * week's empty plan itself before returning, so a live game always has a live plan to add
 * actions to.
 *
 * Takes no `KindContext` — nothing here emits an event or draws randomness (week one gets
 * no start-of-week pass; §3's own callout is explicit that it hasn't run yet). A function
 * with fewer parameters than `Kind.initialState` declares still satisfies it
 * structurally, so there is no unused parameter to carry just for the interface match.
 */
/** One `GoalState` per `GoalDefinition` the campaign declares, all `"active"` — the
 *  `goals`/`failure` end-of-week systems (`endOfWeek.ts`) are what moves a goal off this
 *  starting state, never `initialState` itself. */
function startingGoals(goals: SimulationCampaign["goals"]): GoalState[] {
  return goals.map((goal) => ({
    definitionId: goal.id,
    status: "active",
    satisfiedThisWeek: false,
    consecutiveWeeksSatisfied: 0,
    progressNotes: [],
  }));
}

export function initialState(campaign: Campaign): InitialStateResult<SimulationKindState> {
  const content = campaign.content as SimulationCampaign;

  const state: SimulationKindState = {
    calendar: content.startingCalendar,
    player: content.startingPlayer,
    economy: content.startingEconomy,
    world: content.startingWorld,

    activeEffects: [],
    activeOpportunities: [],
    scheduledEvents: [],
    pendingEventResponses: [],

    goals: startingGoals(content.goals),
    plan: { week: content.startingCalendar.currentWeek, actions: [] },
  };

  return { state, status: "active", changes: [], messages: [] };
}
