/**
 * Story-graph kind — the campaign content envelope.
 *
 * Contract: `03-story-graph-kind.md` §1.
 *
 * The runtime `content` inside the core's `Campaign` envelope (`registry/types.ts`) —
 * `id`/`version`/`kind`/`titleKey` live on `Campaign` itself, not here (the
 * envelope-duplication rule `CLAUDE.md` tracks).
 */

import type { LocKey } from "../../core/localization/types.js";
import type { VariableSchema } from "./variables.js";
import type { Node } from "./nodes.js";

export interface StoryGraphCampaign {
  descriptionKey: LocKey;
  variables: VariableSchema;
  nodes: Record<string, Node>;
  startNodeId: string;

  /**
   * `AchievementDefinition[]` (03 §7) doesn't exist until W13 — nothing in W11 reads
   * this field, so it stays an honest placeholder rather than a type invented ahead of
   * the unit that owns it. See `plans/18-w11-nodes-turn-and-settle.md`, Decision 4.
   */
  achievements: readonly unknown[];
}
