/**
 * World-graph kind — `Kind.validateState` (12 §3; 04 §4).
 *
 * The core checks `kindState` for presence only. This is the kind's half, at the top level:
 * every field of `WorldGraphKindState` present as a count, an object, an array, or `null`
 * where the type allows it. Nested records — guests, buildings, the map — are trusted; a deep
 * check is recorded as a follow-up (`90-decisions.md`, *Found by the 2026-10-03 repository
 * review*), not attempted here. Every field has existed since W46, so none may be absent.
 */

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isCount(v: unknown): boolean {
  return typeof v === "number" && Number.isInteger(v) && v >= 0;
}

const COUNT_FIELDS = ["tick", "nextEntityOrdinal"] as const;
const OBJECT_FIELDS = ["map", "finances", "counters"] as const;
const ARRAY_FIELDS = [
  "buildings",
  "constructionSites",
  "guests",
  "staff",
  "incidents",
  "objectives",
  "failures",
  "alerts",
  "unlockedContent",
  "activePolicyIds",
  "unlockedAchievementIds",
] as const;

export function validateWorldGraphState(kindState: unknown): boolean {
  if (!isPlainObject(kindState)) return false;
  if (!COUNT_FIELDS.every((field) => isCount(kindState[field]))) return false;
  if (!OBJECT_FIELDS.every((field) => isPlainObject(kindState[field]))) return false;
  if (!ARRAY_FIELDS.every((field) => Array.isArray(kindState[field]))) return false;

  const { resolution } = kindState;
  if (resolution !== null && !isPlainObject(resolution)) return false;
  return true;
}
