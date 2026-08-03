import { describe, expect, it } from "vitest";
import { createEngine } from "../../core/kernel/engine.js";
import type { EngineHost } from "../../core/composition/types.js";
import type { KindRegistry } from "../../core/kernel/types.js";
import { buildCampaign, buildContentRegistry } from "../../core/registry/build.js";
import type { AuthoredText, Campaign } from "../../core/registry/types.js";
import { createRecordingEmitter } from "../../core/observability/emitter.js";
import type { WorldGraphCampaign, WorldGraphCampaignSource } from "./content.js";
import { worldGraphKind } from "./kind.js";
import { buildWorldGraphCampaign } from "./source.js";
import type { WorldGraphKindState, WorldGraphView } from "./state.js";
import { WORLD_GRAPH_REASON_MESSAGES } from "./reasons.js";

const text = (key: string, value: string): AuthoredText => ({ key, text: value });
const definitionText = (id: string) => ({
  name: text(`world.${id}.name`, `${id} name`),
  description: text(`world.${id}.description`, `${id} description`),
});

const source: WorldGraphCampaignSource = {
  startScenarioId: "opening",
  ticksPerDay: 100,
  maxTicksPerAction: 10,
  maps: [{
    id: "beach", text: definitionText("map.beach"), width: 5, height: 3,
    defaultTerrainId: "sand", terrainOverrides: [], topology: { kind: "orthogonal_grid" },
    zones: [], spawnPoints: [{ x: 0, y: 1 }], exits: [{ x: 4, y: 1 }], tags: ["mvp"],
  }],
  terrain: [{ id: "sand", text: definitionText("terrain.sand"), walkable: true, buildable: true, moveCost: 1, tags: [] }],
  needs: [{ id: "thirst", text: definitionText("need.thirst"), minimum: 0, maximum: 100, criticalBelow: 20, satisfiedAtOrAbove: 70 }],
  opinions: [{ id: "price", text: definitionText("opinion.price"), minimum: -100, maximum: 100, neutral: 0 }],
  products: [{ id: "water", text: definitionText("product.water"), unitCostCents: 50, price: { minimumCents: 100, maximumCents: 300, defaultCents: 150 }, effects: [], litter: null, tags: [] }],
  buildings: [{
    id: "kiosk", text: definitionText("building.kiosk"), footprint: { width: 1, height: 1 },
    entrances: [{ x: -1, y: 0 }], allowedRotations: [0], constructionCostCents: 500,
    constructionWork: 0, constructionTaskPriority: 0, operatingCostCentsPerDay: 10,
    initialWear: 90, initialCleanliness: 80, placementRules: [{ kind: "terrain", terrainIds: ["sand"] }],
    adjacencyEffects: [], operation: { kind: "service", products: [{ productId: "water", serviceTicks: 2, initialUnits: null, capacity: null, restockTaskPriority: 0 }], queueMaxLength: 5, baseServiceTicks: 2, staffRequirements: [], staffingTaskPriority: 0, effects: [] }, tags: [],
  }],
  guestArchetypes: [{
    id: "guest", text: definitionText("guest.guest"), cashCents: { min: 100, max: 100 },
    stayTicks: { min: 10, max: 10 }, patienceTicks: { min: 5, max: 5 }, initialSatisfaction: { min: 50, max: 50 },
    needs: [{ needId: "thirst", initial: { min: 50, max: 50 }, driftByCurrentValue: { interpolation: "step", points: [{ input: 0, output: -1 }] }, utilityByCurrentValue: { interpolation: "step", points: [{ input: 0, output: 1 }] } }],
    conditions: [], opinions: [{ definitionId: "price", initial: { min: 0, max: 0 } }], preferences: [],
    priceResistance: { interpolation: "step", points: [{ input: 0, output: 0 }] },
    preferenceUtilityPerPoint: 0, qualityUtilityPerPoint: 0, attractivenessUtilityPerPoint: 0,
    travelPenaltyPerCost: 1, queuePenaltyPerTick: 1, safetyPenaltyPerPoint: 1, switchThresholdUtility: 1,
    fallback: { kind: "leave" }, tags: [],
  }],
  staffRoles: [{ id: "cleaner", text: definitionText("staff.cleaner"), hireCostCents: 200, wageCentsPerDay: 20, moveTicksPerTile: 1, supportedTaskKinds: ["clean"], workRates: [{ taskType: "clean", effortPerTick: 1 }], tags: [] }],
  incidents: [{ id: "litter", text: definitionText("incident.litter"), kind: "litter", severity: "minor", triggerCondition: null, rollScope: "world", rollChanceBasisPoints: 0, selectionWeight: 0, cooldownTicks: 0, durationTicks: null, resolutionCondition: null, resolverTaskType: "clean", resolverTaskPriority: 1, onStart: [], onResolve: [], tags: [] }],
  objectives: [{ id: "earn", text: definitionText("objective.earn"), completion: { kind: "compare", metric: { kind: "finance", field: "revenueTotalCents" }, op: "gte", value: 1000 }, progressMetric: { kind: "finance", field: "revenueTotalCents" }, target: 1000, requiredDurationTicks: 1, onCompleted: [], tags: [] }],
  failures: [{ id: "bankrupt", text: definitionText("failure.bankrupt"), condition: { kind: "compare", metric: { kind: "finance", field: "cashCents" }, op: "lt", value: 0 }, requiredDurationTicks: 1, onTriggered: [], tags: [] }],
  scenarios: [{
    id: "opening", text: definitionText("scenario.opening"), mapId: "beach", startingCashCents: 2_000,
    unlockedContent: [{ kind: "building", id: "kiosk" }, { kind: "staff_role", id: "cleaner" }],
    activePolicyIds: [], scheduledChanges: [], buildingPlacements: [], sceneryPlacements: [],
    guestSpawning: { everyTicks: 5, maxActiveGuests: 10, pool: [{ archetypeId: "guest", weight: 1 }] },
    objectiveIds: ["earn"], failureIds: ["bankrupt"], timeLimitTicks: null, timeLimitFailureId: null,
    resolutionPrecedence: "objectives_win", buildingLimits: [{ definitionId: "kiosk", maximum: 2 }],
    staffLimits: [{ definitionId: "cleaner", maximum: 2 }], tags: [],
  }],
};

function runtime(overrides: Partial<WorldGraphCampaign> = {}): { content: WorldGraphCampaign; authoredText: readonly AuthoredText[] } {
  const built = buildWorldGraphCampaign(source);
  return { ...built, content: { ...built.content, ...overrides } };
}

function envelope(overrides: Partial<WorldGraphCampaign> = {}): { campaign: Campaign; strings: ReadonlyMap<string, string> } {
  const builtSource = runtime(overrides);
  const campaign: Campaign = { id: "world-test", kindId: "world-graph", version: "1.0.0", titleKey: "world.title", content: builtSource.content };
  const built = buildCampaign(campaign, [text("world.title", "World"), ...builtSource.authoredText]);
  if (!built.ok || !built.value) throw new Error("fixture failed to build");
  return { campaign: built.value.campaign, strings: built.value.strings };
}

function engine(overrides: Partial<WorldGraphCampaign> = {}) {
  const builtEnvelope = envelope(overrides);
  const built = { campaign: builtEnvelope.campaign, strings: builtEnvelope.strings };
  const registryResult = buildContentRegistry([built], [WORLD_GRAPH_REASON_MESSAGES]);
  if (!registryResult.ok || !registryResult.value) throw new Error("fixture registry failed");
  const host: EngineHost = {
    registry: registryResult.value,
    kinds: { "world-graph": worldGraphKind } as unknown as KindRegistry,
    ids: { newGameId: () => "game:world", newSeed: () => "seed:world" },
  };
  return createEngine(host);
}

function create(overrides: Partial<WorldGraphCampaign> = {}) {
  const created = engine(overrides).createGame({ campaignId: "world-test" });
  if (!created.ok || !created.value) throw new Error("expected world to start");
  return created.value;
}

const stateOf = (value: { readonly kindState: unknown }): WorldGraphKindState => value.kindState as WorldGraphKindState;

describe("world-graph W45 source and validation", () => {
  it("lifts text, applies exactly the five defaults, and canonicalizes catalogs", () => {
    const built = buildWorldGraphCampaign({ ...source, terrain: [...source.terrain].reverse() });
    expect(built.authoredText).toHaveLength(24);
    expect(built.content.scenery).toEqual([]);
    expect(built.content.guestConditions).toEqual([]);
    expect(built.content.preferences).toEqual([]);
    expect(built.content.policies).toEqual([]);
    expect(built.content.achievements).toEqual([]);
    expect(built.content.maps[0]?.text.nameKey).toBe("world.map.beach.name");
  });

  it("is total over malformed unknown roots and nested definitions", () => {
    const badRoot = { ...envelope().campaign, content: null };
    expect(() => worldGraphKind.validateCampaign(badRoot, new Map())).not.toThrow();
    expect(worldGraphKind.validateCampaign(badRoot, new Map()).ok).toBe(false);
    const malformed = { ...envelope().campaign, content: { ...runtime().content, buildings: [null] } };
    expect(() => worldGraphKind.validateCampaign(malformed, envelope().strings)).not.toThrow();
    expect(worldGraphKind.validateCampaign(malformed, envelope().strings).errors[0]?.path).toContain("buildings[0]");
  });

  it("accepts the engine-owned minimum runtime campaign", () => {
    const built = envelope();
    expect(worldGraphKind.validateCampaign(built.campaign, built.strings)).toMatchObject({ ok: true, errors: [] });
  });

  it("rejects negative building and hiring costs before a reducer can spend them", () => {
    const built = envelope();
    const invalid = {
      ...built.campaign,
      content: {
        ...runtime().content,
        buildings: runtime().content.buildings.map((entry) => ({ ...entry, constructionCostCents: -1 })),
        staffRoles: runtime().content.staffRoles.map((entry) => ({ ...entry, hireCostCents: -1 })),
      },
    };
    expect(worldGraphKind.validateCampaign(invalid, built.strings).errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "invalid_cost", path: "content.buildings[0].constructionCostCents" }),
      expect.objectContaining({ code: "invalid_cost", path: "content.staffRoles[0].hireCostCents" }),
    ]));
  });
});

describe("world-graph W45 engine seam", () => {
  it("materializes deterministic complete tick-zero state", () => {
    expect(create().kindState).toEqual(create().kindState);
    const state = stateOf(create());
    expect(state).toMatchObject({ tick: 0, nextEntityOrdinal: 0, resolution: null, counters: { guestsEntered: 0 } });
    expect(state.map).toMatchObject({ width: 5, height: 3, revision: 0 });
    expect(state.map.terrain).toHaveLength(15);
    expect(state.failures).toHaveLength(1);
  });

  it("keeps advance_ticks advertised but unavailable without changing state or log", () => {
    const game = create();
    const runtimeEngine = engine();
    expect(runtimeEngine.availableActions(game).find((entry) => entry.id === "advance_ticks")).toMatchObject({ available: false, reasonKey: "core.reason.action_not_available" });
    const result = runtimeEngine.submitAction(game, "advance_ticks", { ticks: 1 });
    expect(result).toMatchObject({ ok: false, errors: [{ code: "action_not_available" }] });
    expect(game.actionLog).toEqual([]);
  });

  it("builds immediately with exact ids, charge, revision, event and product state", () => {
    const recording = createRecordingEmitter();
    const runtimeEngine = engine().withEmitter(recording);
    const result = runtimeEngine.submitAction(create(), "build", { definitionId: "kiosk", x: 2, y: 1, rotation: 0 });
    expect(result.ok).toBe(true);
    const state = stateOf(result.value!);
    expect(state.buildings[0]).toMatchObject({ id: "building:0", definitionId: "kiosk", status: "open", pricesCents: { water: 150 }, inventory: { water: null }, queue: { id: "queue:1" } });
    expect(state).toMatchObject({ nextEntityOrdinal: 2, map: { revision: 1 }, finances: { cashCents: 1500 }, tick: 0 });
    expect(recording.events.some((entry) => entry.name === "kind.world-graph.building.placed")).toBe(true);
  });

  it("reserves site, future building, and future queue ids for timed construction", () => {
    const content = runtime().content;
    const buildings = content.buildings.map((entry) => entry.id === "kiosk" ? { ...entry, constructionWork: 5 } : entry);
    const result = engine({ buildings }).submitAction(create({ buildings }), "build", { definitionId: "kiosk", x: 2, y: 1, rotation: 0 });
    const state = stateOf(result.value!);
    expect(state.constructionSites[0]).toMatchObject({ id: "construction-site:0", completedBuildingId: "building:1", completedQueueId: "queue:2", workRemaining: 5 });
    expect(state.buildings).toEqual([]);
    expect(state.nextEntityOrdinal).toBe(3);
  });

  it("handles staff, pricing, operation, demolition, and no-op reducers without passing time", () => {
    const runtimeEngine = engine();
    let game = create();
    game = runtimeEngine.submitAction(game, "build", { definitionId: "kiosk", x: 2, y: 1, rotation: 0 }).value!;
    game = runtimeEngine.submitAction(game, "hire_staff", { definitionId: "cleaner" }).value!;
    let state = stateOf(game);
    expect(state.staff[0]).toMatchObject({ id: "staff:2", roleId: "cleaner", x: 4, y: 1, path: [], moveProgressTicks: 0 });
    game = runtimeEngine.submitAction(game, "assign_staff", { staffId: "staff:2", buildingId: "building:0" }).value!;
    game = runtimeEngine.submitAction(game, "set_price", { buildingId: "building:0", productId: "water", priceCents: 200 }).value!;
    game = runtimeEngine.submitAction(game, "close_building", { buildingId: "building:0" }).value!;
    const noOp = runtimeEngine.submitAction(game, "close_building", { buildingId: "building:0" });
    expect(noOp.ok).toBe(true);
    expect(noOp.changes).toEqual([]);
    game = noOp.value!;
    game = runtimeEngine.submitAction(game, "open_building", { buildingId: "building:0" }).value!;
    game = runtimeEngine.submitAction(game, "demolish", { buildingId: "building:0" }).value!;
    state = stateOf(game);
    expect(state.staff[0]?.assignedBuildingId).toBeNull();
    expect(state.buildings).toEqual([]);
    expect(state.tick).toBe(0);
    expect(state.map.revision).toBe(2);
    game = runtimeEngine.submitAction(game, "fire_staff", { staffId: "staff:2" }).value!;
    expect(stateOf(game).staff).toEqual([]);
  });

  it("dismisses a persisted alert once and accepts repeat dismissal as a no-op", () => {
    const runtimeEngine = engine();
    const game = create();
    const state = stateOf(game);
    const withAlert = {
      ...game,
      kindState: {
        ...state,
        alerts: [{
          id: "alert:0", type: "incident_active" as const, semanticKey: "incident:litter",
          severity: "warning" as const, titleKey: "world.incident.litter.name",
          messageKey: "world.incident.litter.description", entityId: null,
          issuedAtTick: 0, dismissedAtTick: null, clearedAtTick: null,
        }],
      },
    };
    const dismissed = runtimeEngine.submitAction(withAlert, "dismiss_alert", { alertId: "alert:0" });
    expect(stateOf(dismissed.value!).alerts[0]?.dismissedAtTick).toBe(0);
    const repeated = runtimeEngine.submitAction(dismissed.value!, "dismiss_alert", { alertId: "alert:0" });
    expect(repeated.ok).toBe(true);
    expect(repeated.changes).toEqual([]);
    expect(stateOf(repeated.value!).tick).toBe(0);
  });

  it("returns the contract rejection codes before allocating or advancing time", () => {
    const runtimeEngine = engine();
    const initial = create();
    expect(runtimeEngine.submitAction(initial, "build", { definitionId: "kiosk", x: 5, y: 1, rotation: 0 }).errors[0]?.code).toBe("placement_out_of_bounds");
    expect(runtimeEngine.submitAction(initial, "demolish", { buildingId: "building:404" }).errors[0]?.code).toBe("unknown_entity");

    let game = runtimeEngine.submitAction(initial, "build", { definitionId: "kiosk", x: 2, y: 1, rotation: 0 }).value!;
    expect(runtimeEngine.submitAction(game, "build", { definitionId: "kiosk", x: 2, y: 1, rotation: 0 }).errors[0]?.code).toBe("placement_overlaps");
    expect(runtimeEngine.submitAction(game, "set_price", { buildingId: "building:0", productId: "water", priceCents: 301 }).errors[0]?.code).toBe("price_out_of_range");
    game = runtimeEngine.submitAction(game, "close_building", { buildingId: "building:0" }).value!;
    expect(runtimeEngine.submitAction(game, "set_price", { buildingId: "building:0", productId: "water", priceCents: 200 }).errors[0]?.code).toBe("building_not_open");

    const content = runtime().content;
    const lockedScenarios = content.scenarios.map((entry) => ({ ...entry, unlockedContent: entry.unlockedContent.filter((reference) => reference.kind !== "building") }));
    expect(engine({ scenarios: lockedScenarios }).submitAction(create({ scenarios: lockedScenarios }), "build", { definitionId: "kiosk", x: 2, y: 1, rotation: 0 }).errors[0]?.code).toBe("building_locked");
    const limitedScenarios = content.scenarios.map((entry) => ({ ...entry, buildingLimits: [{ definitionId: "kiosk", maximum: 0 }], staffLimits: [{ definitionId: "cleaner", maximum: 0 }] }));
    const limitedEngine = engine({ scenarios: limitedScenarios });
    const limitedGame = create({ scenarios: limitedScenarios });
    expect(limitedEngine.submitAction(limitedGame, "build", { definitionId: "kiosk", x: 2, y: 1, rotation: 0 }).errors[0]?.code).toBe("building_limit_reached");
    expect(limitedEngine.submitAction(limitedGame, "hire_staff", { definitionId: "cleaner" }).errors[0]?.code).toBe("staff_limit_reached");
    expect(stateOf(limitedGame)).toMatchObject({ tick: 0, nextEntityOrdinal: 0 });
  });

  it("advertises only actions that can be parameterized and explains an unaffordable hire", () => {
    const content = runtime().content;
    const emptyServiceBuildings = content.buildings.map((entry) => ({
      ...entry,
      operation: entry.operation.kind === "service" ? { ...entry.operation, products: [] } : entry.operation,
    }));
    const emptyServiceEngine = engine({ buildings: emptyServiceBuildings });
    const emptyServiceGame = emptyServiceEngine.submitAction(create({ buildings: emptyServiceBuildings }), "build", { definitionId: "kiosk", x: 2, y: 1, rotation: 0 }).value!;
    expect(emptyServiceEngine.availableActions(emptyServiceGame).find((entry) => entry.id === "set_price")).toMatchObject({ available: false });

    const poorScenarios = content.scenarios.map((entry) => ({ ...entry, startingCashCents: 100 }));
    expect(engine({ scenarios: poorScenarios }).availableActions(create({ scenarios: poorScenarios })).find((entry) => entry.id === "hire_staff")).toMatchObject({
      available: false,
      reasonKey: "world-graph.reason.insufficient_funds",
    });
  });

  it("projects only the contract view and reads terminal identity only from resolution", () => {
    const runtimeEngine = engine();
    const view = (runtimeEngine.view(create(), "player") as { kindView: WorldGraphView }).kindView;
    expect(view).toMatchObject({ tick: 0, map: { buildingCount: 0 }, queuedGuests: 0 });
    expect(JSON.stringify(view)).not.toContain("isOpen");
    const base = stateOf(create());
    expect(worldGraphKind.outcome({ ...base, objectives: [{ ...base.objectives[0]!, state: "met" }] })).toEqual({ resolution: null, objectivesMet: [], failureId: null });
    expect(worldGraphKind.outcome({ ...base, resolution: { resolution: "failed", objectiveIds: [], failureId: "bankrupt", resolvedAtTick: 0 } })).toEqual({ resolution: "failed", objectivesMet: [], failureId: "bankrupt" });
  });
});
