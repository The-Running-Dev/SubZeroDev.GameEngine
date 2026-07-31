/**
 * The authoring → registry boundary: the generic half.
 *
 * Contract: `04-core.md` §10.1, §12.
 *
 * `buildCampaign` is the "AuthoredText → BuiltCampaign pure builder" TODO's W4 names —
 * generic and kind-agnostic, reused by every kind's own future source-schema builder
 * (walking a kind-specific source to find embedded `AuthoredText` is that kind's job;
 * `Campaign.content: unknown` is opaque to the core by design, 04 §2). `buildContentRegistry`
 * assembles and freezes the registry from a set of already-built campaigns plus the core's
 * own protected strings. Neither performs any I/O — parsing and files live in an outer
 * adapter that doesn't exist yet.
 */

import type { AuthoredText, BuiltCampaign, Campaign, ContentRegistry } from "./types.js";
import { CORE_REASON_MESSAGES, type CommandResult } from "../kernel/reasons.js";
import type { ValidationError } from "../validation/types.js";
import { mergeStringTables, type StringConflict } from "./strings.js";

const PROTECTED_PREFIX = "core.reason.";

function conflictErrors(conflicts: readonly StringConflict[]): ValidationError[] {
  return conflicts.map((c) => ({
    code: "string_conflict",
    messageKey: "core.reason.string_conflict",
    path: c.key,
    details: { existingText: c.existing, incomingText: c.incoming },
  }));
}

/**
 * Deduplicates and freezes one campaign's authored text into its `strings` table.
 * Identical key/text pairs collapse; the same key with different text fails with every
 * conflict reported, not just the first.
 */
export function buildCampaign(campaign: Campaign, authoredText: readonly AuthoredText[]): CommandResult<BuiltCampaign> {
  const result = mergeStringTables(authoredText.map(({ key, text }) => new Map([[key, text]])));

  if (!result.ok) {
    return { ok: false, errors: conflictErrors(result.conflicts), warnings: [] };
  }

  return { ok: true, value: { campaign, strings: result.strings }, errors: [], warnings: [] };
}

/**
 * Assembles the frozen `ContentRegistry` from a set of already-built campaigns plus the
 * core's own protected `core.reason.*` messages.
 *
 * Duplicate campaign ids are **not** checked here — that's Tier 1 (04 §11 names it
 * explicitly), which runs before a registry is frozen and is W5's job. This function
 * trusts its input the same way `submitAction` trusts a `GameState` it didn't itself
 * validate.
 */
export function buildContentRegistry(builtCampaigns: readonly BuiltCampaign[]): CommandResult<ContentRegistry> {
  // Checked independently of the merge below: a campaign string that happens to match the
  // core's own default text would otherwise dedupe silently and never surface as a
  // conflict, letting a protected-namespace write through unnoticed.
  const protectedWrites: ValidationError[] = [];
  for (const { campaign, strings } of builtCampaigns) {
    for (const key of strings.keys()) {
      if (key.startsWith(PROTECTED_PREFIX)) {
        protectedWrites.push({
          code: "protected_string_key",
          messageKey: "core.reason.protected_string_key",
          path: key,
          details: { campaignId: campaign.id },
        });
      }
    }
  }
  if (protectedWrites.length > 0) {
    return { ok: false, errors: protectedWrites, warnings: [] };
  }

  const merged = mergeStringTables([CORE_REASON_MESSAGES, ...builtCampaigns.map((b) => b.strings)]);
  if (!merged.ok) {
    return { ok: false, errors: conflictErrors(merged.conflicts), warnings: [] };
  }

  const campaigns = new Map<string, Campaign>(builtCampaigns.map((b) => [b.campaign.id, b.campaign]));

  return { ok: true, value: { campaigns, strings: merged.strings }, errors: [], warnings: [] };
}
