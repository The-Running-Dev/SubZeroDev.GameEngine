/**
 * Simulation kind — the campaign content envelope.
 *
 * Contract: `10-simulation-kind.md` §7 (campaign data, loaded through the content
 * registry exactly as story-graph campaigns are).
 *
 * **Deliberately minimal, not the real authoring surface.** The real content-definition
 * types (`ScenarioDefinition`, `BackgroundDefinition`, and the rest of `10-simulation-kind.md`
 * §7) are the third build unit's job (`plans/36-simulation-kind-programme.md`), not this
 * one — `initialState` (`initial.ts`) needs *something* to build week-one state from now, so
 * this campaign shape declares the starting state directly, as plain data, rather than
 * deriving it from a scenario/background indirection that doesn't exist yet. Identity
 * fields (`id`/`version`/`titleKey`) live on the core `Campaign` envelope, not here — the
 * same envelope-duplication rule `StoryGraphCampaign` already follows.
 */

import type { LocKey } from "../../core/localization/types.js";
import type { CalendarState, EconomyState, WorldState } from "./state.js";
import type { PlayerState } from "./actor.js";

export interface SimulationCampaign {
  descriptionKey: LocKey;
  startingCalendar: CalendarState;
  startingPlayer: PlayerState;
  startingEconomy: EconomyState;
  startingWorld: WorldState;
}
