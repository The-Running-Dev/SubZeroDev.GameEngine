import type { AuthoredText } from "../../core/registry/types.js";
import type {
  AuthoredDefinitionText,
  BuildingDefinition,
  BuildingDefinitionSource,
  GuestArchetypeDefinition,
  GuestArchetypeDefinitionSource,
  IntegerCurve,
  MapDefinition,
  MapDefinitionSource,
  RuntimeDefinitionText,
  ScenarioDefinition,
  ScenarioDefinitionSource,
  WorldGraphCampaign,
  WorldGraphCampaignSource,
} from "./content.js";
import type { Position, Rotation } from "./state.js";

type AuthoredDefinition = { readonly text: AuthoredDefinitionText };

function compareId(a: { readonly id: string }, b: { readonly id: string }): number {
  return a.id.localeCompare(b.id);
}

function comparePosition(a: Position, b: Position): number {
  return a.y - b.y || a.x - b.x;
}

function uniqueSorted(values: readonly string[]): readonly string[] {
  return [...values].sort((a, b) => a.localeCompare(b));
}

function rotations(values: readonly Rotation[]): readonly Rotation[] {
  return [...values].sort((a, b) => a - b);
}

function curve(value: IntegerCurve): IntegerCurve {
  return { ...value, points: [...value.points].sort((a, b) => a.input - b.input) };
}

function liftText(text: AuthoredDefinitionText, authoredText: AuthoredText[]): RuntimeDefinitionText {
  authoredText.push(text.name, text.description);
  return { nameKey: text.name.key, descriptionKey: text.description.key };
}

function lift<TSource extends AuthoredDefinition, TRuntime>(
  value: TSource,
  authoredText: AuthoredText[],
): TRuntime {
  return { ...value, text: liftText(value.text, authoredText) } as unknown as TRuntime;
}

function liftMap(value: MapDefinitionSource, authoredText: AuthoredText[]): MapDefinition {
  const runtime = lift<MapDefinitionSource, MapDefinition>(value, authoredText);
  return {
    ...runtime,
    terrainOverrides: [...runtime.terrainOverrides].sort((a, b) => comparePosition(a.position, b.position)),
    topology: runtime.topology.kind === "orthogonal_grid"
      ? runtime.topology
      : {
          kind: "explicit",
          edges: [...runtime.topology.edges].sort((a, b) =>
            comparePosition(a.from, b.from) || comparePosition(a.to, b.to)),
        },
    zones: value.zones.map((zone) => ({
      ...zone,
      text: liftText(zone.text, authoredText),
      cells: [...zone.cells].sort(comparePosition),
    })).sort(compareId),
    spawnPoints: [...runtime.spawnPoints].sort(comparePosition),
    exits: [...runtime.exits].sort(comparePosition),
    tags: uniqueSorted(runtime.tags),
  };
}

function liftBuilding(value: BuildingDefinitionSource, authoredText: AuthoredText[]): BuildingDefinition {
  const runtime = lift<BuildingDefinitionSource, BuildingDefinition>(value, authoredText);
  return {
    ...runtime,
    allowedRotations: rotations(runtime.allowedRotations),
    tags: uniqueSorted(runtime.tags),
    operation: runtime.operation.kind === "service"
      ? {
          ...runtime.operation,
          products: [...runtime.operation.products].sort((a, b) => a.productId.localeCompare(b.productId)),
          staffRequirements: [...runtime.operation.staffRequirements].sort((a, b) => a.roleId.localeCompare(b.roleId)),
        }
      : runtime.operation.kind === "waste"
        ? { ...runtime.operation, acceptedIncidentIds: uniqueSorted(runtime.operation.acceptedIncidentIds) }
        : runtime.operation.kind === "support"
          ? { ...runtime.operation, generatedTaskKinds: [...runtime.operation.generatedTaskKinds].sort() }
          : runtime.operation,
  };
}

function liftArchetype(value: GuestArchetypeDefinitionSource, authoredText: AuthoredText[]): GuestArchetypeDefinition {
  const runtime = lift<GuestArchetypeDefinitionSource, GuestArchetypeDefinition>(value, authoredText);
  return {
    ...runtime,
    needs: runtime.needs.map((need) => ({
      ...need,
      driftByCurrentValue: curve(need.driftByCurrentValue),
      utilityByCurrentValue: curve(need.utilityByCurrentValue),
    })).sort((a, b) => a.needId.localeCompare(b.needId)),
    conditions: [...runtime.conditions].sort((a, b) => a.definitionId.localeCompare(b.definitionId)),
    opinions: [...runtime.opinions].sort((a, b) => a.definitionId.localeCompare(b.definitionId)),
    preferences: [...runtime.preferences].sort((a, b) => a.definitionId.localeCompare(b.definitionId)),
    priceResistance: curve(runtime.priceResistance),
    tags: uniqueSorted(runtime.tags),
  };
}

function liftScenario(value: ScenarioDefinitionSource, authoredText: AuthoredText[]): ScenarioDefinition {
  const runtime = lift<ScenarioDefinitionSource, ScenarioDefinition>(value, authoredText);
  return {
    ...runtime,
    unlockedContent: [...runtime.unlockedContent].sort((a, b) => a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id)),
    activePolicyIds: uniqueSorted(runtime.activePolicyIds),
    scheduledChanges: [...runtime.scheduledChanges].sort((a, b) => a.dueTick - b.dueTick || b.priority - a.priority),
    guestSpawning: { ...runtime.guestSpawning, pool: [...runtime.guestSpawning.pool].sort((a, b) => a.archetypeId.localeCompare(b.archetypeId)) },
    objectiveIds: uniqueSorted(runtime.objectiveIds),
    failureIds: uniqueSorted(runtime.failureIds),
    buildingLimits: [...runtime.buildingLimits].sort((a, b) => a.definitionId.localeCompare(b.definitionId)),
    staffLimits: [...runtime.staffLimits].sort((a, b) => a.definitionId.localeCompare(b.definitionId)),
    tags: uniqueSorted(runtime.tags),
  };
}

function simpleCatalog<TSource extends AuthoredDefinition & { readonly id: string }, TRuntime extends { readonly id: string }>(
  values: readonly TSource[],
  authoredText: AuthoredText[],
  canonicalize?: (value: TRuntime) => TRuntime,
): readonly TRuntime[] {
  return values
    .map((value) => {
      const runtime = lift<TSource, TRuntime>(value, authoredText);
      return canonicalize ? canonicalize(runtime) : runtime;
    })
    .sort(compareId);
}

/** Pure mechanical source-to-runtime conversion. Semantic validation is deliberately separate. */
export function buildWorldGraphCampaign(source: WorldGraphCampaignSource): {
  readonly content: WorldGraphCampaign;
  readonly authoredText: readonly AuthoredText[];
} {
  const authoredText: AuthoredText[] = [];
  const withTags = <T extends { readonly tags: readonly string[] }>(value: T): T => ({ ...value, tags: uniqueSorted(value.tags) });

  const content: WorldGraphCampaign = {
    startScenarioId: source.startScenarioId,
    ticksPerDay: source.ticksPerDay,
    maxTicksPerAction: source.maxTicksPerAction,
    maps: source.maps.map((value) => liftMap(value, authoredText)).sort(compareId),
    terrain: simpleCatalog(source.terrain, authoredText, withTags),
    scenery: simpleCatalog(source.scenery ?? [], authoredText, (value) => ({ ...withTags(value), allowedRotations: rotations(value.allowedRotations) })),
    needs: simpleCatalog(source.needs, authoredText),
    guestConditions: simpleCatalog(source.guestConditions ?? [], authoredText),
    opinions: simpleCatalog(source.opinions, authoredText),
    preferences: simpleCatalog(source.preferences ?? [], authoredText, (value) => ({ ...value, targetTags: uniqueSorted(value.targetTags) })),
    products: simpleCatalog(source.products, authoredText, withTags),
    buildings: source.buildings.map((value) => liftBuilding(value, authoredText)).sort(compareId),
    guestArchetypes: source.guestArchetypes.map((value) => liftArchetype(value, authoredText)).sort(compareId),
    staffRoles: simpleCatalog(source.staffRoles, authoredText, (value) => ({
      ...withTags(value),
      supportedTaskKinds: [...value.supportedTaskKinds].sort(),
      workRates: [...value.workRates].sort((a, b) => a.taskType.localeCompare(b.taskType)),
    })),
    incidents: simpleCatalog(source.incidents, authoredText, withTags),
    objectives: simpleCatalog(source.objectives, authoredText, withTags),
    failures: simpleCatalog(source.failures, authoredText, withTags),
    policies: simpleCatalog(source.policies ?? [], authoredText, withTags),
    achievements: simpleCatalog(source.achievements ?? [], authoredText, withTags),
    scenarios: source.scenarios.map((value) => liftScenario(value, authoredText)).sort(compareId),
  };

  return { content, authoredText };
}
