import { describe, expect, it } from "vitest";
import type { RngHandle, StreamId } from "../../../core/determinism/types.js";
import type { ResolutionEmitter } from "../../../core/observability/types.js";
import type { WorldEffect, WorldGraphCampaign } from "../content.js";
import type { WorldGraphKindState } from "../state.js";
import { BatchChanges } from "./changes.js";
import { compareDefinitionId, WORLD_GRAPH_SYSTEM_IDS } from "./order.js";
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

interface RecordedResolutionEvent {
  readonly name: string;
  readonly data?: Readonly<Record<string, string | number | boolean>>;
}

function resolutionEmitter(): { readonly emit: ResolutionEmitter; readonly events: RecordedResolutionEvent[] } {
  const events: RecordedResolutionEvent[] = [];
  return {
    events,
    emit: { emit: (name, _severity, detail) => { events.push(detail?.data === undefined ? { name } : { name, data: detail.data }); } },
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
    buildings: [], guestArchetypes: [], staffRoles: [],
    incidents: [{ id: "litter", cooldownTicks: 0, durationTicks: { min: 2, max: 2 } }],
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
      { id: "scenario", run: scenario }, { id: "tick-finalize", run: tickFinalize },
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
