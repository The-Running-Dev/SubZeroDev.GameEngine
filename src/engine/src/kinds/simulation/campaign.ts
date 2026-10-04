/**
 * Simulation kind — the campaign content envelope (10-simulation-kind.md §7; W52).
 *
 * Contract: `10-simulation-kind.md` §7 (campaign data, loaded through the content
 * registry exactly as story-graph campaigns are); [14](10-simulation-kind.md#14-validation)
 * (every collection here is one `Kind.validateCampaign` (`validate.ts`) checks for
 * duplicate ids).
 *
 * **The real authoring surface, replacing the four/five literal state blobs W39–W51 used.**
 * Earlier units (`goals`/`goalFailurePrecedence`, `startingEffects`) built the mechanism —
 * end-of-week goal tracking, an effect that can apply from turn one — against a campaign
 * that hand-authored `startingCalendar`/`startingPlayer`/`startingEconomy`/`startingWorld`
 * directly. This unit replaces those with the full §7 content surface plus one
 * `ScenarioDefinition` (`scenarioId`) that `initial.ts` builds week one *from* — the same
 * "campaign is data, `initialState` does the assembly" split `story-graph`'s
 * `StoryGraphCampaign`/`Node`/`initialState` triangle already has.
 *
 * `goals`/`goalFailurePrecedence` stay exactly where W39 put them — the flat campaign-root
 * fields `initial.ts`/`advance.ts` already read — rather than moving to per-scenario
 * (`ScenarioDefinition` also declares its own `goalIds`/`goalFailurePrecedence`, §7.8). A
 * single campaign here only ever plays one scenario (`scenarioId`), so the two would name
 * the same set; keeping the existing flat fields as the operative ones avoids touching
 * `advance.ts` (outside this unit's `Touches`) for a distinction with no campaign this
 * repository authors to exercise yet. `ScenarioDefinition.goalIds`/`goalFailurePrecedence`
 * are still real, Tier-1-checked content (§14) — just not (yet) where behaviour reads from.
 *
 * Identity fields (`id`/`version`/`titleKey`) stay on the core `Campaign` envelope, not
 * here — the same envelope-duplication rule `StoryGraphCampaign` already follows.
 */

import type { LocKey } from "../../core/localization/types.js";
import type { EvictionStage, NeedKey, RelationshipState } from "./actor.js";
import type { StatusEffect } from "./state.js";
import type {
  JobDefinition,
  CourseDefinition,
  HousingDefinition,
  ItemDefinition,
  EventDefinition,
  NPCDefinition,
  GoalDefinition,
  ScenarioDefinition,
  DifficultyDefinition,
  OpportunityDefinition,
  AchievementDefinition,
  HeadlineDefinition,
  EmployerDefinition,
  LocationDefinition,
  BackgroundDefinition,
  TraitDefinition,
  SkillDefinition,
  GoalFailurePrecedence,
  ProjectDefinition,
  BusinessDefinition,
  EventChainDefinition,
} from "./content.js";

/** `plan.add`/`plan.remove`/`plan.clear`/`end_week` — one label per §4 verb. */
export interface SimulationActionLabelKeys {
  planAdd: LocKey;
  planRemove: LocKey;
  planClear: LocKey;
  endWeek: LocKey;
}

/** A signed per-need change to base needs (§7.14). Every key is optional. */
export type SimulationNeedDeltas = Partial<Record<NeedKey, number>>;

/** The actions whose time cost is a resolver literal rather than content (§7.14). `work`,
 *  `travel`, `maintain_item`, `work_on_project` and `respond_to_event` take theirs from
 *  content and are not members. */
export type SimulationFixedTimeAction =
  | "search_for_work" | "apply_for_job" | "negotiate_job_terms" | "work_overtime"
  | "study" | "move_housing" | "borrow_money" | "repay_debt"
  | "deposit_savings" | "invest" | "shop" | "repair_item" | "sell_item"
  | "socialize" | "exercise" | "start_project" | "start_business"
  | "eat" | "rest" | "enroll_course" | "attend_class" | "withdraw_course"
  | "pay_bills" | "accept_opportunity" | "decline_opportunity"
  | "operate_business";

export interface SimulationCampaign {
  descriptionKey: LocKey;

  // §7.2–§7.10 — every content-definition type §14's Tier 1 duplicate-id rule names,
  // each independently.
  jobs: readonly JobDefinition[];
  courses: readonly CourseDefinition[];
  housing: readonly HousingDefinition[];
  items: readonly ItemDefinition[];
  events: readonly EventDefinition[];
  npcs: readonly NPCDefinition[];
  goals: readonly GoalDefinition[];
  scenarios: readonly ScenarioDefinition[];
  difficulties: readonly DifficultyDefinition[];
  opportunities: readonly OpportunityDefinition[];
  achievements: readonly AchievementDefinition[];
  headlines: readonly HeadlineDefinition[];
  employers: readonly EmployerDefinition[];
  locations: readonly LocationDefinition[];
  backgrounds: readonly BackgroundDefinition[];
  traits: readonly TraitDefinition[];
  skills: readonly SkillDefinition[];
  projects: readonly ProjectDefinition[];
  businesses: readonly BusinessDefinition[];

  /** Which `scenarios` entry `initial.ts` actually plays — the simulation-kind analogue of
   *  `StoryGraphCampaign.startNodeId`. Tier 1 (§14) checks it resolves. */
  scenarioId: string;

  /** How `goals`' precedence resolves when completion and failure trip in the same week —
   *  see this file's own header for why this stays flat rather than moving under the
   *  scenario. */
  goalFailurePrecedence: GoalFailurePrecedence;

  /** Optional hand-authored `activeEffects` present from `initialState` on — the only lever
   *  a campaign has to seed one before the content that grants effects at runtime (jobs,
   *  courses, items) exists. Absent means `[]`, unchanged from every campaign predating this
   *  field (W51.6). */
  startingEffects?: readonly StatusEffect[];

  /** `scene()`'s (§9) status-summary template — interpolates `{week}`, `{year}`, `{cash}`,
   *  `{health}`, `{energy}`, `{happiness}`, `{stress}`, `{satiety}` (`scene.ts`). */
  sceneTemplateKey: LocKey;
  actionLabelKeys: SimulationActionLabelKeys;

  /** Whether `end_week` may resolve an empty plan (§10, §11). Absent, or `"permit"`, is
   *  every campaign's behaviour before this field existed: `end_week` always resolves, even
   *  with nothing planned. `"forbid"` rejects `end_week` with `plan_empty` (§10) whenever
   *  `plan.actions.length === 0`, leaving state and the plan unchanged. */
  emptyPlanPolicy?: "permit" | "forbid";

  /** Weekly relationship drift the `relationships` end-of-week system (§3, §6.11) applies.
   *  Absent leaves that system the no-op it has always been. */
  relationshipDrift?: readonly RelationshipDriftRule[];

  /** Rolling employment-attendance tracking (§6.8). Absent leaves `Employment.
   *  attendanceRatio` exactly as `resolveApplications` sets it at hire — unmaintained,
   *  the documented gap this field closes only when a campaign opts in. */
  attendanceTracking?: AttendanceTrackingConfig;

  /** §7.13, W102. Absent means `[]`, which is every campaign shipped before this field: no
   *  chain is declared, so none is `"profile"`-scoped and none is seeded (§2.2). */
  eventChains?: readonly EventChainDefinition[];

  /** §7.14, W117. The signed integer each need drifts by at `end_week`, before the 0–100
   *  clamp. Resolved per key at the point of use: an omitted key, or an omitted field, is the
   *  default (health −1, energy −3, happiness −2, satiety −4, stress +2); an explicit `0`
   *  leaves that need undrifted. */
  needDriftPerWeek?: SimulationNeedDeltas;

  /** §7.14, W118. The week's time budget, a positive integer. Absent is 14, the budget every
   *  campaign shipped before this field has. Applied at `initialState` and at each
   *  start-of-week `time_advance`. */
  weeklyTimeUnits?: number;
  /** §7.14, W118. Late fee on a missed week, in basis points of the missed rent: a
   *  nonnegative integer. Absent is 1000 (10%). Zero is a supplied value: no fee. */
  lateFeeBasisPoints?: number;
  /** §7.14, W118. The eviction ladder: an ordered subsequence of the six `EvictionStage`
   *  members in canonical order, starting at `none` and ending at `evicted`. A missed week
   *  advances one listed stage; a stored stage the ladder omits advances to the first listed
   *  stage later in canonical order. Absent is all six. */
  evictionStages?: readonly EvictionStage[];
  /** §7.14, W118. Fraction, in [0, 1], of the gap to `JobPerformanceRules.weeklyDriftToward`
   *  that a week without work closes. Absent is 0.2. Rounding happens once. */
  performanceDriftRate?: number;
  /** §7.14, W118. The integer `Employment.performance` gains in a week worked. Absent is 8. */
  performanceWorkBonus?: number;
  /** §7.14, W118. The integer `world.strangenessBase` moves per fired event. Absent is 5. */
  strangenessPerEvent?: number;
  /** §7.14, W119. Per-action time cost, resolved per key. An absent key is the action's
   *  current cost; the nine free actions are 0 and, priced, check and spend time. */
  actionTimeCosts?: Partial<Record<SimulationFixedTimeAction, number>>;
  /** §7.14, W119. Signed need changes `eat` makes, per key. Absent is satiety +25. */
  eatNeedDeltas?: SimulationNeedDeltas;
  /** §7.14, W119. Signed need changes `rest` makes, per key. Absent is energy +20, stress −5. */
  restNeedDeltas?: SimulationNeedDeltas;
  /** §7.14, W119. Signed need changes `exercise` makes, per key. Absent is energy −10,
   *  happiness +3, health +5, satiety −5, stress −5. */
  exerciseNeedDeltas?: SimulationNeedDeltas;
  /** §7.14, W119. Integer affinity one `socialize` adds. Absent is 5. */
  socializeAffinityGain?: number;
  /** §7.14, W119. Integer trust one `socialize` adds. Absent is 2. */
  socializeTrustGain?: number;
  /** §7.14, W119. Weeks from `apply_for_job` to its resolution. Absent is 1. */
  applicationResolveWeeks?: number;
  /** §7.14, W119. Basis points a successful `negotiate_job_terms` adds to pay. Absent is 500. */
  negotiateRaiseBasisPoints?: number;
  /** §7.14, W119. `studyUnits` one `study` session adds. Absent is 1. */
  studyUnitsPerSession?: number;
  /** §7.14, W119. `progressUnits` one `work_on_project` session adds. Absent is 1. */
  projectProgressPerSession?: number;
}

export interface RelationshipDriftRule {
  /** Which `RelationshipState.category` (§6.11) values this rule applies to. Absent or
   *  empty applies to every category. */
  categories?: readonly RelationshipState["category"][];

  /** Per-week integer delta added to each named dimension before clamping to 0–100 (§6.2's
   *  declared integer range). Every field is optional; an omitted dimension does not drift. */
  affinityDelta?: number;
  trustDelta?: number;
  respectDelta?: number;
  resentmentDelta?: number;
}

export interface AttendanceTrackingConfig {
  /** Weeks averaged into the rolling `attendanceRatio`. Must be a positive integer — Tier 1
   *  (§14) rejects zero or negative. */
  windowWeeks: number;
}
