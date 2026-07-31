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
import type { LocKey } from "../localization/types.js";
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
 * Duplicate campaign ids **are** checked here, even though "duplicate ids" is also a
 * Tier 1 concern (04 §11) that's W5's job. The two aren't the same check: `validateCampaign`
 * takes one `Campaign` at a time (04 §3), so it structurally cannot see that a *different*
 * campaign being assembled into the same registry already claimed an id — only whatever
 * assembles the whole set can catch that, which is here.
 *
 * `kindMessages` merges in each registered kind's own default reason-code messages (e.g.
 * `kinds/story-graph/reasons.ts`'s `STORY_GRAPH_REASON_MESSAGES`) — this module is
 * core-owned and cannot import a kind directly (the dependency-arrow rule), so a
 * composition root supplies them. Defaults to `[]`: nothing calls this with kind messages
 * yet (no composition root exists), so every existing caller is unaffected. Only
 * `core.reason.*` gets `PROTECTED_PREFIX`'s hard campaign-write rejection; a campaign
 * colliding with a kind's own namespace instead surfaces as an ordinary `string_conflict`
 * from the merge below — still a hard failure, just not a specifically-named one.
 */
export function buildContentRegistry(
  builtCampaigns: readonly BuiltCampaign[],
  kindMessages: readonly ReadonlyMap<LocKey, string>[] = [],
): CommandResult<ContentRegistry> {
  // Checked first, and short-circuits before any merging: a silently dropped duplicate
  // (the later campaign overwriting the earlier one in a plain Map build) would still let
  // that duplicate's strings leak into the merged table even though its Campaign entry
  // vanished from `campaigns`.
  const seenIds = new Set<string>();
  const duplicateIds: ValidationError[] = [];
  for (const { campaign } of builtCampaigns) {
    if (seenIds.has(campaign.id)) {
      duplicateIds.push({
        code: "duplicate_campaign_id",
        messageKey: "core.reason.duplicate_campaign_id",
        path: campaign.id,
      });
    }
    seenIds.add(campaign.id);
  }
  if (duplicateIds.length > 0) {
    return { ok: false, errors: duplicateIds, warnings: [] };
  }

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

  const merged = mergeStringTables([CORE_REASON_MESSAGES, ...kindMessages, ...builtCampaigns.map((b) => b.strings)]);
  if (!merged.ok) {
    return { ok: false, errors: conflictErrors(merged.conflicts), warnings: [] };
  }

  const campaigns = new Map<string, Campaign>(builtCampaigns.map((b) => [b.campaign.id, b.campaign]));

  return { ok: true, value: { campaigns, strings: merged.strings }, errors: [], warnings: [] };
}
