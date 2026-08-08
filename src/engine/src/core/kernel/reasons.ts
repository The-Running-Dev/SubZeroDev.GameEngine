/**
 * Core result vocabulary — reason codes, audit records, messages, command results.
 *
 * Contract: `04-core.md` §12.
 *
 * Lives in `kernel` rather than `localization` even though §1.1's table maps §12 there:
 * these are what `advance` and `submitAction` return. `localization` owns the other half
 * of §12 — `LocKey` and the string table. See `localization/types.ts` for the note.
 */

import type { LocKey } from "../localization/types.js";
import type { ValidationError, ValidationWarning } from "../validation/types.js";

/**
 * Stable and machine-readable; additive, never renamed. Clients never string-match
 * English (04 §12) — this is what makes that enforceable.
 */
export type ReasonCode = string;

/**
 * The kind-agnostic base set. Every one ships a default-English message under the
 * reserved `core.reason.*` namespace, and registry construction rejects any campaign
 * attempting to override it. Kinds extend this via `Kind.reasonCodes`.
 *
 * `unknown_campaign`, `unknown_kind`, and `invalid_state` were added during W3 — the
 * pure engine kernel (`createGame`, `submitAction`, `deserialize`) needs a rejection code
 * for each and none of the original seven fit. See `plans/09-w3-pure-engine-kernel.md`,
 * Decision 2.
 *
 * `string_conflict` and `protected_string_key` were added during W4 — registry assembly
 * (`registry/build.ts`) needs a code for each of its two hard-fail conditions. See
 * `plans/11-w4-registry-authoring-localization.md`, Decision 1.
 *
 * `duplicate_campaign_id` was added on review of the same PR: `Kind.validateCampaign`
 * (Tier 1, 04 §11) sees one campaign at a time, so it structurally cannot catch two
 * different campaigns sharing an id — only whatever assembles the whole registry can.
 * That's `buildContentRegistry`, so the code belongs beside the other two it already owns.
 *
 * `invalid_identifier`, `invalid_loc_key`, and `missing_string_key` were added during W5
 * (`validation/tiered.ts`) — the core's own Tier-1 checks (campaign id shape, `titleKey`
 * shape, `titleKey` resolving in that campaign's strings, 04 §11/§17) needed a code each.
 * See `plans/12-w5-tiered-validation.md`, Decision 1.
 *
 * `profile_missing`, `profile_corrupt`, and `profile_write_failed` were added during W8 —
 * they mirror `ProfileWarningCode` (`session/types.ts`) so a `ProfileWarning` can be
 * adapted into a `ValidationWarning` and surfaced through `SessionActionResult.warnings`,
 * the only channel available to report one. See `plans/15-w8-profile-store.md`, Decision 2.
 *
 * `save_requires_migration` and `migration_failed` were added during W31 — `SessionStore`'s
 * `loadGame` (`session/store.ts`) needs a code for, respectively, a version mismatch with no
 * migration path registered (an envelope/serializer axis, which never has one; or a kind/
 * campaign axis with no `migrateState` supplied) and a registered migration that itself
 * returned failure. Neither travels through `CommandResult` today — `SaveHandle`/
 * `SessionHandle` have no error channel (same reasoning as `createSession`'s throw,
 * `plans/14-w7-session-store.md`, Design item 1) — but both are registered here anyway so
 * the vocabulary and its localized message live in one place, ready for whenever a real
 * error channel exists. See `plans/38-save-migration-programme.md`.
 *
 * `unknown_session`, `unknown_save`, and `storage_failure` were added with host persistence
 * (04 §7.2) — `SessionStoreError` (`session/types.ts`) carries one of these as its `code`, and
 * three of its eight members had no vocabulary entry. That mattered once `storage_failure`
 * became player-visible: the browser demo renders "could not be saved locally" from it, and a
 * client reading that out of an `Error.message` is exactly what §12 and 09 §3 forbid.
 * `storage_failure` is deliberately the *only* code a host adapter's own exception maps to —
 * a Postgres timeout and a `localStorage` quota error are indistinguishable to a client on
 * purpose, because neither admits a different response and an unbounded host vocabulary must
 * not cross the boundary.
 *
 * `missing_kind_reason_message` was added alongside `Kind.reasonMessages` (`kernel/types.ts`)
 * — `buildValidatedContentRegistry` (`validation/tiered.ts`) needs a code for the
 * completeness check §12 already promises: "validation fails if any registered reason code
 * has no localized message."
 *
 * `achievement_unlocked` was registered by reconciliation: §12 specifies it as the `reason` on
 * the achievement-unlock `StateChange`, and it had been emitted (`kinds/story-graph/
 * achievements.ts`) and switched on kind-agnostically (`session/store.ts`'s profile upsert)
 * without ever entering the vocabulary — so a `visible: true` audit record reached a client
 * carrying a code the string table could not resolve, which is exactly what §12's "the core
 * ships the base set's messages" exists to prevent. It belongs to the *base* set rather than
 * to `story-graph` because the session store reads it without knowing which kind emitted it.
 * Its story-graph sibling `consequence_applied` is kind-owned and lives in
 * `kinds/story-graph/reasons.ts` instead.
 *
 * `pack_kind_mismatch`, `duplicate_campaign_id_in_pack`, `pack_dependency_missing`,
 * `pack_dependency_version_conflict`, `pack_dependency_cycle`, and
 * `pack_override_unexpected` were added during W58 — `resolvePacks` (`registry/packs.ts`)
 * needs a code for each of §7's three checks (11-content-packs.md). Base rather than
 * kind-owned because pack resolution is core machinery, same reasoning as the registry's
 * existing `duplicate_campaign_id` and `string_conflict`.
 */
export const BASE_REASON_CODES = [
  "action_not_available",
  "unknown_action",
  "requirement_unmet",
  "session_ended",
  "read_only_field",
  "check_succeeded",
  "check_failed",
  "unknown_campaign",
  "unknown_kind",
  "invalid_state",
  "string_conflict",
  "protected_string_key",
  "duplicate_campaign_id",
  "invalid_identifier",
  "invalid_loc_key",
  "missing_string_key",
  "profile_missing",
  "profile_corrupt",
  "profile_write_failed",
  "save_requires_migration",
  "migration_failed",
  "unknown_session",
  "unknown_save",
  "storage_failure",
  "missing_kind_reason_message",
  "achievement_unlocked",
  "pack_kind_mismatch",
  "duplicate_campaign_id_in_pack",
  "pack_dependency_missing",
  "pack_dependency_version_conflict",
  "pack_dependency_cycle",
  "pack_override_unexpected",
] as const;

export type BaseReasonCode = (typeof BASE_REASON_CODES)[number];

/**
 * The default-English message for every base code, under the reserved `core.reason.*`
 * namespace (04 §12). Built from a `Record<BaseReasonCode, string>` literal so the
 * compiler — not a runtime check — refuses to build if a code is ever added here without
 * a message (plan 11, Decision 4).
 */
const CORE_REASON_TEXT: Readonly<Record<BaseReasonCode, string>> = {
  action_not_available: "This action isn't available right now.",
  unknown_action: "That action isn't recognized.",
  requirement_unmet: "A requirement for this action hasn't been met yet.",
  session_ended: "This session has already ended.",
  read_only_field: "That field can't be changed.",
  check_succeeded: "The check succeeded.",
  check_failed: "The check failed.",
  unknown_campaign: "That campaign isn't registered.",
  unknown_kind: "That game kind isn't registered.",
  invalid_state: "The saved game data couldn't be read.",
  string_conflict: "The same text key was authored with two different strings.",
  protected_string_key: "Campaign content can't override a reserved core message.",
  duplicate_campaign_id: "Two campaigns can't share the same id.",
  invalid_identifier: "That id doesn't match the required shape.",
  invalid_loc_key: "That text key doesn't match the required shape.",
  missing_string_key: "That text key has no authored string.",
  profile_missing: "No saved profile was found; starting with an empty one.",
  profile_corrupt: "The saved profile couldn't be read; starting with an empty one.",
  profile_write_failed: "The profile couldn't be saved. Your game progress was not affected.",
  save_requires_migration: "This save was made under a version this build can't read, and no migration is available for it.",
  migration_failed: "This save's migration failed. Your progress was not affected.",
  unknown_session: "That session could not be found.",
  unknown_save: "That save could not be found.",
  storage_failure: "Progress could not be stored. Your game is still playable, but it may not be here next time.",
  missing_kind_reason_message: "This kind declared a reason code with no localized message.",
  achievement_unlocked: "Achievement unlocked.",
  pack_kind_mismatch: "A pack can't carry a campaign for a different kind.",
  duplicate_campaign_id_in_pack: "A pack can't declare the same campaign id twice.",
  pack_dependency_missing: "A pack depends on another pack that isn't in the resolved set.",
  pack_dependency_version_conflict: "Two packs require different versions of the same pack.",
  pack_dependency_cycle: "Content packs can't depend on each other in a cycle.",
  pack_override_unexpected: "This pack overrides content no earlier pack supplied.",
};

/** `core.reason.<code>` → its shipped default-English message, for every base code. */
export const CORE_REASON_MESSAGES: ReadonlyMap<LocKey, string> = new Map(
  BASE_REASON_CODES.map((code) => [`core.reason.${code}`, CORE_REASON_TEXT[code]] as const),
);

/**
 * An **audit record emitted by a typed reducer — never the mutation mechanism.** It
 * feeds history and the transparency requirement; `visible` gates what a client may
 * show. Distinct from an `EngineEvent`: a `StateChange` is domain data, localized,
 * returned and persisted, whereas an event is operational, discardable, and changes
 * nothing if dropped (05 §1).
 */
export interface StateChange {
  /** Where the change landed, as an audit path — not a write path. */
  path: string;
  op: "set" | "increment" | "decrement";
  value: string | number | boolean;
  previous?: string | number | boolean;
  reason: ReasonCode;
  visible: boolean;
}

/** Player-facing and localized. */
export interface OutcomeMessage {
  key: LocKey;
  params?: Readonly<Record<string, string | number>>;
  tone?: "neutral" | "positive" | "negative" | "absurd";
  visible: boolean;
}

export interface CommandResult<T> {
  ok: boolean;
  value?: T;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}
