/**
 * The real `simulation` `Kind` assembly — the single definition every consumer imports.
 *
 * Contract: `04-core.md` §3, `10-simulation-kind.md`.
 *
 * Mirrors `kinds/story-graph/kind.ts`'s own role exactly: the one production `Kind`
 * object, not a test double reassembled at every call site (`plans/27-replay-oracle-
 * programme.md` Decision 5 is why story-graph's exists at all).
 *
 * `scene`/`availableActions`/`project` are real (W50) — `view.ts`/`scene.ts`/`available.ts`
 * implement §9 against the now-declared `SimulationView`/`PublicWorldState` shapes. This is
 * the first unit that needs `Kind.project`'s `state`/`audience`/`ctx` all wired through.
 *
 * `eventNames` lists all nine names now — `plan.changed`/`week.started`/
 * `action.resolved`/`goal.achieved`/`goal.failed`/`week.ended` join `system.ran`/
 * `effect.expired` (already emitted since W37/W39) with this unit's own emit sites in
 * `advance.ts`, `startOfWeek.ts` and `endOfWeek.ts`. `employment.application_lost` (W53) is
 * the newest — `endOfWeek.ts`'s `resolveApplications`, the only otherwise-silent trace of a
 * `pendingApplications` entry dropped because its `jobId` no longer resolves.
 */

import type {
  AdvanceResult,
  AvailableAction,
  InitialStateResult,
  Kind,
  SceneBody,
} from "../../core/kernel/types.js";
import type { ProjectionAudience } from "../../core/projection/types.js";
import { advance } from "./advance.js";
import { availableActions } from "./available.js";
import { SIMULATION_EVENT_NAMES } from "./events.js";
import { initialState } from "./initial.js";
import { outcome } from "./outcome.js";
import { simulationProfileData } from "./profile.js";
import { SIMULATION_ENGINE_MESSAGES, SIMULATION_REASON_CODES, SIMULATION_REASON_MESSAGES } from "./reasons.js";
import { scene } from "./scene.js";
import type { SimulationKindState } from "./state.js";
import { validateCampaign } from "./validate.js";
import { project, type SimulationView } from "./view.js";

export const simulationKind: Kind<SimulationKindState> = {
  id: "simulation",
  version: "1.0.0",
  reasonCodes: SIMULATION_REASON_CODES,
  reasonMessages: new Map([...SIMULATION_REASON_MESSAGES, ...SIMULATION_ENGINE_MESSAGES]),
  /** Generated from `events.ts`'s name-to-severity table so this list and the call sites
   *  cannot drift (W96). */
  eventNames: SIMULATION_EVENT_NAMES,
  initialState: (c, ctx, profileData): InitialStateResult<SimulationKindState> => initialState(c, ctx, profileData),
  availableActions: (state, ctx): AvailableAction[] => availableActions(state, ctx),
  scene: (state, ctx): SceneBody => scene(state, ctx),
  advance: (state, actionId, params, ctx): AdvanceResult<SimulationKindState> => advance(state, actionId, params, ctx),
  project: (state, audience: ProjectionAudience, ctx): SimulationView => project(state, audience, ctx),
  validateCampaign: (campaign, strings) => validateCampaign(campaign, strings),
  outcome: (state) => outcome(state),
  profileData: simulationProfileData,
};
