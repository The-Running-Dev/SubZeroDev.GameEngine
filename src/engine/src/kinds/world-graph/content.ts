import type { AuthoredText } from "../../core/registry/types.js";
import type { LocKey } from "../../core/localization/types.js";
import type {
  IncidentSeverity,
  ObjectiveProgressState,
  Position,
  Rotation,
  StaffTaskType,
  WorldCounters,
} from "./state.js";

export interface AuthoredDefinitionText { readonly name: AuthoredText; readonly description: AuthoredText }
export interface RuntimeDefinitionText { readonly nameKey: LocKey; readonly descriptionKey: LocKey }
export interface IntegerRange { readonly min: number; readonly max: number }
export interface IntegerCurvePoint { readonly input: number; readonly output: number }
export interface IntegerCurve { readonly interpolation: "step" | "linear"; readonly points: readonly IntegerCurvePoint[] }
export type ComparisonOperator = "eq" | "ne" | "lt" | "lte" | "gt" | "gte";
export type AggregateOperation = "min" | "max" | "average" | "sum";
export type GuestMeterKind = "need" | "condition" | "opinion" | "preference";
export type WorldCounterKey = keyof WorldCounters;
export type FinanceMetricField =
  | "cashCents" | "revenueTodayCents" | "expensesTodayCents"
  | "revenueTotalCents" | "expensesTotalCents";

export type ContentReference =
  | { readonly kind: "map"; readonly id: string }
  | { readonly kind: "terrain"; readonly id: string }
  | { readonly kind: "scenery"; readonly id: string }
  | { readonly kind: "need"; readonly id: string }
  | { readonly kind: "guest_condition"; readonly id: string }
  | { readonly kind: "opinion"; readonly id: string }
  | { readonly kind: "preference"; readonly id: string }
  | { readonly kind: "product"; readonly id: string }
  | { readonly kind: "building"; readonly id: string }
  | { readonly kind: "guest_archetype"; readonly id: string }
  | { readonly kind: "staff_role"; readonly id: string }
  | { readonly kind: "incident"; readonly id: string }
  | { readonly kind: "objective"; readonly id: string }
  | { readonly kind: "failure"; readonly id: string }
  | { readonly kind: "policy"; readonly id: string }
  | { readonly kind: "scenario"; readonly id: string };

export type WorldMetric =
  | { readonly kind: "tick" }
  | { readonly kind: "day" }
  | { readonly kind: "finance"; readonly field: FinanceMetricField }
  | { readonly kind: "counter"; readonly counter: WorldCounterKey }
  | { readonly kind: "objective_progress"; readonly objectiveId: string }
  | { readonly kind: "entity_count"; readonly entity: "building" | "guest" | "staff"; readonly definitionId: string | null }
  | { readonly kind: "guest_meter"; readonly meter: GuestMeterKind; readonly definitionId: string; readonly aggregate: AggregateOperation; readonly archetypeId: string | null }
  | { readonly kind: "building_metric"; readonly metric: "cleanliness" | "wear" | "queue_length" | "inventory"; readonly aggregate: AggregateOperation; readonly buildingDefinitionId: string | null; readonly productId: string | null }
  | { readonly kind: "incident_count"; readonly incidentDefinitionId: string | null; readonly state: "active" | "resolved" };

export type WorldCondition =
  | { readonly kind: "constant"; readonly value: boolean }
  | { readonly kind: "all"; readonly conditions: readonly WorldCondition[] }
  | { readonly kind: "any"; readonly conditions: readonly WorldCondition[] }
  | { readonly kind: "not"; readonly condition: WorldCondition }
  | { readonly kind: "compare"; readonly metric: WorldMetric; readonly op: ComparisonOperator; readonly value: number }
  | { readonly kind: "objective_state"; readonly objectiveId: string; readonly state: ObjectiveProgressState }
  | { readonly kind: "content_unlocked"; readonly content: ContentReference }
  | { readonly kind: "policy_active"; readonly policyId: string }
  | { readonly kind: "incident_active"; readonly incidentDefinitionId: string };

export type GuestSelector =
  | { readonly kind: "all" }
  | { readonly kind: "archetype"; readonly archetypeId: string }
  | { readonly kind: "current_service_guest" }
  | { readonly kind: "current_incident_guest" }
  | { readonly kind: "building_queue"; readonly buildingDefinitionId: string };
export type BuildingSelector =
  | { readonly kind: "all" }
  | { readonly kind: "definition"; readonly buildingDefinitionId: string }
  | { readonly kind: "current_service_building" }
  | { readonly kind: "current_incident_building" };
export type IncidentTarget =
  | { readonly kind: "none" }
  | { readonly kind: "current_guest" }
  | { readonly kind: "current_building" }
  | { readonly kind: "zone"; readonly zoneId: string };

export type WorldEffect =
  | { readonly kind: "finance_delta"; readonly field: "cashCents"; readonly cents: number }
  | { readonly kind: "counter_delta"; readonly counter: WorldCounterKey; readonly delta: number }
  | { readonly kind: "unlock" | "lock"; readonly content: ContentReference }
  | { readonly kind: "objective_progress"; readonly objectiveId: string; readonly delta: number }
  | { readonly kind: "guest_meter_delta"; readonly meter: GuestMeterKind; readonly definitionId: string; readonly delta: number; readonly guests: GuestSelector }
  | { readonly kind: "building_meter_delta"; readonly meter: "cleanliness" | "wear"; readonly delta: number; readonly buildings: BuildingSelector }
  | { readonly kind: "start_incident"; readonly incidentDefinitionId: string; readonly target: IncidentTarget; readonly amount: number }
  | { readonly kind: "resolve_incident"; readonly incidentDefinitionId: string; readonly incidents: "current" | "all_active" }
  | { readonly kind: "set_policy_active"; readonly policyId: string; readonly active: boolean };

export interface MapDefinitionBase<TText> {
  readonly id: string; readonly text: TText; readonly width: number; readonly height: number;
  readonly defaultTerrainId: string; readonly terrainOverrides: readonly TerrainOverride[];
  readonly topology: MapTopology; readonly zones: readonly ZoneDefinitionBase<TText>[];
  readonly spawnPoints: readonly Position[]; readonly exits: readonly Position[]; readonly tags: readonly string[];
}
export interface TerrainOverride { readonly position: Position; readonly terrainId: string }
export type MapTopology = { readonly kind: "orthogonal_grid" } | { readonly kind: "explicit"; readonly edges: readonly MapEdgeDefinition[] };
export interface MapEdgeDefinition { readonly from: Position; readonly to: Position; readonly edgeCost: number; readonly allowed: boolean }
export interface ZoneDefinitionBase<TText> { readonly id: string; readonly text: TText; readonly cells: readonly Position[]; readonly serviceRadius: number; readonly maxOccupancy: number | null }
export interface TerrainDefinitionBase<TText> { readonly id: string; readonly text: TText; readonly walkable: boolean; readonly buildable: boolean; readonly moveCost: number; readonly tags: readonly string[] }
export interface FootprintDefinition { readonly width: number; readonly height: number }
export interface EntranceOffset { readonly x: number; readonly y: number }
export type PlacementRule =
  | { readonly kind: "terrain"; readonly terrainIds: readonly string[] }
  | { readonly kind: "adjacent_to_terrain"; readonly terrainIds: readonly string[]; readonly minimumEdges: number }
  | { readonly kind: "zone"; readonly zoneIds: readonly string[]; readonly mode: "inside" | "outside" }
  | { readonly kind: "distance_from_zone"; readonly zoneIds: readonly string[]; readonly minimumTiles: number; readonly maximumTiles: number | null };
export type AdjacencyTarget =
  | { readonly kind: "building"; readonly definitionIds: readonly string[] | null }
  | { readonly kind: "guest"; readonly archetypeIds: readonly string[] | null };
export interface AdjacencyEffect { readonly target: AdjacencyTarget; readonly metric: "attractiveness" | "need_drift" | "incident_risk" | "service_demand" | "noise"; readonly radiusTiles: number; readonly delta: number }
export interface SceneryDefinitionBase<TText> { readonly id: string; readonly text: TText; readonly footprint: FootprintDefinition; readonly allowedRotations: readonly Rotation[]; readonly placementRules: readonly PlacementRule[]; readonly adjacencyEffects: readonly AdjacencyEffect[]; readonly tags: readonly string[] }

export interface PriceBand { readonly minimumCents: number; readonly maximumCents: number; readonly defaultCents: number }
export interface ProductDefinitionBase<TText> { readonly id: string; readonly text: TText; readonly unitCostCents: number; readonly price: PriceBand; readonly effects: readonly WorldEffect[]; readonly litter: { readonly incidentDefinitionId: string; readonly unitsPerService: number } | null; readonly tags: readonly string[] }
export interface ServiceProduct { readonly productId: string; readonly serviceTicks: number | null; readonly initialUnits: number | null; readonly capacity: number | null; readonly restockTaskPriority: number }
export interface StaffRequirement { readonly roleId: string; readonly count: number }
export type BuildingOperation =
  | { readonly kind: "service"; readonly products: readonly ServiceProduct[]; readonly queueMaxLength: number | null; readonly baseServiceTicks: number; readonly staffRequirements: readonly StaffRequirement[]; readonly staffingTaskPriority: number; readonly effects: readonly WorldEffect[] }
  | { readonly kind: "waste"; readonly capacity: number | null; readonly acceptedIncidentIds: readonly string[] }
  | { readonly kind: "decorative" }
  | { readonly kind: "support"; readonly generatedTaskKinds: readonly StaffTaskType[] };
export interface BuildingDefinitionBase<TText> { readonly id: string; readonly text: TText; readonly footprint: FootprintDefinition; readonly entrances: readonly EntranceOffset[]; readonly allowedRotations: readonly Rotation[]; readonly constructionCostCents: number; readonly constructionWork: number; readonly constructionTaskPriority: number; readonly operatingCostCentsPerDay: number; readonly initialWear: number; readonly initialCleanliness: number; readonly placementRules: readonly PlacementRule[]; readonly adjacencyEffects: readonly AdjacencyEffect[]; readonly operation: BuildingOperation; readonly tags: readonly string[] }

export interface MeterDefinitionBase<TText> { readonly id: string; readonly text: TText; readonly minimum: number; readonly maximum: number }
export interface NeedDefinitionBase<TText> extends MeterDefinitionBase<TText> { readonly criticalBelow: number; readonly satisfiedAtOrAbove: number }
export type GuestConditionDefinitionBase<TText> = MeterDefinitionBase<TText>;
export interface OpinionDefinitionBase<TText> extends MeterDefinitionBase<TText> { readonly neutral: number }
export interface PreferenceDefinitionBase<TText> extends MeterDefinitionBase<TText> { readonly targetTags: readonly string[] }
export interface NeedProfile { readonly needId: string; readonly initial: IntegerRange; readonly driftByCurrentValue: IntegerCurve; readonly utilityByCurrentValue: IntegerCurve }
export interface MeterProfile { readonly definitionId: string; readonly initial: IntegerRange }
export interface GuestArchetypeDefinitionBase<TText> { readonly id: string; readonly text: TText; readonly cashCents: IntegerRange; readonly stayTicks: IntegerRange; readonly patienceTicks: IntegerRange; readonly initialSatisfaction: IntegerRange; readonly needs: readonly NeedProfile[]; readonly conditions: readonly MeterProfile[]; readonly opinions: readonly MeterProfile[]; readonly preferences: readonly MeterProfile[]; readonly priceResistance: IntegerCurve; readonly preferenceUtilityPerPoint: number; readonly qualityUtilityPerPoint: number; readonly attractivenessUtilityPerPoint: number; readonly travelPenaltyPerCost: number; readonly queuePenaltyPerTick: number; readonly safetyPenaltyPerPoint: number; readonly switchThresholdUtility: number; readonly fallback: { readonly kind: "leave" } | { readonly kind: "wait"; readonly ticks: number }; readonly tags: readonly string[] }
export interface StaffWorkRate { readonly taskType: StaffTaskType; readonly effortPerTick: number }
export interface StaffRoleDefinitionBase<TText> { readonly id: string; readonly text: TText; readonly hireCostCents: number; readonly wageCentsPerDay: number; readonly moveTicksPerTile: number; readonly supportedTaskKinds: readonly StaffTaskType[]; readonly workRates: readonly StaffWorkRate[]; readonly tags: readonly string[] }

export interface BuildingPlacement { readonly definitionId: string; readonly x: number; readonly y: number; readonly rotation: Rotation; readonly open: boolean }
export interface SceneryPlacement { readonly definitionId: string; readonly x: number; readonly y: number; readonly rotation: Rotation }
export interface ScenarioGuestPoolEntry { readonly archetypeId: string; readonly weight: number }
export interface ScenarioGuestSpawning { readonly everyTicks: number; readonly maxActiveGuests: number; readonly pool: readonly ScenarioGuestPoolEntry[] }
export interface DefinitionLimit { readonly definitionId: string; readonly maximum: number }
export interface ScheduledScenarioChange { readonly dueTick: number; readonly priority: number; readonly condition: WorldCondition; readonly effects: readonly WorldEffect[] }
export type ResolutionPrecedence = "objectives_win" | "failure_wins";
export interface ScenarioDefinitionBase<TText> { readonly id: string; readonly text: TText; readonly mapId: string; readonly startingCashCents: number; readonly unlockedContent: readonly ContentReference[]; readonly activePolicyIds: readonly string[]; readonly scheduledChanges: readonly ScheduledScenarioChange[]; readonly buildingPlacements: readonly BuildingPlacement[]; readonly sceneryPlacements: readonly SceneryPlacement[]; readonly guestSpawning: ScenarioGuestSpawning; readonly objectiveIds: readonly string[]; readonly failureIds: readonly string[]; readonly timeLimitTicks: number | null; readonly timeLimitFailureId: string | null; readonly resolutionPrecedence: ResolutionPrecedence; readonly buildingLimits: readonly DefinitionLimit[]; readonly staffLimits: readonly DefinitionLimit[]; readonly tags: readonly string[] }
export interface ObjectiveDefinitionBase<TText> { readonly id: string; readonly text: TText; readonly completion: WorldCondition; readonly progressMetric: WorldMetric | null; readonly target: number; readonly requiredDurationTicks: number; readonly onCompleted: readonly WorldEffect[]; readonly tags: readonly string[] }
export interface FailureDefinitionBase<TText> { readonly id: string; readonly text: TText; readonly condition: WorldCondition; readonly requiredDurationTicks: number; readonly onTriggered: readonly WorldEffect[]; readonly tags: readonly string[] }
export type IncidentKind = "litter" | "spill" | "breakdown" | "fire" | "security" | "weather" | "scripted";
export type IncidentRollScope = "world" | "zone" | "building";
export interface IncidentDefinitionBase<TText> { readonly id: string; readonly text: TText; readonly kind: IncidentKind; readonly severity: IncidentSeverity; readonly triggerCondition: WorldCondition | null; readonly rollScope: IncidentRollScope; readonly rollChanceBasisPoints: number; readonly selectionWeight: number; readonly cooldownTicks: number; readonly durationTicks: IntegerRange | null; readonly resolutionCondition: WorldCondition | null; readonly resolverTaskType: StaffTaskType | null; readonly resolverTaskPriority: number | null; readonly onStart: readonly WorldEffect[]; readonly onResolve: readonly WorldEffect[]; readonly tags: readonly string[] }
export interface PolicyDefinitionBase<TText> { readonly id: string; readonly text: TText; readonly availableWhen: WorldCondition; readonly activationCostCents: number; readonly deactivationCostCents: number; readonly whileActive: readonly WorldEffect[]; readonly tags: readonly string[] }
export interface AchievementDefinitionBase<TText> { readonly id: string; readonly text: TText; readonly condition: WorldCondition; readonly hidden: boolean; readonly scope: "profile"; readonly tags: readonly string[] }

export type MapDefinitionSource = MapDefinitionBase<AuthoredDefinitionText>;
export type MapDefinition = MapDefinitionBase<RuntimeDefinitionText>;
export type TerrainDefinitionSource = TerrainDefinitionBase<AuthoredDefinitionText>;
export type TerrainDefinition = TerrainDefinitionBase<RuntimeDefinitionText>;
export type SceneryDefinitionSource = SceneryDefinitionBase<AuthoredDefinitionText>;
export type SceneryDefinition = SceneryDefinitionBase<RuntimeDefinitionText>;
export type NeedDefinitionSource = NeedDefinitionBase<AuthoredDefinitionText>;
export type NeedDefinition = NeedDefinitionBase<RuntimeDefinitionText>;
export type GuestConditionDefinitionSource = GuestConditionDefinitionBase<AuthoredDefinitionText>;
export type GuestConditionDefinition = GuestConditionDefinitionBase<RuntimeDefinitionText>;
export type OpinionDefinitionSource = OpinionDefinitionBase<AuthoredDefinitionText>;
export type OpinionDefinition = OpinionDefinitionBase<RuntimeDefinitionText>;
export type PreferenceDefinitionSource = PreferenceDefinitionBase<AuthoredDefinitionText>;
export type PreferenceDefinition = PreferenceDefinitionBase<RuntimeDefinitionText>;
export type ProductDefinitionSource = ProductDefinitionBase<AuthoredDefinitionText>;
export type ProductDefinition = ProductDefinitionBase<RuntimeDefinitionText>;
export type BuildingDefinitionSource = BuildingDefinitionBase<AuthoredDefinitionText>;
export type BuildingDefinition = BuildingDefinitionBase<RuntimeDefinitionText>;
export type GuestArchetypeDefinitionSource = GuestArchetypeDefinitionBase<AuthoredDefinitionText>;
export type GuestArchetypeDefinition = GuestArchetypeDefinitionBase<RuntimeDefinitionText>;
export type StaffRoleDefinitionSource = StaffRoleDefinitionBase<AuthoredDefinitionText>;
export type StaffRoleDefinition = StaffRoleDefinitionBase<RuntimeDefinitionText>;
export type ScenarioDefinitionSource = ScenarioDefinitionBase<AuthoredDefinitionText>;
export type ScenarioDefinition = ScenarioDefinitionBase<RuntimeDefinitionText>;
export type ObjectiveDefinitionSource = ObjectiveDefinitionBase<AuthoredDefinitionText>;
export type ObjectiveDefinition = ObjectiveDefinitionBase<RuntimeDefinitionText>;
export type FailureDefinitionSource = FailureDefinitionBase<AuthoredDefinitionText>;
export type FailureDefinition = FailureDefinitionBase<RuntimeDefinitionText>;
export type IncidentDefinitionSource = IncidentDefinitionBase<AuthoredDefinitionText>;
export type IncidentDefinition = IncidentDefinitionBase<RuntimeDefinitionText>;
export type PolicyDefinitionSource = PolicyDefinitionBase<AuthoredDefinitionText>;
export type PolicyDefinition = PolicyDefinitionBase<RuntimeDefinitionText>;
export type AchievementDefinitionSource = AchievementDefinitionBase<AuthoredDefinitionText>;
export type AchievementDefinition = AchievementDefinitionBase<RuntimeDefinitionText>;

export interface WorldGraphCampaignSource {
  readonly startScenarioId: string; readonly ticksPerDay: number; readonly maxTicksPerAction: number;
  readonly maps: readonly MapDefinitionSource[]; readonly terrain: readonly TerrainDefinitionSource[];
  readonly scenery?: readonly SceneryDefinitionSource[]; readonly needs: readonly NeedDefinitionSource[];
  readonly guestConditions?: readonly GuestConditionDefinitionSource[]; readonly opinions: readonly OpinionDefinitionSource[];
  readonly preferences?: readonly PreferenceDefinitionSource[]; readonly products: readonly ProductDefinitionSource[];
  readonly buildings: readonly BuildingDefinitionSource[]; readonly guestArchetypes: readonly GuestArchetypeDefinitionSource[];
  readonly staffRoles: readonly StaffRoleDefinitionSource[]; readonly incidents: readonly IncidentDefinitionSource[];
  readonly objectives: readonly ObjectiveDefinitionSource[]; readonly failures: readonly FailureDefinitionSource[];
  readonly policies?: readonly PolicyDefinitionSource[]; readonly achievements?: readonly AchievementDefinitionSource[];
  readonly scenarios: readonly ScenarioDefinitionSource[];
}

export interface WorldGraphCampaign {
  readonly startScenarioId: string; readonly ticksPerDay: number; readonly maxTicksPerAction: number;
  readonly maps: readonly MapDefinition[]; readonly terrain: readonly TerrainDefinition[];
  readonly scenery: readonly SceneryDefinition[]; readonly needs: readonly NeedDefinition[];
  readonly guestConditions: readonly GuestConditionDefinition[]; readonly opinions: readonly OpinionDefinition[];
  readonly preferences: readonly PreferenceDefinition[]; readonly products: readonly ProductDefinition[];
  readonly buildings: readonly BuildingDefinition[]; readonly guestArchetypes: readonly GuestArchetypeDefinition[];
  readonly staffRoles: readonly StaffRoleDefinition[]; readonly incidents: readonly IncidentDefinition[];
  readonly objectives: readonly ObjectiveDefinition[]; readonly failures: readonly FailureDefinition[];
  readonly policies: readonly PolicyDefinition[]; readonly achievements: readonly AchievementDefinition[];
  readonly scenarios: readonly ScenarioDefinition[];
}

/** The core registry validates this opaque boundary before gameplay reaches a kind. */
export function worldGraphContent(value: unknown): WorldGraphCampaign {
  return value as WorldGraphCampaign;
}
