/**
 * Simulation kind — the engine-owned `AgentStrategy` registry (10-simulation-kind.md §7.10).
 *
 * Contract: `10-simulation-kind.md` §7.10.
 *
 * `AgentStrategy.selectActions` is a function, so it cannot be campaign content — this is the
 * "fixed, in-repository registry of named behaviors, keyed by `id`" §7.10 itself calls for.
 * `ScenarioDefinition.rivals[].strategyId` (`content.ts` §7.8) names one of these; an id that
 * resolves to nothing here is `unknown_rival_strategy` (`validate.ts`, §14).
 *
 * One concrete strategy ships with this unit: `aggressiveStrategy` (`"aggressive"`, the
 * example id §7.10's own prose already uses). It is a pure function of `(view, agent)` — no
 * RNG draw — which is a valid instantiation of "if it draws at all" (§7.10): a rival that
 * never draws still resolves through the same `ResolverTable` as the player (W101.5), and its
 * choices still depend on nothing but its own view and state (W101.6), trivially so with no
 * randomness in the loop. `AgentState.rngSeq` stays at its initial value for every rival this
 * strategy drives — real, present per the contract, structurally ready for a future strategy
 * that does draw, exercised by nothing yet, the same honest-gap status the contract itself
 * gives `PublicWorldState` ("not yet exercised at runtime").
 */

import type { AgentState } from "./state.js";
import type { AgentStrategy } from "./content.js";
import type { GameAction } from "./plan.js";
import type { PublicWorldState } from "./view.js";

/** Applies to the lowest-`jobId` posted opening when unemployed — sorted ascending so the
 *  choice is deterministic and content-order-independent, never construction order. Does
 *  nothing once employed: this strategy has no concept of a better job than the one it has. */
export const aggressiveStrategy: AgentStrategy = {
  id: "aggressive",
  selectActions(view: PublicWorldState, agent: AgentState): GameAction[] {
    if (agent.actor.career.currentEmployment !== undefined) return [];
    const openings = [...view.jobMarket.openings].sort((a, b) => a.jobId.localeCompare(b.jobId, "en-US-POSIX"));
    const target = openings[0];
    if (!target) return [];
    return [{
      id: `agent-${agent.id}-${view.calendar.currentWeek}`,
      type: "apply_for_job",
      actorId: agent.id,
      targetId: target.jobId,
      parameters: {},
    }];
  },
};

export const AGENT_STRATEGIES: Readonly<Record<string, AgentStrategy>> = {
  [aggressiveStrategy.id]: aggressiveStrategy,
};
