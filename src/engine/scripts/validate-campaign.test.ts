import { describe, it, expect } from "vitest";

import { checkStoryGraphCampaign, reportHasFailures } from "./validate-campaign.js";
import { buildTier3UnreachableEndingFixtureCampaign } from "../src/campaigns/tier3-unreachable-ending-fixture.js";
import { buildBulgariaBureaucracyCampaign } from "../src/campaigns/bulgaria-bureaucracy.js";
import { buildValidatedContentRegistry } from "../src/core/validation/tiered.js";
import { storyGraphKind } from "../src/kinds/story-graph/kind.js";
import type { KindRegistry } from "../src/core/kernel/types.js";
import type { StoryGraphCampaign } from "../src/kinds/story-graph/campaign.js";

const KINDS: KindRegistry = { "story-graph": storyGraphKind } as KindRegistry;

function fixtureContent(): StoryGraphCampaign {
  const built = buildTier3UnreachableEndingFixtureCampaign();
  if (!built.ok || !built.value) throw new Error("fixture failed to build");
  return built.value.campaign.content as StoryGraphCampaign;
}

describe("checkStoryGraphCampaign — the tier-3-unreachable-ending fixture", () => {
  it("passes Tier 1 and Tier 2 clean — only Tier 3 can tell victory apart from defeat (W73.2)", () => {
    const built = buildTier3UnreachableEndingFixtureCampaign();
    expect(built.ok).toBe(true);
    if (!built.ok || !built.value) return;

    const registry = buildValidatedContentRegistry([built.value], KINDS);
    expect(registry.errors).toEqual([]);
    expect(registry.warnings).toEqual([]);
    expect(registry.ok).toBe(true);
  });

  it("names the one unreachable ending and fails (W73.2)", () => {
    const report = checkStoryGraphCampaign(fixtureContent());

    expect(report.bounded).toBe(false);
    expect(report.endings).toEqual(
      expect.arrayContaining([
        { endingId: "victory", nodeId: "victory", status: "unreachable" },
        { endingId: "defeat", nodeId: "defeat", status: "reachable" },
      ]),
    );
    expect(report.endings).toHaveLength(2);
    expect(reportHasFailures(report)).toBe(true);
  });

  it("reports the unsatisfiable choice by node id and choice id (W73.3)", () => {
    const report = checkStoryGraphCampaign(fixtureContent());

    expect(report.choiceRequirements).toEqual([{ nodeId: "start", choiceId: "overpower", status: "unsatisfiable" }]);
  });
});

describe("checkStoryGraphCampaign — a committed real campaign (W73.1)", () => {
  it("reports every ending of bulgaria-bureaucracy reachable, and does not fail", () => {
    const built = buildBulgariaBureaucracyCampaign();
    expect(built.ok).toBe(true);
    if (!built.ok || !built.value) return;

    const report = checkStoryGraphCampaign(built.value.campaign.content as StoryGraphCampaign);

    expect(report.bounded).toBe(false);
    expect(report.endings.length).toBeGreaterThan(0);
    for (const ending of report.endings) {
      expect(ending.status).toBe("reachable");
    }
    for (const choice of report.choiceRequirements) {
      expect(choice.status).toBe("satisfiable");
    }
    expect(reportHasFailures(report)).toBe(false);
  });
});

describe("checkStoryGraphCampaign — bounded search honesty (W73.5)", () => {
  it("reports 'unknown', never 'unreachable', for a path cut off by the turn-depth cap", () => {
    // A single infinite auto-loop with no exit: the only ending is topologically
    // connected but never entered because the loop never breaks. The turn-depth cap must
    // stop this path rather than spin forever, and the ending must come back "unknown" —
    // the search never actually reached it, so it must not be reported as proven
    // unreachable.
    const content: StoryGraphCampaign = {
      descriptionKey: "x",
      variables: {},
      startNodeId: "loop",
      nodes: {
        loop: { id: "loop", kind: "auto", textKey: "x", goto: "loop" },
        never: { id: "never", kind: "ending", textKey: "x", endingId: "never" },
      },
      achievements: [],
    };

    const report = checkStoryGraphCampaign(content);

    expect(report.bounded).toBe(true);
    expect(report.endings).toEqual([{ endingId: "never", nodeId: "never", status: "unknown" }]);
  });
});
