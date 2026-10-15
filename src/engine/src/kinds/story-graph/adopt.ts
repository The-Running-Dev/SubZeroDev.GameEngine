/**
 * Story-graph kind — `Kind.adoptContent` (16-content-epochs.md §5.5).
 *
 * Contract: `20-contract.md` 03 §8.1; `10-design.md` Content Epochs §5.5.
 *
 * Adopts additive change and refuses anything that could strand the player. Runs no settle
 * and draws no randomness (C24): the only change an adoption makes is inserting each variable
 * the target declares and the state lacks, at its declared initial value. Every refusal
 * reasons `content_incompatible`; the engine then leaves the session pinned on the epoch it is
 * on, where it can still play.
 */

import type { AdoptDecision } from "../../core/kernel/types.js";
import type { Campaign } from "../../core/registry/types.js";
import type { StoryGraphCampaign } from "./campaign.js";
import { offeredChoices } from "./scene.js";
import type { StoryGraphKindState } from "./state.js";
import type { VariableDecl, VarValue } from "./variables.js";

const INCOMPATIBLE: AdoptDecision<StoryGraphKindState> = { adopt: false, reason: "content_incompatible" };

/** Whether `decl` admits `value` as it stands: its type, and for an `enum` one of its members,
 *  for an `int` within its bounds. A narrowed declaration that excludes a carried value is
 *  refused, since a later `copy` of it could throw (`90-decisions.md`, 2026-10-15). */
function admits(decl: VariableDecl, value: VarValue): boolean {
  switch (decl.type) {
    case "bool":
      return typeof value === "boolean";
    case "int":
      return typeof value === "number" && Number.isInteger(value)
        && (decl.min === undefined || value >= decl.min) && (decl.max === undefined || value <= decl.max);
    case "enum":
      return typeof value === "string" && (decl.values?.includes(value) ?? false);
  }
}

export function adoptContent(
  state: StoryGraphKindState,
  from: Campaign,
  to: Campaign,
): AdoptDecision<StoryGraphKindState> {
  const source = from.content as StoryGraphCampaign;
  const target = to.content as StoryGraphCampaign;

  // Nothing the state carries may be dropped: its history, its achievements, and any
  // variable the source declared. A variable the source never declared is tolerated here as
  // `validateState` tolerates it — unread, and not this adoption's to drop.
  if (!Object.keys(state.visitedCounts).every((nodeId) => Object.hasOwn(target.nodes, nodeId))) return INCOMPATIBLE;
  const achievementIds = new Set(target.achievements.map((a) => a.id));
  if (!state.unlockedAchievements.every((id) => achievementIds.has(id))) return INCOMPATIBLE;

  for (const name of Object.keys(state.variables)) {
    if (Object.hasOwn(target.variables, name)) {
      if (!admits(target.variables[name]!, state.variables[name]!)) return INCOMPATIBLE;
    } else if (Object.hasOwn(source.variables, name)) {
      return INCOMPATIBLE;
    }
  }

  // Insert what the target adds, sorted, as `buildInitialVariables` seeds a new game.
  const variables: Record<string, VarValue> = Object.create(null) as Record<string, VarValue>;
  for (const name of Object.keys(state.variables)) variables[name] = state.variables[name]!;
  for (const name of Object.keys(target.variables).sort()) {
    if (!Object.hasOwn(variables, name)) variables[name] = target.variables[name]!.initial;
  }
  const adopted: StoryGraphKindState = { ...state, variables };

  // The player must still have somewhere to act, judged against the adopted state.
  if (!Object.hasOwn(target.nodes, state.currentNodeId)) return INCOMPATIBLE;
  const node = target.nodes[state.currentNodeId]!;
  if (node.kind !== "choice") return INCOMPATIBLE;
  if (!offeredChoices(node, adopted).some((choice) => choice.available)) return INCOMPATIBLE;

  return { adopt: true, state: adopted };
}
