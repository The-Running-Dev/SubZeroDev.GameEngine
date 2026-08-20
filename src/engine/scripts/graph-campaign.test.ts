import { describe, it, expect } from "vitest";

import type { StoryGraphCampaign } from "../src/kinds/story-graph/campaign.js";
import { buildBulgariaBureaucracyCampaign } from "../src/campaigns/bulgaria-bureaucracy.js";

import { buildCampaignGraph, mermaidId } from "./graph-campaign.js";
import { CAMPAIGN_CATALOGUE, checkBuiltCampaign } from "./check-content.js";

function bulgariaBureaucracyContent(): StoryGraphCampaign {
  const built = buildBulgariaBureaucracyCampaign();
  if (!built.ok || !built.value) throw new Error("bulgaria-bureaucracy fixture failed to build");
  return built.value.campaign.content as StoryGraphCampaign;
}

describe("buildCampaignGraph — W80.1", () => {
  it("emits one vertex per node and one edge per choice, counted against the built campaign", () => {
    const content = bulgariaBureaucracyContent();
    const graph = buildCampaignGraph(content);

    const nodeIds = Object.keys(content.nodes);
    expect(graph.vertices.length).toBe(nodeIds.length);
    expect(new Set(graph.vertices.map((v) => v.id))).toEqual(new Set(nodeIds));

    const expectedChoiceCount = Object.values(content.nodes)
      .filter((n) => n.kind === "choice")
      .reduce((sum, n) => sum + n.choices.length, 0);
    expect(graph.counts.choices).toBe(expectedChoiceCount);
    expect(graph.edges.every((e) => e.label !== "" || content.nodes[e.from]!.kind === "auto")).toBe(true);

    const expectedEndingCount = Object.values(content.nodes).filter((n) => n.kind === "ending").length;
    expect(graph.counts.endings).toBe(expectedEndingCount);
    expect(graph.counts.nodes).toBe(nodeIds.length);
  });

  it("distinguishes ending nodes from choice, auto, and random nodes in the rendered graph", () => {
    const content = bulgariaBureaucracyContent();
    const graph = buildCampaignGraph(content);

    const lines = graph.mermaid.split("\n");
    for (const vertex of graph.vertices) {
      const id = mermaidId(vertex.id);
      const line = lines.find((l) => l.includes(`${id}[`) || l.includes(`${id}((`));
      expect(line, `no rendered vertex line for "${vertex.id}"`).toBeDefined();
      if (vertex.kind === "ending") {
        expect(line).toContain("((");
      } else {
        expect(line).toContain("[");
        expect(line).not.toContain("((");
      }
    }
  });

  it("labels choice edges by choice id", () => {
    const content = bulgariaBureaucracyContent();
    const graph = buildCampaignGraph(content);

    for (const [nodeId, node] of Object.entries(content.nodes)) {
      if (node.kind !== "choice") continue;
      for (const choice of node.choices) {
        const match = graph.edges.find((e) => e.from === nodeId && e.to === choice.goto && e.label === choice.id);
        expect(match, `no edge for ${nodeId} --${choice.id}--> ${choice.goto}`).toBeDefined();
      }
    }
  });
});

describe("buildCampaignGraph — W80.2", () => {
  it("is deterministic: repeated calls on the same campaign produce byte-identical mermaid output", () => {
    const content = bulgariaBureaucracyContent();
    const first = buildCampaignGraph(content);
    const second = buildCampaignGraph(content);
    expect(second.mermaid).toBe(first.mermaid);
  });

  it("orders vertices and edges canonically rather than by object-iteration order", () => {
    const content = bulgariaBureaucracyContent();
    const reorderedNodes: StoryGraphCampaign["nodes"] = {};
    for (const key of Object.keys(content.nodes).sort().reverse()) {
      reorderedNodes[key] = content.nodes[key]!;
    }
    const reordered: StoryGraphCampaign = { ...content, nodes: reorderedNodes };

    const original = buildCampaignGraph(content);
    const fromReordered = buildCampaignGraph(reordered);
    expect(fromReordered.mermaid).toBe(original.mermaid);

    const ids = original.vertices.map((v) => v.id);
    expect(ids).toEqual([...ids].sort());
  });
});

describe("buildCampaignGraph — W80.3", () => {
  it("renders the largest committed story-graph campaign without truncation, with counts printed", () => {
    const content = bulgariaBureaucracyContent();
    const graph = buildCampaignGraph(content);

    const lines = graph.mermaid.split("\n");
    for (const vertex of graph.vertices) {
      const id = mermaidId(vertex.id);
      expect(lines.some((l) => l.includes(id)), `no rendered line for "${vertex.id}"`).toBe(true);
    }
    expect(graph.counts.nodes).toBeGreaterThan(0);
    expect(graph.counts.nodes).toBe(Object.keys(content.nodes).length);
  });
});

describe("buildCampaignGraph — W80.4", () => {
  it("marks exactly the nodes W77's checker reports as unreachable_node, on the same campaign", () => {
    const entry = CAMPAIGN_CATALOGUE["bulgaria-bureaucracy.ts"];
    if (!entry) throw new Error("bulgaria-bureaucracy.ts missing from the shared catalogue");
    const built = entry.build();
    if (!built.ok || !built.value) throw new Error("bulgaria-bureaucracy fixture failed to build");

    const graph = buildCampaignGraph(built.value.campaign.content as StoryGraphCampaign);
    const checked = checkBuiltCampaign(built.value);
    const tier2Unreachable = checked.warnings.filter((w) => w.code === "unreachable_node").map((w) => w.path).filter((p): p is string => p !== undefined);

    expect([...graph.unreachable].sort()).toEqual([...tier2Unreachable].sort());
  });
});

describe("buildCampaignGraph — W80.5", () => {
  it("returns a graph derived only from the built campaign content passed in", () => {
    const content = bulgariaBureaucracyContent();
    const before = JSON.stringify(content);
    buildCampaignGraph(content);
    expect(JSON.stringify(content)).toBe(before);
  });
});
