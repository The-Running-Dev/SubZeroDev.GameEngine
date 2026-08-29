import { describe, expect, it } from "vitest";
import type { RngHandle } from "../../../core/determinism/types.js";
import type { WorldGraphCampaign, WorldEffect } from "../content.js";
import type { WorldGraphKindState } from "../state.js";
import { applyWorldEffects } from "./effects.js";
import { BatchChanges } from "./changes.js";
import { createTickRandom } from "./random.js";
import { createTickScratch } from "./scratch.js";

function rngHandle(): RngHandle {
  return { nextInt: (minimum) => minimum, nextPercent: () => 0, pick: (items) => items[0]!, weightedPick: (items) => items[0]!.item };
}

function state(): WorldGraphKindState {
  return {
    tick: 0,
    map: { width: 1, height: 1, revision: 0, terrain: [{ x: 0, y: 0, terrainId: "sand" }], paths: [], zones: [], spawnPoints: [{ x: 0, y: 0 }], exits: [{ x: 0, y: 0 }], scenery: [] },
    finances: { cashCents: 100, revenueTodayCents: 0, expensesTodayCents: 0, revenueTotalCents: 0, expensesTotalCents: 0, loan: null },
    buildings: [{
      id: "building:0", definitionId: "kiosk", x: 0, y: 0, width: 1, height: 1, rotation: 0,
      status: "open", buildStartTick: 0, wear: 50, cleanliness: 50,
      queue: { id: "queue:1", guestIds: [], serviceStartedAtTick: null }, pricesCents: {}, inventory: {},
    }],
    constructionSites: [], guests: [], staff: [], incidents: [],
    objectives: [], failures: [], alerts: [], resolution: null,
    counters: { guestsEntered: 0, guestsDeparted: 0, guestsDissatisfied: 0, servicesCompleted: 0, buildingsCompleted: 0, incidentsRaised: 0, litterCreated: 0, litterCleaned: 0 },
    unlockedContent: [], activePolicyIds: [], unlockedAchievementIds: [], nextEntityOrdinal: 1,
  };
}

function content(): WorldGraphCampaign {
  return {
    startScenarioId: "opening", ticksPerDay: 10, maxTicksPerAction: 10,
    maps: [], terrain: [], scenery: [], needs: [], guestConditions: [], opinions: [], preferences: [],
    products: [], buildings: [], guestArchetypes: [], staffRoles: [], incidents: [], objectives: [],
    failures: [], policies: [], achievements: [], scenarios: [],
  } as unknown as WorldGraphCampaign;
}

function context(overrides: Partial<Parameters<typeof applyWorldEffects>[2]> = {}): { readonly ctx: Parameters<typeof applyWorldEffects>[2]; readonly changes: BatchChanges } {
  const scratch = createTickScratch();
  const changes = new BatchChanges();
  return {
    changes,
    ctx: {
      processingTick: 0,
      content: content(),
      random: createTickRandom(0, () => rngHandle(), scratch),
      changes,
      system: "finance",
      reason: "test_reason",
      ...overrides,
    },
  };
}

describe("world-graph W93.4 applyWorldEffects: deferred and non-deferred building meters", () => {
  it("applies a building_meter_delta immediately, clamped, when no defer context is given", () => {
    const effects: WorldEffect[] = [{ kind: "building_meter_delta", meter: "cleanliness", delta: 60, buildings: { kind: "all" } }];
    const { ctx, changes } = context();
    const { state: result, applied } = applyWorldEffects(state(), effects, ctx);
    expect(result.buildings[0]?.cleanliness).toBe(100);
    expect(applied).toEqual([true]);
    expect(changes.finish()).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: "buildings.building:0.cleanliness", value: 100, previous: 50 }),
    ]));
  });

  it("defers a building_meter_delta to the scratch queue instead of touching the building, when a defer context is given", () => {
    const effects: WorldEffect[] = [{ kind: "building_meter_delta", meter: "wear", delta: -20, buildings: { kind: "all" } }];
    const scratch = createTickScratch();
    const { ctx, changes } = context({ deferBuildingMeters: { scratch, source: "service" } });
    const before = state();
    const { state: result, applied } = applyWorldEffects(before, effects, ctx);
    expect(result.buildings[0]?.wear).toBe(50);
    expect(applied).toEqual([true]);
    expect(scratch.deferredBuildingMeterDeltas).toEqual([{ source: "service", buildingId: "building:0", meter: "wear", delta: -20 }]);
    expect(changes.finish().some((entry: { path: string }) => entry.path === "buildings.building:0.wear")).toBe(false);
  });

  it("does not defer or apply a building meter delta that nets to zero across duplicate effects", () => {
    const effects: WorldEffect[] = [
      { kind: "building_meter_delta", meter: "wear", delta: 10, buildings: { kind: "all" } },
      { kind: "building_meter_delta", meter: "wear", delta: -10, buildings: { kind: "all" } },
    ];
    const scratch = createTickScratch();
    const { ctx } = context({ deferBuildingMeters: { scratch, source: "policy" } });
    const { state: result, applied } = applyWorldEffects(state(), effects, ctx);
    expect(result.buildings[0]?.wear).toBe(50);
    expect(applied).toEqual([false, false]);
    expect(scratch.deferredBuildingMeterDeltas).toEqual([]);
  });
});
