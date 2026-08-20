/**
 * Seeing a story graph — `design/30-slices.md` § W80.
 *
 * Contract: `03-story-graph-kind.md` §3 (the four node kinds), §4 (choices and
 * transitions), §8.5 (terminal identity); `02-architecture.md` §9.1, §9.2 — tooling that
 * reads a built campaign is not a fourth layer.
 *
 * Nine campaigns and, across the five expanded Bulgaria publications alone, seventy-five
 * endings exist with no way to see their shape short of reading several hundred lines of
 * node ids (W80's own delivery statement). This renders one to Mermaid — no dependency
 * needed to write it, and it displays inline on GitHub.
 *
 * Reuses `check-content.ts`'s `CAMPAIGN_CATALOGUE` (W77) rather than re-deriving a
 * second campaign list — the same shared catalogue W80 depends on W77 for. The test
 * suite cross-checks this module's `unreachable` set against `checkBuiltCampaign`'s own
 * `unreachable_node` warnings on the same built campaign (W80.4), which only means
 * something if `computeReachableIds` below is an independent re-derivation rather than a
 * shared implementation with `validate.ts`'s private `computeReachable` — the two are
 * meant to be able to disagree and say so, not share code that could never produce two
 * answers.
 *
 * Lives outside `src/`, alongside `validate-campaign.ts` and `check-content.ts` —
 * authoring-time tooling, not shipped engine code (architecture §9.2), so neither the
 * determinism guard nor the dependency-arrow rule applies here (W80.5).
 *
 * Run with `npm run graph-campaign -- <campaign-module>` from `src/engine/`, using the
 * same module-name argument `check-content.ts` takes (`bulgaria-bureaucracy`, …), not
 * `Campaign.id`.
 */

import type { CommandResult } from "../src/core/kernel/reasons.js";
import type { BuiltCampaign } from "../src/core/registry/types.js";
import type { StoryGraphCampaign } from "../src/kinds/story-graph/campaign.js";
import type { Node } from "../src/kinds/story-graph/nodes.js";
import { runIfMainModule } from "./run-if-main.js";
import { joinOrNone } from "./format-list.js";

import { CAMPAIGN_CATALOGUE } from "./check-content.js";

export interface GraphVertex {
  readonly id: string;
  readonly kind: Node["kind"];
}

export interface GraphEdge {
  readonly from: string;
  readonly to: string;
  /** Empty for an `auto` node's single unconditional edge. */
  readonly label: string;
}

export interface CampaignCounts {
  readonly nodes: number;
  /** Total authored `Choice` objects across every `choice` node — not `ChoiceNode` count. */
  readonly choices: number;
  readonly endings: number;
}

export interface CampaignGraph {
  readonly vertices: readonly GraphVertex[];
  readonly edges: readonly GraphEdge[];
  readonly counts: CampaignCounts;
  /** Every node id not reachable from `startNodeId`, in canonical (sorted) order. */
  readonly unreachable: readonly string[];
  readonly mermaid: string;
}

/**
 * Forward reachability from `content.startNodeId`, walking exactly the edges the graph
 * below also renders. Deliberately re-derived rather than shared with `validate.ts`'s
 * private `computeReachable` — see the module comment.
 */
function computeReachableIds(content: StoryGraphCampaign): ReadonlySet<string> {
  const reachable = new Set<string>();
  const stack = [content.startNodeId];

  while (stack.length > 0) {
    const id = stack.pop()!;
    if (reachable.has(id) || !Object.hasOwn(content.nodes, id)) continue;
    reachable.add(id);

    const node = content.nodes[id]!;
    if (node.kind === "choice") for (const choice of node.choices) stack.push(choice.goto);
    else if (node.kind === "auto") stack.push(node.goto);
    else if (node.kind === "random") for (const transition of node.transitions) stack.push(transition.goto);
  }

  return reachable;
}

/** Mermaid vertex ids must be identifier-shaped; node ids are sanitized rather than
 *  trusted, so an authored id with a character Mermaid treats specially never breaks the
 *  diagram. Node ids are unique by construction (`Record` keys), and this mapping is
 *  injective over the characters it changes, so no two distinct node ids can collide. */
function mermaidId(nodeId: string): string {
  return `n_${nodeId.replace(/[^A-Za-z0-9_]/g, "_")}`;
}

function escapeLabel(text: string): string {
  return text.replace(/"/g, "&quot;");
}

function vertexLine(vertex: GraphVertex): string {
  const id = mermaidId(vertex.id);
  const label = escapeLabel(vertex.id);
  return vertex.kind === "ending" ? `  ${id}(("${label}"))` : `  ${id}["${label}"]`;
}

function edgeLine(edge: GraphEdge): string {
  const from = mermaidId(edge.from);
  const to = mermaidId(edge.to);
  return edge.label.length > 0 ? `  ${from} -->|"${escapeLabel(edge.label)}"| ${to}` : `  ${from} --> ${to}`;
}

/**
 * Builds the graph for one story-graph campaign (W80.1–W80.4): a vertex per node in
 * sorted-id order, an edge per authored transition in authored order within each node,
 * and the reachable-from-start set computed independently of Tier 2. Pure — no I/O, no
 * RNG — so the same campaign always produces the same `CampaignGraph` (W80.2).
 */
export function buildCampaignGraph(content: StoryGraphCampaign): CampaignGraph {
  const nodeIds = Object.keys(content.nodes).sort();

  const vertices: GraphVertex[] = nodeIds.map((id) => ({ id, kind: content.nodes[id]!.kind }));

  const edges: GraphEdge[] = [];
  let choiceCount = 0;
  let endingCount = 0;
  for (const id of nodeIds) {
    const node = content.nodes[id]!;
    if (node.kind === "choice") {
      for (const choice of node.choices) {
        choiceCount++;
        edges.push({ from: id, to: choice.goto, label: choice.id });
      }
    } else if (node.kind === "auto") {
      edges.push({ from: id, to: node.goto, label: "" });
    } else if (node.kind === "random") {
      for (const transition of node.transitions) {
        edges.push({ from: id, to: transition.goto, label: `weight=${transition.weight}` });
      }
    } else {
      endingCount++;
    }
  }

  const reachable = computeReachableIds(content);
  const unreachable = nodeIds.filter((id) => !reachable.has(id));

  const lines = ["graph LR", ...vertices.map(vertexLine), ...edges.map(edgeLine)];
  if (unreachable.length > 0) {
    lines.push("  classDef unreachable fill:#f88,stroke:#900,stroke-width:2px;");
    lines.push(`  class ${unreachable.map(mermaidId).join(",")} unreachable;`);
  }

  return {
    vertices,
    edges,
    counts: { nodes: nodeIds.length, choices: choiceCount, endings: endingCount },
    unreachable,
    mermaid: lines.join("\n"),
  };
}

function printGraph(campaignId: string, graph: CampaignGraph): void {
  console.log(`"${campaignId}" — ${graph.counts.nodes} node(s), ${graph.counts.choices} choice(s), ${graph.counts.endings} ending(s).\n`);
  console.log(graph.mermaid);
  console.log(`\nUnreachable: ${joinOrNone(graph.unreachable)}`);
}

async function main(): Promise<void> {
  const moduleName = process.argv[2];
  const entry = moduleName !== undefined ? CAMPAIGN_CATALOGUE[`${moduleName}.ts`] : undefined;

  if (!entry) {
    const known = Object.keys(CAMPAIGN_CATALOGUE).map((file) => file.replace(/\.ts$/, "")).join(", ");
    console.error(`Usage: graph-campaign <campaign-module>\nKnown campaign modules: ${known}`);
    process.exitCode = 1;
    return;
  }

  const built: CommandResult<BuiltCampaign> = entry.build();
  if (!built.ok || !built.value) {
    console.error(`graph-campaign: campaign failed to build — ${JSON.stringify(built.errors)}`);
    process.exitCode = 1;
    return;
  }

  if (built.value.campaign.kindId !== "story-graph") {
    console.error(`graph-campaign: "${moduleName}" is a "${built.value.campaign.kindId}" campaign — this tool only graphs story-graph campaigns.`);
    process.exitCode = 1;
    return;
  }

  const graph = buildCampaignGraph(built.value.campaign.content as StoryGraphCampaign);
  printGraph(entry.campaignId, graph);
}

runIfMainModule(import.meta.url, main);
