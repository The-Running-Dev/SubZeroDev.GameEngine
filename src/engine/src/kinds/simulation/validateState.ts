/**
 * Simulation kind — `Kind.validateState` (10 §2; 04 §4).
 *
 * The core checks `kindState` for presence only. This is the kind's half, at the top level:
 * every field of `SimulationKindState` present as an object, an array, or `null` where the
 * type allows it. Nested records are trusted — a deep check of the ~30 record types under
 * these fields is recorded as a follow-up (`90-decisions.md`, *Found by the 2026-10-03
 * repository review*), not attempted here.
 *
 * `resolution` may also be **absent**: it was added in W57, and a session persisted before
 * then comes back without the key on the raw `deserialize` path, which has no migration step.
 * `endOfWeek.ts` already reads it as `?? null` for exactly that reason.
 */

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

const OBJECT_FIELDS = ["calendar", "player", "economy", "world"] as const;
const ARRAY_FIELDS = [
  "activeEffects",
  "activeOpportunities",
  "scheduledEvents",
  "pendingEventResponses",
  "goals",
] as const;

export function validateSimulationState(kindState: unknown): boolean {
  if (!isPlainObject(kindState)) return false;
  if (!OBJECT_FIELDS.every((field) => isPlainObject(kindState[field]))) return false;
  if (!ARRAY_FIELDS.every((field) => Array.isArray(kindState[field]))) return false;

  const { resolution, plan } = kindState;
  if (resolution !== undefined && resolution !== null && !isPlainObject(resolution)) return false;
  if (plan !== null && !isPlainObject(plan)) return false;
  return true;
}
