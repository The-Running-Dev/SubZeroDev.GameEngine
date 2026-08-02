/**
 * The real `simulation` `Kind` assembly — the single definition every consumer imports.
 *
 * Contract: `04-core.md` §3, `10-simulation-kind.md`.
 *
 * Mirrors `kinds/story-graph/kind.ts`'s own role exactly: the one production `Kind`
 * object, not a test double reassembled at every call site (`plans/27-replay-oracle-
 * programme.md` Decision 5 is why story-graph's exists at all).
 *
 * **`scene`/`availableActions`/`project` are placeholders, not real projections.** §9
 * (Projection) is prose-only in the contract — no `SimulationView`/`PublicWorldState`
 * shape is declared yet, the same gap `content.ts`'s `AgentStrategy` doc comment already
 * flags. Building a real client-facing projection is its own future unit (story-graph's
 * own equivalent was W12, after its turn loop already worked). Safe to leave stubbed here
 * because this unit's own consumer — the replay oracle (`core/replay/runner.ts`) — calls
 * only `createGame`/`submitAction`, never `scene`/`availableActions`/`view`; `initialState`,
 * `advance`, `validateCampaign` and `outcome` are what it actually exercises, and all four
 * are real. **Revisit when** a client needs this kind, not before.
 *
 * `eventNames` lists only what this kind actually emits today (`system.ran`,
 * `effect.expired`) — not §11's full eight-event table, most of which need systems this
 * kind doesn't wire yet (`plan.changed`, `week.started`, `action.resolved`, `goal.achieved`,
 * `goal.failed`, `week.ended`). Grows the same incremental way `reasons.ts` does.
 */

import type {
  AdvanceResult,
  AvailableAction,
  InitialStateResult,
  Kind,
  SceneBody,
} from "../../core/kernel/types.js";
import { advance } from "./advance.js";
import { initialState } from "./initial.js";
import { outcome } from "./outcome.js";
import { SIMULATION_REASON_CODES } from "./reasons.js";
import type { SimulationKindState } from "./state.js";
import { validateCampaign } from "./validate.js";

export const simulationKind: Kind<SimulationKindState> = {
  id: "simulation",
  version: "1.0.0",
  reasonCodes: SIMULATION_REASON_CODES,
  eventNames: ["kind.simulation.system.ran", "kind.simulation.effect.expired"],
  initialState: (c): InitialStateResult<SimulationKindState> => initialState(c),
  availableActions: (): AvailableAction[] => [],
  scene: (): SceneBody => ({ textKey: "simulation.scene.placeholder", text: "" }),
  advance: (state, actionId, params, ctx): AdvanceResult<SimulationKindState> => advance(state, actionId, params, ctx),
  project: (): unknown => ({}),
  validateCampaign: (campaign, strings) => validateCampaign(campaign, strings),
  outcome: (state) => outcome(state),
};
