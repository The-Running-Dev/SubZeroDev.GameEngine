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
 *
 * **Reconciliation (2026-08-08) registers eighteen audit codes W39/W53/W55 emitted without
 * ever adding them here.** Every one rides on a `visible: true` `StateChange`, so each was
 * reaching a client with a `reason` the string table could not resolve — precisely the
 * defect 04 §12's callout describes and that `90-decisions.md`'s 2026-08-06 entry closed for
 * `story-graph`'s two. The reason it recurred at nine times the size is that
 * `buildValidatedContentRegistry` (`core/validation/tiered.ts`) only checks
 * *registered → has message*; nothing checks *emitted → registered*, so the completeness
 * gate stayed green throughout. W54 registered its own audit codes; W53 and W55 did not,
 * which is why the two blocks below look inconsistent in origin but not in kind.
 *
 * W56 registers its own eight at the point of emission, the discipline that reconciliation
 * established.
 *
 * W57 registers nine more the same way — three action codes for the events/opportunities
 * resolvers, and five end-of-week codes plus `world_strangeness_shifted` for the systems
 * `endOfWeek.ts` un-stubbed.
 *
 * **`plan_empty` and `week_limit_reached` are still the two §10 names not dispatched as
 * *reason codes*, and W57 does not change that.** §12's `week_limit_reached` is a
 * `SimulationResolution.resolution` value — a terminal identity `outcome()` reports, now
 * reachable — which is a different thing from §10's rejection code of the same name. A week
 * cap being reached ends the game rather than rejecting an action, so nothing yet returns it
 * as a `ValidationError`, and this file's own rule is that a code joins when the unit that
 * produces it exists. `plan_empty` keeps its separate gate: no `SimulationCampaign` field
 * exists for a campaign to forbid an empty plan with.
 *
 * W94 adds `event_response_pending` — §2.3's own callout that "the concrete reason code is
 * named once §10 has a real caller to attach it to." `advance.ts`'s `end_week` and `plan.add`
 * (for any `ActionType` other than `respond_to_event`) are that caller, rejecting while
 * `unaddressedPendingResponses` (`state.ts`) is non-empty.
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
  // Action audit codes (W53/W55, registered by reconciliation) — `resolvers.ts` emits one
  // per resolved action, mirroring W54's own four above.
  "action_work",
  "action_work_overtime",
  "action_search_for_work",
  "action_apply_for_job",
  "action_negotiate_job_terms",
  "action_eat",
  "action_rest",
  "action_move_housing",
  "action_pay_bills",
  "action_borrow_money",
  "action_repay_debt",
  "action_deposit_savings",
  "action_invest",
  // End-of-week audit codes (W39/W53/W55, registered by reconciliation) — `endOfWeek.ts`'s
  // `needs`, `financeIncome`, `housing` and `financeReconcile`.
  "need_drift",
  "wage_payment",
  "rent_charged",
  "rent_overdue",
  "eviction_advanced",
  // W56 — possessions, places and people. Seven action audit codes, one end-of-week code.
  "action_shop",
  "action_maintain_item",
  "action_repair_item",
  "action_sell_item",
  "action_travel",
  "action_socialize",
  "action_exercise",
  "item_condition_decayed",
  // W57 — events, opportunities, headlines. Three action audit codes and five end-of-week
  // codes, registered in the same commit that emits them (this file's own header).
  "action_respond_to_event",
  "action_accept_opportunity",
  "action_decline_opportunity",
  "event_fired",
  "opportunity_offered",
  "opportunity_expired",
  "opportunity_revoked",
  "headline_shown",
  "world_strangeness_shifted",
  // W94 — the mandatory-event gate (§2.3, §10).
  "event_response_pending",
  // W100 — campaign-tunable weekly rules (§7.11, §10). `plan_empty` dispatches from
  // `advance.ts`'s `end_week` once `SimulationCampaign.emptyPlanPolicy` exists to gate it;
  // `relationship_drift`/`attendance_updated` are the two new end-of-week audit codes;
  // `invalid_attendance_window` is `validate.ts`'s Tier 1 rejection of a non-positive-integer
  // `AttendanceTrackingConfig.windowWeeks` (§14) — §10's table states the rule but leaves the
  // exact code to the implementation, the same latitude §14's own closing paragraph grants
  // every other concrete Tier 1/2 check.
  "plan_empty",
  "relationship_drift",
  "attendance_updated",
  "invalid_attendance_window",
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
  action_work: "You worked this week.",
  action_work_overtime: "You worked overtime this week.",
  action_search_for_work: "You searched for work.",
  action_apply_for_job: "You applied for the job.",
  action_negotiate_job_terms: "You negotiated your terms.",
  action_eat: "You ate.",
  action_rest: "You rested.",
  action_move_housing: "You moved.",
  action_pay_bills: "You paid what you owed.",
  action_borrow_money: "You borrowed money.",
  action_repay_debt: "You repaid debt.",
  action_deposit_savings: "You moved money into savings.",
  action_invest: "You invested.",
  need_drift: "A week passed, and it took its toll.",
  wage_payment: "You were paid.",
  rent_charged: "Rent was charged.",
  rent_overdue: "Rent went unpaid, and a late fee was added.",
  eviction_advanced: "Your eviction moved one stage closer.",
  action_shop: "You bought it.",
  action_maintain_item: "You kept it in working order.",
  action_repair_item: "You had it repaired.",
  action_sell_item: "You sold it on.",
  action_travel: "You made the trip.",
  action_socialize: "You spent time with someone.",
  action_exercise: "You exercised.",
  item_condition_decayed: "Something you own is wearing out.",
  action_respond_to_event: "You dealt with it.",
  action_accept_opportunity: "You took the offer.",
  action_decline_opportunity: "You turned the offer down.",
  event_fired: "Something happened this week.",
  opportunity_offered: "An opportunity came up.",
  opportunity_expired: "An opportunity passed you by.",
  opportunity_revoked: "An opportunity was withdrawn.",
  headline_shown: "This week's news.",
  world_strangeness_shifted: "The world feels a little different.",
  event_response_pending: "You need to deal with this first.",
  plan_empty: "You haven't planned anything for this week yet.",
  relationship_drift: "A relationship shifted a little this week.",
  attendance_updated: "Your attendance record was updated.",
  invalid_attendance_window: "The attendance tracking window must be a positive number of weeks.",
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
