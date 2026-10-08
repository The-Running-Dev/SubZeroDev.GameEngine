/**
 * Story-graph kind — `Kind.validateState` (03 §8.1; 04 §4).
 *
 * The core checks `kindState` for presence only. This is the kind's half: every field of
 * `StoryGraphKindState` present with its type, plus the two references into the campaign
 * that the rest of the kind indexes without a guard — `currentNodeId` must name a node, and
 * every declared variable must be present with its declared type (`visibleVariables` throws
 * otherwise). A variable the schema does not declare is tolerated: it is unread, and a
 * removed declaration is a content change, not corruption (`90-decisions.md`, *Content
 * epochs*).
 */

import type { Campaign } from "../../core/registry/types.js";
import type { StoryGraphCampaign } from "./campaign.js";
import type { VarType } from "./variables.js";

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isCount(v: unknown): boolean {
  return typeof v === "number" && Number.isInteger(v) && v >= 0;
}

function hasType(value: unknown, type: VarType): boolean {
  switch (type) {
    case "bool":
      return typeof value === "boolean";
    case "int":
      return typeof value === "number" && Number.isInteger(value);
    case "enum":
      return typeof value === "string";
  }
}

export function validateStoryGraphState(kindState: unknown, campaign: Campaign): boolean {
  if (!isPlainObject(kindState)) return false;
  const content = campaign.content as StoryGraphCampaign;

  const { currentNodeId, variables, turn, visitedCounts, unlockedAchievements, endingId } = kindState;
  if (typeof currentNodeId !== "string" || !Object.hasOwn(content.nodes, currentNodeId)) return false;
  if (!isCount(turn)) return false;
  if (!isPlainObject(visitedCounts) || !Object.values(visitedCounts).every(isCount)) return false;
  if (!Array.isArray(unlockedAchievements) || !unlockedAchievements.every((id) => typeof id === "string")) return false;
  if (endingId !== undefined && typeof endingId !== "string") return false;

  if (!isPlainObject(variables)) return false;
  for (const [name, decl] of Object.entries(content.variables)) {
    if (!Object.hasOwn(variables, name) || !hasType(variables[name], decl.type)) return false;
  }
  return true;
}
