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
} from "./content.js";

/** `plan.add`/`plan.remove`/`plan.clear`/`end_week` — one label per §4 verb. */
export interface SimulationActionLabelKeys {
  planAdd: LocKey;
  planRemove: LocKey;
  planClear: LocKey;
  endWeek: LocKey;
}

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
}
