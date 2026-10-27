import { describe, expect, it } from "vitest";
import { Pcg32 } from "../../core/determinism/pcg32.js";
import type { MapDefinition, TerrainDefinition } from "./content.js";
import { canonicalPathWithCost, materializeMap, type CanonicalPathResult } from "./spatial.js";
import type { Building, ConstructionSite, PathCell, Position, WorldMap } from "./state.js";

// The search as it stood before the neighbour index and the binary-heap open list: a full
// sort of the open list per expansion and a scan of every edge per expanded cell. Kept
// verbatim as the oracle, so §9.3's committed path is shown unchanged rather than assumed.
const key = (position: Position): string => `${position.x},${position.y}`;
const comparePosition = (a: Position, b: Position): number => a.y - b.y || a.x - b.x;

function footprintCells(x: number, y: number, width: number, height: number): readonly Position[] {
  const cells: Position[] = [];
  for (let cy = y; cy < y + height; cy += 1) {
    for (let cx = x; cx < x + width; cx += 1) cells.push({ x: cx, y: cy });
  }
  return cells;
}

function occupiedCells(buildings: readonly Building[], sites: readonly ConstructionSite[]): Set<string> {
  const occupied = new Set<string>();
  for (const entity of [...buildings, ...sites]) {
    for (const cell of footprintCells(entity.x, entity.y, entity.width, entity.height)) occupied.add(key(cell));
  }
  return occupied;
}

function traversable(
  terrain: ReadonlyMap<string, TerrainDefinition>,
  terrainByCell: ReadonlyMap<string, string>,
  blocked: ReadonlySet<string>,
  position: Position,
): boolean {
  const terrainId = terrainByCell.get(key(position));
  return !blocked.has(key(position)) && terrainId !== undefined && terrain.get(terrainId)?.walkable === true;
}

function referenceCanonicalPathWithCost(
  map: WorldMap,
  terrainDefinitions: readonly TerrainDefinition[],
  start: Position,
  goals: readonly Position[],
  buildings: readonly Building[],
  sites: readonly ConstructionSite[],
  additionallyBlocked: readonly Position[] = [],
): CanonicalPathResult | null {
  const terrain = new Map(terrainDefinitions.map((entry) => [entry.id, entry]));
  const terrainByCell = new Map(map.terrain.map((cell) => [key(cell), cell.terrainId]));
  const blocked = occupiedCells(buildings, sites);
  for (const position of additionallyBlocked) blocked.add(key(position));
  const orderedGoals = [...goals].filter((goal) => traversable(terrain, terrainByCell, blocked, goal)).sort(comparePosition);
  const goalKeys = new Set(orderedGoals.map(key));
  if (!traversable(terrain, terrainByCell, blocked, start) || orderedGoals.length === 0) return null;

  const open: Array<{ position: Position; cost: number }> = [{ position: start, cost: 0 }];
  const cost = new Map([[key(start), 0]]);
  const parent = new Map<string, Position>();
  while (open.length > 0) {
    open.sort((a, b) => a.cost - b.cost || comparePosition(a.position, b.position));
    const current = open.shift();
    if (!current || current.cost !== cost.get(key(current.position))) continue;
    if (goalKeys.has(key(current.position))) {
      const result: Position[] = [current.position];
      let cursor = current.position;
      while (parent.has(key(cursor))) {
        cursor = parent.get(key(cursor)) as Position;
        result.push(cursor);
      }
      return { path: result.reverse(), cost: current.cost };
    }
    const outgoing = map.paths
      .filter((edge) => edge.allowed && key(edge.from) === key(current.position))
      .sort((a, b) => comparePosition(a.to, b.to));
    for (const edge of outgoing) {
      if (!traversable(terrain, terrainByCell, blocked, edge.to)) continue;
      const terrainId = terrainByCell.get(key(edge.to));
      const nextCost = current.cost + edge.edgeCost + (terrainId === undefined ? 0 : terrain.get(terrainId)?.moveCost ?? 0);
      const previous = cost.get(key(edge.to));
      const previousParent = parent.get(key(edge.to));
      if (previous === undefined || nextCost < previous || (nextCost === previous && previousParent !== undefined && comparePosition(current.position, previousParent) < 0)) {
        cost.set(key(edge.to), nextCost);
        parent.set(key(edge.to), current.position);
        open.push({ position: edge.to, cost: nextCost });
      }
    }
  }
  return null;
}

const terrainOf = (id: string, walkable: boolean, moveCost: number): TerrainDefinition =>
  ({ id, text: { nameKey: `terrain.${id}.name`, descriptionKey: `terrain.${id}.description` }, walkable, buildable: walkable, moveCost, tags: [] }) as TerrainDefinition;
const grass = terrainOf("grass", true, 1);
const mud = terrainOf("mud", true, 3);
const boardwalk = terrainOf("boardwalk", true, 0);
const water = terrainOf("water", false, 1);
const terrains = [grass, mud, boardwalk, water];

const mapOf = (definition: Partial<MapDefinition> & Pick<MapDefinition, "width" | "height">): WorldMap =>
  materializeMap({
    id: "equivalence",
    text: { nameKey: "map.equivalence" },
    defaultTerrainId: "grass",
    terrainOverrides: [],
    topology: { kind: "orthogonal_grid" },
    zones: [],
    spawnPoints: [],
    exits: [],
    tags: [],
    ...definition,
  } as MapDefinition);

/** Only the footprint fields reach the search, so a footprint stands in for a whole entity. */
const footprint = (x: number, y: number, width: number, height: number) => ({ x, y, width, height });
const building = (x: number, y: number, width: number, height: number) => footprint(x, y, width, height) as Building;
const site = (x: number, y: number, width: number, height: number) => footprint(x, y, width, height) as ConstructionSite;

type SearchArgs = Parameters<typeof canonicalPathWithCost>;

function expectSameAsReference(...args: SearchArgs): CanonicalPathResult | null {
  const result = canonicalPathWithCost(...args);
  expect(result).toEqual(referenceCanonicalPathWithCost(...args));
  return result;
}

describe("canonicalPathWithCost matches the sort-and-scan search it replaced (20-contract.md §9.3)", () => {
  it("chooses the row-major-smallest predecessor among equal-cost routes", () => {
    const map = mapOf({ width: 4, height: 4 });
    expect(expectSameAsReference(map, terrains, { x: 0, y: 0 }, [{ x: 3, y: 3 }], [], [])).toEqual({
      path: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 1 }, { x: 3, y: 2 }, { x: 3, y: 3 }],
      cost: 6,
    });
  });

  it("replaces an equal-cost parent only with a row-major-smaller predecessor reached later", () => {
    // (1,1) is reached at cost 4 both from (2,1), popped first at g 1, and from (1,0), popped
    // later at g 3. (1,0) is row-major smaller, so it takes over as the parent.
    const map = mapOf({
      width: 3,
      height: 2,
      topology: {
        kind: "explicit",
        edges: [
          { from: { x: 0, y: 0 }, to: { x: 2, y: 1 }, edgeCost: 1, allowed: true },
          { from: { x: 0, y: 0 }, to: { x: 1, y: 0 }, edgeCost: 3, allowed: true },
          { from: { x: 2, y: 1 }, to: { x: 1, y: 1 }, edgeCost: 3, allowed: true },
          { from: { x: 1, y: 0 }, to: { x: 1, y: 1 }, edgeCost: 1, allowed: true },
        ],
      },
      defaultTerrainId: "boardwalk",
    });
    expect(expectSameAsReference(map, terrains, { x: 0, y: 0 }, [{ x: 1, y: 1 }], [], [])).toEqual({
      path: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }],
      cost: 4,
    });
  });

  it("returns the cheapest goal, and the row-major-smallest among equally cheap goals", () => {
    const map = mapOf({ width: 3, height: 3, terrainOverrides: [{ position: { x: 0, y: 1 }, terrainId: "mud" }] });
    const start = { x: 1, y: 1 };
    // (0,1) is row-major smallest but costs 3 to enter; (1,0) and (2,1) cost 1, and (1,0) wins.
    expect(expectSameAsReference(map, terrains, start, [{ x: 2, y: 1 }, { x: 0, y: 1 }, { x: 1, y: 0 }], [], [])).toEqual({
      path: [start, { x: 1, y: 0 }],
      cost: 1,
    });
    expect(expectSameAsReference(map, terrains, start, [{ x: 1, y: 2 }, { x: 2, y: 1 }], [], [])).toEqual({
      path: [start, { x: 2, y: 1 }],
      cost: 1,
    });
  });

  it("returns null for a blocked start, blocked or unwalkable goals, and an unreachable goal", () => {
    const map = mapOf({
      width: 5,
      height: 3,
      terrainOverrides: [0, 1, 2].map((y) => ({ position: { x: 2, y }, terrainId: "water" })),
    });
    const start = { x: 0, y: 0 };
    expect(expectSameAsReference(map, terrains, start, [{ x: 4, y: 2 }], [], [])).toBeNull();
    expect(expectSameAsReference(map, terrains, start, [{ x: 2, y: 1 }], [], [])).toBeNull();
    expect(expectSameAsReference(map, terrains, start, [{ x: 1, y: 2 }], [building(0, 2, 2, 1)], [])).toBeNull();
    expect(expectSameAsReference(map, terrains, start, [{ x: 1, y: 2 }], [], [site(1, 1, 1, 2)])).toBeNull();
    expect(expectSameAsReference(map, terrains, start, [{ x: 1, y: 2 }], [], [], [{ x: 1, y: 2 }])).toBeNull();
    expect(expectSameAsReference(map, terrains, start, [{ x: 1, y: 2 }], [], [], [start])).toBeNull();
    // Walling the goal in leaves it walkable but unreachable.
    expect(expectSameAsReference(map, terrains, start, [{ x: 0, y: 2 }], [building(0, 1, 2, 1)], [], [{ x: 1, y: 2 }])).toBeNull();
  });

  it("skips the stale entry when an already-enqueued cell is reached again more cheaply", () => {
    // (0,1) is enqueued at 10 straight from the start, then improved to 2 through (1,0).
    const map = mapOf({
      width: 2,
      height: 2,
      topology: {
        kind: "explicit",
        edges: [
          { from: { x: 0, y: 0 }, to: { x: 0, y: 1 }, edgeCost: 10, allowed: true },
          { from: { x: 0, y: 0 }, to: { x: 1, y: 0 }, edgeCost: 1, allowed: true },
          { from: { x: 1, y: 0 }, to: { x: 0, y: 1 }, edgeCost: 1, allowed: true },
          { from: { x: 1, y: 0 }, to: { x: 1, y: 1 }, edgeCost: 5, allowed: true },
          { from: { x: 0, y: 1 }, to: { x: 1, y: 1 }, edgeCost: 1, allowed: true },
        ],
      },
      defaultTerrainId: "boardwalk",
    });
    expect(expectSameAsReference(map, terrains, { x: 0, y: 0 }, [{ x: 1, y: 1 }], [], [])).toEqual({
      path: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }],
      cost: 3,
    });
  });

  it("agrees on seeded grids and explicit graphs, including blocked cells and several goals", () => {
    const outcomes = { reachable: 0, unreachable: 0 };
    for (let seed = 0; seed < 400; seed += 1) {
      const rng = Pcg32.seed(BigInt(seed), 0x5eedn);
      const below = (bound: number) => rng.next() % bound;
      const cell = (width: number, height: number): Position => ({ x: below(width), y: below(height) });
      const width = 1 + below(10);
      const height = 1 + below(10);
      const explicit = seed % 2 === 1;
      // An orthogonal grid's edges cost 0, so every walkable terrain on it must cost at least
      // 1 to enter (Tier 1's positive-step rule); an explicit graph's edges always cost at least 1.
      const palette = explicit ? ["grass", "mud", "boardwalk", "water"] : ["grass", "mud", "water"];
      const terrainOverrides = Array.from({ length: below(width * height) }, () => ({
        position: cell(width, height),
        terrainId: palette[below(palette.length)] as string,
      }));
      const edges: PathCell[] = explicit
        ? Array.from({ length: below(width * height * 4) }, () => ({
            from: cell(width, height),
            to: cell(width, height),
            edgeCost: 1 + below(4),
            allowed: below(5) !== 0,
          }))
        : [];
      const materialized = mapOf({
        width,
        height,
        terrainOverrides,
        topology: explicit ? { kind: "explicit", edges } : { kind: "orthogonal_grid" },
      });
      // materializeMap sorts its edges, but a state read back from storage carries whatever
      // order it was written in, so every other map searches a shuffled edge list.
      const paths = [...materialized.paths];
      if (seed % 4 >= 2) {
        for (let i = paths.length - 1; i > 0; i -= 1) {
          const j = below(i + 1);
          [paths[i], paths[j]] = [paths[j] as PathCell, paths[i] as PathCell];
        }
      }
      const map: WorldMap = { ...materialized, paths };
      const entity = () => {
        const origin = cell(width, height);
        return footprint(origin.x, origin.y, 1 + below(2), 1 + below(2));
      };
      const buildings = Array.from({ length: below(3) }, entity) as Building[];
      const sites = Array.from({ length: below(2) }, entity) as ConstructionSite[];
      const extra = Array.from({ length: below(3) }, () => cell(width, height));
      const goals = Array.from({ length: 1 + below(3) }, () => cell(width, height));

      const result = expectSameAsReference(map, terrains, cell(width, height), goals, buildings, sites, extra);
      outcomes[result === null ? "unreachable" : "reachable"] += 1;
    }
    expect(outcomes.reachable).toBeGreaterThan(100);
    expect(outcomes.unreachable).toBeGreaterThan(50);
  });
});
