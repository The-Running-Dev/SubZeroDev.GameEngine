import type {
  BuildingSelector,
  GuestMeterKind,
  GuestSelector,
  WorldEffect,
  WorldGraphCampaign,
} from "../content.js";
import type { Building, Guest, WorldGraphKindState } from "../state.js";
import type { TickChanges } from "./changes.js";
import type { TickRandom } from "./random.js";

interface EffectContext {
  readonly processingTick: number;
  readonly content: WorldGraphCampaign;
  readonly random: TickRandom;
  readonly changes: TickChanges;
}

export interface AppliedEffects {
  readonly state: WorldGraphKindState;
  readonly applied: readonly boolean[];
}

function safeAdd(left: number, right: number, owner: string): number {
  const value = left + right;
  if (!Number.isSafeInteger(value)) throw new Error(`Unsafe world-graph integer for ${owner}`);
  return value;
}

const clamp = (value: number, minimum: number, maximum: number): number => (
  value < minimum ? minimum : value > maximum ? maximum : value
);

function guestTargets(state: WorldGraphKindState, selector: GuestSelector): readonly Guest[] {
  const active = state.guests.filter((guest) => guest.lifecycle !== "departed" && guest.lifecycle !== "removed");
  if (selector.kind === "all") return active;
  if (selector.kind === "archetype") return active.filter((guest) => guest.archetypeId === selector.archetypeId);
  if (selector.kind === "building_queue") {
    const ids = new Set(state.buildings
      .filter((building) => building.definitionId === selector.buildingDefinitionId)
      .flatMap((building) => building.queue.guestIds));
    return active.filter((guest) => ids.has(guest.id));
  }
  // Scenario and policy effects have neither service nor incident occurrence context.
  return [];
}

function buildingTargets(state: WorldGraphKindState, selector: BuildingSelector): readonly Building[] {
  if (selector.kind === "all") return state.buildings;
  if (selector.kind === "definition") {
    return state.buildings.filter((building) => building.definitionId === selector.buildingDefinitionId);
  }
  // Scenario and policy effects have neither service nor incident occurrence context.
  return [];
}

function guestMeterRange(content: WorldGraphCampaign, meter: GuestMeterKind, definitionId: string): { readonly minimum: number; readonly maximum: number } {
  const definitions = meter === "need" ? content.needs
    : meter === "condition" ? content.guestConditions
      : meter === "opinion" ? content.opinions : content.preferences;
  const definition = definitions.find((entry) => entry.id === definitionId);
  if (!definition) throw new Error(`Validated world-graph meter missing: ${meter}:${definitionId}`);
  return definition;
}

function guestMeter(guest: Guest, meter: GuestMeterKind): Readonly<Record<string, number>> {
  if (meter === "need") return guest.needs;
  if (meter === "condition") return guest.conditions;
  if (meter === "opinion") return guest.opinions;
  return guest.preferences;
}

function withGuestMeter(guest: Guest, meter: GuestMeterKind, definitionId: string, value: number): Guest {
  if (meter === "need") return { ...guest, needs: { ...guest.needs, [definitionId]: value } };
  if (meter === "condition") return { ...guest, conditions: { ...guest.conditions, [definitionId]: value } };
  if (meter === "opinion") return { ...guest, opinions: { ...guest.opinions, [definitionId]: value } };
  return { ...guest, preferences: { ...guest.preferences, [definitionId]: value } };
}

/**
 * Applies one system's authored effect list without invoking another effect or system.
 * Numeric effects are grouped by their owning scalar, checked, and clamped once.
 */
export function applyScenarioEffects(
  source: WorldGraphKindState,
  effects: readonly WorldEffect[],
  context: EffectContext,
): AppliedEffects {
  let state = source;
  const applied = effects.map(() => false);
  const finance = { delta: 0, effects: [] as number[] };
  const counters = new Map<keyof WorldGraphKindState["counters"], { delta: number; effects: number[] }>();
  const objectives = new Map<string, { delta: number; effects: number[] }>();
  const guestMeters = new Map<string, { guestId: string; meter: GuestMeterKind; definitionId: string; delta: number; effects: number[] }>();
  const buildingMeters = new Map<string, { buildingId: string; meter: "cleanliness" | "wear"; delta: number; effects: number[] }>();

  effects.forEach((effect, effectIndex) => {
    if (effect.kind === "finance_delta") {
      finance.delta = safeAdd(finance.delta, effect.cents, "scenario finance delta");
      finance.effects.push(effectIndex);
      return;
    }
    if (effect.kind === "counter_increment") {
      if (effect.amount < 0) throw new Error("World-graph counter increments cannot be negative");
      const group = counters.get(effect.counter) ?? { delta: 0, effects: [] };
      group.delta = safeAdd(group.delta, effect.amount, `counter ${effect.counter}`);
      group.effects.push(effectIndex);
      counters.set(effect.counter, group);
      return;
    }
    if (effect.kind === "objective_progress") {
      const group = objectives.get(effect.objectiveId) ?? { delta: 0, effects: [] };
      group.delta = safeAdd(group.delta, effect.delta, `objective ${effect.objectiveId}`);
      group.effects.push(effectIndex);
      objectives.set(effect.objectiveId, group);
      return;
    }
    if (effect.kind === "guest_meter_delta") {
      for (const guest of guestTargets(source, effect.guests)) {
        const key = `${guest.id}\u0000${effect.meter}\u0000${effect.definitionId}`;
        const group = guestMeters.get(key) ?? {
          guestId: guest.id, meter: effect.meter, definitionId: effect.definitionId, delta: 0, effects: [],
        };
        group.delta = safeAdd(group.delta, effect.delta, `guest meter ${key}`);
        group.effects.push(effectIndex);
        guestMeters.set(key, group);
      }
      return;
    }
    if (effect.kind === "building_meter_delta") {
      for (const building of buildingTargets(source, effect.buildings)) {
        const key = `${building.id}\u0000${effect.meter}`;
        const group = buildingMeters.get(key) ?? {
          buildingId: building.id, meter: effect.meter, delta: 0, effects: [],
        };
        group.delta = safeAdd(group.delta, effect.delta, `building meter ${key}`);
        group.effects.push(effectIndex);
        buildingMeters.set(key, group);
      }
      return;
    }
    if (effect.kind === "unlock" || effect.kind === "lock") {
      const exists = state.unlockedContent.some((entry) => entry.kind === effect.content.kind && entry.id === effect.content.id);
      if ((effect.kind === "unlock") === exists) return;
      const unlockedContent = effect.kind === "unlock"
        ? [...state.unlockedContent, effect.content].sort((left, right) => left.kind.localeCompare(right.kind) || left.id.localeCompare(right.id))
        : state.unlockedContent.filter((entry) => entry.kind !== effect.content.kind || entry.id !== effect.content.id);
      state = { ...state, unlockedContent };
      context.changes.record("scenario", `unlockedContent.${effect.content.kind}.${effect.content.id}.exists`, effect.kind === "unlock", "scenario_effect", false, exists);
      applied[effectIndex] = true;
      return;
    }
    if (effect.kind === "set_policy_active") {
      const exists = state.activePolicyIds.includes(effect.policyId);
      if (exists === effect.active) return;
      const activePolicyIds = effect.active
        ? [...state.activePolicyIds, effect.policyId].sort((left, right) => left.localeCompare(right))
        : state.activePolicyIds.filter((id) => id !== effect.policyId);
      state = { ...state, activePolicyIds };
      context.changes.record("scenario", `activePolicyIds.${effect.policyId}.exists`, effect.active, "scenario_effect", false, exists);
      applied[effectIndex] = true;
      return;
    }
    if (effect.kind === "start_incident") {
      const definition = context.content.incidents.find((entry) => entry.id === effect.incidentDefinitionId);
      if (!definition) throw new Error(`Validated incident definition missing: ${effect.incidentDefinitionId}`);
      if (effect.target.kind === "current_guest" || effect.target.kind === "current_building") return;
      const duration = definition.durationTicks === null ? null
        : definition.durationTicks.min === definition.durationTicks.max ? definition.durationTicks.min
          : context.random.tickRng("scenario").nextInt(definition.durationTicks.min, definition.durationTicks.max);
      const id = `incident:${state.nextEntityOrdinal}`;
      const incident = {
        id,
        definitionId: effect.incidentDefinitionId,
        buildingId: null,
        guestId: null,
        zoneId: effect.target.kind === "zone" ? effect.target.zoneId : null,
        position: null,
        amount: effect.amount,
        startedAtTick: context.processingTick,
        expiresAtTick: duration === null ? null : safeAdd(context.processingTick, duration, `incident ${id} expiry`),
        resolvedAtTick: null,
      };
      const nextEntityOrdinal = safeAdd(state.nextEntityOrdinal, 1, "nextEntityOrdinal");
      state = { ...state, incidents: [...state.incidents, incident], nextEntityOrdinal };
      context.changes.record("scenario", `incidents.${id}.exists`, true, "scenario_effect", false, false);
      context.changes.record("scenario", "nextEntityOrdinal", state.nextEntityOrdinal, "scenario_effect", false, state.nextEntityOrdinal - 1);
      applied[effectIndex] = true;
      return;
    }
    if (effect.kind !== "resolve_incident") return;
    const matching = effect.incidents === "all_active"
      ? state.incidents.filter((incident) => incident.definitionId === effect.incidentDefinitionId && incident.resolvedAtTick === null)
      : [];
    if (matching.length === 0) return;
    const ids = new Set(matching.map((incident) => incident.id));
    state = {
      ...state,
      incidents: state.incidents.map((incident) => ids.has(incident.id)
        ? { ...incident, resolvedAtTick: context.processingTick } : incident),
    };
    for (const incident of matching) {
      context.changes.record("scenario", `incidents.${incident.id}.resolvedAtTick`, context.processingTick, "scenario_effect", false, incident.resolvedAtTick ?? -1);
    }
    applied[effectIndex] = true;
  });

  if (finance.delta !== 0) {
    const value = safeAdd(state.finances.cashCents, finance.delta, "finances.cashCents");
    const previous = state.finances.cashCents;
    state = { ...state, finances: { ...state.finances, cashCents: value } };
    context.changes.record("scenario", "finances.cashCents", value, "scenario_effect", true, previous);
    finance.effects.forEach((index) => { applied[index] = true; });
  }

  for (const [counter, group] of counters) {
    if (group.delta === 0) continue;
    const previous = state.counters[counter];
    const value = safeAdd(previous, group.delta, `counters.${counter}`);
    state = { ...state, counters: { ...state.counters, [counter]: value } };
    context.changes.record("scenario", `counters.${counter}`, value, "scenario_effect", false, previous);
    group.effects.forEach((index) => { applied[index] = true; });
  }

  for (const [objectiveId, group] of objectives) {
    const previous = state.objectives.find((objective) => objective.id === objectiveId);
    if (!previous || group.delta === 0) continue;
    const value = safeAdd(previous.value, group.delta, `objectives.${objectiveId}.value`);
    state = {
      ...state,
      objectives: state.objectives.map((objective) => objective.id === objectiveId
        ? { ...objective, value, updatedAtTick: context.processingTick } : objective),
    };
    context.changes.record("scenario", `objectives.${objectiveId}.value`, value, "scenario_effect", false, previous.value);
    group.effects.forEach((index) => { applied[index] = true; });
  }

  for (const group of guestMeters.values()) {
    const guest = state.guests.find((entry) => entry.id === group.guestId);
    if (!guest || group.delta === 0) continue;
    const previous = guestMeter(guest, group.meter)[group.definitionId];
    if (previous === undefined) throw new Error(`Validated guest meter missing: ${group.guestId}:${group.definitionId}`);
    const range = guestMeterRange(context.content, group.meter, group.definitionId);
    const value = clamp(safeAdd(previous, group.delta, `guest meter ${group.guestId}`), range.minimum, range.maximum);
    if (value === previous) continue;
    state = { ...state, guests: state.guests.map((entry) => entry.id === group.guestId ? withGuestMeter(entry, group.meter, group.definitionId, value) : entry) };
    context.changes.record("scenario", `guests.${group.guestId}.${group.meter}.${group.definitionId}`, value, "scenario_effect", false, previous);
    group.effects.forEach((index) => { applied[index] = true; });
  }

  for (const group of buildingMeters.values()) {
    const building = state.buildings.find((entry) => entry.id === group.buildingId);
    if (!building || group.delta === 0) continue;
    const previous = building[group.meter];
    const value = clamp(safeAdd(previous, group.delta, `building meter ${group.buildingId}`), 0, 100);
    if (value === previous) continue;
    state = { ...state, buildings: state.buildings.map((entry) => entry.id === group.buildingId ? { ...entry, [group.meter]: value } : entry) };
    context.changes.record("scenario", `buildings.${group.buildingId}.${group.meter}`, value, "scenario_effect", false, previous);
    group.effects.forEach((index) => { applied[index] = true; });
  }

  return { state, applied };
}
