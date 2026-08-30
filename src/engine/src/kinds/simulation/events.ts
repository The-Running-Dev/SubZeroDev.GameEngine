/**
 * The simulation kind's name-to-severity table.
 *
 * Contract: `10-simulation-kind.md` §11 (`20-contract.md` §11), which pairs every declared
 * `Kind.eventNames` entry with one fixed severity (`05-observability.md` §7 — severity is
 * fixed per name, not chosen per call site). Every call site reads both the name and the
 * severity off one entry here, the same pattern `core/observability/events.ts` uses for the
 * core set (W96) — so two call sites for the same event can no longer disagree by
 * construction, and `kind.ts`'s `eventNames` is generated from this table rather than kept
 * in step by hand.
 */

import type { EventName, Severity } from "../../core/observability/types.js";

interface SimulationEventDef {
  readonly name: EventName;
  readonly severity: Severity;
}

export const SIMULATION_EVENTS = {
  planChanged: { name: "kind.simulation.plan.changed", severity: "debug" },
  weekStarted: { name: "kind.simulation.week.started", severity: "info" },
  systemRan: { name: "kind.simulation.system.ran", severity: "trace" },
  actionResolved: { name: "kind.simulation.action.resolved", severity: "debug" },
  effectExpired: { name: "kind.simulation.effect.expired", severity: "debug" },
  goalAchieved: { name: "kind.simulation.goal.achieved", severity: "info" },
  goalFailed: { name: "kind.simulation.goal.failed", severity: "info" },
  weekEnded: { name: "kind.simulation.week.ended", severity: "info" },
  employmentApplicationLost: { name: "kind.simulation.employment.application_lost", severity: "warn" },
} as const satisfies Record<string, SimulationEventDef>;

/** `kind.ts`'s `eventNames` — generated from this table so the two cannot drift apart. */
export const SIMULATION_EVENT_NAMES: readonly EventName[] = Object.values(SIMULATION_EVENTS).map((entry) => entry.name);
