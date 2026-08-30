import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { RngHandle, StreamId } from "../../../core/determinism/types.js";
import type { ResolutionEmitter } from "../../../core/observability/types.js";
import type { WorldEffect, WorldGraphCampaign } from "../content.js";
import type { WorldGraphKindState } from "../state.js";
import { WORLD_GRAPH_EVENTS } from "../events.js";
import { worldGraphKind } from "../kind.js";
import { WORLD_GRAPH_REASON_CODES, WORLD_GRAPH_REASON_MESSAGES } from "../reasons.js";
import { BatchChanges } from "./changes.js";
import { compareDefinitionId, WORLD_GRAPH_SYSTEM_IDS, worldGraphSystemIndex, type WorldGraphSystemId } from "./order.js";
import {
  alerts,
  buildings,
  cleanlinessWear,
  construction,
  failure,
  finance,
  guestIntent,
  guestMove,
  guestNeeds,
  guestPath,
  guestService,
  guestSpawn,
  incidents,
  objectives,
  queues,
  runWorldGraphTick,
  scenario,
  staffWork,
  taskAssign,
  taskGenerate,
  tickFinalize,
  WORLD_GRAPH_SYSTEMS,
  type WorldGraphSystem,
  type WorldGraphTickFrame,
} from "./pipeline.js";
import { createTickRandom } from "./random.js";
import { createTickScratch } from "./scratch.js";

function rngHandle(): RngHandle {
  let next = 0;
  return {
    nextInt: (minimum, maximum) => minimum + ((next += 1) % (maximum - minimum + 1)),
    nextPercent: () => (next += 1) % 100,
    pick: <T>(items: readonly T[]) => items[(next += 1) % items.length]!,
    weightedPick: <T>(items: readonly { readonly item: T; readonly weight: number }[]) => items[(next += 1) % items.length]!.item,
  };
}

/** Every draw returns exactly `value`, regardless of call count — isolates a roll's pass/fail
 *  from how many other draws preceded it in the same tick (W84.2). */
function constantRng(value: number): RngHandle {
  return {
    nextInt: () => value,
    nextPercent: () => value,
    pick: <T>(items: readonly T[]) => items[0]!,
    weightedPick: <T>(items: readonly { readonly item: T; readonly weight: number }[]) => items[0]!.item,
  };
}

function countingRng(base: RngHandle, counter: { calls: number }): RngHandle {
  return {
    nextInt: (minimum, maximum) => { counter.calls += 1; return base.nextInt(minimum, maximum); },
    nextPercent: () => base.nextPercent(),
    pick: <T>(items: readonly T[]) => base.pick(items),
    weightedPick: <T>(items: readonly { readonly item: T; readonly weight: number }[]) => { counter.calls += 1; return base.weightedPick(items); },
  };
}

interface RecordedResolutionEvent {
  readonly name: string;
  readonly severity: string;
  readonly data?: Readonly<Record<string, string | number | boolean>>;
}

function resolutionEmitter(): { readonly emit: ResolutionEmitter; readonly events: RecordedResolutionEvent[] } {
  const events: RecordedResolutionEvent[] = [];
  return {
    events,
    emit: { emit: (name, severity, detail) => { events.push(detail?.data === undefined ? { name, severity } : { name, severity, data: detail.data }); } },
  };
}

function state(): WorldGraphKindState {
  return {
    tick: 0,
    map: {
      width: 2, height: 1, revision: 0,
      terrain: [{ x: 0, y: 0, terrainId: "sand" }, { x: 1, y: 0, terrainId: "sand" }],
      paths: [], zones: [{ id: "beach", nameKey: "zone.beach", cells: [{ x: 0, y: 0 }], serviceRadius: 1, maxOccupancy: null }],
      spawnPoints: [{ x: 0, y: 0 }], exits: [{ x: 1, y: 0 }], scenery: [],
    },
    finances: {
      cashCents: 100, revenueTodayCents: 7, expensesTodayCents: 8,
      revenueTotalCents: 70, expensesTotalCents: 80, loan: null,
    },
    buildings: [{
      id: "building:0", definitionId: "kiosk", x: 0, y: 0, width: 1, height: 1, rotation: 0,
      status: "open", buildStartTick: 0, wear: 75, cleanliness: 50,
      queue: { id: "queue:1", guestIds: ["guest:2"], serviceStartedAtTick: null },
      pricesCents: {}, inventory: {},
    }],
    constructionSites: [],
    guests: [{
      id: "guest:2", archetypeId: "visitor", lifecycle: "queued", tickEntered: 0,
      stayDurationTicks: 10, x: 0, y: 0, path: [], pathIndex: 0, drawCount: 4, cashCents: 20,
      intent: { kind: "seek_service", buildingId: "building:0", productId: null, selectedAtTick: 0 },
      needs: { thirst: 50 }, conditions: {}, opinions: {}, preferences: {}, satisfaction: 50,
      patienceCapacityTicks: 5, patienceRemainingTicks: 5, lastServedTick: null, spentTicks: 0,
    }],
    staff: [],
    incidents: [{
      id: "incident:3", definitionId: "litter", buildingId: null, guestId: null, zoneId: null,
      position: null, amount: 1, startedAtTick: 0, expiresAtTick: null, resolvedAtTick: null,
    }],
    objectives: [{ id: "earn", state: "active", value: 1, target: 10, satisfiedSinceTick: null, updatedAtTick: 0 }],
    failures: [], alerts: [], resolution: null,
    counters: {
      guestsEntered: 0, guestsDeparted: 0, guestsDissatisfied: 0, servicesCompleted: 0,
      buildingsCompleted: 0, incidentsRaised: 0, litterCreated: 0, litterCleaned: 0,
    },
    unlockedContent: [{ kind: "building", id: "kiosk" }],
    activePolicyIds: [], unlockedAchievementIds: [], nextEntityOrdinal: 4,
  };
}

function content(effects: readonly WorldEffect[] = []): WorldGraphCampaign {
  return {
    startScenarioId: "opening", ticksPerDay: 10, maxTicksPerAction: 10,
    maps: [], terrain: [], scenery: [],
    needs: [{ id: "thirst", minimum: 0, maximum: 100 }],
    guestConditions: [], opinions: [], preferences: [], products: [],
    buildings: [], guestArchetypes: [{
      id: "visitor", cashCents: { min: 20, max: 20 }, stayTicks: { min: 10, max: 10 },
      patienceTicks: { min: 5, max: 5 }, initialSatisfaction: { min: 50, max: 50 },
      needs: [], conditions: [], opinions: [], preferences: [],
      priceResistance: { interpolation: "step", points: [{ input: 0, output: 0 }] },
      preferenceUtilityPerPoint: 0, qualityUtilityPerPoint: 0, attractivenessUtilityPerPoint: 0,
      travelPenaltyPerCost: 0, queuePenaltyPerTick: 0, safetyPenaltyPerPoint: 0,
      switchThresholdUtility: 0, fallback: { kind: "leave" }, tags: [],
    }], staffRoles: [],
    incidents: [{ id: "litter", text: { nameKey: "incident.litter.name", descriptionKey: "incident.litter.description" }, kind: "litter", cooldownTicks: 0, durationTicks: { min: 2, max: 2 }, onResolve: [] }],
    objectives: [], failures: [], policies: [], achievements: [],
    scenarios: [{
      id: "opening", scheduledChanges: [{
        dueTick: 0, priority: 1, condition: { kind: "constant", value: true }, effects,
      }],
      activePolicyIds: [],
    }],
  } as unknown as WorldGraphCampaign;
}

describe("world-graph W46 system order and boundaries", () => {
  it("orders definition ids by ordinal code units rather than host locale", () => {
    expect(["ä", "z"].sort(compareDefinitionId)).toEqual(["z", "ä"]);
  });

  it("owns every canonical id once in exact contract order", () => {
    expect(WORLD_GRAPH_SYSTEMS.map(({ id }) => id)).toEqual([
      "scenario", "guest-spawn", "guest-needs", "guest-service", "queues",
      "guest-intent", "guest-path", "guest-move", "task-generate", "task-assign",
      "staff-work", "construction", "buildings", "cleanliness-wear", "finance",
      "incidents", "objectives", "failure", "alerts", "tick-finalize",
    ]);
    expect(new Set(WORLD_GRAPH_SYSTEMS.map(({ id }) => id)).size).toBe(20);
  });

  it("runs the injected tuple in order with one immutable processing tick", () => {
    const calls: string[] = [];
    const systems = WORLD_GRAPH_SYSTEM_IDS.map((id) => ({
      id,
      run: ((frame: WorldGraphTickFrame) => {
        calls.push(`${id}:${frame.processingTick}`);
        return id === "tick-finalize" ? { ...frame, state: { ...frame.state, tick: frame.processingTick + 1 } } : frame;
      }) satisfies WorldGraphSystem,
    }));
    const changes = new BatchChanges();
    const recording = resolutionEmitter();
    const result = runWorldGraphTick(state(), content(), { derive: () => rngHandle(), emit: recording.emit }, changes, systems);
    expect(result.tick).toBe(1);
    expect(calls).toEqual(WORLD_GRAPH_SYSTEM_IDS.map((id) => `${id}:0`));
  });

  it("exposes the W47 systems as real pipeline boundaries", () => {
    expect([guestSpawn, guestNeeds, guestService, queues, guestIntent, guestPath, guestMove,
      taskGenerate, taskAssign, staffWork, construction, buildings, cleanlinessWear,
      finance, objectives, failure, alerts]).toHaveLength(17);
  });

  it("restarts service timing when a completed head leaves the FIFO", () => {
    const initial = state();
    const first = { ...initial.guests[0]!, lifecycle: "served" as const };
    const second = { ...initial.guests[0]!, id: "guest:4", lifecycle: "queued" as const };
    const serviceContent = {
      ...content(),
      products: [{ id: "water" }],
      buildings: [{
        id: "kiosk", footprint: { width: 1, height: 1 }, entrances: [{ x: 1, y: 0 }],
        operation: { kind: "service", products: [{ productId: "water", serviceTicks: 2 }], queueMaxLength: 5, baseServiceTicks: 2, staffRequirements: [] },
      }],
    } as unknown as WorldGraphCampaign;
    const queueState = {
      ...initial,
      guests: [first, second],
      buildings: initial.buildings.map((building) => ({
        ...building,
        queue: { ...building.queue, guestIds: [first.id, second.id], serviceStartedAtTick: 1 },
      })),
    };
    const scratch = createTickScratch();
    const result = queues({
      processingTick: 5, content: serviceContent, emit: resolutionEmitter().emit,
      random: createTickRandom(5, () => rngHandle(), scratch), scratch,
      changes: new BatchChanges(), state: queueState,
    });
    expect(result.state.guests.find((guest) => guest.id === first.id)?.lifecycle).toBe("seeking");
    expect(result.state.buildings[0]?.queue).toMatchObject({ guestIds: [second.id], serviceStartedAtTick: 5 });
  });

  it("does not switch a queued guest to a full alternative queue", () => {
    const archetype = {
      id: "visitor", cashCents: { min: 20, max: 20 }, stayTicks: { min: 10, max: 10 },
      patienceTicks: { min: 5, max: 5 }, initialSatisfaction: { min: 50, max: 50 },
      needs: [], conditions: [], opinions: [], preferences: [],
      priceResistance: { interpolation: "step", points: [{ input: 0, output: 0 }] },
      preferenceUtilityPerPoint: 0, qualityUtilityPerPoint: 0, attractivenessUtilityPerPoint: 0,
      travelPenaltyPerCost: 0, queuePenaltyPerTick: 0, safetyPenaltyPerPoint: 0,
      switchThresholdUtility: -1_000_000, fallback: { kind: "leave" }, tags: [],
    };
    // Both entrances sit on the guest's own tile, so path cost is 0 for either building and
    // the only thing distinguishing them is queue capacity.
    const buildingDefinition = (id: string, offsetX: number, queueMaxLength: number | null) => ({
      id, footprint: { width: 1, height: 1 }, entrances: [{ x: offsetX, y: 0 }], adjacencyEffects: [],
      operation: { kind: "service", products: [{ productId: "water", serviceTicks: 1 }], queueMaxLength, baseServiceTicks: 1, staffRequirements: [], effects: [] },
    });
    const twoBuildingContent = (altQueueMaxLength: number | null) => ({
      ...content(),
      terrain: [{ id: "sand", walkable: true, moveCost: 1, buildable: true, tags: [] }],
      products: [{ id: "water" }],
      buildings: [buildingDefinition("kioskA", 1, 5), buildingDefinition("kioskB", -1, altQueueMaxLength)],
      guestArchetypes: [archetype],
    } as unknown as WorldGraphCampaign);
    const twoBuildingState: WorldGraphKindState = {
      ...state(),
      map: { ...state().map, width: 3, terrain: [{ x: 0, y: 0, terrainId: "sand" }, { x: 1, y: 0, terrainId: "sand" }, { x: 2, y: 0, terrainId: "sand" }] },
      buildings: [
        { id: "building:0", definitionId: "kioskA", x: 0, y: 0, width: 1, height: 1, rotation: 0, status: "open", buildStartTick: 0, wear: 75, cleanliness: 50, queue: { id: "queue:1", guestIds: ["guest:2"], serviceStartedAtTick: 0 }, pricesCents: { water: 5 }, inventory: {} },
        { id: "building:1", definitionId: "kioskB", x: 2, y: 0, width: 1, height: 1, rotation: 0, status: "open", buildStartTick: 0, wear: 75, cleanliness: 50, queue: { id: "queue:2", guestIds: ["guest:9"], serviceStartedAtTick: null }, pricesCents: { water: 5 }, inventory: {} },
      ],
      guests: [{
        id: "guest:2", archetypeId: "visitor", lifecycle: "queued", tickEntered: 0,
        stayDurationTicks: 10, x: 1, y: 0, path: [], pathIndex: 0, drawCount: 4, cashCents: 20,
        intent: { kind: "seek_service", buildingId: "building:0", productId: "water", selectedAtTick: 0 },
        needs: { thirst: 50 }, conditions: {}, opinions: {}, preferences: {}, satisfaction: 50,
        patienceCapacityTicks: 5, patienceRemainingTicks: 5, lastServedTick: null, spentTicks: 0,
      }],
      incidents: [],
    };
    const runQueues = (altContent: WorldGraphCampaign): WorldGraphKindState => {
      const scratch = createTickScratch();
      return queues({
        processingTick: 5, content: altContent, emit: resolutionEmitter().emit,
        random: createTickRandom(5, () => rngHandle(), scratch), scratch,
        changes: new BatchChanges(), state: twoBuildingState,
      }).state;
    };

    const fullAlternative = runQueues(twoBuildingContent(1));
    expect(fullAlternative.guests.find((guest) => guest.id === "guest:2")?.lifecycle).toBe("queued");
    expect(fullAlternative.buildings[0]?.queue.guestIds).toEqual(["guest:2"]);

    const openAlternative = runQueues(twoBuildingContent(2));
    expect(openAlternative.guests.find((guest) => guest.id === "guest:2")?.lifecycle).toBe("seeking");
  });

  it("does not count guests behind the scored guest toward its own current-queue wait", () => {
    const archetype = {
      id: "visitor", cashCents: { min: 20, max: 20 }, stayTicks: { min: 10, max: 10 },
      patienceTicks: { min: 5, max: 5 }, initialSatisfaction: { min: 50, max: 50 },
      needs: [], conditions: [], opinions: [], preferences: [],
      priceResistance: { interpolation: "step", points: [{ input: 0, output: 0 }] },
      preferenceUtilityPerPoint: 0, qualityUtilityPerPoint: 0, attractivenessUtilityPerPoint: 0,
      travelPenaltyPerCost: 0, queuePenaltyPerTick: 100, safetyPenaltyPerPoint: 0,
      // remainingHead (1 tick, unstarted) alone crosses this; the behind-guest's 1-tick
      // duration must not be added on top, or the diff (300 vs 100) wrongly clears it too.
      switchThresholdUtility: 150, fallback: { kind: "leave" }, tags: [],
    };
    const buildingDefinition = (id: string, offsetX: number) => ({
      id, footprint: { width: 1, height: 1 }, entrances: [{ x: offsetX, y: 0 }], adjacencyEffects: [],
      operation: { kind: "service", products: [{ productId: "water", serviceTicks: 1 }], queueMaxLength: null, baseServiceTicks: 1, staffRequirements: [], effects: [] },
    });
    const twoBuildingContent = {
      ...content(),
      terrain: [{ id: "sand", walkable: true, moveCost: 1, buildable: true, tags: [] }],
      products: [{ id: "water" }],
      buildings: [buildingDefinition("kioskA", 1), buildingDefinition("kioskB", -1)],
      guestArchetypes: [archetype],
    } as unknown as WorldGraphCampaign;
    const queuedIntent = { kind: "seek_service" as const, buildingId: "building:0", productId: "water", selectedAtTick: 0 };
    const makeGuest = (id: string, patience: number) => ({
      id, archetypeId: "visitor", lifecycle: "queued" as const, tickEntered: 0,
      stayDurationTicks: 10, x: 1, y: 0, path: [], pathIndex: 0, drawCount: 4, cashCents: 20,
      intent: queuedIntent,
      needs: { thirst: 50 }, conditions: {}, opinions: {}, preferences: {}, satisfaction: 50,
      patienceCapacityTicks: 5, patienceRemainingTicks: patience, lastServedTick: null, spentTicks: 0,
    });
    const threeDeepState: WorldGraphKindState = {
      ...state(),
      map: { ...state().map, width: 3, terrain: [{ x: 0, y: 0, terrainId: "sand" }, { x: 1, y: 0, terrainId: "sand" }, { x: 2, y: 0, terrainId: "sand" }] },
      buildings: [
        { id: "building:0", definitionId: "kioskA", x: 0, y: 0, width: 1, height: 1, rotation: 0, status: "open", buildStartTick: 0, wear: 75, cleanliness: 50, queue: { id: "queue:1", guestIds: ["guest:head", "guest:2", "guest:behind"], serviceStartedAtTick: null }, pricesCents: { water: 5 }, inventory: {} },
        { id: "building:1", definitionId: "kioskB", x: 2, y: 0, width: 1, height: 1, rotation: 0, status: "open", buildStartTick: 0, wear: 75, cleanliness: 50, queue: { id: "queue:2", guestIds: [], serviceStartedAtTick: null }, pricesCents: { water: 5 }, inventory: {} },
      ],
      guests: [
        makeGuest("guest:head", 5),
        makeGuest("guest:2", 5),
        // Not itself under switching evaluation — only present to inflate a buggy wait sum
        // for "guest:2" if the fix regresses. Its own eligibility to switch is not the point.
        { ...makeGuest("guest:behind", 5), intent: { kind: "wait" as const, untilTick: 100, selectedAtTick: 0 } },
      ],
      incidents: [],
    };
    const scratch = createTickScratch();
    const result = queues({
      processingTick: 5, content: twoBuildingContent, emit: resolutionEmitter().emit,
      random: createTickRandom(5, () => rngHandle(), scratch), scratch,
      changes: new BatchChanges(), state: threeDeepState,
    }).state;

    expect(result.guests.find((guest) => guest.id === "guest:2")?.lifecycle).toBe("queued");
    expect(result.buildings[0]?.queue.guestIds).toEqual(["guest:head", "guest:2", "guest:behind"]);
  });

  it("does not start or complete staffed service until the duty is working", () => {
    const initial = state();
    const staffedContent = {
      ...content(),
      products: [{ id: "water", unitCostCents: 25, effects: [], litter: null }],
      buildings: [{
        id: "kiosk", footprint: { width: 1, height: 1 }, entrances: [{ x: 1, y: 0 }],
        operation: {
          kind: "service", products: [{ productId: "water", serviceTicks: 1 }],
          queueMaxLength: 5, baseServiceTicks: 1,
          staffRequirements: [{ roleId: "vendor", count: 1 }], effects: [],
        },
      }],
    } as unknown as WorldGraphCampaign;
    const serviceTask = {
      id: "task:5", type: "service" as const, status: "assigned" as const,
      guestId: null, queueId: "queue:1", buildingId: "building:0",
      constructionSiteId: null, incidentId: null, targetProductId: null,
      startedAtTick: 0, endedAtTick: null, priority: 1, effortRemaining: null,
    };
    const traveling = {
      ...initial,
      buildings: initial.buildings.map((building) => ({
        ...building,
        pricesCents: { water: 100 }, inventory: { water: null },
        queue: { ...building.queue, guestIds: ["guest:2"], serviceStartedAtTick: 0 },
      })),
      guests: initial.guests.map((guest) => ({
        ...guest, cashCents: 200,
        intent: { kind: "seek_service" as const, buildingId: "building:0", productId: "water", selectedAtTick: 0 },
      })),
      staff: [{
        id: "staff:4", roleId: "vendor", x: 1, y: 0, status: "to_work" as const,
        path: [{ x: 1, y: 0 }], pathIndex: 0, moveProgressTicks: 0,
        assignedBuildingId: "building:0", assignedZoneId: null, drawCount: 0,
        task: serviceTask, tasksCompleted: 0,
      }],
    };
    const scratch = createTickScratch();
    const frame: WorldGraphTickFrame = {
      processingTick: 5, content: staffedContent, emit: resolutionEmitter().emit,
      random: createTickRandom(5, () => rngHandle(), scratch), scratch,
      changes: new BatchChanges(), state: traveling,
    };
    expect(queues(frame).state.buildings[0]?.queue.serviceStartedAtTick).toBeNull();
    expect(guestService(frame).state.counters.servicesCompleted).toBe(0);

    const working = {
      ...traveling,
      staff: traveling.staff.map((member) => ({
        ...member, status: "working" as const,
        task: { ...member.task, status: "in_progress" as const },
      })),
    };
    const workingFrame = { ...frame, state: working };
    expect(queues({ ...workingFrame, state: { ...working, buildings: working.buildings.map((building) => ({ ...building, queue: { ...building.queue, serviceStartedAtTick: null } })) } }).state.buildings[0]?.queue.serviceStartedAtTick).toBe(5);
    expect(guestService(workingFrame).state.counters.servicesCompleted).toBe(1);
  });

  it("routes a locationless building incident to an entrance before assigning clean work", () => {
    const initial = state();
    const taskContent = {
      ...content(),
      terrain: [{ id: "sand", walkable: true, moveCost: 1 }],
      buildings: [{ id: "kiosk", footprint: { width: 1, height: 1 }, entrances: [{ x: 1, y: 0 }] }],
      staffRoles: [{ id: "cleaner", supportedTaskKinds: ["clean"] }],
    } as unknown as WorldGraphCampaign;
    const staffState = {
      ...initial,
      staff: [{
        id: "staff:4", roleId: "cleaner", x: 1, y: 0, status: "idle" as const,
        path: [], pathIndex: 0, moveProgressTicks: 0, assignedBuildingId: null,
        assignedZoneId: null, drawCount: 0, task: null, tasksCompleted: 0,
      }],
      incidents: initial.incidents.map((incident) => ({ ...incident, buildingId: "building:0", position: null })),
      nextEntityOrdinal: 5,
    };
    const scratch = createTickScratch();
    scratch.taskCandidates.push({
      type: "clean", priority: 1, effort: 1, buildingId: "building:0",
      incidentId: "incident:3", constructionSiteId: null, productId: null,
      requiredRoleId: null, slot: 0,
    });
    const result = taskAssign({
      processingTick: 0, content: taskContent, emit: resolutionEmitter().emit,
      random: createTickRandom(0, () => rngHandle(), scratch), scratch,
      changes: new BatchChanges(), state: staffState,
    });
    expect(result.state.staff[0]?.task).toMatchObject({ type: "clean", incidentId: "incident:3" });
    expect(result.state.staff[0]?.path).toEqual([{ x: 1, y: 0 }]);
  });

  it("assigns service duty only to staff stationed at that building", () => {
    const initial = state();
    const dutyContent = {
      ...content(),
      terrain: [{ id: "sand", walkable: true, moveCost: 1 }],
      buildings: [{ id: "kiosk", footprint: { width: 1, height: 1 }, entrances: [{ x: 1, y: 0 }] }],
      staffRoles: [{ id: "vendor", supportedTaskKinds: ["service"] }],
    } as unknown as WorldGraphCampaign;
    const unassigned: WorldGraphKindState = {
      ...initial,
      staff: [{
        id: "staff:4", roleId: "vendor", x: 1, y: 0, status: "idle",
        path: [], pathIndex: 0, moveProgressTicks: 0, assignedBuildingId: null,
        assignedZoneId: null, drawCount: 0, task: null, tasksCompleted: 0,
      }],
      nextEntityOrdinal: 5,
    };
    const assign = (stateValue: WorldGraphKindState): WorldGraphKindState => {
      const scratch = createTickScratch();
      scratch.taskCandidates.push({
        type: "service", priority: 1, effort: null, buildingId: "building:0",
        incidentId: null, constructionSiteId: null, productId: null,
        requiredRoleId: "vendor", slot: 0,
      });
      return taskAssign({
        processingTick: 0, content: dutyContent, emit: resolutionEmitter().emit,
        random: createTickRandom(0, () => rngHandle(), scratch), scratch,
        changes: new BatchChanges(), state: stateValue,
      }).state;
    };
    expect(assign(unassigned).staff[0]?.task).toBeNull();
    const assigned = { ...unassigned, staff: unassigned.staff.map((member) => ({ ...member, assignedBuildingId: "building:0" })) };
    expect(assign(assigned).staff[0]?.task).toMatchObject({ type: "service", buildingId: "building:0" });
  });

  it("honors staff movement rate and counts every cleaned litter unit", () => {
    const initial = state();
    const workContent = {
      ...content(),
      staffRoles: [{
        id: "cleaner", moveTicksPerTile: 2,
        workRates: [{ taskType: "clean", effortPerTick: 2 }],
      }],
      incidents: [{ ...content().incidents[0], id: "litter", onResolve: [] }],
    } as unknown as WorldGraphCampaign;
    let workState: WorldGraphKindState = {
      ...initial,
      incidents: initial.incidents.map((incident) => ({ ...incident, amount: 5 })),
      staff: [{
        id: "staff:4", roleId: "cleaner", x: 0, y: 0, status: "to_work",
        path: [{ x: 0, y: 0 }, { x: 1, y: 0 }], pathIndex: 0,
        moveProgressTicks: 0, assignedBuildingId: null, assignedZoneId: null,
        drawCount: 0, tasksCompleted: 0,
        task: {
          id: "task:5", type: "clean", status: "assigned", guestId: null,
          queueId: null, buildingId: null, constructionSiteId: null,
          incidentId: "incident:3", targetProductId: null, startedAtTick: 0,
          endedAtTick: null, priority: 1, effortRemaining: 5,
        },
      }],
    };
    const runWork = (tick: number): void => {
      const scratch = createTickScratch();
      workState = staffWork({
        processingTick: tick, content: workContent, emit: resolutionEmitter().emit,
        random: createTickRandom(tick, () => rngHandle(), scratch), scratch,
        changes: new BatchChanges(), state: workState,
      }).state;
    };

    runWork(0);
    expect(workState.staff[0]).toMatchObject({ x: 0, pathIndex: 0, moveProgressTicks: 1 });
    runWork(1);
    expect(workState.staff[0]).toMatchObject({ x: 1, pathIndex: 1, moveProgressTicks: 0 });
    runWork(2);
    expect(workState).toMatchObject({ incidents: [{ amount: 3 }], counters: { litterCleaned: 2 } });
    runWork(3);
    runWork(4);
    expect(workState).toMatchObject({
      incidents: [{ amount: 0, resolvedAtTick: 4 }],
      counters: { litterCleaned: 5 },
      staff: [{ tasksCompleted: 1, task: { status: "completed" } }],
    });
  });

  it("passes no raw KindContext through a system frame", () => {
    const frameKeys: string[][] = [];
    const inspect: WorldGraphSystem = (frame) => {
      frameKeys.push(Object.keys(frame).sort());
      return frame;
    };
    runWorldGraphTick(state(), content(), { derive: () => rngHandle(), emit: resolutionEmitter().emit }, new BatchChanges(), [
      { id: "scenario", run: inspect }, { id: "tick-finalize", run: tickFinalize },
    ]);
    expect(frameKeys[0]).toEqual(["changes", "content", "emit", "processingTick", "random", "scratch", "state"]);
  });
});

describe("world-graph W46 derived randomness", () => {
  it("memoizes one continuing tick handle and derives agent draws from stored counters", () => {
    const streams: StreamId[] = [];
    const handles: RngHandle[] = [];
    const derive = (stream: StreamId): RngHandle => {
      streams.push(stream);
      const handle = rngHandle();
      handles.push(handle);
      return handle;
    };
    const random = createTickRandom(7, derive, createTickScratch());
    expect(random.tickRng("scenario")).toBe(random.tickRng("scenario"));
    expect(streams).toEqual([{ kind: "tick", tick: 7, system: "scenario" }]);
    const draw = random.drawAgent({ id: "guest:2", drawCount: 4 }, (rng) => rng.nextInt(1, 9));
    expect(draw).toMatchObject({ drawCount: 5 });
    expect(streams[1]).toEqual({ kind: "agent", agentId: "guest:2", seq: 4 });
    expect(handles).toHaveLength(2);
  });

  it("does not report an increment when an agent draw throws", () => {
    const random = createTickRandom(0, () => rngHandle(), createTickScratch());
    expect(() => random.drawAgent({ id: "guest:2", drawCount: 4 }, () => { throw new Error("draw failed"); })).toThrow("draw failed");
  });
});

describe("world-graph W46 scenario effects", () => {
  it("applies every effect family, groups/clamps meters once, and keeps grants out of revenue", () => {
    const effects: WorldEffect[] = [
      { kind: "finance_delta", field: "cashCents", cents: 25 },
      { kind: "counter_increment", counter: "incidentsRaised", amount: 2 },
      { kind: "unlock", content: { kind: "product", id: "water" } },
      { kind: "lock", content: { kind: "building", id: "kiosk" } },
      { kind: "objective_progress", objectiveId: "earn", delta: 3 },
      { kind: "guest_meter_delta", meter: "need", definitionId: "thirst", delta: 60, guests: { kind: "all" } },
      { kind: "guest_meter_delta", meter: "need", definitionId: "thirst", delta: -20, guests: { kind: "all" } },
      { kind: "building_meter_delta", meter: "cleanliness", delta: -70, buildings: { kind: "all" } },
      { kind: "start_incident", incidentDefinitionId: "litter", target: { kind: "none" }, amount: 2 },
      { kind: "resolve_incident", incidentDefinitionId: "litter", incidents: "all_active" },
      { kind: "set_policy_active", policyId: "discount", active: true },
    ];
    const initial = state();
    const recording = resolutionEmitter();
    const changes = new BatchChanges();
    const result = runWorldGraphTick(initial, content(effects), { derive: () => rngHandle(), emit: recording.emit }, changes, [
      { id: "scenario", run: scenario }, { id: "cleanliness-wear", run: cleanlinessWear }, { id: "tick-finalize", run: tickFinalize },
    ]);
    expect(result.finances).toMatchObject({ cashCents: 125, revenueTotalCents: 70, expensesTotalCents: 80 });
    expect(result.counters.incidentsRaised).toBe(2);
    expect(result.unlockedContent).toContainEqual({ kind: "product", id: "water" });
    expect(result.objectives[0]).toMatchObject({ value: 4, updatedAtTick: 0 });
    expect(result.guests[0]?.needs.thirst).toBe(90);
    expect(result.buildings[0]?.cleanliness).toBe(0);
    expect(result.incidents).toHaveLength(2);
    expect(result.incidents.every((incident) => incident.resolvedAtTick === 0)).toBe(true);
    expect(result.activePolicyIds).toEqual(["discount"]);
    expect(recording.events.filter((event) => event.name === "kind.world-graph.scenario.effect.applied")).toHaveLength(effects.length);
    const resolvedChanges = changes.finish().filter((change) => change.path.endsWith(".resolvedAtTick"));
    expect(resolvedChanges.length).toBeGreaterThan(0);
    resolvedChanges.forEach((change) => { expect(change).not.toHaveProperty("previous"); });
  });

  it("does not emit applied for a context selector that has no scenario context", () => {
    const effects: WorldEffect[] = [{
      kind: "guest_meter_delta", meter: "need", definitionId: "thirst", delta: 1,
      guests: { kind: "current_service_guest" },
    }];
    const recording = resolutionEmitter();
    runWorldGraphTick(state(), content(effects), { derive: () => rngHandle(), emit: recording.emit }, new BatchChanges(), [
      { id: "scenario", run: scenario }, { id: "tick-finalize", run: tickFinalize },
    ]);
    expect(recording.events.some((event) => event.name === "kind.world-graph.scenario.effect.applied")).toBe(false);
  });
});

describe("world-graph W46 incident expiry", () => {
  it("resolves duration incidents once and applies authored resolve effects before finalization", () => {
    const initial = state();
    const incident = initial.incidents[0]!;
    const expiring = {
      ...initial,
      incidents: [
        { ...incident, id: "incident:10", expiresAtTick: 0 },
        { ...incident, id: "incident:2", expiresAtTick: 0 },
      ],
    };
    const baseContent = content();
    const withResolveEffect = {
      ...baseContent,
      incidents: baseContent.incidents.map((definition) => ({
        ...definition,
        onResolve: [{ kind: "finance_delta" as const, field: "cashCents" as const, cents: 5 }],
      })),
    };
    const recording = resolutionEmitter();
    const changes = new BatchChanges();
    const result = runWorldGraphTick(expiring, withResolveEffect, {
      derive: () => rngHandle(), emit: recording.emit,
    }, changes, [
      { id: "incidents", run: incidents }, { id: "tick-finalize", run: tickFinalize },
    ]);
    expect(result.incidents[0]?.resolvedAtTick).toBe(0);
    expect(result.incidents[1]?.resolvedAtTick).toBe(0);
    expect(result.finances).toMatchObject({ cashCents: 110, revenueTotalCents: 70, expensesTotalCents: 80 });
    expect(recording.events
      .filter((event) => event.name === "kind.world-graph.incident.resolved")
      .map((event) => event.data?.incidentId)).toEqual(["incident:2", "incident:10"]);
    for (const change of changes.finish().filter((entry) => entry.path.endsWith(".resolvedAtTick"))) {
      expect(change).not.toHaveProperty("previous");
    }
  });
});

describe("world-graph W84 incident rolls", () => {
  function stormDefinition(overrides: Record<string, unknown> = {}) {
    return {
      id: "storm", kind: "weather", severity: "minor",
      triggerCondition: { kind: "constant", value: true },
      rollScope: "world", rollChanceBasisPoints: 5000, selectionWeight: 1,
      cooldownTicks: 5, durationTicks: { min: 3, max: 3 },
      resolutionCondition: null, resolverTaskType: null, resolverTaskPriority: null,
      onStart: [{ kind: "finance_delta", field: "cashCents", cents: -7 }], onResolve: [],
      ...overrides,
    };
  }

  it("W84.1: an eligible definition rolls against its declared chance, and a successful roll's start effects apply before objectives runs", () => {
    const isolated: WorldGraphKindState = {
      ...state(), incidents: [], buildings: [],
      map: { ...state().map, zones: [] },
      objectives: [{ id: "storm-hit", state: "active", value: 0, target: 1, satisfiedSinceTick: null, updatedAtTick: 0 }],
    };
    const rolledContent = {
      ...content(),
      incidents: [stormDefinition()],
      objectives: [{
        id: "storm-hit", completion: { kind: "compare", metric: { kind: "finance", field: "cashCents" }, op: "lte", value: 95 },
        progressMetric: null, target: 1, requiredDurationTicks: 1, onCompleted: [], tags: [],
      }],
    } as unknown as WorldGraphCampaign;

    const run = (rollValue: number) => {
      const scratch = createTickScratch();
      const recording = resolutionEmitter();
      const random = createTickRandom(0, () => constantRng(rollValue), scratch);
      const frame: WorldGraphTickFrame = { processingTick: 0, content: rolledContent, emit: recording.emit, random, scratch, changes: new BatchChanges(), state: isolated };
      const afterIncidents = incidents(frame);
      const afterObjectives = objectives(afterIncidents);
      return { state: afterObjectives.state, events: recording.events };
    };

    const succeeded = run(1); // 1 <= 5000 basis points: the roll succeeds.
    expect(succeeded.state.incidents).toHaveLength(1);
    expect(succeeded.state.incidents[0]).toMatchObject({ definitionId: "storm", startedAtTick: 0, expiresAtTick: 3, resolvedAtTick: null });
    expect(succeeded.state.finances.cashCents).toBe(93); // onStart's -7 applied.
    expect(succeeded.state.counters.incidentsRaised).toBe(1);
    expect(succeeded.state.objectives[0]?.state).toBe("met"); // proves onStart ran before system 17.
    expect(succeeded.events.some((event) => event.name === "kind.world-graph.incident.raised"
      && event.data?.definitionId === "storm")).toBe(true);

    const failed = run(10000); // 10000 > 5000 basis points: the roll fails.
    expect(failed.state.incidents).toHaveLength(0);
    expect(failed.state.finances.cashCents).toBe(100);
    expect(failed.state.counters.incidentsRaised).toBe(0);
    expect(failed.state.objectives[0]?.state).toBe("active");
    expect(failed.events.some((event) => event.name === "kind.world-graph.incident.raised")).toBe(false);
  });

  it("W84.2: consumes a draw only for a scope with an eligible definition, and a later scope's outcome is unaffected by an earlier scope's failed roll", () => {
    const base: WorldGraphKindState = { ...state(), incidents: [], map: { ...state().map, zones: [] } };
    const buildingOnly = { ...content(), incidents: [stormDefinition({ id: "hazard", rollScope: "building", rollChanceBasisPoints: 10000 })] } as unknown as WorldGraphCampaign;
    const worldAndBuilding = {
      ...content(),
      incidents: [
        stormDefinition({ id: "storm", rollScope: "world", rollChanceBasisPoints: 0 }), // always fails against constantRng(1).
        stormDefinition({ id: "hazard", rollScope: "building", rollChanceBasisPoints: 10000 }),
      ],
    } as unknown as WorldGraphCampaign;

    const run = (roundContent: WorldGraphCampaign) => {
      const scratch = createTickScratch();
      const counter = { calls: 0 };
      const random = createTickRandom(0, () => countingRng(constantRng(1), counter), scratch);
      const frame: WorldGraphTickFrame = { processingTick: 0, content: roundContent, emit: resolutionEmitter().emit, random, scratch, changes: new BatchChanges(), state: base };
      return { state: incidents(frame).state, draws: counter.calls };
    };

    const onlyBuilding = run(buildingOnly);
    const worldThenBuilding = run(worldAndBuilding);
    expect(onlyBuilding.state.incidents).toHaveLength(1);
    expect(worldThenBuilding.state.incidents.filter((entry) => entry.definitionId === "hazard")).toEqual(onlyBuilding.state.incidents);
    expect(worldThenBuilding.state.incidents.some((entry) => entry.definitionId === "storm")).toBe(false); // the world scope's roll failed.
    expect(worldThenBuilding.draws).toBe(onlyBuilding.draws + 1); // exactly the failing world scope's one extra draw.
  });

  it("W84.2: visits scopes in world, zone id, then building id order, allocating occurrences in that order", () => {
    const base: WorldGraphKindState = { ...state(), incidents: [] };
    const allScopesContent = {
      ...content(),
      incidents: [
        stormDefinition({ id: "world-def", rollScope: "world", rollChanceBasisPoints: 10000 }),
        stormDefinition({ id: "zone-def", rollScope: "zone", rollChanceBasisPoints: 10000 }),
        stormDefinition({ id: "building-def", rollScope: "building", rollChanceBasisPoints: 10000 }),
      ],
    } as unknown as WorldGraphCampaign;
    const scratch = createTickScratch();
    const random = createTickRandom(0, () => constantRng(1), scratch);
    const frame: WorldGraphTickFrame = { processingTick: 0, content: allScopesContent, emit: resolutionEmitter().emit, random, scratch, changes: new BatchChanges(), state: base };
    const result = incidents(frame).state;
    expect(result.incidents.map((entry) => entry.definitionId)).toEqual(["world-def", "zone-def", "building-def"]);
    expect(result.incidents.map((entry) => ({ zoneId: entry.zoneId, buildingId: entry.buildingId }))).toEqual([
      { zoneId: null, buildingId: null },
      { zoneId: "beach", buildingId: null },
      { zoneId: null, buildingId: "building:0" },
    ]);
  });

  it("W84.3: an active occurrence blocks its definition/scope, a retained one blocks through its cooldown, and the block lifts exactly on the cooldown-end tick", () => {
    const scopedContent = { ...content(), incidents: [stormDefinition({ rollScope: "building", rollChanceBasisPoints: 10000, cooldownTicks: 20 })] } as unknown as WorldGraphCampaign;
    const runAt = (processingTick: number, existing: WorldGraphKindState["incidents"][number]) => {
      const scratch = createTickScratch();
      const random = createTickRandom(processingTick, () => constantRng(1), scratch);
      const withExisting: WorldGraphKindState = { ...state(), map: { ...state().map, zones: [] }, incidents: [existing] };
      const frame: WorldGraphTickFrame = { processingTick, content: scopedContent, emit: resolutionEmitter().emit, random, scratch, changes: new BatchChanges(), state: withExisting };
      return incidents(frame).state;
    };

    // §4.18's cooldown window is `startedAtTick + cooldownTicks`, not measured from resolution —
    // cooldownTicks: 20 here so the window still spans past this occurrence's own resolution.
    const active = { id: "incident:99", definitionId: "storm", buildingId: "building:0", guestId: null, zoneId: null, position: null, amount: 1, startedAtTick: 0, expiresAtTick: null, resolvedAtTick: null };
    expect(runAt(30, active).incidents).toHaveLength(1); // still active: blocked regardless of cooldown.

    const retained = { ...active, resolvedAtTick: 10 };
    expect(runAt(19, retained).incidents).toHaveLength(1); // 19 < 0 + 20: still in cooldown.
    const lifted = runAt(20, retained).incidents;
    expect(lifted).toHaveLength(2); // 20 >= 0 + 20: cooldown lifted, a new occurrence rolls.
    expect(lifted.some((entry) => entry.startedAtTick === 20)).toBe(true);
  });

  it("W84.4: resolves on a true resolution condition as well as on expiry, and the resolved tick is written before resolve effects run", () => {
    const resolvableContent = {
      ...content(),
      incidents: [{
        ...stormDefinition({ durationTicks: null }),
        resolutionCondition: { kind: "compare", metric: { kind: "finance", field: "cashCents" }, op: "gte", value: 100 },
        // A same-definition "current" resolve is a documented no-op once already resolved
        // (20-contract.md §14.2) — proving resolvedAtTick was written before this list ran.
        onResolve: [{ kind: "resolve_incident", incidentDefinitionId: "storm", incidents: "current" }],
      }],
    } as unknown as WorldGraphCampaign;
    const active = { id: "incident:5", definitionId: "storm", buildingId: null, guestId: null, zoneId: null, position: null, amount: 1, startedAtTick: 0, expiresAtTick: null, resolvedAtTick: null };
    const scratch = createTickScratch();
    const random = createTickRandom(3, () => constantRng(1), scratch);
    const withActive: WorldGraphKindState = { ...state(), map: { ...state().map, zones: [] }, buildings: [], incidents: [active] };
    const changes = new BatchChanges();
    const frame: WorldGraphTickFrame = { processingTick: 3, content: resolvableContent, emit: resolutionEmitter().emit, random, scratch, changes, state: withActive };
    const result = incidents(frame).state;
    expect(result.incidents[0]).toMatchObject({ id: "incident:5", resolvedAtTick: 3 });
    expect(changes.finish().filter((entry) => entry.path === "incidents.incident:5.resolvedAtTick")).toHaveLength(1);
  });

  it("W84.5: an incident already active from an earlier system this tick is not rolled again, against the guest-litter path", () => {
    const litterDefinition = {
      id: "litter", kind: "litter", severity: "minor",
      triggerCondition: { kind: "constant", value: true }, rollScope: "building",
      rollChanceBasisPoints: 10000, selectionWeight: 1, cooldownTicks: 0, durationTicks: null,
      resolutionCondition: null, resolverTaskType: "clean", resolverTaskPriority: 1,
      onStart: [], onResolve: [],
    };
    const serviceContent = {
      ...content(),
      products: [{ id: "water", unitCostCents: 0, price: { defaultCents: 0 }, effects: [], litter: { incidentDefinitionId: "litter", unitsPerService: 1 } }],
      buildings: [{
        id: "kiosk", footprint: { width: 1, height: 1 }, entrances: [{ x: 0, y: 0 }], adjacencyEffects: [],
        operation: { kind: "service", products: [{ productId: "water", serviceTicks: 0 }], queueMaxLength: 5, baseServiceTicks: 0, staffRequirements: [], effects: [] },
      }],
      incidents: [litterDefinition],
    } as unknown as WorldGraphCampaign;
    const served: WorldGraphKindState = {
      ...state(),
      incidents: [],
      buildings: [{ ...state().buildings[0]!, pricesCents: { water: 0 }, inventory: { water: null }, queue: { ...state().buildings[0]!.queue, serviceStartedAtTick: 0 } }],
      guests: [{ ...state().guests[0]!, cashCents: 0 }],
    };
    const scratch = createTickScratch();
    const random = createTickRandom(0, () => constantRng(1), scratch);
    const frame: WorldGraphTickFrame = { processingTick: 0, content: serviceContent, emit: resolutionEmitter().emit, random, scratch, changes: new BatchChanges(), state: served };
    const afterService = guestService(frame);
    expect(afterService.state.incidents.filter((entry) => entry.definitionId === "litter" && entry.buildingId === "building:0")).toHaveLength(1);
    const afterIncidents = incidents(afterService).state;
    expect(afterIncidents.incidents.filter((entry) => entry.definitionId === "litter" && entry.buildingId === "building:0")).toHaveLength(1);
  });
});

describe("world-graph W46 batch changes", () => {
  it("coalesces scalars first-before/final-after, omits net zero, and sorts by causal system", () => {
    const changes = new BatchChanges();
    changes.record("tick-finalize", "a", 2, "tick", true, 1);
    changes.record("scenario", "z", 2, "effect", false, 1);
    changes.record("scenario", "z", 3, "effect", true, 2);
    changes.record("scenario", "net", 2, "effect", false, 1);
    changes.record("scenario", "net", 1, "effect", false, 2);
    expect(changes.finish()).toEqual([
      { path: "z", op: "set", previous: 1, value: 3, reason: "effect", visible: true },
      { path: "a", op: "set", previous: 1, value: 2, reason: "tick", visible: true },
    ]);
  });

  it("keeps membership create/remove transitions as separate causal rows", () => {
    const changes = new BatchChanges();
    changes.record("scenario", "incidents.incident:4.exists", true, "effect", false, false);
    changes.record("scenario", "incidents.incident:4.exists", false, "effect", false, true);
    expect(changes.finish()).toEqual([
      { path: "incidents.incident:4.exists", op: "set", previous: false, value: true, reason: "effect", visible: false },
      { path: "incidents.incident:4.exists", op: "set", previous: true, value: false, reason: "effect", visible: false },
    ]);
  });

  it("coalesces one batch scalar across systems and retains its first causal system", () => {
    const changes = new BatchChanges();
    changes.record("scenario", "shared", 2, "effect", false, 1);
    changes.record("finance", "shared", 3, "effect", true, 2);
    changes.record("guest-spawn", "other", 1, "effect", false, 0);
    expect(changes.finish()).toEqual([
      { path: "shared", op: "set", previous: 1, value: 3, reason: "effect", visible: true },
      { path: "other", op: "set", previous: 0, value: 1, reason: "effect", visible: false },
    ]);
  });
});

describe("world-graph W81 construction", () => {
  const constructionContent = {
    ...content(),
    terrain: [{ id: "sand", walkable: true, moveCost: 1 }],
    buildings: [{
      id: "hut", footprint: { width: 1, height: 1 }, entrances: [{ x: 1, y: 0 }],
      constructionTaskPriority: 5, initialWear: 100, initialCleanliness: 100,
      operation: { kind: "decorative" },
    }],
    staffRoles: [{
      id: "builder", supportedTaskKinds: ["build"], workRates: [{ taskType: "build", effortPerTick: 1 }],
    }, {
      id: "cleaner", supportedTaskKinds: ["clean"], workRates: [{ taskType: "clean", effortPerTick: 1 }],
    }],
  } as unknown as WorldGraphCampaign;

  function siteState(workRemaining: number): WorldGraphKindState {
    return {
      ...state(),
      buildings: [],
      constructionSites: [{
        id: "construction-site:0", definitionId: "hut", x: 0, y: 0, width: 1, height: 1, rotation: 0,
        startedAtTick: 0, workRemaining, completedBuildingId: "building:1", completedQueueId: "queue:2",
      }],
      staff: [],
    };
  }

  it("generates exactly one build candidate per site, priced from the definition", () => {
    const scratch = createTickScratch();
    taskGenerate({
      processingTick: 0, content: constructionContent, emit: resolutionEmitter().emit,
      random: createTickRandom(0, () => rngHandle(), scratch), scratch,
      changes: new BatchChanges(), state: siteState(3),
    });
    expect(scratch.taskCandidates.filter((entry) => entry.type === "build")).toEqual([
      { type: "build", priority: 5, effort: 3, buildingId: null, incidentId: null, constructionSiteId: "construction-site:0", productId: null, requiredRoleId: null, slot: 0 },
    ]);
  });

  it("never assigns a build candidate to a role that does not support it", () => {
    const rosterState: WorldGraphKindState = {
      ...siteState(3),
      staff: [{
        id: "staff:4", roleId: "cleaner", x: 1, y: 0, status: "idle",
        path: [], pathIndex: 0, moveProgressTicks: 0, assignedBuildingId: null,
        assignedZoneId: null, drawCount: 0, task: null, tasksCompleted: 0,
      }],
    };
    const scratch = createTickScratch();
    scratch.taskCandidates.push({ type: "build", priority: 5, effort: 3, buildingId: null, incidentId: null, constructionSiteId: "construction-site:0", productId: null, requiredRoleId: null, slot: 0 });
    const result = taskAssign({
      processingTick: 0, content: constructionContent, emit: resolutionEmitter().emit,
      random: createTickRandom(0, () => rngHandle(), scratch), scratch,
      changes: new BatchChanges(), state: rosterState,
    });
    expect(result.state.staff[0]?.task).toBeNull();
  });

  it("resolves a build candidate's goals to the construction site's own entrance", () => {
    const rosterState: WorldGraphKindState = {
      ...siteState(3),
      staff: [{
        id: "staff:4", roleId: "builder", x: 1, y: 0, status: "idle",
        path: [], pathIndex: 0, moveProgressTicks: 0, assignedBuildingId: null,
        assignedZoneId: null, drawCount: 0, task: null, tasksCompleted: 0,
      }],
    };
    const scratch = createTickScratch();
    scratch.taskCandidates.push({ type: "build", priority: 5, effort: 3, buildingId: null, incidentId: null, constructionSiteId: "construction-site:0", productId: null, requiredRoleId: null, slot: 0 });
    const result = taskAssign({
      processingTick: 0, content: constructionContent, emit: resolutionEmitter().emit,
      random: createTickRandom(0, () => rngHandle(), scratch), scratch,
      changes: new BatchChanges(), state: rosterState,
    });
    expect(result.state.staff[0]?.task).toMatchObject({ type: "build", constructionSiteId: "construction-site:0" });
    expect(result.state.staff[0]?.path.at(-1)).toEqual({ x: 1, y: 0 });
  });

  it("reduces work by exactly the assigned builder's effort per tick, completing on the computed tick", () => {
    let workState = siteState(3);
    workState = {
      ...workState,
      staff: [{
        id: "staff:4", roleId: "builder", x: 1, y: 0, status: "working",
        path: [{ x: 2, y: 0 }, { x: 1, y: 0 }], pathIndex: 1, moveProgressTicks: 0,
        assignedBuildingId: null, assignedZoneId: null, drawCount: 0, tasksCompleted: 0,
        task: {
          id: "task:5", type: "build", status: "in_progress", guestId: null, queueId: null,
          buildingId: null, constructionSiteId: "construction-site:0", incidentId: null,
          targetProductId: null, startedAtTick: 0, endedAtTick: null, priority: 5, effortRemaining: 3,
        },
      }],
    };
    const recording = resolutionEmitter();
    const runConstruction = (tick: number): void => {
      const scratch = createTickScratch();
      workState = construction({
        processingTick: tick, content: constructionContent, emit: recording.emit,
        random: createTickRandom(tick, () => rngHandle(), scratch), scratch,
        changes: new BatchChanges(), state: workState,
      }).state;
    };
    // Declared work is 3 with an effort-per-tick-1 builder continuously in_progress,
    // so the site reaches zero on the third call — tick 2 (0-indexed).
    runConstruction(0);
    expect(workState.constructionSites[0]?.workRemaining).toBe(2);
    expect(workState.buildings).toEqual([]);
    runConstruction(1);
    expect(workState.constructionSites[0]?.workRemaining).toBe(1);
    runConstruction(2);
    expect(workState.constructionSites).toEqual([]);
    expect(workState.buildings[0]).toMatchObject({
      id: "building:1", definitionId: "hut", status: "open", wear: 100, cleanliness: 100,
      queue: { id: "queue:2", guestIds: [] },
    });
    expect(workState.counters.buildingsCompleted).toBe(1);
    expect(workState.map.revision).toBe(1);
    expect(workState.staff[0]).toMatchObject({ status: "idle", tasksCompleted: 1, task: { status: "completed", endedAtTick: 2 } });
    expect(recording.events.filter((entry) => entry.name === "kind.world-graph.construction.progressed")).toHaveLength(3);
    expect(recording.events.filter((entry) => entry.name === "kind.world-graph.construction.completed")).toEqual([
      { name: "kind.world-graph.construction.completed", severity: "info", data: { constructionSiteId: "construction-site:0", buildingId: "building:1" } },
    ]);
  });

  it("carries a batch-grain existence row for the completed building, reasoned and visible", () => {
    let workState = siteState(1);
    workState = {
      ...workState,
      staff: [{
        id: "staff:4", roleId: "builder", x: 1, y: 0, status: "working",
        path: [], pathIndex: 0, moveProgressTicks: 0, assignedBuildingId: null,
        assignedZoneId: null, drawCount: 0, tasksCompleted: 0,
        task: {
          id: "task:5", type: "build", status: "in_progress", guestId: null, queueId: null,
          buildingId: null, constructionSiteId: "construction-site:0", incidentId: null,
          targetProductId: null, startedAtTick: 0, endedAtTick: null, priority: 5, effortRemaining: 1,
        },
      }],
    };
    const changes = new BatchChanges();
    const scratch = createTickScratch();
    construction({
      processingTick: 0, content: constructionContent, emit: resolutionEmitter().emit,
      random: createTickRandom(0, () => rngHandle(), scratch), scratch,
      changes, state: workState,
    });
    const existenceRow = changes.finish().find((entry) => entry.path === "buildings.building:1.exists");
    expect(existenceRow).toMatchObject({ value: true, reason: "building_completed" });
    expect(WORLD_GRAPH_REASON_MESSAGES.get(`world-graph.reason.${existenceRow?.reason}`)).toBeTypeOf("string");
  });

  it("does not disturb serialize() if every event is dropped", () => {
    let workState = siteState(1);
    workState = {
      ...workState,
      staff: [{
        id: "staff:4", roleId: "builder", x: 1, y: 0, status: "working",
        path: [], pathIndex: 0, moveProgressTicks: 0, assignedBuildingId: null,
        assignedZoneId: null, drawCount: 0, tasksCompleted: 0,
        task: {
          id: "task:5", type: "build", status: "in_progress", guestId: null, queueId: null,
          buildingId: null, constructionSiteId: "construction-site:0", incidentId: null,
          targetProductId: null, startedAtTick: 0, endedAtTick: null, priority: 5, effortRemaining: 1,
        },
      }],
    };
    const scratch = createTickScratch();
    const withEvents = construction({
      processingTick: 0, content: constructionContent, emit: resolutionEmitter().emit,
      random: createTickRandom(0, () => rngHandle(), scratch), scratch,
      changes: new BatchChanges(), state: workState,
    }).state;
    const droppedScratch = createTickScratch();
    const withoutEvents = construction({
      processingTick: 0, content: constructionContent, emit: { emit: () => {} }, scratch: droppedScratch,
      random: createTickRandom(0, () => rngHandle(), droppedScratch),
      changes: new BatchChanges(), state: workState,
    }).state;
    expect(withoutEvents).toEqual(withEvents);
  });
});

describe("world-graph W82 restock", () => {
  const restockContent = {
    ...content(),
    terrain: [{ id: "sand", walkable: true, moveCost: 1 }],
    products: [{ id: "water", unitCostCents: 10, price: { defaultCents: 100 } }],
    buildings: [{
      id: "kiosk", footprint: { width: 1, height: 1 }, entrances: [{ x: 1, y: 0 }],
      operation: {
        kind: "service",
        products: [{ productId: "water", serviceTicks: 1, initialUnits: 0, capacity: 3, restockTaskPriority: 5 }],
        queueMaxLength: 5, baseServiceTicks: 1, staffRequirements: [], staffingTaskPriority: 0, effects: [],
      },
    }, {
      id: "hut", footprint: { width: 1, height: 1 }, entrances: [{ x: 1, y: 0 }], operation: { kind: "decorative" },
    }],
    staffRoles: [{
      id: "restocker", supportedTaskKinds: ["restock"], workRates: [{ taskType: "restock", effortPerTick: 1 }],
    }],
  } as unknown as WorldGraphCampaign;

  function kioskState(inventory: number): WorldGraphKindState {
    return {
      ...state(),
      buildings: [{
        id: "building:0", definitionId: "kiosk", x: 0, y: 0, width: 1, height: 1, rotation: 0,
        status: "open", buildStartTick: 0, wear: 100, cleanliness: 100,
        queue: { id: "queue:1", guestIds: [], serviceStartedAtTick: null },
        pricesCents: { water: 100 }, inventory: { water: inventory },
      }],
      staff: [],
    };
  }

  it("generates a restock candidate for a product missing units, priced from the product", () => {
    const scratch = createTickScratch();
    taskGenerate({
      processingTick: 0, content: restockContent, emit: resolutionEmitter().emit,
      random: createTickRandom(0, () => rngHandle(), scratch), scratch,
      changes: new BatchChanges(), state: kioskState(1),
    });
    expect(scratch.taskCandidates.filter((entry) => entry.type === "restock")).toEqual([
      { type: "restock", priority: 5, effort: 2, buildingId: "building:0", incidentId: null, constructionSiteId: null, productId: "water", requiredRoleId: null, slot: 0 },
    ]);
  });

  it("generates no candidate for a product whose units are unlimited", () => {
    const unlimitedContent = {
      ...restockContent,
      buildings: [{
        ...restockContent.buildings[0],
        operation: {
          ...(restockContent.buildings[0] as { operation: object }).operation,
          products: [{ productId: "water", serviceTicks: 1, initialUnits: null, capacity: null, restockTaskPriority: 5 }],
        },
      }, restockContent.buildings[1]],
    } as unknown as WorldGraphCampaign;
    const scratch = createTickScratch();
    taskGenerate({
      processingTick: 0, content: unlimitedContent, emit: resolutionEmitter().emit,
      random: createTickRandom(0, () => rngHandle(), scratch), scratch,
      changes: new BatchChanges(), state: { ...kioskState(1), buildings: [{ ...kioskState(1).buildings[0]!, inventory: { water: null } }] },
    });
    expect(scratch.taskCandidates.filter((entry) => entry.type === "restock")).toEqual([]);
  });

  it("generates no candidate once a product is already at capacity", () => {
    const scratch = createTickScratch();
    taskGenerate({
      processingTick: 0, content: restockContent, emit: resolutionEmitter().emit,
      random: createTickRandom(0, () => rngHandle(), scratch), scratch,
      changes: new BatchChanges(), state: kioskState(3),
    });
    expect(scratch.taskCandidates.filter((entry) => entry.type === "restock")).toEqual([]);
  });

  it("generates no candidate for a decorative building, an honest no-op", () => {
    const decorativeState: WorldGraphKindState = {
      ...kioskState(1),
      buildings: [{
        id: "building:1", definitionId: "hut", x: 1, y: 0, width: 1, height: 1, rotation: 0,
        status: "open", buildStartTick: 0, wear: 100, cleanliness: 100,
        queue: { id: "queue:2", guestIds: [], serviceStartedAtTick: null },
        pricesCents: {}, inventory: {},
      }],
    };
    const scratch = createTickScratch();
    taskGenerate({
      processingTick: 0, content: restockContent, emit: resolutionEmitter().emit,
      random: createTickRandom(0, () => rngHandle(), scratch), scratch,
      changes: new BatchChanges(), state: decorativeState,
    });
    expect(scratch.taskCandidates).toEqual([]);
  });

  it("fills inventory by the assigned restocker's effort per tick, clamped at capacity, and completes the task", () => {
    let workState = kioskState(1);
    workState = {
      ...workState,
      staff: [{
        id: "staff:4", roleId: "restocker", x: 1, y: 0, status: "working",
        path: [], pathIndex: 0, moveProgressTicks: 0, assignedBuildingId: null,
        assignedZoneId: null, drawCount: 0, tasksCompleted: 0,
        task: {
          id: "task:5", type: "restock", status: "in_progress", guestId: null, queueId: null,
          buildingId: "building:0", constructionSiteId: null, incidentId: null,
          targetProductId: "water", startedAtTick: 0, endedAtTick: null, priority: 5, effortRemaining: 2,
        },
      }],
    };
    const runBuildings = (tick: number): void => {
      const scratch = createTickScratch();
      workState = buildings({
        processingTick: tick, content: restockContent, emit: resolutionEmitter().emit,
        random: createTickRandom(tick, () => rngHandle(), scratch), scratch,
        changes: new BatchChanges(), state: workState,
      }).state;
    };
    runBuildings(0);
    expect(workState.buildings[0]?.inventory.water).toBe(2);
    expect(workState.staff[0]?.task?.status).toBe("in_progress");
    runBuildings(1);
    expect(workState.buildings[0]?.inventory.water).toBe(3);
    expect(workState.staff[0]).toMatchObject({ status: "idle", tasksCompleted: 1, task: { status: "completed", endedAtTick: 1 } });
    // Never exceeds capacity on a further tick.
    runBuildings(2);
    expect(workState.buildings[0]?.inventory.water).toBe(3);
  });

  it("never applies cleanliness or wear", () => {
    let workState = kioskState(1);
    workState = {
      ...workState,
      staff: [{
        id: "staff:4", roleId: "restocker", x: 1, y: 0, status: "working",
        path: [], pathIndex: 0, moveProgressTicks: 0, assignedBuildingId: null,
        assignedZoneId: null, drawCount: 0, tasksCompleted: 0,
        task: {
          id: "task:5", type: "restock", status: "in_progress", guestId: null, queueId: null,
          buildingId: "building:0", constructionSiteId: null, incidentId: null,
          targetProductId: "water", startedAtTick: 0, endedAtTick: null, priority: 5, effortRemaining: 2,
        },
      }],
    };
    const scratch = createTickScratch();
    const result = buildings({
      processingTick: 0, content: restockContent, emit: resolutionEmitter().emit,
      random: createTickRandom(0, () => rngHandle(), scratch), scratch,
      changes: new BatchChanges(), state: workState,
    });
    expect(result.state.buildings[0]?.cleanliness).toBe(workState.buildings[0]?.cleanliness);
    expect(result.state.buildings[0]?.wear).toBe(workState.buildings[0]?.wear);
  });
});

describe("world-graph W83 cleanliness-wear", () => {
  function runMeter(input: WorldGraphKindState, scratch = createTickScratch(), tick = 0): { readonly state: WorldGraphKindState; readonly events: RecordedResolutionEvent[]; readonly changes: BatchChanges } {
    const recording = resolutionEmitter();
    const changes = new BatchChanges();
    const result = cleanlinessWear({
      processingTick: tick, content: content(), emit: recording.emit,
      random: createTickRandom(tick, () => rngHandle(), scratch), scratch, changes, state: input,
    });
    return { state: result.state, events: recording.events, changes };
  }

  it("sums service, litter, staff and policy deltas once and clamps once, distinct from clamping between sources", () => {
    const initial: WorldGraphKindState = {
      ...state(),
      buildings: [{ ...state().buildings[0]!, cleanliness: 50 }],
      incidents: [{ ...state().incidents[0]!, buildingId: "building:0", amount: 40, resolvedAtTick: null }],
    };
    const scratch = createTickScratch();
    scratch.deferredBuildingMeterDeltas.push(
      { source: "service", buildingId: "building:0", meter: "cleanliness", delta: 90 },
      { source: "staff", buildingId: "building:0", meter: "cleanliness", delta: 90 },
      { source: "policy", buildingId: "building:0", meter: "cleanliness", delta: -90 },
    );
    // Single clamp at the end: 50 + 90 - 40 + 90 - 90 = 100. Clamping between each source
    // (service first: 140 -> 100; then litter: 60; then staff: 150 -> 100; then policy: 10)
    // would land on 10 instead — the case this test exists to distinguish.
    const { state: result } = runMeter(initial, scratch);
    expect(result.buildings[0]?.cleanliness).toBe(100);
  });

  it("leaves the meter and status untouched when no source produces a delta", () => {
    const initial = state();
    const { state: result } = runMeter(initial);
    expect(result).toEqual(initial);
  });

  // W95.3/W95.4 — issue #349: a deferred building-meter effect's own `scenario.effect.applied`
  // must reflect the final composed-and-clamped result, not the raw pre-composition delta.
  it("emits scenario.effect.applied once when a policy-sourced delta actually moves the meter", () => {
    const initial: WorldGraphKindState = { ...state(), buildings: [{ ...state().buildings[0]!, cleanliness: 50 }] };
    const scratch = createTickScratch();
    scratch.deferredBuildingMeterDeltas.push({ source: "policy", buildingId: "building:0", meter: "cleanliness", delta: 10 });
    const { state: result, events } = runMeter(initial, scratch);
    expect(result.buildings[0]?.cleanliness).toBe(60);
    expect(events.filter((event) => event.name === "kind.world-graph.scenario.effect.applied")).toHaveLength(1);
  });

  it("emits no scenario.effect.applied when a policy delta nets to zero against another source", () => {
    const initial: WorldGraphKindState = { ...state(), buildings: [{ ...state().buildings[0]!, cleanliness: 50 }] };
    const scratch = createTickScratch();
    scratch.deferredBuildingMeterDeltas.push(
      { source: "policy", buildingId: "building:0", meter: "cleanliness", delta: 10 },
      { source: "staff", buildingId: "building:0", meter: "cleanliness", delta: -10 },
    );
    const { state: result, events } = runMeter(initial, scratch);
    expect(result.buildings[0]?.cleanliness).toBe(50);
    expect(events.some((event) => event.name === "kind.world-graph.scenario.effect.applied")).toBe(false);
  });

  it("emits no scenario.effect.applied for a policy-untouched meter, even when another source moves it", () => {
    const initial: WorldGraphKindState = { ...state(), buildings: [{ ...state().buildings[0]!, cleanliness: 50 }] };
    const scratch = createTickScratch();
    scratch.deferredBuildingMeterDeltas.push({ source: "staff", buildingId: "building:0", meter: "cleanliness", delta: 10 });
    const { state: result, events } = runMeter(initial, scratch);
    expect(result.buildings[0]?.cleanliness).toBe(60);
    expect(events.some((event) => event.name === "kind.world-graph.scenario.effect.applied")).toBe(false);
  });

  it("moves wear to zero and breaks an open building; cleanliness reaching zero never breaks it on its own", () => {
    const initial: WorldGraphKindState = {
      ...state(),
      buildings: [{ ...state().buildings[0]!, status: "open", wear: 10, cleanliness: 5 }],
      incidents: [{ ...state().incidents[0]!, buildingId: "building:0", amount: 50, resolvedAtTick: null }],
    };
    const scratch = createTickScratch();
    scratch.deferredBuildingMeterDeltas.push({ source: "staff", buildingId: "building:0", meter: "wear", delta: -10 });
    const { state: result, changes } = runMeter(initial, scratch);
    expect(result.buildings[0]?.wear).toBe(0);
    expect(result.buildings[0]?.status).toBe("broken");
    expect(result.buildings[0]?.cleanliness).toBe(0);
    const statusRow = changes.finish().find((entry) => entry.path === "buildings.building:0.status");
    expect(statusRow).toMatchObject({ value: "broken", previous: "open", reason: "building_broken", visible: true });
    expect(WORLD_GRAPH_REASON_MESSAGES.get(`world-graph.reason.${statusRow?.reason}`)).toBeTypeOf("string");
  });

  it("breaks a closed building the same way as an open one", () => {
    const initial: WorldGraphKindState = {
      ...state(),
      buildings: [{ ...state().buildings[0]!, status: "closed", wear: 5 }],
    };
    const scratch = createTickScratch();
    scratch.deferredBuildingMeterDeltas.push({ source: "policy", buildingId: "building:0", meter: "wear", delta: -5 });
    const { state: result } = runMeter(initial, scratch);
    expect(result.buildings[0]?.status).toBe("broken");
  });

  it("never breaks an already-broken building again", () => {
    const initial: WorldGraphKindState = {
      ...state(),
      buildings: [{ ...state().buildings[0]!, status: "broken", wear: 5 }],
    };
    const scratch = createTickScratch();
    scratch.deferredBuildingMeterDeltas.push({ source: "policy", buildingId: "building:0", meter: "wear", delta: -5 });
    const { state: result, changes } = runMeter(initial, scratch);
    expect(result.buildings[0]?.status).toBe("broken");
    expect(changes.finish().some((entry) => entry.path === "buildings.building:0.status")).toBe(false);
  });

  it("applies a cleaning incident's deferred onResolve recovery exactly once", () => {
    const initial = state();
    const workContent = {
      ...content(),
      staffRoles: [{ id: "cleaner", moveTicksPerTile: 1, workRates: [{ taskType: "clean", effortPerTick: 5 }] }],
      incidents: [{
        ...content().incidents[0], id: "litter",
        onResolve: [{ kind: "building_meter_delta", meter: "cleanliness", delta: 15, buildings: { kind: "current_incident_building" } }],
      }],
    } as unknown as WorldGraphCampaign;
    let workState: WorldGraphKindState = {
      ...initial,
      buildings: [{ ...initial.buildings[0]!, cleanliness: 50 }],
      incidents: initial.incidents.map((incident) => ({ ...incident, amount: 5, buildingId: "building:0" })),
      staff: [{
        id: "staff:4", roleId: "cleaner", x: 0, y: 0, status: "working",
        path: [{ x: 0, y: 0 }], pathIndex: 0, moveProgressTicks: 0, assignedBuildingId: null,
        assignedZoneId: null, drawCount: 0, tasksCompleted: 0,
        task: {
          id: "task:5", type: "clean", status: "in_progress", guestId: null, queueId: null,
          buildingId: null, constructionSiteId: null, incidentId: "incident:3", targetProductId: null,
          startedAtTick: 0, endedAtTick: null, priority: 1, effortRemaining: 5,
        },
      }],
    };
    const tick = (n: number): void => {
      const scratch = createTickScratch();
      const frame: WorldGraphTickFrame = {
        processingTick: n, content: workContent, emit: resolutionEmitter().emit,
        random: createTickRandom(n, () => rngHandle(), scratch), scratch,
        changes: new BatchChanges(), state: workState,
      };
      workState = cleanlinessWear(staffWork(frame)).state;
    };
    tick(0);
    expect(workState.incidents[0]).toMatchObject({ amount: 0, resolvedAtTick: 0 });
    expect(workState.buildings[0]?.cleanliness).toBe(65);
    tick(1);
    expect(workState.buildings[0]?.cleanliness).toBe(65);
  });

  it("emits building.meter.changed per changed meter without adding per-tick audit rows, auditing only the broken transition", () => {
    let workState: WorldGraphKindState = {
      ...state(),
      buildings: [{ ...state().buildings[0]!, cleanliness: 100, wear: 3 }],
      incidents: [{ ...state().incidents[0]!, buildingId: "building:0", amount: 10, resolvedAtTick: null }],
    };
    const changes = new BatchChanges();
    const recording = resolutionEmitter();
    for (let tick = 0; tick < 3; tick += 1) {
      const scratch = createTickScratch();
      if (tick === 0) scratch.deferredBuildingMeterDeltas.push({ source: "staff", buildingId: "building:0", meter: "wear", delta: -3 });
      workState = cleanlinessWear({
        processingTick: tick, content: content(), emit: recording.emit,
        random: createTickRandom(tick, () => rngHandle(), scratch), scratch, changes, state: workState,
      }).state;
    }
    expect(workState.buildings[0]?.cleanliness).toBe(70);
    expect(workState.buildings[0]?.wear).toBe(0);
    expect(workState.buildings[0]?.status).toBe("broken");
    const meterEvents = recording.events.filter((event) => event.name === "kind.world-graph.building.meter.changed");
    expect(meterEvents).toHaveLength(4); // 3 cleanliness ticks + the one wear tick
    const recorded = changes.finish();
    expect(recorded.some((entry) => entry.path.endsWith(".cleanliness") || entry.path.endsWith(".wear"))).toBe(false);
    expect(recorded.filter((entry) => entry.path === "buildings.building:0.status")).toHaveLength(1);
  });

  it("throws rather than silently losing precision when deferred sources leave the safe-integer range", () => {
    const initial: WorldGraphKindState = { ...state(), buildings: [{ ...state().buildings[0]!, cleanliness: 50 }] };
    const scratch = createTickScratch();
    // Unchecked `+` rounds the intermediate 2**53 + 1 down to 2**53 and lands on 1 rather than
    // 2, which the final clamp cannot detect — the meter ends up silently off by one. Checked
    // addition fails where the precision is actually lost, matching applyWorldEffects' grouping.
    scratch.deferredBuildingMeterDeltas.push(
      { source: "service", buildingId: "building:0", meter: "cleanliness", delta: 9007199254740991 },
      { source: "staff", buildingId: "building:0", meter: "cleanliness", delta: 2 },
      { source: "policy", buildingId: "building:0", meter: "cleanliness", delta: -9007199254740991 },
    );
    expect(() => runMeter(initial, scratch)).toThrow(/Unsafe world-graph integer/);
  });

  it("declares the meter-changed event and the building_broken reason", () => {
    expect(worldGraphKind.eventNames).toContain("kind.world-graph.building.meter.changed");
    // The reason is recorded on a `visible: true` row, so 04 §12 owes it a resolvable message.
    expect(WORLD_GRAPH_REASON_CODES).toContain("building_broken");
    expect(WORLD_GRAPH_REASON_MESSAGES.get("world-graph.reason.building_broken")).toBeTypeOf("string");
  });
});

describe("world-graph W85 alerts and achievements", () => {
  function runAlerts(input: WorldGraphKindState, alertContent: WorldGraphCampaign = content(), tick = 0): { readonly state: WorldGraphKindState; readonly events: RecordedResolutionEvent[]; readonly changes: BatchChanges } {
    const recording = resolutionEmitter();
    const changes = new BatchChanges();
    const scratch = createTickScratch();
    const result = alerts({
      processingTick: tick, content: alertContent, emit: recording.emit,
      random: createTickRandom(tick, () => rngHandle(), scratch), scratch, changes, state: input,
    });
    return { state: result.state, events: recording.events, changes };
  }

  const achievementDefinition = (condition: unknown) => ({
    id: "cleaned", text: { nameKey: "a.name", descriptionKey: "a.desc" },
    condition, hidden: false, scope: "profile", tags: [],
  });

  it("W85.1: unlocks a still-locked achievement against post-resolution state, writing the core achievement_unlocked reason", () => {
    const achievementContent = {
      ...content(),
      achievements: [achievementDefinition({ kind: "compare", metric: { kind: "counter", counter: "litterCleaned" }, op: "gte", value: 1 })],
    } as unknown as WorldGraphCampaign;
    const initial: WorldGraphKindState = { ...state(), counters: { ...state().counters, litterCleaned: 1 } };
    const { state: result, changes, events } = runAlerts(initial, achievementContent);
    expect(result.unlockedAchievementIds).toEqual(["cleaned"]);
    const row = changes.finish().find((entry) => entry.path === "unlockedAchievementIds.cleaned.exists");
    expect(row).toMatchObject({ value: true, previous: false, reason: "achievement_unlocked", visible: true });
    expect(events.some((event) => event.name === "kind.world-graph.achievement.unlocked")).toBe(true);
  });

  it("W85.1: an already-unlocked achievement is never re-evaluated or re-recorded", () => {
    const achievementContent = {
      ...content(), achievements: [achievementDefinition({ kind: "constant", value: true })],
    } as unknown as WorldGraphCampaign;
    const initial: WorldGraphKindState = { ...state(), unlockedAchievementIds: ["cleaned"] };
    const { state: result, changes } = runAlerts(initial, achievementContent);
    expect(result.unlockedAchievementIds).toEqual(["cleaned"]);
    expect(changes.finish().some((entry) => entry.reason === "achievement_unlocked")).toBe(false);
  });

  it("W85.2/W85.4: derives all three closed alert families keyed on published ids only, resolving kind-owned strings for two and the incident definition's own text for the third", () => {
    const withIncident = runAlerts(state());
    const incidentAlert = withIncident.state.alerts.find((entry) => entry.type === "incident_active");
    expect(incidentAlert).toMatchObject({ semanticKey: "incident:incident:3", titleKey: "incident.litter.name", messageKey: "incident.litter.description" });

    const withBroken = runAlerts({ ...state(), incidents: [], buildings: [{ ...state().buildings[0]!, status: "broken" }] });
    const brokenAlert = withBroken.state.alerts.find((entry) => entry.type === "building_broken");
    expect(brokenAlert).toMatchObject({ semanticKey: "building-broken:building:0", titleKey: "world-graph.alert.building-broken.title", messageKey: "world-graph.alert.building-broken.message" });
    expect(WORLD_GRAPH_REASON_MESSAGES.get(brokenAlert!.titleKey)).toBeTypeOf("string");
    expect(WORLD_GRAPH_REASON_MESSAGES.get(brokenAlert!.messageKey)).toBeTypeOf("string");

    const withResolved = runAlerts({ ...state(), incidents: [], resolution: { resolution: "objectives_met", objectiveIds: [], failureId: null, resolvedAtTick: 0 } });
    const resolvedAlert = withResolved.state.alerts.find((entry) => entry.type === "scenario_resolved");
    expect(resolvedAlert).toMatchObject({ semanticKey: "scenario-resolved", titleKey: "world-graph.alert.scenario-resolved.title", messageKey: "world-graph.alert.scenario-resolved.message" });
    expect(WORLD_GRAPH_REASON_MESSAGES.get(resolvedAlert!.titleKey)).toBeTypeOf("string");
    expect(WORLD_GRAPH_REASON_MESSAGES.get(resolvedAlert!.messageKey)).toBeTypeOf("string");

    // No campaign-authored text ever reaches a semantic key — each is built only from the
    // closed family name plus a published id.
    for (const alert of [...withIncident.state.alerts, ...withBroken.state.alerts, ...withResolved.state.alerts]) {
      expect(alert.semanticKey).not.toMatch(/name|description/i);
    }
  });

  it("W85.3/W85.6: raises one alert for a newly active source, clears it once inactive, never duplicates while uncleared, and hides the creation/removal audit", () => {
    let workState: WorldGraphKindState = { ...state() }; // one unresolved litter incident already present
    const changes = new BatchChanges();
    const recording = resolutionEmitter();
    const tick = (n: number, resolve: boolean): void => {
      const scratch = createTickScratch();
      const input = resolve
        ? { ...workState, incidents: workState.incidents.map((entry) => entry.resolvedAtTick === null ? { ...entry, resolvedAtTick: n } : entry) }
        : workState;
      workState = alerts({
        processingTick: n, content: content(), emit: recording.emit,
        random: createTickRandom(n, () => rngHandle(), scratch), scratch, changes, state: input,
      }).state;
    };

    tick(0, false); // raise
    expect(workState.alerts).toHaveLength(1);
    expect(workState.alerts[0]).toMatchObject({ type: "incident_active", clearedAtTick: null });
    tick(1, false); // still active — no duplicate
    expect(workState.alerts).toHaveLength(1);
    tick(2, true); // source no longer active — cleared, not removed
    expect(workState.alerts).toHaveLength(1);
    expect(workState.alerts[0]?.clearedAtTick).toBe(2);

    const rows = changes.finish();
    const raisedRow = rows.find((entry) => entry.reason === "alert_raised");
    const clearedRow = rows.find((entry) => entry.reason === "alert_cleared");
    expect(raisedRow).toMatchObject({ path: `alerts.${workState.alerts[0]!.id}.exists`, value: true, visible: false });
    expect(clearedRow).toMatchObject({ path: `alerts.${workState.alerts[0]!.id}.clearedAtTick`, value: 2, visible: false });
    expect(recording.events.some((event) => event.name === "kind.world-graph.alert.raised")).toBe(true);
    expect(recording.events.some((event) => event.name === "kind.world-graph.alert.cleared")).toBe(true);
  });

  it("W85.5: alerts and achievements feed nothing downstream — dropping them before tick-finalize leaves the rest of state identical", () => {
    const achievementContent = {
      ...content(), achievements: [achievementDefinition({ kind: "compare", metric: { kind: "counter", counter: "litterCleaned" }, op: "gte", value: 1 })],
    } as unknown as WorldGraphCampaign;
    const initial: WorldGraphKindState = { ...state(), counters: { ...state().counters, litterCleaned: 1 } };

    const scratchA = createTickScratch();
    const withAlerts = alerts({
      processingTick: 0, content: achievementContent, emit: resolutionEmitter().emit,
      random: createTickRandom(0, () => rngHandle(), scratchA), scratch: scratchA, changes: new BatchChanges(), state: initial,
    }).state;
    expect(withAlerts.alerts.length + withAlerts.unlockedAchievementIds.length).toBeGreaterThan(0);

    const stripped: WorldGraphKindState = {
      ...withAlerts, alerts: initial.alerts, unlockedAchievementIds: initial.unlockedAchievementIds, nextEntityOrdinal: initial.nextEntityOrdinal,
    };
    const finalize = (input: WorldGraphKindState): WorldGraphKindState => {
      const scratch = createTickScratch();
      return tickFinalize({
        processingTick: 0, content: achievementContent, emit: resolutionEmitter().emit,
        random: createTickRandom(0, () => rngHandle(), scratch), scratch, changes: new BatchChanges(), state: input,
      }).state;
    };
    const finalizedWith = finalize(withAlerts);
    const finalizedWithout = finalize(stripped);
    const omit = (value: WorldGraphKindState) => ({ ...value, alerts: null, unlockedAchievementIds: null, nextEntityOrdinal: null });
    expect(omit(finalizedWith)).toEqual(omit(finalizedWithout));
  });
});

describe("world-graph W87 tick events", () => {
  it("W87.1/W87.2: declares every emitted name and emits every declared name — the bidirectional gate against 12 §12's table", () => {
    const source = (relativePath: string): string => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
    const pipelineSources = [source("./pipeline.ts"), source("./batch.ts")].join("\n");
    const actionSources = [
      source("../actions/alerts.ts"), source("../actions/build.ts"),
      source("../actions/staff.ts"), source("../actions/building.ts"),
    ].join("\n");
    // W96 centralized every call site's (name, severity) pair into `events.ts`'s
    // `WORLD_GRAPH_EVENTS` table (12 §12's own callout that a literal at each call site let
    // the contract table and the source drift). A call site now references a table key
    // (`WORLD_GRAPH_EVENTS.someKey`) instead of a `kind.world-graph.*` string literal, so the
    // emitted set is built by finding which keys are actually referenced from production
    // source and resolving each through the real, imported table — still proving a live
    // emit site exists for the name, not merely that the table declares it.
    const referencedKeys = new Set(
      [...(pipelineSources + actionSources).matchAll(/WORLD_GRAPH_EVENTS\.([a-zA-Z0-9_]+)/g)].map((match) => match[1]!),
    );
    const emitted = new Set<string>([...referencedKeys].map((key) => WORLD_GRAPH_EVENTS[key as keyof typeof WORLD_GRAPH_EVENTS].name));
    const declared = new Set(worldGraphKind.eventNames);
    expect([...declared].filter((name) => !emitted.has(name)), "declared with no emit site").toEqual([]);
    expect([...emitted].filter((name) => !declared.has(name)), "emitted but never declared").toEqual([]);
  });

  const kioskContent = {
    ...content(),
    terrain: [{ id: "sand", walkable: true, moveCost: 1 }],
    products: [{ id: "water", unitCostCents: 1, price: { defaultCents: 5 } }],
    buildings: [{
      id: "kiosk", footprint: { width: 1, height: 1 }, entrances: [{ x: 1, y: 0 }],
      operation: {
        kind: "service",
        products: [{ productId: "water", serviceTicks: 1, initialUnits: 5, capacity: 5 }],
        queueMaxLength: 1, baseServiceTicks: 1, staffRequirements: [], staffingTaskPriority: 0, effects: [],
      },
    }],
  } as unknown as WorldGraphCampaign;

  it("W87 guest-needs (system 3): emits guest.meter.changed, trace, for each need that actually drifted, sorted by guest then need", () => {
    const driftContent = {
      ...content(),
      needs: [{ id: "thirst", minimum: 0, maximum: 100, criticalBelow: 0, satisfiedAtOrAbove: 100 }],
      guestArchetypes: [{
        ...content().guestArchetypes[0],
        needs: [{ needId: "thirst", initial: { min: 50, max: 50 }, driftByCurrentValue: { interpolation: "step", points: [{ input: 0, output: -1 }] }, utilityByCurrentValue: { interpolation: "step", points: [{ input: 0, output: 0 }] } }],
      }],
    } as unknown as WorldGraphCampaign;
    const recording = resolutionEmitter();
    const scratch = createTickScratch();
    const result = guestNeeds({
      processingTick: 0, content: driftContent, emit: recording.emit,
      random: createTickRandom(0, () => rngHandle(), scratch), scratch, changes: new BatchChanges(), state: state(),
    });
    expect(result.state.guests[0]?.needs.thirst).toBe(49);
    expect(recording.events).toEqual([
      { name: "kind.world-graph.guest.meter.changed", severity: "trace", data: { guestId: "guest:2", meter: "thirst", value: 49 } },
    ]);
  });

  it("W87 queues (system 5): emits queue.joined on FIFO admission and service.started once the head is servable", () => {
    const arriving: WorldGraphKindState = {
      ...state(),
      buildings: [{ ...state().buildings[0]!, definitionId: "kiosk", queue: { id: "queue:1", guestIds: [], serviceStartedAtTick: null } }],
      guests: [{
        ...state().guests[0]!, lifecycle: "seeking", x: 1, y: 0,
        intent: { kind: "seek_service", buildingId: "building:0", productId: "water", selectedAtTick: 0 },
      }],
    };
    const recording = resolutionEmitter();
    const scratch = createTickScratch();
    const result = queues({
      processingTick: 0, content: kioskContent, emit: recording.emit,
      random: createTickRandom(0, () => rngHandle(), scratch), scratch, changes: new BatchChanges(), state: arriving,
    });
    expect(result.state.buildings[0]?.queue).toMatchObject({ guestIds: ["guest:2"], serviceStartedAtTick: 0 });
    expect(recording.events).toEqual([
      { name: "kind.world-graph.queue.joined", severity: "trace", data: { buildingId: "building:0", guestId: "guest:2" } },
      { name: "kind.world-graph.service.started", severity: "trace", data: { buildingId: "building:0", guestId: "guest:2", productId: "water" } },
    ]);
  });

  it("W87 queues (system 5): emits queue.abandoned, trace, when a queued guest's patience reaches zero", () => {
    const abandoning: WorldGraphKindState = {
      ...state(),
      buildings: [{ ...state().buildings[0]!, definitionId: "kiosk", queue: { id: "queue:1", guestIds: ["guest:2"], serviceStartedAtTick: null } }],
      guests: [{ ...state().guests[0]!, lifecycle: "queued", patienceRemainingTicks: 0 }],
    };
    const recording = resolutionEmitter();
    const scratch = createTickScratch();
    queues({
      processingTick: 0, content: kioskContent, emit: recording.emit,
      random: createTickRandom(0, () => rngHandle(), scratch), scratch, changes: new BatchChanges(), state: abandoning,
    });
    expect(recording.events).toContainEqual({ name: "kind.world-graph.queue.abandoned", severity: "trace", data: { buildingId: "building:0", guestId: "guest:2" } });
  });

  it("W87 guest-intent (system 6): emits guest.intent.selected, trace, whether the guest commits to a service or falls back", () => {
    const seeking: WorldGraphKindState = {
      ...state(),
      buildings: [{ ...state().buildings[0]!, definitionId: "kiosk", queue: { id: "queue:1", guestIds: [], serviceStartedAtTick: null }, pricesCents: { water: 5 }, inventory: { water: 5 } }],
      guests: [{ ...state().guests[0]!, lifecycle: "seeking", x: 1, y: 0, intent: { kind: "wait", untilTick: 0, selectedAtTick: 0 } }],
    };
    const recording = resolutionEmitter();
    const scratch = createTickScratch();
    const result = guestIntent({
      processingTick: 0, content: kioskContent, emit: recording.emit,
      random: createTickRandom(0, () => rngHandle(), scratch), scratch, changes: new BatchChanges(), state: seeking,
    });
    expect(result.state.guests[0]?.intent.kind).toBe("seek_service");
    expect(recording.events).toEqual([
      { name: "kind.world-graph.guest.intent.selected", severity: "trace", data: { guestId: "guest:2", intentKind: "seek_service" } },
    ]);
  });

  it("W87 guest-path (system 7): emits guest.path.committed on a real path, guest.path.failed when the goal is unreachable", () => {
    const committing: WorldGraphKindState = {
      ...state(), buildings: [{ ...state().buildings[0]!, definitionId: "kiosk" }],
      guests: [{ ...state().guests[0]!, lifecycle: "seeking", x: 1, y: 0, intent: { kind: "seek_service", buildingId: "building:0", productId: "water", selectedAtTick: 0 } }],
    };
    const recordingA = resolutionEmitter();
    const scratchA = createTickScratch();
    guestPath({
      processingTick: 0, content: kioskContent, emit: recordingA.emit,
      random: createTickRandom(0, () => rngHandle(), scratchA), scratch: scratchA, changes: new BatchChanges(), state: committing,
    });
    expect(recordingA.events).toEqual([{ name: "kind.world-graph.guest.path.committed", severity: "trace", data: { guestId: "guest:2" } }]);

    // The building sits far outside the two-cell terrain, so its entrance is simply undefined
    // — unreachable — while an explicit (0,0)->(1,0) edge keeps the exit reachable for
    // `leaveIntent`'s own fallback path, exercising the failure branch without also breaking it.
    const failing: WorldGraphKindState = {
      ...state(),
      map: { ...state().map, paths: [{ from: { x: 0, y: 0 }, to: { x: 1, y: 0 }, edgeCost: 1, allowed: true }] },
      buildings: [{ ...state().buildings[0]!, definitionId: "kiosk", x: 10, y: 10 }],
      guests: [{ ...state().guests[0]!, lifecycle: "seeking", x: 0, y: 0, intent: { kind: "seek_service", buildingId: "building:0", productId: "water", selectedAtTick: 0 } }],
    };
    const recordingB = resolutionEmitter();
    const scratchB = createTickScratch();
    guestPath({
      processingTick: 0, content: kioskContent, emit: recordingB.emit,
      random: createTickRandom(0, () => rngHandle(), scratchB), scratch: scratchB, changes: new BatchChanges(), state: failing,
    });
    expect(recordingB.events).toEqual([{ name: "kind.world-graph.guest.path.failed", severity: "debug", data: { guestId: "guest:2" } }]);
  });

  it("W87 guest-move (system 8): emits guest.moved on every step and guest.departed, debug, on the exit step", () => {
    const moving: WorldGraphKindState = {
      ...state(), buildings: [{ ...state().buildings[0]!, definitionId: "kiosk" }],
      guests: [{
        ...state().guests[0]!, lifecycle: "seeking", x: 0, y: 0, path: [{ x: 0, y: 0 }, { x: 1, y: 0 }], pathIndex: 0,
        intent: { kind: "leave", exit: { x: 1, y: 0 }, reason: "unreachable", selectedAtTick: 0 },
      }],
    };
    const recording = resolutionEmitter();
    const scratch = createTickScratch();
    const result = guestMove({
      processingTick: 0, content: kioskContent, emit: recording.emit,
      random: createTickRandom(0, () => rngHandle(), scratch), scratch, changes: new BatchChanges(), state: moving,
    });
    expect(result.state.guests[0]?.lifecycle).toBe("departed");
    expect(recording.events).toEqual([{ name: "kind.world-graph.guest.departed", severity: "debug", data: { guestId: "guest:2" } }]);

    const stillMoving: WorldGraphKindState = {
      ...moving,
      guests: [{ ...moving.guests[0]!, path: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }], intent: { kind: "seek_service", buildingId: "building:0", productId: "water", selectedAtTick: 0 } }],
    };
    const recording2 = resolutionEmitter();
    const scratch2 = createTickScratch();
    guestMove({
      processingTick: 0, content: kioskContent, emit: recording2.emit,
      random: createTickRandom(0, () => rngHandle(), scratch2), scratch: scratch2, changes: new BatchChanges(), state: stillMoving,
    });
    expect(recording2.events).toEqual([{ name: "kind.world-graph.guest.moved", severity: "trace", data: { guestId: "guest:2" } }]);
  });

  const cleanContent = {
    ...content(),
    terrain: [{ id: "sand", walkable: true, moveCost: 1 }],
    incidents: [{ ...content().incidents[0], id: "litter", resolverTaskType: "clean", resolverTaskPriority: 1, onResolve: [] }],
    staffRoles: [{ id: "cleaner", moveTicksPerTile: 1, supportedTaskKinds: ["clean"], workRates: [{ taskType: "clean", effortPerTick: 5 }] }],
  } as unknown as WorldGraphCampaign;

  it("W87 task-generate (system 9): emits task.candidate.generated, trace, an optional diagnostic count — never once nothing is generated", () => {
    const withIncident: WorldGraphKindState = { ...state(), buildings: [], incidents: [{ ...state().incidents[0]!, position: { x: 0, y: 0 } }] };
    const recording = resolutionEmitter();
    const scratch = createTickScratch();
    taskGenerate({
      processingTick: 0, content: cleanContent, emit: recording.emit,
      random: createTickRandom(0, () => rngHandle(), scratch), scratch, changes: new BatchChanges(), state: withIncident,
    });
    expect(recording.events).toEqual([{ name: "kind.world-graph.task.candidate.generated", severity: "trace", data: { count: 1 } }]);

    const recordingEmpty = resolutionEmitter();
    const scratchEmpty = createTickScratch();
    taskGenerate({
      processingTick: 0, content: cleanContent, emit: recordingEmpty.emit,
      random: createTickRandom(0, () => rngHandle(), scratchEmpty), scratch: scratchEmpty, changes: new BatchChanges(), state: { ...state(), buildings: [], incidents: [] },
    });
    expect(recordingEmpty.events).toEqual([]);
  });

  it("W87 task-assign (system 10): emits staff.task.assigned, trace, at the moment a candidate is matched to staff", () => {
    const withIncident: WorldGraphKindState = {
      ...state(), buildings: [], incidents: [{ ...state().incidents[0]!, position: { x: 0, y: 0 } }],
      staff: [{
        id: "staff:4", roleId: "cleaner", x: 0, y: 0, status: "idle",
        path: [], pathIndex: 0, moveProgressTicks: 0, assignedBuildingId: null,
        assignedZoneId: null, drawCount: 0, task: null, tasksCompleted: 0,
      }],
    };
    const recording = resolutionEmitter();
    const scratch = createTickScratch();
    scratch.taskCandidates.push({ type: "clean", priority: 1, effort: 1, buildingId: null, incidentId: "incident:3", constructionSiteId: null, productId: null, requiredRoleId: null, slot: 0 });
    const result = taskAssign({
      processingTick: 0, content: cleanContent, emit: recording.emit,
      random: createTickRandom(0, () => rngHandle(), scratch), scratch, changes: new BatchChanges(), state: withIncident,
    });
    const taskId = result.state.staff[0]?.task?.id;
    expect(taskId).toBeTruthy();
    expect(recording.events).toEqual([{ name: "kind.world-graph.staff.task.assigned", severity: "trace", data: { staffId: "staff:4", taskId: taskId!, type: "clean" } }]);
  });

  it("W87 staff-work (system 11): emits staff.moved while traversing, staff.task.completed on finish, staff.task.cancelled when the incident is already resolved", () => {
    const movingStaff: WorldGraphKindState = {
      ...state(), incidents: [],
      staff: [{
        id: "staff:4", roleId: "cleaner", x: 0, y: 0, status: "to_work",
        path: [{ x: 0, y: 0 }, { x: 1, y: 0 }], pathIndex: 0, moveProgressTicks: 0,
        assignedBuildingId: null, assignedZoneId: null, drawCount: 0, tasksCompleted: 0,
        task: { id: "task:5", type: "clean", status: "assigned", guestId: null, queueId: null, buildingId: null, constructionSiteId: null, incidentId: "incident:3", targetProductId: null, startedAtTick: 0, endedAtTick: null, priority: 1, effortRemaining: 1 },
      }],
    };
    const recordingMove = resolutionEmitter();
    const scratchMove = createTickScratch();
    staffWork({
      processingTick: 0, content: cleanContent, emit: recordingMove.emit,
      random: createTickRandom(0, () => rngHandle(), scratchMove), scratch: scratchMove, changes: new BatchChanges(), state: movingStaff,
    });
    expect(recordingMove.events).toEqual([{ name: "kind.world-graph.staff.moved", severity: "trace", data: { staffId: "staff:4", x: 1, y: 0 } }]);

    const finishing: WorldGraphKindState = {
      ...state(), incidents: [{ ...state().incidents[0]!, amount: 1 }],
      staff: [{
        id: "staff:4", roleId: "cleaner", x: 0, y: 0, status: "working",
        path: [], pathIndex: 0, moveProgressTicks: 0, assignedBuildingId: null, assignedZoneId: null, drawCount: 0, tasksCompleted: 0,
        task: { id: "task:5", type: "clean", status: "in_progress", guestId: null, queueId: null, buildingId: null, constructionSiteId: null, incidentId: "incident:3", targetProductId: null, startedAtTick: 0, endedAtTick: null, priority: 1, effortRemaining: 1 },
      }],
    };
    const recordingFinish = resolutionEmitter();
    const scratchFinish = createTickScratch();
    staffWork({
      processingTick: 0, content: cleanContent, emit: recordingFinish.emit,
      random: createTickRandom(0, () => rngHandle(), scratchFinish), scratch: scratchFinish, changes: new BatchChanges(), state: finishing,
    });
    expect(recordingFinish.events).toContainEqual({ name: "kind.world-graph.staff.task.completed", severity: "trace", data: { staffId: "staff:4", taskId: "task:5" } });

    const alreadyResolved: WorldGraphKindState = {
      ...state(), incidents: [{ ...state().incidents[0]!, resolvedAtTick: 0 }],
      staff: [{
        id: "staff:4", roleId: "cleaner", x: 0, y: 0, status: "working",
        path: [], pathIndex: 0, moveProgressTicks: 0, assignedBuildingId: null, assignedZoneId: null, drawCount: 0, tasksCompleted: 0,
        task: { id: "task:5", type: "clean", status: "in_progress", guestId: null, queueId: null, buildingId: null, constructionSiteId: null, incidentId: "incident:3", targetProductId: null, startedAtTick: 0, endedAtTick: null, priority: 1, effortRemaining: 1 },
      }],
    };
    const recordingCancel = resolutionEmitter();
    const scratchCancel = createTickScratch();
    staffWork({
      processingTick: 0, content: cleanContent, emit: recordingCancel.emit,
      random: createTickRandom(0, () => rngHandle(), scratchCancel), scratch: scratchCancel, changes: new BatchChanges(), state: alreadyResolved,
    });
    expect(recordingCancel.events).toEqual([{ name: "kind.world-graph.staff.task.cancelled", severity: "trace", data: { staffId: "staff:4", taskId: "task:5" } }]);
  });

  it("W87 construction (system 12): emits staff.task.completed, trace, for a builder whose site just finished", () => {
    const constructionContent = {
      ...content(), terrain: [{ id: "sand", walkable: true, moveCost: 1 }],
      buildings: [{ id: "hut", footprint: { width: 1, height: 1 }, entrances: [{ x: 1, y: 0 }], constructionTaskPriority: 5, initialWear: 100, initialCleanliness: 100, operation: { kind: "decorative" } }],
      staffRoles: [{ id: "builder", supportedTaskKinds: ["build"], workRates: [{ taskType: "build", effortPerTick: 1 }] }],
    } as unknown as WorldGraphCampaign;
    const workState: WorldGraphKindState = {
      ...state(), buildings: [],
      constructionSites: [{ id: "construction-site:0", definitionId: "hut", x: 0, y: 0, width: 1, height: 1, rotation: 0, startedAtTick: 0, workRemaining: 1, completedBuildingId: "building:1", completedQueueId: "queue:2" }],
      staff: [{
        id: "staff:4", roleId: "builder", x: 1, y: 0, status: "working",
        path: [], pathIndex: 0, moveProgressTicks: 0, assignedBuildingId: null, assignedZoneId: null, drawCount: 0, tasksCompleted: 0,
        task: { id: "task:5", type: "build", status: "in_progress", guestId: null, queueId: null, buildingId: null, constructionSiteId: "construction-site:0", incidentId: null, targetProductId: null, startedAtTick: 0, endedAtTick: null, priority: 5, effortRemaining: 1 },
      }],
    };
    const recording = resolutionEmitter();
    const scratch = createTickScratch();
    construction({
      processingTick: 0, content: constructionContent, emit: recording.emit,
      random: createTickRandom(0, () => rngHandle(), scratch), scratch, changes: new BatchChanges(), state: workState,
    });
    expect(recording.events).toContainEqual({ name: "kind.world-graph.staff.task.completed", severity: "trace", data: { staffId: "staff:4", taskId: "task:5" } });
  });

  it("W87 buildings (system 13): emits staff.task.completed, trace, for a restocker whose product just filled", () => {
    const restockContent = {
      ...content(), terrain: [{ id: "sand", walkable: true, moveCost: 1 }],
      products: [{ id: "water", unitCostCents: 10, price: { defaultCents: 100 } }],
      buildings: [{
        id: "kiosk", footprint: { width: 1, height: 1 }, entrances: [{ x: 1, y: 0 }],
        operation: { kind: "service", products: [{ productId: "water", serviceTicks: 1, initialUnits: 0, capacity: 1, restockTaskPriority: 5 }], queueMaxLength: 5, baseServiceTicks: 1, staffRequirements: [], staffingTaskPriority: 0, effects: [] },
      }],
      staffRoles: [{ id: "restocker", supportedTaskKinds: ["restock"], workRates: [{ taskType: "restock", effortPerTick: 5 }] }],
    } as unknown as WorldGraphCampaign;
    const workState: WorldGraphKindState = {
      ...state(),
      buildings: [{ id: "building:0", definitionId: "kiosk", x: 0, y: 0, width: 1, height: 1, rotation: 0, status: "open", buildStartTick: 0, wear: 100, cleanliness: 100, queue: { id: "queue:1", guestIds: [], serviceStartedAtTick: null }, pricesCents: { water: 100 }, inventory: { water: 0 } }],
      staff: [{
        id: "staff:4", roleId: "restocker", x: 1, y: 0, status: "working",
        path: [], pathIndex: 0, moveProgressTicks: 0, assignedBuildingId: null, assignedZoneId: null, drawCount: 0, tasksCompleted: 0,
        task: { id: "task:5", type: "restock", status: "in_progress", guestId: null, queueId: null, buildingId: "building:0", constructionSiteId: null, incidentId: null, targetProductId: "water", startedAtTick: 0, endedAtTick: null, priority: 5, effortRemaining: 1 },
      }],
    };
    const recording = resolutionEmitter();
    const scratch = createTickScratch();
    buildings({
      processingTick: 0, content: restockContent, emit: recording.emit,
      random: createTickRandom(0, () => rngHandle(), scratch), scratch, changes: new BatchChanges(), state: workState,
    });
    expect(recording.events).toContainEqual({ name: "kind.world-graph.staff.task.completed", severity: "trace", data: { staffId: "staff:4", taskId: "task:5" } });
  });

  it("W87 finance (system 15): coalesces wages and operating costs into one finance.charged, debug, per family", () => {
    const financeContent = {
      ...content(), ticksPerDay: 1,
      staffRoles: [{ id: "cleaner", wageCentsPerDay: 10 }],
      buildings: [{ id: "kiosk", operatingCostCentsPerDay: 4, operation: { kind: "decorative" } }],
    } as unknown as WorldGraphCampaign;
    const financeState: WorldGraphKindState = {
      ...state(),
      buildings: [{ ...state().buildings[0]!, definitionId: "kiosk", status: "open" }],
      staff: [{ id: "staff:4", roleId: "cleaner", x: 0, y: 0, status: "idle", path: [], pathIndex: 0, moveProgressTicks: 0, assignedBuildingId: null, assignedZoneId: null, drawCount: 0, task: null, tasksCompleted: 0 }],
    };
    const recording = resolutionEmitter();
    const scratch = createTickScratch();
    finance({
      processingTick: 0, content: financeContent, emit: recording.emit,
      random: createTickRandom(0, () => rngHandle(), scratch), scratch, changes: new BatchChanges(), state: financeState,
    });
    expect(recording.events).toEqual([
      { name: "kind.world-graph.finance.charged", severity: "debug", data: { family: "wages", amountCents: 10 } },
      { name: "kind.world-graph.finance.charged", severity: "debug", data: { family: "operating", amountCents: 4 } },
    ]);
  });

  it("W87 objectives (system 17): emits objective.progressed, debug, on a value change and objective.met, info, once satisfied for its full duration", () => {
    const objectiveContent = {
      ...content(),
      objectives: [{ id: "earn", progressMetric: { kind: "counter", counter: "guestsEntered" }, completion: { kind: "compare", metric: { kind: "counter", counter: "guestsEntered" }, op: "gte", value: 1 }, requiredDurationTicks: 1, onCompleted: [] }],
    } as unknown as WorldGraphCampaign;
    const progressed: WorldGraphKindState = { ...state(), counters: { ...state().counters, guestsEntered: 1 }, objectives: [{ id: "earn", state: "active", value: 0, target: 10, satisfiedSinceTick: null, updatedAtTick: 0 }] };
    const recording = resolutionEmitter();
    const scratch = createTickScratch();
    const result = objectives({
      processingTick: 0, content: objectiveContent, emit: recording.emit,
      random: createTickRandom(0, () => rngHandle(), scratch), scratch, changes: new BatchChanges(), state: progressed,
    });
    expect(result.state.objectives[0]?.state).toBe("met");
    expect(recording.events).toEqual([
      { name: "kind.world-graph.objective.progressed", severity: "debug", data: { objectiveId: "earn", value: 1 } },
      { name: "kind.world-graph.objective.met", severity: "info", data: { objectiveId: "earn" } },
    ]);
  });

  it("W87 failure (system 18): emits failure.progressed, debug, failure.triggered, info, and scenario.resolved, info, with the outcome ids", () => {
    const failureContent = {
      ...content(),
      failures: [{ id: "bankrupt", condition: { kind: "compare", metric: { kind: "finance", field: "cashCents" }, op: "lte", value: 0 }, requiredDurationTicks: 1, onTriggered: [] }],
    } as unknown as WorldGraphCampaign;
    const failing: WorldGraphKindState = {
      ...state(), objectives: [], finances: { ...state().finances, cashCents: 0 },
      failures: [{ id: "bankrupt", state: "active", satisfiedSinceTick: null, updatedAtTick: 0 }],
    };
    const recording = resolutionEmitter();
    const scratch = createTickScratch();
    const result = failure({
      processingTick: 0, content: failureContent, emit: recording.emit,
      random: createTickRandom(0, () => rngHandle(), scratch), scratch, changes: new BatchChanges(), state: failing,
    });
    expect(result.state.resolution).toMatchObject({ resolution: "failed", failureId: "bankrupt" });
    expect(recording.events).toEqual([
      { name: "kind.world-graph.failure.progressed", severity: "debug", data: { failureId: "bankrupt" } },
      { name: "kind.world-graph.failure.triggered", severity: "info", data: { failureId: "bankrupt" } },
      { name: "kind.world-graph.scenario.resolved", severity: "info", data: { resolution: "failed", objectiveIds: "", failureId: "bankrupt" } },
    ]);
  });

  // A curated subset — the guest-facing systems plus finalize — rather than all 20: the shared
  // `kioskContent`/`state()` fixtures don't define guest-spawning, incidents, objectives or
  // failures, and the full default roster would fail on those unrelated gaps.
  const guestSystems = [
    { id: "guest-needs" as WorldGraphSystemId, run: guestNeeds },
    { id: "guest-service" as WorldGraphSystemId, run: guestService },
    { id: "queues" as WorldGraphSystemId, run: queues },
    { id: "guest-intent" as WorldGraphSystemId, run: guestIntent },
    { id: "guest-path" as WorldGraphSystemId, run: guestPath },
    { id: "guest-move" as WorldGraphSystemId, run: guestMove },
    { id: "tick-finalize" as WorldGraphSystemId, run: tickFinalize },
  ];

  it("W87.3: events emit in system order, then the owning comparator order, across a multi-tick batch", () => {
    const orderState: WorldGraphKindState = {
      ...state(),
      buildings: [{ ...state().buildings[0]!, definitionId: "kiosk" }],
      guests: [
        { ...state().guests[0]!, id: "guest:5", lifecycle: "seeking", x: 1, y: 0, intent: { kind: "wait", untilTick: 0, selectedAtTick: 0 } },
        { ...state().guests[0]!, id: "guest:2" },
      ],
    };
    const tagged: { readonly name: string; readonly systemId: string }[] = [];
    const recording = resolutionEmitter();
    const taggingEmit = (systemId: string): ResolutionEmitter => ({
      emit: (name, severity, detail) => { tagged.push({ name, systemId }); recording.emit.emit(name, severity, detail); },
    });
    const taggedSystems = guestSystems.map((entry) => ({
      id: entry.id,
      run: (frame: WorldGraphTickFrame) => entry.run({ ...frame, emit: taggingEmit(entry.id) }),
    }));
    let workState = orderState;
    for (let tick = 0; tick < 3; tick += 1) {
      tagged.length = 0;
      workState = runWorldGraphTick(workState, kioskContent, { derive: () => rngHandle(), emit: recording.emit }, new BatchChanges(), taggedSystems);
      const indices = tagged.map((entry) => worldGraphSystemIndex(entry.systemId as WorldGraphSystemId));
      for (let index = 1; index < indices.length; index += 1) expect(indices[index]).toBeGreaterThanOrEqual(indices[index - 1]!);
    }
    expect(tagged.length).toBeGreaterThan(0);
    const intentEvents = recording.events.filter((event) => event.name === "kind.world-graph.guest.intent.selected");
    expect(intentEvents.length).toBeGreaterThan(0);
    const guestIds = intentEvents.map((event) => event.data?.guestId);
    expect(guestIds).toEqual([...guestIds].sort());
  });

  it("W87.4: dropping every event changes nothing — a null sink and a recording sink reach byte-identical state and StateChange rows over the same multi-tick batch", () => {
    const orderState: WorldGraphKindState = {
      ...state(),
      buildings: [{ ...state().buildings[0]!, definitionId: "kiosk" }],
      guests: [{ ...state().guests[0]! }],
    };
    const runBatch = (emit: ResolutionEmitter): { readonly state: WorldGraphKindState; readonly changes: readonly unknown[] } => {
      let workState = orderState;
      const changes = new BatchChanges();
      for (let tick = 0; tick < 3; tick += 1) workState = runWorldGraphTick(workState, kioskContent, { derive: () => rngHandle(), emit }, changes, guestSystems);
      return { state: workState, changes: changes.finish() };
    };
    const withEvents = runBatch(resolutionEmitter().emit);
    const withoutEvents = runBatch({ emit: () => {} });
    expect(withoutEvents.state).toEqual(withEvents.state);
    expect(withoutEvents.changes).toEqual(withEvents.changes);
  });
});
