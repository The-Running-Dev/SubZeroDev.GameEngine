/**
 * Story-graph kind — the projection (03 §9).
 *
 * Contract: `03-story-graph-kind.md` §9; `04-core.md` §9.
 *
 * `StoryGraphView` repeats nothing the generic `Scene`/`PlayerView` already carries —
 * scene text is `Scene.body`, the choice list is `Scene.actions`, `gameId`/`status` are
 * on `Scene`/`PlayerView` already. Repeating any of them here is exactly the
 * envelope-duplication drift `CLAUDE.md`'s ledger tracks.
 */

import type { KindContext } from "../../core/kernel/types.js";
import type { ProjectionAudience } from "../../core/projection/types.js";
import type { LocKey } from "../../core/localization/types.js";
import { requireNode } from "./nodes.js";
import { visibleVariables, type VarValue } from "./variables.js";
import type { StoryGraphCampaign } from "./campaign.js";
import type { StoryGraphKindState } from "./state.js";

export interface VisibleStat {
  var: string;
  labelKey: LocKey;
  value: VarValue;
  /** The declared clamp floor (03 §2), when the declaration has one. */
  min?: number;
  /** The declared clamp ceiling (03 §2), when the declaration has one. */
  max?: number;
}

export interface StoryGraphView {
  turn: number;
  stats: VisibleStat[];
  unlockedAchievements: string[];
  ending?: { endingId: string; outcome: "win" | "loss" | "neutral" };
}

/**
 * `unlockedAchievements` passes through unfiltered, on purpose — 03 §9's field comment
 * says "non-hidden, unlocked", but 03 §7 defines `hidden` as "not listed **until
 * unlocked**", which only makes sense if unlocking is exactly what makes an achievement
 * listed. The two read in tension; §7's full-prose definition wins over §9's three-word
 * gloss (written before `AchievementDefinition` existed — plan 19, Decision 5). A hidden
 * achievement becomes visible here at the moment it unlocks, same as any other. See
 * `plans/20-w13-endings-and-achievements.md`, Decision 3, and `TODO.md`'s Known Open
 * Items for the unresolved doc-level tension.
 *
 * `ending.outcome` reads `content.nodes[state.currentNodeId]` rather than needing a new
 * state field — that id is already the ending node's own once `status === "ended"`
 * (`settle.ts`'s `enterAndEmit` sets `currentNodeId` on the way in; the `"ending"` branch
 * only stamps `endingId` afterward, never re-enters). Same plan, same decision.
 *
 * `audience` is accepted (the `Kind.project` signature requires it) but not branched on —
 * nothing in 03 §9 describes an `ai`-specific narrowing for this single-player kind.
 */
export function project(
  state: StoryGraphKindState,
  _audience: ProjectionAudience,
  ctx: KindContext,
): StoryGraphView {
  const content = ctx.campaign.content as StoryGraphCampaign;

  const visible = visibleVariables(content.variables, state.variables);
  const stats: VisibleStat[] = Object.keys(visible)
    .sort()
    .map((name) => {
      const decl = content.variables[name]!;
      const labelKey = decl.labelKey;
      if (labelKey === undefined) {
        throw new Error(`story-graph view: visible variable "${name}" has no labelKey`);
      }
      return {
        var: name,
        labelKey,
        value: visible[name]!,
        ...(decl.min !== undefined ? { min: decl.min } : {}),
        ...(decl.max !== undefined ? { max: decl.max } : {}),
      };
    });

  let ending: StoryGraphView["ending"];
  if (state.endingId !== undefined) {
    const node = requireNode(content.nodes, state.currentNodeId);
    if (node.kind === "ending") {
      ending = { endingId: state.endingId, outcome: node.outcome ?? "neutral" };
    }
  }

  return {
    turn: state.turn,
    stats,
    unlockedAchievements: state.unlockedAchievements,
    ...(ending ? { ending } : {}),
  };
}
