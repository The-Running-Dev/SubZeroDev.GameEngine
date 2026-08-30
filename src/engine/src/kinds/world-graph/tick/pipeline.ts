import type { KindContext } from "../../../core/kernel/types.js";
import { runSystems, type SystemEntry } from "../../../core/pipeline/systems.js";
import { assertReferentialIntegrity } from "../actions/common.js";
import { evaluateCondition, evaluateMetric } from "../conditions.js";
import { WORLD_GRAPH_EVENTS } from "../events.js";
import type { BuildingDefinition, IncidentDefinition, IncidentRollScope, IntegerCurve, ProductDefinition, WorldGraphCampaign } from "../content.js";
import type { Alert, AlertSeverity, AlertType, Building, ConstructionSite, Guest, Incident, IncidentSeverity, Position, StaffTask, WorldGraphKindState } from "../state.js";
import { canonicalPath, canonicalPathWithCost, footprintCells, rotateOffset } from "../spatial.js";
import type { TickChanges } from "./changes.js";
import { applyWorldEffects, clamp, resolveDuration, safeAdd } from "./effects.js";
import { compareDefinitionId, compareRuntimeEntityId, WORLD_GRAPH_SYSTEM_IDS, type WorldGraphSystemId } from "./order.js";
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

/** The shared substrate's entry (04 §20), narrowed to this kind's own closed id union — the
 *  substrate never reads `id`, so narrowing it costs the substrate nothing and keeps the
 *  twenty-entry list checkable against `WORLD_GRAPH_SYSTEM_IDS`. */
interface WorldGraphSystemEntry extends SystemEntry<WorldGraphTickFrame> {
  readonly id: WorldGraphSystemId;
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

const positionOrder = (left: Position, right: Position): number => left.y - right.y || left.x - right.x;
const samePosition = (left: Position, right: Position): boolean => left.x === right.x && left.y === right.y;
const activeGuest = (guest: Guest): boolean => guest.lifecycle !== "departed" && guest.lifecycle !== "removed";
const definition = <T extends { readonly id: string }>(items: readonly T[], id: string, label: string): T => {
  const item = items.find((entry) => entry.id === id);
  if (!item) throw new Error(`Validated world-graph ${label} missing: ${id}`);
  return item;
};
function workRate(role: { readonly workRates: readonly { readonly taskType: string; readonly effortPerTick: number }[] }, taskType: string): number {
  return Math.max(0, role.workRates.find((entry) => entry.taskType === taskType)?.effortPerTick ?? 0);
}
function curve(curveDefinition: IntegerCurve, value: number): number {
  const points = [...curveDefinition.points].sort((left, right) => left.input - right.input);
  const before = points.filter((point) => point.input <= value).at(-1) ?? points[0];
  const after = points.find((point) => point.input >= value) ?? points.at(-1);
  if (!before || !after || curveDefinition.interpolation === "step" || before.input === after.input) return before?.output ?? 0;
  const numerator = (after.output - before.output) * (value - before.input);
  const denominator = after.input - before.input;
  const rounded = numerator < 0 ? -Math.floor((-numerator * 2 + denominator) / (denominator * 2)) : Math.floor((numerator * 2 + denominator) / (denominator * 2));
  return before.output + rounded;
}
function entrances(building: Pick<Building, "definitionId" | "x" | "y" | "rotation">, content: WorldGraphCampaign): readonly Position[] {
  const item = definition(content.buildings, building.definitionId, "building definition");
  return item.entrances.map((offset) => rotateOffset(offset, item.footprint.width, item.footprint.height, building.rotation)).map((offset) => ({ x: building.x + offset.x, y: building.y + offset.y })).sort(positionOrder);
}
function serviceProduct(building: Building, productId: string | null, content: WorldGraphCampaign): { readonly definition: BuildingDefinition; readonly product: ProductDefinition; readonly serviceTicks: number } | null {
  const buildingDefinition = definition(content.buildings, building.definitionId, "building definition");
  if (building.status !== "open" || buildingDefinition.operation.kind !== "service") return null;
  const offered = buildingDefinition.operation.products.filter((entry) => productId === null || entry.productId === productId).sort((left, right) => compareDefinitionId(left.productId, right.productId))[0];
  if (!offered) return null;
  return { definition: buildingDefinition, product: definition(content.products, offered.productId, "product"), serviceTicks: offered.serviceTicks ?? buildingDefinition.operation.baseServiceTicks };
}
function hasServiceLabor(state: WorldGraphKindState, buildingId: string, buildingDefinition: BuildingDefinition): boolean {
  if (buildingDefinition.operation.kind !== "service") return false;
  return buildingDefinition.operation.staffRequirements.every((requirement) => state.staff.filter((member) => (
    member.roleId === requirement.roleId
    && member.assignedBuildingId === buildingId
    && member.status === "working"
    && member.task?.type === "service"
    && member.task.status === "in_progress"
    && member.task.buildingId === buildingId
  )).length >= requirement.count);
}
function pathTo(mapState: WorldGraphKindState, content: WorldGraphCampaign, guest: Guest, goals: readonly Position[]): readonly Position[] | null {
  return canonicalPath(mapState.map, content.terrain, { x: guest.x, y: guest.y }, goals, mapState.buildings, mapState.constructionSites);
}
function leaveIntent(state: WorldGraphKindState, content: WorldGraphCampaign, guest: Guest, tick: number, reason: Guest["intent"] extends never ? never : "stay_complete" | "unaffordable" | "unreachable" | "dissatisfied" | "unsafe" | "critical_need" | "scenario"): Guest["intent"] {
  const exit = [...state.map.exits].map((candidateExit) => ({ candidateExit, path: pathTo(state, content, guest, [candidateExit]) })).filter((entry): entry is { readonly candidateExit: Position; readonly path: readonly Position[] } => entry.path !== null).sort((left, right) => (left.path.length - right.path.length) || positionOrder(left.candidateExit, right.candidateExit))[0]?.candidateExit;
  if (!exit) throw new Error("Validated world-graph map has no exit");
  return { kind: "leave", exit, reason, selectedAtTick: tick };
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
    .sort((left, right) => compareDefinitionId(left.id, right.id));
  const effects = [
    ...scheduled.flatMap(({ change }) => change.effects),
    ...policies.flatMap((policy) => policy.whileActive),
  ];
  const result = applyWorldEffects(state, effects, {
    processingTick: frame.processingTick,
    content: frame.content,
    random: frame.random,
    changes: frame.changes,
    system: "scenario",
    reason: "scenario_effect",
    deferBuildingMeters: { scratch: frame.scratch, source: "policy" },
  });
  effects.forEach((effect, index) => {
    // `building_meter_delta` is deferred to system 14 (§9.2): whether it actually moved a
    // meter is unknown until every source composes and clamps once, so its own
    // `scenario.effect.applied` fires there instead — never here, on the raw pre-composition
    // delta (W95.3).
    if (effect.kind === "building_meter_delta") return;
    if (!result.applied[index]) return;
    frame.emit.emit(WORLD_GRAPH_EVENTS.scenarioEffectApplied.name, WORLD_GRAPH_EVENTS.scenarioEffectApplied.severity, {
      data: { effect: effect.kind, tick: frame.processingTick },
    });
  });
  return { ...frame, state: result.state };
};

/** System 2: deterministic arrival sampling from the scenario's ordered pool. */
export const guestSpawn: WorldGraphSystem = (frame) => {
  const scenarioDefinition = definition(frame.content.scenarios, frame.content.startScenarioId, "scenario");
  if (frame.state.resolution || frame.processingTick % scenarioDefinition.guestSpawning.everyTicks !== 0 || frame.state.guests.filter(activeGuest).length >= scenarioDefinition.guestSpawning.maxActiveGuests) return frame;
  const spawn = [...frame.state.map.spawnPoints].sort(positionOrder)[0];
  if (!spawn) return frame;
  const pool = [...scenarioDefinition.guestSpawning.pool].sort((left, right) => compareDefinitionId(left.archetypeId, right.archetypeId));
  const archetypeId = frame.random.tickRng("guest-spawn").weightedPick(pool.map((entry) => ({ item: entry.archetypeId, weight: entry.weight })));
  const archetype = definition(frame.content.guestArchetypes, archetypeId, "guest archetype");
  const id = `guest:${frame.state.nextEntityOrdinal}`;
  let drawCount = 0;
  const draw = (range: { readonly min: number; readonly max: number }): number => { const result = frame.random.drawAgent({ id, drawCount }, (rng) => rng.nextInt(range.min, range.max)); drawCount = result.drawCount; return result.value; };
  const cashCents = draw(archetype.cashCents);
  const stayDurationTicks = draw(archetype.stayTicks);
  const patienceCapacityTicks = draw(archetype.patienceTicks);
  const satisfaction = draw(archetype.initialSatisfaction);
  const needs = Object.fromEntries(archetype.needs.map((entry) => [entry.needId, draw(entry.initial)]));
  const conditions = Object.fromEntries(archetype.conditions.map((entry) => [entry.definitionId, draw(entry.initial)]));
  const opinions = Object.fromEntries(archetype.opinions.map((entry) => [entry.definitionId, draw(entry.initial)]));
  const preferences = Object.fromEntries(archetype.preferences.map((entry) => [entry.definitionId, draw(entry.initial)]));
  const guest: Guest = {
    id, archetypeId, lifecycle: "arriving", tickEntered: frame.processingTick, stayDurationTicks,
    x: spawn.x, y: spawn.y, path: [], pathIndex: 0, drawCount, cashCents,
    intent: { kind: "wait", untilTick: frame.processingTick, selectedAtTick: frame.processingTick },
    needs, conditions, opinions, preferences, satisfaction, patienceCapacityTicks, patienceRemainingTicks: 0, lastServedTick: null, spentTicks: 0,
  };
  const state = { ...frame.state, guests: [...frame.state.guests, guest], counters: { ...frame.state.counters, guestsEntered: frame.state.counters.guestsEntered + 1 }, nextEntityOrdinal: frame.state.nextEntityOrdinal + 1 };
  frame.changes.record("guest-spawn", `guests.${id}.exists`, true, "guest_spawned", false, false);
  frame.emit.emit(WORLD_GRAPH_EVENTS.guestSpawned.name, WORLD_GRAPH_EVENTS.guestSpawned.severity, { data: { guestId: id, archetypeId } });
  return { ...frame, state };
};
/** System 3: evolve meters and make threshold departures explicit. */
export const guestNeeds: WorldGraphSystem = (frame) => {
  const meterChanges: { readonly guestId: string; readonly needId: string; readonly value: number }[] = [];
  const guests = frame.state.guests.map((guest) => {
    if (!activeGuest(guest)) return guest;
    const archetype = definition(frame.content.guestArchetypes, guest.archetypeId, "guest archetype");
    const needs = { ...guest.needs };
    for (const profile of archetype.needs) {
      const needDefinition = definition(frame.content.needs, profile.needId, "need");
      const value = Math.max(needDefinition.minimum, Math.min(needDefinition.maximum, needs[profile.needId]! + curve(profile.driftByCurrentValue, needs[profile.needId]!)));
      if (value !== needs[profile.needId]) meterChanges.push({ guestId: guest.id, needId: profile.needId, value });
      needs[profile.needId] = value;
    }
    const patience = guest.lifecycle === "queued" ? Math.max(0, guest.patienceRemainingTicks - 1) : guest.patienceRemainingTicks;
    const critical = archetype.needs.some((profile) => needs[profile.needId]! <= definition(frame.content.needs, profile.needId, "need").criticalBelow);
    const expired = guest.spentTicks + 1 >= guest.stayDurationTicks;
    return { ...guest, lifecycle: guest.lifecycle === "arriving" ? "seeking" : guest.lifecycle, needs, spentTicks: guest.spentTicks + 1, patienceRemainingTicks: patience, ...(expired || critical ? { intent: leaveIntent(frame.state, frame.content, guest, frame.processingTick, expired ? "stay_complete" : "critical_need"), path: [], pathIndex: 0 } : {}) };
  });
  for (const change of meterChanges.sort((left, right) => compareRuntimeEntityId(left.guestId, right.guestId) || compareDefinitionId(left.needId, right.needId))) {
    frame.emit.emit(WORLD_GRAPH_EVENTS.guestMeterChanged.name, WORLD_GRAPH_EVENTS.guestMeterChanged.severity, { data: { guestId: change.guestId, meter: change.needId, value: change.value } });
  }
  return { ...frame, state: { ...frame.state, guests } };
};
/** System 4: complete due FIFO services as one atomic sale. */
export const guestService: WorldGraphSystem = (frame) => {
  let state = frame.state;
  for (const building of [...state.buildings].sort((left, right) => compareRuntimeEntityId(left.id, right.id))) {
    const headId = building.queue.guestIds[0]; const guest = state.guests.find((entry) => entry.id === headId);
    if (!guest || building.queue.serviceStartedAtTick === null || guest.intent.kind !== "seek_service") continue;
    const offer = serviceProduct(building, guest.intent.productId, frame.content);
    if (!offer || frame.processingTick - building.queue.serviceStartedAtTick < offer.serviceTicks) continue;
    const operation = offer.definition.operation;
    if (operation.kind !== "service") continue;
    const price = building.pricesCents[offer.product.id]; const stock = building.inventory[offer.product.id];
    const staffed = hasServiceLabor(state, building.id, offer.definition);
    if (price === undefined || price > guest.cashCents || stock === undefined || stock === 0 || !staffed) continue;
    state = { ...state, guests: state.guests.map((entry) => entry.id === guest.id ? { ...entry, lifecycle: "served", cashCents: entry.cashCents - price, lastServedTick: frame.processingTick } : entry), buildings: state.buildings.map((entry) => entry.id === building.id ? { ...entry, inventory: stock === null ? entry.inventory : { ...entry.inventory, [offer.product.id]: stock - 1 } } : entry), finances: { ...state.finances, cashCents: state.finances.cashCents + price - offer.product.unitCostCents, revenueTodayCents: state.finances.revenueTodayCents + price, revenueTotalCents: state.finances.revenueTotalCents + price, expensesTodayCents: state.finances.expensesTodayCents + offer.product.unitCostCents, expensesTotalCents: state.finances.expensesTotalCents + offer.product.unitCostCents }, counters: { ...state.counters, servicesCompleted: state.counters.servicesCompleted + 1 } };
    state = applyWorldEffects(state, [...operation.effects, ...offer.product.effects], { processingTick: frame.processingTick, content: frame.content, random: frame.random, changes: frame.changes, system: "guest-service", reason: "guest_served", currentServiceGuestId: guest.id, currentServiceBuildingId: building.id, deferBuildingMeters: { scratch: frame.scratch, source: "service" } }).state;
    if (offer.product.litter) {
      const incidentId = `incident:${state.nextEntityOrdinal}`;
      state = { ...state, incidents: [...state.incidents, { id: incidentId, definitionId: offer.product.litter.incidentDefinitionId, buildingId: building.id, guestId: null, zoneId: null, position: { x: guest.x, y: guest.y }, amount: offer.product.litter.unitsPerService, startedAtTick: frame.processingTick, expiresAtTick: null, resolvedAtTick: null }], nextEntityOrdinal: state.nextEntityOrdinal + 1, counters: { ...state.counters, incidentsRaised: state.counters.incidentsRaised + 1, litterCreated: state.counters.litterCreated + offer.product.litter.unitsPerService } };
    }
    frame.emit.emit(WORLD_GRAPH_EVENTS.guestServed.name, WORLD_GRAPH_EVENTS.guestServed.severity, { data: { guestId: guest.id, buildingId: building.id } });
  }
  return { ...frame, state };
};
/** System 5: preserve FIFO membership, admit arrivals, and restart clocks on change. */
export const queues: WorldGraphSystem = (frame) => {
  let state = frame.state;
  for (const building of [...state.buildings].sort((left, right) => compareRuntimeEntityId(left.id, right.id))) {
    const offer = serviceProduct(building, null, frame.content);
    const capacity = offer?.definition.operation.kind === "service" ? offer.definition.operation.queueMaxLength : null;
    const existingIds = building.queue.guestIds;
    const previousHeadId = existingIds[0] ?? null;
    const served = state.guests.filter((guest) => guest.lifecycle === "served" && existingIds.includes(guest.id));
    if (served.length) state = { ...state, guests: state.guests.map((guest) => served.some((entry) => entry.id === guest.id) ? { ...guest, lifecycle: "seeking", intent: { kind: "wait", untilTick: frame.processingTick, selectedAtTick: frame.processingTick }, path: [], pathIndex: 0 } : guest) };
    let ids = existingIds.filter((id) => { const guest = state.guests.find((entry) => entry.id === id); return guest?.lifecycle === "queued"; });
    const abandon = ids.filter((id) => state.guests.find((guest) => guest.id === id)?.patienceRemainingTicks === 0);
    if (abandon.length) {
      state = { ...state, guests: state.guests.map((guest) => abandon.includes(guest.id) ? { ...guest, lifecycle: "seeking", intent: { kind: "wait", untilTick: frame.processingTick, selectedAtTick: frame.processingTick }, path: [], pathIndex: 0 } : guest) };
      for (const guestId of abandon) frame.emit.emit(WORLD_GRAPH_EVENTS.queueAbandoned.name, WORLD_GRAPH_EVENTS.queueAbandoned.severity, { data: { buildingId: building.id, guestId } });
    }
    ids = ids.filter((id) => !abandon.includes(id));
    // §9.1: a queued guest switches away only when the best reachable alternative beats
    // its current committed building/product by more than `switchThresholdUtility`;
    // equality stays put. An alternative that has since become ineligible for the current
    // choice (closed, sold out, unaffordable, unreachable) also triggers a switch when a
    // valid alternative exists.
    const switching = ids.filter((id) => {
      const guest = state.guests.find((entry) => entry.id === id);
      if (!guest || guest.intent.kind !== "seek_service") return false;
      const archetype = definition(frame.content.guestArchetypes, guest.archetypeId, "guest archetype");
      const current = scoreProduct(state, frame.content, frame.processingTick, guest, building, guest.intent.productId);
      const bestAlternative = state.buildings
        .filter((entry) => entry.id !== building.id)
        .map((entry) => candidate(state, frame.content, frame.processingTick, guest, entry))
        .filter((entry): entry is ProductScore => entry !== null)
        .sort((left, right) => right.score - left.score || compareDefinitionId(left.productId, right.productId))[0] ?? null;
      if (bestAlternative === null) return false;
      if (current === null) return true;
      return bestAlternative.score - current.score > archetype.switchThresholdUtility;
    });
    if (switching.length) state = { ...state, guests: state.guests.map((guest) => switching.includes(guest.id) ? { ...guest, lifecycle: "seeking", intent: { kind: "wait", untilTick: frame.processingTick, selectedAtTick: frame.processingTick }, path: [], pathIndex: 0 } : guest) };
    ids = ids.filter((id) => !switching.includes(id));
    const arrivals = state.guests.filter((guest) => guest.lifecycle === "seeking" && guest.intent.kind === "seek_service" && guest.intent.buildingId === building.id && entrances(building, frame.content).some((entry) => samePosition(entry, guest))).sort((left, right) => compareRuntimeEntityId(left.id, right.id));
    for (const guest of arrivals) {
      if (capacity !== null && ids.length >= capacity) break;
      ids.push(guest.id);
      state = { ...state, guests: state.guests.map((entry) => entry.id === guest.id ? { ...entry, lifecycle: "queued", patienceRemainingTicks: entry.patienceCapacityTicks } : entry) };
      frame.emit.emit(WORLD_GRAPH_EVENTS.queueJoined.name, WORLD_GRAPH_EVENTS.queueJoined.severity, { data: { buildingId: building.id, guestId: guest.id } });
    }
    const head = state.guests.find((guest) => guest.id === ids[0]);
    const headOffer = head?.intent.kind === "seek_service" ? serviceProduct(building, head.intent.productId, frame.content) : null;
    const canServe = headOffer !== null && head !== undefined && hasServiceLabor(state, building.id, headOffer.definition);
    const headChanged = previousHeadId !== (ids[0] ?? null);
    const clock = canServe ? (headChanged ? frame.processingTick : building.queue.serviceStartedAtTick ?? frame.processingTick) : null;
    if (clock !== null && clock !== building.queue.serviceStartedAtTick) {
      frame.emit.emit(WORLD_GRAPH_EVENTS.serviceStarted.name, WORLD_GRAPH_EVENTS.serviceStarted.severity, { data: { buildingId: building.id, guestId: head!.id, productId: headOffer!.product.id } });
    }
    state = { ...state, buildings: state.buildings.map((entry) => entry.id === building.id ? { ...entry, queue: { ...entry.queue, guestIds: ids, serviceStartedAtTick: clock } } : entry) };
  }
  return { ...frame, state };
};
const INCIDENT_SEVERITY_POINTS: Readonly<Record<IncidentSeverity, number>> = { info: 0, minor: 1, major: 10, critical: 100 };

/** §9.1's "canonically summed applicable adjacency input" for the attractiveness component. */
function attractivenessInput(state: WorldGraphKindState, content: WorldGraphCampaign, building: Building): number {
  const targetCells = entrances(building, content);
  const sources = [
    ...state.map.scenery.map((entry) => ({
      id: entry.id,
      effects: definition(content.scenery, entry.definitionId, "scenery definition").adjacencyEffects,
      cells: footprintCells(entry.x, entry.y, entry.width, entry.height),
    })),
    ...state.buildings.filter((entry) => entry.id !== building.id).map((entry) => ({
      id: entry.id,
      effects: definition(content.buildings, entry.definitionId, "building definition").adjacencyEffects,
      cells: footprintCells(entry.x, entry.y, entry.width, entry.height),
    })),
  ].sort((left, right) => compareRuntimeEntityId(left.id, right.id));
  let total = 0;
  for (const source of sources) {
    for (const effect of source.effects) {
      if (effect.metric !== "attractiveness" || effect.target.kind !== "building") continue;
      if (effect.target.definitionIds !== null && !effect.target.definitionIds.includes(building.definitionId)) continue;
      const distance = Math.min(...source.cells.flatMap((cell) => targetCells.map((target) => Math.max(Math.abs(cell.x - target.x), Math.abs(cell.y - target.y)))));
      if (distance <= effect.radiusTiles) total += effect.delta;
    }
  }
  return total;
}

/** §9.1's safety-concern component: active incident severity points at the building's footprint or entrances. */
function safetyInput(state: WorldGraphKindState, content: WorldGraphCampaign, building: Building): number {
  const relevant = [...footprintCells(building.x, building.y, building.width, building.height), ...entrances(building, content)];
  let total = 0;
  for (const incident of state.incidents) {
    const position = incident.position;
    if (incident.resolvedAtTick !== null || position === null) continue;
    if (!relevant.some((cell) => samePosition(cell, position))) continue;
    total += INCIDENT_SEVERITY_POINTS[definition(content.incidents, incident.definitionId, "incident definition").severity];
  }
  return total;
}

/**
 * §9.1's queue-penalty component: remaining head service time plus each guest *ahead's*
 * declared duration. A guest not currently in this queue (`forGuestId` absent, or not
 * found) is evaluating joining at the back, so every queued guest is ahead of it. A guest
 * already holding a slot (`forGuestId` present in `guestIds`) only waits on guests strictly
 * ahead of its own position — guests behind it do not affect its own remaining wait.
 */
function estimatedWaitTicks(state: WorldGraphKindState, content: WorldGraphCampaign, processingTick: number, building: Building, forGuestId: string | null = null): number {
  const guestIds = building.queue.guestIds;
  if (guestIds.length === 0) return 0;
  const durationFor = (guestId: string): number => {
    const queuedGuest = state.guests.find((entry) => entry.id === guestId);
    const offer = queuedGuest?.intent.kind === "seek_service" ? serviceProduct(building, queuedGuest.intent.productId, content) : null;
    return offer?.serviceTicks ?? 0;
  };
  const headId = guestIds[0]!;
  const headOffer = (() => {
    const headGuest = state.guests.find((entry) => entry.id === headId);
    return headGuest?.intent.kind === "seek_service" ? serviceProduct(building, headGuest.intent.productId, content) : null;
  })();
  const remainingHead = building.queue.serviceStartedAtTick !== null && headOffer !== null
    ? Math.max(0, headOffer.serviceTicks - (processingTick - building.queue.serviceStartedAtTick))
    : durationFor(headId);
  const position = forGuestId !== null ? guestIds.indexOf(forGuestId) : -1;
  const ahead = position === -1 ? guestIds.slice(1) : guestIds.slice(1, Math.max(position, 1));
  return remainingHead + ahead.reduce((sum, id) => sum + durationFor(id), 0);
}

interface ProductScore { readonly productId: string; readonly score: number }

/** §9.1's nine signed components, in the contract's exact order. */
function scoreProduct(state: WorldGraphKindState, content: WorldGraphCampaign, processingTick: number, guest: Guest, building: Building, productId: string | null): ProductScore | null {
  const operation = definition(content.buildings, building.definitionId, "building definition").operation;
  if (operation.kind !== "service" || building.status !== "open") return null;
  const entry = productId === null
    ? [...operation.products].sort((left, right) => compareDefinitionId(left.productId, right.productId))[0]
    : operation.products.find((item) => item.productId === productId);
  if (!entry) return null;
  const product = definition(content.products, entry.productId, "product");
  const price = building.pricesCents[product.id]; const stock = building.inventory[product.id];
  const pathResult = canonicalPathWithCost(state.map, content.terrain, { x: guest.x, y: guest.y }, entrances(building, content), state.buildings, state.constructionSites);
  if (price === undefined || price > guest.cashCents || stock === 0 || pathResult === null) return null;
  // §9.1's switching exception: a guest already holding a slot in this building's queue is
  // not disqualified by its own occupancy, but an alternative that is already full is not
  // an eligible candidate — scoring it would let a guest abandon a valid queue for one the
  // admission guard in `queues` immediately refuses.
  if (operation.queueMaxLength !== null && !building.queue.guestIds.includes(guest.id) && building.queue.guestIds.length >= operation.queueMaxLength) {
    return null;
  }
  const archetype = definition(content.guestArchetypes, guest.archetypeId, "guest archetype");
  const needUrgency = Math.max(0, ...archetype.needs.map((profile) => curve(profile.utilityByCurrentValue, guest.needs[profile.needId] ?? 0)));
  const preferenceMatch = archetype.preferences.filter((profile) => definition(content.preferences, profile.definitionId, "preference").targetTags.some((tag) => product.tags.includes(tag) || definition(content.buildings, building.definitionId, "building definition").tags.includes(tag))).reduce((sum, profile) => sum + (guest.preferences[profile.definitionId] ?? 0), 0) * archetype.preferenceUtilityPerPoint;
  const socialRelevance = 0; // §9.1: exactly zero in v1, groups are not represented
  const quality = Math.trunc((building.cleanliness + building.wear) / 2) * archetype.qualityUtilityPerPoint;
  const attractiveness = attractivenessInput(state, content, building) * archetype.attractivenessUtilityPerPoint;
  const priceResistance = curve(archetype.priceResistance, price);
  const travelCost = pathResult.cost * archetype.travelPenaltyPerCost;
  const queuePenalty = estimatedWaitTicks(state, content, processingTick, building, guest.id) * archetype.queuePenaltyPerTick;
  const safetyConcern = safetyInput(state, content, building) * archetype.safetyPenaltyPerPoint;
  const score = needUrgency + preferenceMatch + socialRelevance + quality + attractiveness
    - priceResistance - travelCost - queuePenalty - safetyConcern;
  return { productId: product.id, score };
}

function candidate(state: WorldGraphKindState, content: WorldGraphCampaign, processingTick: number, guest: Guest, building: Building): ProductScore | null {
  const operation = definition(content.buildings, building.definitionId, "building definition").operation;
  if (operation.kind !== "service" || building.status !== "open") return null;
  const values = operation.products
    .map((entry) => scoreProduct(state, content, processingTick, guest, building, entry.productId))
    .filter((entry): entry is ProductScore => entry !== null);
  return values.sort((left, right) => right.score - left.score || compareDefinitionId(left.productId, right.productId))[0] ?? null;
}
/** System 6: choose the highest reachable, affordable service candidate. */
export const guestIntent: WorldGraphSystem = (frame) => {
  const selections: { readonly guestId: string; readonly intentKind: Guest["intent"]["kind"] }[] = [];
  const guests = frame.state.guests.map((guest) => {
    if (guest.lifecycle !== "seeking" || (guest.intent.kind === "wait" && guest.intent.untilTick > frame.processingTick)) return guest;
    const choices = frame.state.buildings.map((building) => ({ building, choice: candidate(frame.state, frame.content, frame.processingTick, guest, building) })).filter((entry): entry is { readonly building: Building; readonly choice: ProductScore } => entry.choice !== null).sort((left, right) => right.choice.score - left.choice.score || compareRuntimeEntityId(left.building.id, right.building.id) || compareDefinitionId(left.choice.productId, right.choice.productId));
    if (choices.length) {
      const intent = { kind: "seek_service" as const, buildingId: choices[0]!.building.id, productId: choices[0]!.choice.productId, selectedAtTick: frame.processingTick };
      selections.push({ guestId: guest.id, intentKind: intent.kind });
      return { ...guest, intent, path: [], pathIndex: 0 };
    }
    const archetype = definition(frame.content.guestArchetypes, guest.archetypeId, "guest archetype");
    if (archetype.fallback.kind === "leave") {
      const intent = leaveIntent(frame.state, frame.content, guest, frame.processingTick, "unreachable");
      selections.push({ guestId: guest.id, intentKind: intent.kind });
      return { ...guest, intent, path: [], pathIndex: 0 };
    }
    const intent = { kind: "wait" as const, untilTick: frame.processingTick + archetype.fallback.ticks, selectedAtTick: frame.processingTick };
    selections.push({ guestId: guest.id, intentKind: intent.kind });
    return { ...guest, intent };
  });
  for (const selection of selections.sort((left, right) => compareRuntimeEntityId(left.guestId, right.guestId))) {
    frame.emit.emit(WORLD_GRAPH_EVENTS.guestIntentSelected.name, WORLD_GRAPH_EVENTS.guestIntentSelected.severity, { data: { guestId: selection.guestId, intentKind: selection.intentKind } });
  }
  return { ...frame, state: { ...frame.state, guests } };
};
/** Systems 7–8: commit and traverse one canonical path edge per tick. */
export const guestPath: WorldGraphSystem = (frame) => {
  const outcomes: { readonly guestId: string; readonly failed: boolean }[] = [];
  const guests = frame.state.guests.map((guest) => {
    if (!activeGuest(guest) || guest.lifecycle === "queued" || guest.lifecycle === "served" || guest.intent.kind === "wait") return guest;
    const goals = guest.intent.kind === "leave" ? [guest.intent.exit] : entrances(definition(frame.state.buildings, guest.intent.buildingId, "building"), frame.content);
    if (guest.path.length > 0 && samePosition(guest.path.at(-1)!, goals[0]!)) return guest;
    const path = pathTo(frame.state, frame.content, guest, goals);
    if (path === null) {
      outcomes.push({ guestId: guest.id, failed: true });
      return { ...guest, intent: leaveIntent(frame.state, frame.content, guest, frame.processingTick, "unreachable"), path: [], pathIndex: 0 };
    }
    outcomes.push({ guestId: guest.id, failed: false });
    return { ...guest, path, pathIndex: 0 };
  });
  for (const outcome of outcomes.sort((left, right) => compareRuntimeEntityId(left.guestId, right.guestId))) {
    frame.emit.emit(
      outcome.failed ? WORLD_GRAPH_EVENTS.guestPathFailed.name : WORLD_GRAPH_EVENTS.guestPathCommitted.name,
      outcome.failed ? WORLD_GRAPH_EVENTS.guestPathFailed.severity : WORLD_GRAPH_EVENTS.guestPathCommitted.severity,
      { data: { guestId: outcome.guestId } },
    );
  }
  return { ...frame, state: { ...frame.state, guests } };
};
export const guestMove: WorldGraphSystem = (frame) => {
  let departed = 0;
  const moves: { readonly guestId: string; readonly departed: boolean }[] = [];
  const guests = frame.state.guests.map((guest) => {
    if (!activeGuest(guest) || guest.pathIndex >= guest.path.length - 1 || guest.lifecycle === "queued" || guest.lifecycle === "served") return guest;
    const position = guest.path[guest.pathIndex + 1]!; const next = { ...guest, x: position.x, y: position.y, pathIndex: guest.pathIndex + 1 };
    if (next.intent.kind === "leave" && samePosition(position, next.intent.exit)) { departed += 1; moves.push({ guestId: guest.id, departed: true }); return { ...next, lifecycle: "departed" as const }; }
    moves.push({ guestId: guest.id, departed: false });
    return next;
  });
  for (const move of moves.sort((left, right) => compareRuntimeEntityId(left.guestId, right.guestId))) {
    frame.emit.emit(
      move.departed ? WORLD_GRAPH_EVENTS.guestDeparted.name : WORLD_GRAPH_EVENTS.guestMoved.name,
      move.departed ? WORLD_GRAPH_EVENTS.guestDeparted.severity : WORLD_GRAPH_EVENTS.guestMoved.severity,
      { data: { guestId: move.guestId } },
    );
  }
  return { ...frame, state: { ...frame.state, guests, counters: departed ? { ...frame.state.counters, guestsDeparted: frame.state.counters.guestsDeparted + departed } : frame.state.counters } };
};
/** Systems 9–11: derive, assign and execute the MVP's service/cleaning work. */
export const taskGenerate: WorldGraphSystem = (frame) => {
  const before = frame.scratch.taskCandidates.length;
  for (const incident of frame.state.incidents.filter((entry) => entry.resolvedAtTick === null).sort((left, right) => compareRuntimeEntityId(left.id, right.id))) {
    const incidentDefinition = definition(frame.content.incidents, incident.definitionId, "incident definition");
    if (incidentDefinition.resolverTaskType === "clean" && incidentDefinition.resolverTaskPriority !== null) frame.scratch.taskCandidates.push({ type: "clean", priority: incidentDefinition.resolverTaskPriority, effort: incident.amount, buildingId: incident.buildingId, incidentId: incident.id, constructionSiteId: null, productId: null, requiredRoleId: null, slot: 0 });
  }
  for (const building of frame.state.buildings) {
    const operation = definition(frame.content.buildings, building.definitionId, "building definition").operation;
    if (operation.kind !== "service" || building.queue.guestIds.length === 0) continue;
    for (const requirement of operation.staffRequirements) for (let slot = 0; slot < requirement.count; slot += 1) frame.scratch.taskCandidates.push({ type: "service", priority: operation.staffingTaskPriority, effort: null, buildingId: building.id, incidentId: null, constructionSiteId: null, productId: null, requiredRoleId: requirement.roleId, slot });
  }
  for (const site of [...frame.state.constructionSites].sort((left, right) => compareRuntimeEntityId(left.id, right.id))) {
    const siteDefinition = definition(frame.content.buildings, site.definitionId, "building definition");
    frame.scratch.taskCandidates.push({ type: "build", priority: siteDefinition.constructionTaskPriority, effort: site.workRemaining, buildingId: null, incidentId: null, constructionSiteId: site.id, productId: null, requiredRoleId: null, slot: 0 });
  }
  for (const building of [...frame.state.buildings].sort((left, right) => compareRuntimeEntityId(left.id, right.id))) {
    const operation = definition(frame.content.buildings, building.definitionId, "building definition").operation;
    if (operation.kind !== "service" || building.status !== "open") continue;
    for (const service of operation.products) {
      if (service.capacity === null) continue;
      const stock = building.inventory[service.productId] ?? 0;
      const missing = service.capacity - stock;
      if (missing <= 0) continue;
      frame.scratch.taskCandidates.push({ type: "restock", priority: service.restockTaskPriority, effort: missing, buildingId: building.id, incidentId: null, constructionSiteId: null, productId: service.productId, requiredRoleId: null, slot: 0 });
    }
  }
  const generated = frame.scratch.taskCandidates.length - before;
  if (generated > 0) frame.emit.emit(WORLD_GRAPH_EVENTS.taskCandidateGenerated.name, WORLD_GRAPH_EVENTS.taskCandidateGenerated.severity, { data: { count: generated } });
  return frame;
};
export const taskAssign: WorldGraphSystem = (frame) => {
  let state = frame.state;
  const taskOrder = { service: 0, clean: 1, restock: 2, build: 3 } as const;
  const candidates = [...frame.scratch.taskCandidates].sort((left, right) => right.priority - left.priority || taskOrder[left.type] - taskOrder[right.type] || compareRuntimeEntityId(left.incidentId ?? left.buildingId ?? "", right.incidentId ?? right.buildingId ?? "") || left.slot - right.slot);
  for (const member of [...state.staff].sort((left, right) => compareRuntimeEntityId(left.id, right.id))) {
    if (member.task !== null || member.status === "off_duty") continue;
    let candidateIndex = -1;
    let path: readonly Position[] | null = null;
    for (let index = 0; index < candidates.length; index += 1) {
      const candidate = candidates[index]!;
      const role = definition(frame.content.staffRoles, member.roleId, "staff role");
      if (!role.supportedTaskKinds.includes(candidate.type) || (candidate.requiredRoleId !== null && candidate.requiredRoleId !== member.roleId)) continue;
      if (candidate.type === "service" && member.assignedBuildingId !== candidate.buildingId) continue;
      const incident = candidate.incidentId === null ? undefined : state.incidents.find((entry) => entry.id === candidate.incidentId);
      const targetBuildingId = incident?.buildingId ?? candidate.buildingId;
      const targetBuilding = targetBuildingId === null ? undefined : state.buildings.find((building) => building.id === targetBuildingId);
      const targetSite = candidate.type === "build" && candidate.constructionSiteId !== null ? state.constructionSites.find((site) => site.id === candidate.constructionSiteId) : undefined;
      const targetZone = incident?.zoneId === null || incident?.zoneId === undefined ? undefined : state.map.zones.find((zone) => zone.id === incident.zoneId);
      const goals = incident?.position !== null && incident?.position !== undefined ? [incident.position]
        : targetBuilding !== undefined ? entrances(targetBuilding, frame.content)
          : targetSite !== undefined ? entrances(targetSite, frame.content)
            : targetZone === undefined ? [] : [...targetZone.cells].sort(positionOrder);
      if (goals.length === 0) continue;
      const candidatePath = canonicalPath(state.map, frame.content.terrain, { x: member.x, y: member.y }, goals, state.buildings, state.constructionSites);
      if (candidatePath === null) continue;
      candidateIndex = index;
      path = candidatePath;
      break;
    }
    if (candidateIndex < 0) continue;
    const candidate = candidates.splice(candidateIndex, 1)[0]!;
    const task: StaffTask = { id: `task:${state.nextEntityOrdinal}`, type: candidate.type, status: "assigned", guestId: null, queueId: null, buildingId: candidate.buildingId, constructionSiteId: candidate.constructionSiteId, incidentId: candidate.incidentId, targetProductId: candidate.productId, startedAtTick: frame.processingTick, endedAtTick: null, priority: candidate.priority, effortRemaining: candidate.effort };
    state = { ...state, staff: state.staff.map((entry) => entry.id === member.id ? { ...entry, task, path: path!, pathIndex: 0, status: "to_work" } : entry), nextEntityOrdinal: state.nextEntityOrdinal + 1 };
    frame.emit.emit(WORLD_GRAPH_EVENTS.staffTaskAssigned.name, WORLD_GRAPH_EVENTS.staffTaskAssigned.severity, { data: { staffId: member.id, taskId: task.id, type: task.type } });
  }
  return { ...frame, state };
};
export const staffWork: WorldGraphSystem = (frame) => {
  let state = frame.state;
  for (const member of [...state.staff].sort((left, right) => compareRuntimeEntityId(left.id, right.id))) {
    if (!member.task || member.status === "off_duty") continue;
    const role = definition(frame.content.staffRoles, member.roleId, "staff role");
    if (member.pathIndex < member.path.length - 1) {
      const moveProgressTicks = member.moveProgressTicks + 1;
      const move = moveProgressTicks >= role.moveTicksPerTile;
      const position = move ? member.path[member.pathIndex + 1]! : member;
      state = { ...state, staff: state.staff.map((entry) => entry.id === member.id ? {
        ...entry, x: position.x, y: position.y,
        pathIndex: move ? entry.pathIndex + 1 : entry.pathIndex,
        moveProgressTicks: move ? 0 : moveProgressTicks,
        status: "to_work",
      } : entry) };
      if (move) frame.emit.emit(WORLD_GRAPH_EVENTS.staffMoved.name, WORLD_GRAPH_EVENTS.staffMoved.severity, { data: { staffId: member.id, x: position.x, y: position.y } });
      continue;
    }
    if (member.task.type === "service" || member.task.type === "build" || member.task.type === "restock") { state = { ...state, staff: state.staff.map((entry) => entry.id === member.id ? { ...entry, status: "working", task: { ...entry.task!, status: "in_progress" } } : entry) }; continue; }
    if (member.task.type === "clean" && member.task.incidentId) {
      const incident = state.incidents.find((entry) => entry.id === member.task!.incidentId);
      if (!incident || incident.resolvedAtTick !== null) {
        state = { ...state, staff: state.staff.map((entry) => entry.id === member.id ? { ...entry, task: { ...entry.task!, status: "cancelled", endedAtTick: frame.processingTick } } : entry) };
        frame.emit.emit(WORLD_GRAPH_EVENTS.staffTaskCancelled.name, WORLD_GRAPH_EVENTS.staffTaskCancelled.severity, { data: { staffId: member.id, taskId: member.task.id } });
        continue;
      }
      const rate = workRate(role, "clean");
      const removed = Math.min(incident.amount, rate);
      const remaining = Math.max(0, incident.amount - rate);
      state = { ...state, incidents: state.incidents.map((entry) => entry.id === incident.id ? { ...entry, amount: remaining, resolvedAtTick: remaining === 0 ? frame.processingTick : null } : entry), staff: state.staff.map((entry) => entry.id === member.id ? { ...entry, status: remaining === 0 ? "idle" : "working", tasksCompleted: remaining === 0 ? entry.tasksCompleted + 1 : entry.tasksCompleted, task: remaining === 0 ? { ...entry.task!, status: "completed", endedAtTick: frame.processingTick } : { ...entry.task!, status: "in_progress", effortRemaining: remaining } } : entry), counters: { ...state.counters, litterCleaned: state.counters.litterCleaned + removed } };
      if (remaining === 0) {
        frame.changes.record("staff-work", `incidents.${incident.id}.resolvedAtTick`, frame.processingTick, "incident_resolved", false);
        state = applyWorldEffects(state, definition(frame.content.incidents, incident.definitionId, "incident definition").onResolve, { processingTick: frame.processingTick, content: frame.content, random: frame.random, changes: frame.changes, system: "staff-work", reason: "incident_resolved", currentIncidentId: incident.id, deferBuildingMeters: { scratch: frame.scratch, source: "staff" } }).state;
        frame.emit.emit(WORLD_GRAPH_EVENTS.incidentResolved.name, WORLD_GRAPH_EVENTS.incidentResolved.severity, { data: { incidentId: incident.id, definitionId: incident.definitionId, tick: frame.processingTick } });
        frame.emit.emit(WORLD_GRAPH_EVENTS.staffTaskCompleted.name, WORLD_GRAPH_EVENTS.staffTaskCompleted.severity, { data: { staffId: member.id, taskId: member.task.id } });
      }
    }
  }
  return { ...frame, state };
};
/** System 12: apply builder deltas to open sites, then complete zero-effort sites in id order. */
export const construction: WorldGraphSystem = (frame) => {
  const builderDeltas = new Map<string, number>();
  for (const member of frame.state.staff) {
    if (member.task?.type !== "build" || member.task.status !== "in_progress" || member.task.constructionSiteId === null) continue;
    const role = definition(frame.content.staffRoles, member.roleId, "staff role");
    const rate = workRate(role, "build");
    builderDeltas.set(member.task.constructionSiteId, (builderDeltas.get(member.task.constructionSiteId) ?? 0) + rate);
  }
  if (builderDeltas.size === 0) return frame;

  let staff = frame.state.staff;
  let map = frame.state.map;
  let counters = frame.state.counters;
  const remainingSites: ConstructionSite[] = [];
  const completedBuildings: Building[] = [];
  for (const site of [...frame.state.constructionSites].sort((left, right) => compareRuntimeEntityId(left.id, right.id))) {
    const delta = builderDeltas.get(site.id) ?? 0;
    if (delta === 0) { remainingSites.push(site); continue; }
    const workRemaining = Math.max(0, site.workRemaining - delta);
    frame.emit.emit(WORLD_GRAPH_EVENTS.constructionProgressed.name, WORLD_GRAPH_EVENTS.constructionProgressed.severity, { data: { constructionSiteId: site.id, workRemaining } });
    if (workRemaining > 0) { remainingSites.push({ ...site, workRemaining }); continue; }

    const buildingDefinition = definition(frame.content.buildings, site.definitionId, "building definition");
    const products = buildingDefinition.operation.kind === "service" ? buildingDefinition.operation.products : [];
    const building: Building = {
      id: site.completedBuildingId, definitionId: site.definitionId, x: site.x, y: site.y,
      width: site.width, height: site.height, rotation: site.rotation, status: "open",
      buildStartTick: frame.processingTick, wear: buildingDefinition.initialWear, cleanliness: buildingDefinition.initialCleanliness,
      queue: { id: site.completedQueueId, guestIds: [], serviceStartedAtTick: null },
      pricesCents: Object.fromEntries(products.map((service) => [service.productId, definition(frame.content.products, service.productId, "product").price.defaultCents])),
      inventory: Object.fromEntries(products.map((service) => [service.productId, service.initialUnits])),
    };
    completedBuildings.push(building);
    scalar(frame, "construction", "map.revision", map.revision, map.revision + 1, "building_completed", false);
    map = { ...map, revision: map.revision + 1 };
    counters = { ...counters, buildingsCompleted: counters.buildingsCompleted + 1 };
    const completedBuilders: { readonly staffId: string; readonly taskId: string }[] = [];
    staff = staff.map((entry) => {
      if (entry.task?.type !== "build" || entry.task.constructionSiteId !== site.id) return entry;
      completedBuilders.push({ staffId: entry.id, taskId: entry.task.id });
      return { ...entry, status: "idle", tasksCompleted: entry.tasksCompleted + 1, task: { ...entry.task, status: "completed", endedAtTick: frame.processingTick } };
    });
    for (const builder of completedBuilders.sort((left, right) => compareRuntimeEntityId(left.staffId, right.staffId))) {
      frame.emit.emit(WORLD_GRAPH_EVENTS.staffTaskCompleted.name, WORLD_GRAPH_EVENTS.staffTaskCompleted.severity, { data: { staffId: builder.staffId, taskId: builder.taskId } });
    }
    frame.changes.record("construction", `buildings.${building.id}.exists`, true, "building_completed", false);
    frame.changes.record("construction", `constructionSites.${site.id}.exists`, false, "building_completed", false);
    frame.emit.emit(WORLD_GRAPH_EVENTS.constructionCompleted.name, WORLD_GRAPH_EVENTS.constructionCompleted.severity, { data: { constructionSiteId: site.id, buildingId: building.id } });
  }
  return { ...frame, state: { ...frame.state, constructionSites: remainingSites, buildings: [...frame.state.buildings, ...completedBuildings], map, counters, staff } };
};
/** System 13: apply restocker deltas to finite inventory, clamped once at each product's capacity. */
export const buildings: WorldGraphSystem = (frame) => {
  const restockDeltas = new Map<string, Map<string, number>>();
  for (const member of frame.state.staff) {
    if (member.task?.type !== "restock" || member.task.status !== "in_progress" || member.task.buildingId === null || member.task.targetProductId === null) continue;
    const role = definition(frame.content.staffRoles, member.roleId, "staff role");
    const rate = workRate(role, "restock");
    const forBuilding = restockDeltas.get(member.task.buildingId) ?? new Map<string, number>();
    forBuilding.set(member.task.targetProductId, (forBuilding.get(member.task.targetProductId) ?? 0) + rate);
    restockDeltas.set(member.task.buildingId, forBuilding);
  }
  if (restockDeltas.size === 0) return frame;

  const filledProductKeys = new Set<string>();
  const buildingsAfterRestock = frame.state.buildings.map((building) => {
    const operation = definition(frame.content.buildings, building.definitionId, "building definition").operation;
    if (operation.kind !== "service") return building;
    const forBuilding = restockDeltas.get(building.id);
    if (!forBuilding) return building;
    let inventory = building.inventory;
    for (const service of operation.products) {
      const delta = forBuilding.get(service.productId) ?? 0;
      if (delta === 0 || service.capacity === null) continue;
      const stock = inventory[service.productId] ?? 0;
      const next = Math.min(service.capacity, stock + delta);
      if (next !== stock) inventory = { ...inventory, [service.productId]: next };
      if (next >= service.capacity) filledProductKeys.add(`${building.id}\u0000${service.productId}`);
    }
    return inventory === building.inventory ? building : { ...building, inventory };
  });

  const completedRestockers: { readonly staffId: string; readonly taskId: string }[] = [];
  const staff = frame.state.staff.map((member) => {
    if (member.task?.type !== "restock" || member.task.status !== "in_progress" || member.task.buildingId === null || member.task.targetProductId === null) return member;
    if (!filledProductKeys.has(`${member.task.buildingId}\u0000${member.task.targetProductId}`)) return member;
    completedRestockers.push({ staffId: member.id, taskId: member.task.id });
    return { ...member, status: "idle" as const, tasksCompleted: member.tasksCompleted + 1, task: { ...member.task!, status: "completed" as const, endedAtTick: frame.processingTick } };
  });
  for (const restocker of completedRestockers.sort((left, right) => compareRuntimeEntityId(left.staffId, right.staffId))) {
    frame.emit.emit(WORLD_GRAPH_EVENTS.staffTaskCompleted.name, WORLD_GRAPH_EVENTS.staffTaskCompleted.severity, { data: { staffId: restocker.staffId, taskId: restocker.taskId } });
  }

  return { ...frame, state: { ...frame.state, buildings: buildingsAfterRestock, staff } };
};
/**
 * System 14: composes the four real meter-delta sources — `service` (deferred from system 4),
 * `litter` (ambient, computed here from unresolved litter-kind incidents), `staff` (deferred
 * from system 11, including cleaning's `onResolve` recovery), and `policy` (deferred from
 * system 1) — summed once per building/meter and clamped once. The contract's third ordered
 * slot, `incident`, has no independent mechanism yet and contributes nothing.
 */
export const cleanlinessWear: WorldGraphSystem = (frame) => {
  const totals = new Map<string, number>();
  const policySourced = new Set<string>();
  const addDelta = (buildingId: string, meter: "cleanliness" | "wear", delta: number): void => {
    if (delta === 0) return;
    const key = `${buildingId}\u0000${meter}`;
    totals.set(key, safeAdd(totals.get(key) ?? 0, delta, `building meter ${buildingId}.${meter}`));
  };
  for (const entry of frame.scratch.deferredBuildingMeterDeltas) if (entry.source === "service") addDelta(entry.buildingId, entry.meter, entry.delta);
  for (const incident of frame.state.incidents) {
    if (incident.resolvedAtTick !== null || incident.buildingId === null) continue;
    if (definition(frame.content.incidents, incident.definitionId, "incident definition").kind !== "litter") continue;
    addDelta(incident.buildingId, "cleanliness", -incident.amount);
  }
  for (const entry of frame.scratch.deferredBuildingMeterDeltas) if (entry.source === "staff") addDelta(entry.buildingId, entry.meter, entry.delta);
  for (const entry of frame.scratch.deferredBuildingMeterDeltas) {
    if (entry.source !== "policy" || entry.delta === 0) continue;
    addDelta(entry.buildingId, entry.meter, entry.delta);
    policySourced.add(entry.buildingId + " " + entry.meter);
  }
  if (totals.size === 0) return frame;

  const byId = new Map(frame.state.buildings.map((building) => [building.id, building] as const));
  for (const id of [...byId.keys()].sort(compareRuntimeEntityId)) {
    let building = byId.get(id)!;
    for (const meter of ["cleanliness", "wear"] as const) {
      const delta = totals.get(`${id}\u0000${meter}`);
      if (delta === undefined) continue;
      const previous = building[meter];
      const value = clamp(safeAdd(previous, delta, `building meter ${id}.${meter}`), 0, 100);
      if (value === previous) continue;
      building = { ...building, [meter]: value };
      frame.emit.emit(WORLD_GRAPH_EVENTS.buildingMeterChanged.name, WORLD_GRAPH_EVENTS.buildingMeterChanged.severity, { data: { buildingId: id, meter, value } });
      // A policy/scheduled effect contributed to this composed change (§9.2): its own
      // `scenario.effect.applied` fires here, once, now the final clamp is known to have
      // actually moved the meter — not at system 1's deferral point (W95.3, W95.4).
      if (policySourced.has(id + " " + meter)) {
        frame.emit.emit(WORLD_GRAPH_EVENTS.scenarioEffectApplied.name, WORLD_GRAPH_EVENTS.scenarioEffectApplied.severity, {
          data: { effect: "building_meter_delta", tick: frame.processingTick },
        });
      }
      if (meter === "wear" && value === 0 && (building.status === "open" || building.status === "closed")) {
        const previousStatus = building.status;
        building = { ...building, status: "broken" };
        frame.changes.record("cleanliness-wear", `buildings.${id}.status`, "broken", "building_broken", true, previousStatus);
        frame.emit.emit(WORLD_GRAPH_EVENTS.buildingStatusChanged.name, WORLD_GRAPH_EVENTS.buildingStatusChanged.severity, { data: { buildingId: id, status: "broken" } });
      }
    }
    byId.set(id, building);
  }
  return { ...frame, state: { ...frame.state, buildings: [...byId.values()] } };
};
export const finance: WorldGraphSystem = (frame) => {
  const due = (amount: number): number => Math.floor((amount * (frame.processingTick + 1)) / frame.content.ticksPerDay) - Math.floor((amount * frame.processingTick) / frame.content.ticksPerDay);
  const wages = frame.state.staff.reduce((sum, member) => sum + due(definition(frame.content.staffRoles, member.roleId, "staff role").wageCentsPerDay), 0);
  const operating = frame.state.buildings.filter((building) => building.status === "open").reduce((sum, building) => sum + due(definition(frame.content.buildings, building.definitionId, "building definition").operatingCostCentsPerDay), 0);
  const expenses = wages + operating;
  if (expenses < 0) throw new Error("Validated world-graph recurring costs cannot be negative");
  if (expenses === 0) return frame;
  if (wages > 0) frame.emit.emit(WORLD_GRAPH_EVENTS.financeCharged.name, WORLD_GRAPH_EVENTS.financeCharged.severity, { data: { family: "wages", amountCents: wages } });
  if (operating > 0) frame.emit.emit(WORLD_GRAPH_EVENTS.financeCharged.name, WORLD_GRAPH_EVENTS.financeCharged.severity, { data: { family: "operating", amountCents: operating } });
  return { ...frame, state: { ...frame.state, finances: { ...frame.state.finances, cashCents: frame.state.finances.cashCents - expenses, expensesTodayCents: frame.state.finances.expensesTodayCents + expenses, expensesTotalCents: frame.state.finances.expensesTotalCents + expenses } } };
};
interface IncidentScopeInstance {
  readonly scope: IncidentRollScope;
  readonly zoneId: string | null;
  readonly buildingId: string | null;
  readonly building: Building | null;
}

/**
 * §4.18: an active occurrence, or a retained one still inside its cooldown, blocks its own
 * definition/scope. Every `IncidentScopeInstance` carries exactly one of `zoneId`/`buildingId`
 * (or neither, for world), so matching the scope collapses to plain field equality.
 */
function incidentBlocked(state: WorldGraphKindState, processingTick: number, incidentDefinition: IncidentDefinition, instance: IncidentScopeInstance): boolean {
  return state.incidents.some((incident) => {
    if (incident.definitionId !== incidentDefinition.id) return false;
    if (incident.zoneId !== instance.zoneId || incident.buildingId !== instance.buildingId) return false;
    if (incident.resolvedAtTick === null) return true;
    return processingTick < incident.startedAtTick + incidentDefinition.cooldownTicks;
  });
}

/** System 16: resolves due/condition-met occurrences, then rolls new ones by declared scope (§4.18). */
export const incidents: WorldGraphSystem = (frame) => {
  let state = frame.state;
  const resolving = state.incidents
    .filter((incident) => incident.resolvedAtTick === null)
    .filter((incident) => {
      if (incident.expiresAtTick !== null && incident.expiresAtTick <= frame.processingTick) return true;
      const incidentDefinition = definition(frame.content.incidents, incident.definitionId, "incident definition");
      return incidentDefinition.resolutionCondition !== null && evaluateCondition(incidentDefinition.resolutionCondition, state, frame.content);
    })
    .sort((left, right) => compareRuntimeEntityId(left.id, right.id));
  for (const incident of resolving) {
    const current = state.incidents.find((entry) => entry.id === incident.id);
    if (!current || current.resolvedAtTick !== null) continue;
    state = {
      ...state,
      incidents: state.incidents.map((entry) => entry.id === incident.id
        ? { ...entry, resolvedAtTick: frame.processingTick } : entry),
    };
    frame.changes.record("incidents", `incidents.${incident.id}.resolvedAtTick`, frame.processingTick, "incident_resolved", false);
    const incidentDefinition = definition(frame.content.incidents, current.definitionId, "incident definition");
    state = applyWorldEffects(state, incidentDefinition.onResolve, {
      processingTick: frame.processingTick,
      content: frame.content,
      random: frame.random,
      changes: frame.changes,
      system: "incidents",
      reason: "incident_resolved",
      currentIncidentId: incident.id,
    }).state;
    frame.emit.emit(WORLD_GRAPH_EVENTS.incidentResolved.name, WORLD_GRAPH_EVENTS.incidentResolved.severity, {
      data: { incidentId: current.id, definitionId: current.definitionId, tick: frame.processingTick },
    });
  }

  const scopeInstances: readonly IncidentScopeInstance[] = [
    { scope: "world", zoneId: null, buildingId: null, building: null },
    ...[...state.map.zones].sort((left, right) => compareDefinitionId(left.id, right.id)).map((zone) => ({ scope: "zone" as const, zoneId: zone.id, buildingId: null, building: null })),
    ...[...state.buildings].sort((left, right) => compareRuntimeEntityId(left.id, right.id)).map((building) => ({ scope: "building" as const, zoneId: null, buildingId: building.id, building })),
  ];
  // Eligibility apart from `incidentBlocked` depends only on the scope value, not the instance
  // (state is fixed for this whole pass), so it's computed once per scope rather than per instance.
  const eligibleForScope = (scope: IncidentRollScope): readonly IncidentDefinition[] => frame.content.incidents
    .filter((entry) => entry.rollScope === scope && entry.triggerCondition !== null && entry.selectionWeight > 0)
    .filter((entry) => evaluateCondition(entry.triggerCondition!, state, frame.content))
    .sort((left, right) => compareDefinitionId(left.id, right.id));
  const eligibleByScope: Readonly<Record<IncidentRollScope, readonly IncidentDefinition[]>> = {
    world: eligibleForScope("world"), zone: eligibleForScope("zone"), building: eligibleForScope("building"),
  };
  const selections: { readonly instance: IncidentScopeInstance; readonly incidentDefinition: IncidentDefinition }[] = [];
  for (const instance of scopeInstances) {
    const eligible = eligibleByScope[instance.scope].filter((entry) => !incidentBlocked(state, frame.processingTick, entry, instance));
    if (eligible.length === 0) continue;
    const rng = frame.random.tickRng("incidents");
    const passed = eligible.filter((entry) => rng.nextInt(1, 10000) <= entry.rollChanceBasisPoints);
    if (passed.length === 0) continue;
    const chosen = rng.weightedPick(passed.map((entry) => ({ item: entry, weight: entry.selectionWeight })));
    selections.push({ instance, incidentDefinition: chosen });
  }

  for (const { instance, incidentDefinition } of selections) {
    const building = instance.building;
    const duration = resolveDuration(incidentDefinition.durationTicks, frame.random.tickRng("incidents"));
    const id = `incident:${state.nextEntityOrdinal}`;
    const incident: Incident = {
      id, definitionId: incidentDefinition.id,
      buildingId: instance.buildingId, guestId: null, zoneId: instance.zoneId,
      position: building === null ? null : { x: building.x, y: building.y },
      amount: 1, startedAtTick: frame.processingTick,
      expiresAtTick: duration === null ? null : safeAdd(frame.processingTick, duration, `incident ${id} expiry`),
      resolvedAtTick: null,
    };
    state = {
      ...state,
      incidents: [...state.incidents, incident],
      nextEntityOrdinal: state.nextEntityOrdinal + 1,
      counters: { ...state.counters, incidentsRaised: state.counters.incidentsRaised + 1 },
    };
    frame.changes.record("incidents", `incidents.${id}.exists`, true, "incident_raised", false, false);
    state = applyWorldEffects(state, incidentDefinition.onStart, {
      processingTick: frame.processingTick,
      content: frame.content,
      random: frame.random,
      changes: frame.changes,
      system: "incidents",
      reason: "incident_raised",
      currentIncidentId: id,
    }).state;
    frame.emit.emit(WORLD_GRAPH_EVENTS.incidentRaised.name, WORLD_GRAPH_EVENTS.incidentRaised.severity, {
      data: { incidentId: id, definitionId: incidentDefinition.id, tick: frame.processingTick },
    });
  }

  return { ...frame, state };
};
/** System 17: evaluate duration-qualified objective progress against this tick's world. */
export const objectives: WorldGraphSystem = (frame) => {
  const snapshot = frame.state;
  frame.scratch.objectiveFailureSnapshot.state = snapshot;
  const evaluations = [...snapshot.objectives]
    .filter((progress) => progress.state === "active")
    .sort((left, right) => compareDefinitionId(left.id, right.id))
    .map((progress) => {
      const item = definition(frame.content.objectives, progress.id, "objective");
      const value = item.progressMetric === null ? progress.value : (evaluateMetric(item.progressMetric, snapshot, frame.content) ?? 0);
      const satisfied = evaluateCondition(item.completion, snapshot, frame.content);
      const since = satisfied ? (progress.satisfiedSinceTick ?? frame.processingTick) : null;
      const met = satisfied && since !== null && frame.processingTick - since + 1 >= item.requiredDurationTicks;
      return { progress, item, value, since, met };
    });
  let state = frame.state;
  for (const { progress, item, value, since, met } of evaluations) {
    const next = { ...progress, value, satisfiedSinceTick: since, updatedAtTick: frame.processingTick, state: met ? "met" as const : "active" as const };
    state = { ...state, objectives: state.objectives.map((entry) => entry.id === progress.id ? next : entry) };
    if (value !== progress.value) frame.emit.emit(WORLD_GRAPH_EVENTS.objectiveProgressed.name, WORLD_GRAPH_EVENTS.objectiveProgressed.severity, { data: { objectiveId: progress.id, value } });
    if (met) {
      frame.emit.emit(WORLD_GRAPH_EVENTS.objectiveMet.name, WORLD_GRAPH_EVENTS.objectiveMet.severity, { data: { objectiveId: progress.id } });
      state = applyWorldEffects(state, item.onCompleted, { processingTick: frame.processingTick, content: frame.content, random: frame.random, changes: frame.changes, system: "objectives", reason: "objective_met" }).state;
    }
  }
  return { ...frame, state };
};
/** System 18: retain the first terminal identity selected by the scenario precedence. */
export const failure: WorldGraphSystem = (frame) => {
  if (frame.state.resolution) return frame;
  const snapshot = frame.scratch.objectiveFailureSnapshot.state ?? frame.state;
  const scenarioDefinition = definition(frame.content.scenarios, frame.content.startScenarioId, "scenario");
  const timeLimitReached = scenarioDefinition.timeLimitTicks !== null
    && frame.processingTick + 1 >= scenarioDefinition.timeLimitTicks;
  const evaluations = [...snapshot.failures]
    .filter((progress) => progress.state !== "triggered")
    .sort((left, right) => compareDefinitionId(left.id, right.id))
    .map((progress) => {
      const item = definition(frame.content.failures, progress.id, "failure");
      const forced = timeLimitReached && scenarioDefinition.timeLimitFailureId === progress.id;
      const satisfied = forced || evaluateCondition(item.condition, snapshot, frame.content);
      const since = satisfied ? (progress.satisfiedSinceTick ?? frame.processingTick) : null;
      const fires = forced || (satisfied && since !== null && frame.processingTick - since + 1 >= item.requiredDurationTicks);
      return { progress, item, since, fires };
    });
  let state = frame.state;
  const triggered = state.failures.filter((progress) => progress.state === "triggered").map((progress) => progress.id);
  for (const { progress, item, since, fires } of evaluations) {
    state = { ...state, failures: state.failures.map((entry) => entry.id === progress.id ? { ...entry, satisfiedSinceTick: since, updatedAtTick: frame.processingTick, state: fires ? "triggered" as const : "active" as const } : entry) };
    if (since !== progress.satisfiedSinceTick) frame.emit.emit(WORLD_GRAPH_EVENTS.failureProgressed.name, WORLD_GRAPH_EVENTS.failureProgressed.severity, { data: { failureId: progress.id } });
    if (fires) {
      triggered.push(progress.id);
      frame.emit.emit(WORLD_GRAPH_EVENTS.failureTriggered.name, WORLD_GRAPH_EVENTS.failureTriggered.severity, { data: { failureId: progress.id } });
      state = applyWorldEffects(state, item.onTriggered, { processingTick: frame.processingTick, content: frame.content, random: frame.random, changes: frame.changes, system: "failure", reason: "failure_triggered" }).state;
    }
  }
  const met = state.objectives.filter((entry) => entry.state === "met").map((entry) => entry.id).sort();
  const success = state.objectives.length > 0 && met.length === state.objectives.length;
  const failureId = triggered.sort()[0] ?? null;
  if (success || failureId !== null) {
    const win = success && (failureId === null || scenarioDefinition.resolutionPrecedence === "objectives_win");
    const resolution = win ? "objectives_met" as const : "failed" as const;
    const resolvedFailureId = win ? null : failureId;
    state = {
      ...state,
      objectives: win ? state.objectives : state.objectives.map((progress) => progress.state === "active" ? { ...progress, state: "failed", updatedAtTick: frame.processingTick } : progress),
      resolution: { resolution, objectiveIds: met, failureId: resolvedFailureId, resolvedAtTick: frame.processingTick },
    };
    frame.emit.emit(WORLD_GRAPH_EVENTS.scenarioResolved.name, WORLD_GRAPH_EVENTS.scenarioResolved.severity, { data: { resolution, objectiveIds: met.join(","), failureId: resolvedFailureId ?? "" } });
  }
  return { ...frame, state };
};
const INCIDENT_ALERT_SEVERITY: Readonly<Record<IncidentSeverity, AlertSeverity>> = { info: "info", minor: "warning", major: "warning", critical: "critical" };

interface AlertSource {
  readonly semanticKey: string;
  readonly type: AlertType;
  readonly severity: AlertSeverity;
  readonly titleKey: string;
  readonly messageKey: string;
  readonly entityId: string | null;
}

/**
 * System 19: still-locked achievements unlock first (canonical order falls out of iterating
 * `frame.content.achievements`, already sorted by id — §14.8), then alerts derive from the
 * closed source set — active incidents, broken buildings, and terminal resolution (§4.21).
 * A source is represented by an uncleared alert regardless of whether that alert was
 * dismissed; only clearing frees its semantic key to raise again.
 */
export const alerts: WorldGraphSystem = (frame) => {
  let state = frame.state;

  // One copy of the input up front, then a Set for O(1) membership checks and in-place
  // pushes instead of an O(n) `.includes` scan and an O(n) array copy per achievement —
  // same pattern as story-graph/achievements.ts's `evaluateAchievements` (PR #51 review).
  const unlockedAchievementIds = [...state.unlockedAchievementIds];
  const unlockedAchievementIdSet = new Set(unlockedAchievementIds);
  for (const achievementDefinition of frame.content.achievements) {
    if (unlockedAchievementIdSet.has(achievementDefinition.id)) continue;
    if (!evaluateCondition(achievementDefinition.condition, state, frame.content)) continue;
    unlockedAchievementIdSet.add(achievementDefinition.id);
    unlockedAchievementIds.push(achievementDefinition.id);
    state = { ...state, unlockedAchievementIds };
    frame.changes.record("alerts", `unlockedAchievementIds.${achievementDefinition.id}.exists`, true, "achievement_unlocked", true, false);
    frame.emit.emit(WORLD_GRAPH_EVENTS.achievementUnlocked.name, WORLD_GRAPH_EVENTS.achievementUnlocked.severity, { data: { achievementId: achievementDefinition.id } });
  }

  const sources: AlertSource[] = [];
  for (const incident of [...state.incidents].sort((left, right) => compareRuntimeEntityId(left.id, right.id))) {
    if (incident.resolvedAtTick !== null) continue;
    const incidentDefinition = definition(frame.content.incidents, incident.definitionId, "incident definition");
    sources.push({
      semanticKey: `incident:${incident.id}`, type: "incident_active",
      severity: INCIDENT_ALERT_SEVERITY[incidentDefinition.severity],
      titleKey: incidentDefinition.text.nameKey, messageKey: incidentDefinition.text.descriptionKey,
      entityId: incident.id,
    });
  }
  for (const building of [...state.buildings].sort((left, right) => compareRuntimeEntityId(left.id, right.id))) {
    if (building.status !== "broken") continue;
    sources.push({
      semanticKey: `building-broken:${building.id}`, type: "building_broken", severity: "critical",
      titleKey: "world-graph.alert.building-broken.title", messageKey: "world-graph.alert.building-broken.message",
      entityId: building.id,
    });
  }
  if (state.resolution !== null) {
    sources.push({
      semanticKey: "scenario-resolved", type: "scenario_resolved", severity: "info",
      titleKey: "world-graph.alert.scenario-resolved.title", messageKey: "world-graph.alert.scenario-resolved.message",
      entityId: null,
    });
  }

  const activeKeys = new Set(sources.map((source) => source.semanticKey));
  const toClear = [...state.alerts]
    .filter((alert) => alert.clearedAtTick === null && !activeKeys.has(alert.semanticKey))
    .sort((left, right) => compareRuntimeEntityId(left.id, right.id));
  if (toClear.length > 0) {
    const clearingIds = new Set(toClear.map((alert) => alert.id));
    state = {
      ...state,
      alerts: state.alerts.map((entry) => clearingIds.has(entry.id) ? { ...entry, clearedAtTick: frame.processingTick } : entry),
    };
    for (const alert of toClear) {
      frame.changes.record("alerts", `alerts.${alert.id}.clearedAtTick`, frame.processingTick, "alert_cleared", false);
      frame.emit.emit(WORLD_GRAPH_EVENTS.alertCleared.name, WORLD_GRAPH_EVENTS.alertCleared.severity, { data: { alertId: alert.id, type: alert.type } });
    }
  }

  const representedKeys = new Set(state.alerts.filter((entry) => entry.clearedAtTick === null).map((entry) => entry.semanticKey));
  for (const source of sources) {
    if (representedKeys.has(source.semanticKey)) continue;
    const id = `alert:${state.nextEntityOrdinal}`;
    const alert: Alert = {
      id, type: source.type, semanticKey: source.semanticKey, severity: source.severity,
      titleKey: source.titleKey, messageKey: source.messageKey, entityId: source.entityId,
      issuedAtTick: frame.processingTick, dismissedAtTick: null, clearedAtTick: null,
    };
    state = { ...state, alerts: [...state.alerts, alert], nextEntityOrdinal: state.nextEntityOrdinal + 1 };
    frame.changes.record("alerts", `alerts.${id}.exists`, true, "alert_raised", false, false);
    frame.emit.emit(WORLD_GRAPH_EVENTS.alertRaised.name, WORLD_GRAPH_EVENTS.alertRaised.severity, { data: { alertId: id, type: alert.type } });
    representedKeys.add(source.semanticKey);
  }

  return { ...frame, state };
};

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
  frame.emit.emit(WORLD_GRAPH_EVENTS.tickFinalized.name, WORLD_GRAPH_EVENTS.tickFinalized.severity, { data: { tick: frame.processingTick } });
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
  // The shared fold (04 §20). The per-entry `processingTick` guard wraps the list handed in
  // rather than living in `WORLD_GRAPH_SYSTEMS`, so a caller supplying its own subset — every
  // focused test in this module's suite does — is guarded exactly as the full order is. §20
  // requires the substrate to read no field of the frame; wrapping is how a caller keeps an
  // invariant that does.
  frame = runSystems(frame, systems.map((system) => ({
    id: system.id,
    run: (current: WorldGraphTickFrame): WorldGraphTickFrame => {
      const previousTick = current.processingTick;
      const next = system.run(current);
      if (next.processingTick !== previousTick) throw new Error(`World-graph system ${system.id} changed processingTick`);
      return next;
    },
  })));
  if (frame.state.tick !== processingTick + 1) throw new Error("World-graph tick did not finalize exactly once");
  return frame.state;
}
