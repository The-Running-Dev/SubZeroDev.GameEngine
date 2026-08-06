/**
 * Simulation kind — the campaign content envelope.
 *
 * Contract: `10-simulation-kind.md` §7 (campaign data, loaded through the content
 * registry exactly as story-graph campaigns are).
 *
 * **Deliberately minimal, not the real authoring surface.** The real content-definition
 * types (`ScenarioDefinition`, `BackgroundDefinition`, and the rest of `10-simulation-kind.md`
 * §7) now exist (`content.ts`, W38), but assembling this shape *around* `ScenarioDefinition`
 * — starting backgrounds, housing, inventory, week limits — is W40's job (the scenario is
 * the content-authoring pass; this unit is wiring). `goals`/`goalFailurePrecedence` are the
 * two fields added here, and only those: the `goals`/`failure` end-of-week systems
 * (`endOfWeek.ts`) need a `GoalDefinition` to evaluate a `GoalState` against, and `goals`'
 * own precedence rule to resolve a goal whose completion and failure conditions both trip
 * the same week (§13.2 upstream, echoed in `content.ts`'s `GoalFailurePrecedence` doc
 * comment). Identity fields (`id`/`version`/`titleKey`) live on the core `Campaign`
 * envelope, not here — the same envelope-duplication rule `StoryGraphCampaign` already
 * follows.
 *
 * `sceneTemplateKey`/`actionLabelKeys` are added by W50 (`view.ts`/`scene.ts`/`available.ts`)
 * — `scene()` renders "from registry strings only" (§9), so this kind's own status-summary
 * template must be campaign-authored `AuthoredText`, the same mechanism `StoryGraphCampaign`
 * node text already uses, rather than a kind-default reason-code message: those two remain
 * separate namespaces (`kind.reason.*` vs. a campaign's own `AuthoredText`) even now that
 * `Kind.reasonMessages` is threaded through `buildValidatedContentRegistry` — a status-summary
 * template was never a reason-code message to begin with.
 */

import type { LocKey } from "../../core/localization/types.js";
import type { CalendarState, EconomyState, WorldState, StatusEffect } from "./state.js";
import type { PlayerState } from "./actor.js";
import type { GoalDefinition, GoalFailurePrecedence } from "./content.js";

/** `plan.add`/`plan.remove`/`plan.clear`/`end_week` — one label per §4 verb. */
export interface SimulationActionLabelKeys {
  planAdd: LocKey;
  planRemove: LocKey;
  planClear: LocKey;
  endWeek: LocKey;
}

export interface SimulationCampaign {
  descriptionKey: LocKey;
  startingCalendar: CalendarState;
  startingPlayer: PlayerState;
  startingEconomy: EconomyState;
  startingWorld: WorldState;

  goals: readonly GoalDefinition[];
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
