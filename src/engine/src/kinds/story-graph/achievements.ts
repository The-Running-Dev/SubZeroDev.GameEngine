/**
 * Story-graph kind — achievements (03 §7).
 *
 * Contract: `03-story-graph-kind.md` §7, §8.2.
 *
 * The kind's whole part of the bargain: unlock into `kindState` and emit an
 * `achievement_unlocked` `StateChange`. The session store does the rest (W8,
 * `session/store.ts`'s `achievementIdFrom` — already built, waiting for a real emitter).
 */

import type { LocKey } from "../../core/localization/types.js";
import type { Condition } from "../../core/condition/types.js";
import type { StateChange } from "../../core/kernel/reasons.js";
import type { ResolutionEmitter } from "../../core/observability/types.js";
import { evaluateStoryGraphCondition, toConditionContext } from "./conditions.js";
import type { StoryGraphKindState } from "./state.js";

export interface AchievementDefinition {
  id: string;
  nameKey: LocKey;
  descriptionKey: LocKey;
  condition: Condition;
  hidden: boolean;
}

/**
 * Evaluates every not-yet-unlocked achievement's `condition` against `state`, in
 * `achievements`' authored order. Pure — no `ctx`, no I/O, matching this unit's own
 * done-criterion ("`advance` performs no I/O").
 *
 * The condition context is rebuilt after each unlock rather than once up front, so an
 * achievement whose `condition` reads `achieved.<id>` can react to another achievement
 * unlocked earlier in the *same* call — see `plans/20-w13-endings-and-achievements.md`,
 * Decision 2.
 */
export function evaluateAchievements(
  achievements: readonly AchievementDefinition[],
  state: StoryGraphKindState,
  emit?: ResolutionEmitter,
): { unlockedAchievements: string[]; changes: StateChange[] } {
  // One copy of the input up front (never mutated after), then a Set for O(1)
  // membership checks and in-place pushes instead of an O(n) `.includes` scan and an
  // O(n) array copy per achievement (PR #51 review) — same authored-order chaining
  // semantics, just without the quadratic overhead as achievement counts grow.
  const unlocked = [...state.unlockedAchievements];
  const unlockedIds = new Set(unlocked);
  const changes: StateChange[] = [];

  for (const achievement of achievements) {
    if (unlockedIds.has(achievement.id)) continue;

    const context = toConditionContext({ ...state, unlockedAchievements: unlocked });
    if (!evaluateStoryGraphCondition(achievement.condition, context)) continue;

    unlockedIds.add(achievement.id);
    unlocked.push(achievement.id);
    emit?.emit("kind.story-graph.achievement.unlocked", "info", { data: { achievementId: achievement.id } });
    changes.push({
      path: `achieved.${achievement.id}`,
      op: "set",
      value: true,
      reason: "achievement_unlocked",
      visible: true,
    });
  }

  return { unlockedAchievements: unlocked, changes };
}
