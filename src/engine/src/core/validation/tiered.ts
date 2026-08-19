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
import { resolvePacks, type ContentPack } from "../registry/packs.js";
import type { Kind, KindId, KindRegistry } from "../kernel/types.js";
import type { CommandResult } from "../kernel/reasons.js";
import type { LocKey } from "../localization/types.js";
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
 * 04 §12's completeness promise — "validation fails if any registered reason code has no
 * localized message" — checked against the kind's own `reasonMessages` (`kernel/types.ts`),
 * not the merged registry: a kind with a gap in its own table must fail even before its
 * messages ever reach `buildContentRegistry`'s merge.
 */
function missingReasonCodeMessages(kind: Kind<unknown>): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const code of kind.reasonCodes) {
    const key: LocKey = `${kind.id}.reason.${code}`;
    if (!kind.reasonMessages.has(key)) {
      errors.push({
        code: "missing_kind_reason_message",
        messageKey: "core.reason.missing_kind_reason_message",
        path: key,
        details: { kindId: kind.id },
      });
    }
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
 *
 * Threads each *used* kind's `reasonMessages` into `buildContentRegistry`'s own
 * `kindMessages` param, and — per kind, once, not once per campaign — runs
 * `missingReasonCodeMessages` so a kind that declares a `reasonCodes` entry with no
 * matching message fails registry construction instead of silently never resolving (04
 * §12). Only kinds actually referenced by `builtCampaigns` are checked and threaded; a
 * kind never used in this batch (including a `KindRegistry` test double missing some of
 * its entries) is never touched.
 */
export function buildValidatedContentRegistry(
  builtCampaigns: readonly BuiltCampaign[],
  kinds: KindRegistry,
): CommandResult<ContentRegistry> {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const checkedKindIds = new Set<KindId>();
  const kindMessages: ReadonlyMap<LocKey, string>[] = [];

  for (const { campaign, strings } of builtCampaigns) {
    errors.push(...validateCoreOwnedFields(campaign, strings));

    const kind = kinds[campaign.kindId];
    if (!kind) {
      errors.push({ code: "unknown_kind", messageKey: "core.reason.unknown_kind", path: campaign.kindId });
      continue;
    }

    if (!checkedKindIds.has(kind.id)) {
      checkedKindIds.add(kind.id);
      errors.push(...missingReasonCodeMessages(kind));
      kindMessages.push(kind.reasonMessages);
    }

    const kindResult = kind.validateCampaign(campaign, strings);
    errors.push(...kindResult.errors);
    warnings.push(...kindResult.warnings);
  }

  if (errors.length > 0) {
    return { ok: false, errors, warnings };
  }

  const built = buildContentRegistry(builtCampaigns, kindMessages);
  if (!built.ok) {
    return { ok: false, errors: built.errors, warnings };
  }

  // `built.ok` was just checked; `value` is always set on that branch (registry/build.ts's
  // own contract) — TS doesn't discriminate CommandResult's `ok` from a plain `boolean`.
  return { ok: true, value: built.value as ContentRegistry, errors: [], warnings };
}

/**
 * The sanctioned path from an ordered pack set (11 §3) to a validated, frozen registry —
 * the two-stage sequence `resolvePacks` then `buildValidatedContentRegistry` folded
 * together, with the fold's `ResolutionId` reattached. Neither stage can do this alone:
 * `resolvePacks` runs no `Kind.validateCampaign` (11 §3), and `buildValidatedContentRegistry`
 * "knows no packs exist" so it has nothing to stamp `resolution` with (04 §10.1).
 *
 * Fails at whichever stage fails, reporting only that stage's errors and no registry — the
 * fold's own Tier 1 checks (§7: kind/campaign mismatch, dependency conflicts, cycles,
 * protected-string writes) short-circuit before a single campaign is ever validated.
 * Tier 2 warnings from both stages are combined into one result, never one discarded for
 * the other.
 *
 * Every campaign is validated against the *folded* string table, not its own pack's —
 * the same table 11 §3's per-key replace produces, so a campaign whose `titleKey` resolves
 * only through a later pack's contribution validates the same as one whose own pack always
 * carried it.
 */
export function buildValidatedPackRegistry(
  packs: readonly ContentPack[],
  kinds: KindRegistry,
): CommandResult<ContentRegistry> {
  const folded = resolvePacks(packs);
  if (!folded.ok || !folded.value) {
    return { ok: false, errors: folded.errors, warnings: folded.warnings };
  }
  const { campaigns, strings, resolution } = folded.value;
  // Optional on the type, but never absent on a folded registry (04 §10.1) — asserted
  // rather than spread away, so the reattachment below cannot silently become a no-op.
  if (resolution === undefined) throw new Error("buildValidatedPackRegistry: expected the fold to name its resolution");

  const validated = buildValidatedContentRegistry(
    Array.from(campaigns.values(), (campaign) => ({ campaign, strings })),
    kinds,
  );
  if (!validated.ok || !validated.value) {
    return { ok: false, errors: validated.errors, warnings: [...folded.warnings, ...validated.warnings] };
  }

  return {
    ok: true,
    value: { ...validated.value, resolution },
    errors: [],
    warnings: [...folded.warnings, ...validated.warnings],
  };
}
