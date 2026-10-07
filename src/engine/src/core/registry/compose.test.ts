/**
 * W120 — the core's half of campaign composition (04 §10.4): every envelope check rejects
 * with a path, and a composition that passes walks depth-first, composing each campaign once.
 * The kind here is a stub, so these hold for any kind; the story-graph merge is
 * `kinds/story-graph/compose.test.ts`.
 */

import { describe, expect, it } from "vitest";
import type { KindId, KindRegistry } from "../kernel/types.js";
import type { CommandResult } from "../kernel/reasons.js";
import { composeCampaigns } from "./compose.js";
import type { BuiltCampaign, Campaign, CampaignAttachment, CampaignInclude, ComposedAttachment, ComposedModule } from "./types.js";

interface Call {
  host: string;
  modules: ComposedModule[];
  attachments: ComposedAttachment[];
}

/** A kind that composes by recording the call and tagging the host's content. */
function stubKinds(): { kinds: KindRegistry; calls: Call[] } {
  const calls: Call[] = [];
  const composeContent = (host: Campaign, modules: readonly ComposedModule[], attachments: readonly ComposedAttachment[]): CommandResult<unknown> => {
    calls.push({ host: host.id, modules: [...modules], attachments: [...attachments] });
    return { ok: true, value: { composed: host.id }, errors: [], warnings: [] };
  };
  const kinds = {
    "story-graph": { id: "story-graph", composeContent },
    // Real kind ids, stubbed: one that composes, and one without `composeContent`.
    simulation: { id: "simulation", composeContent },
    "world-graph": { id: "world-graph" },
  } as unknown as KindRegistry;
  return { kinds, calls };
}

function include(alias: string, id: string, version = "1.0.0"): CampaignInclude {
  return { alias, ref: { id, version }, binding: {} };
}

function campaign(id: string, includes: CampaignInclude[] = [], kindId: KindId = "story-graph", version = "1.0.0"): BuiltCampaign {
  return {
    campaign: { id, kindId, version, titleKey: `${id}.title`, content: { own: id }, ...(includes.length > 0 ? { includes } : {}) },
    strings: new Map([[`${id}.title`, id]]),
  };
}

function compose(builtCampaigns: BuiltCampaign[], attachments: CampaignAttachment[] = [], authored?: Map<string, string>) {
  const { kinds, calls } = stubKinds();
  const authoredVersions = authored ?? new Map(builtCampaigns.map(({ campaign: c }) => [c.id, c.version] as const));
  return { result: composeCampaigns({ builtCampaigns, authoredVersions, attachments }, kinds), calls };
}

function codes(result: { errors: readonly { code: string; path?: string }[] }): [string, string | undefined][] {
  return result.errors.map((e) => [e.code, e.path]);
}

describe("composeCampaigns — rejecting (04 §10.4)", () => {
  it("include_missing: the target is not in the registry input", () => {
    const { result, calls } = compose([campaign("host", [include("m", "ghost")])]);
    expect(result.ok).toBe(false);
    expect(codes(result)).toEqual([["include_missing", "host.m"]]);
    expect(calls).toEqual([]);
  });

  it("include_version_mismatch: the pin names a version other than the authored one", () => {
    const { result } = compose([campaign("host", [include("m", "mod", "0.9.0")]), campaign("mod")]);
    expect(codes(result)).toEqual([["include_version_mismatch", "host.m"]]);
    expect(result.errors[0]!.details).toEqual({ pinned: "0.9.0", authored: "1.0.0" });
  });

  it("include_version_mismatch: checked against the authored version, not the campaign's own", () => {
    const stamped = campaign("mod", [], "story-graph", "stamped-resolution");
    const { result } = compose(
      [campaign("host", [include("m", "mod", "stamped-resolution")]), stamped],
      [],
      new Map([["host", "1.0.0"], ["mod", "1.0.0"]]),
    );
    expect(codes(result)).toEqual([["include_version_mismatch", "host.m"]]);
  });

  it("include_kind_mismatch: host and module are different kinds", () => {
    const { result } = compose([campaign("host", [include("m", "mod")]), campaign("mod", [], "simulation")]);
    expect(codes(result)).toEqual([["include_kind_mismatch", "host.m"]]);
  });

  it("include_cycle: a campaign that includes itself", () => {
    const { result } = compose([campaign("a", [include("self", "a")])]);
    expect(codes(result)).toEqual([["include_cycle", "a -> a"]]);
  });

  it("include_cycle: direct, a includes b includes a", () => {
    const { result } = compose([campaign("a", [include("b", "b")]), campaign("b", [include("a", "a")])]);
    expect(codes(result)).toEqual([["include_cycle", "a -> b -> a"]]);
  });

  it("include_cycle: transitive, a -> b -> c -> a", () => {
    const { result } = compose([
      campaign("a", [include("b", "b")]),
      campaign("b", [include("c", "c")]),
      campaign("c", [include("a", "a")]),
    ]);
    expect(codes(result)).toEqual([["include_cycle", "a -> b -> c -> a"]]);
  });

  it("include_cycle: closed by an attachment", () => {
    const { result } = compose(
      [campaign("a", [include("b", "b")]), campaign("b")],
      [{ hostCampaignId: "b", include: include("back", "a"), payload: {} }],
    );
    expect(codes(result)).toEqual([["include_cycle", "a -> b -> a"]]);
  });

  it("include_alias_collision: two includes share an alias", () => {
    const { result } = compose([campaign("host", [include("m", "mod"), include("m", "mod")]), campaign("mod")]);
    expect(codes(result)).toEqual([["include_alias_collision", "host.m"]]);
  });

  it("include_alias_collision: an attachment reuses an include's alias", () => {
    const { result } = compose(
      [campaign("host", [include("m", "mod")]), campaign("mod")],
      [{ hostCampaignId: "host", include: include("m", "mod"), payload: {} }],
    );
    expect(codes(result)).toEqual([["include_alias_collision", "host.m"]]);
  });

  it("attachment_host_missing: the host campaign is absent", () => {
    const { result } = compose([campaign("mod")], [{ hostCampaignId: "ghost", include: include("m", "mod"), payload: {} }]);
    expect(codes(result)).toEqual([["attachment_host_missing", "ghost"]]);
  });

  it("compose_unsupported: the host's kind has no composeContent", () => {
    const { result } = compose([campaign("host", [include("m", "mod", "1.0.0")], "world-graph"), campaign("mod", [], "world-graph")]);
    expect(codes(result)).toEqual([["compose_unsupported", "host"]]);
  });

  it("invalid_identifier: an alias carrying ':'", () => {
    const { result } = compose([campaign("host", [include("a:b", "mod")]), campaign("mod")]);
    expect(codes(result)).toEqual([["invalid_identifier", "host.a:b"]]);
  });

  it("reports every envelope error at once and composes nothing", () => {
    const { result, calls } = compose([campaign("host", [include("m", "ghost"), include("n", "mod", "2.0.0")]), campaign("mod")]);
    expect(codes(result)).toEqual([
      ["include_missing", "host.m"],
      ["include_version_mismatch", "host.n"],
    ]);
    expect(calls).toEqual([]);
  });

  it("every error carries a core.reason messageKey", () => {
    const { result } = compose([campaign("host", [include("m", "ghost")])]);
    expect(result.errors[0]!.messageKey).toBe("core.reason.include_missing");
  });
});

describe("composeCampaigns — passing (04 §10.4)", () => {
  it("leaves a campaign that composes nothing as the same object", () => {
    const plain = campaign("plain");
    const { result, calls } = compose([plain]);
    expect(result.ok).toBe(true);
    expect(result.value!.builtCampaigns[0]).toBe(plain);
    expect(calls).toEqual([]);
  });

  it("composes depth-first: a module is composed before its host", () => {
    const { result, calls } = compose([campaign("a", [include("b", "b")]), campaign("b", [include("c", "c")]), campaign("c")]);
    expect(result.ok).toBe(true);
    expect(calls.map((c) => c.host)).toEqual(["b", "a"]);
    // `a` receives `b` already composed.
    expect(calls[1]!.modules[0]!.campaign.content).toEqual({ composed: "b" });
  });

  it("composes a shared module once, and both hosts receive the same composed object", () => {
    const { result, calls } = compose([
      campaign("h1", [include("m", "mod")]),
      campaign("h2", [include("m", "mod")]),
      campaign("mod", [include("leaf", "leaf")]),
      campaign("leaf"),
    ]);
    expect(result.ok).toBe(true);
    expect(calls.map((c) => c.host)).toEqual(["mod", "h1", "h2"]);
    expect(calls[1]!.modules[0]!.campaign).toBe(calls[2]!.modules[0]!.campaign);
  });

  it("hands attachments to the host after its includes, in the order given", () => {
    const { calls } = compose(
      [campaign("host", [include("m", "mod")]), campaign("mod"), campaign("x"), campaign("y")],
      [
        { hostCampaignId: "host", include: include("y", "y"), payload: { n: 1 } },
        { hostCampaignId: "host", include: include("x", "x"), payload: { n: 2 } },
      ],
    );
    expect(calls).toHaveLength(1);
    expect(calls[0]!.modules.map((m) => m.include.alias)).toEqual(["m"]);
    expect(calls[0]!.attachments.map((a) => [a.module.include.alias, a.payload])).toEqual([
      ["y", { n: 1 }],
      ["x", { n: 2 }],
    ]);
  });

  it("unites module strings into the host's validation table, the host's own winning", () => {
    const host = campaign("host", [include("m", "mod")]);
    const mod: BuiltCampaign = { ...campaign("mod"), strings: new Map([["mod.title", "mod"], ["shared", "module"]]) };
    const hostWithShared: BuiltCampaign = { ...host, strings: new Map([["host.title", "host"], ["shared", "host"]]) };
    const { result } = compose([hostWithShared, mod]);
    const table = result.value!.validationStrings[0]!;
    expect(table.get("mod.title")).toBe("mod");
    expect(table.get("shared")).toBe("host");
    // The composed campaign keeps its own strings; the union is for validation only.
    expect(result.value!.builtCampaigns[0]!.strings).toBe(hostWithShared.strings);
  });

  it("surfaces composeContent's own rejection", () => {
    const kinds = {
      "story-graph": {
        id: "story-graph",
        composeContent: () => ({ ok: false, errors: [{ code: "exit_unmapped", messageKey: "k", path: "host.m" }], warnings: [] }),
      },
    } as unknown as KindRegistry;
    const builtCampaigns = [campaign("host", [include("m", "mod")]), campaign("mod")];
    const result = composeCampaigns(
      { builtCampaigns, authoredVersions: new Map([["host", "1.0.0"], ["mod", "1.0.0"]]), attachments: [] },
      kinds,
    );
    expect(codes(result)).toEqual([["exit_unmapped", "host.m"]]);
  });
});
