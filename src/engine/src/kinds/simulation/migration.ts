/**
 * Simulation kind — the campaign-axis save migration walk (10-simulation-kind.md §16; W102).
 *
 * Contract: `10-simulation-kind.md` §16. 04 §10.2 owns the two-axis mechanism —
 * `Kind.migrateState` for a kind-state shape change, then `Campaign.migrateState` for a
 * content-id remap. This module is the latter, for the simulation kind: a `SimulationMigration`
 * travels as data on a portable campaign's simulation arm (`portable/format.ts`), and
 * `fromPortable` reattaches `applySimulationMigration` as `Campaign.migrateState`.
 *
 * Every step is data; the walk itself is engine-owned code, and there is no host callback
 * anywhere on this path (§16's own callout — a migration changes `serialize()` output, and
 * 06 §2 admits a host only where it cannot).
 *
 * Operates on `unknown` throughout, not the typed `SimulationKindState` — a save is a
 * *foreign* document until this walk (and `isValidGameStateShape` after it) says otherwise,
 * the same defensive posture `portable/format.ts`'s own `migrateFromContent` takes.
 */

import type { CommandResult } from "../../core/kernel/reasons.js";
import type { SimulationCampaign } from "./campaign.js";

/**
 * Derived, not enumerated in `20-contract.md` — one member per `SimulationCampaign`
 * collection whose ids `SimulationKindState` actually holds a reference to. Declared here,
 * beside the reference-site table that gives each member its list of state paths, so the two
 * cannot disagree (§16's own callout on why this union isn't restated in the contract).
 */
export type SimulationIdDomain = "job" | "course" | "housing" | "item" | "event";

export const SIMULATION_ID_DOMAINS: readonly SimulationIdDomain[] = ["job", "course", "housing", "item", "event"];

export type SimulationMigrationStep =
  /** Every reference to a key of `map`, in the named domain, becomes that key's value. */
  | { readonly op: "remap"; readonly domain: SimulationIdDomain; readonly map: Readonly<Record<string, string>> }
  /** Every reference to one of `ids` is dropped: removed from a collection that holds many,
   *  left absent at a site that holds one. */
  | { readonly op: "remove"; readonly domain: SimulationIdDomain; readonly ids: readonly string[] }
  /** A single-valued reference site left absent by the steps before it takes `id`. Never
   *  overwrites a site that still holds a resolving reference. */
  | { readonly op: "default"; readonly domain: SimulationIdDomain; readonly id: string }
  /** Every surviving reference in the domain must resolve against the new campaign's
   *  collection. One that does not fails the load. */
  | { readonly op: "require"; readonly domain: SimulationIdDomain };

/** Sits on the simulation arm of `PortableCampaignBody` (04 §19), beside the story-graph
 *  arm's own `PortableMigration`. Reattached as `Campaign.migrateState` by `fromPortable`. */
export interface SimulationMigration {
  /** The only `fromVersion` this migration accepts; anything else fails the load. */
  readonly fromVersion: string;
  /** Applied in array order, left to right. A domain may appear in more than one step. */
  readonly steps: readonly SimulationMigrationStep[];
}

function migrationFailed(): CommandResult<unknown> {
  return { ok: false, errors: [{ code: "migration_failed", messageKey: "core.reason.migration_failed" }], warnings: [] };
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** `undefined` from `remap` means "drop it" — a removed id is never in `map`'s domain, and a
 *  step's own author decides remap vs. remove for the same id rather than this walk guessing. */
function remapId(id: string, map: Readonly<Record<string, string>>): string {
  return Object.hasOwn(map, id) ? map[id]! : id;
}

// ---------------------------------------------------------------------------
// One actor's reference sites — applied identically to `player` and to every
// `world.agents[].actor` (§6.2's "one shape, one code path" rule, carried into migration).
// ---------------------------------------------------------------------------

function mapArrayIdField(items: unknown, field: string, ids: readonly string[] | undefined, map: Readonly<Record<string, string>> | undefined): unknown[] {
  if (!Array.isArray(items)) return [];
  const kept = ids ? items.filter((item) => !(isPlainObject(item) && ids.includes(item[field] as string))) : items;
  if (!map) return kept;
  return kept.map((item) => (isPlainObject(item) && typeof item[field] === "string" ? { ...item, [field]: remapId(item[field] as string, map) } : item));
}

function mapStringArray(items: unknown, ids: readonly string[] | undefined, map: Readonly<Record<string, string>> | undefined): unknown[] {
  if (!Array.isArray(items)) return [];
  const kept = ids ? items.filter((id) => !ids.includes(id as string)) : items;
  if (!map) return kept;
  return kept.map((id) => (typeof id === "string" ? remapId(id, map) : id));
}

function transformActorJob(actor: Record<string, unknown>, ids: readonly string[] | undefined, map: Readonly<Record<string, string>> | undefined): Record<string, unknown> {
  const career = isPlainObject(actor["career"]) ? actor["career"] : {};
  let currentEmployment = career["currentEmployment"];
  if (isPlainObject(currentEmployment) && typeof currentEmployment["jobId"] === "string") {
    if (ids?.includes(currentEmployment["jobId"])) {
      currentEmployment = undefined;
    } else if (map) {
      currentEmployment = { ...currentEmployment, jobId: remapId(currentEmployment["jobId"], map) };
    }
  }
  return {
    ...actor,
    career: {
      ...career,
      ...(currentEmployment !== undefined ? { currentEmployment } : { currentEmployment: undefined }),
      history: mapArrayIdField(career["history"], "jobId", ids, map),
      pendingApplications: mapArrayIdField(career["pendingApplications"], "jobId", ids, map),
    },
  };
}

function transformActorCourse(actor: Record<string, unknown>, ids: readonly string[] | undefined, map: Readonly<Record<string, string>> | undefined): Record<string, unknown> {
  const education = isPlainObject(actor["education"]) ? actor["education"] : {};
  return {
    ...actor,
    education: {
      ...education,
      enrollments: mapArrayIdField(education["enrollments"], "courseId", ids, map),
      credentials: mapArrayIdField(education["credentials"], "courseId", ids, map),
      completedCourseIds: mapStringArray(education["completedCourseIds"], ids, map),
      failedCourseIds: mapStringArray(education["failedCourseIds"], ids, map),
    },
  };
}

/** `housing` is the one single-valued site (`ActorState.housing.definitionId` is required,
 *  never optional) — `remove` leaves it absent rather than deleting the whole `housing`
 *  object, which is what makes `default` meaningful for this domain specifically. */
function transformActorHousing(
  actor: Record<string, unknown>,
  ids: readonly string[] | undefined,
  map: Readonly<Record<string, string>> | undefined,
  defaultId: string | undefined,
): Record<string, unknown> {
  const housing = isPlainObject(actor["housing"]) ? { ...actor["housing"] } : {};
  const current = housing["definitionId"];
  if (typeof current === "string") {
    if (ids?.includes(current)) {
      delete housing["definitionId"];
    } else if (map) {
      housing["definitionId"] = remapId(current, map);
    }
  }
  if (defaultId !== undefined && !("definitionId" in housing)) {
    housing["definitionId"] = defaultId;
  }
  return { ...actor, housing };
}

function transformActorItem(actor: Record<string, unknown>, ids: readonly string[] | undefined, map: Readonly<Record<string, string>> | undefined): Record<string, unknown> {
  return { ...actor, inventory: mapArrayIdField(actor["inventory"], "definitionId", ids, map) };
}

type ActorTransform = (actor: Record<string, unknown>) => Record<string, unknown>;

/** Applies one actor-scoped transform to `player` and every `world.agents[].actor` — the
 *  same shared path §6.2 already states for resolution, carried into migration. */
function applyToEveryActor(state: Record<string, unknown>, transform: ActorTransform): Record<string, unknown> {
  const player = isPlainObject(state["player"]) ? transform(state["player"]) : state["player"];
  const world = isPlainObject(state["world"]) ? state["world"] : {};
  const agents = Array.isArray(world["agents"])
    ? world["agents"].map((agent) =>
        isPlainObject(agent) && isPlainObject(agent["actor"]) ? { ...agent, actor: transform(agent["actor"]) } : agent,
      )
    : world["agents"];
  return { ...state, player, world: { ...world, agents } };
}

// ---------------------------------------------------------------------------
// World-scoped reference sites — job market openings and the events bookkeeping.
// ---------------------------------------------------------------------------

function transformWorldJob(state: Record<string, unknown>, ids: readonly string[] | undefined, map: Readonly<Record<string, string>> | undefined): Record<string, unknown> {
  const world = isPlainObject(state["world"]) ? state["world"] : {};
  const jobMarket = isPlainObject(world["jobMarket"]) ? world["jobMarket"] : {};
  return { ...state, world: { ...world, jobMarket: { ...jobMarket, openings: mapArrayIdField(jobMarket["openings"], "jobId", ids, map) } } };
}

function mapRecordKeys(record: unknown, ids: readonly string[] | undefined, map: Readonly<Record<string, string>> | undefined): Record<string, unknown> {
  if (!isPlainObject(record)) return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (ids?.includes(key)) continue;
    out[map ? remapId(key, map) : key] = value;
  }
  return out;
}

function transformWorldEvent(state: Record<string, unknown>, ids: readonly string[] | undefined, map: Readonly<Record<string, string>> | undefined): Record<string, unknown> {
  const world = isPlainObject(state["world"]) ? state["world"] : {};
  return {
    ...state,
    world: {
      ...world,
      eventCooldowns: mapRecordKeys(world["eventCooldowns"], ids, map),
      firedUniqueEvents: mapStringArray(world["firedUniqueEvents"], ids, map),
    },
    scheduledEvents: mapArrayIdField(state["scheduledEvents"], "eventId", ids, map),
    pendingEventResponses: mapArrayIdField(state["pendingEventResponses"], "eventId", ids, map),
  };
}

// ---------------------------------------------------------------------------
// The four ops, dispatched per domain
// ---------------------------------------------------------------------------

function applyRemapOrRemove(
  state: Record<string, unknown>,
  domain: SimulationIdDomain,
  ids: readonly string[] | undefined,
  map: Readonly<Record<string, string>> | undefined,
): Record<string, unknown> {
  switch (domain) {
    case "job":
      return applyToEveryActor(transformWorldJob(state, ids, map), (a) => transformActorJob(a, ids, map));
    case "course":
      return applyToEveryActor(state, (a) => transformActorCourse(a, ids, map));
    case "housing":
      return applyToEveryActor(state, (a) => transformActorHousing(a, ids, map, undefined));
    case "item":
      return applyToEveryActor(state, (a) => transformActorItem(a, ids, map));
    case "event":
      return transformWorldEvent(state, ids, map);
  }
}

function applyDefault(state: Record<string, unknown>, domain: SimulationIdDomain, id: string): Record<string, unknown> {
  // `default` only ever addresses a single-valued site left absent by an earlier step — the
  // one domain this migration treats that way is `housing` (`transformActorHousing`'s own
  // header). Every other domain has no single-valued required site to fill, so `default` is
  // a no-op for it rather than an error: a campaign author naming the wrong domain here is
  // caught by nothing failing to resolve later, the same latitude an unused `remap` entry gets.
  if (domain !== "housing") return state;
  return applyToEveryActor(state, (a) => transformActorHousing(a, undefined, undefined, id));
}

function collectReferences(state: Record<string, unknown>, domain: SimulationIdDomain): string[] {
  const refs: string[] = [];
  const player = isPlainObject(state["player"]) ? state["player"] : {};
  const world = isPlainObject(state["world"]) ? state["world"] : {};
  const agents = Array.isArray(world["agents"]) ? world["agents"] : [];
  const actors = [player, ...agents.map((a) => (isPlainObject(a) && isPlainObject(a["actor"]) ? a["actor"] : {}))];

  const pushIdField = (item: unknown, field: string): void => {
    if (isPlainObject(item) && typeof item[field] === "string") refs.push(item[field] as string);
  };

  switch (domain) {
    case "job":
      for (const actor of actors) {
        const career = isPlainObject(actor["career"]) ? actor["career"] : {};
        pushIdField(career["currentEmployment"], "jobId");
        for (const entry of Array.isArray(career["history"]) ? career["history"] : []) pushIdField(entry, "jobId");
        for (const entry of Array.isArray(career["pendingApplications"]) ? career["pendingApplications"] : []) pushIdField(entry, "jobId");
      }
      for (const opening of Array.isArray((world["jobMarket"] as Record<string, unknown> | undefined)?.["openings"])
        ? (world["jobMarket"] as Record<string, unknown>)["openings"] as unknown[]
        : []) {
        pushIdField(opening, "jobId");
      }
      break;
    case "course":
      for (const actor of actors) {
        const education = isPlainObject(actor["education"]) ? actor["education"] : {};
        for (const entry of Array.isArray(education["enrollments"]) ? education["enrollments"] : []) pushIdField(entry, "courseId");
        for (const entry of Array.isArray(education["credentials"]) ? education["credentials"] : []) pushIdField(entry, "courseId");
        for (const id of Array.isArray(education["completedCourseIds"]) ? education["completedCourseIds"] : []) {
          if (typeof id === "string") refs.push(id);
        }
        for (const id of Array.isArray(education["failedCourseIds"]) ? education["failedCourseIds"] : []) {
          if (typeof id === "string") refs.push(id);
        }
      }
      break;
    case "housing":
      for (const actor of actors) pushIdField(actor["housing"], "definitionId");
      break;
    case "item":
      for (const actor of actors) {
        for (const entry of Array.isArray(actor["inventory"]) ? actor["inventory"] : []) pushIdField(entry, "definitionId");
      }
      break;
    case "event":
      for (const key of Object.keys(isPlainObject(world["eventCooldowns"]) ? world["eventCooldowns"] as Record<string, unknown> : {})) {
        refs.push(key);
      }
      for (const id of Array.isArray(world["firedUniqueEvents"]) ? world["firedUniqueEvents"] : []) {
        if (typeof id === "string") refs.push(id);
      }
      for (const entry of Array.isArray(state["scheduledEvents"]) ? state["scheduledEvents"] : []) pushIdField(entry, "eventId");
      for (const entry of Array.isArray(state["pendingEventResponses"]) ? state["pendingEventResponses"] : []) pushIdField(entry, "eventId");
      break;
  }
  return refs;
}

const DOMAIN_COLLECTIONS: Record<SimulationIdDomain, keyof SimulationCampaign> = {
  job: "jobs",
  course: "courses",
  housing: "housing",
  item: "items",
  event: "events",
};

function domainResolves(campaign: SimulationCampaign, domain: SimulationIdDomain, id: string): boolean {
  const collection = campaign[DOMAIN_COLLECTIONS[domain]] as readonly { id: string }[];
  return collection.some((entry) => entry.id === id);
}

/**
 * The engine-owned walk `fromPortable` reattaches as `Campaign.migrateState` (§16). Applies
 * `migration.steps` in order; a `require` step checks every surviving reference in its domain
 * resolves against `campaign`, failing loudly (`migration_failed`) the first time one doesn't
 * — never a partial write, matching `resolveSaveEnvelope`'s own all-or-nothing boundary.
 */
export function applySimulationMigration(
  kindState: unknown,
  fromVersion: string,
  campaign: SimulationCampaign,
  migration: SimulationMigration,
): CommandResult<unknown> {
  if (fromVersion !== migration.fromVersion || !isPlainObject(kindState)) {
    return migrationFailed();
  }

  let state: Record<string, unknown> = kindState;
  for (const step of migration.steps) {
    switch (step.op) {
      case "remap":
        state = applyRemapOrRemove(state, step.domain, undefined, step.map);
        break;
      case "remove":
        state = applyRemapOrRemove(state, step.domain, step.ids, undefined);
        break;
      case "default":
        state = applyDefault(state, step.domain, step.id);
        break;
      case "require": {
        const dangling = collectReferences(state, step.domain).filter((id) => !domainResolves(campaign, step.domain, id));
        if (dangling.length > 0) return migrationFailed();
        break;
      }
    }
  }

  return { ok: true, value: state, errors: [], warnings: [] };
}
