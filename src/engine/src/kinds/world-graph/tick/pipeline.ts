import type { KindContext } from "../../../core/kernel/types.js";
import type { StateChange } from "../../../core/kernel/reasons.js";
import { assertReferentialIntegrity } from "../actions/common.js";
import { evaluateCondition } from "../conditions.js";
import type { WorldEffect, WorldGraphCampaign } from "../content.js";
import type { WorldGraphKindState } from "../state.js";

export type WorldGraphSystemId =
  | "scenario" | "guest-spawn" | "guest-needs" | "guest-intent" | "guest-path" | "guest-move" | "queues" | "service"
  | "staff-assign" | "staff-move" | "staff-work" | "construction" | "buildings" | "cleanliness-wear" | "finance"
  | "incidents" | "objectives" | "failure" | "alerts" | "tick-finalize";

export interface TickChanges { record(system: WorldGraphSystemId, path: string, value: string | number | boolean, reason: string, visible: boolean, previous?: string | number | boolean): void }

export interface WorldGraphTickFrame {
  readonly processingTick: number;
  readonly content: WorldGraphCampaign;
  readonly ctx: Pick<KindContext, "derive" | "emit">;
  readonly changes: TickChanges;
  readonly state: WorldGraphKindState;
}

export type WorldGraphSystem = (frame: WorldGraphTickFrame) => WorldGraphTickFrame;

const scalar = (frame: WorldGraphTickFrame, system: WorldGraphSystemId, path: string, previous: number, value: number, reason: string, visible = false): void => {
  if (previous !== value) frame.changes.record(system, path, value, reason, visible, previous);
};

function applyEffect(state: WorldGraphKindState, effect: WorldEffect): WorldGraphKindState {
  if (effect.kind === "finance_delta") {
    const cashCents = state.finances.cashCents + effect.cents;
    return { ...state, finances: { ...state.finances, cashCents, ...(effect.cents >= 0
      ? { revenueTodayCents: state.finances.revenueTodayCents + effect.cents, revenueTotalCents: state.finances.revenueTotalCents + effect.cents }
      : { expensesTodayCents: state.finances.expensesTodayCents - effect.cents, expensesTotalCents: state.finances.expensesTotalCents - effect.cents }) } };
  }
  if (effect.kind === "counter_delta") return { ...state, counters: { ...state.counters, [effect.counter]: state.counters[effect.counter] + effect.delta } };
  if (effect.kind === "set_policy_active") {
    const activePolicyIds = effect.active
      ? [...new Set([...state.activePolicyIds, effect.policyId])].sort()
      : state.activePolicyIds.filter((id) => id !== effect.policyId);
    return { ...state, activePolicyIds };
  }
  if (effect.kind === "unlock") return state.unlockedContent.some((entry) => entry.kind === effect.content.kind && entry.id === effect.content.id)
    ? state : { ...state, unlockedContent: [...state.unlockedContent, effect.content].sort((a, b) => a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id)) };
  if (effect.kind === "lock") return { ...state, unlockedContent: state.unlockedContent.filter((entry) => entry.kind !== effect.content.kind || entry.id !== effect.content.id) };
  return state;
}

/** System 1: the only W46 mutator before finalization. */
export const scenario: WorldGraphSystem = (frame) => {
  const source = frame.state;
  const scenarioDefinition = frame.content.scenarios.find((entry) => entry.id === frame.content.startScenarioId);
  if (!scenarioDefinition) throw new Error("Validated world-graph scenario missing");
  let state = source;
  if (frame.processingTick % frame.content.ticksPerDay === 0) {
    const finances = { ...state.finances, revenueTodayCents: 0, expensesTodayCents: 0 };
    state = { ...state, finances };
    scalar(frame, "scenario", "finances.revenueTodayCents", source.finances.revenueTodayCents, 0, "day_started");
    scalar(frame, "scenario", "finances.expensesTodayCents", source.finances.expensesTodayCents, 0, "day_started");
  }
  const scheduled = scenarioDefinition.scheduledChanges
    .map((change, index) => ({ change, index }))
    .filter(({ change }) => change.dueTick === frame.processingTick && evaluateCondition(change.condition, source, frame.content))
    .sort((a, b) => a.change.dueTick - b.change.dueTick || b.change.priority - a.change.priority || a.index - b.index);
  const policies = frame.content.policies.filter((policy) => source.activePolicyIds.includes(policy.id)).sort((a, b) => a.id.localeCompare(b.id));
  const effects = [...scheduled.flatMap(({ change }) => change.effects), ...policies.flatMap((policy) => policy.whileActive)];
  for (const effect of effects) {
    const before = state;
    state = applyEffect(state, effect);
    if (effect.kind === "finance_delta") scalar(frame, "scenario", "finances.cashCents", before.finances.cashCents, state.finances.cashCents, "scenario_effect", true);
    if (effect.kind === "counter_delta") scalar(frame, "scenario", `counters.${effect.counter}`, before.counters[effect.counter], state.counters[effect.counter], "scenario_effect");
    frame.ctx.emit.emit("kind.world-graph.scenario.effect.applied", "debug", { data: { effect: effect.kind, tick: frame.processingTick } });
  }
  return { ...frame, state };
};

const stub = (_frame: WorldGraphTickFrame): WorldGraphTickFrame => _frame;
export const guestSpawn = stub; export const guestNeeds = stub; export const guestIntent = stub; export const guestPath = stub;
export const guestMove = stub; export const queues = stub; export const service = stub; export const staffAssign = stub;
export const staffMove = stub; export const staffWork = stub; export const construction = stub; export const buildings = stub;
export const cleanlinessWear = stub; export const finance = stub; export const incidents = stub; export const objectives = stub;
export const failure = stub; export const alerts = stub;

/** System 20: cleanup, integrity assertion, and the sole tick writer. */
export const tickFinalize: WorldGraphSystem = (frame) => {
  const removedGuestIds = new Set(frame.state.guests.filter((guest) => guest.lifecycle === "departed" || guest.lifecycle === "removed").map((guest) => guest.id));
  const guests = frame.state.guests.filter((guest) => !removedGuestIds.has(guest.id));
  const buildings = frame.state.buildings.map((building) => ({ ...building, queue: { ...building.queue, guestIds: building.queue.guestIds.filter((id) => !removedGuestIds.has(id)) } }));
  const staff = frame.state.staff.map((member) => member.task?.status === "completed" || member.task?.status === "cancelled"
    ? { ...member, task: null, status: member.status === "off_duty" ? "off_duty" as const : "idle" as const } : member);
  const incidents = frame.state.incidents.filter((incident) => incident.resolvedAtTick === null || !(frame.processingTick > incident.resolvedAtTick && frame.processingTick >= incident.startedAtTick + (frame.content.incidents.find((definition) => definition.id === incident.definitionId)?.cooldownTicks ?? 0)));
  const alerts = frame.state.alerts.filter((alert) => ![alert.clearedAtTick, alert.dismissedAtTick].some((at) => at !== null && at < frame.processingTick));
  const state = { ...frame.state, guests, buildings, staff, incidents, alerts, tick: frame.processingTick + 1 };
  assertReferentialIntegrity(state);
  frame.changes.record("tick-finalize", "tick", state.tick, "ticks_advanced", true, frame.processingTick);
  frame.ctx.emit.emit("kind.world-graph.tick.finalized", "debug", { data: { tick: frame.processingTick } });
  return { ...frame, state };
};

export const WORLD_GRAPH_SYSTEMS: readonly { readonly id: WorldGraphSystemId; readonly run: WorldGraphSystem }[] = [
  { id: "scenario", run: scenario }, { id: "guest-spawn", run: guestSpawn }, { id: "guest-needs", run: guestNeeds }, { id: "guest-intent", run: guestIntent }, { id: "guest-path", run: guestPath }, { id: "guest-move", run: guestMove }, { id: "queues", run: queues }, { id: "service", run: service }, { id: "staff-assign", run: staffAssign }, { id: "staff-move", run: staffMove }, { id: "staff-work", run: staffWork }, { id: "construction", run: construction }, { id: "buildings", run: buildings }, { id: "cleanliness-wear", run: cleanlinessWear }, { id: "finance", run: finance }, { id: "incidents", run: incidents }, { id: "objectives", run: objectives }, { id: "failure", run: failure }, { id: "alerts", run: alerts }, { id: "tick-finalize", run: tickFinalize },
];

export function runWorldGraphTick(state: WorldGraphKindState, content: WorldGraphCampaign, ctx: Pick<KindContext, "derive" | "emit">, changes: TickChanges, systems = WORLD_GRAPH_SYSTEMS): WorldGraphKindState {
  let frame: WorldGraphTickFrame = { processingTick: state.tick, content, ctx, changes, state };
  for (const system of systems) frame = system.run(frame);
  if (frame.state.tick !== state.tick + 1) throw new Error("World-graph tick did not finalize exactly once");
  return frame.state;
}

export class BatchChanges implements TickChanges {
  private readonly rows = new Map<string, StateChange>();
  record(_system: WorldGraphSystemId, path: string, value: string | number | boolean, reason: string, visible: boolean, previous?: string | number | boolean): void {
    const key = `${path}|${reason}`;
    const existing = this.rows.get(key);
    if (existing) { this.rows.set(key, { ...existing, value, visible }); return; }
    this.rows.set(key, { path, op: "set", value, reason, visible, ...(previous === undefined ? {} : { previous }) });
  }
  finish(): StateChange[] { return [...this.rows.values()].filter((row) => row.previous === undefined || row.previous !== row.value).sort((a, b) => a.path.localeCompare(b.path) || a.reason.localeCompare(b.reason)); }
}
