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
 * satisfies. States are deduplicated by full content (node, variables, visited counts,
 * achievements, turn) so a genuine loop collapses once its state stops changing. A hard
 * cap on both the total number of distinct states explored and the turn-depth of any one
 * path guarantees termination even when a loop's state never stops changing (W73.5) —
 * when either cap is hit, anything not yet found is reported as "unknown" (not proven
 * reachable within the bound), never as "unreachable": this checker never claims to have
 * proven more than it actually explored.
 *
 * Run with `npm run validate-campaign -- <campaign-id>` from `src/engine/`.
 */

import type { CommandResult } from "../src/core/kernel/reasons.js";
import type { BuiltCampaign } from "../src/core/registry/types.js";
import { applyConsequences, buildInitialVariables } from "../src/kinds/story-graph/variables.js";
import { enter, type StoryGraphKindState } from "../src/kinds/story-graph/state.js";
import { requireNode } from "../src/kinds/story-graph/nodes.js";
import { evaluateStoryGraphCondition, toConditionContext } from "../src/kinds/story-graph/conditions.js";
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
  return `${state.currentNodeId}|t${state.turn}|${vars}|${visits}|${achieved}|${state.endingId ?? ""}`;
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
  const start = enter(seeded, content.startNodeId);

  const visitedKeys = new Set<string>();
  const queue: StoryGraphKindState[] = [start];
  let bounded = false;
  let explored = 0;

  while (queue.length > 0) {
    const state = queue.shift()!;
    const key = canonicalStateKey(state);
    if (visitedKeys.has(key)) continue;
    visitedKeys.add(key);
    explored++;

    if (explored > MAX_EXPLORED_STATES) {
      bounded = true;
      break;
    }
    if (state.turn > MAX_TURN_DEPTH) {
      bounded = true;
      continue; // this path stops expanding; already-queued siblings still run
    }

    const node = requireNode(content.nodes, state.currentNodeId);

    if (node.kind === "ending") {
      reachedEndings.add(node.endingId);
      continue;
    }

    if (node.kind === "auto") {
      const applied = applyConsequences(content.variables, state.variables, node.effects ?? []);
      queue.push(enter({ ...state, variables: applied.variables, turn: state.turn + 1 }, node.goto));
      continue;
    }

    if (node.kind === "random") {
      for (const transition of node.transitions) {
        const applied = applyConsequences(content.variables, state.variables, transition.effects ?? []);
        queue.push(enter({ ...state, variables: applied.variables, turn: state.turn + 1 }, transition.goto));
      }
      continue;
    }

    // choice
    const context = toConditionContext(state);
    for (const choice of node.choices) {
      const choiceKey = `${node.id}::${choice.id}`;
      if (choice.requirements !== undefined) choicesWithRequirements.set(choiceKey, { nodeId: node.id, choiceId: choice.id });

      const visible = !choice.showWhen || evaluateStoryGraphCondition(choice.showWhen, context);
      if (!visible) continue;

      const requirementsOk = !choice.requirements || evaluateStoryGraphCondition(choice.requirements, context);
      if (!requirementsOk) continue;

      choiceEverSatisfied.add(choiceKey);
      const applied = applyConsequences(content.variables, state.variables, choice.effects ?? []);
      queue.push(enter({ ...state, variables: applied.variables, turn: state.turn + 1 }, choice.goto));
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
