import { describe, expect, it } from "vitest";
import { buildWorldGraphMvpCampaign } from "../../campaigns/world-graph-mvp.js";
import type { Campaign } from "../../core/registry/types.js";
import type { WorldGraphCampaign } from "./content.js";
import { validateCampaign } from "./validate.js";

function mvp(): { readonly campaign: Campaign; readonly strings: ReadonlyMap<string, string> } {
  const built = buildWorldGraphMvpCampaign();
  if (!built.ok || !built.value) throw new Error("World Graph MVP fixture failed to build");
  return built.value;
}

function withContent(content: WorldGraphCampaign): { readonly campaign: Campaign; readonly strings: ReadonlyMap<string, string> } {
  const built = mvp();
  return { ...built, campaign: { ...built.campaign, content } };
}

describe("validateCampaign", () => {
  it("accepts the reference campaign through the kind boundary", () => {
    const { campaign, strings } = mvp();

    expect(validateCampaign(campaign, strings)).toMatchObject({ ok: true, errors: [], warnings: [] });
  });

  it("rejects a campaign for a different kind without inspecting its content", () => {
    const { campaign, strings } = mvp();

    expect(validateCampaign({ ...campaign, kindId: "story-graph" }, strings)).toMatchObject({
      ok: false,
      errors: [expect.objectContaining({ code: "invalid_kind", path: "kindId" })],
      warnings: [],
    });
  });

  it("reports unsafe nested integers alongside the shape error", () => {
    const { campaign, strings } = mvp();
    const content = { ...(campaign.content as WorldGraphCampaign), ticksPerDay: 1.5 };

    expect(validateCampaign({ ...campaign, content }, strings).errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "invalid_integer", path: "content.ticksPerDay" }),
      expect.objectContaining({ code: "unsafe_integer", path: "content.ticksPerDay" }),
    ]));
  });

  it("rejects an objective wear effect that cannot reach the broken-transition system", () => {
    const { campaign, strings } = mvp();
    const content = campaign.content as WorldGraphCampaign;
    const invalid = withContent({
      ...content,
      objectives: content.objectives.map((objective) => ({
        ...objective,
        onCompleted: [{ kind: "building_meter_delta", meter: "wear", delta: -1, buildings: { kind: "all" } }],
      })),
    });

    expect(validateCampaign(invalid.campaign, strings).errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "undeferrable_building_meter_effect", path: "content.objectives[0].onCompleted[0]" }),
    ]));
  });

  it("returns graph warnings without turning an otherwise valid campaign into an error", () => {
    const { campaign, strings } = mvp();
    const content = campaign.content as WorldGraphCampaign;
    const warningOnly = withContent({
      ...content,
      maps: content.maps.map((map) => ({
        ...map,
        topology: { kind: "explicit", edges: [{ from: { x: 0, y: 1 }, to: { x: 4, y: 1 }, edgeCost: 1, allowed: false }] },
      })),
    });

    expect(validateCampaign(warningOnly.campaign, strings)).toMatchObject({
      ok: true,
      errors: [],
      warnings: [expect.objectContaining({ code: "disconnected_map", path: "content.maps[0].topology" })],
    });
  });
});
