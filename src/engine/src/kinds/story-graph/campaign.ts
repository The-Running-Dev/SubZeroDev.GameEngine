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
import type { AchievementDefinition } from "./achievements.js";

export interface StoryGraphCampaign {
  descriptionKey: LocKey;
  variables: VariableSchema;
  nodes: Record<string, Node>;
  startNodeId: string;
  achievements: AchievementDefinition[];
}
