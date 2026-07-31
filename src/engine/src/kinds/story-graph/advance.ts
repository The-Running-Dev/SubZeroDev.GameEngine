/**
 * Story-graph kind — `Kind.advance` (`submitChoice → settle`, 03 §8.2).
 *
 * Contract: `03-story-graph-kind.md` §8.2, §8.3.
 *
 * No `TODO.md` unit ever names `submitChoice`/`advance` as its own scope line — it has
 * always been implicit assembly across W9 (consequences), W10 (conditions), W11
 * (settle/turn), and this unit, which is the first whose own done-criteria requires
 * actually submitting an action. See `plans/19-w12-scene-actions-projection-reasons.md`,
 * Decision 1.
 */

import type { ActionParams, AdvanceResult, KindContext } from "../../core/kernel/types.js";
import { applyConsequences } from "./variables.js";
import { requireNode } from "./nodes.js";
import { enterAndEmit, settle } from "./settle.js";
import { evaluateStoryGraphCondition, toConditionContext } from "./conditions.js";
import type { StoryGraphCampaign } from "./campaign.js";
import type { StoryGraphKindState } from "./state.js";

function rejected(state: StoryGraphKindState, code: string, messageKey: string): AdvanceResult<StoryGraphKindState> {
  return { state, status: "active", changes: [], messages: [], error: { code, messageKey } };
}

/**
 * `not_a_choice_node`/`unexpected_params` reject with `state` unchanged — nothing has
 * mutated yet when either check runs, unlike `settle`'s `settle_guard_tripped`, which
 * throws precisely because state *has* already changed by the time it can trip (plan 18,
 * Decision 3). A hidden (`showWhen`-failing) choice and a genuinely unknown id both
 * return `unknown_action` — 03 §8.3's own callout: deliberately indistinguishable, the
 * one thing `showWhen` is for.
 */
export function advance(
  state: StoryGraphKindState,
  actionId: string,
  params: ActionParams | undefined,
  ctx: KindContext,
): AdvanceResult<StoryGraphKindState> {
  const content = ctx.campaign.content as StoryGraphCampaign;

  if (params !== undefined && Object.keys(params).length > 0) {
    return rejected(state, "unexpected_params", "story-graph.reason.unexpected_params");
  }

  const node = requireNode(content.nodes, state.currentNodeId);
  if (node.kind !== "choice") {
    return rejected(state, "not_a_choice_node", "story-graph.reason.not_a_choice_node");
  }

  const context = toConditionContext(state);
  const choice = node.choices.find((c) => c.id === actionId);
  const visible = choice !== undefined && (!choice.showWhen || evaluateStoryGraphCondition(choice.showWhen, context));
  if (!visible) {
    return rejected(state, "unknown_action", "core.reason.unknown_action");
  }

  if (choice.requirements && !evaluateStoryGraphCondition(choice.requirements, context)) {
    return rejected(state, "requirement_unmet", choice.requirementFailKey ?? "core.reason.requirement_unmet");
  }

  const applied = applyConsequences(content.variables, state.variables, choice.effects ?? []);
  const transitioned = enterAndEmit(
    content.nodes,
    { ...state, variables: applied.variables, turn: state.turn + 1 },
    choice.goto,
    ctx.emit,
  );
  const settled = settle(content.nodes, content.variables, transitioned, ctx.rng, ctx.emit);

  return {
    state: settled.state,
    status: settled.status,
    changes: [...applied.changes, ...settled.changes],
    messages: [],
  };
}
