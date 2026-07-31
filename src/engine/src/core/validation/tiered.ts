/**
 * The Tier 1 / Tier 2 framework.
 *
 * Contract: `04-core.md` §11, §17.
 *
 * `Campaign.content: unknown` is opaque to the core by design, so node/choice/variable
 * ids, referential integrity, and everything else buried inside a campaign's own content
 * can only be checked by that campaign's own kind, via `Kind.validateCampaign` — this
 * module delegates to it. What's checked here directly is the one identifier and the one
 * `LocKey` the core touches on every campaign regardless of kind: `Campaign.id` and
 * `Campaign.titleKey`.
 *
 * Tier 2's named examples (unreachable content, unexpected cycles, `no_reachable_choice`)
 * are all story-graph-specific graph-topology concerns — the core has no Tier-2 checks of
 * its own; a kind's warnings are collected and passed through unchanged.
 */

import type { BuiltCampaign, Campaign, ContentRegistry } from "../registry/types.js";
import { buildContentRegistry } from "../registry/build.js";
import type { KindRegistry } from "../kernel/types.js";
import type { CommandResult } from "../kernel/reasons.js";
import type { ValidationError, ValidationWarning } from "./types.js";

/** 04 §17: campaign ids are kebab-case. */
const KEBAB_CASE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * 04 §17: `LocKey`s are dotted, `type.id[.field]` — two or three lowercase segments, each
 * drawn from the same ASCII `[a-z0-9_-]` every id uses (the general rule, not just the
 * `event.pipe_disaster.title`-style examples the table happens to show).
 */
const LOC_KEY_SHAPE = /^[a-z][a-z0-9_-]*(\.[a-z][a-z0-9_-]*){1,2}$/;

function validateCoreOwnedFields(campaign: Campaign, strings: ReadonlyMap<string, string>): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!KEBAB_CASE.test(campaign.id)) {
    errors.push({ code: "invalid_identifier", messageKey: "core.reason.invalid_identifier", path: campaign.id });
  }

  if (!LOC_KEY_SHAPE.test(campaign.titleKey)) {
    errors.push({ code: "invalid_loc_key", messageKey: "core.reason.invalid_loc_key", path: campaign.titleKey });
  } else if (!strings.has(campaign.titleKey)) {
    errors.push({ code: "missing_string_key", messageKey: "core.reason.missing_string_key", path: campaign.titleKey });
  }

  return errors;
}

/**
 * The only sanctioned path to a frozen `ContentRegistry`: every campaign's Tier-1 checks
 * (core-owned, above, plus its kind's own `validateCampaign`) must pass before
 * `buildContentRegistry` (`registry/build.ts`, W4) is ever called. If any Tier-1 error
 * exists anywhere in the batch, the registry is never built — "an unvalidated registry
 * can never be frozen" holds by construction for anyone entering through this function.
 *
 * `buildContentRegistry` itself is untouched and still exported — a lower-level primitive
 * this function's own success path delegates to, once validation has cleared.
 */
export function buildValidatedContentRegistry(
  builtCampaigns: readonly BuiltCampaign[],
  kinds: KindRegistry,
): CommandResult<ContentRegistry> {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  for (const { campaign, strings } of builtCampaigns) {
    errors.push(...validateCoreOwnedFields(campaign, strings));

    const kind = kinds[campaign.kindId];
    if (!kind) {
      errors.push({ code: "unknown_kind", messageKey: "core.reason.unknown_kind", path: campaign.kindId });
      continue;
    }

    const kindResult = kind.validateCampaign(campaign, strings);
    errors.push(...kindResult.errors);
    warnings.push(...kindResult.warnings);
  }

  if (errors.length > 0) {
    return { ok: false, errors, warnings };
  }

  const built = buildContentRegistry(builtCampaigns);
  if (!built.ok) {
    return { ok: false, errors: built.errors, warnings };
  }

  // `built.ok` was just checked; `value` is always set on that branch (registry/build.ts's
  // own contract) — TS doesn't discriminate CommandResult's `ok` from a plain `boolean`.
  return { ok: true, value: built.value as ContentRegistry, errors: [], warnings };
}
