import type {
  BuildingDefinition,
  MapDefinition,
  PlacementRule,
  SceneryDefinition,
  TerrainDefinition,
} from "./content.js";
import type {
  Building,
  ConstructionSite,
  PathCell,
  Position,
  Rotation,
  TerrainCell,
  WorldMap,
} from "./state.js";

export type PlacementFailure =
  | "placement_out_of_bounds"
  | "placement_terrain_unsuitable"
  | "placement_overlaps"
  | "placement_unreachable";
export type PlacementResult =
  | { readonly ok: true; readonly width: number; readonly height: number; readonly entrances: readonly Position[] }
  | { readonly ok: false; readonly reason: PlacementFailure };

const key = (position: Position): string => `${position.x},${position.y}`;
const comparePosition = (a: Position, b: Position): number => a.y - b.y || a.x - b.x;

export function rotatedDimensions(width: number, height: number, rotation: Rotation): { readonly width: number; readonly height: number } {
  return rotation === 90 || rotation === 270 ? { width: height, height: width } : { width, height };
}

export function rotateOffset(offset: Position, width: number, height: number, rotation: Rotation): Position {
  switch (rotation) {
    case 0: return offset;
    case 90: return { x: height - 1 - offset.y, y: offset.x };
    case 180: return { x: width - 1 - offset.x, y: height - 1 - offset.y };
    case 270: return { x: offset.y, y: width - 1 - offset.x };
  }
}

export function footprintCells(x: number, y: number, width: number, height: number): readonly Position[] {
  const cells: Position[] = [];
  for (let cy = y; cy < y + height; cy += 1) {
    for (let cx = x; cx < x + width; cx += 1) cells.push({ x: cx, y: cy });
  }
  return cells;
}

function inBounds(width: number, height: number, position: Position): boolean {
  return position.x >= 0 && position.y >= 0 && position.x < width && position.y < height;
}

export function materializeMap(definition: MapDefinition): WorldMap {
  const overrides = new Map(definition.terrainOverrides.map((entry) => [key(entry.position), entry.terrainId]));
  const terrain: TerrainCell[] = [];
  for (let y = 0; y < definition.height; y += 1) {
    for (let x = 0; x < definition.width; x += 1) {
      terrain.push({ x, y, terrainId: overrides.get(`${x},${y}`) ?? definition.defaultTerrainId });
    }
  }

  const paths: PathCell[] = definition.topology.kind === "explicit"
    ? [...definition.topology.edges].sort((a, b) => comparePosition(a.from, b.from) || comparePosition(a.to, b.to))
    : terrain.flatMap((cell) => [
        { x: cell.x, y: cell.y - 1 },
        { x: cell.x - 1, y: cell.y },
        { x: cell.x + 1, y: cell.y },
        { x: cell.x, y: cell.y + 1 },
      ].filter((to) => inBounds(definition.width, definition.height, to))
        .sort(comparePosition)
        .map((to) => ({ from: { x: cell.x, y: cell.y }, to, edgeCost: 0, allowed: true })));

  return {
    width: definition.width,
    height: definition.height,
    revision: 0,
    terrain,
    paths,
    zones: definition.zones.map((zone) => ({
      id: zone.id,
      nameKey: zone.text.nameKey,
      cells: zone.cells,
      serviceRadius: zone.serviceRadius,
      maxOccupancy: zone.maxOccupancy,
    })),
    spawnPoints: definition.spawnPoints,
    exits: definition.exits,
    scenery: [],
  };
}

function occupiedCells(buildings: readonly Building[], sites: readonly ConstructionSite[]): Set<string> {
  const occupied = new Set<string>();
  for (const entity of [...buildings, ...sites]) {
    for (const cell of footprintCells(entity.x, entity.y, entity.width, entity.height)) occupied.add(key(cell));
  }
  return occupied;
}

function terrainIndex(map: WorldMap): Map<string, string> {
  return new Map(map.terrain.map((cell) => [key(cell), cell.terrainId]));
}

function ruleAllows(
  rule: PlacementRule,
  cells: readonly Position[],
  map: WorldMap,
  terrainByCell: ReadonlyMap<string, string>,
): boolean {
  if (rule.kind === "terrain") return cells.every((cell) => rule.terrainIds.includes(terrainByCell.get(key(cell)) ?? ""));
  if (rule.kind === "adjacent_to_terrain") {
    let edges = 0;
    const footprint = new Set(cells.map(key));
    for (const cell of cells) {
      for (const next of [{ x: cell.x, y: cell.y - 1 }, { x: cell.x - 1, y: cell.y }, { x: cell.x + 1, y: cell.y }, { x: cell.x, y: cell.y + 1 }]) {
        if (!footprint.has(key(next)) && rule.terrainIds.includes(terrainByCell.get(key(next)) ?? "")) edges += 1;
      }
    }
    return edges >= rule.minimumEdges;
  }
  const zoneCells = new Set(map.zones.filter((zone) => rule.zoneIds.includes(zone.id)).flatMap((zone) => zone.cells.map(key)));
  if (rule.kind === "zone") {
    const everyInside = cells.every((cell) => zoneCells.has(key(cell)));
    return rule.mode === "inside" ? everyInside : cells.every((cell) => !zoneCells.has(key(cell)));
  }
  const targetCells = map.zones.filter((zone) => rule.zoneIds.includes(zone.id)).flatMap((zone) => zone.cells);
  if (targetCells.length === 0) return false;
  const distance = Math.min(...cells.flatMap((cell) => targetCells.map((target) => Math.abs(cell.x - target.x) + Math.abs(cell.y - target.y))));
  return distance >= rule.minimumTiles && (rule.maximumTiles === null || distance <= rule.maximumTiles);
}

function traversable(
  map: WorldMap,
  terrain: ReadonlyMap<string, TerrainDefinition>,
  blocked: ReadonlySet<string>,
  position: Position,
): boolean {
  const terrainId = terrainIndex(map).get(key(position));
  return !blocked.has(key(position)) && terrainId !== undefined && terrain.get(terrainId)?.walkable === true;
}

export function canonicalPath(
  map: WorldMap,
  terrainDefinitions: readonly TerrainDefinition[],
  start: Position,
  goals: readonly Position[],
  buildings: readonly Building[],
  sites: readonly ConstructionSite[],
  additionallyBlocked: readonly Position[] = [],
): readonly Position[] | null {
  const terrain = new Map(terrainDefinitions.map((entry) => [entry.id, entry]));
  const terrainByCell = terrainIndex(map);
  const blocked = occupiedCells(buildings, sites);
  for (const position of additionallyBlocked) blocked.add(key(position));
  const orderedGoals = [...goals].filter((goal) => traversable(map, terrain, blocked, goal)).sort(comparePosition);
  const goalKeys = new Set(orderedGoals.map(key));
  if (!traversable(map, terrain, blocked, start) || orderedGoals.length === 0) return null;

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
      return result.reverse();
    }
    const outgoing = map.paths
      .filter((edge) => edge.allowed && key(edge.from) === key(current.position))
      .sort((a, b) => comparePosition(a.to, b.to));
    for (const edge of outgoing) {
      if (!traversable(map, terrain, blocked, edge.to)) continue;
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

export function checkBuildingPlacement(
  map: WorldMap,
  terrainDefinitions: readonly TerrainDefinition[],
  definition: BuildingDefinition,
  x: number,
  y: number,
  rotation: Rotation,
  buildings: readonly Building[],
  sites: readonly ConstructionSite[],
): PlacementResult {
  const size = rotatedDimensions(definition.footprint.width, definition.footprint.height, rotation);
  const cells = footprintCells(x, y, size.width, size.height);
  if (!cells.every((cell) => inBounds(map.width, map.height, cell))) return { ok: false, reason: "placement_out_of_bounds" };
  const occupied = occupiedCells(buildings, sites);
  if (cells.some((cell) => occupied.has(key(cell)))) return { ok: false, reason: "placement_overlaps" };
  const byCell = terrainIndex(map);
  const terrain = new Map(terrainDefinitions.map((entry) => [entry.id, entry]));
  if (cells.some((cell) => terrain.get(byCell.get(key(cell)) ?? "")?.buildable !== true)) return { ok: false, reason: "placement_terrain_unsuitable" };
  if (!definition.placementRules.every((rule) => ruleAllows(rule, cells, map, byCell))) return { ok: false, reason: "placement_terrain_unsuitable" };
  const entrances = definition.entrances
    .map((offset) => rotateOffset(offset, definition.footprint.width, definition.footprint.height, rotation))
    .map((offset) => ({ x: x + offset.x, y: y + offset.y }))
    .sort(comparePosition);
  const reachable = map.spawnPoints.some((spawn) => canonicalPath(map, terrainDefinitions, spawn, entrances, buildings, sites, cells) !== null);
  return reachable ? { ok: true, ...size, entrances } : { ok: false, reason: "placement_unreachable" };
}

export function scenerySize(definition: SceneryDefinition, rotation: Rotation): { readonly width: number; readonly height: number } {
  return rotatedDimensions(definition.footprint.width, definition.footprint.height, rotation);
}
