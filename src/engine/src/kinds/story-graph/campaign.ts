/**
 * Story-graph kind — the campaign content envelope.
 *
 * Contract: `03-story-graph-kind.md` §1, §1.1.
 *
 * The runtime `content` inside the core's `Campaign` envelope (`registry/types.ts`) —
 * `id`/`version`/`kind`/`titleKey` live on `Campaign` itself, not here (the
 * envelope-duplication rule `CLAUDE.md` tracks).
 */

import type { LocKey } from "../../core/localization/types.js";
import type { VariableSchema } from "./variables.js";
import type { Choice, Node } from "./nodes.js";
import type { AchievementDefinition } from "./achievements.js";

export interface StoryGraphCampaign {
  descriptionKey: LocKey;
  variables: VariableSchema;
  nodes: Record<string, Node>;
  startNodeId: string;
  achievements: AchievementDefinition[];

  /** Present iff this campaign may be included (03 §1.1). */
  module?: ModuleInterface;
}

/** Opt-in: a campaign without it fails `include_not_module` when included (03 §1.1). */
export interface ModuleInterface {
  /** Where an include enters; default `startNodeId`. */
  entryNodeId?: string;
  /** Declared variables a host may write on entry. */
  inputs: string[];
  /** Declared variables a host may read on exit. */
  outputs: string[];
}

/** `CampaignInclude.binding` (04 §10.4) for a story-graph module. */
export interface StoryGraphIncludeBinding {
  /** Module `endingId` → host node id; every one mapped. */
  exits: Record<string, string>;
  /** Module input → host variable, copied in on entry. */
  inputs?: Record<string, string>;
  /** Module output → host variable, copied out on exit. */
  outputs?: Record<string, string>;
}

/** `CampaignAttachment.payload` (04 §10.4): one new choice on a host choice node, whose
 *  `goto` is implied — the include's entry. */
export interface StoryGraphAttachment {
  hostNodeId: string;
  choice: Omit<Choice, "goto" | "effects">;
}
