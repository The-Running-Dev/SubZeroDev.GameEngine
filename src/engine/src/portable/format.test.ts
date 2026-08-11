import { describe, it, expect } from "vitest";
import { fromPortable, toPortable, type PortableCatalog } from "./format.js";
import { buildStableLifeCampaign } from "../campaigns/stable-life.js";
import { buildWorldGraphMvpCampaign } from "../campaigns/world-graph-mvp.js";
import { buildWhatWouldLuciferDoCampaign, whatWouldLuciferDoMigration } from "../campaigns/what-would-lucifer-do.js";
import type { BuiltCampaign } from "../core/registry/types.js";
import type { CommandResult } from "../core/kernel/reasons.js";

const catalog: PortableCatalog = {
  title: "Test",
  description: "Test fixture",
  duration: "1 min",
  contentNotice: "None",
  featured: false,
};

function unwrap(result: CommandResult<BuiltCampaign>): BuiltCampaign {
  expect(result.ok).toBe(true);
  if (!result.ok || result.value === undefined) throw new Error("expected a successful build");
  return result.value;
}

describe("toPortable/fromPortable — world-graph and simulation kinds", () => {
  it("round-trips a world-graph campaign's content unchanged and unhardened", () => {
    const source = unwrap(buildWorldGraphMvpCampaign());
    const portable = toPortable(source, catalog);
    expect(portable.campaign.kindId).toBe("world-graph");
    const { built } = fromPortable(portable);
    expect(built.campaign.content).toEqual(source.campaign.content);
    expect(built.campaign.migrateState).toBeUndefined();
  });

  it("round-trips a simulation campaign's content unchanged and unhardened", () => {
    const source = unwrap(buildStableLifeCampaign());
    const portable = toPortable(source, catalog);
    expect(portable.campaign.kindId).toBe("simulation");
    const { built } = fromPortable(portable);
    expect(built.campaign.content).toEqual(source.campaign.content);
    expect(built.campaign.migrateState).toBeUndefined();
  });

  it("rejects a migration passed for a world-graph campaign", () => {
    const source = unwrap(buildWorldGraphMvpCampaign());
    expect(() => toPortable(source, catalog, { fromVersion: "1.0.0" })).toThrow(/only supported for story-graph/);
  });

  it("rejects a migration passed for a simulation campaign", () => {
    const source = unwrap(buildStableLifeCampaign());
    expect(() => toPortable(source, catalog, { fromVersion: "1.0.0" })).toThrow(/only supported for story-graph/);
  });
});

describe("toPortable/fromPortable — story-graph hardening", () => {
  it("restores a null prototype on content-controlled maps after a JSON round-trip, and reattaches the migration", () => {
    const source = unwrap(buildWhatWouldLuciferDoCampaign());
    const portable = toPortable(source, catalog, whatWouldLuciferDoMigration);
    const roundTripped = JSON.parse(JSON.stringify(portable));
    const { built } = fromPortable(roundTripped);
    const content = built.campaign.content as { variables: object; nodes: object };
    expect(Object.getPrototypeOf(content.variables)).toBeNull();
    expect(Object.getPrototypeOf(content.nodes)).toBeNull();
    expect(built.campaign.migrateState).toBeInstanceOf(Function);
  });
});
