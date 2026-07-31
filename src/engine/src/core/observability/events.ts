/**
 * The core event set.
 *
 * Contract: `05-observability.md` §8. Severity is fixed per name, not per call site (§7),
 * so it's paired with the name here rather than chosen again at each emit call.
 *
 * `validationCompleted` and `migrationApplied` have no emission call site yet: the former
 * fires at registry construction, which no builder exists for until W4/W5; the latter
 * fires when a save is migrated, and W3's `migrate` is a pass-through stub (no real
 * migration mechanism exists — `plans/09-w3-pure-engine-kernel.md`, Decision 5). Defined
 * here so the constant table is complete and matches the doc; wired up when their call
 * sites exist.
 */

import type { EventName, Severity } from "./types.js";

interface CoreEventDef {
  readonly name: EventName;
  readonly severity: Severity;
}

export const CORE_EVENTS = {
  gameCreated: { name: "core.game.created", severity: "info" },
  actionAccepted: { name: "core.action.accepted", severity: "info" },
  actionRejected: { name: "core.action.rejected", severity: "info" },
  gameEnded: { name: "core.game.ended", severity: "info" },
  rngStreamDerived: { name: "core.rng.stream.derived", severity: "trace" },
  serializeCompleted: { name: "core.serialize.completed", severity: "debug" },
  deserializeRejected: { name: "core.deserialize.rejected", severity: "error" },
  validationCompleted: { name: "core.validation.completed", severity: "info" },
  migrationApplied: { name: "core.migration.applied", severity: "warn" },
} as const satisfies Record<string, CoreEventDef>;
