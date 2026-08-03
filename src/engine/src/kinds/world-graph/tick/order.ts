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

const SYSTEM_INDEX = new Map<WorldGraphSystemId, number>(
  WORLD_GRAPH_SYSTEM_IDS.map((id, index) => [id, index]),
);

export function worldGraphSystemIndex(id: WorldGraphSystemId): number {
  const index = SYSTEM_INDEX.get(id);
  if (index === undefined) throw new Error(`Unknown world-graph system: ${id}`);
  return index;
}
