/**
 * Campaign composition — content crossing a campaign boundary at registry build.
 *
 * Contract: `04-core.md` §10.4, §11; `11-content-packs.md` §3a, §7.
 *
 * The core owns the envelope and the kind owns the merge. This module checks every include
 * and attachment against the registry input — the target exists, the pin names its
 * *authored* version, the kinds agree, nothing includes itself, the alias is well-formed
 * and unique, the host's kind can compose — and only when all of that holds does it call
 * `Kind.composeContent`, once per host, depth-first, each campaign composed once and
 * reused. Both validated entry points (`validation/tiered.ts`) run it before any Tier 1 or
 * Tier 2 check, so validation sees the content play will see.
 */

import type { KindRegistry } from "../kernel/types.js";
import type { CommandResult } from "../kernel/reasons.js";
import type { LocKey } from "../localization/types.js";
import type { ValidationError } from "../validation/types.js";
import type {
  BuiltCampaign,
  Campaign,
  CampaignAttachment,
  CampaignInclude,
  ComposedAttachment,
  ComposedModule,
} from "./types.js";

/** 04 §17: an alias is an authored id — ASCII `[a-z0-9_-]`, so never a `:`. */
const ALIAS_SHAPE = /^[a-z0-9_-]+$/;

export interface CompositionInput {
  /** The registry input, in the order composition walks it (04 §10.4). */
  readonly builtCampaigns: readonly BuiltCampaign[];
  /** What an include's `ref.version` is checked against — never a stamped resolution id. */
  readonly authoredVersions: ReadonlyMap<string, string>;
  /** In pack order, then declaration order (11 §3a). */
  readonly attachments: readonly CampaignAttachment[];
}

export interface CompositionOutput {
  /** The input, position for position, with each host's `content` composed. A campaign
   *  that composes nothing is the same object it was. Strings are the campaign's own. */
  readonly builtCampaigns: readonly BuiltCampaign[];
  /** Per position: the campaign's own strings united with every module it composed,
   *  transitively — the table its own validation runs against (04 §11). */
  readonly validationStrings: readonly ReadonlyMap<LocKey, string>[];
}

function compositionError(code: string, path: string, details?: Readonly<Record<string, string | number>>): ValidationError {
  return { code, messageKey: `core.reason.${code}`, path, ...(details ? { details } : {}) };
}

/**
 * Composes every campaign that declares an include or receives an attachment. Fails with
 * every envelope error at once and composes nothing if any exists; otherwise fails with
 * whatever the kinds' `composeContent` calls rejected.
 */
export function composeCampaigns(input: CompositionInput, kinds: KindRegistry): CommandResult<CompositionOutput> {
  const { builtCampaigns, authoredVersions, attachments } = input;

  // Last wins, as the pack fold's own whole-campaign replace does; a duplicate id fails
  // registry assembly regardless (`build.ts`).
  const byId = new Map<string, BuiltCampaign>();
  for (const built of builtCampaigns) byId.set(built.campaign.id, built);

  const attachmentsByHost = new Map<string, CampaignAttachment[]>();
  const errors: ValidationError[] = [];

  const checkInclude = (host: Campaign, include: CampaignInclude, aliases: Set<string>): void => {
    const path = `${host.id}.${include.alias}`;
    if (!ALIAS_SHAPE.test(include.alias)) {
      errors.push(compositionError("invalid_identifier", path));
    } else if (aliases.has(include.alias)) {
      errors.push(compositionError("include_alias_collision", path));
    }
    aliases.add(include.alias);

    const target = byId.get(include.ref.id);
    if (!target) {
      errors.push(compositionError("include_missing", path, { campaignId: include.ref.id }));
      return;
    }
    const authored = authoredVersions.get(include.ref.id) ?? target.campaign.version;
    if (include.ref.version !== authored) {
      errors.push(
        compositionError("include_version_mismatch", path, { pinned: include.ref.version, authored }),
      );
    }
    if (target.campaign.kindId !== host.kindId) {
      errors.push(
        compositionError("include_kind_mismatch", path, { hostKindId: host.kindId, moduleKindId: target.campaign.kindId }),
      );
    }
  };

  for (const attachment of attachments) {
    if (!byId.has(attachment.hostCampaignId)) {
      errors.push(compositionError("attachment_host_missing", attachment.hostCampaignId));
      continue;
    }
    const list = attachmentsByHost.get(attachment.hostCampaignId);
    if (list) list.push(attachment);
    else attachmentsByHost.set(attachment.hostCampaignId, [attachment]);
  }

  /** A host's modules in composition order: its includes as declared, then its attachments. */
  const edges = (campaign: Campaign): CampaignInclude[] => [
    ...(campaign.includes ?? []),
    ...(attachmentsByHost.get(campaign.id) ?? []).map((attachment) => attachment.include),
  ];

  for (const { campaign } of builtCampaigns) {
    const aliases = new Set<string>();
    for (const include of edges(campaign)) checkInclude(campaign, include, aliases);
  }

  errors.push(...cycleErrors(builtCampaigns, byId, edges));

  for (const { campaign } of builtCampaigns) {
    if (edges(campaign).length === 0) continue;
    const kind = kinds[campaign.kindId];
    // An unknown kind is `unknown_kind` at validation, not this check's to name.
    if (kind && !kind.composeContent) errors.push(compositionError("compose_unsupported", campaign.id));
  }

  if (errors.length > 0) return { ok: false, errors, warnings: [] };

  // Depth-first, each campaign composed once: a module is always included in its composed
  // form, so an attachment on a module reaches every host that includes it.
  const composed = new Map<string, BuiltCampaign>();
  const unions = new Map<string, ReadonlyMap<LocKey, string>>();
  const composeErrors: ValidationError[] = [];

  const compose = (built: BuiltCampaign): BuiltCampaign => {
    const id = built.campaign.id;
    const done = composed.get(id);
    if (done) return done;

    const includes = built.campaign.includes ?? [];
    const hostAttachments = attachmentsByHost.get(id) ?? [];
    if (includes.length === 0 && hostAttachments.length === 0) {
      composed.set(id, built);
      unions.set(id, built.strings);
      return built;
    }

    const moduleOf = (include: CampaignInclude): ComposedModule => ({
      include,
      campaign: compose(byId.get(include.ref.id)!).campaign,
    });
    const modules = includes.map(moduleOf);
    const attached: ComposedAttachment[] = hostAttachments.map((attachment) => ({
      payload: attachment.payload,
      module: moduleOf(attachment.include),
    }));

    // Module strings first, so a host's own text wins inside its own validation table; two
    // campaigns disagreeing on one key still fail registry assembly as `string_conflict`.
    const union = new Map<LocKey, string>();
    for (const module of [...modules, ...attached.map((a) => a.module)]) {
      for (const [key, text] of unions.get(module.campaign.id)!) union.set(key, text);
    }
    for (const [key, text] of built.strings) union.set(key, text);
    unions.set(id, union);

    const result = kinds[built.campaign.kindId]!.composeContent!(built.campaign, modules, attached);
    if (!result.ok) {
      composeErrors.push(...result.errors);
      composed.set(id, built);
      return built;
    }
    const next: BuiltCampaign = { campaign: { ...built.campaign, content: result.value }, strings: built.strings };
    composed.set(id, next);
    return next;
  };

  const out: BuiltCampaign[] = [];
  const validationStrings: ReadonlyMap<LocKey, string>[] = [];
  for (const built of builtCampaigns) {
    if (!kinds[built.campaign.kindId]) {
      out.push(built);
      validationStrings.push(built.strings);
      continue;
    }
    // A duplicate id composes as the campaign `byId` holds; assembly rejects it either way.
    const held = byId.get(built.campaign.id)!;
    const result = compose(held);
    out.push(result === held ? built : { campaign: result.campaign, strings: built.strings });
    validationStrings.push(unions.get(built.campaign.id)!);
  }

  if (composeErrors.length > 0) return { ok: false, errors: composeErrors, warnings: [] };
  return { ok: true, value: { builtCampaigns: out, validationStrings }, errors: [], warnings: [] };
}

/**
 * Every include cycle, direct or transitive, each reported once with its path written
 * `a -> b -> a`. Walked in registry-input order, edges in composition order, so the report
 * is deterministic.
 */
function cycleErrors(
  builtCampaigns: readonly BuiltCampaign[],
  byId: ReadonlyMap<string, BuiltCampaign>,
  edges: (campaign: Campaign) => CampaignInclude[],
): ValidationError[] {
  const errors: ValidationError[] = [];
  const state = new Map<string, "active" | "done">();

  const visit = (id: string, stack: string[]): void => {
    state.set(id, "active");
    stack.push(id);
    for (const include of edges(byId.get(id)!.campaign)) {
      const next = include.ref.id;
      if (!byId.has(next)) continue; // `include_missing`, already reported
      const seen = state.get(next);
      if (seen === "active") {
        const cycle = [...stack.slice(stack.indexOf(next)), next];
        errors.push(compositionError("include_cycle", cycle.join(" -> ")));
      } else if (seen === undefined) {
        visit(next, stack);
      }
    }
    stack.pop();
    state.set(id, "done");
  };

  for (const { campaign } of builtCampaigns) {
    if (!state.has(campaign.id)) visit(campaign.id, []);
  }
  return errors;
}
