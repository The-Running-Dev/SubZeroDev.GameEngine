/** Benchmark-only fixtures. Nothing here is a package export or a supported workload limit. */
import { worldGraphMvpSource } from "../src/campaigns/world-graph-mvp.js";
import { rngHandleFor } from "../src/core/determinism/rng.js";
import type { KindContext } from "../src/core/kernel/types.js";
import type { Campaign } from "../src/core/registry/types.js";
import { buildCampaign, buildContentRegistry } from "../src/core/registry/build.js";
import { assertReferentialIntegrity } from "../src/kinds/world-graph/actions/common.js";
import type { WorldGraphCampaignSource } from "../src/kinds/world-graph/content.js";
import { initialState } from "../src/kinds/world-graph/initial.js";
import { buildWorldGraphCampaign } from "../src/kinds/world-graph/source.js";
import { validateCampaign } from "../src/kinds/world-graph/validate.js";
import { validateWorldGraphState } from "../src/kinds/world-graph/validateState.js";
import type { Guest, WorldGraphKindState } from "../src/kinds/world-graph/state.js";

export interface Workload {
  readonly id: string;
  readonly mapSize: number;
  readonly seekingGuests: number;
  readonly serviceBuildings: number;
  readonly productsPerBuilding: number;
  readonly staff: number;
  readonly batchTicks: number;
}

const base = { mapSize: 16, seekingGuests: 8, serviceBuildings: 2, productsPerBuilding: 1, staff: 2, batchTicks: 1 };
/** One-factor sweeps around the baseline, plus a combined case. Deliberately not a Cartesian explosion. */
export const WORKLOADS: readonly Workload[] = [
  { ...base, id: "baseline" },
  ...[8, 32, 64].map((mapSize) => ({ ...base, id: `map-${mapSize}`, mapSize })),
  ...[4, 16].map((seekingGuests) => ({ ...base, id: `guests-${seekingGuests}`, seekingGuests })),
  { ...base, id: "buildings-4", serviceBuildings: 4 },
  { ...base, id: "products-3", productsPerBuilding: 3 },
  { ...base, id: "batch-8", batchTicks: 8 },
  { ...base, id: "combined", mapSize: 32, seekingGuests: 16, serviceBuildings: 4, productsPerBuilding: 3, batchTicks: 4 },
];

function integer(value: number, minimum: number, maximum: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) throw new Error(`${label} must be ${minimum}..${maximum}`);
}
export function validateWorkload(w: Workload): void {
  if (!/^[a-z0-9-]+$/.test(w.id)) throw new Error("Invalid workload id");
  integer(w.mapSize, 8, 64, "mapSize");
  integer(w.seekingGuests, 1, 32, "seekingGuests");
  integer(w.serviceBuildings, 1, 8, "serviceBuildings");
  integer(w.productsPerBuilding, 1, 4, "productsPerBuilding");
  integer(w.staff, 0, 4, "staff");
  integer(w.batchTicks, 1, 16, "batchTicks");
}

export function createFixture(w: Workload, seed: string) {
  validateWorkload(w);
  const rng = rngHandleFor(seed, { kind: "system", system: "benchmark-fixture", seq: 0 });
  const size = w.mapSize;
  // Alternating columns leave every entrance and the entire row above the buildings open.
  const slots = Array.from({ length: Math.floor(size / 2) * 2 }, (_, index) => ({ x: 1 + 2 * (index % Math.floor(size / 2)), y: size - 1 - 2 * Math.floor(index / Math.floor(size / 2)) }));
  for (let i = slots.length - 1; i > 0; i -= 1) {
    const j = rng.nextInt(0, i);
    [slots[i], slots[j]] = [slots[j]!, slots[i]!];
  }
  const product = worldGraphMvpSource.products[0]!;
  const kiosk = worldGraphMvpSource.buildings[0]!;
  const archetype = worldGraphMvpSource.guestArchetypes[0]!;
  const source: WorldGraphCampaignSource = {
    ...worldGraphMvpSource,
    maxTicksPerAction: 16,
    maps: [{ ...worldGraphMvpSource.maps[0]!, width: size, height: size, spawnPoints: [{ x: 0, y: 0 }], exits: [{ x: size - 1, y: 0 }] }],
    products: Array.from({ length: w.productsPerBuilding }, (_, index) => ({ ...product, id: `product-${index}`, litter: null })),
    buildings: [{ ...kiosk, operatingCostCentsPerDay: 0, operation: {
      kind: "service", products: Array.from({ length: w.productsPerBuilding }, (_, index) => ({ productId: `product-${index}`, serviceTicks: 2, initialUnits: null, capacity: null, restockTaskPriority: 0 })),
      queueMaxLength: null, baseServiceTicks: 2, staffRequirements: [], staffingTaskPriority: 0, effects: [],
    } }],
    guestArchetypes: [{ ...archetype, cashCents: { min: 100000, max: 100000 }, stayTicks: { min: 10000, max: 10000 }, patienceTicks: { min: 10000, max: 10000 },
      needs: archetype.needs.map((need) => ({ ...need, driftByCurrentValue: { interpolation: "step", points: [{ input: 0, output: 0 }] } })),
    }],
    objectives: [], failures: [], achievements: [],
    incidents: [worldGraphMvpSource.incidents[0]!],
    scenarios: [{ ...worldGraphMvpSource.scenarios[0]!, startingCashCents: 1000000, scheduledChanges: [], objectiveIds: [], failureIds: [],
      buildingPlacements: slots.slice(0, w.serviceBuildings).map((position) => ({ ...position, definitionId: "kiosk", rotation: 0, open: true })),
      guestSpawning: { everyTicks: 1, maxActiveGuests: w.seekingGuests, pool: [{ archetypeId: "guest", weight: 1 }] },
      unlockedContent: [{ kind: "building", id: "kiosk" }, { kind: "staff_role", id: "cleaner" }],
      buildingLimits: [{ definitionId: "kiosk", maximum: w.serviceBuildings }], staffLimits: [{ definitionId: "cleaner", maximum: w.staff }],
    }],
  };
  const built = buildWorldGraphCampaign(source);
  const campaign: Campaign = { id: "world-graph-benchmark", kindId: "world-graph", version: "1.0.0", titleKey: "bench.title", content: built.content };
  const envelope = buildCampaign(campaign, [{ key: "bench.title", text: "Benchmark" }, ...built.authoredText]);
  if (!envelope.ok || !envelope.value) throw new Error(`Fixture envelope: ${JSON.stringify(envelope.errors)}`);
  const validation = validateCampaign(campaign, envelope.value.strings);
  if (!validation.ok) throw new Error(`Fixture campaign: ${JSON.stringify(validation)}`);
  const registry = buildContentRegistry([envelope.value]);
  if (!registry.ok || !registry.value) throw new Error("Fixture registry failed");
  const events: unknown[] = [];
  const ctx: KindContext = {
    campaign, registry: registry.value, seq: 0,
    rng: rngHandleFor(seed, { kind: "action", seq: 0 }),
    derive: (stream) => rngHandleFor(seed, stream),
    emit: { emit: (name, severity, detail) => { events.push({ name, severity, ...detail }); } },
  };
  const initial = initialState(campaign, ctx).state;
  let ordinal = initial.nextEntityOrdinal;
  const guests: Guest[] = Array.from({ length: w.seekingGuests }, () => ({
    id: `guest:${ordinal++}`, archetypeId: "guest", lifecycle: "seeking", tickEntered: 0, stayDurationTicks: 10000,
    x: rng.nextInt(0, size - 1), y: rng.nextInt(0, size - 5), path: [], pathIndex: 0, drawCount: 0, cashCents: 100000,
    intent: { kind: "wait", untilTick: 0, selectedAtTick: 0 }, needs: { thirst: 50 }, conditions: {}, opinions: { price: 0 }, preferences: {},
    satisfaction: 50, patienceCapacityTicks: 10000, patienceRemainingTicks: 0, lastServedTick: null, spentTicks: 0,
  }));
  const staff = Array.from({ length: w.staff }, () => ({
    id: `staff:${ordinal++}`, roleId: "cleaner", x: 0, y: 0, status: "idle" as const, path: [], pathIndex: 0,
    moveProgressTicks: 0, assignedBuildingId: null, assignedZoneId: null, drawCount: 0, task: null, tasksCompleted: 0,
  }));
  const incidents = staff.map(() => ({
    id: `incident:${ordinal++}`, definitionId: "litter", buildingId: null, guestId: null, zoneId: null,
    position: { x: rng.nextInt(0, size - 1), y: rng.nextInt(1, size - 5) }, amount: 100,
    startedAtTick: 0, expiresAtTick: null, resolvedAtTick: null,
  }));
  const state: WorldGraphKindState = { ...initial, guests, staff, incidents, nextEntityOrdinal: ordinal,
    counters: { ...initial.counters, guestsEntered: guests.length, incidentsRaised: incidents.length, litterCreated: incidents.length * 100 } };
  if (!validateWorldGraphState(state)) throw new Error("Fixture state shape failed");
  assertReferentialIntegrity(state);
  if (state.resolution !== null || state.buildings.length !== w.serviceBuildings || state.guests.some((g) => g.lifecycle !== "seeking")) throw new Error("Fixture workload mismatch");
  return { state, ctx, content: built.content, events, validationWarnings: validation.warnings };
}
