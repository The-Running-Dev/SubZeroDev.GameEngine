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
import type { Guest, WorldGraphKindState, WorldGraphView } from "./state.js";
import { WORLD_GRAPH_REASON_MESSAGES } from "./reasons.js";
import { createInMemorySessionStore } from "../../core/session/store.js";
import { createInMemoryProfileStore } from "../../core/session/profile-store.js";
import { TextClient } from "../../clients/text/client.js";
import { worldGraphMvpSource } from "../../campaigns/world-graph-mvp.js";

const text = (key: string, value: string): AuthoredText => ({ key, text: value });
const source: WorldGraphCampaignSource = {
  ...worldGraphMvpSource,
  products: worldGraphMvpSource.products.map((product) => ({
    ...product,
    price: { ...product.price, defaultCents: 150 },
    litter: null,
  })),
  objectives: worldGraphMvpSource.objectives.map((objective) => ({
    ...objective,
    completion: { kind: "compare", metric: { kind: "finance", field: "revenueTotalCents" }, op: "gte", value: 1000 },
    progressMetric: { kind: "finance", field: "revenueTotalCents" },
    target: 1000,
  })),
  scenarios: worldGraphMvpSource.scenarios.map((scenario) => ({
    ...scenario,
    scheduledChanges: [],
    buildingPlacements: [],
    guestSpawning: { everyTicks: 5, maxActiveGuests: 10, pool: [{ archetypeId: "guest", weight: 1 }] },
  })),
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

function textClient(overrides: Partial<WorldGraphCampaign> = {}): TextClient {
  const builtEnvelope = envelope(overrides);
  const built = { campaign: builtEnvelope.campaign, strings: builtEnvelope.strings };
  const registryResult = buildContentRegistry([built], [WORLD_GRAPH_REASON_MESSAGES]);
  if (!registryResult.ok || !registryResult.value) throw new Error("fixture registry failed");
  const runtimeEngine = createEngine({
    registry: registryResult.value,
    kinds: { "world-graph": worldGraphKind } as unknown as KindRegistry,
    ids: { newGameId: () => "game:world-client", newSeed: () => "seed:world-client" },
  });
  return new TextClient(createInMemorySessionStore({ engine: runtimeEngine, registry: registryResult.value }));
}

function create(overrides: Partial<WorldGraphCampaign> = {}) {
  const created = engine(overrides).createGame({ campaignId: "world-test" });
  if (!created.ok || !created.value) throw new Error("expected world to start");
  return created.value;
}

function sessionStoreWithProfiles(profiles: ReturnType<typeof createInMemoryProfileStore>, overrides: Partial<WorldGraphCampaign> = {}) {
  const builtEnvelope = envelope(overrides);
  const built = { campaign: builtEnvelope.campaign, strings: builtEnvelope.strings };
  const registryResult = buildContentRegistry([built], [WORLD_GRAPH_REASON_MESSAGES]);
  if (!registryResult.ok || !registryResult.value) throw new Error("fixture registry failed");
  const runtimeEngine = createEngine({
    registry: registryResult.value,
    kinds: { "world-graph": worldGraphKind } as unknown as KindRegistry,
    ids: { newGameId: () => "game:world-profile", newSeed: () => "seed:world-profile" },
  });
  return createInMemorySessionStore({ engine: runtimeEngine, registry: registryResult.value, profiles });
}

const stateOf = (value: { readonly kindState: unknown }): WorldGraphKindState => value.kindState as WorldGraphKindState;

describe("world-graph W45 source and validation", () => {
  it("previews accepted and rejected parameterized placement through the text client without persisting either", async () => {
    const client = textClient();
    const created = await client.createSession({ campaignId: "world-test" });
    const accepted = await client.previewAction(created.value.sessionId, "build", {
      definitionId: "kiosk", x: 2, y: 1, rotation: 0,
    });
    const rejected = await client.previewAction(created.value.sessionId, "build", {
      definitionId: "kiosk", x: 5, y: 1, rotation: 0,
    });

    expect(accepted.value.ok).toBe(true);
    expect(accepted.value.changes).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: "buildings.building:0.exists", reason: "building_placed" }),
    ]));
    expect(rejected.value.ok).toBe(false);
    expect(rejected.value.errors[0]?.code).toBe("placement_out_of_bounds");
    const persisted = (await client.getView(created.value.sessionId)).value.kindView as WorldGraphView;
    expect(persisted.map).toMatchObject({ revision: 0, buildingCount: 0 });
    expect(persisted.finances.cashCents).toBe(2_000);
  });

  it("lifts text, applies exactly the five defaults, and canonicalizes catalogs", () => {
    // `source` itself now declares an achievement (W85's `double-cleaner`, inherited from
    // `worldGraphMvpSource`) — omitted here so this test still exercises that field's own
    // default, independent of what the shared fixture happens to declare.
    const sourceWithoutAchievements: WorldGraphCampaignSource = { ...source };
    delete (sourceWithoutAchievements as { achievements?: unknown }).achievements;
    const built = buildWorldGraphCampaign({ ...sourceWithoutAchievements, terrain: [...source.terrain].reverse() });
    expect(built.authoredText).toHaveLength(34);
    expect(built.content.scenery).toEqual([]);
    expect(built.content.guestConditions).toEqual([]);
    expect(built.content.preferences).toEqual([]);
    expect(built.content.policies).toEqual([]);
    expect(built.content.achievements).toEqual([]);
    expect(built.content.maps[0]?.text.nameKey).toBe("world-graph-mvp.map-beach.name");
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

  it("rejects negative atomic, recurring, inventory, and work-rate inputs", () => {
    const built = envelope();
    const base = runtime().content;
    const invalid = {
      ...built.campaign,
      content: {
        ...base,
        products: base.products.map((entry) => ({ ...entry, unitCostCents: -1 })),
        buildings: base.buildings.map((entry) => ({
          ...entry, constructionCostCents: -1, operatingCostCentsPerDay: -1,
          operation: entry.operation.kind === "service" ? {
            ...entry.operation,
            products: entry.operation.products.map((product) => ({ ...product, initialUnits: -1 })),
          } : entry.operation,
        })),
        staffRoles: base.staffRoles.map((entry) => ({
          ...entry, hireCostCents: -1, wageCentsPerDay: -1,
          workRates: entry.workRates.map((rate) => ({ ...rate, effortPerTick: -1 })),
        })),
      },
    };
    expect(worldGraphKind.validateCampaign(invalid, built.strings).errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "invalid_cost", path: "content.products[0].unitCostCents" }),
      expect.objectContaining({ code: "invalid_cost", path: "content.buildings[0].constructionCostCents" }),
      expect.objectContaining({ code: "invalid_cost", path: "content.buildings[0].operatingCostCentsPerDay" }),
      expect.objectContaining({ code: "invalid_cost", path: "content.buildings[1].constructionCostCents" }),
      expect.objectContaining({ code: "invalid_cost", path: "content.buildings[1].operatingCostCentsPerDay" }),
      expect.objectContaining({ code: "invalid_inventory", path: "content.buildings[1].operation.products[0].initialUnits" }),
      expect.objectContaining({ code: "invalid_cost", path: "content.staffRoles[0].hireCostCents" }),
      expect.objectContaining({ code: "invalid_cost", path: "content.staffRoles[0].wageCentsPerDay" }),
      expect.objectContaining({ code: "invalid_work_rate", path: "content.staffRoles[0].workRates[0].effortPerTick" }),
      expect.objectContaining({ code: "invalid_cost", path: "content.staffRoles[1].hireCostCents" }),
      expect.objectContaining({ code: "invalid_cost", path: "content.staffRoles[1].wageCentsPerDay" }),
      expect.objectContaining({ code: "invalid_work_rate", path: "content.staffRoles[1].workRates[0].effortPerTick" }),
    ]));
  });

  it("rejects out-of-bounds and non-traversable spawn points and exits", () => {
    const built = envelope();
    const base = runtime().content;
    const blockedTerrain = { ...base.terrain[0]!, id: "blocked", walkable: false, buildable: false };
    const invalid = {
      ...built.campaign,
      content: {
        ...base,
        terrain: [...base.terrain, blockedTerrain],
        maps: base.maps.map((entry) => ({
          ...entry,
          terrainOverrides: [...entry.terrainOverrides, { position: { x: 0, y: 0 }, terrainId: "blocked" }],
          spawnPoints: [{ x: -1, y: 0 }, { x: 0, y: 0 }],
          exits: [{ x: entry.width, y: 0 }],
        })),
      },
    };
    expect(worldGraphKind.validateCampaign(invalid, built.strings).errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "position_out_of_bounds", path: "content.maps[0].spawnPoints[0]" }),
      expect.objectContaining({ code: "spawn_not_traversable", path: "content.maps[0].spawnPoints[1]" }),
      expect.objectContaining({ code: "position_out_of_bounds", path: "content.maps[0].exits[0]" }),
    ]));
  });

  it("rejects out-of-bounds and overlapping scenery placements using building placement's own geometry", () => {
    const built = envelope();
    const base = runtime().content;
    const palm = {
      id: "palm", text: { nameKey: "scenery.palm.name", descriptionKey: "scenery.palm.description" },
      footprint: { width: 1, height: 1 }, allowedRotations: [0 as const], placementRules: [], adjacencyEffects: [], tags: [],
    };
    const invalid = {
      ...built.campaign,
      content: {
        ...base,
        scenery: [palm],
        scenarios: base.scenarios.map((scenario) => ({
          ...scenario,
          sceneryPlacements: [
            { definitionId: "palm", x: 1, y: 1, rotation: 0 as const },
            { definitionId: "palm", x: 1, y: 1, rotation: 0 as const },
            { definitionId: "palm", x: 10, y: 10, rotation: 0 as const },
          ],
        })),
      },
    };
    const errors = worldGraphKind.validateCampaign(invalid, built.strings).errors;
    expect(errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "placement_overlaps", path: "content.scenarios[0].sceneryPlacements[1]" }),
      expect.objectContaining({ code: "placement_out_of_bounds", path: "content.scenarios[0].sceneryPlacements[2]" }),
    ]));
    expect(errors.some((entry) => entry.path === "content.scenarios[0].sceneryPlacements[0]")).toBe(false);
  });

  it("rejects non-positive edge costs on explicit map topology", () => {
    const built = envelope();
    const base = runtime().content;
    const invalid = {
      ...built.campaign,
      content: {
        ...base,
        maps: base.maps.map((entry) => ({
          ...entry,
          topology: {
            kind: "explicit" as const,
            edges: [
              { from: { x: 0, y: 1 }, to: { x: 1, y: 1 }, edgeCost: 0, allowed: true },
              { from: { x: 1, y: 1 }, to: { x: 0, y: 1 }, edgeCost: -1, allowed: true },
            ],
          },
        })),
      },
    };
    expect(worldGraphKind.validateCampaign(invalid, built.strings).errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "invalid_edge_cost", path: "content.maps[0].topology.edges[0].edgeCost" }),
      expect.objectContaining({ code: "invalid_edge_cost", path: "content.maps[0].topology.edges[1].edgeCost" }),
    ]));
  });

  it("rejects negative and legacy counter effects before a tick can run", () => {
    const built = envelope();
    const base = runtime().content;
    const invalidEffects = [
      { kind: "counter_increment", counter: "guestsEntered", amount: -1 },
      { kind: "counter_delta", counter: "guestsEntered", delta: 1 },
    ] as unknown as WorldGraphCampaign["scenarios"][number]["scheduledChanges"][number]["effects"];
    const invalid = {
      ...built.campaign,
      content: {
        ...base,
        scenarios: base.scenarios.map((entry) => ({
          ...entry,
          scheduledChanges: [{
            dueTick: 0,
            priority: 0,
            condition: { kind: "constant" as const, value: true },
            effects: invalidEffects,
          }],
        })),
      },
    };
    expect(worldGraphKind.validateCampaign(invalid, built.strings).errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "invalid_counter_increment", path: "content.scenarios[0].scheduledChanges[0].effects[0].amount" }),
      expect.objectContaining({ code: "invalid_effect", path: "content.scenarios[0].scheduledChanges[0].effects[1].kind" }),
    ]));
  });

  it("rejects a building whose initial wear is already zero, since it could never be marked broken", () => {
    const built = envelope();
    const base = runtime().content;
    const invalid = {
      ...built.campaign,
      content: { ...base, buildings: base.buildings.map((entry, index) => (index === 0 ? { ...entry, initialWear: 0 } : entry)) },
    };
    expect(worldGraphKind.validateCampaign(invalid, built.strings).errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "invalid_initial_wear", path: "content.buildings[0].initialWear" }),
    ]));
  });

  it("accepts a nonzero initial wear unchanged", () => {
    const built = envelope();
    expect(worldGraphKind.validateCampaign(built.campaign, built.strings).errors).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "invalid_initial_wear" }),
    ]));
  });

  it("rejects a wear delta on effect lists that run after cleanliness-wear and never defer to it", () => {
    const built = envelope();
    const base = runtime().content;
    const meterEffect = { kind: "building_meter_delta" as const, meter: "wear" as const, delta: -10, buildings: { kind: "all" as const } };
    const invalid = {
      ...built.campaign,
      content: {
        ...base,
        objectives: base.objectives.map((entry) => ({ ...entry, onCompleted: [meterEffect] })),
        failures: base.failures.map((entry) => ({ ...entry, onTriggered: [meterEffect] })),
        incidents: base.incidents.map((entry) => ({ ...entry, durationTicks: { min: 2, max: 2 }, onResolve: [meterEffect] })),
      },
    };
    const errors = worldGraphKind.validateCampaign(invalid, built.strings).errors;
    expect(errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "undeferrable_building_meter_effect", path: "content.objectives[0].onCompleted[0]" }),
      expect.objectContaining({ code: "undeferrable_building_meter_effect", path: "content.failures[0].onTriggered[0]" }),
      expect.objectContaining({ code: "undeferrable_building_meter_effect", path: "content.incidents[0].onResolve[0]" }),
      expect.objectContaining({ code: "undeferrable_building_meter_effect", path: "content.incidents[1].onResolve[0]" }),
    ]));
    // Exactly those four lists (one per catalog entry carrying the invalid delta), not every
    // list carrying a building_meter_delta.
    expect(errors.filter((entry) => entry.code === "undeferrable_building_meter_effect")).toHaveLength(4);
  });

  it("accepts a cleanliness delta on those same lists, which carries no broken transition to miss", () => {
    const built = envelope();
    const base = runtime().content;
    // §9.2 licenses a late group applying locally; only `wear` can be silently wrong that way.
    const meterEffect = { kind: "building_meter_delta" as const, meter: "cleanliness" as const, delta: 20, buildings: { kind: "all" as const } };
    const valid = {
      ...built.campaign,
      content: {
        ...base,
        objectives: base.objectives.map((entry) => ({ ...entry, onCompleted: [meterEffect] })),
        failures: base.failures.map((entry) => ({ ...entry, onTriggered: [meterEffect] })),
        incidents: base.incidents.map((entry) => ({ ...entry, durationTicks: { min: 2, max: 2 }, onResolve: [meterEffect] })),
      },
    };
    const errors = worldGraphKind.validateCampaign(valid, built.strings).errors;
    expect(errors.filter((entry) => entry.code === "undeferrable_building_meter_effect")).toHaveLength(0);
  });

  it("accepts a building_meter_delta in onResolve when the incident can only resolve via staff work (durationTicks: null)", () => {
    const built = envelope();
    const litter = runtime().content.incidents.find((entry) => entry.id === "litter");
    expect(litter).toMatchObject({ durationTicks: null, onResolve: [expect.objectContaining({ kind: "building_meter_delta" })] });
    expect(worldGraphKind.validateCampaign(built.campaign, built.strings)).toMatchObject({ ok: true, errors: [] });
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

  it("advances bounded batches without using the action RNG stream", () => {
    const game = create();
    const runtimeEngine = engine();
    expect(runtimeEngine.availableActions(game).find((entry) => entry.id === "advance_ticks")).toMatchObject({ available: true });
    const result = runtimeEngine.submitAction(game, "advance_ticks", { ticks: 2 });
    expect(result.ok).toBe(true);
    expect(stateOf(result.value!)).toMatchObject({ tick: 2 });
    expect(result.changes).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: "guests.guest:0.exists", reason: "guest_spawned" }),
      expect.objectContaining({ path: "tick", previous: 0, value: 2, reason: "ticks_advanced" }),
    ]));
    expect(runtimeEngine.submitAction(game, "advance_ticks", { ticks: 0 }).errors[0]?.code).toBe("ticks_not_positive");
    expect(runtimeEngine.submitAction(game, "advance_ticks", { ticks: 11 }).errors[0]?.code).toBe("tick_limit_reached");
  });

  it("delivers the MVP causal chain through createGame and submitAction", () => {
    const base = runtime().content;
    const content: WorldGraphCampaign = {
      ...base,
      products: base.products.map((product) => ({ ...product, price: { ...product.price, defaultCents: 100 }, litter: { incidentDefinitionId: "litter", unitsPerService: 1 } })),
      objectives: base.objectives.map((objective) => ({ ...objective, completion: { kind: "compare" as const, metric: { kind: "counter" as const, counter: "litterCleaned" as const }, op: "gte" as const, value: 1 }, progressMetric: { kind: "counter" as const, counter: "litterCleaned" as const }, target: 1 })),
      scenarios: base.scenarios.map((scenario) => ({ ...scenario, buildingPlacements: [{ definitionId: "kiosk", x: 1, y: 1, rotation: 0 as const, open: true }], guestSpawning: { everyTicks: 1, maxActiveGuests: 1, pool: [{ archetypeId: "guest", weight: 1 }] } })),
    };
    const recording = createRecordingEmitter();
    const runtimeEngine = engine(content).withEmitter(recording);
    const created = runtimeEngine.createGame({ campaignId: "world-test" });
    expect(created.ok).toBe(true);
    const hired = runtimeEngine.submitAction(created.value!, "hire_staff", { definitionId: "cleaner" });
    expect(hired.ok).toBe(true);
    const advanced = runtimeEngine.submitAction(hired.value!, "advance_ticks", { ticks: 10 });
    expect(advanced.ok).toBe(true);
    const state = stateOf(advanced.value!);
    expect(state.counters).toMatchObject({ servicesCompleted: 1, litterCreated: 1, litterCleaned: 1 });
    expect(state.resolution).toMatchObject({ resolution: "objectives_met", objectiveIds: ["clean-litter"], failureId: null });
    expect(advanced.changes).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: expect.stringMatching(/^incidents\..+\.resolvedAtTick$/), reason: "incident_resolved" }),
    ]));
    expect(recording.events.some((entry) => entry.name === "kind.world-graph.incident.resolved")).toBe(true);
  });

  it("releases a served guest so the active cap can admit the next journey", () => {
    const base = runtime().content;
    const content: WorldGraphCampaign = {
      ...base,
      products: base.products.map((product) => ({ ...product, price: { ...product.price, defaultCents: 100 } })),
      objectives: base.objectives.map((objective) => ({
        ...objective,
        completion: { kind: "compare", metric: { kind: "counter", counter: "guestsEntered" }, op: "gte", value: 2 },
        progressMetric: { kind: "counter", counter: "guestsEntered" },
        target: 2,
      })),
      scenarios: base.scenarios.map((scenario) => ({
        ...scenario,
        buildingPlacements: [{ definitionId: "kiosk", x: 1, y: 1, rotation: 0, open: true }],
        guestSpawning: { everyTicks: 1, maxActiveGuests: 1, pool: [{ archetypeId: "guest", weight: 1 }] },
      })),
    };
    const runtimeEngine = engine(content);
    const created = runtimeEngine.createGame({ campaignId: "world-test" });
    expect(created.ok).toBe(true);
    const advanced = runtimeEngine.submitAction(created.value!, "advance_ticks", { ticks: 10 });
    expect(advanced.ok).toBe(true);
    const state = stateOf(advanced.value!);
    expect(state.counters).toMatchObject({ guestsEntered: 2, guestsDeparted: 1, servicesCompleted: 1 });
    expect(state.resolution).toMatchObject({ resolution: "objectives_met", objectiveIds: ["clean-litter"] });
  });

  it("reaches the declared financial loss through submitAction", () => {
    const base = runtime().content;
    const content: WorldGraphCampaign = {
      ...base,
      scenarios: base.scenarios.map((scenario) => ({
        ...scenario, startingCashCents: 0,
        scheduledChanges: [{ dueTick: 0, priority: 0, condition: { kind: "constant", value: true }, effects: [{ kind: "finance_delta", field: "cashCents", cents: -1 }] }],
      })),
    };
    const runtimeEngine = engine(content);
    const created = runtimeEngine.createGame({ campaignId: "world-test" });
    expect(created.ok).toBe(true);
    const advanced = runtimeEngine.submitAction(created.value!, "advance_ticks", { ticks: 1 });
    expect(advanced.ok).toBe(true);
    expect(stateOf(advanced.value!).resolution).toMatchObject({ resolution: "failed", failureId: "bankrupt" });
  });

  it("keeps objective completion effects out of the same-tick failure snapshot", () => {
    const base = runtime().content;
    const content: WorldGraphCampaign = {
      ...base,
      objectives: base.objectives.map((objective) => ({
        ...objective,
        completion: { kind: "constant", value: true }, progressMetric: null,
        target: 1, requiredDurationTicks: 2,
        onCompleted: [{ kind: "finance_delta", field: "cashCents", cents: -1 }],
      })),
      scenarios: base.scenarios.map((scenario) => ({
        ...scenario, startingCashCents: 0, resolutionPrecedence: "failure_wins",
      })),
    };
    const runtimeEngine = engine(content);
    const created = runtimeEngine.createGame({ campaignId: "world-test" });
    expect(created.ok).toBe(true);
    const advanced = runtimeEngine.submitAction(created.value!, "advance_ticks", { ticks: 2 });
    expect(advanced.ok).toBe(true);
    expect(stateOf(advanced.value!)).toMatchObject({
      finances: { cashCents: -1 },
      failures: [{ id: "bankrupt", state: "active" }],
      resolution: { resolution: "objectives_met", failureId: null },
    });
  });

  it("triggers the declared failure at the exact scenario time limit", () => {
    const base = runtime().content;
    const content: WorldGraphCampaign = {
      ...base,
      objectives: base.objectives.map((objective) => ({
        ...objective, completion: { kind: "constant", value: false }, progressMetric: null,
      })),
      failures: base.failures.map((failure) => ({
        ...failure, condition: { kind: "constant", value: false },
      })),
      scenarios: base.scenarios.map((scenario) => ({
        ...scenario, timeLimitTicks: 1, timeLimitFailureId: "bankrupt",
      })),
    };
    const runtimeEngine = engine(content);
    const created = runtimeEngine.createGame({ campaignId: "world-test" });
    expect(created.ok).toBe(true);
    const advanced = runtimeEngine.submitAction(created.value!, "advance_ticks", { ticks: 1 });
    expect(advanced.ok).toBe(true);
    expect(stateOf(advanced.value!)).toMatchObject({
      tick: 1,
      objectives: [{ id: "clean-litter", state: "failed" }],
      failures: [{ id: "bankrupt", state: "triggered" }],
      resolution: { resolution: "failed", failureId: "bankrupt" },
    });
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

  it("routes a demolished guest to the nearer reachable exit, not map.exits[0]", () => {
    const baseMap = runtime().content.maps[0]!;
    const maps = [{ ...baseMap, width: 9, exits: [{ x: 8, y: 1 }, { x: 1, y: 1 }] }];
    const runtimeEngine = engine({ maps });
    const game = runtimeEngine.submitAction(create({ maps }), "build", { definitionId: "kiosk", x: 4, y: 1, rotation: 0 }).value!;
    const state = stateOf(game);
    const guest: Guest = {
      id: "guest:99", archetypeId: "guest", lifecycle: "seeking", tickEntered: 0, stayDurationTicks: 100,
      x: 0, y: 1, path: [], pathIndex: 0, drawCount: 0, cashCents: 0,
      intent: { kind: "seek_service", buildingId: "building:0", productId: null, selectedAtTick: 0 },
      needs: {}, conditions: {}, opinions: {}, preferences: {}, satisfaction: 100,
      patienceCapacityTicks: 100, patienceRemainingTicks: 100, lastServedTick: null, spentTicks: 0,
    };
    const withGuest = { ...game, kindState: { ...state, guests: [guest] } };
    const demolished = runtimeEngine.submitAction(withGuest, "demolish", { buildingId: "building:0" }).value!;
    expect(stateOf(demolished).guests[0]?.intent).toMatchObject({ kind: "leave", exit: { x: 1, y: 1 } });

    // W93.5: deterministic across two runs from the same pre-demolition state...
    const secondRun = runtimeEngine.submitAction(withGuest, "demolish", { buildingId: "building:0" }).value!;
    expect(secondRun).toEqual(demolished);

    // ...and across a serialize/deserialize cut immediately before the corrected operation.
    const restored = runtimeEngine.deserialize(runtimeEngine.serialize(withGuest)).value!;
    const fromRestored = runtimeEngine.submitAction(restored, "demolish", { buildingId: "building:0" }).value!;
    expect(fromRestored).toEqual(demolished);
  });

  it("assign_staff emits a StateChange row only for the assignment field that actually changed", () => {
    const baseMap = runtime().content.maps[0]!;
    const maps = [{
      ...baseMap,
      zones: [{ id: "zone-a", text: { nameKey: "zone.a.name", descriptionKey: "zone.a.description" }, cells: [{ x: 0, y: 0 }], serviceRadius: 5, maxOccupancy: null }],
    }];
    const runtimeEngine = engine({ maps });
    let game = runtimeEngine.submitAction(create({ maps }), "build", { definitionId: "kiosk", x: 2, y: 1, rotation: 0 }).value!;
    game = runtimeEngine.submitAction(game, "hire_staff", { definitionId: "cleaner" }).value!;

    const buildingOnly = runtimeEngine.submitAction(game, "assign_staff", { staffId: "staff:2", buildingId: "building:0" });
    expect(buildingOnly.changes).toEqual([
      expect.objectContaining({ path: "staff.staff:2.assignedBuildingId", value: "building:0", previous: "" }),
    ]);
    game = buildingOnly.value!;

    const zoneOnly = runtimeEngine.submitAction(game, "assign_staff", { staffId: "staff:2", buildingId: "building:0", zoneId: "zone-a" });
    expect(zoneOnly.changes).toEqual([
      expect.objectContaining({ path: "staff.staff:2.assignedZoneId", value: "zone-a", previous: "" }),
    ]);
    game = zoneOnly.value!;

    const samePair = runtimeEngine.submitAction(game, "assign_staff", { staffId: "staff:2", buildingId: "building:0", zoneId: "zone-a" });
    expect(samePair.ok).toBe(true);
    expect(samePair.changes).toEqual([]);
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
    expect(worldGraphKind.outcome({ ...base, objectives: [{ ...base.objectives[0]!, state: "met" }] })).toEqual({
      terminal: false,
      terminalId: null,
      resolution: null,
      objectivesMet: [],
      failureId: null,
    });
    expect(
      worldGraphKind.outcome({ ...base, resolution: { resolution: "failed", objectiveIds: [], failureId: "bankrupt", resolvedAtTick: 0 } }),
    ).toEqual({ terminal: true, terminalId: "failed", resolution: "failed", objectivesMet: [], failureId: "bankrupt" });
  });
});

describe("world-graph W81 construction", () => {
  it("declares the two construction events", () => {
    expect(worldGraphKind.eventNames).toEqual(expect.arrayContaining([
      "kind.world-graph.construction.progressed",
      "kind.world-graph.construction.completed",
    ]));
  });

  it("reaches zero and materializes the reserved building/queue ids despite another entity allocated in between", () => {
    const recording = createRecordingEmitter();
    const runtimeEngine = engine().withEmitter(recording);
    let game = create();
    game = runtimeEngine.submitAction(game, "build", { definitionId: "hut", x: 3, y: 1, rotation: 0 }).value!;
    expect(stateOf(game).constructionSites[0]).toMatchObject({ id: "construction-site:0", workRemaining: 3, completedBuildingId: "building:1", completedQueueId: "queue:2" });
    game = runtimeEngine.submitAction(game, "hire_staff", { definitionId: "builder" }).value!;
    // Three ticks of travel, no effort applied yet — the builder has not reached the site.
    game = runtimeEngine.submitAction(game, "advance_ticks", { ticks: 3 }).value!;
    expect(stateOf(game).constructionSites[0]?.workRemaining).toBe(3);
    // Allocate another entity — hiring a second staff member — between the build action and
    // the completion tick, so completion cannot be shown to renumber it (W81.2).
    const ordinalBeforeInterleave = stateOf(game).nextEntityOrdinal;
    game = runtimeEngine.submitAction(game, "hire_staff", { definitionId: "cleaner" }).value!;
    expect(stateOf(game).nextEntityOrdinal).toBeGreaterThan(ordinalBeforeInterleave);
    // Declared work is 3, one effort-per-tick builder arrives at tick 3 (0-indexed) and
    // works ticks 4, 5, 6 — completing on the seventh advance_ticks call in total.
    game = runtimeEngine.submitAction(game, "advance_ticks", { ticks: 4 }).value!;
    const state = stateOf(game);
    expect(state.constructionSites).toEqual([]);
    expect(state.buildings.find((entry) => entry.definitionId === "hut")).toMatchObject({
      id: "building:1", status: "open", wear: 100, cleanliness: 100,
      queue: { id: "queue:2", guestIds: [] }, pricesCents: {}, inventory: {},
    });
    expect(state.counters.buildingsCompleted).toBe(1);
    expect(recording.events.some((entry) => entry.name === "kind.world-graph.construction.progressed")).toBe(true);
    expect(recording.events.some((entry) => entry.name === "kind.world-graph.construction.completed")).toBe(true);
  });

  it("bumps map.revision once for placement and once for completion", () => {
    const runtimeEngine = engine();
    let game = create();
    const before = stateOf(game).map.revision;
    game = runtimeEngine.submitAction(game, "build", { definitionId: "hut", x: 3, y: 1, rotation: 0 }).value!;
    expect(stateOf(game).map.revision).toBe(before + 1);
    game = runtimeEngine.submitAction(game, "hire_staff", { definitionId: "builder" }).value!;
    game = runtimeEngine.submitAction(game, "advance_ticks", { ticks: 7 }).value!;
    expect(stateOf(game).map.revision).toBe(before + 2);
  });

  it("carries a batch-grain existence row for the completed building, reasoned and resolvable", () => {
    const runtimeEngine = engine();
    let game = create();
    game = runtimeEngine.submitAction(game, "build", { definitionId: "hut", x: 3, y: 1, rotation: 0 }).value!;
    game = runtimeEngine.submitAction(game, "hire_staff", { definitionId: "builder" }).value!;
    const advanced = runtimeEngine.submitAction(game, "advance_ticks", { ticks: 7 });
    const existenceRow = advanced.changes.find((entry) => entry.path === "buildings.building:1.exists");
    expect(existenceRow).toMatchObject({ value: true, reason: "building_completed" });
    expect(WORLD_GRAPH_REASON_MESSAGES.get(`world-graph.reason.${existenceRow?.reason}`)).toBeTypeOf("string");
  });

  it("serializes byte-identically whether advance_ticks n is submitted whole or split strictly inside the construction span", () => {
    const runWhole = (): WorldGraphKindState => {
      const runtimeEngine = engine();
      let game = create();
      game = runtimeEngine.submitAction(game, "build", { definitionId: "hut", x: 3, y: 1, rotation: 0 }).value!;
      game = runtimeEngine.submitAction(game, "hire_staff", { definitionId: "builder" }).value!;
      game = runtimeEngine.submitAction(game, "advance_ticks", { ticks: 7 }).value!;
      return stateOf(game);
    };
    const runSplit = (): WorldGraphKindState => {
      const runtimeEngine = engine();
      let game = create();
      game = runtimeEngine.submitAction(game, "build", { definitionId: "hut", x: 3, y: 1, rotation: 0 }).value!;
      game = runtimeEngine.submitAction(game, "hire_staff", { definitionId: "builder" }).value!;
      // Split at 5 ticks — the builder has arrived and worked once, with work remaining at 2
      // of the declared 3 — strictly inside the span, not at an end.
      game = runtimeEngine.submitAction(game, "advance_ticks", { ticks: 5 }).value!;
      expect(stateOf(game).constructionSites[0]?.workRemaining).toBe(2);
      game = runtimeEngine.submitAction(game, "advance_ticks", { ticks: 2 }).value!;
      return stateOf(game);
    };
    expect(runSplit()).toEqual(runWhole());
  });
});

describe("world-graph W82 restock", () => {
  function withRestocker() {
    const runtimeEngine = engine();
    let game = create();
    game = runtimeEngine.submitAction(game, "build", { definitionId: "stall", x: 3, y: 1, rotation: 0 }).value!;
    game = runtimeEngine.submitAction(game, "hire_staff", { definitionId: "restocker" }).value!;
    return { runtimeEngine, game };
  }

  it("restocks a below-capacity product up to capacity, staffed by a restocker, and never beyond", () => {
    const { runtimeEngine, game: staffed } = withRestocker();
    const stallBefore = stateOf(staffed).buildings.find((entry) => entry.definitionId === "stall");
    expect(stallBefore?.inventory.water).toBe(1);
    // Travel takes 4 ticks and the missing 2 units take 2 ticks at effort-per-tick 1,
    // completing on the sixth advance_ticks call in total.
    const game = runtimeEngine.submitAction(staffed, "advance_ticks", { ticks: 6 }).value!;
    const state = stateOf(game);
    const stall = state.buildings.find((entry) => entry.definitionId === "stall");
    expect(stall?.inventory.water).toBe(3);
    expect(state.staff[0]).toMatchObject({ status: "idle", tasksCompleted: 1, task: null });
    // Never exceeds capacity on a further tick.
    const further = runtimeEngine.submitAction(game, "advance_ticks", { ticks: 1 }).value!;
    expect(stateOf(further).buildings.find((entry) => entry.definitionId === "stall")?.inventory.water).toBe(3);
  });

  it("never applies cleanliness or wear, and moves cash only by the restocker's wage — never the product's unit cost", () => {
    const { runtimeEngine, game: staffed } = withRestocker();
    const before = stateOf(staffed);
    const stallBefore = before.buildings.find((entry) => entry.definitionId === "stall")!;
    const game = runtimeEngine.submitAction(staffed, "advance_ticks", { ticks: 6 }).value!;
    const after = stateOf(game);
    const stallAfter = after.buildings.find((entry) => entry.definitionId === "stall")!;
    expect(stallAfter.cleanliness).toBe(stallBefore.cleanliness);
    expect(stallAfter.wear).toBe(stallBefore.wear);
    // Six ticks of a 20-cents-per-day wage, prorated over a 100-tick day: floor(20*6/100) = 1.
    // If restock recognized the product's 50-cent unit cost, the delta would be far larger.
    expect(before.finances.cashCents - after.finances.cashCents).toBe(1);
    expect(after.finances.expensesTotalCents - before.finances.expensesTotalCents).toBe(1);
  });

  it("serializes byte-identically whether advance_ticks n is submitted whole or split strictly inside the restock span", () => {
    const runWhole = (): WorldGraphKindState => {
      const { runtimeEngine, game: staffed } = withRestocker();
      const game = runtimeEngine.submitAction(staffed, "advance_ticks", { ticks: 6 }).value!;
      return stateOf(game);
    };
    const runSplit = (): WorldGraphKindState => {
      const { runtimeEngine, game: staffed } = withRestocker();
      // Split at 5 ticks — the restocker has arrived and worked once, one of the missing 2
      // units still outstanding — strictly inside the span, not at an end.
      let game = runtimeEngine.submitAction(staffed, "advance_ticks", { ticks: 5 }).value!;
      expect(stateOf(game).buildings.find((entry) => entry.definitionId === "stall")?.inventory.water).toBe(2);
      game = runtimeEngine.submitAction(game, "advance_ticks", { ticks: 1 }).value!;
      return stateOf(game);
    };
    expect(runSplit()).toEqual(runWhole());
  });

  it("never dispatches a restocker to a closed, below-capacity building", () => {
    const { runtimeEngine, game: staffed } = withRestocker();
    const stallId = stateOf(staffed).buildings.find((entry) => entry.definitionId === "stall")!.id;
    const closed = runtimeEngine.submitAction(staffed, "close_building", { buildingId: stallId }).value!;
    const game = runtimeEngine.submitAction(closed, "advance_ticks", { ticks: 6 }).value!;
    const state = stateOf(game);
    expect(state.buildings.find((entry) => entry.id === stallId)?.inventory.water).toBe(1);
    expect(state.staff[0]).toMatchObject({ status: "idle", tasksCompleted: 0, task: null });
  });
});

describe("world-graph W84 incidents", () => {
  it("declares the incident.raised event alongside incident.resolved", () => {
    expect(worldGraphKind.eventNames).toEqual(expect.arrayContaining([
      "kind.world-graph.incident.resolved",
      "kind.world-graph.incident.raised",
    ]));
  });

  it("W84.7: serializes byte-identically whether advance_ticks n is submitted whole or split across a batch with at least one successful and one failed roll", () => {
    const base = runtime().content;
    const rolledContent: WorldGraphCampaign = {
      ...base,
      incidents: [{
        id: "storm", text: { nameKey: "incident.storm.name", descriptionKey: "incident.storm.description" }, kind: "weather", severity: "minor",
        triggerCondition: { kind: "constant", value: true },
        rollScope: "building", rollChanceBasisPoints: 5000, selectionWeight: 1,
        cooldownTicks: 0, durationTicks: { min: 1, max: 1 },
        resolutionCondition: null, resolverTaskType: null, resolverTaskPriority: null,
        onStart: [], onResolve: [],
      }],
      scenarios: base.scenarios.map((scenario) => ({
        ...scenario,
        buildingPlacements: [{ definitionId: "kiosk", x: 1, y: 1, rotation: 0 as const, open: true }],
        guestSpawning: { everyTicks: 1000, maxActiveGuests: 0, pool: scenario.guestSpawning.pool },
      })),
    } as unknown as WorldGraphCampaign;

    const run = (ticks: readonly number[]): WorldGraphKindState => {
      const runtimeEngine = engine(rolledContent);
      let game = runtimeEngine.createGame({ campaignId: "world-test" }).value!;
      for (const count of ticks) game = runtimeEngine.submitAction(game, "advance_ticks", { ticks: count }).value!;
      return stateOf(game);
    };

    const whole = run([10, 10]);
    const split = run([3, 7, 4, 6]);
    expect(split).toEqual(whole);
    // Confirms this batch genuinely mixed outcomes — the case a per-call rather than
    // per-tick handle would diverge on (20-contract.md §4.18, §5).
    expect(whole.counters.incidentsRaised).toBeGreaterThan(0);
    expect(whole.counters.incidentsRaised).toBeLessThan(20);
  });
});

describe("world-graph W85 alerts and achievements", () => {
  it("declares the achievement.unlocked, alert.raised and alert.cleared events", () => {
    expect(worldGraphKind.eventNames).toEqual(expect.arrayContaining([
      "kind.world-graph.achievement.unlocked",
      "kind.world-graph.alert.raised",
      "kind.world-graph.alert.cleared",
    ]));
  });

  it("W85.1: mirrors an unlock to the profile only after the whole action succeeds — a refused action never touches it", async () => {
    const profiles = createInMemoryProfileStore();
    const store = sessionStoreWithProfiles(profiles);
    const created = await store.createSession({ campaignId: "world-test", profileId: "p-world" });

    // Rejected before any tick system runs — ticks_not_positive is validated up front, so
    // system 19 never executes and the profile store is never touched.
    const refused = await store.submitAction(created.sessionId, "advance_ticks", { ticks: 0 });
    expect(refused.errors).toHaveLength(1);
    const untouched = await profiles.load("p-world");
    expect(untouched.profile.achievements).toEqual([]);

    // The MVP campaign's `double-cleaner` achievement (world-graph-mvp.ts) unlocks once two
    // cleaners are on staff — inert everywhere but a dedicated scenario like this one.
    await store.submitAction(created.sessionId, "hire_staff", { definitionId: "cleaner" });
    await store.submitAction(created.sessionId, "hire_staff", { definitionId: "cleaner" });
    const advanced = await store.submitAction(created.sessionId, "advance_ticks", { ticks: 1 });
    expect(advanced.errors).toEqual([]);

    const { profile } = await profiles.load("p-world");
    expect(profile.achievements).toEqual([{ campaignId: "world-test", achievementId: "double-cleaner" }]);
  });

  it("W85.7: serializes byte-identically whether advance_ticks n is submitted whole or split across a batch that raises and clears an alert", () => {
    const base = runtime().content;
    const rolledContent: WorldGraphCampaign = {
      ...base,
      incidents: [{
        id: "storm", text: { nameKey: "incident.storm.name", descriptionKey: "incident.storm.description" }, kind: "weather", severity: "minor",
        triggerCondition: { kind: "constant", value: true },
        rollScope: "building", rollChanceBasisPoints: 10000, selectionWeight: 1,
        cooldownTicks: 0, durationTicks: { min: 1, max: 1 },
        resolutionCondition: null, resolverTaskType: null, resolverTaskPriority: null,
        onStart: [], onResolve: [],
      }],
      scenarios: base.scenarios.map((scenario) => ({
        ...scenario,
        buildingPlacements: [{ definitionId: "kiosk", x: 1, y: 1, rotation: 0 as const, open: true }],
        guestSpawning: { everyTicks: 1000, maxActiveGuests: 0, pool: scenario.guestSpawning.pool },
      })),
    } as unknown as WorldGraphCampaign;

    const run = (ticks: readonly number[]): WorldGraphKindState => {
      const runtimeEngine = engine(rolledContent);
      let game = runtimeEngine.createGame({ campaignId: "world-test" }).value!;
      for (const count of ticks) game = runtimeEngine.submitAction(game, "advance_ticks", { ticks: count }).value!;
      return stateOf(game);
    };

    const whole = run([10, 10]);
    const split = run([3, 7, 4, 6]);
    expect(split).toEqual(whole);
    // A 100% roll chance with a one-tick duration and no cooldown means a fresh storm
    // starts the tick after the last one resolves — the alert list genuinely cycles
    // raise/clear pairs across the batch, the case a per-tick derivation would diverge on.
    expect(whole.alerts.length).toBeGreaterThan(0);
    expect(whole.alerts.some((alert) => alert.clearedAtTick !== null)).toBe(true);
  });
});

describe("world-graph W95 effect and audit semantics", () => {
  it("W95.4: a deferred policy-sourced building-meter effect emits scenario.effect.applied identically across every partition of the same tick batch", () => {
    const base = runtime().content;
    const policiedContent: WorldGraphCampaign = {
      ...base,
      policies: [{
        id: "grime", text: { nameKey: "policy.grime.name", descriptionKey: "policy.grime.description" },
        availableWhen: { kind: "constant", value: true }, activationCostCents: 0, deactivationCostCents: 0,
        whileActive: [{ kind: "building_meter_delta", meter: "cleanliness", delta: -3, buildings: { kind: "all" } }],
        tags: [],
      }],
      scenarios: base.scenarios.map((scenario) => ({
        ...scenario,
        activePolicyIds: ["grime"],
        buildingPlacements: [{ definitionId: "kiosk", x: 1, y: 1, rotation: 0 as const, open: true }],
        guestSpawning: { everyTicks: 1000, maxActiveGuests: 0, pool: scenario.guestSpawning.pool },
      })),
    } as unknown as WorldGraphCampaign;

    const run = (ticks: readonly number[]) => {
      const recording = createRecordingEmitter();
      const runtimeEngine = engine(policiedContent).withEmitter(recording);
      let game = runtimeEngine.createGame({ campaignId: "world-test" }).value!;
      for (const count of ticks) game = runtimeEngine.submitAction(game, "advance_ticks", { ticks: count }).value!;
      // `seq`/`ordinal` are per-call diagnostics (05 §5), like `batch.started`/`batch.ended` —
      // they legitimately differ by partition and are excluded, same as 20-contract.md §5's
      // rule that only tick/entity event substance, not per-call bookkeeping, must match.
      const applied = recording.events
        .filter((event) => event.name === "kind.world-graph.scenario.effect.applied")
        .map((event) => event.data);
      return { state: stateOf(game), applied };
    };

    const whole = run([10, 10]);
    const split = run([3, 7, 4, 6]);
    expect(split.state).toEqual(whole.state);
    expect(split.applied).toEqual(whole.applied);
    // Kiosk starts at initialCleanliness 80 (world-graph-mvp.ts) and drifts -3/tick with no
    // other source active — 20 ticks never saturates the 0 floor, so every tick's deferred
    // policy delta genuinely moves the meter and the event fires all 20 times, the case a
    // per-call rather than per-tick handle of `deferredBuildingMeterDeltas` would diverge on.
    expect(whole.applied).toHaveLength(20);
    expect(whole.state.buildings[0]?.cleanliness).toBe(20);
  });
});

describe("world-graph W96 mechanical regression boundaries", () => {
  // A single ten-tick fixture engineered to cross all six named boundaries (20 §5, §15.3):
  // service (a guest served at the entrance-adjacent kiosk), construction (a hut built by a
  // hired builder), incident (a 50% storm roll, like the existing W84.7 fixture), day-reset
  // (`ticksPerDay: 3` crosses the boundary four times in ten ticks), departure (the guest
  // leaves once its shortened stay expires), and terminal (a `timeLimitTicks: 10` failure
  // fires on the batch's very last tick, for every partition).
  function kitchenSinkContent(): WorldGraphCampaign {
    const base = runtime().content;
    return {
      ...base,
      ticksPerDay: 3,
      objectives: base.objectives.map((objective) => ({ ...objective, completion: { kind: "constant", value: false }, progressMetric: null })),
      failures: base.failures.map((failure) => ({ ...failure, condition: { kind: "constant", value: false } })),
      // Cash raised above the file-level 150-cent kiosk price (`source` above overrides
      // `defaultCents` to 150; the MVP archetype's own 100 cents could never afford it, so
      // every guest fell back to `leave` without ever selecting a service candidate).
      guestArchetypes: base.guestArchetypes.map((archetype) => ({ ...archetype, cashCents: { min: 200, max: 200 }, stayTicks: { min: 6, max: 6 } })),
      incidents: base.incidents.map((incident) => incident.id === "storm"
        ? { ...incident, triggerCondition: { kind: "constant", value: true }, rollScope: "building" as const, rollChanceBasisPoints: 5000, cooldownTicks: 0, durationTicks: { min: 1, max: 1 } }
        : incident),
      scenarios: base.scenarios.map((scenario) => ({
        ...scenario,
        buildingPlacements: [{ definitionId: "kiosk", x: 1, y: 1, rotation: 0 as const, open: true }],
        timeLimitTicks: 10, timeLimitFailureId: "bankrupt",
      })),
    } as unknown as WorldGraphCampaign;
  }

  function runPartition(ticks: readonly number[], seed: string): WorldGraphKindState {
    const runtimeEngine = engine(kitchenSinkContent());
    let game = runtimeEngine.createGame({ campaignId: "world-test", seed }).value!;
    game = runtimeEngine.submitAction(game, "build", { definitionId: "hut", x: 3, y: 1, rotation: 0 }).value!;
    game = runtimeEngine.submitAction(game, "hire_staff", { definitionId: "builder" }).value!;
    game = runtimeEngine.submitAction(game, "hire_staff", { definitionId: "cleaner" }).value!;
    game = runtimeEngine.submitAction(game, "hire_staff", { definitionId: "restocker" }).value!;
    for (const count of ticks) game = runtimeEngine.submitAction(game, "advance_ticks", { ticks: count }).value!;
    return stateOf(game);
  }

  const PARTITIONS: readonly (readonly number[])[] = [
    [1, 9], [5, 5], [2, 3, 5], [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  ];
  const SEEDS = ["w96-seed-alpha", "w96-seed-beta"];

  it.each(SEEDS)(
    "W96.1: ten ticks crossing service, construction, incident, day-reset, departure and terminal boundaries deep-equal across [1,9]/[5,5]/[2,3,5]/ten-ones (seed %s)",
    (seed) => {
      const whole = runPartition([10], seed);

      // Confirms the fixture genuinely exercises every named boundary, not a quiet no-op.
      expect(whole.tick).toBe(10);
      expect(whole.resolution).toMatchObject({ resolution: "failed", failureId: "bankrupt" });
      expect(whole.constructionSites).toEqual([]);
      expect(whole.buildings.some((building) => building.definitionId === "hut")).toBe(true);
      expect(whole.finances.revenueTotalCents).toBeGreaterThan(0);
      expect(whole.counters.guestsDeparted).toBeGreaterThan(0);
      expect(whole.incidents.length).toBeGreaterThan(0);

      for (const partition of PARTITIONS) {
        expect(runPartition(partition, seed)).toEqual(whole);
      }
    },
  );
});
