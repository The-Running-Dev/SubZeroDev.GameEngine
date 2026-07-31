/**
 * Story-graph kind — `availableActions` and `scene` (03 §4, §8.4, §9; 04 §6).
 *
 * Contract: `03-story-graph-kind.md` §4, §9; `04-core.md` §6.
 *
 * Both are literal `Kind<StoryGraphKindState>` methods — the core already calls them
 * exactly this way (`kernel/engine.ts`'s `availableActions`/`scene`, built in W3).
 */

import type { AvailableAction, KindContext, SceneBody } from "../../core/kernel/types.js";
import { resolveLocKey } from "../../core/localization/resolve.js";
import { requireNode } from "./nodes.js";
import { visibleVariables } from "./variables.js";
import { interpolateText } from "./text.js";
import { evaluateStoryGraphCondition, toConditionContext } from "./conditions.js";
import type { StoryGraphCampaign } from "./campaign.js";
import type { StoryGraphKindState } from "./state.js";

/**
 * `showWhen`-hidden choices are omitted entirely (03 §9 — "the client cannot know a
 * secret path exists"); a shown-but-gated choice carries `available: false` and
 * `reasonKey` set to its `requirementFailKey`, falling back to the base
 * `core.reason.requirement_unmet` when a campaign omits one (03 §4's `requirementFailKey`
 * is optional). Returns `[]` outside a `ChoiceNode` — nothing to choose from an `ending`.
 */
export function availableActions(state: StoryGraphKindState, ctx: KindContext): AvailableAction[] {
  const content = ctx.campaign.content as StoryGraphCampaign;
  const node = requireNode(content.nodes, state.currentNodeId);
  if (node.kind !== "choice") return [];

  const context = toConditionContext(state);
  const actions: AvailableAction[] = [];

  for (const choice of node.choices) {
    if (choice.showWhen && !evaluateStoryGraphCondition(choice.showWhen, context)) continue;

    const gated = choice.requirements !== undefined && !evaluateStoryGraphCondition(choice.requirements, context);
    actions.push({
      id: choice.id,
      labelKey: choice.labelKey,
      available: !gated,
      ...(gated ? { reasonKey: choice.requirementFailKey ?? "core.reason.requirement_unmet" } : {}),
    });
  }

  return actions;
}

/**
 * Renders the current node's `textKey` against the registry's string table, interpolating
 * only visible variables (03 §3.1) — an undeclared or non-visible `{name}` throws
 * (`text.ts`).
 */
export function scene(state: StoryGraphKindState, ctx: KindContext): SceneBody {
  const content = ctx.campaign.content as StoryGraphCampaign;
  const node = requireNode(content.nodes, state.currentNodeId);

  const template = resolveLocKey(ctx.registry.strings, node.textKey);
  if (template === undefined) {
    throw new Error(`story-graph scene: no string registered for "${node.textKey}"`);
  }

  const visible = visibleVariables(content.variables, state.variables);
  return { textKey: node.textKey, text: interpolateText(template, visible) };
}
