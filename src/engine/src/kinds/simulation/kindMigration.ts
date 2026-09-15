/**
 * Simulation kind — the kind-axis save migration (04 §10.2; W113). `Kind.migrateState` for a
 * `kindVersion` shape change, distinct from `migration.ts`'s campaign-axis
 * `applySimulationMigration` (04 §10.2 dispatches this one first, per `envelope.ts`).
 *
 * Operates on `unknown`, not the typed `SimulationKindState` — a save is a foreign document
 * until this walk (and `isValidGameStateShape` after it) says otherwise, the same defensive
 * posture `migration.ts` takes.
 */

import type { CommandResult } from "../../core/kernel/reasons.js";
import type { SimulationKindState } from "./state.js";

/** The only `kindVersion` this migration accepts a save coming from — `simulationKind.version`
 *  before W113's bump. Anything else fails the load. */
const FROM_VERSION = "1.0.0";

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** `HousingState` gained `utilitiesCents`/`transportCents` (§7.4/§6.9, 90-decisions W105.3);
 *  both default to 0. Defaults are spread first so an actor that already carries the fields
 *  (a state already migrated, or a fresh v1.1.0 save re-run through this walk) keeps its own
 *  values — idempotent against its own output, per 04 §10.2. */
function withHousingDefaults(actor: unknown): unknown {
  if (!isPlainObject(actor)) return actor;
  const housing = isPlainObject(actor["housing"]) ? actor["housing"] : {};
  return { ...actor, housing: { utilitiesCents: 0, transportCents: 0, ...housing } };
}

/**
 * The engine-owned walk `simulationKind.migrateState` (`kind.ts`) is registered as. Applies
 * `withHousingDefaults` to `player` and every `world.agents[].actor` — the same shared
 * actor-scoped path `migration.ts`'s campaign-axis walk already uses (§6.2's "one shape, one
 * code path" rule, carried into migration).
 */
export function migrateSimulationKindState(oldState: unknown, fromVersion: string): CommandResult<SimulationKindState> {
  if (fromVersion !== FROM_VERSION || !isPlainObject(oldState)) {
    return { ok: false, errors: [{ code: "migration_failed", messageKey: "core.reason.migration_failed" }], warnings: [] };
  }

  const player = withHousingDefaults(oldState["player"]);
  const world = isPlainObject(oldState["world"]) ? oldState["world"] : {};
  const agents = Array.isArray(world["agents"])
    ? world["agents"].map((agent) => (isPlainObject(agent) ? { ...agent, actor: withHousingDefaults(agent["actor"]) } : agent))
    : world["agents"];

  return {
    ok: true,
    value: { ...oldState, player, world: { ...world, agents } } as SimulationKindState,
    errors: [],
    warnings: [],
  };
}
