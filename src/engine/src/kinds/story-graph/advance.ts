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
import type { Condition } from "../../core/condition/types.js";
import type { ResolutionEmitter } from "../../core/observability/types.js";
import { applyConsequences } from "./variables.js";
import { requireNode } from "./nodes.js";
import { enterAndEmit, settle } from "./settle.js";
import { evaluateStoryGraphCondition, toConditionContext, type ConditionContext } from "./conditions.js";
import { evaluateAchievements } from "./achievements.js";
import type { StoryGraphCampaign } from "./campaign.js";
import type { StoryGraphKindState } from "./state.js";

function rejected(
  state: StoryGraphKindState,
  code: string,
  messageKey: string,
  reject?: { choiceId: string; emit: ResolutionEmitter },
): AdvanceResult<StoryGraphKindState> {
  if (reject) {
    reject.emit.emit("kind.story-graph.choice.rejected", "info", { reason: code, data: { choiceId: reject.choiceId } });
  }
  return { state, status: "active", changes: [], messages: [{ key: messageKey, visible: true }], error: { code, messageKey } };
}

/**
 * Walks `condition`'s leaves (comparisons, `exists`, `count`), evaluating and emitting
 * `requirement.evaluated` once per leaf rather than once for the whole tree — a compound
 * `all`/`any`/`not` is a combinator, not itself a requirement (03 §8.4).
 *
 * `all`/`any` **short-circuit exactly as `evaluateCondition` does**, so this walk decides
 * the same trees the same way `showWhen` and `availableActions` (`scene.ts`) decide them.
 * That parity is load-bearing rather than incidental: `compare` throws on a type-mismatched
 * operand, so the guard-then-typed-compare idiom (`all: [x is set, x > 3]`) only stays a
 * clean `requirement_unmet` rejection while the guard can stop the walk. Evaluating every
 * leaf eagerly would buy one extra `trace` event and turn that rejection into a thrown
 * engine error on a campaign `availableActions` had already greyed out. §8.4 asks these
 * events to say which clause failed, and under `all` the short-circuit lands on exactly
 * that clause.
 *
 * `negated` carries the parity of the enclosing `not`s, so a leaf reports its *effective*
 * contribution rather than its raw result. `not: { achieved.bribed == true }` against a
 * player who holds it is a requirement that failed; reporting `satisfied: true` because
 * the leaf alone was true tells the author the opposite of what happened, and it is the
 * only event that requirement produces. Only the emitted value is negated — the returned
 * one stays raw, so the tree decides exactly as it did before. Under `not: { all: [...] }`
 * De Morgan makes per-leaf negation a parity convention rather than a truth; emitting once
 * for the whole `not` subtree instead would always be truthful but drops the
 * one-event-per-leaf property §8.4 leans on, so parity is the deliberate trade (PR #362
 * review).
 */
function evaluateRequirements(
  condition: Condition,
  context: ConditionContext,
  choiceId: string,
  emit: ResolutionEmitter,
  negated: boolean,
): boolean {
  if ("all" in condition) {
    for (const c of condition.all) {
      if (!evaluateRequirements(c, context, choiceId, emit, negated)) return false;
    }
    return true;
  }
  if ("any" in condition) {
    for (const c of condition.any) {
      if (evaluateRequirements(c, context, choiceId, emit, negated)) return true;
    }
    return false;
  }
  if ("not" in condition) {
    return !evaluateRequirements(condition.not, context, choiceId, emit, !negated);
  }

  const satisfied = evaluateStoryGraphCondition(condition, context);
  emit.emit("kind.story-graph.requirement.evaluated", "trace", {
    data: { choiceId, satisfied: negated ? !satisfied : satisfied },
  });
  return satisfied;
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

  ctx.emit.emit("kind.story-graph.choice.submitted", "debug", { data: { nodeId: node.id, choiceId: actionId } });

  const context = toConditionContext(state);
  const choice = node.choices.find((c) => c.id === actionId);
  const visible = choice !== undefined && (!choice.showWhen || evaluateStoryGraphCondition(choice.showWhen, context));
  if (!visible) {
    return rejected(state, "unknown_action", "core.reason.unknown_action", { choiceId: actionId, emit: ctx.emit });
  }

  if (choice.requirements && !evaluateRequirements(choice.requirements, context, actionId, ctx.emit, false)) {
    return rejected(state, "requirement_unmet", choice.requirementFailKey ?? "core.reason.requirement_unmet", {
      choiceId: actionId,
      emit: ctx.emit,
    });
  }

  const applied = applyConsequences(content.variables, state.variables, choice.effects ?? [], ctx.emit);
  const transitioned = enterAndEmit(
    content.nodes,
    { ...state, variables: applied.variables, turn: state.turn + 1 },
    choice.goto,
    ctx.emit,
  );
  const settled = settle(content.nodes, content.variables, transitioned, ctx.rng, ctx.emit);

  // 03 §8.2 step 7 — after settle, before returning, so an achievement's condition can
  // react to the ending settle just resolved (plan 20, "Ending resolution").
  const achieved = evaluateAchievements(content.achievements, settled.state, ctx.emit);

  return {
    state: { ...settled.state, unlockedAchievements: achieved.unlockedAchievements },
    status: settled.status,
    changes: [...applied.changes, ...settled.changes, ...achieved.changes],
    messages: [],
  };
}
