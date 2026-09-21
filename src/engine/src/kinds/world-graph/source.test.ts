import { describe, expect, it } from "vitest";
import { worldGraphMvpSource } from "../../campaigns/world-graph-mvp.js";
import { buildWorldGraphCampaign } from "./source.js";

describe("buildWorldGraphCampaign", () => {
  it("canonicalizes runtime catalog order and collection fields without mutating authored source", () => {
    const source = {
      ...worldGraphMvpSource,
      terrain: worldGraphMvpSource.terrain.map((terrain) => ({ ...terrain, tags: ["zebra", "alpha", "zebra"] })),
      buildings: [...worldGraphMvpSource.buildings].reverse(),
      staffRoles: [...worldGraphMvpSource.staffRoles].reverse(),
      scenarios: worldGraphMvpSource.scenarios.map((scenario) => ({
        ...scenario,
        unlockedContent: [...scenario.unlockedContent].reverse(),
        buildingLimits: [...scenario.buildingLimits].reverse(),
        staffLimits: [...scenario.staffLimits].reverse(),
      })),
    };
    const before = structuredClone(source);

    const built = buildWorldGraphCampaign(source);

    expect(built.content.terrain[0]?.tags).toEqual(["alpha", "zebra", "zebra"]);
    expect(built.content.buildings.map((entry) => entry.id)).toEqual(["hut", "kiosk", "stall"]);
    expect(built.content.staffRoles.map((entry) => entry.id)).toEqual(["builder", "cleaner", "restocker"]);
    expect(built.content.scenarios[0]?.unlockedContent).toEqual([
      { kind: "building", id: "hut" },
      { kind: "building", id: "kiosk" },
      { kind: "building", id: "stall" },
      { kind: "staff_role", id: "builder" },
      { kind: "staff_role", id: "cleaner" },
      { kind: "staff_role", id: "restocker" },
    ]);
    expect(built.content.scenarios[0]?.buildingLimits.map((entry) => entry.definitionId)).toEqual(["hut", "kiosk", "stall"]);
    expect(built.content.scenarios[0]?.staffLimits.map((entry) => entry.definitionId)).toEqual(["builder", "cleaner", "restocker"]);
    expect(source).toEqual(before);
  });
});
