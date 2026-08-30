/**
 * The world-graph kind's name-to-severity table.
 *
 * Contract: `12-world-graph-kind.md` §12 (`20-contract.md` §12), which pairs every declared
 * `Kind.eventNames` entry with one fixed severity (`05-observability.md` §7 — severity is
 * fixed per name, not chosen per call site) and warns that this kind historically wrote its
 * severity as a literal at each `emit` call instead, letting the contract table and the
 * shipped source drift apart silently (W96, `90-decisions.md`'s open register). Every call
 * site now reads both the name and the severity off one entry here, the same pattern
 * `core/observability/events.ts` already uses for the core set — so two call sites for the
 * same event can no longer disagree by construction, and `kind.ts`'s `eventNames` is
 * generated from this table rather than kept in step by hand.
 */

import type { EventName, Severity } from "../../core/observability/types.js";

interface WorldGraphEventDef {
  readonly name: EventName;
  readonly severity: Severity;
}

export const WORLD_GRAPH_EVENTS = {
  buildingPlaced: { name: "kind.world-graph.building.placed", severity: "info" },
  buildingDemolished: { name: "kind.world-graph.building.demolished", severity: "debug" },
  buildingStatusChanged: { name: "kind.world-graph.building.status.changed", severity: "debug" },
  buildingMeterChanged: { name: "kind.world-graph.building.meter.changed", severity: "trace" },
  constructionProgressed: { name: "kind.world-graph.construction.progressed", severity: "trace" },
  constructionCompleted: { name: "kind.world-graph.construction.completed", severity: "info" },
  staffHired: { name: "kind.world-graph.staff.hired", severity: "info" },
  staffFired: { name: "kind.world-graph.staff.fired", severity: "debug" },
  staffAssigned: { name: "kind.world-graph.staff.assigned", severity: "trace" },
  alertDismissed: { name: "kind.world-graph.alert.dismissed", severity: "trace" },
  alertRaised: { name: "kind.world-graph.alert.raised", severity: "debug" },
  alertCleared: { name: "kind.world-graph.alert.cleared", severity: "trace" },
  achievementUnlocked: { name: "kind.world-graph.achievement.unlocked", severity: "info" },
  batchStarted: { name: "kind.world-graph.batch.started", severity: "debug" },
  batchEnded: { name: "kind.world-graph.batch.ended", severity: "debug" },
  scenarioEffectApplied: { name: "kind.world-graph.scenario.effect.applied", severity: "debug" },
  guestSpawned: { name: "kind.world-graph.guest.spawned", severity: "trace" },
  guestServed: { name: "kind.world-graph.guest.served", severity: "trace" },
  incidentResolved: { name: "kind.world-graph.incident.resolved", severity: "info" },
  incidentRaised: { name: "kind.world-graph.incident.raised", severity: "info" },
  tickFinalized: { name: "kind.world-graph.tick.finalized", severity: "trace" },
  guestMeterChanged: { name: "kind.world-graph.guest.meter.changed", severity: "trace" },
  serviceStarted: { name: "kind.world-graph.service.started", severity: "trace" },
  queueJoined: { name: "kind.world-graph.queue.joined", severity: "trace" },
  queueAbandoned: { name: "kind.world-graph.queue.abandoned", severity: "trace" },
  guestIntentSelected: { name: "kind.world-graph.guest.intent.selected", severity: "trace" },
  guestPathCommitted: { name: "kind.world-graph.guest.path.committed", severity: "trace" },
  guestPathFailed: { name: "kind.world-graph.guest.path.failed", severity: "debug" },
  guestMoved: { name: "kind.world-graph.guest.moved", severity: "trace" },
  guestDeparted: { name: "kind.world-graph.guest.departed", severity: "debug" },
  taskCandidateGenerated: { name: "kind.world-graph.task.candidate.generated", severity: "trace" },
  staffTaskAssigned: { name: "kind.world-graph.staff.task.assigned", severity: "trace" },
  staffTaskCompleted: { name: "kind.world-graph.staff.task.completed", severity: "trace" },
  staffTaskCancelled: { name: "kind.world-graph.staff.task.cancelled", severity: "trace" },
  staffMoved: { name: "kind.world-graph.staff.moved", severity: "trace" },
  financeCharged: { name: "kind.world-graph.finance.charged", severity: "debug" },
  objectiveProgressed: { name: "kind.world-graph.objective.progressed", severity: "debug" },
  objectiveMet: { name: "kind.world-graph.objective.met", severity: "info" },
  failureProgressed: { name: "kind.world-graph.failure.progressed", severity: "debug" },
  failureTriggered: { name: "kind.world-graph.failure.triggered", severity: "info" },
  scenarioResolved: { name: "kind.world-graph.scenario.resolved", severity: "info" },
} as const satisfies Record<string, WorldGraphEventDef>;

/** `kind.ts`'s `eventNames` — generated from this table so the two cannot drift apart. */
export const WORLD_GRAPH_EVENT_NAMES: readonly EventName[] = Object.values(WORLD_GRAPH_EVENTS).map((entry) => entry.name);
