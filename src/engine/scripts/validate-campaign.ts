/**
 * Tier 3 validation — an author-facing reachability check for story-graph campaigns.
 *
 * Contract: `04-core.md` §11 ("Tier 3 — simulation-time... found by running, not reading.
 * Not part of load."); `03-story-graph-kind.md` §11 (the two story-graph Tier 3 cases: an
 * ending no path reaches, and a choice whose `requirements` no reachable state satisfies).
 * `design/30-slices.md` § W73.
 *
 * Lives outside `src/`, the same placement and rationale `demo-cli.ts` already uses:
 * authoring-time tooling, not shipped engine code, so neither the determinism guard nor
 * the dependency-arrow rule applies. No registry-construction path imports this file — Tier
 * 3 is simulation-time by contract, and `buildValidatedContentRegistry`
 * (`src/core/validation/tiered.ts`) stays untouched by this unit (W73.4).
 *
 * The search explores every state reachable from `startNodeId`: a `random` node branches
 * into *every* transition (not one RNG pick, since a checker asks "can any sequence of
 * choices reach X", not "what does one seeded playthrough do"), and a `choice` node
 * branches into every choice whose `showWhen` and `requirements` the current state
 * satisfies. Achievements are recomputed at every `choice` node (mirroring `advance.ts`'s
 * "evaluate after settle" boundary), so a choice gated on `achieved.<id>` is judged
 * correctly rather than always false.
 *
 * States are deduplicated by node, variables, visited counts, and achievements — turn is
 * deliberately excluded: it strictly increases on every transition, so including it would
 * mean two structurally identical states reached at different turn numbers never collapse,
 * defeating dedup for any stable loop.
 *
 * Two independent caps bound the search: `MAX_EXPLORED_STATES`/`MAX_TURN_DEPTH` guarantee
 * termination even when a loop's state never stops changing (W73.5), and a per-chain
 * `SETTLE_STEPS` cap (imported from `settle.ts`, the same constant the real engine's settle
 * loop enforces) mirrors the real crash: a path whose auto/random chain between two
 * choice/ending nodes would trip `settle_guard_tripped` in real play is never credited as
 * "reachable" here either. Hitting any cap sets `bounded = true` and stops that state from
 * expanding further; it is not examined as a hit (an ending found exactly at a cap is not
 * counted), matching this checker's promise to never claim to have proven more than it
 * actually explored. The exploded-states cap stops *pushing new work* rather than aborting
 * the whole search outright, so states already queued from unrelated, already-mostly-explored
 * branches still get drained instead of being discarded — reducing, though not eliminating,
 * cross-branch "unknown" bleed from one runaway branch (`bounded` is still one flag for the
 * whole search, so a cap tripped anywhere can still downgrade an unrelated verdict that
 * would otherwise have been a definite "unreachable"/"unsatisfiable").
 *
 * A choice is only reported in `choiceRequirements` if it was visible (`showWhen`) in at
 * least one reached state — a choice hidden by `showWhen` in every reached state is a
 * reachability/authoring concern distinct from "requirements no state satisfies," and
 * reporting it as "unsatisfiable" would send an author to the wrong field.
 *
 * Run with `npm run validate-campaign -- <campaign-id>` from `src/engine/`.
 */

import type { CommandResult } from "../src/core/kernel/reasons.js";
import type { BuiltCampaign } from "../src/core/registry/types.js";
import { applyConsequences, buildInitialVariables } from "../src/kinds/story-graph/variables.js";
import { enter, type StoryGraphKindState } from "../src/kinds/story-graph/state.js";
import { requireNode } from "../src/kinds/story-graph/nodes.js";
import { evaluateStoryGraphCondition, toConditionContext } from "../src/kinds/story-graph/conditions.js";
import { evaluateAchievements } from "../src/kinds/story-graph/achievements.js";
import { SETTLE_STEPS } from "../src/kinds/story-graph/settle.js";
import type { StoryGraphCampaign } from "../src/kinds/story-graph/campaign.js";

import { buildBulgariaBureaucracyCampaign, BULGARIA_BUREAUCRACY_CAMPAIGN_ID } from "../src/campaigns/bulgaria-bureaucracy.js";
import {
  buildTier3UnreachableEndingFixtureCampaign,
  TIER3_UNREACHABLE_ENDING_FIXTURE_CAMPAIGN_ID,
} from "../src/campaigns/tier3-unreachable-ending-fixture.js";

/** Distinct states explored before the search gives up and reports the rest as unknown. */
export const MAX_EXPLORED_STATES = 20_000;
/** Turn-depth of a single path before that path stops expanding. */
export const MAX_TURN_DEPTH = 200;

export type ReachabilityStatus = "reachable" | "unreachable" | "unknown";

export interface EndingCheck {
  endingId: string;
  nodeId: string;
  status: ReachabilityStatus;
}

export interface ChoiceRequirementCheck {
  nodeId: string;
  choiceId: string;
  status: "satisfiable" | "unsatisfiable" | "unknown";
}

export interface CampaignCheckReport {
  endings: EndingCheck[];
  choiceRequirements: ChoiceRequirementCheck[];
  /** True iff the search hit a cap before it could exhaust the reachable state space —
   *  every "unreachable"/"unsatisfiable" verdict above is only ever reported once this is
   *  false, per W73.5. */
  bounded: boolean;
  exploredStates: number;
}

function canonicalStateKey(state: StoryGraphKindState): string {
  const vars = Object.keys(state.variables)
    .sort()
    .map((k) => `${k}=${JSON.stringify(state.variables[k])}`)
    .join(",");
  const visits = Object.keys(state.visitedCounts)
    .sort()
    .map((k) => `${k}:${state.visitedCounts[k]}`)
    .join(",");
  const achieved = [...state.unlockedAchievements].sort().join(",");
  return `${state.currentNodeId}|${vars}|${visits}|${achieved}`;
}

/** A queued search node: the game state plus how many auto/random hops it is into its
 *  current settle chain — reset at every choice pick, mirroring `settle()`'s own
 *  per-call `step` counter. */
interface SearchNode {
  state: StoryGraphKindState;
  chainSteps: number;
}

/**
 * Explores every state reachable from `content.startNodeId`, in breadth-first order.
 * Pure — no RNG, no I/O, no emitter — every branch a `random` node could take is walked,
 * not sampled.
 */
export function checkStoryGraphCampaign(content: StoryGraphCampaign): CampaignCheckReport {
  const declaredEndings = new Map<string, string>(); // endingId -> nodeId
  for (const [nodeId, node] of Object.entries(content.nodes)) {
    if (node.kind === "ending") declaredEndings.set(node.endingId, nodeId);
  }

  const reachedEndings = new Set<string>();
  const choiceEverSatisfied = new Set<string>(); // `${nodeId}::${choiceId}`
  const choicesWithRequirements = new Map<string, { nodeId: string; choiceId: string }>();

  const seeded: StoryGraphKindState = {
    currentNodeId: content.startNodeId,
    variables: buildInitialVariables(content.variables),
    turn: 0,
    visitedCounts: {},
    unlockedAchievements: [],
  };
  const start: SearchNode = { state: enter(seeded, content.startNodeId), chainSteps: 0 };

  const visitedKeys = new Set<string>();
  const queue: SearchNode[] = [start];
  let head = 0;
  let bounded = false;
  let explored = 0;
  let atCap = false;

  while (head < queue.length) {
    const { state, chainSteps } = queue[head]!;
    head++;

    const key = canonicalStateKey(state);
    if (visitedKeys.has(key)) continue;
    visitedKeys.add(key);
    explored++;

    if (explored > MAX_EXPLORED_STATES) atCap = true;
    if (atCap || state.turn > MAX_TURN_DEPTH || chainSteps > SETTLE_STEPS) {
      // This state stops expanding: already-queued siblings (from unrelated branches
      // explored before the cap was hit) still run, but nothing new is pushed once
      // `atCap` is set — the queue can only shrink from here.
      bounded = true;
      continue;
    }

    const node = requireNode(content.nodes, state.currentNodeId);

    if (node.kind === "ending") {
      reachedEndings.add(node.endingId);
      continue;
    }

    if (node.kind === "auto") {
      const applied = applyConsequences(content.variables, state.variables, node.effects ?? []);
      queue.push({
        state: enter({ ...state, variables: applied.variables, turn: state.turn + 1 }, node.goto),
        chainSteps: chainSteps + 1,
      });
      continue;
    }

    if (node.kind === "random") {
      for (const transition of node.transitions) {
        const applied = applyConsequences(content.variables, state.variables, transition.effects ?? []);
        queue.push({
          state: enter({ ...state, variables: applied.variables, turn: state.turn + 1 }, transition.goto),
          chainSteps: chainSteps + 1,
        });
      }
      continue;
    }

    // choice — a settle boundary in the real engine, so achievements are recomputed here
    // (evaluateAchievements is only ever called after a settle chain completes, per
    // advance.ts), and this state's own downstream pushes reset chainSteps to 0.
    const achieved = evaluateAchievements(content.achievements, state);
    const currentState =
      achieved.unlockedAchievements.length === state.unlockedAchievements.length
        ? state
        : { ...state, unlockedAchievements: achieved.unlockedAchievements };

    const context = toConditionContext(currentState);
    for (const choice of node.choices) {
      const choiceKey = `${node.id}::${choice.id}`;

      const visible = !choice.showWhen || evaluateStoryGraphCondition(choice.showWhen, context);
      if (!visible) continue;

      if (choice.requirements !== undefined) choicesWithRequirements.set(choiceKey, { nodeId: node.id, choiceId: choice.id });

      const requirementsOk = !choice.requirements || evaluateStoryGraphCondition(choice.requirements, context);
      if (!requirementsOk) continue;

      choiceEverSatisfied.add(choiceKey);
      const applied = applyConsequences(content.variables, currentState.variables, choice.effects ?? []);
      queue.push({
        state: enter({ ...currentState, variables: applied.variables, turn: currentState.turn + 1 }, choice.goto),
        chainSteps: 0,
      });
    }
  }

  const endings: EndingCheck[] = [...declaredEndings.entries()].map(([endingId, nodeId]) => ({
    endingId,
    nodeId,
    status: reachedEndings.has(endingId) ? "reachable" : bounded ? "unknown" : "unreachable",
  }));

  const choiceRequirements: ChoiceRequirementCheck[] = [...choicesWithRequirements.values()].map(({ nodeId, choiceId }) => {
    const satisfiable = choiceEverSatisfied.has(`${nodeId}::${choiceId}`);
    return {
      nodeId,
      choiceId,
      status: satisfiable ? "satisfiable" : bounded ? "unknown" : "unsatisfiable",
    };
  });

  return { endings, choiceRequirements, bounded, exploredStates: explored };
}

/** True iff `report` names a finding the author needs to fix — the exit-code condition. */
export function reportHasFailures(report: CampaignCheckReport): boolean {
  return report.endings.some((e) => e.status === "unreachable") || report.choiceRequirements.some((c) => c.status === "unsatisfiable");
}

/**
 * Every story-graph campaign this repository still holds. Published narrative moved to
 * Adventures.Content with the breaking ownership release (W74c), so what remains is not a
 * catalog: `bulgaria-bureaucracy` is frozen regression evidence (W74a) and the tier-3 fixture
 * exists to be found unreachable. An author checking a *published* campaign runs this
 * repository's checker from Content, against Content's source.
 */
const CAMPAIGNS: Record<string, () => CommandResult<BuiltCampaign>> = {
  [BULGARIA_BUREAUCRACY_CAMPAIGN_ID]: buildBulgariaBureaucracyCampaign,
  [TIER3_UNREACHABLE_ENDING_FIXTURE_CAMPAIGN_ID]: buildTier3UnreachableEndingFixtureCampaign,
};

function printReport(report: CampaignCheckReport): void {
  const boundedNote = report.bounded ? " (search bound reached — remaining verdicts are unknown, not proven)" : "";
  console.log(`Explored ${report.exploredStates} state(s)${boundedNote}.\n`);

  console.log("Endings:");
  for (const e of report.endings) {
    console.log(`  ${e.status.padEnd(11)} ${e.endingId} (node "${e.nodeId}")`);
  }

  const gated = report.choiceRequirements.filter((c) => c.status !== "satisfiable");
  if (gated.length > 0) {
    console.log("\nChoices whose requirements were never satisfied:");
    for (const c of gated) {
      console.log(`  ${c.status.padEnd(11)} node "${c.nodeId}" choice "${c.choiceId}"`);
    }
  }
}

async function main(): Promise<void> {
  const campaignId = process.argv[2];
  const entry = campaignId !== undefined ? CAMPAIGNS[campaignId] : undefined;
  if (!entry) {
    console.error(`Usage: validate-campaign <campaign-id>\nKnown campaign ids: ${Object.keys(CAMPAIGNS).join(", ")}`);
    process.exitCode = 1;
    return;
  }

  const built = entry();
  if (!built.ok || !built.value) {
    console.error(`validate-campaign: campaign failed to build — ${JSON.stringify(built.errors)}`);
    process.exitCode = 1;
    return;
  }

  if (built.value.campaign.kindId !== "story-graph") {
    console.error(`validate-campaign: "${campaignId}" is a "${built.value.campaign.kindId}" campaign — Tier 3 validation only supports story-graph.`);
    process.exitCode = 1;
    return;
  }

  const report = checkStoryGraphCampaign(built.value.campaign.content as StoryGraphCampaign);
  printReport(report);
  process.exitCode = reportHasFailures(report) ? 1 : 0;
}

if (process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
