import { describe, expect, it } from "vitest";
import { createEngine } from "../../core/kernel/engine.js";
import type { KindRegistry } from "../../core/kernel/types.js";
import type { EngineHost } from "../../core/composition/types.js";
import type { Campaign, ContentRegistry } from "../../core/registry/types.js";
import type { WorldGraphCampaign } from "./campaign.js";
import { worldGraphKind } from "./kind.js";
import type { WorldGraphKindState } from "./state.js";

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

function makeEngine() {
  const registry: ContentRegistry = {
    campaigns: new Map([[campaign.id, campaign]]),
    strings: new Map(),
  };
  const host: EngineHost = {
    registry,
    kinds: { "world-graph": worldGraphKind } as unknown as KindRegistry,
    ids: { newGameId: () => "game:world", newSeed: () => "world-seed" },
  };
  return createEngine(host);
}

function createdWorld() {
  const created = makeEngine().createGame({ campaignId: campaign.id });
  if (!created.ok || created.value === undefined) throw new Error("expected a new world");
  return created.value;
}

function kindState(state: { kindState: unknown }): WorldGraphKindState {
  return state.kindState as WorldGraphKindState;
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

    expect(action).toMatchObject({ available: true });
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
});
