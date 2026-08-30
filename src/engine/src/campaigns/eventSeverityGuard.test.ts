/**
 * W96.5 — the mechanical severity gate.
 *
 * Contract: `05-observability.md` §7 ("Severity is fixed per event **name**, not chosen per
 * call site") plus each kind's own event table (`03-story-graph-kind.md` §8.4,
 * `10-simulation-kind.md` §11, `12-world-graph-kind.md` §12 — all `20-contract.md`).
 *
 * `12-world-graph-kind.md` §12 records that this kind's severities disagreed with its own
 * contract table four times and survived four reconciliations, because a kind wrote its
 * severity as a literal at each `emit` call rather than in one table the way
 * `core/observability/events.ts` already does for the core set. W96 gives every kind that
 * same table (`events.ts` alongside each `kind.ts`) and every call site now reads both the
 * name and the severity off one entry, so two call sites for the same event can no longer
 * disagree by construction — this file is the gate that keeps it that way: it compares each
 * kind's table against a name literal actually referenced from that kind's own production
 * source (proving a live emit site, not just a declared one), against `Kind.eventNames`, and
 * against a canonical reference transcribed from the contract tables above.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { STORY_GRAPH_EVENTS } from "../kinds/story-graph/events.js";
import { storyGraphKind } from "../kinds/story-graph/kind.js";
import { SIMULATION_EVENTS } from "../kinds/simulation/events.js";
import { simulationKind } from "../kinds/simulation/kind.js";
import { WORLD_GRAPH_EVENTS } from "../kinds/world-graph/events.js";
import { worldGraphKind } from "../kinds/world-graph/kind.js";
import type { Kind } from "../core/kernel/types.js";
import type { EventName, Severity } from "../core/observability/types.js";

type EventTable = Record<string, { readonly name: EventName; readonly severity: Severity }>;

/** No two table entries may name the same event with different severities — the exact
 *  failure mode 12 §12 records happening by hand. */
function assertOneSeverityPerName(table: EventTable): void {
  const severityByName = new Map<EventName, Severity>();
  for (const entry of Object.values(table)) {
    const existing = severityByName.get(entry.name);
    if (existing !== undefined) expect(entry.severity, `two severities for "${entry.name}"`).toBe(existing);
    severityByName.set(entry.name, entry.severity);
  }
}

/** Proves every table key is referenced by at least one call site under `sourceDir` — a
 *  table entry nothing emits is exactly as unverified as a name in `eventNames` with no
 *  emit site (12 §12's own status column). */
function referencedKeys(sourceGlob: readonly string[], tableConstName: string): ReadonlySet<string> {
  const text = sourceGlob.map((path) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8")).join("\n");
  const pattern = new RegExp(`${tableConstName}\\.([a-zA-Z0-9_]+)`, "g");
  return new Set([...text.matchAll(pattern)].map((match) => match[1]!));
}

function checkKind(
  label: string,
  kind: Kind<unknown>,
  table: EventTable,
  tableConstName: string,
  sourceGlob: readonly string[],
  canonical: EventTable,
): void {
  describe(label, () => {
    it("owns exactly one severity per event name", () => {
      assertOneSeverityPerName(table);
    });

    it("declares exactly the table's names — no missing or extra name", () => {
      const declared = new Set(kind.eventNames);
      const tableNames = new Set(Object.values(table).map((entry) => entry.name));
      expect([...tableNames].filter((name) => !declared.has(name)), "in table but not declared").toEqual([]);
      expect([...declared].filter((name) => !tableNames.has(name)), "declared but not in table").toEqual([]);
    });

    it("every table entry is referenced by a live emit call site", () => {
      const referenced = referencedKeys(sourceGlob, tableConstName);
      const unreferenced = Object.keys(table).filter((key) => !referenced.has(key));
      expect(unreferenced, "table entries with no emit call site").toEqual([]);
    });

    it("matches the canonical severity transcribed from the contract table", () => {
      const byName = new Map(Object.values(table).map((entry) => [entry.name, entry.severity] as const));
      const canonicalByName = new Map(Object.values(canonical).map((entry) => [entry.name, entry.severity] as const));
      expect(Object.fromEntries(byName)).toEqual(Object.fromEntries(canonicalByName));
    });
  });
}

// Canonical reference, transcribed from `03-story-graph-kind.md` §8.4 (`20-contract.md`).
const STORY_GRAPH_CANONICAL: EventTable = {
  settleStep: { name: "kind.story-graph.settle.step", severity: "trace" },
  nodeEntered: { name: "kind.story-graph.node.entered", severity: "debug" },
  randomPicked: { name: "kind.story-graph.random.picked", severity: "debug" },
  settleGuardTripped: { name: "kind.story-graph.settle.guard_tripped", severity: "error" },
  choiceSubmitted: { name: "kind.story-graph.choice.submitted", severity: "debug" },
  choiceRejected: { name: "kind.story-graph.choice.rejected", severity: "info" },
  requirementEvaluated: { name: "kind.story-graph.requirement.evaluated", severity: "trace" },
  consequenceApplied: { name: "kind.story-graph.consequence.applied", severity: "debug" },
  achievementUnlocked: { name: "kind.story-graph.achievement.unlocked", severity: "info" },
  endingReached: { name: "kind.story-graph.ending.reached", severity: "info" },
};

// Canonical reference, transcribed from `10-simulation-kind.md` §11 (`20-contract.md`).
const SIMULATION_CANONICAL: EventTable = {
  planChanged: { name: "kind.simulation.plan.changed", severity: "debug" },
  weekStarted: { name: "kind.simulation.week.started", severity: "info" },
  systemRan: { name: "kind.simulation.system.ran", severity: "trace" },
  actionResolved: { name: "kind.simulation.action.resolved", severity: "debug" },
  effectExpired: { name: "kind.simulation.effect.expired", severity: "debug" },
  goalAchieved: { name: "kind.simulation.goal.achieved", severity: "info" },
  goalFailed: { name: "kind.simulation.goal.failed", severity: "info" },
  weekEnded: { name: "kind.simulation.week.ended", severity: "info" },
  employmentApplicationLost: { name: "kind.simulation.employment.application_lost", severity: "warn" },
};

// Canonical reference, transcribed from `12-world-graph-kind.md` §12 (`20-contract.md`).
const WORLD_GRAPH_CANONICAL: EventTable = {
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
};

checkKind(
  "story-graph",
  storyGraphKind,
  STORY_GRAPH_EVENTS,
  "STORY_GRAPH_EVENTS",
  ["../kinds/story-graph/settle.ts", "../kinds/story-graph/variables.ts", "../kinds/story-graph/achievements.ts", "../kinds/story-graph/advance.ts"],
  STORY_GRAPH_CANONICAL,
);

checkKind(
  "simulation",
  simulationKind,
  SIMULATION_EVENTS,
  "SIMULATION_EVENTS",
  ["../kinds/simulation/advance.ts", "../kinds/simulation/startOfWeek.ts", "../kinds/simulation/endOfWeek.ts"],
  SIMULATION_CANONICAL,
);

checkKind(
  "world-graph",
  worldGraphKind,
  WORLD_GRAPH_EVENTS,
  "WORLD_GRAPH_EVENTS",
  [
    "../kinds/world-graph/tick/pipeline.ts", "../kinds/world-graph/tick/batch.ts",
    "../kinds/world-graph/actions/alerts.ts", "../kinds/world-graph/actions/build.ts",
    "../kinds/world-graph/actions/building.ts", "../kinds/world-graph/actions/staff.ts",
  ],
  WORLD_GRAPH_CANONICAL,
);
