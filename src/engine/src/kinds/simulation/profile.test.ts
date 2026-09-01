import { describe, it, expect } from "vitest";
import { furthestStepsFor, resolveProfileData, simulationProfileData } from "./profile.js";
import type { Campaign } from "../../core/registry/types.js";
import type { StateChange } from "../../core/kernel/reasons.js";

const campaign: Campaign = { id: "c1", kindId: "simulation", version: "1.0.0", titleKey: "test.title", content: {} };

function chainAdvanced(chainId: string, step: number): StateChange {
  return { path: `chain.${chainId}`, op: "set", value: step, reason: "profile_chain_advanced", visible: true };
}

describe("simulationProfileData.fold — W102", () => {
  it("records the furthest step for a chain, keyed by campaignId and chainId", () => {
    const result = simulationProfileData.fold(undefined, campaign, [chainAdvanced("eviction", 2)]);
    expect(result).toEqual({ chains: [{ campaignId: "c1", chainId: "eviction", furthestStep: 2 }] });
  });

  it("is a maximum, not a sum — a lower step folded against a higher one changes nothing", () => {
    const current = { chains: [{ campaignId: "c1", chainId: "eviction", furthestStep: 3 }] };
    const result = simulationProfileData.fold(current, campaign, [chainAdvanced("eviction", 1)]);
    expect(result).toEqual({ chains: [{ campaignId: "c1", chainId: "eviction", furthestStep: 3 }] });
  });

  it("is idempotent: folding the same changes twice reaches the same value as folding once", () => {
    const once = simulationProfileData.fold(undefined, campaign, [chainAdvanced("eviction", 2)]);
    const twice = simulationProfileData.fold(once, campaign, [chainAdvanced("eviction", 2)]);
    expect(twice).toEqual(once);
  });

  it("ignores changes with a different reason or an unparseable path", () => {
    const irrelevant: StateChange = { path: "chain.eviction", op: "set", value: 2, reason: "chain_advanced", visible: true };
    const result = simulationProfileData.fold(undefined, campaign, [irrelevant]);
    expect(result).toEqual({ chains: [] });
  });

  it("tracks multiple chains independently, sorted by (campaignId, chainId)", () => {
    const result = simulationProfileData.fold(undefined, campaign, [chainAdvanced("zeta", 1), chainAdvanced("alpha", 1)]);
    expect(result).toEqual({
      chains: [
        { campaignId: "c1", chainId: "alpha", furthestStep: 1 },
        { campaignId: "c1", chainId: "zeta", furthestStep: 1 },
      ],
    });
  });

  it("keeps chains for different campaigns separate", () => {
    const otherCampaign: Campaign = { ...campaign, id: "c2" };
    const afterC1 = simulationProfileData.fold(undefined, campaign, [chainAdvanced("eviction", 1)]);
    const afterC2 = simulationProfileData.fold(afterC1, otherCampaign, [chainAdvanced("eviction", 1)]);
    expect(afterC2).toEqual({
      chains: [
        { campaignId: "c1", chainId: "eviction", furthestStep: 1 },
        { campaignId: "c2", chainId: "eviction", furthestStep: 1 },
      ],
    });
  });
});

describe("resolveProfileData / furthestStepsFor", () => {
  it("resolveProfileData rejects a malformed slice back to undefined", () => {
    expect(resolveProfileData({ chains: [{ campaignId: "c1" }] })).toBeUndefined();
    expect(resolveProfileData(undefined)).toBeUndefined();
    expect(resolveProfileData("not an object")).toBeUndefined();
  });

  it("furthestStepsFor scopes to one campaignId and maps chainId -> furthestStep", () => {
    const data = resolveProfileData({
      chains: [
        { campaignId: "c1", chainId: "eviction", furthestStep: 2 },
        { campaignId: "c2", chainId: "eviction", furthestStep: 9 },
      ],
    });
    const steps = furthestStepsFor(data, "c1");
    expect(steps.get("eviction")).toBe(2);
    expect(steps.has("eviction-other")).toBe(false);
  });

  it("furthestStepsFor on undefined profile data returns an empty map", () => {
    expect(furthestStepsFor(undefined, "c1").size).toBe(0);
  });
});
