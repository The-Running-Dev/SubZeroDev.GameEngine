/**
 * Story-graph kind — the authoring source form and its extraction builder (03 §1).
 *
 * Contract: `03-story-graph-kind.md` §1: "Authors write `StoryGraphCampaignSource`, whose
 * player-facing fields are `AuthoredText`; a pure builder lifts the strings out and
 * produces [the runtime form] plus a string table."
 *
 * Every source type is the runtime type (`nodes.ts`, `variables.ts`, `achievements.ts`,
 * `campaign.ts`) with its `LocKey` field(s) replaced by `AuthoredText` via `Omit` —
 * deriving from the runtime type rather than hand-duplicating every other field is what
 * keeps this from joining CLAUDE.md's drift ledger: a field added to `Choice` that isn't a
 * `LocKey` appears here automatically, with no second edit to forget.
 *
 * `buildStoryGraphCampaign` is the mechanical lift only — it performs no validation.
 * Tier 1 (`validate.ts`, W14) still owns checking the result makes sense.
 */

import type { LocKey } from "../../core/localization/types.js";
import type { AuthoredText } from "../../core/registry/types.js";
import type { Choice, Node, ChoiceNode, RandomNode, AutoNode, EndingNode } from "./nodes.js";
import type { VariableDecl, VariableSchema } from "./variables.js";
import type { AchievementDefinition } from "./achievements.js";
import type { StoryGraphCampaign } from "./campaign.js";

export type ChoiceSource = Omit<Choice, "labelKey" | "requirementFailKey"> & {
  label: AuthoredText;
  requirementFail?: AuthoredText;
};

interface NodeSourceBase {
  id: string;
  text: AuthoredText;
}

export type ChoiceNodeSource = Omit<ChoiceNode, "id" | "textKey" | "choices"> &
  NodeSourceBase & { choices: ChoiceSource[] };
export type RandomNodeSource = Omit<RandomNode, "id" | "textKey"> & NodeSourceBase;
export type AutoNodeSource = Omit<AutoNode, "id" | "textKey"> & NodeSourceBase;
export type EndingNodeSource = Omit<EndingNode, "id" | "textKey"> & NodeSourceBase;

export type NodeSource = ChoiceNodeSource | RandomNodeSource | AutoNodeSource | EndingNodeSource;

export type VariableDeclSource = Omit<VariableDecl, "labelKey"> & { label?: AuthoredText };
export type VariableSchemaSource = Record<string, VariableDeclSource>;

export type AchievementDefinitionSource = Omit<AchievementDefinition, "nameKey" | "descriptionKey"> & {
  name: AuthoredText;
  description: AuthoredText;
};

export interface StoryGraphCampaignSource {
  description: AuthoredText;
  variables: VariableSchemaSource;
  nodes: Record<string, NodeSource>;
  startNodeId: string;
  achievements: AchievementDefinitionSource[];
}

type Take = (text: AuthoredText) => LocKey;

function buildChoice(choice: ChoiceSource, take: Take): Choice {
  const { label, requirementFail, ...rest } = choice;
  return {
    ...rest,
    labelKey: take(label),
    ...(requirementFail !== undefined ? { requirementFailKey: take(requirementFail) } : {}),
  };
}

function buildNode(node: NodeSource, take: Take): Node {
  const textKey = take(node.text);
  switch (node.kind) {
    case "choice":
      return { id: node.id, kind: "choice", textKey, choices: node.choices.map((c) => buildChoice(c, take)) };
    case "random":
      return { id: node.id, kind: "random", textKey, transitions: node.transitions };
    case "auto": {
      const { id, effects, goto } = node;
      return { id, kind: "auto", textKey, ...(effects !== undefined ? { effects } : {}), goto };
    }
    case "ending": {
      const { id, endingId, outcome } = node;
      return { id, kind: "ending", textKey, endingId, ...(outcome !== undefined ? { outcome } : {}) };
    }
  }
}

function buildVariableDecl(decl: VariableDeclSource, take: Take): VariableDecl {
  const { label, ...rest } = decl;
  return { ...rest, ...(label !== undefined ? { labelKey: take(label) } : {}) };
}

function buildAchievement(achievement: AchievementDefinitionSource, take: Take): AchievementDefinition {
  const { name, description, ...rest } = achievement;
  return { ...rest, nameKey: take(name), descriptionKey: take(description) };
}

/**
 * Walks `source` once, collecting every `AuthoredText` it carries into a flat array while
 * replacing each with its own `key` in the returned runtime `content` — the mechanical
 * half of 03 §1's authoring pipeline. `content` feeds `Campaign.content`; `authoredText`
 * feeds `buildCampaign` (`registry/build.ts`, W4) exactly as any other kind's own builder
 * would.
 */
export function buildStoryGraphCampaign(source: StoryGraphCampaignSource): {
  content: StoryGraphCampaign;
  authoredText: AuthoredText[];
} {
  const authoredText: AuthoredText[] = [];
  const take: Take = (text) => {
    authoredText.push(text);
    return text.key;
  };

  const variables: VariableSchema = {};
  for (const [name, decl] of Object.entries(source.variables)) {
    variables[name] = buildVariableDecl(decl, take);
  }

  const nodes: Record<string, Node> = {};
  for (const [id, node] of Object.entries(source.nodes)) {
    nodes[id] = buildNode(node, take);
  }

  const content: StoryGraphCampaign = {
    descriptionKey: take(source.description),
    variables,
    nodes,
    startNodeId: source.startNodeId,
    achievements: source.achievements.map((a) => buildAchievement(a, take)),
  };

  return { content, authoredText };
}
