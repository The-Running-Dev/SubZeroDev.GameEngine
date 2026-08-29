/**
 * Simulation kind — Tier 1/2 content validation (10-simulation-kind.md §14; W52).
 *
 * Contract: `10-simulation-kind.md` §14.
 *
 * **Covers every collection `SimulationCampaign` (`campaign.ts`, W52) now carries** — the
 * full §7.2–§7.10 content surface, replacing the two-collection scope (`goals` alone) this
 * file had before W52. Every check runs independently and collects into one report —
 * nothing short-circuits, matching `kinds/story-graph/validate.ts`'s own style.
 *
 * **Scoped exactly like `source.ts`'s own authoring surface, not every `LocKey` this kind's
 * content can carry.** `validateLocKeys` below checks the same top-level identity/label
 * fields `source.ts` converts to `AuthoredText` — a handful of deeply-nested fields
 * (`Requirement.messageKey`, `TerminationRule.messageKey`, `EventChoice.labelKey`,
 * `EventOutcome.messages[].key`) have no authoring path onto `strings` yet either (`source.ts`
 * leaves them plain `LocKey`), so checking them here would validate a promise this unit's own
 * authoring surface doesn't keep. Revisit both together.
 *
 * **Cross-reference checks cover exactly what §14 names, not every plausible one.**
 * `OpportunityDefinition.targetId`'s `"business"` `kind` has no matching definition type
 * anywhere in §7.9's list (no `BusinessDefinition` exists in this port) — skipped rather than
 * guessed at; every other `OpportunityKind` maps onto a real type. `Reward.target`/`value`
 * are untyped (`content.ts`'s own "provisional, not resolved here" callout on `Reward`), so
 * Tier 2's "no Reward ... ever references" clause is read as "no `Reward` of the matching
 * `counter`/`flag` type" for the achievement check below, not as a general reference scan
 * over every `Reward.target` — the same reason `Reward`'s payload isn't narrowed elsewhere.
 */

import type { Campaign } from "../../core/registry/types.js";
import type { LocKey } from "../../core/localization/types.js";
import type { ValidationError, ValidationResult, ValidationWarning } from "../../core/validation/types.js";
import type { Condition } from "../../core/condition/types.js";
import type { SimulationCampaign } from "./campaign.js";
import type { Modifier } from "./state.js";
import type { Reward } from "./content.js";
import { derivedValueResolver } from "./derived.js";
import { SIMULATION_REASON_CODES } from "./reasons.js";

function error(code: string, path: string): ValidationError {
  return { code, messageKey: `simulation.reason.${code}`, path };
}

function warning(code: string, path: string): ValidationWarning {
  return { code, messageKey: `simulation.reason.${code}`, path };
}

function missingStringKey(path: LocKey): ValidationError {
  return { code: "missing_string_key", messageKey: "core.reason.missing_string_key", path };
}

function readOnlyField(path: string): ValidationError {
  return { code: "read_only_field", messageKey: "core.reason.read_only_field", path };
}

// ---------------------------------------------------------------------------
// Shared helpers — duplicate ids, LocKeys, Modifier addressing
// ---------------------------------------------------------------------------

/** No two entries of one content collection share an `id` — §14's Tier 1 rule, applied
 *  independently per collection (each call site names its own `code`/`path` family). */
function duplicateIds(items: readonly { id: string }[]): string[] {
  const dupes: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.id)) dupes.push(item.id);
    seen.add(item.id);
  }
  return dupes;
}

/** The addressable stored fields a `Modifier` may target — §6.1's base/derived split, plus
 *  `calendar.committedTimeUnits` (`modifiers.ts`'s `time_commit` exception). Anything else —
 *  one of §6.1's four read-only formula paths, or a name this kind's addressing scheme has
 *  no field for — is `read_only_field`. */
const WRITABLE_TARGET_PREFIXES = ["player.needs.", "player.attributes.", "player.skills."];

function isWritableModifierTarget(target: string): boolean {
  return target === "calendar.committedTimeUnits"
    || WRITABLE_TARGET_PREFIXES.some((prefix) => target.startsWith(prefix));
}

/** Every `Modifier` a content definition carries targets a writable stored field. Reused
 *  across `startingEffects`, `ItemDefinition.effects`, `TraitDefinition.effects`, and every
 *  `DifficultyDefinition` modifier list. */
function validateModifiers(modifiers: readonly Modifier[]): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const modifier of modifiers) {
    if (derivedValueResolver.isReadOnly(modifier.target) || !isWritableModifierTarget(modifier.target)) {
      errors.push(readOnlyField(modifier.target));
    }
  }
  return errors;
}

/** §7.1: an id used as a collection's natural key (`world.npcs.<id>`,
 *  `player.education.enrollments.<courseId>`, `world.jobMarket.openings.<jobId>`,
 *  `player.career.pendingApplications.<jobId>`) may not be all-digits — indistinguishable
 *  from the rejected numeric-index form otherwise. Applies to `NPCDefinition.id`,
 *  `CourseDefinition.id`, and (W53) `JobDefinition.id` — every content id this campaign
 *  shape declares that is ever used as a natural key (`campaign.ts`'s own §7.1 addressing
 *  table; `resolvers.ts`'s `search_for_work`/`apply_for_job`). */
function validateNaturalKeyIds(ids: readonly string[]): ValidationError[] {
  return ids.filter((id) => /^\d+$/.test(id)).map((id) => error("numeric_natural_key", id));
}

// ---------------------------------------------------------------------------
// Tier 1 — duplicate ids
// ---------------------------------------------------------------------------

function validateDuplicateIds(content: SimulationCampaign): ValidationError[] {
  return [
    ...duplicateIds(content.jobs).map((id) => error("duplicate_id", id)),
    ...duplicateIds(content.courses).map((id) => error("duplicate_id", id)),
    ...duplicateIds(content.housing).map((id) => error("duplicate_id", id)),
    ...duplicateIds(content.items).map((id) => error("duplicate_id", id)),
    ...duplicateIds(content.events).map((id) => error("duplicate_id", id)),
    ...duplicateIds(content.npcs).map((id) => error("duplicate_id", id)),
    ...duplicateIds(content.goals).map((id) => error("duplicate_id", id)),
    ...duplicateIds(content.scenarios).map((id) => error("duplicate_id", id)),
    ...duplicateIds(content.difficulties).map((id) => error("duplicate_id", id)),
    ...duplicateIds(content.opportunities).map((id) => error("duplicate_id", id)),
    ...duplicateIds(content.achievements).map((id) => error("duplicate_id", id)),
    ...duplicateIds(content.headlines).map((id) => error("duplicate_id", id)),
    ...duplicateIds(content.employers).map((id) => error("duplicate_id", id)),
    ...duplicateIds(content.locations).map((id) => error("duplicate_id", id)),
    ...duplicateIds(content.backgrounds).map((id) => error("duplicate_id", id)),
    ...duplicateIds(content.traits).map((id) => error("duplicate_id", id)),
    ...duplicateIds(content.skills).map((id) => error("duplicate_id", id)),
  ];
}

// ---------------------------------------------------------------------------
// Tier 1 — cross-references (§14's named list, exactly)
// ---------------------------------------------------------------------------

function validateReferences(content: SimulationCampaign): ValidationError[] {
  const errors: ValidationError[] = [];
  const jobIds = new Set(content.jobs.map((j) => j.id));
  const courseIds = new Set(content.courses.map((c) => c.id));
  const housingIds = new Set(content.housing.map((h) => h.id));
  const itemIds = new Set(content.items.map((i) => i.id));
  const npcIds = new Set(content.npcs.map((n) => n.id));
  const goalIds = new Set(content.goals.map((g) => g.id));
  const locationIds = new Set(content.locations.map((l) => l.id));
  const backgroundIds = new Set(content.backgrounds.map((b) => b.id));

  // PromotionPath.toJobId → JobDefinition
  for (const job of content.jobs) {
    for (const path of job.promotionPaths) {
      if (!jobIds.has(path.toJobId)) errors.push(error("dangling_reference", path.toJobId));
    }
  }

  // ScenarioDefinition's own five reference fields
  for (const scenario of content.scenarios) {
    for (const id of scenario.startingBackgroundIds) {
      if (!backgroundIds.has(id)) errors.push(error("dangling_reference", id));
    }
    if (!housingIds.has(scenario.startingHousingId)) {
      errors.push(error("dangling_reference", scenario.startingHousingId));
    }
    if (!locationIds.has(scenario.startingLocationId)) {
      errors.push(error("dangling_reference", scenario.startingLocationId));
    }
    for (const id of scenario.goalIds) {
      if (!goalIds.has(id)) errors.push(error("dangling_reference", id));
    }
    for (const entry of scenario.startingInventory) {
      if (!itemIds.has(entry.definitionId)) errors.push(error("dangling_reference", entry.definitionId));
    }
  }

  // EmployerDefinition.jobIds / .npcIds → JobDefinition / NPCDefinition
  for (const employer of content.employers) {
    for (const id of employer.jobIds) {
      if (!jobIds.has(id)) errors.push(error("dangling_reference", id));
    }
    for (const id of employer.npcIds) {
      if (!npcIds.has(id)) errors.push(error("dangling_reference", id));
    }
  }

  // LocationDefinition.connections → LocationDefinition (the adjacency graph)
  for (const location of content.locations) {
    for (const id of location.connections) {
      if (!locationIds.has(id)) errors.push(error("dangling_reference", id));
    }
  }

  // OpportunityDefinition.targetId → whichever type its own `kind` names. "business" has no
  // matching definition type in this port — skipped, per this file's own header.
  for (const opportunity of content.opportunities) {
    let resolves: boolean;
    switch (opportunity.kind) {
      case "job_offer":
      case "promotion":
        resolves = jobIds.has(opportunity.targetId);
        break;
      case "course_place":
        resolves = courseIds.has(opportunity.targetId);
        break;
      case "housing":
        resolves = housingIds.has(opportunity.targetId);
        break;
      case "social":
        resolves = npcIds.has(opportunity.targetId);
        break;
      case "business":
        resolves = true;
        break;
    }
    if (!resolves) errors.push(error("dangling_reference", opportunity.targetId));
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Tier 1 — every top-level LocKey field this campaign shape's authoring surface produces
// ---------------------------------------------------------------------------

function validateLocKeys(content: SimulationCampaign, strings: ReadonlyMap<LocKey, string>): ValidationError[] {
  const errors: ValidationError[] = [];
  const check = (key: LocKey): void => {
    if (!strings.has(key)) errors.push(missingStringKey(key));
  };

  check(content.descriptionKey);
  check(content.sceneTemplateKey);
  check(content.actionLabelKeys.planAdd);
  check(content.actionLabelKeys.planRemove);
  check(content.actionLabelKeys.planClear);
  check(content.actionLabelKeys.endWeek);

  for (const job of content.jobs) { check(job.titleKey); check(job.descriptionKey); }
  for (const course of content.courses) { check(course.nameKey); check(course.descriptionKey); }
  for (const housing of content.housing) { check(housing.nameKey); check(housing.descriptionKey); }
  for (const item of content.items) { check(item.nameKey); check(item.descriptionKey); }
  for (const event of content.events) { check(event.titleKey); check(event.descriptionKey); }
  for (const npc of content.npcs) { check(npc.nameKey); check(npc.descriptionKey); }
  for (const goal of content.goals) { check(goal.labelKey); check(goal.descriptionKey); }
  for (const scenario of content.scenarios) { check(scenario.nameKey); check(scenario.descriptionKey); }
  for (const difficulty of content.difficulties) { check(difficulty.labelKey); }
  for (const opportunity of content.opportunities) { check(opportunity.nameKey); check(opportunity.descriptionKey); }
  for (const achievement of content.achievements) { check(achievement.nameKey); check(achievement.descriptionKey); }
  for (const headline of content.headlines) { check(headline.textKey); }
  for (const employer of content.employers) { check(employer.nameKey); }
  for (const location of content.locations) { check(location.nameKey); check(location.descriptionKey); }
  for (const background of content.backgrounds) { check(background.nameKey); check(background.descriptionKey); }
  for (const trait of content.traits) { check(trait.nameKey); check(trait.descriptionKey); }
  for (const skill of content.skills) { check(skill.nameKey); }

  for (const effect of content.startingEffects ?? []) check(effect.descriptionKey);

  return errors;
}

// ---------------------------------------------------------------------------
// Tier 1 — Modifier addressing, across every content collection that carries one
// ---------------------------------------------------------------------------

function validateAllModifiers(content: SimulationCampaign): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const effect of content.startingEffects ?? []) errors.push(...validateModifiers(effect.modifiers));
  for (const item of content.items) errors.push(...validateModifiers(item.effects));
  for (const trait of content.traits) errors.push(...validateModifiers(trait.effects));
  for (const difficulty of content.difficulties) {
    errors.push(...validateModifiers(difficulty.economyModifiers));
    errors.push(...validateModifiers(difficulty.needDriftModifiers));
    errors.push(...validateModifiers(difficulty.rivalStartingAdvantages));
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Tier 1 — natural-key ids may not be all-digits
// ---------------------------------------------------------------------------

function validateNaturalKeys(content: SimulationCampaign): ValidationError[] {
  return [
    ...validateNaturalKeyIds(content.npcs.map((n) => n.id)),
    ...validateNaturalKeyIds(content.courses.map((c) => c.id)),
    // W53's resolvers.ts addresses JobOpening/JobApplication by job id
    // (world.jobMarket.openings.<jobId>.*, player.career.pendingApplications.<jobId>.*) —
    // the same natural-key addressing npcs/courses already require this check for.
    ...validateNaturalKeyIds(content.jobs.map((j) => j.id)),
  ];
}

// ---------------------------------------------------------------------------
// Tier 2 — unreachable content
// ---------------------------------------------------------------------------

/** A `GoalDefinition` no `ScenarioDefinition.goalIds` ever names. */
function validateUnreachableGoals(content: SimulationCampaign): ValidationWarning[] {
  const referenced = new Set(content.scenarios.flatMap((s) => s.goalIds));
  return content.goals
    .filter((g) => !referenced.has(g.id))
    .map((g) => warning("unreachable_content", g.id));
}

/** A `JobDefinition` no `EmployerDefinition`, `PromotionPath`, or job-kind `Opportunity`
 *  ever references. */
function validateUnreachableJobs(content: SimulationCampaign): ValidationWarning[] {
  const referenced = new Set<string>();
  for (const employer of content.employers) for (const id of employer.jobIds) referenced.add(id);
  for (const job of content.jobs) for (const path of job.promotionPaths) referenced.add(path.toJobId);
  for (const opportunity of content.opportunities) {
    if (opportunity.kind === "job_offer" || opportunity.kind === "promotion") referenced.add(opportunity.targetId);
  }
  return content.jobs
    .filter((j) => !referenced.has(j.id))
    .map((j) => warning("unreachable_content", j.id));
}

/** A `HousingDefinition` no scenario's starting state and no housing-kind `Opportunity`
 *  ever references. */
function validateUnreachableHousing(content: SimulationCampaign): ValidationWarning[] {
  const referenced = new Set<string>();
  for (const scenario of content.scenarios) referenced.add(scenario.startingHousingId);
  for (const opportunity of content.opportunities) {
    if (opportunity.kind === "housing") referenced.add(opportunity.targetId);
  }
  return content.housing
    .filter((h) => !referenced.has(h.id))
    .map((h) => warning("unreachable_content", h.id));
}

/** Every `LocationDefinition.id` reachable from some scenario's `startingLocationId`, by the
 *  static `connections` adjacency graph (§7.9) — structural reachability, the only kind a
 *  load-time check can evaluate; a location's own `unlockedBy` needs runtime state this pass
 *  never has. */
function reachableLocationIds(content: SimulationCampaign): Set<string> {
  const byId = new Map(content.locations.map((l) => [l.id, l] as const));
  const visited = new Set<string>();
  const queue = content.scenarios.map((s) => s.startingLocationId);
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    for (const next of byId.get(id)?.connections ?? []) {
      if (!visited.has(next)) queue.push(next);
    }
  }
  return visited;
}

/** An `ItemDefinition` no scenario's starting inventory ever references, and no reachable
 *  location's `actionTypes` permits `shop` (W94.3) — `shop` (`resolvers.ts`) buys any
 *  `ItemDefinition` by id from a location that allows it, unconstrained by a per-location
 *  stock list, so one reachable shop-capable location makes every item reachable, not just
 *  the one a test happens to name. */
function validateUnreachableItems(content: SimulationCampaign): ValidationWarning[] {
  const referenced = new Set(content.scenarios.flatMap((s) => s.startingInventory.map((i) => i.definitionId)));
  const reachable = reachableLocationIds(content);
  const shopReachable = content.locations.some((l) => reachable.has(l.id) && l.actionTypes.includes("shop"));
  if (shopReachable) return [];
  return content.items
    .filter((i) => !referenced.has(i.id))
    .map((i) => warning("unreachable_content", i.id));
}

// ---------------------------------------------------------------------------
// Tier 2 — an achievement condition referencing an unwritten counter/flag
// ---------------------------------------------------------------------------

/** Every `field` path a `Condition` tree names, walking `all`/`any`/`not`/`exists.where`/
 *  `count.where` recursively. */
function collectFieldPaths(condition: Condition): string[] {
  if ("field" in condition) return [condition.field];
  if ("all" in condition) return condition.all.flatMap(collectFieldPaths);
  if ("any" in condition) return condition.any.flatMap(collectFieldPaths);
  if ("not" in condition) return collectFieldPaths(condition.not);
  if ("exists" in condition) return collectFieldPaths(condition.exists.where);
  return collectFieldPaths(condition.count.where);
}

function allRewards(content: SimulationCampaign): Reward[] {
  const rewards: Reward[] = [];
  for (const course of content.courses) rewards.push(...course.rewards);
  for (const goal of content.goals) rewards.push(...(goal.rewards ?? []));
  for (const opportunity of content.opportunities) rewards.push(...(opportunity.acceptRewards ?? []));
  for (const event of content.events) {
    const outcomes = [
      ...(event.automaticOutcome ? [event.automaticOutcome] : []),
      ...(event.choices ?? []).flatMap((c) => c.outcomes.map((o) => o.outcome)),
    ];
    for (const outcome of outcomes) rewards.push(...(outcome.rewards ?? []));
  }
  return rewards;
}

/** A `AchievementDefinition.condition` referencing `player.counters.<key>` or
 *  `player.flags.<key>` for a key no `"counter"`/`"flag"`-type `Reward` in the campaign ever
 *  grants — satisfiable only by chance, not by design.
 *
 *  `player.counters` also gets an entry per reason code through `advance.ts`'s automatic
 *  `foldCounters` (§6.2) — every `SIMULATION_REASON_CODES` value is therefore a granted
 *  counter key too, independent of any campaign `Reward`, or this check flags an achievement
 *  like `player.counters.action_rest >= 1` as unsatisfiable when it is reachable by design. */
function validateUnsatisfiableAchievements(content: SimulationCampaign): ValidationWarning[] {
  const grantedCounters = new Set<string>(SIMULATION_REASON_CODES);
  const grantedFlags = new Set<string>();
  for (const reward of allRewards(content)) {
    if (reward.target === undefined) continue;
    if (reward.type === "counter") grantedCounters.add(reward.target);
    if (reward.type === "flag") grantedFlags.add(reward.target);
  }

  const warnings: ValidationWarning[] = [];
  for (const achievement of content.achievements) {
    for (const path of collectFieldPaths(achievement.condition)) {
      if (path.startsWith("player.counters.") && !grantedCounters.has(path.slice("player.counters.".length))) {
        warnings.push(warning("unsatisfiable_achievement", achievement.id));
      } else if (path.startsWith("player.flags.") && !grantedFlags.has(path.slice("player.flags.".length))) {
        warnings.push(warning("unsatisfiable_achievement", achievement.id));
      }
    }
  }
  return warnings;
}

// ---------------------------------------------------------------------------

/** `Kind<SimulationKindState>.validateCampaign`. */
export function validateCampaign(campaign: Campaign, strings: ReadonlyMap<LocKey, string>): ValidationResult {
  const content = campaign.content as SimulationCampaign;

  const errors: ValidationError[] = [
    ...validateDuplicateIds(content),
    ...validateReferences(content),
    ...validateLocKeys(content, strings),
    ...validateAllModifiers(content),
    ...validateNaturalKeys(content),
  ];

  const warnings: ValidationWarning[] = [
    ...validateUnreachableGoals(content),
    ...validateUnreachableJobs(content),
    ...validateUnreachableHousing(content),
    ...validateUnreachableItems(content),
    ...validateUnsatisfiableAchievements(content),
  ];

  return { ok: errors.length === 0, errors, warnings };
}
