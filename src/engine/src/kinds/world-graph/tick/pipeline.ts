import type { KindContext } from "../../../core/kernel/types.js";
import { assertReferentialIntegrity } from "../actions/common.js";
import { evaluateCondition } from "../conditions.js";
import type { WorldGraphCampaign } from "../content.js";
import type { WorldGraphKindState } from "../state.js";
import type { TickChanges } from "./changes.js";
import { applyScenarioEffects } from "./effects.js";
import { WORLD_GRAPH_SYSTEM_IDS, type WorldGraphSystemId } from "./order.js";
import { createTickRandom, type TickRandom } from "./random.js";
import { createTickScratch, type TickScratch } from "./scratch.js";

export type { WorldGraphSystemId } from "./order.js";
export { BatchChanges } from "./changes.js";

export interface WorldGraphTickFrame {
  readonly processingTick: number;
  readonly content: WorldGraphCampaign;
  readonly emit: KindContext["emit"];
  readonly random: TickRandom;
  readonly scratch: TickScratch;
  readonly changes: TickChanges;
  readonly state: WorldGraphKindState;
}

export type WorldGraphSystem = (frame: WorldGraphTickFrame) => WorldGraphTickFrame;

interface WorldGraphSystemEntry {
  readonly id: WorldGraphSystemId;
  readonly run: WorldGraphSystem;
}

function scalar(
  frame: WorldGraphTickFrame,
  system: WorldGraphSystemId,
  path: string,
  previous: number,
  value: number,
  reason: string,
  visible = false,
): void {
  if (previous !== value) frame.changes.record(system, path, value, reason, visible, previous);
}

/** System 1: day boundaries, scheduled changes, and active policy effects. */
export const scenario: WorldGraphSystem = (frame) => {
  const source = frame.state;
  const scenarioDefinition = frame.content.scenarios.find((entry) => entry.id === frame.content.startScenarioId);
  if (!scenarioDefinition) throw new Error("Validated world-graph scenario missing");
  let state = source;
  if (frame.processingTick % frame.content.ticksPerDay === 0) {
    state = { ...state, finances: { ...state.finances, revenueTodayCents: 0, expensesTodayCents: 0 } };
    scalar(frame, "scenario", "finances.revenueTodayCents", source.finances.revenueTodayCents, 0, "day_started");
    scalar(frame, "scenario", "finances.expensesTodayCents", source.finances.expensesTodayCents, 0, "day_started");
  }

  const scheduled = scenarioDefinition.scheduledChanges
    .map((change, index) => ({ change, index }))
    .filter(({ change }) => (
      change.dueTick === frame.processingTick && evaluateCondition(change.condition, source, frame.content)
    ))
    .sort((left, right) => (
      left.change.dueTick - right.change.dueTick
      || right.change.priority - left.change.priority
      || left.index - right.index
    ));
  const policies = frame.content.policies
    .filter((policy) => source.activePolicyIds.includes(policy.id))
    .sort((left, right) => left.id.localeCompare(right.id));
  const effects = [
    ...scheduled.flatMap(({ change }) => change.effects),
    ...policies.flatMap((policy) => policy.whileActive),
  ];
  const result = applyScenarioEffects(state, effects, {
    processingTick: frame.processingTick,
    content: frame.content,
    random: frame.random,
    changes: frame.changes,
  });
  effects.forEach((effect, index) => {
    if (!result.applied[index]) return;
    frame.emit.emit("kind.world-graph.scenario.effect.applied", "debug", {
      data: { effect: effect.kind, tick: frame.processingTick },
    });
  });
  return { ...frame, state: result.state };
};

/** System 2 (`guest-spawn`): W47 implementation boundary. */
export const guestSpawn: WorldGraphSystem = (frame) => frame;
/** System 3 (`guest-needs`): W47 implementation boundary. */
export const guestNeeds: WorldGraphSystem = (frame) => frame;
/** System 4 (`guest-service`): W47 implementation boundary. */
export const guestService: WorldGraphSystem = (frame) => frame;
/** System 5 (`queues`): W47 implementation boundary. */
export const queues: WorldGraphSystem = (frame) => frame;
/** System 6 (`guest-intent`): W47 implementation boundary. */
export const guestIntent: WorldGraphSystem = (frame) => frame;
/** System 7 (`guest-path`): W47 implementation boundary. */
export const guestPath: WorldGraphSystem = (frame) => frame;
/** System 8 (`guest-move`): W47 implementation boundary. */
export const guestMove: WorldGraphSystem = (frame) => frame;
/** System 9 (`task-generate`): W47 implementation boundary. */
export const taskGenerate: WorldGraphSystem = (frame) => frame;
/** System 10 (`task-assign`): W47 implementation boundary. */
export const taskAssign: WorldGraphSystem = (frame) => frame;
/** System 11 (`staff-work`): W47 implementation boundary. */
export const staffWork: WorldGraphSystem = (frame) => frame;
/** System 12 (`construction`): W47 implementation boundary. */
export const construction: WorldGraphSystem = (frame) => frame;
/** System 13 (`buildings`): W47 implementation boundary. */
export const buildings: WorldGraphSystem = (frame) => frame;
/** System 14 (`cleanliness-wear`): W47 implementation boundary. */
export const cleanlinessWear: WorldGraphSystem = (frame) => frame;
/** System 15 (`finance`): W47 implementation boundary. */
export const finance: WorldGraphSystem = (frame) => frame;
/** System 16 (`incidents`): W47 implementation boundary. */
export const incidents: WorldGraphSystem = (frame) => frame;
/** System 17 (`objectives`): W47 implementation boundary. */
export const objectives: WorldGraphSystem = (frame) => frame;
/** System 18 (`failure`): W47 implementation boundary. */
export const failure: WorldGraphSystem = (frame) => frame;
/** System 19 (`alerts`): W47 implementation boundary. */
export const alerts: WorldGraphSystem = (frame) => frame;

/** System 20: per-tick cleanup, integrity assertion, and the sole tick write. */
export const tickFinalize: WorldGraphSystem = (frame) => {
  const removedGuestIds = new Set(frame.state.guests
    .filter((guest) => guest.lifecycle === "departed" || guest.lifecycle === "removed")
    .map((guest) => guest.id));
  const guests = frame.state.guests.filter((guest) => !removedGuestIds.has(guest.id));
  const buildingsAfterGuests = frame.state.buildings.map((building) => ({
    ...building,
    queue: { ...building.queue, guestIds: building.queue.guestIds.filter((id) => !removedGuestIds.has(id)) },
  }));
  const staff = frame.state.staff.map((member) => (
    member.task?.status === "completed" || member.task?.status === "cancelled"
      ? { ...member, task: null, status: member.status === "off_duty" ? "off_duty" as const : "idle" as const }
      : member
  ));
  const retainedIncidents = frame.state.incidents.filter((incident) => (
    incident.resolvedAtTick === null
    || !(frame.processingTick > incident.resolvedAtTick
      && frame.processingTick >= incident.startedAtTick
        + (frame.content.incidents.find((definition) => definition.id === incident.definitionId)?.cooldownTicks ?? 0))
  ));
  const retainedAlerts = frame.state.alerts.filter((alert) => ![alert.clearedAtTick, alert.dismissedAtTick]
    .some((at) => at !== null && at < frame.processingTick));
  const state = {
    ...frame.state,
    guests,
    buildings: buildingsAfterGuests,
    staff,
    incidents: retainedIncidents,
    alerts: retainedAlerts,
    tick: frame.processingTick + 1,
  };
  assertReferentialIntegrity(state);
  frame.changes.record("tick-finalize", "tick", state.tick, "ticks_advanced", true, frame.processingTick);
  frame.emit.emit("kind.world-graph.tick.finalized", "debug", { data: { tick: frame.processingTick } });
  return { ...frame, state };
};

const SYSTEM_BY_ID: Readonly<Record<WorldGraphSystemId, WorldGraphSystem>> = {
  "scenario": scenario,
  "guest-spawn": guestSpawn,
  "guest-needs": guestNeeds,
  "guest-service": guestService,
  "queues": queues,
  "guest-intent": guestIntent,
  "guest-path": guestPath,
  "guest-move": guestMove,
  "task-generate": taskGenerate,
  "task-assign": taskAssign,
  "staff-work": staffWork,
  "construction": construction,
  "buildings": buildings,
  "cleanliness-wear": cleanlinessWear,
  "finance": finance,
  "incidents": incidents,
  "objectives": objectives,
  "failure": failure,
  "alerts": alerts,
  "tick-finalize": tickFinalize,
};

export const WORLD_GRAPH_SYSTEMS = WORLD_GRAPH_SYSTEM_IDS.map((id): WorldGraphSystemEntry => ({
  id,
  run: SYSTEM_BY_ID[id],
}));

export function runWorldGraphTick(
  state: WorldGraphKindState,
  content: WorldGraphCampaign,
  ctx: Pick<KindContext, "derive" | "emit">,
  changes: TickChanges,
  systems: readonly WorldGraphSystemEntry[] = WORLD_GRAPH_SYSTEMS,
): WorldGraphKindState {
  const processingTick = state.tick;
  const scratch = createTickScratch();
  const random = createTickRandom(processingTick, ctx.derive, scratch);
  let frame: WorldGraphTickFrame = {
    processingTick,
    content,
    emit: ctx.emit,
    random,
    scratch,
    changes,
    state,
  };
  for (const system of systems) {
    const previousTick = frame.processingTick;
    frame = system.run(frame);
    if (frame.processingTick !== previousTick) throw new Error(`World-graph system ${system.id} changed processingTick`);
  }
  if (frame.state.tick !== processingTick + 1) throw new Error("World-graph tick did not finalize exactly once");
  return frame.state;
}
