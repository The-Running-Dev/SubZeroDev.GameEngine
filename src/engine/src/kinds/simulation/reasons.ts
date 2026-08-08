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
 *
 * W52 adds its own Tier 1/2 content-validation codes (§14) — `missing_string_key` and
 * `read_only_field` are reused from the base set (`core.reason.*`), the same choice
 * `story-graph/validate.ts` (W14) made for the identical failures.
 *
 * W53 dispatches two of the five §10 names "specified, not yet dispatched" —
 * `insufficient_time` (a plan exceeds available time units) and `wrong_location` (an
 * action's type isn't in the current location's `actionTypes`) — from the five real
 * employment resolvers (`resolvers.ts`). `insufficient_funds`, `plan_empty` and
 * `week_limit_reached` stayed undispatched there: none of the five employment actions
 * carried a money cost.
 *
 * W54 dispatches `insufficient_funds` — `enroll_course` is the first resolver with a real
 * money cost (`CourseDefinition.tuitionCents`). `plan_empty` and `week_limit_reached` stay
 * undispatched — unrelated to education.
 *
 * W54 also adds four action audit codes (`action_enroll_course`, `action_attend_class`,
 * `action_study`, `action_withdraw_course`) and four end-of-week education codes
 * (`education_course_completed`, `education_course_failed`, `education_skill_awarded`,
 * `education_credential_awarded`).
 */

import type { LocKey } from "../../core/localization/types.js";

export const SIMULATION_REASON_CODES = [
  "action_not_planned",
  "duplicate_id",
  "dangling_reference",
  "numeric_natural_key",
  "unreachable_content",
  "unsatisfiable_achievement",
  "insufficient_time",
  "wrong_location",
  "insufficient_funds",
  "action_enroll_course",
  "action_attend_class",
  "action_study",
  "action_withdraw_course",
  "education_course_completed",
  "education_course_failed",
  "education_skill_awarded",
  "education_credential_awarded",
] as const;

export type SimulationReasonCode = (typeof SIMULATION_REASON_CODES)[number];

const SIMULATION_REASON_TEXT: Readonly<Record<SimulationReasonCode, string>> = {
  action_not_planned: "That plan entry no longer exists.",
  duplicate_id: "This campaign uses the same id twice where ids must be unique.",
  dangling_reference: "This campaign points to content that doesn't exist.",
  numeric_natural_key: "This campaign uses an all-digit id where the id addresses a collection member by natural key.",
  unreachable_content: "This campaign declares content nothing in it ever reaches.",
  unsatisfiable_achievement: "This achievement's condition references a counter or flag nothing in this campaign ever writes.",
  insufficient_time: "That plan needs more time than you have left this week.",
  wrong_location: "You can't do that here.",
  insufficient_funds: "You can't afford that right now.",
  action_enroll_course: "You enrolled in the course.",
  action_attend_class: "You attended class.",
  action_study: "You studied.",
  action_withdraw_course: "You withdrew from the course.",
  education_course_completed: "You completed the course.",
  education_course_failed: "You did not pass the course.",
  education_skill_awarded: "You gained a new skill.",
  education_credential_awarded: "You earned a credential.",
};

/** `simulation.reason.<code>` → its shipped default-English message, for every code. */
export const SIMULATION_REASON_MESSAGES: ReadonlyMap<LocKey, string> = new Map(
  SIMULATION_REASON_CODES.map((code) => [`simulation.reason.${code}`, SIMULATION_REASON_TEXT[code]] as const),
);

/**
 * Engine-owned `LocKey`s this kind emits that are not reason codes — `kind.ts` merges this
 * into `Kind.reasonMessages` anyway, since that field is the only channel a `Kind` has for
 * threading its own strings into `buildValidatedContentRegistry`'s merged registry (`core/
 * validation/tiered.ts`). `resolvers.ts`'s `invest` is the first to need one:
 * `FinancialAccount.label` (§6.4) is a `LocKey`, but the account itself is engine-created
 * (`INVESTMENT_ACCOUNT_ID` is a fixed constant, not campaign content), so no
 * `SimulationCampaign` collection exists for a campaign author to supply this string —
 * `validate.ts`'s `validateLocKeys` only checks campaign-authored fields, and rightly so.
 */
export const INVESTMENT_ACCOUNT_LABEL_KEY: LocKey = "simulation.finance.investment.label";

export const SIMULATION_ENGINE_MESSAGES: ReadonlyMap<LocKey, string> = new Map([
  [INVESTMENT_ACCOUNT_LABEL_KEY, "Investments"],
]);
