/**
 * The core event set.
 *
 * Contract: `05-observability.md` §8. Severity is fixed per name, not per call site (§7),
 * so it's paired with the name here rather than chosen again at each emit call.
 *
 * Three entries have no emission call site yet, all deliberately:
 * - `validationCompleted` fires at registry construction, which no builder exists for
 *   until W4/W5.
 * - `migrationApplied` fires when a save is migrated, and W3's `migrate` is a
 *   pass-through stub — no real migration mechanism exists yet
 *   (`plans/09-w3-pure-engine-kernel.md`, Decision 5).
 * - `serializeCompleted` was wired into `Engine.serialize` in an earlier draft of this
 *   unit and removed on review: `04-core.md` §4 commits `serialize(state): string` to a
 *   bare function of `state` alone, the same "no I/O" boundary that keeps a clock and an
 *   `IdSource` out of the pure engine (04 §1). Emitting would need `host.emitter`, a
 *   host-port dependency `serialize` was never given — even though the event itself
 *   can't affect the returned string.
 *
 * Defined here anyway so the constant table stays complete and matches the doc; wired up
 * if/when each gets a real call site.
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
