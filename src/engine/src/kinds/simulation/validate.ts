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
 *
 * **Revisit when** `SimulationCampaign` grows a new collection (jobs, courses, housing, …)
 * — each one brings its own slice of §14's reference-resolution and addressing rules, to
 * be added here alongside the unit that adds the collection, not guessed at now.
 */

import type { Campaign } from "../../core/registry/types.js";
import type { LocKey } from "../../core/localization/types.js";
import type { ValidationError, ValidationResult } from "../../core/validation/types.js";
import type { SimulationCampaign } from "./campaign.js";

function error(code: string, path: string): ValidationError {
  return { code, messageKey: `simulation.reason.${code}`, path };
}

function missingStringKey(path: LocKey): ValidationError {
  return { code: "missing_string_key", messageKey: "core.reason.missing_string_key", path };
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

/** `Kind<SimulationKindState>.validateCampaign`. */
export function validateCampaign(campaign: Campaign, strings: ReadonlyMap<LocKey, string>): ValidationResult {
  const content = campaign.content as SimulationCampaign;

  const errors: ValidationError[] = [
    ...validateGoalIds(content),
    ...validateLocKeys(content, strings),
  ];

  return { ok: errors.length === 0, errors, warnings: [] };
}
