/**
 * Replay — the regression oracle's own vocabulary.
 *
 * Contract: `07-replay.md` §2–§3, §6.
 *
 * Distinct from `core/determinism/harness.ts`'s `PlaythroughFixture`: this compares a build
 * against a *previous* build, not against itself, so it needs two fields the determinism
 * harness does not (`campaignVersion`, `capturedUnder`), and it records every submitted
 * action — accepted or not — rather than only the ones that made it into `actionLog`.
 */

import type { ActionParams, GameStatus, NewGameConfig } from "../kernel/types.js";
import type { ReasonCode } from "../kernel/reasons.js";

/**
 * One attempted action, whether or not the engine accepted it. `04 §4`'s `actionLog` omits
 * rejections — `seq` is the log's length, so a rejected submission leaves no trace there —
 * which is exactly why the fixture carries its own list instead of reusing `actionLog`
 * (07 §2.1).
 */
export interface Submission {
  readonly actionId: string;
  readonly params?: ActionParams;
}

export interface ReplayFixture {
  readonly name: string;
  /**
   * `seed` narrowed from `NewGameConfig`'s own optional field to required, the same
   * reasoning `PlaythroughFixture` (`core/determinism/harness.ts`) applies: a fixture with
   * no explicit seed is not reproducible.
   */
  readonly config: NewGameConfig & { seed: string };
  /** Pinned here, not on `config` — a *runtime* input has no reason to carry it (07 §2). */
  readonly campaignVersion: string;
  /** The `ENGINE_VERSION` (`../../version.js`) current when this fixture's `.outcome.json`
   *  was captured or last regenerated. */
  readonly capturedUnder: string;
  readonly submissions: readonly Submission[];
}

/**
 * One submission's result. `index` — not `seq` — identifies it: two rejected submissions in
 * a row share one `seq` (rejection never advances it), so `index`, the 0-based position in
 * `submissions`, is what stays unique (07 §3.1).
 */
export interface Decision {
  readonly index: number;
  /** The accepted log position, or `null` if this submission was rejected — never a
   *  repeated number left to be misread. */
  readonly seq: number | null;
  readonly actionId: string;
  readonly accepted: boolean;
  /** Set iff rejected (04 §12). */
  readonly reason?: ReasonCode;
}

/**
 * The deliberately small, cross-version-stable projection the oracle actually compares.
 * Never variable values, never `serialize()` bytes (07 §3.4) — every field here is stable
 * across versions by an existing decree, not by hope (07 §3).
 */
export interface Outcome {
  readonly finalStatus: GameStatus;
  readonly acceptedActions: number;
  readonly decisions: readonly Decision[];
  /** Unlocked achievement ids, sorted (07 §3.2). */
  readonly achievements: readonly string[];
  /** The kind's own terminal identity (`Kind.outcome`, `04-core.md` §3) — published ids
   *  only, never values (07 §3.3). */
  readonly terminal?: unknown;
}

export type ReplayVerdict =
  | { readonly kind: "match" }
  | {
      readonly kind: "diverged";
      readonly at: number;
      readonly capturedUnder: string;
      readonly expected: Outcome;
      readonly actual: Outcome;
    }
  | { readonly kind: "unrunnable"; readonly reason: "campaign_withdrawn" | "campaign_version_missing" };
