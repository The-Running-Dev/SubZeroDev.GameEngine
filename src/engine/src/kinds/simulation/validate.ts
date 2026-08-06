/**
 * Simulation kind — Tier 1/2 content validation (10-simulation-kind.md §14).
 *
 * Contract: `10-simulation-kind.md` §14.
 *
 * **Scoped to what `SimulationCampaign` actually carries today, not §14's full list.**
 * §14 enumerates checks across every content-definition type §7 names — jobs, courses,
 * housing, items, events, NPCs, scenarios, difficulty, opportunities, achievements,
 * headlines, employers, locations, backgrounds, traits, skills. `SimulationCampaign`
 * (`campaign.ts`) has exactly two content collections so far: `goals` and
 * `goalFailurePrecedence` (W39) — everything else in §14's list has no field to check yet.
 * Implementing checks against collections that don't exist would be validating a shape
 * this kind doesn't have, not content this kind can actually load. This file covers:
 *
 * - Tier 1: no two `GoalDefinition`s share an `id` (§14's duplicate-id rule, the one
 *   instance of it this campaign shape can produce).
 * - Tier 1: every `LocKey` this campaign shape declares (`descriptionKey`, each
 *   goal's `labelKey`/`descriptionKey`, `sceneTemplateKey` and each `actionLabelKeys`
 *   entry — W50) resolves in `strings` — reuses the base `missing_string_key` code rather
 *   than inventing one, the same choice `kinds/story-graph/reasons.ts` made for the
 *   identical check. This is what makes §9's "a `LocKey` `scene` references but the
 *   registry does not resolve fails registry construction" true at load time, not just at
 *   the runtime backstop `scene.ts`'s own `throw` provides.
 * - Tier 1: `startingEffects` (W51.6) — the one hand-authored `StatusEffect` collection this
 *   campaign shape carries — has each `descriptionKey` resolve in `strings`, and each
 *   `Modifier.target` name a writable stored field (`player.needs.*`,
 *   `player.attributes.*`, `player.skills.*`, or `calendar.committedTimeUnits` — §6.1's own
 *   `time_commit` exception). `Modifier.target` is untyped `string`, not `DerivedPath`
 *   (`state.ts`), so nothing catches a target naming one of §6.1's four read-only formula
 *   paths, or an unaddressable one, before this check does — the same `read_only_field`
 *   code §14 assigns a `Modifier` targeting a derived field at load time.
 *
 * **Revisit when** `SimulationCampaign` grows a new collection (jobs, courses, housing, …)
 * — each one brings its own slice of §14's reference-resolution and addressing rules, to
 * be added here alongside the unit that adds the collection, not guessed at now.
 */

import type { Campaign } from "../../core/registry/types.js";
import type { LocKey } from "../../core/localization/types.js";
import type { ValidationError, ValidationResult } from "../../core/validation/types.js";
import type { SimulationCampaign } from "./campaign.js";
import { derivedValueResolver } from "./derived.js";

function error(code: string, path: string): ValidationError {
  return { code, messageKey: `simulation.reason.${code}`, path };
}

function missingStringKey(path: LocKey): ValidationError {
  return { code: "missing_string_key", messageKey: "core.reason.missing_string_key", path };
}

function readOnlyField(path: string): ValidationError {
  return { code: "read_only_field", messageKey: "core.reason.read_only_field", path };
}

/** The addressable stored fields a `startingEffects` `Modifier` may target — §6.1's
 *  base/derived split, plus `calendar.committedTimeUnits` (`modifiers.ts`'s `time_commit`
 *  exception). Anything else — one of §6.1's four read-only formula paths, or a name this
 *  kind's addressing scheme has no field for — is `read_only_field`. */
const WRITABLE_TARGET_PREFIXES = ["player.needs.", "player.attributes.", "player.skills."];

function isWritableModifierTarget(target: string): boolean {
  return target === "calendar.committedTimeUnits"
    || WRITABLE_TARGET_PREFIXES.some((prefix) => target.startsWith(prefix));
}

/** No two `GoalDefinition`s share an `id`. */
function validateGoalIds(content: SimulationCampaign): ValidationError[] {
  const errors: ValidationError[] = [];
  const seen = new Set<string>();
  for (const goal of content.goals) {
    if (seen.has(goal.id)) errors.push(error("duplicate_id", goal.id));
    seen.add(goal.id);
  }
  return errors;
}

/** Every `LocKey` this campaign shape declares resolves in `strings`. */
function validateLocKeys(content: SimulationCampaign, strings: ReadonlyMap<LocKey, string>): ValidationError[] {
  const errors: ValidationError[] = [];
  const check = (key: LocKey): void => {
    if (!strings.has(key)) errors.push(missingStringKey(key));
  };

  check(content.descriptionKey);
  for (const goal of content.goals) {
    check(goal.labelKey);
    check(goal.descriptionKey);
  }
  check(content.sceneTemplateKey);
  check(content.actionLabelKeys.planAdd);
  check(content.actionLabelKeys.planRemove);
  check(content.actionLabelKeys.planClear);
  check(content.actionLabelKeys.endWeek);

  return errors;
}

/** Each `startingEffects` entry's `descriptionKey` resolves in `strings`, and each of its
 *  `Modifier.target`s is a writable stored field — never one of §6.1's four read-only
 *  formula paths, and never an unaddressable name. */
function validateStartingEffects(content: SimulationCampaign, strings: ReadonlyMap<LocKey, string>): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const effect of content.startingEffects ?? []) {
    if (!strings.has(effect.descriptionKey)) errors.push(missingStringKey(effect.descriptionKey));
    for (const modifier of effect.modifiers) {
      if (derivedValueResolver.isReadOnly(modifier.target) || !isWritableModifierTarget(modifier.target)) {
        errors.push(readOnlyField(modifier.target));
      }
    }
  }
  return errors;
}

/** `Kind<SimulationKindState>.validateCampaign`. */
export function validateCampaign(campaign: Campaign, strings: ReadonlyMap<LocKey, string>): ValidationResult {
  const content = campaign.content as SimulationCampaign;

  const errors: ValidationError[] = [
    ...validateGoalIds(content),
    ...validateLocKeys(content, strings),
    ...validateStartingEffects(content, strings),
  ];

  return { ok: errors.length === 0, errors, warnings: [] };
}
