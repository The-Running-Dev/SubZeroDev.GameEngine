/** The one closed, normative order for a world-graph tick. */
export const WORLD_GRAPH_SYSTEM_IDS = [
  "scenario",
  "guest-spawn",
  "guest-needs",
  "guest-service",
  "queues",
  "guest-intent",
  "guest-path",
  "guest-move",
  "task-generate",
  "task-assign",
  "staff-work",
  "construction",
  "buildings",
  "cleanliness-wear",
  "finance",
  "incidents",
  "objectives",
  "failure",
  "alerts",
  "tick-finalize",
] as const;

export type WorldGraphSystemId = typeof WORLD_GRAPH_SYSTEM_IDS[number];

const compareText = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;

/** Validated definition ids use ordinal code-unit order, never the host locale. */
export const compareDefinitionId = compareText;

/** Prefix lexicographic, then numeric ordinal — `incident:2` precedes `incident:10`. */
export function compareRuntimeEntityId(left: string, right: string): number {
  const leftSeparator = left.lastIndexOf(":");
  const rightSeparator = right.lastIndexOf(":");
  const leftPrefix = leftSeparator < 0 ? left : left.slice(0, leftSeparator);
  const rightPrefix = rightSeparator < 0 ? right : right.slice(0, rightSeparator);
  const prefixOrder = compareText(leftPrefix, rightPrefix);
  if (prefixOrder !== 0) return prefixOrder;
  const leftOrdinal = Number(left.slice(leftSeparator + 1));
  const rightOrdinal = Number(right.slice(rightSeparator + 1));
  if (Number.isSafeInteger(leftOrdinal) && Number.isSafeInteger(rightOrdinal) && leftOrdinal !== rightOrdinal) {
    return leftOrdinal - rightOrdinal;
  }
  return compareText(left, right);
}

const SYSTEM_INDEX = new Map<WorldGraphSystemId, number>(
  WORLD_GRAPH_SYSTEM_IDS.map((id, index) => [id, index]),
);

export function worldGraphSystemIndex(id: WorldGraphSystemId): number {
  const index = SYSTEM_INDEX.get(id);
  if (index === undefined) throw new Error(`Unknown world-graph system: ${id}`);
  return index;
}
