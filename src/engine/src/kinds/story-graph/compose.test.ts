/**
 * W120 — the story-graph half of campaign composition (03 §1.1, 04 §10.4): the six kind codes
 * reject with a path, composed ids are accepted and authored `:` ids are not, a pack
 * attachment appends a choice, and a host plays through a module and back out in one session
 * with the save format unchanged.
 */

import { describe, expect, it } from "vitest";
import { createCountingIds } from "../../core/determinism/counting-ids.js";
import { createEngine } from "../../core/kernel/engine.js";
import type { Engine, GameState, KindRegistry } from "../../core/kernel/types.js";
import type { LocKey } from "../../core/localization/types.js";
import type { ContentPack } from "../../core/registry/packs.js";
import { resolvePacks } from "../../core/registry/packs.js";
import type { BuiltCampaign, CampaignAttachment, CampaignInclude, ContentRegistry } from "../../core/registry/types.js";
import { buildValidatedContentRegistry, buildValidatedPackRegistry } from "../../core/validation/tiered.js";
import type { StoryGraphAttachment, StoryGraphCampaign, StoryGraphIncludeBinding } from "./campaign.js";
import { storyGraphKind } from "./kind.js";
import type { StoryGraphKindState } from "./state.js";

const kinds = { "story-graph": storyGraphKind } as unknown as KindRegistry;

// ---------------------------------------------------------------------------
// Fixtures — a market host that includes a haggling module.
// ---------------------------------------------------------------------------

/** The module: two exits, one input, two outputs, a visible stat and an achievement. */
function haggleContent(): StoryGraphCampaign {
  return {
    descriptionKey: "haggle.desc",
    variables: {
      price: { type: "int", initial: 10, min: 0, max: 20, visible: true, labelKey: "haggle.stat.price" },
      deal: { type: "bool", initial: false },
    },
    startNodeId: "start",
    achievements: [
      {
        id: "bargainer",
        nameKey: "haggle.ach.name",
        descriptionKey: "haggle.ach.desc",
        condition: { field: "var.deal", operator: "equals", value: true },
        hidden: false,
      },
    ],
    nodes: {
      start: {
        id: "start",
        kind: "choice",
        textKey: "haggle.start",
        choices: [
          { id: "accept", labelKey: "haggle.accept", effects: [{ op: "set", var: "deal", value: true }], goto: "accepted" },
          { id: "walk", labelKey: "haggle.walk", effects: [{ op: "decrement", var: "price", by: 1 }], goto: "walked" },
        ],
      },
      accepted: { id: "accepted", kind: "ending", textKey: "haggle.accepted", endingId: "deal_done" },
      walked: { id: "walked", kind: "ending", textKey: "haggle.walked", endingId: "walked_away" },
    },
    module: { inputs: ["price"], outputs: ["deal", "price"] },
  };
}

const haggleStrings: [string, string][] = [
  ["haggle.title", "Haggle"],
  ["haggle.desc", "A haggle."],
  ["haggle.stat.price", "Price"],
  ["haggle.ach.name", "Bargainer"],
  ["haggle.ach.desc", "Struck a deal."],
  ["haggle.start", "The vendor asks {price}."],
  ["haggle.accept", "Accept"],
  ["haggle.walk", "Walk away"],
  ["haggle.accepted", "Done."],
  ["haggle.walked", "You walk."],
];

function marketBinding(): StoryGraphIncludeBinding {
  return {
    exits: { deal_done: "home", walked_away: "stall" },
    inputs: { price: "cash" },
    outputs: { deal: "bought", price: "cash" },
  };
}

function marketContent(): StoryGraphCampaign {
  return {
    descriptionKey: "market.desc",
    variables: {
      cash: { type: "int", initial: 5, min: 0, max: 20, visible: true, labelKey: "market.stat.cash" },
      bought: { type: "bool", initial: false },
    },
    startNodeId: "stall",
    achievements: [],
    nodes: {
      stall: {
        id: "stall",
        kind: "choice",
        textKey: "market.stall",
        choices: [
          { id: "haggle", labelKey: "market.choice.haggle", goto: "haggle" },
          { id: "leave", labelKey: "market.choice.leave", goto: "home" },
        ],
      },
      home: { id: "home", kind: "ending", textKey: "market.home", endingId: "home" },
    },
  };
}

const marketStrings: [string, string][] = [
  ["market.title", "Market"],
  ["market.desc", "A market."],
  ["market.stat.cash", "Cash"],
  ["market.stall", "You have {cash}."],
  ["market.choice.haggle", "Haggle"],
  ["market.choice.leave", "Leave"],
  ["market.home", "Home."],
];

function include(alias: string, id: string, binding: unknown, version = "1.0.0"): CampaignInclude {
  return { alias, ref: { id, version }, binding };
}

function built(
  id: string,
  content: StoryGraphCampaign,
  strings: [string, string][],
  includes: CampaignInclude[] = [],
  version = "1.0.0",
): BuiltCampaign {
  return {
    campaign: { id, kindId: "story-graph", version, titleKey: `${id}.title`, content, ...(includes.length > 0 ? { includes } : {}) },
    strings: new Map<LocKey, string>(strings),
  };
}

function haggle(content = haggleContent()): BuiltCampaign {
  return built("haggle", content, haggleStrings);
}

function market(binding: unknown = marketBinding(), content = marketContent()): BuiltCampaign {
  return built("market", content, marketStrings, [include("haggle", "haggle", binding)]);
}

function registry(campaigns: BuiltCampaign[]): ContentRegistry {
  const result = buildValidatedContentRegistry(campaigns, kinds);
  if (!result.ok || !result.value) throw new Error(`expected a registry — ${JSON.stringify(result.errors)}`);
  return result.value;
}

function rejected(campaigns: BuiltCampaign[]): [string, string | undefined][] {
  const result = buildValidatedContentRegistry(campaigns, kinds);
  expect(result.ok).toBe(false);
  return result.errors.map((e) => [e.code, e.path]);
}

function composedOf(reg: ContentRegistry, id: string): StoryGraphCampaign {
  return reg.campaigns.get(id)!.content as StoryGraphCampaign;
}

function kindState(state: GameState): StoryGraphKindState {
  return state.kindState as StoryGraphKindState;
}

function play(engine: Engine, state: GameState, actionId: string): GameState {
  const result = engine.submitAction(state, actionId);
  if (!result.ok || !result.value) throw new Error(`expected ${actionId} to apply — ${JSON.stringify(result.errors)}`);
  return result.value;
}

// ---------------------------------------------------------------------------
// W120.4 — the six story-graph codes
// ---------------------------------------------------------------------------

describe("composeContent — rejecting (03 §8.3)", () => {
  it("include_not_module: the included campaign has no module block", () => {
    const plain = haggleContent();
    delete plain.module;
    expect(rejected([market(), haggle(plain)])).toEqual([["include_not_module", "market.haggle"]]);
  });

  it("include_not_module: the module reads `ending`", () => {
    const content = haggleContent();
    content.achievements[0]!.condition = { field: "ending", operator: "equals", value: "deal_done" };
    expect(rejected([market(), haggle(content)])).toEqual([["include_not_module", "market.haggle"]]);
  });

  it("exit_unmapped: a module ending the binding does not map", () => {
    const binding = { ...marketBinding(), exits: { deal_done: "home" } };
    expect(rejected([market(binding), haggle()])).toEqual([["exit_unmapped", "market.haggle.exits.walked_away"]]);
  });

  it("exit_unmapped: an exit mapped that the module does not have", () => {
    const binding = { ...marketBinding(), exits: { ...marketBinding().exits, vanished: "home" } };
    expect(rejected([market(binding), haggle()])).toEqual([["exit_unmapped", "market.haggle.exits.vanished"]]);
  });

  it("binding_undeclared: a module variable the module does not declare as an input", () => {
    const binding = { ...marketBinding(), inputs: { deal: "bought" } };
    expect(rejected([market(binding), haggle()])).toEqual([["binding_undeclared", "market.haggle.inputs.deal"]]);
  });

  it("binding_undeclared: a host variable the host does not declare", () => {
    const binding = { ...marketBinding(), outputs: { deal: "ghost" } };
    expect(rejected([market(binding), haggle()])).toEqual([["binding_undeclared", "market.haggle.outputs.deal"]]);
  });

  it("binding_type_mismatch: a bool output bound to an int host variable", () => {
    const binding = { ...marketBinding(), outputs: { deal: "cash" } };
    expect(rejected([market(binding), haggle()])).toEqual([["binding_type_mismatch", "market.haggle.outputs.deal"]]);
  });

  it("attachment_node_not_choice: the host node is an ending", () => {
    const result = buildValidatedPackRegistry([marketPack(), hagglePack(), attachmentPack("home", "extra")], kinds);
    expect(result.errors.map((e) => [e.code, e.path])).toEqual([["attachment_node_not_choice", "home"]]);
  });

  it("attachment_choice_collision: the host node already has the choice id", () => {
    const result = buildValidatedPackRegistry([marketPack(), hagglePack(), attachmentPack("stall", "leave")], kinds);
    expect(result.errors.map((e) => [e.code, e.path])).toEqual([["attachment_choice_collision", "stall.leave"]]);
  });

  it("every kind code carries a story-graph.reason messageKey", () => {
    const binding = { ...marketBinding(), exits: { deal_done: "home" } };
    const result = buildValidatedContentRegistry([market(binding), haggle()], kinds);
    expect(result.errors[0]!.messageKey).toBe("story-graph.reason.exit_unmapped");
  });
});

// ---------------------------------------------------------------------------
// W120.5 — identifiers
// ---------------------------------------------------------------------------

describe("identifiers (04 §17)", () => {
  it("rejects an authored node, variable and achievement id containing ':'", () => {
    const content = haggleContent();
    content.nodes["a:b"] = { id: "a:b", kind: "ending", textKey: "haggle.walked", endingId: "walked_away" };
    content.variables["v:w"] = { type: "bool", initial: false };
    content.achievements[0]!.id = "x:y";
    const codes = rejected([built("solo", content, [...haggleStrings, ["solo.title", "Solo"]])]);
    expect(codes).toEqual(expect.arrayContaining([["invalid_identifier", "a:b"], ["invalid_identifier", "v:w"], ["invalid_identifier", "x:y"]]));
    expect(codes.every(([code]) => code === "invalid_identifier")).toBe(true);
  });

  it("rejects a composed-shaped id authored in a host", () => {
    const content = marketContent();
    content.variables["haggle::price"] = { type: "int", initial: 0 };
    expect(rejected([market(marketBinding(), content), haggle()])).toEqual([["invalid_identifier", "haggle::price"]]);
  });

  it("rejects an alias containing ':'", () => {
    const host = built("market", marketContent(), marketStrings, [include("hag:gle", "haggle", marketBinding())]);
    expect(rejected([host, haggle()])).toEqual([["invalid_identifier", "market.hag:gle"]]);
  });

  it("accepts composed ids", () => {
    const composed = composedOf(registry([market(), haggle()]), "market");
    expect(Object.keys(composed.nodes).sort()).toEqual(["haggle", "haggle::accepted", "haggle::start", "haggle::walked", "home", "stall"]);
    expect(Object.keys(composed.variables).sort()).toEqual(["bought", "cash", "haggle::deal", "haggle::price"]);
    expect(composed.achievements.map((a) => a.id)).toEqual(["haggle::bargainer"]);
  });
});

// ---------------------------------------------------------------------------
// W120.2 — composition shape
// ---------------------------------------------------------------------------

describe("composition shape (04 §10.4)", () => {
  /** inner: x → fin (exit `done`); outer: start → b (inner) → fin2 (exit `out`); host: s → a (outer) → end. */
  function chain(): BuiltCampaign[] {
    const inner: StoryGraphCampaign = {
      descriptionKey: "inner.desc",
      variables: {},
      startNodeId: "x",
      achievements: [],
      nodes: {
        x: { id: "x", kind: "choice", textKey: "inner.x", choices: [{ id: "go", labelKey: "inner.go", goto: "fin" }] },
        fin: { id: "fin", kind: "ending", textKey: "inner.fin", endingId: "done" },
      },
      module: { inputs: [], outputs: [] },
    };
    const outer: StoryGraphCampaign = {
      descriptionKey: "outer.desc",
      variables: {},
      startNodeId: "start",
      achievements: [],
      nodes: {
        start: { id: "start", kind: "choice", textKey: "outer.start", choices: [{ id: "in", labelKey: "outer.in", goto: "b" }] },
        fin2: { id: "fin2", kind: "ending", textKey: "outer.fin2", endingId: "out" },
      },
      module: { inputs: [], outputs: [] },
    };
    const host: StoryGraphCampaign = {
      descriptionKey: "host.desc",
      variables: {},
      startNodeId: "s",
      achievements: [],
      nodes: {
        s: { id: "s", kind: "choice", textKey: "host.s", choices: [{ id: "in", labelKey: "host.in", goto: "a" }] },
        end: { id: "end", kind: "ending", textKey: "host.end", endingId: "end" },
      },
    };
    const text = (id: string, keys: string[]): [string, string][] => [[`${id}.title`, id], ...keys.map((k): [string, string] => [k, k])];
    return [
      built("host", host, text("host", ["host.desc", "host.s", "host.in", "host.end"]), [include("a", "outer", { exits: { out: "end" } })]),
      built("outer", outer, text("outer", ["outer.desc", "outer.start", "outer.in", "outer.fin2"]), [include("b", "inner", { exits: { done: "fin2" } })]),
      built("inner", inner, text("inner", ["inner.desc", "inner.x", "inner.go", "inner.fin"])),
    ];
  }

  it("a three-level chain composes to ids of the form a::b::x", () => {
    const composed = composedOf(registry(chain()), "host");
    expect(Object.keys(composed.nodes).sort()).toEqual(["a", "a::b", "a::b::fin", "a::b::x", "a::fin2", "a::start", "end", "s"]);
    expect(composed.nodes["a::b::fin"]).toMatchObject({ kind: "auto", goto: "a::fin2" });
    expect(composed.nodes["a::fin2"]).toMatchObject({ kind: "auto", goto: "end" });
  });

  it("plays the chain through both modules and out", () => {
    const engine = createEngine({ kinds, registry: registry(chain()), ids: createCountingIds() });
    let state = engine.createGame({ campaignId: "host", seed: "chain" }).value!;
    state = play(engine, state, "in");
    expect(kindState(state).currentNodeId).toBe("a::start");
    state = play(engine, state, "in");
    expect(kindState(state).currentNodeId).toBe("a::b::x");
    state = play(engine, state, "go");
    expect(kindState(state).endingId).toBe("end");
  });

  it("two hosts including the same module get the same composed module", () => {
    const [host, outer, inner] = chain();
    const twin: BuiltCampaign = {
      campaign: { ...host!.campaign, id: "twin", titleKey: "twin.title" },
      strings: new Map([...host!.strings, ["twin.title", "twin"]]),
    };
    // Distinct host-owned keys would collide on `string_conflict`; the twin shares the host's text.
    const reg = registry([host!, twin, outer!, inner!]);
    const a = composedOf(reg, "host");
    const b = composedOf(reg, "twin");
    for (const id of Object.keys(a.nodes).filter((id) => id.includes("::"))) {
      expect(b.nodes[id]).toEqual(a.nodes[id]);
    }
  });

  it("validates the module standalone as well as composed", () => {
    const reg = registry([market(), haggle()]);
    expect(composedOf(reg, "haggle").nodes["start"]).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// W120.7 — play through a module
// ---------------------------------------------------------------------------

describe("playing a host through a module (03 §1.1)", () => {
  function engine(): Engine {
    return createEngine({ kinds, registry: registry([market(), haggle()]), ids: createCountingIds() });
  }

  /** stall → haggle → walk (exit to stall) → haggle → accept (exit to home). */
  function run(e: Engine, cutAfter?: number): { state: GameState; trail: GameState[] } {
    let state = e.createGame({ campaignId: "market", seed: "w120" }).value!;
    const trail: GameState[] = [state];
    ["haggle", "walk", "haggle", "accept"].forEach((actionId, index) => {
      state = play(e, state, actionId);
      if (index === cutAfter) state = e.deserialize(e.serialize(state)).value!;
      trail.push(state);
    });
    return { state, trail };
  }

  it("is deterministic on a repeat", () => {
    expect(engine().serialize(run(engine()).state)).toBe(engine().serialize(run(engine()).state));
  });

  it("matches the uncut run across a save/load cut taken inside the module", () => {
    const e = engine();
    const cut = run(e, 2); // after the second entry, at haggle::start
    expect(kindState(cut.trail[3]!).currentNodeId).toBe("haggle::start");
    expect(e.serialize(cut.state)).toBe(e.serialize(run(engine()).state));
  });

  it("entry and exit each cost one turn", () => {
    const { trail } = run(engine());
    // A choice costs one; passing the entry costs one more.
    expect(kindState(trail[1]!).turn - kindState(trail[0]!).turn).toBe(2);
    // A choice costs one; passing the exit costs one more.
    expect(kindState(trail[2]!).turn - kindState(trail[1]!).turn).toBe(2);
    expect(kindState(trail[4]!).turn).toBe(8);
  });

  it("visited.<alias> counts entries", () => {
    const { trail } = run(engine());
    expect(kindState(trail[1]!).visitedCounts["haggle"]).toBe(1);
    expect(kindState(trail[3]!).visitedCounts["haggle"]).toBe(2);
  });

  it("copies a bound input in on every entry", () => {
    const { trail } = run(engine());
    expect(kindState(trail[1]!).variables["haggle::price"]).toBe(5);
    // Walking away decrements the module's price to 4 and copies it out to cash...
    expect(kindState(trail[2]!).variables["cash"]).toBe(4);
    // ...and re-entering copies cash back in.
    expect(kindState(trail[3]!).variables["haggle::price"]).toBe(4);
  });

  it("copies a bound output out on exit", () => {
    const { trail } = run(engine());
    expect(kindState(trail[3]!).variables["bought"]).toBe(false);
    expect(kindState(trail[4]!).variables["bought"]).toBe(true);
    expect(kindState(trail[4]!).endingId).toBe("home");
  });

  it("interpolation in module text reads the module's own variable", () => {
    const e = engine();
    const { trail } = run(e);
    expect(e.scene(trail[1]!).body.text).toBe("The vendor asks 5.");
    expect(e.scene(trail[3]!).body.text).toBe("The vendor asks 4.");
    expect(e.scene(trail[2]!).body.text).toBe("You have 4.");
  });

  it("a module achievement unlocks into the host's unlockedAchievements", () => {
    const { trail } = run(engine());
    expect(kindState(trail[3]!).unlockedAchievements).toEqual([]);
    expect(kindState(trail[4]!).unlockedAchievements).toEqual(["haggle::bargainer"]);
  });
});

// ---------------------------------------------------------------------------
// W120.3 / W120.8 — packs: the authored pin and attachments
// ---------------------------------------------------------------------------

function marketPack(includes: CampaignInclude[] = []): ContentPack {
  const market = built("market", marketContent(), marketStrings, includes);
  return { id: "market-pack", version: "1.0.0", kindId: "story-graph", dependsOn: [], campaigns: [market], strings: market.strings };
}

function hagglePack(): ContentPack {
  const module = haggle();
  return { id: "haggle-pack", version: "1.0.0", kindId: "story-graph", dependsOn: [], campaigns: [module], strings: module.strings };
}

function attachment(hostNodeId: string, choiceId: string, alias = "haggle", hostCampaignId = "market"): CampaignAttachment {
  const payload: StoryGraphAttachment = { hostNodeId, choice: { id: choiceId, labelKey: "attach.label" } };
  return { hostCampaignId, include: include(alias, "haggle", marketBinding()), payload };
}

function attachmentPack(hostNodeId: string, choiceId: string, ...more: CampaignAttachment[]): ContentPack {
  return {
    id: "attach-pack",
    version: "1.0.0",
    kindId: "story-graph",
    dependsOn: [],
    campaigns: [],
    strings: new Map([["attach.label", "Haggle (attached)"]]),
    attachments: [attachment(hostNodeId, choiceId), ...more],
  };
}

describe("packs (04 §10.4, 11 §3a)", () => {
  it("a pin naming the authored version passes the packed path", () => {
    const result = buildValidatedPackRegistry([marketPack([include("haggle", "haggle", marketBinding())]), hagglePack()], kinds);
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("a pin naming the stamped resolution id fails the packed path", () => {
    // The resolution id is a digest of the ordered pack refs only, so it can be known before
    // the include that names it is written.
    const stamped = resolvePacks([marketPack(), hagglePack()]).value!.resolution;
    const result = buildValidatedPackRegistry([marketPack([include("haggle", "haggle", marketBinding(), stamped)]), hagglePack()], kinds);
    expect(result.errors.map((e) => [e.code, e.path])).toEqual([["include_version_mismatch", "market.haggle"]]);
  });

  it("an attachment appends one choice after the authored ones, and it reaches the module", () => {
    const result = buildValidatedPackRegistry([marketPack(), hagglePack(), attachmentPack("stall", "bargain")], kinds);
    expect(result.errors).toEqual([]);
    const reg = result.value!;
    const stall = composedOf(reg, "market").nodes["stall"]!;
    expect(stall.kind === "choice" && stall.choices.map((c) => [c.id, c.goto])).toEqual([
      ["haggle", "haggle"],
      ["leave", "home"],
      ["bargain", "haggle"],
    ]);

    const e = createEngine({ kinds, registry: reg, ids: createCountingIds() });
    let state = e.createGame({ campaignId: "market", seed: "attach" }).value!;
    state = play(e, state, "bargain");
    expect(kindState(state).currentNodeId).toBe("haggle::start");
  });

  it("several attachments append in the order composition is handed them", () => {
    const second: CampaignAttachment = { ...attachment("stall", "second", "again"), include: include("again", "haggle", marketBinding()) };
    const result = buildValidatedPackRegistry([marketPack(), hagglePack(), attachmentPack("stall", "first", second)], kinds);
    expect(result.errors).toEqual([]);
    const stall = composedOf(result.value!, "market").nodes["stall"]!;
    expect(stall.kind === "choice" && stall.choices.map((c) => [c.id, c.goto])).toEqual([
      ["haggle", "haggle"],
      ["leave", "home"],
      ["first", "haggle"],
      ["second", "again"],
    ]);
  });

  it("an attachment on a module reaches every host that includes it", () => {
    // `tip` is attached to the haggle module's start node; both hosts include haggle.
    const tipModule: StoryGraphCampaign = {
      descriptionKey: "tip.desc",
      variables: {},
      startNodeId: "tip",
      achievements: [],
      nodes: { tip: { id: "tip", kind: "ending", textKey: "tip.text", endingId: "tipped" } },
      module: { inputs: [], outputs: [] },
    };
    const tip = built("tip", tipModule, [["tip.title", "Tip"], ["tip.desc", "A tip."], ["tip.text", "You tip."]]);
    const tipAttachment: CampaignAttachment = {
      hostCampaignId: "haggle",
      include: include("tip", "tip", { exits: { tipped: "accepted" } }),
      payload: { hostNodeId: "start", choice: { id: "tip", labelKey: "attach.label" } } satisfies StoryGraphAttachment,
    };
    const twinContent = marketContent();
    const twin = built("twin", twinContent, [...marketStrings.filter(([k]) => k !== "market.title"), ["twin.title", "Twin"]], [
      include("haggle", "haggle", marketBinding()),
    ]);
    const market = built("market", marketContent(), marketStrings, [include("haggle", "haggle", marketBinding())]);
    const pack: ContentPack = {
      id: "all",
      version: "1.0.0",
      kindId: "story-graph",
      dependsOn: [],
      campaigns: [market, twin, haggle(), tip],
      strings: new Map([...market.strings, ...twin.strings, ...haggle().strings, ...tip.strings, ["attach.label", "Tip"]]),
      attachments: [tipAttachment],
    };
    const result = buildValidatedPackRegistry([pack], kinds);
    expect(result.errors).toEqual([]);
    for (const host of ["market", "twin"]) {
      const start = composedOf(result.value!, host).nodes["haggle::start"]!;
      expect(start.kind === "choice" && start.choices.map((c) => [c.id, c.goto])).toEqual([
        ["accept", "haggle::accepted"],
        ["walk", "haggle::walked"],
        ["tip", "haggle::tip"],
      ]);
    }
  });
});
