import { describe, it, expect } from "vitest";
import { buildCampaign, buildContentRegistry } from "./build.js";
import { CORE_REASON_MESSAGES } from "../kernel/reasons.js";
import type { AuthoredText, BuiltCampaign, Campaign } from "./types.js";

function makeCampaign(overrides?: Partial<Campaign>): Campaign {
  return { id: "test-campaign", kindId: "story-graph", version: "1", titleKey: "test.title", content: {}, ...overrides };
}

describe("buildCampaign", () => {
  it("builds a BuiltCampaign from authored text", () => {
    const campaign = makeCampaign();
    const authored: AuthoredText[] = [
      { key: "node.start.text", text: "You wake up." },
      { key: "choice.go", text: "Go." },
    ];
    const result = buildCampaign(campaign, authored);
    expect(result.ok).toBe(true);
    expect(result.value?.campaign).toBe(campaign);
    expect(result.value?.strings.get("node.start.text")).toBe("You wake up.");
    expect(result.value?.strings.get("choice.go")).toBe("Go.");
  });

  it("dedupes an identical key/text pair repeated in the source", () => {
    const authored: AuthoredText[] = [
      { key: "choice.go", text: "Go." },
      { key: "choice.go", text: "Go." },
    ];
    const result = buildCampaign(makeCampaign(), authored);
    expect(result.ok).toBe(true);
    expect(result.value?.strings.size).toBe(1);
  });

  it("fails when the same key is authored with two different strings", () => {
    const authored: AuthoredText[] = [
      { key: "choice.go", text: "Go." },
      { key: "choice.go", text: "Go now." },
    ];
    const result = buildCampaign(makeCampaign(), authored);
    expect(result.ok).toBe(false);
    expect(result.errors[0]?.code).toBe("string_conflict");
    expect(result.errors[0]?.path).toBe("choice.go");
  });
});

describe("buildContentRegistry", () => {
  function built(campaign: Campaign, strings: Record<string, string>): BuiltCampaign {
    return { campaign, strings: new Map(Object.entries(strings)) };
  }

  it("succeeds with no campaigns, containing exactly the core messages", () => {
    const result = buildContentRegistry([]);
    expect(result.ok).toBe(true);
    expect(result.value?.campaigns.size).toBe(0);
    expect(result.value?.strings.size).toBe(CORE_REASON_MESSAGES.size);
    for (const [key, text] of CORE_REASON_MESSAGES) {
      expect(result.value?.strings.get(key)).toBe(text);
    }
  });

  it("merges one campaign's strings alongside the core messages", () => {
    const campaign = makeCampaign();
    const result = buildContentRegistry([built(campaign, { "choice.go": "Go." })]);
    expect(result.ok).toBe(true);
    expect(result.value?.campaigns.get("test-campaign")).toBe(campaign);
    expect(result.value?.strings.get("choice.go")).toBe("Go.");
    expect(result.value?.strings.get("core.reason.unknown_action")).toBe(
      CORE_REASON_MESSAGES.get("core.reason.unknown_action"),
    );
  });

  it("rejects two campaigns sharing the same id, without leaking the duplicate's strings", () => {
    const first = built(makeCampaign({ id: "dup", version: "1" }), { "campaign.first": "First." });
    const second = built(makeCampaign({ id: "dup", version: "2" }), { "campaign.second": "Second." });
    const result = buildContentRegistry([first, second]);
    expect(result.ok).toBe(false);
    expect(result.errors[0]?.code).toBe("duplicate_campaign_id");
    expect(result.errors[0]?.path).toBe("dup");
    expect(result.value).toBeUndefined();
  });

  it("dedupes an identical key/text pair shared across two campaigns", () => {
    const a = built(makeCampaign({ id: "a" }), { "shared.key": "Shared." });
    const b = built(makeCampaign({ id: "b" }), { "shared.key": "Shared." });
    const result = buildContentRegistry([a, b]);
    expect(result.ok).toBe(true);
    expect(result.value?.strings.get("shared.key")).toBe("Shared.");
  });

  it("fails when two campaigns author the same key with different text", () => {
    const a = built(makeCampaign({ id: "a" }), { "shared.key": "One." });
    const b = built(makeCampaign({ id: "b" }), { "shared.key": "Two." });
    const result = buildContentRegistry([a, b]);
    expect(result.ok).toBe(false);
    expect(result.errors[0]?.code).toBe("string_conflict");
  });

  it("rejects a campaign writing into core.reason.*, even with the exact default text", () => {
    const matchingText = CORE_REASON_MESSAGES.get("core.reason.unknown_action") as string;
    const campaign = built(makeCampaign(), { "core.reason.unknown_action": matchingText });
    const result = buildContentRegistry([campaign]);
    expect(result.ok).toBe(false);
    expect(result.errors[0]?.code).toBe("protected_string_key");
    expect(result.errors[0]?.path).toBe("core.reason.unknown_action");
  });

  it("rejects a campaign writing a different string into core.reason.*", () => {
    const campaign = built(makeCampaign(), { "core.reason.unknown_action": "Nope, restyled." });
    const result = buildContentRegistry([campaign]);
    expect(result.ok).toBe(false);
    expect(result.errors[0]?.code).toBe("protected_string_key");
  });

  it("merges kind-supplied reason messages alongside the core ones", () => {
    const kindMessages = new Map([["story-graph.reason.not_a_choice_node", "That action can't be taken right now."]]);
    const result = buildContentRegistry([], [kindMessages]);
    expect(result.ok).toBe(true);
    expect(result.value?.strings.get("story-graph.reason.not_a_choice_node")).toBe(
      "That action can't be taken right now.",
    );
    expect(result.value?.strings.get("core.reason.unknown_action")).toBe(
      CORE_REASON_MESSAGES.get("core.reason.unknown_action"),
    );
  });

  it("still fails on a conflicting key between kind messages and a campaign's own strings", () => {
    const kindMessages = new Map([["story-graph.reason.not_a_choice_node", "Kind text."]]);
    const campaign = built(makeCampaign(), { "story-graph.reason.not_a_choice_node": "Campaign text." });
    const result = buildContentRegistry([campaign], [kindMessages]);
    expect(result.ok).toBe(false);
    expect(result.errors[0]?.code).toBe("string_conflict");
  });
});
