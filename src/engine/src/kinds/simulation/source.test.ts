import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  buildCampaign,
  buildSimulationCampaign,
  type Campaign,
  type EventChainDefinitionSource,
  type SimulationCampaignSource,
} from "../../authoring.js";
import { stableLifeSource } from "../../campaigns/stable-life.js";
import { validateCampaign } from "./validate.js";

const chains: readonly EventChainDefinitionSource[] = [
  { id: "profile-chain", scope: "profile", label: { key: "test.chain.label", text: "A continuing story" } },
  { id: "game-chain", scope: "game" },
];

const source: SimulationCampaignSource = {
  ...stableLifeSource,
  events: chains.map((chain) => ({
    id: `${chain.id}-event`,
    category: "story",
    title: { key: `test.${chain.id}.title`, text: "The next step" },
    description: { key: `test.${chain.id}.description`, text: "The story continues." },
    weight: 1,
    conditions: { field: "calendar.currentWeek", operator: "greater_or_equal", value: 1 },
    automaticOutcome: { effects: [], messages: [] },
    chainId: chain.id,
    chainStep: 0,
    tags: [],
  })),
  eventChains: chains,
};

function build(source: SimulationCampaignSource) {
  const { content, authoredText } = buildSimulationCampaign(source);
  const campaign: Campaign = {
    id: "source-chains",
    kindId: "simulation",
    version: "1.0.0",
    titleKey: "test.campaign.title",
    content,
  };
  return buildCampaign(campaign, [{ key: campaign.titleKey, text: "Source chains" }, ...authoredText]);
}

describe("simulation source event chains (#472)", () => {
  it("passes Tier 1 with source-authored chain declarations and event membership", () => {
    const built = build(source);
    if (!built.ok || !built.value) throw new Error(JSON.stringify(built));
    const result = validateCampaign(built.value.campaign, built.value.strings);
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.warnings).toEqual([]);
  });

  it("preserves declaration order and scope, lifting only present labels", () => {
    const { content, authoredText } = buildSimulationCampaign(source);
    expect(content.eventChains).toEqual([
      { id: "profile-chain", scope: "profile", labelKey: "test.chain.label" },
      { id: "game-chain", scope: "game" },
    ]);
    expect(content.eventChains?.[1]).not.toHaveProperty("labelKey");
    const baseline = buildSimulationCampaign({ ...stableLifeSource, events: source.events });
    expect(authoredText.filter((text) => !baseline.authoredText.includes(text))).toEqual([chains[0]!.label]);
    const built = build(source);
    if (!built.ok || !built.value) throw new Error(JSON.stringify(built));
    expect(built.value.strings.get("test.chain.label")).toBe("A continuing story");
  });

  it("omits absent declarations and preserves the pre-fix content and authored-text bytes", () => {
    const built = buildSimulationCampaign(stableLifeSource);
    expect(built.content).not.toHaveProperty("eventChains");
    // SHA-256 of JSON.stringify output from the builder before #472's mapping was added.
    const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
    expect(digest(built.content)).toBe("32863be1a6ea4d9bbc4a3141a84e679618df66c71249a29079242117f00f7ca7");
    expect(digest(built.authoredText)).toBe("ee406e78e7a218025f9f061e149a26f190bf0a36ca44e1bc130248896616d86f");
  });

  it("preserves an explicit empty array without collecting text", () => {
    const built = buildSimulationCampaign({ ...stableLifeSource, eventChains: [] });
    const baseline = buildSimulationCampaign(stableLifeSource);
    expect(built.content).toEqual({ ...baseline.content, eventChains: [] });
    expect(built.authoredText).toEqual(baseline.authoredText);
  });

  it("still rejects event membership without a matching declaration", () => {
    const built = build({ ...stableLifeSource, events: source.events });
    if (!built.ok || !built.value) throw new Error(JSON.stringify(built));
    const result = validateCampaign(built.value.campaign, built.value.strings);
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(chains.map((chain) => expect.objectContaining({
      code: "dangling_reference", path: chain.id,
    })));
  });

  it("leaves duplicate declaration rejection to Tier 1", () => {
    const built = build({ ...source, eventChains: [...chains, chains[0]!] });
    if (!built.ok || !built.value) throw new Error(JSON.stringify(built));
    const result = validateCampaign(built.value.campaign, built.value.strings);
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual([expect.objectContaining({ code: "duplicate_id", path: "profile-chain" })]);
  });

  it("retains the existing identical-key/text deduplication rule for labels", () => {
    const label = source.description;
    const built = build({ ...source, eventChains: chains.map((chain) => ({ ...chain, label })) });
    if (!built.ok || !built.value) throw new Error(JSON.stringify(built));
    expect(built.value.strings.get(label.key)).toBe(label.text);
  });

  it("rejects a chain label conflicting with another authored string", () => {
    const built = build({
      ...source,
      eventChains: [{ id: "profile-chain", scope: "profile", label: { ...source.description, text: "Different" } }],
    });
    expect(built.ok).toBe(false);
    expect(built.errors).toEqual([expect.objectContaining({ code: "string_conflict", path: source.description.key })]);
  });
});
