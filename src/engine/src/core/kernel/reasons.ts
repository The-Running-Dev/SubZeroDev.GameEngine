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
] as const;

export type BaseReasonCode = (typeof BASE_REASON_CODES)[number];

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
