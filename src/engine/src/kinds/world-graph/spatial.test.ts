import { describe, expect, it } from "vitest";
import type { BuildingDefinition, MapDefinition, TerrainDefinition } from "./content.js";
import { canonicalPath, checkBuildingPlacement, materializeMap, rotateOffset, rotatedDimensions } from "./spatial.js";

const text = { nameKey: "world.name", descriptionKey: "world.description" };
const terrain: TerrainDefinition = { id: "sand", text, walkable: true, buildable: true, moveCost: 1, tags: [] };
const mapDefinition: MapDefinition = {
  id: "map", text, width: 3, height: 2, defaultTerrainId: "sand", terrainOverrides: [],
  topology: { kind: "orthogonal_grid" }, zones: [], spawnPoints: [{ x: 0, y: 0 }],
  exits: [{ x: 2, y: 1 }], tags: [],
};
const building: BuildingDefinition = {
  id: "shop", text, footprint: { width: 2, height: 1 }, entrances: [{ x: -1, y: 0 }],
  allowedRotations: [0, 90, 180, 270], constructionCostCents: 0, constructionWork: 0,
  constructionTaskPriority: 0, operatingCostCentsPerDay: 0, initialWear: 100,
  initialCleanliness: 100, placementRules: [{ kind: "terrain", terrainIds: ["sand"] }],
  adjacencyEffects: [], operation: { kind: "decorative" }, tags: [],
};

describe("world-graph spatial substrate", () => {
  it("uses the exact integer rotation transform", () => {
    expect(rotatedDimensions(2, 1, 90)).toEqual({ width: 1, height: 2 });
    expect(rotateOffset({ x: -1, y: 0 }, 2, 1, 0)).toEqual({ x: -1, y: 0 });
    expect(rotateOffset({ x: -1, y: 0 }, 2, 1, 90)).toEqual({ x: 0, y: -1 });
    expect(rotateOffset({ x: -1, y: 0 }, 2, 1, 180)).toEqual({ x: 2, y: 0 });
    expect(rotateOffset({ x: -1, y: 0 }, 2, 1, 270)).toEqual({ x: 0, y: 2 });
  });

  it("materializes canonical directed orthogonal edges and finds a stable path", () => {
    const map = materializeMap(mapDefinition);
    expect(map.terrain).toHaveLength(6);
    expect(map.paths[0]).toEqual({ from: { x: 0, y: 0 }, to: { x: 1, y: 0 }, edgeCost: 0, allowed: true });
    expect(canonicalPath(map, [terrain], { x: 0, y: 0 }, [{ x: 2, y: 1 }], [], [])).toEqual([
      { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 1 },
    ]);
  });

  it("shares placement bounds, terrain, overlap, entrance and reachability rules", () => {
    const map = materializeMap(mapDefinition);
    expect(checkBuildingPlacement(map, [terrain], building, 2, 1, 0, [], [])).toMatchObject({ ok: false, reason: "placement_out_of_bounds" });
    expect(checkBuildingPlacement(map, [terrain], building, 1, 0, 0, [], [])).toMatchObject({ ok: true, entrances: [{ x: 0, y: 0 }] });
  });
});
