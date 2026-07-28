/**
 * Validation — the tiered content validator.
 *
 * Contract: `04-core.md` §11.
 *
 * Tier 1 is a hard fail: the campaign does not load. Tier 2 loads but flags. Validation
 * is pure and total — it runs at registry construction, performs no I/O, and never
 * simulates. Balance findings (dominant strategies, unwinnable scenarios) are a harness
 * concern and deliberately not a tier here.
 */

import type { LocKey } from "../localization/types.js";
import type { ReasonCode } from "../kernel/reasons.js";

export interface ValidationResult {
  /** False iff any Tier-1 error is present. */
  ok: boolean;
  /** Tier 1 — hard fail. */
  errors: ValidationError[];
  /** Tier 2 — load but flag. */
  warnings: ValidationWarning[];
}

export interface ValidationError {
  code: ReasonCode;
  messageKey: LocKey;
  /** Where in the campaign, when locatable. */
  path?: string;
  details?: Readonly<Record<string, string | number>>;
}

export interface ValidationWarning {
  code: ReasonCode;
  messageKey: LocKey;
  path?: string;
}
