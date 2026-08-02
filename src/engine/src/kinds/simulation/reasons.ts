/**
 * Simulation kind — the reason codes this kind adds to the base set (10 §10).
 *
 * Contract: `10-simulation-kind.md` §10.
 *
 * Mirrors `kernel/reasons.ts`'s and `kinds/story-graph/reasons.ts`'s own pattern exactly —
 * a const array, a `Record<Code,string>` message table the compiler forces complete, and a
 * `ReadonlyMap<LocKey,string>` built from both. Messages live under `simulation.reason.*`
 * (10 §10's `<kindId>.reason.*` convention), not `core.reason.*`.
 *
 * Grows incrementally as each build unit introduces the code it actually produces — the
 * same precedent `story-graph/reasons.ts` set (its own header: codes joined across
 * W10/W11/W12/W14, not pre-declared from the contract on day one). §10 names five more
 * (`insufficient_time`, `insufficient_funds`, `plan_empty`, `week_limit_reached`,
 * `wrong_location`); each joins here once the unit that dispatches it exists, not before.
 */

import type { LocKey } from "../../core/localization/types.js";

export const SIMULATION_REASON_CODES = [
  "action_not_planned",
] as const;

export type SimulationReasonCode = (typeof SIMULATION_REASON_CODES)[number];

const SIMULATION_REASON_TEXT: Readonly<Record<SimulationReasonCode, string>> = {
  action_not_planned: "That plan entry no longer exists.",
};

/** `simulation.reason.<code>` → its shipped default-English message, for every code. */
export const SIMULATION_REASON_MESSAGES: ReadonlyMap<LocKey, string> = new Map(
  SIMULATION_REASON_CODES.map((code) => [`simulation.reason.${code}`, SIMULATION_REASON_TEXT[code]] as const),
);
