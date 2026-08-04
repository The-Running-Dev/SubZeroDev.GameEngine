/** Engine-owned deterministic W49 fixture, deliberately smaller than Sun Trap content. */
import type { BuiltCampaign, Campaign } from "../core/registry/types.js";
import type { CommandResult } from "../core/kernel/reasons.js";
import { buildCampaign } from "../core/registry/build.js";
import type { WorldGraphCampaignSource } from "../kinds/world-graph/content.js";
import { buildWorldGraphCampaign } from "../kinds/world-graph/source.js";

export const WORLD_GRAPH_MVP_CAMPAIGN_ID = "world-graph-mvp";
const text = (key: string, value: string) => ({ key, text: value });
const definitionText = (id: string) => ({ name: text(`world.${id}.name`, `${id} name`), description: text(`world.${id}.description`, `${id} description`) });

export const worldGraphMvpSource: WorldGraphCampaignSource = {
  startScenarioId: "opening", ticksPerDay: 100, maxTicksPerAction: 10,
  maps: [{ id: "beach", text: definitionText("map.beach"), width: 5, height: 3, defaultTerrainId: "sand", terrainOverrides: [], topology: { kind: "orthogonal_grid" }, zones: [], spawnPoints: [{ x: 0, y: 1 }], exits: [{ x: 4, y: 1 }], tags: ["mvp"] }],
  terrain: [{ id: "sand", text: definitionText("terrain.sand"), walkable: true, buildable: true, moveCost: 1, tags: [] }],
  needs: [{ id: "thirst", text: definitionText("need.thirst"), minimum: 0, maximum: 100, criticalBelow: 20, satisfiedAtOrAbove: 70 }],
  opinions: [{ id: "price", text: definitionText("opinion.price"), minimum: -100, maximum: 100, neutral: 0 }],
  products: [{ id: "water", text: definitionText("product.water"), unitCostCents: 50, price: { minimumCents: 100, maximumCents: 300, defaultCents: 150 }, effects: [], litter: null, tags: [] }],
  buildings: [{ id: "kiosk", text: definitionText("building.kiosk"), footprint: { width: 1, height: 1 }, entrances: [{ x: -1, y: 0 }], allowedRotations: [0], constructionCostCents: 500, constructionWork: 0, constructionTaskPriority: 0, operatingCostCentsPerDay: 10, initialWear: 90, initialCleanliness: 80, placementRules: [{ kind: "terrain", terrainIds: ["sand"] }], adjacencyEffects: [], operation: { kind: "service", products: [{ productId: "water", serviceTicks: 2, initialUnits: null, capacity: null, restockTaskPriority: 0 }], queueMaxLength: 5, baseServiceTicks: 2, staffRequirements: [], staffingTaskPriority: 0, effects: [] }, tags: [] }],
  guestArchetypes: [{ id: "guest", text: definitionText("guest.guest"), cashCents: { min: 100, max: 100 }, stayTicks: { min: 10, max: 10 }, patienceTicks: { min: 5, max: 5 }, initialSatisfaction: { min: 50, max: 50 }, needs: [{ needId: "thirst", initial: { min: 50, max: 50 }, driftByCurrentValue: { interpolation: "step", points: [{ input: 0, output: -1 }] }, utilityByCurrentValue: { interpolation: "step", points: [{ input: 0, output: 1 }] } }], conditions: [], opinions: [{ definitionId: "price", initial: { min: 0, max: 0 } }], preferences: [], priceResistance: { interpolation: "step", points: [{ input: 0, output: 0 }] }, preferenceUtilityPerPoint: 0, qualityUtilityPerPoint: 0, attractivenessUtilityPerPoint: 0, travelPenaltyPerCost: 1, queuePenaltyPerTick: 1, safetyPenaltyPerPoint: 1, switchThresholdUtility: 1, fallback: { kind: "leave" }, tags: [] }],
  staffRoles: [{ id: "cleaner", text: definitionText("staff.cleaner"), hireCostCents: 200, wageCentsPerDay: 20, moveTicksPerTile: 1, supportedTaskKinds: ["clean"], workRates: [{ taskType: "clean", effortPerTick: 1 }], tags: [] }],
  incidents: [{ id: "litter", text: definitionText("incident.litter"), kind: "litter", severity: "minor", triggerCondition: null, rollScope: "world", rollChanceBasisPoints: 0, selectionWeight: 0, cooldownTicks: 0, durationTicks: null, resolutionCondition: null, resolverTaskType: "clean", resolverTaskPriority: 1, onStart: [], onResolve: [], tags: [] }],
  objectives: [{ id: "earn", text: definitionText("objective.earn"), completion: { kind: "compare", metric: { kind: "finance", field: "revenueTotalCents" }, op: "gte", value: 1000 }, progressMetric: { kind: "finance", field: "revenueTotalCents" }, target: 1000, requiredDurationTicks: 1, onCompleted: [], tags: [] }],
  failures: [{ id: "bankrupt", text: definitionText("failure.bankrupt"), condition: { kind: "compare", metric: { kind: "finance", field: "cashCents" }, op: "lt", value: 0 }, requiredDurationTicks: 1, onTriggered: [], tags: [] }],
  scenarios: [{ id: "opening", text: definitionText("scenario.opening"), mapId: "beach", startingCashCents: 2000, unlockedContent: [{ kind: "building", id: "kiosk" }, { kind: "staff_role", id: "cleaner" }], activePolicyIds: [], scheduledChanges: [], buildingPlacements: [], sceneryPlacements: [], guestSpawning: { everyTicks: 5, maxActiveGuests: 10, pool: [{ archetypeId: "guest", weight: 1 }] }, objectiveIds: ["earn"], failureIds: ["bankrupt"], timeLimitTicks: null, timeLimitFailureId: null, resolutionPrecedence: "objectives_win", buildingLimits: [{ definitionId: "kiosk", maximum: 2 }], staffLimits: [{ definitionId: "cleaner", maximum: 2 }], tags: [] }],
};

export function buildWorldGraphMvpCampaign(): CommandResult<BuiltCampaign> {
  const built = buildWorldGraphCampaign(worldGraphMvpSource);
  const campaign: Campaign = { id: WORLD_GRAPH_MVP_CAMPAIGN_ID, kindId: "world-graph", version: "1.0.0", titleKey: "world.campaign.title", content: built.content };
  return buildCampaign(campaign, [text("world.campaign.title", "World Graph MVP"), ...built.authoredText]);
}
