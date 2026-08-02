import { describe, expect, it } from "vitest";
import { createEngine } from "../../core/kernel/engine.js";
import type { KindRegistry } from "../../core/kernel/types.js";
import type { EngineHost } from "../../core/composition/types.js";
import type { Campaign, ContentRegistry } from "../../core/registry/types.js";
import type { WorldGraphCampaign } from "./campaign.js";
import { worldGraphKind } from "./kind.js";
import type { WorldGraphKindState, WorldGraphView } from "./state.js";

const map = {
  width: 4,
  height: 4,
  revision: 1,
  terrain: Array.from({ length: 16 }, (_, index) => ({
    x: index % 4,
    y: Math.floor(index / 4),
    terrain: "path" as const,
    edge: "walkable" as const,
    moveCost: 1,
  })),
  paths: [],
  zones: [{ id: "zone:main", nameKey: "world.zone.main", cells: [], serviceRadius: 0, maxOccupancy: null }],
  spawnPoints: [{ x: 0, y: 0 }],
  exits: [{ x: 3, y: 3 }],
};

const content: WorldGraphCampaign = {
  descriptionKey: "world.description",
  map,
  startingFinances: { cashCents: 1_000 },
  maxAdvanceTicksPerAction: 3,
  ticksPerDay: 96,
  buildingDefinitions: [{
    id: "drink-stand",
    width: 1,
    height: 1,
    costCents: 300,
    maxCount: null,
    allowedTerrain: ["path"],
    products: [{ id: "water", defaultPriceCents: 120, priceRange: { minCents: 100, maxCents: 200 } }],
  }],
  staffRoleDefinitions: [{ id: "vendor", hireCostCents: 200, maxCount: 1 }],
  objectiveDefinitions: [{ id: "stay-open", target: 1 }],
};

const campaign: Campaign = {
  id: "world-test",
  kindId: "world-graph",
  version: "1.0.0",
  titleKey: "world.title",
  content,
};

function campaignWith(overrides: Partial<WorldGraphCampaign>): Campaign {
  return { ...campaign, content: { ...content, ...overrides } };
}

function makeEngine(from: Campaign = campaign) {
  const registry: ContentRegistry = {
    campaigns: new Map([[from.id, from]]),
    strings: new Map(),
  };
  const host: EngineHost = {
    registry,
    kinds: { "world-graph": worldGraphKind } as unknown as KindRegistry,
    ids: { newGameId: () => "game:world", newSeed: () => "world-seed" },
  };
  return createEngine(host);
}

function createdWorld(from: Campaign = campaign) {
  const created = makeEngine(from).createGame({ campaignId: from.id });
  if (!created.ok || created.value === undefined) throw new Error("expected a new world");
  return created.value;
}

function kindState(state: { kindState: unknown }): WorldGraphKindState {
  return state.kindState as WorldGraphKindState;
}

function validate(from: Campaign, strings: ReadonlyMap<string, string> = new Map([["world.description", "d"]])) {
  return worldGraphKind.validateCampaign(from, strings);
}

describe("worldGraphKind — immediate actions", () => {
  it("creates a deterministic tick-zero world through the engine seam", () => {
    const state = kindState(createdWorld());

    expect(state.tick).toBe(0);
    expect(state.finances.cashCents).toBe(1_000);
    expect(state.nextEntityOrdinal).toBe(0);
  });

  it("advertises build when an unlocked definition is affordable", () => {
    const engine = makeEngine();
    const action = engine.availableActions(createdWorld()).find((entry) => entry.id === "build");

    expect(action).toMatchObject({ available: true, labelKey: "world-graph.action.build" });
  });

  it("gives every verb its own label key", () => {
    const engine = makeEngine();
    const labels = engine.availableActions(createdWorld()).map((entry) => entry.labelKey);

    expect(new Set(labels).size).toBe(labels.length);
  });

  it("builds without advancing time and allocates unique nested entity ids", () => {
    const engine = makeEngine();
    const result = engine.submitAction(createdWorld(), "build", {
      definitionId: "drink-stand",
      x: 1,
      y: 1,
      rotation: 0,
    });

    expect(result.ok).toBe(true);
    if (!result.ok || result.value === undefined) throw new Error("expected a placed building");
    const state = kindState(result.value);
    expect(state.tick).toBe(0);
    expect(state.buildings[0]?.id).toBe("building:0");
    expect(state.buildings[0]?.queue.id).toBe("queue:1");
    expect(state.alerts[0]?.id).toBe("alert:2");
    expect(state.nextEntityOrdinal).toBe(3);
    expect(state.finances.cashCents).toBe(700);
  });

  it("returns a StateChange for the cash spent and the building placed", () => {
    const engine = makeEngine();
    const result = engine.submitAction(createdWorld(), "build", {
      definitionId: "drink-stand",
      x: 1,
      y: 1,
      rotation: 0,
    });

    expect(result.changes).toEqual([
      { path: "finances.cashCents", op: "set", value: 700, previous: 1_000, reason: "building_placed", visible: true },
      { path: "buildings.building:0.exists", op: "set", value: true, reason: "building_placed", visible: false },
    ]);
  });

  it("carries only primitives in StateChange.value, as 04 §12 requires", () => {
    const engine = makeEngine();
    const built = engine.submitAction(createdWorld(), "build", { definitionId: "drink-stand", x: 1, y: 1, rotation: 0 });
    if (!built.ok || built.value === undefined) throw new Error("expected a placed building");
    const hired = engine.submitAction(built.value, "hire_staff", { roleId: "vendor" });
    const gone = engine.submitAction(hired.value!, "demolish", { buildingId: "building:0" });

    for (const change of [...built.changes, ...hired.changes, ...gone.changes]) {
      expect(["string", "number", "boolean"], change.path).toContain(typeof change.value);
      // `op` is always `set`, because 04 §12 gives increment/decrement no value semantics.
      expect(change.op, change.path).toBe("set");
    }
  });

  it("emits only StateChange paths that resolve against the state (12 §13)", () => {
    // The grammar is normative but `StateChange.path` is an unconstrained string, so this
    // is the check that makes divergence a failing test rather than a matter of taste:
    // walk the path against kindState, taking `<entityId>` as a lookup by id, and it must
    // land on a scalar — or, for the one synthetic leaf `.exists`, on the entity whose
    // membership it asserts.
    const resolves = (state: WorldGraphKindState, path: string, value: unknown): boolean => {
      const segments = path.split(".");
      const synthetic = segments.at(-1) === "exists";
      let node: unknown = state;

      for (const segment of synthetic ? segments.slice(0, -1) : segments) {
        if (Array.isArray(node)) {
          node = node.find((entry: { id?: string }) => entry.id === segment);
        } else if (typeof node === "object" && node !== null) {
          node = (node as Record<string, unknown>)[segment];
        } else {
          return false;
        }
        if (node === undefined) return synthetic && value === false;
      }

      return synthetic
        ? value === true
        : node === null || ["string", "number", "boolean"].includes(typeof node);
    };

    const engine = makeEngine();
    const built = engine.submitAction(createdWorld(), "build", { definitionId: "drink-stand", x: 1, y: 1, rotation: 0 });
    const hired = engine.submitAction(built.value!, "hire_staff", { roleId: "vendor" });
    const assigned = engine.submitAction(hired.value!, "assign_staff", { staffId: "staff:3", buildingId: "building:0" });
    const priced = engine.submitAction(assigned.value!, "set_price", { buildingId: "building:0", productId: "water", priceCents: 150 });
    const closed = engine.submitAction(priced.value!, "close_building", { buildingId: "building:0" });
    const dismissed = engine.submitAction(closed.value!, "dismiss_alert", { alertId: "alert:2" });
    const ticked = engine.submitAction(dismissed.value!, "advance_ticks", { ticks: 1 });

    const steps = [built, hired, assigned, priced, closed, dismissed, ticked];
    const emitted = steps.flatMap((step) => step.changes);
    expect(emitted.length).toBeGreaterThan(0);

    for (const [index, step] of steps.entries()) {
      // Resolved against the state the action produced, so an `.exists` row is checked
      // against the membership it claims rather than merely parsed.
      const state = kindState(step.value!);
      for (const change of step.changes) {
        expect(resolves(state, change.path, change.value), `step ${index}: ${change.path}`).toBe(true);
      }
    }
  });

  it("rejects a path the grammar does not admit, so the check above can fail", () => {
    const engine = makeEngine();
    const built = engine.submitAction(createdWorld(), "build", { definitionId: "drink-stand", x: 1, y: 1, rotation: 0 });
    const state = kindState(built.value!);

    // A collection path, an invented leaf, and an array index — the three shapes §13 bans.
    for (const path of ["buildings", "buildings.building:0.colour", "buildings.0.isOpen"]) {
      let node: unknown = state;
      let landed = true;
      for (const segment of path.split(".")) {
        if (Array.isArray(node)) {
          node = node.find((entry: { id?: string }) => entry.id === segment);
        } else if (typeof node === "object" && node !== null) {
          node = (node as Record<string, unknown>)[segment];
        } else {
          node = undefined;
        }
        if (node === undefined) { landed = false; break; }
      }
      const scalar = landed && ["string", "number", "boolean"].includes(typeof node);
      expect(scalar, path).toBe(false);
    }
  });

  it("records a purchase as an expense, not only as cash leaving", () => {
    const engine = makeEngine();
    const built = engine.submitAction(createdWorld(), "build", { definitionId: "drink-stand", x: 1, y: 1, rotation: 0 });
    if (!built.ok || built.value === undefined) throw new Error("expected a placed building");
    const hired = engine.submitAction(built.value, "hire_staff", { roleId: "vendor" });
    if (!hired.ok || hired.value === undefined) throw new Error("expected hired staff");

    const finances = kindState(hired.value).finances;
    expect(finances.cashCents).toBe(500);
    expect(finances.expensesTodayCents).toBe(500);
    expect(finances.expensesTotalCents).toBe(500);
    // The accumulators and the cash movement that produced them must agree.
    expect(1_000 - finances.cashCents).toBe(finances.expensesTotalCents);
  });

  it("rejects an unaffordable build without changing state or appending an action", () => {
    const engine = makeEngine();
    const initial = createdWorld();
    const poor = {
      ...initial,
      kindState: { ...kindState(initial), finances: { ...kindState(initial).finances, cashCents: 0 } },
    };
    const result = engine.submitAction(poor, "build", {
      definitionId: "drink-stand",
      x: 1,
      y: 1,
      rotation: 0,
    });

    expect(result.ok).toBe(false);
    expect(result.errors[0]?.code).toBe("insufficient_funds");
    expect(poor.actionLog).toEqual([]);
  });

  it("separates an out-of-bounds placement from an unsuitable one", () => {
    const engine = makeEngine();
    const outside = engine.submitAction(createdWorld(), "build", {
      definitionId: "drink-stand",
      x: 4,
      y: 4,
      rotation: 0,
    });

    expect(outside.errors[0]?.code).toBe("placement_out_of_bounds");
    expect(outside.errors[0]?.messageKey).toBe("world-graph.reason.placement_out_of_bounds");
  });

  it("reports a definition at its scenario cap with its own code, not unknown_entity", () => {
    const capped = campaignWith({
      buildingDefinitions: [{ ...content.buildingDefinitions[0]!, maxCount: 1 }],
    });
    const engine = makeEngine(capped);
    const first = engine.submitAction(createdWorld(capped), "build", { definitionId: "drink-stand", x: 1, y: 1, rotation: 0 });
    if (!first.ok || first.value === undefined) throw new Error("expected a placed building");
    const second = engine.submitAction(first.value, "build", { definitionId: "drink-stand", x: 2, y: 2, rotation: 0 });

    expect(second.ok).toBe(false);
    expect(second.errors[0]).toMatchObject({
      code: "building_limit_reached",
      messageKey: "world-graph.reason.building_limit_reached",
    });
  });

  it("publishes the capped definition as blocked in the projection too", () => {
    const capped = campaignWith({
      buildingDefinitions: [{ ...content.buildingDefinitions[0]!, maxCount: 1 }],
    });
    const engine = makeEngine(capped);
    const built = engine.submitAction(createdWorld(capped), "build", { definitionId: "drink-stand", x: 1, y: 1, rotation: 0 });
    if (!built.ok || built.value === undefined) throw new Error("expected a placed building");

    const view = engine.view(built.value, "player").kindView as WorldGraphView;
    expect(view.buildOptions[0]).toMatchObject({ canBuild: false, blockedBy: ["building_limit_reached"] });
    expect(engine.availableActions(built.value).find((entry) => entry.id === "build")).toMatchObject({
      available: false,
      reasonKey: "world-graph.reason.building_limit_reached",
    });
  });

  it("places a building on the terrain its definition declares, walkable or not", () => {
    // A pier over water: the footprint is unwalkable, and the guests reach its edge.
    const water = campaignWith({
      map: {
        ...map,
        terrain: map.terrain.map((cell) => (cell.x === 3 && cell.y === 0 ? { ...cell, terrain: "water" as const } : cell)),
      },
      buildingDefinitions: [{ ...content.buildingDefinitions[0]!, allowedTerrain: ["water"] }],
    });
    const result = makeEngine(water).submitAction(createdWorld(water), "build", {
      definitionId: "drink-stand",
      x: 3,
      y: 0,
      rotation: 0,
    });

    expect(result.errors[0]?.code).toBeUndefined();
    expect(result.ok).toBe(true);
  });

  it("still rejects a placement no guest can walk up to", () => {
    // Water everywhere but the spawn, so the pier has no walkable neighbour.
    const marooned = campaignWith({
      map: {
        ...map,
        terrain: map.terrain.map((cell) => (cell.x === 0 && cell.y === 0 ? cell : { ...cell, terrain: "water" as const })),
      },
      buildingDefinitions: [{ ...content.buildingDefinitions[0]!, allowedTerrain: ["water"] }],
    });
    const result = makeEngine(marooned).submitAction(createdWorld(marooned), "build", {
      definitionId: "drink-stand",
      x: 3,
      y: 3,
      rotation: 0,
    });

    expect(result.ok).toBe(false);
    expect(result.errors[0]?.code).toBe("placement_unreachable");
  });

  it("rejects an assignment to a zone the map does not declare", () => {
    const engine = makeEngine();
    const hired = engine.submitAction(createdWorld(), "hire_staff", { roleId: "vendor" });
    if (!hired.ok || hired.value === undefined) throw new Error("expected hired staff");
    const result = engine.submitAction(hired.value, "assign_staff", { staffId: "staff:0", zoneId: "zone:nowhere" });

    expect(result.ok).toBe(false);
    expect(result.errors[0]?.code).toBe("unknown_entity");
  });

  it("demolishing detaches guests and dismisses its alerts rather than deleting them", () => {
    const engine = makeEngine();
    const built = engine.submitAction(createdWorld(), "build", { definitionId: "drink-stand", x: 1, y: 1, rotation: 0 });
    if (!built.ok || built.value === undefined) throw new Error("expected a placed building");

    const queueId = kindState(built.value).buildings[0]!.queue.id;
    const withGuest = {
      ...built.value,
      kindState: {
        ...kindState(built.value),
        guests: [{
          id: "guest:9",
          archetypeId: "day-tripper",
          lifecycle: "queued" as const,
          tickEntered: 0,
          x: 0,
          y: 0,
          path: [],
          pathIndex: 0,
          drawCount: 0,
          targetBuildingId: "building:0",
          targetQueueId: queueId,
          targetProductId: "water",
          targetWaitTicks: 10,
          needs: { hunger: 50, rest: 50, social: 50, comfort: 50, hygiene: 50, safety: 50 },
          conditions: { mood: 0, patienceRemainingTicks: 10, lastServedTick: null, spentTicks: 0 },
          opinions: { price: 0, variety: 0, cleanliness: 0, safety: 0, attractiveness: 0, queues: 0, service: 0 },
          preferences: { noiseTolerance: 0, spendingCategory: "balanced" as const, loyaltyMultiplier: 10_000 },
        }],
      },
    };

    const gone = engine.submitAction(withGuest, "demolish", { buildingId: "building:0" });
    if (!gone.ok || gone.value === undefined) throw new Error("expected a demolished building");
    const state = kindState(gone.value);

    expect(state.buildings).toEqual([]);
    expect(state.guests[0]).toMatchObject({
      lifecycle: "seeking",
      targetBuildingId: null,
      targetQueueId: null,
      targetProductId: null,
    });
    expect(state.alerts).toHaveLength(1);
    expect(state.alerts[0]?.dismissedAtTick).toBe(0);
  });

  it("runs each immediate reducer without advancing the tick", () => {
    const engine = makeEngine();
    const built = engine.submitAction(createdWorld(), "build", { definitionId: "drink-stand", x: 1, y: 1, rotation: 0 });
    if (!built.ok || built.value === undefined) throw new Error("expected a placed building");
    const hired = engine.submitAction(built.value, "hire_staff", { roleId: "vendor" });
    if (!hired.ok || hired.value === undefined) throw new Error("expected hired staff");
    const assigned = engine.submitAction(hired.value, "assign_staff", { staffId: "staff:3", buildingId: "building:0" });
    if (!assigned.ok || assigned.value === undefined) throw new Error("expected assigned staff");
    const priced = engine.submitAction(assigned.value, "set_price", { buildingId: "building:0", productId: "water", priceCents: 150 });
    if (!priced.ok || priced.value === undefined) throw new Error("expected price change");
    const closed = engine.submitAction(priced.value, "close_building", { buildingId: "building:0" });
    if (!closed.ok || closed.value === undefined) throw new Error("expected closed building");
    const opened = engine.submitAction(closed.value, "open_building", { buildingId: "building:0" });
    if (!opened.ok || opened.value === undefined) throw new Error("expected opened building");
    const dismissed = engine.submitAction(opened.value, "dismiss_alert", { alertId: "alert:2" });
    if (!dismissed.ok || dismissed.value === undefined) throw new Error("expected dismissed alert");
    const fired = engine.submitAction(dismissed.value, "fire_staff", { staffId: "staff:3" });
    if (!fired.ok || fired.value === undefined) throw new Error("expected fired staff");

    const state = kindState(fired.value);
    expect(state.tick).toBe(0);
    expect(state.buildings[0]?.isOpen).toBe(true);
    expect(state.buildings[0]?.pricesCents.water).toBe(150);
    expect(state.staff).toEqual([]);
    expect(state.alerts[0]?.dismissedAtTick).toBe(0);
  });

  it("keeps every collection in id order, with ordinals compared numerically", () => {
    // Enough buildings to push an ordinal past 9, where a lexicographic comparison would
    // put `building:10` before `building:2` (12 §3.4).
    const rich = campaignWith({ startingFinances: { cashCents: 100_000 } });
    const engine = makeEngine(rich);
    let state = createdWorld(rich);
    const cells = [
      [0, 1], [1, 1], [2, 1], [3, 1],
      [0, 2], [1, 2], [2, 2], [3, 2],
      [0, 3], [1, 3], [2, 3], [3, 3],
    ] as const;
    for (const [x, y] of cells) {
      const result = engine.submitAction(state, "build", { definitionId: "drink-stand", x, y, rotation: 0 });
      if (!result.ok || result.value === undefined) throw new Error("expected a placed building");
      state = result.value;
    }

    const ids = kindState(state).buildings.map((building) => building.id);
    const ordinals = ids.map((id) => Number(id.split(":")[1]));

    expect(ordinals.at(-1)).toBeGreaterThan(9);
    expect(ordinals).toEqual([...ordinals].sort((a, b) => a - b));
    // The trap the numeric rule exists for: a string sort disagrees with this order.
    expect(ids).not.toEqual([...ids].sort());
  });
});

describe("worldGraphKind — status and outcome", () => {
  it("stays active when a campaign declares no objectives", () => {
    const sandbox = campaignWith({ objectiveDefinitions: [] });
    const created = createdWorld(sandbox);

    expect(created.status).toBe("active");
    expect(worldGraphKind.outcome(kindState(created))).toMatchObject({ resolution: null });
  });

  it("ends on a failed objective without waiting for the others to settle", () => {
    const created = createdWorld();
    const failing = {
      ...kindState(created),
      objectives: [
        { id: "stay-open", state: "failed" as const, value: 0, target: 1, updatedAtTick: 4 },
        { id: "still-going", state: "active" as const, value: 0, target: 9, updatedAtTick: 4 },
      ],
    };

    expect(worldGraphKind.outcome(failing)).toMatchObject({
      resolution: "failed",
      failureId: "stay-open",
    });
  });

  it("warns at Tier 2 about a campaign that can never resolve", () => {
    const result = validate(campaignWith({ objectiveDefinitions: [] }));

    expect(result.ok).toBe(true);
    expect(result.warnings[0]?.path).toBe("objectiveDefinitions");
  });

  it("warns at Tier 2 about a campaign already resolved at tick 0", () => {
    const result = validate(campaignWith({ objectiveDefinitions: [{ id: "free", target: 0 }] }));

    expect(result.ok).toBe(true);
    expect(result.warnings[0]?.path).toBe("objectiveDefinitions");
  });
});

describe("worldGraphKind — validation", () => {
  it("accepts the reference campaign with no errors", () => {
    expect(validate(campaign).ok).toBe(true);
  });

  it("rejects a non-positive ticksPerDay", () => {
    const result = validate(campaignWith({ ticksPerDay: 0 }));

    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.path === "ticksPerDay")).toBe(true);
  });

  it("rejects a default price outside its own band", () => {
    const result = validate(campaignWith({
      buildingDefinitions: [{
        ...content.buildingDefinitions[0]!,
        products: [{ id: "water", defaultPriceCents: 500, priceRange: { minCents: 100, maxCents: 200 } }],
      }],
    }));

    expect(result.ok).toBe(false);
  });

  it("rejects a pre-placed building that leaves the map", () => {
    const result = validate(campaignWith({
      startingBuildings: [{ definitionId: "drink-stand", x: 9, y: 9, rotation: 0 }],
    }));

    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.path === "startingBuildings.0.position")).toBe(true);
  });

  it("rejects two pre-placed buildings sharing a tile", () => {
    const result = validate(campaignWith({
      startingBuildings: [
        { definitionId: "drink-stand", x: 1, y: 1, rotation: 0 },
        { definitionId: "drink-stand", x: 1, y: 1, rotation: 0 },
      ],
    }));

    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.path === "startingBuildings.1.overlap")).toBe(true);
  });

  it("rejects a pre-placed building whose definition does not exist", () => {
    const result = validate(campaignWith({
      startingBuildings: [{ definitionId: "no-such-thing", x: 1, y: 1, rotation: 0 }],
    }));

    expect(result.ok).toBe(false);
  });

  it("rejects duplicate objective ids", () => {
    const result = validate(campaignWith({
      objectiveDefinitions: [{ id: "stay-open", target: 1 }, { id: "stay-open", target: 2 }],
    }));

    expect(result.ok).toBe(false);
  });
});

describe("worldGraphKind — advance_ticks", () => {
  it("advances only a positive count within the campaign batch cap", () => {
    const engine = makeEngine();
    const result = engine.submitAction(createdWorld(), "advance_ticks", { ticks: 3 });

    expect(result.ok).toBe(true);
    if (!result.ok || result.value === undefined) throw new Error("expected tick advance");
    expect(kindState(result.value).tick).toBe(3);

    const tooMany = engine.submitAction(createdWorld(), "advance_ticks", { ticks: 4 });
    expect(tooMany.ok).toBe(false);
    expect(tooMany.errors[0]?.code).toBe("tick_limit_reached");
  });

  it("reaches the same kindState however the batch is split (§5)", () => {
    const engine = makeEngine();
    const split = engine.submitAction(
      engine.submitAction(createdWorld(), "advance_ticks", { ticks: 1 }).value!,
      "advance_ticks",
      { ticks: 2 },
    );
    const whole = engine.submitAction(createdWorld(), "advance_ticks", { ticks: 3 });

    expect(kindState(split.value!)).toEqual(kindState(whole.value!));
  });
});
