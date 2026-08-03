/**
 * World-graph campaign content types.
 *
 * Contract: `12-world-graph-kind.md` (`WorldGraphCampaign` shape) and
 * `01`/`03` as the contract-owned boundary between authored content and runtime state.
 */

import type { LocKey } from "../../core/localization/types.js";
import type { Finances, Rotation, TerrainKind, WorldMap } from "./state.js";

export interface PriceRange {
  minCents: number;
  maxCents: number;
}

export interface WorldGraphStartingFinances {
  cashCents: number;
  revenueTodayCents?: number;
  expensesTodayCents?: number;
  revenueTotalCents?: number;
  expensesTotalCents?: number;
  loan?: Finances["loan"];
}

export interface WorldGraphCampaign {
  descriptionKey: LocKey;
  /**
   * The authored map, carried into `kindState` unchanged by `initialState`.
   *
   * Sharing the runtime type is deliberate rather than an oversight: every field of
   * `WorldMap` is authored, including `revision`, which 12 §3.2 defines as changing when
   * *authored map topology* changes — no system writes it. A separate authored type would
   * be the same fields under a second name, and the two would be free to drift.
   */
  map: WorldMap;

  startingFinances: WorldGraphStartingFinances;
  maxAdvanceTicksPerAction: number;
  /** Ticks in one simulated day. The `revenueTodayCents` / `expensesTodayCents` reset is
   *  `floor(tick / ticksPerDay)` — a pure function of `tick` and this number, so no day
   *  field is stored (12 §3.3). The *value* is balance and belongs to the game. */
  ticksPerDay: number;

  buildingDefinitions: readonly WorldGraphBuildingDefinition[];
  staffRoleDefinitions: readonly WorldGraphStaffRoleDefinition[];
  objectiveDefinitions: readonly WorldGraphObjectiveDefinition[];

  /** Optional authored starting entities. Id allocation remains deterministic via `nextEntityOrdinal`. */
  startingBuildings?: readonly WorldGraphStartingBuilding[];
  startingStaff?: readonly WorldGraphStartingStaff[];
}

export interface WorldGraphBuildingDefinition {
  id: string;
  width: number;
  height: number;
  costCents: number;
  /** `null` = unlimited. */
  maxCount: number | null;
  /** Terrain types this building footprint may cover. */
  allowedTerrain: readonly TerrainKind[];
  /** Optional scenario unlock gate. */
  unlockAfterTick?: number;
  /** Product list and pricing bands for this building definition. */
  products: readonly WorldGraphProductDefinition[];
}

export interface WorldGraphProductDefinition {
  id: string;
  defaultPriceCents: number;
  priceRange: PriceRange;
}

export interface WorldGraphStaffRoleDefinition {
  id: string;
  hireCostCents: number;
  /** `null` = unlimited. */
  maxCount: number | null;
  /** Optional wage, stored for future systems. */
  wagePerTickCents?: number;
}

export interface WorldGraphObjectiveDefinition {
  id: string;
  target: number;
  /** Optional id whose threshold marks objective failure. */
  failureThreshold?: number;
}

export interface WorldGraphStartingBuilding {
  definitionId: string;
  x: number;
  y: number;
  rotation: Rotation;
  /** Optional tick offset for authored pre-placement. */
  buildStartTick?: number;
}

export interface WorldGraphStartingStaff {
  roleId: string;
  x: number;
  y: number;
  assignedBuildingId?: string | null;
  assignedZoneId?: string | null;
}
