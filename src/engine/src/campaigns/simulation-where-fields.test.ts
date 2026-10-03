import { describe, expect, it } from "vitest";
import type { BuiltCampaign } from "../core/registry/types.js";
import type { CommandResult } from "../core/kernel/reasons.js";
import { validateCampaign } from "../kinds/simulation/validate.js";
import { buildStableLifeCampaign } from "./stable-life.js";
import { buildBulgariaStableLifeCampaign } from "./bulgaria-stable-life.js";
import { buildLongHorizonLossCampaign, buildLongHorizonWinCampaign } from "./long-horizon.js";
import { buildStableLifeEffectsCampaign } from "./stable-life-effects.js";
import { buildStableLifeEventsCampaign } from "./stable-life-events.js";
import { buildStableLifeHousingCampaign } from "./stable-life-housing.js";
import { buildStableLifePossessionsCampaign } from "./stable-life-possessions.js";

const WHERE_CODES = ["unknown_collection_field", "optional_field_operator"];

/** W116.7 — every committed simulation campaign loads with no new finding. */
describe("committed simulation campaigns under the where-field check (W116.7)", () => {
  const campaigns: ReadonlyArray<readonly [string, () => CommandResult<BuiltCampaign>]> = [
    ["stable-life", buildStableLifeCampaign],
    ["bulgaria-stable-life", buildBulgariaStableLifeCampaign],
    ["long-horizon-win", buildLongHorizonWinCampaign],
    ["long-horizon-loss", buildLongHorizonLossCampaign],
    ["stable-life-effects", buildStableLifeEffectsCampaign],
    ["stable-life-events", buildStableLifeEventsCampaign],
    ["stable-life-housing", buildStableLifeHousingCampaign],
    ["stable-life-possessions", buildStableLifePossessionsCampaign],
  ];

  it.each(campaigns)("%s raises neither W116 code and stays Tier 1 clean", (_name, build) => {
    const built = build();
    if (!built.ok || !built.value) throw new Error("campaign failed to build");
    const result = validateCampaign(built.value.campaign, built.value.strings);
    expect(result.errors.filter((e) => WHERE_CODES.includes(e.code))).toEqual([]);
    expect(result.ok).toBe(true);
  });
});
