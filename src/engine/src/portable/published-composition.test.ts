/**
 * S141 — a campaign publishes its attachments (04 §10.4, §12, §19; 16 §10; 11 §3a).
 *
 * The unpacked registry path applies the attachments a publication carries and stamps every
 * campaign they reach with `att.<h>`; `att` is reserved in an authored version's build
 * metadata; the portable format carries includes on the story-graph arm and attachments on the
 * manifest, whose `resolution` covers them.
 */

import { describe, expect, it } from "vitest";
import { createCountingIds } from "../core/determinism/counting-ids.js";
import { createEngine } from "../core/kernel/engine.js";
import { BASE_REASON_CODES, CORE_REASON_MESSAGES } from "../core/kernel/reasons.js";
import type { GameState, KindRegistry } from "../core/kernel/types.js";
import type { LocKey } from "../core/localization/types.js";
import { canonicalDigest } from "../core/registry/archive.js";
import type { ContentPack } from "../core/registry/packs.js";
import type { BuiltCampaign, CampaignAttachment, CampaignInclude, ContentRegistry } from "../core/registry/types.js";
import { buildValidatedContentRegistry, buildValidatedPackRegistry } from "../core/validation/tiered.js";
import { buildBulgariaBureaucracyCampaign } from "../campaigns/bulgaria-bureaucracy.js";
import { buildLongHorizonLossCampaign, buildLongHorizonWinCampaign } from "../campaigns/long-horizon.js";
import { buildStableLifeCampaign } from "../campaigns/stable-life.js";
import { buildWorldGraphMvpCampaign } from "../campaigns/world-graph-mvp.js";
import { simulationKind } from "../kinds/simulation/kind.js";
import type { StoryGraphAttachment, StoryGraphCampaign, StoryGraphIncludeBinding } from "../kinds/story-graph/campaign.js";
import { storyGraphKind } from "../kinds/story-graph/kind.js";
import type { StoryGraphKindState } from "../kinds/story-graph/state.js";
import { worldGraphKind } from "../kinds/world-graph/kind.js";
import { digestManifestResolution, digestPortableCampaign } from "./digest.js";
import {
  fromPortable,
  toPortable,
  type PortableCampaign,
  type PortableCampaignAttachment,
  type PortableCatalog,
  type PortableManifest,
  type PortableManifestEntry,
} from "./format.js";

const kinds = {
  "story-graph": storyGraphKind,
  simulation: simulationKind,
  "world-graph": worldGraphKind,
} as unknown as KindRegistry;

// ---------------------------------------------------------------------------
// Fixtures — a square host, a haggle module, a coin module the haggle can take.
// ---------------------------------------------------------------------------

function haggleContent(): StoryGraphCampaign {
  return {
    descriptionKey: "haggle.desc",
    variables: {
      price: { type: "int", initial: 10, min: 0, max: 20 },
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
          { id: "walk", labelKey: "haggle.walk", goto: "walked" },
        ],
      },
      accepted: { id: "accepted", kind: "ending", textKey: "haggle.accepted", endingId: "deal_done" },
      walked: { id: "walked", kind: "ending", textKey: "haggle.walked", endingId: "walked_away" },
    },
    module: { inputs: [], outputs: [] },
  };
}

const haggleStrings: [string, string][] = [
  ["haggle.title", "Haggle"],
  ["haggle.desc", "A haggle."],
  ["haggle.ach.name", "Bargainer"],
  ["haggle.ach.desc", "Struck a deal."],
  ["haggle.start", "The vendor names a price."],
  ["haggle.accept", "Accept"],
  ["haggle.walk", "Walk away"],
  ["haggle.accepted", "Done."],
  ["haggle.walked", "You walk."],
  ["attach.haggle", "Haggle (attached)"],
  ["attach.again", "Haggle again (attached)"],
];

function coinContent(): StoryGraphCampaign {
  return {
    descriptionKey: "coin.desc",
    variables: {},
    startNodeId: "flip",
    achievements: [],
    nodes: {
      flip: {
        id: "flip",
        kind: "choice",
        textKey: "coin.flip",
        choices: [{ id: "toss", labelKey: "coin.toss", goto: "landed" }],
      },
      landed: { id: "landed", kind: "ending", textKey: "coin.landed", endingId: "landed" },
    },
    module: { inputs: [], outputs: [] },
  };
}

const coinStrings: [string, string][] = [
  ["coin.title", "Coin"],
  ["coin.desc", "A coin."],
  ["coin.flip", "A coin."],
  ["coin.toss", "Toss"],
  ["coin.landed", "It lands."],
  ["attach.coin", "Flip a coin (attached)"],
];

function squareContent(): StoryGraphCampaign {
  return {
    descriptionKey: "square.desc",
    variables: {},
    startNodeId: "plaza",
    achievements: [],
    nodes: {
      plaza: {
        id: "plaza",
        kind: "choice",
        textKey: "square.plaza",
        choices: [{ id: "leave", labelKey: "square.leave", goto: "home" }],
      },
      home: { id: "home", kind: "ending", textKey: "square.home", endingId: "home" },
    },
  };
}

const squareStrings: [string, string][] = [
  ["square.title", "Square"],
  ["square.desc", "A square."],
  ["square.plaza", "The plaza."],
  ["square.leave", "Leave"],
  ["square.home", "Home."],
];

function squareBinding(): StoryGraphIncludeBinding {
  return { exits: { deal_done: "home", walked_away: "plaza" } };
}

function built(
  id: string,
  content: StoryGraphCampaign,
  strings: [string, string][],
  version = "1.0.0",
  includes: CampaignInclude[] = [],
): BuiltCampaign {
  return {
    campaign: { id, kindId: "story-graph", version, titleKey: `${id}.title`, content, ...(includes.length > 0 ? { includes } : {}) },
    strings: new Map<LocKey, string>(strings),
  };
}

const square = (version = "1.0.0", includes: CampaignInclude[] = []) => built("square", squareContent(), squareStrings, version, includes);
const haggle = (version = "1.0.0") => built("haggle", haggleContent(), haggleStrings, version);
const coin = () => built("coin", coinContent(), coinStrings);

function haggleOnSquare(alias = "haggle", choiceId = "bargain", labelKey = "attach.haggle"): CampaignAttachment {
  const payload: StoryGraphAttachment = { hostNodeId: "plaza", choice: { id: choiceId, labelKey } };
  return { hostCampaignId: "square", include: { alias, ref: { id: "haggle", version: "1.0.0" }, binding: squareBinding() }, payload };
}

/** An attachment on the haggle module itself: a coin toss at its opening, landing on `accepted`. */
function coinOnHaggle(): CampaignAttachment {
  const payload: StoryGraphAttachment = { hostNodeId: "start", choice: { id: "flip", labelKey: "attach.coin" } };
  return {
    hostCampaignId: "haggle",
    include: { alias: "coin", ref: { id: "coin", version: "1.0.0" }, binding: { exits: { landed: "accepted" } } },
    payload,
  };
}

function ok(result: ReturnType<typeof buildValidatedContentRegistry>): ContentRegistry {
  if (!result.ok || !result.value) throw new Error(`expected a registry — ${JSON.stringify(result.errors)}`);
  return result.value;
}

const h12 = (attachments: readonly CampaignAttachment[]) => canonicalDigest(attachments).slice(0, 12);

function unwrap(result: { ok: boolean; value?: BuiltCampaign }): BuiltCampaign {
  if (!result.ok || !result.value) throw new Error("expected a built campaign");
  return result.value;
}

// ---------------------------------------------------------------------------
// S141.1 — no attachments, no change
// ---------------------------------------------------------------------------

describe("S141.1 — a registry built without attachments is unchanged", () => {
  const committed = (): BuiltCampaign[] => [
    unwrap(buildBulgariaBureaucracyCampaign()),
    unwrap(buildStableLifeCampaign()),
    unwrap(buildLongHorizonWinCampaign()),
    unwrap(buildLongHorizonLossCampaign()),
    unwrap(buildWorldGraphMvpCampaign()),
  ];

  it("two arguments and an empty third build deep-equal registries", () => {
    // One source set for both: a built campaign may carry functions, which compare by reference.
    const sources = committed();
    const two = ok(buildValidatedContentRegistry(sources, kinds));
    const empty = ok(buildValidatedContentRegistry(sources, kinds, []));
    expect(empty).toEqual(two);
  });

  it("every committed campaign keeps its authored version", () => {
    const sources = committed();
    const registry = ok(buildValidatedContentRegistry(sources, kinds, []));
    for (const { campaign } of sources) expect(registry.campaigns.get(campaign.id)!.version).toBe(campaign.version);
  });

  it("a composed fixture set without attachments keeps its versions too", () => {
    const registry = ok(buildValidatedContentRegistry([square(), haggle(), coin()], kinds));
    expect([...registry.campaigns.values()].map((c) => c.version)).toEqual(["1.0.0", "1.0.0", "1.0.0"]);
  });
});

// ---------------------------------------------------------------------------
// S141.2–S141.4 — stamping
// ---------------------------------------------------------------------------

describe("S141.2 — an attachment stamps the host it reaches", () => {
  it("the host freezes under <authored>+att.<h12>; the module and an unreached campaign do not move", () => {
    const attachment = haggleOnSquare();
    const registry = ok(buildValidatedContentRegistry([square("1.2.0"), haggle(), coin()], kinds, [attachment]));
    const hash = h12([attachment]);
    expect(hash).toMatch(/^[0-9a-f]{12}$/);
    expect(registry.campaigns.get("square")!.version).toBe(`1.2.0+att.${hash}`);
    expect(registry.campaigns.get("haggle")!.version).toBe("1.0.0");
    expect(registry.campaigns.get("coin")!.version).toBe("1.0.0");
  });

  it("the attachment is applied: the host node gains the attached choice", () => {
    const registry = ok(buildValidatedContentRegistry([square(), haggle()], kinds, [haggleOnSquare()]));
    const plaza = (registry.campaigns.get("square")!.content as StoryGraphCampaign).nodes["plaza"]!;
    expect(plaza.kind === "choice" && plaza.choices.map((c) => c.id)).toEqual(["leave", "bargain"]);
  });
});

describe("S141.3 — existing build metadata is extended, never given a second '+'", () => {
  it("1.2.0+build.7 stamps as 1.2.0+build.7.att.<h12>", () => {
    const attachment = haggleOnSquare();
    const registry = ok(buildValidatedContentRegistry([square("1.2.0+build.7"), haggle()], kinds, [attachment]));
    expect(registry.campaigns.get("square")!.version).toBe(`1.2.0+build.7.att.${h12([attachment])}`);
  });
});

describe("S141.4 — an attachment on a module reaches every host that includes it", () => {
  const includeHaggle = (): CampaignInclude => ({ alias: "haggle", ref: { id: "haggle", version: "1.0.0" }, binding: squareBinding() });

  it("stamps the module and its host; the host's digest covers the module's attachment; the pin still passes", () => {
    const attachment = coinOnHaggle();
    const result = buildValidatedContentRegistry([square("1.0.0", [includeHaggle()]), haggle(), coin()], kinds, [attachment]);
    const registry = ok(result);
    const hash = h12([attachment]);
    expect(registry.campaigns.get("haggle")!.version).toBe(`1.0.0+att.${hash}`);
    expect(registry.campaigns.get("square")!.version).toBe(`1.0.0+att.${hash}`);
    expect(registry.campaigns.get("coin")!.version).toBe("1.0.0");
    expect(result.errors).toEqual([]);
  });

  it("a host reached by its own attachment and its module's digests both, in argument order", () => {
    const own = haggleOnSquare("bargainer", "bargain");
    const onModule = coinOnHaggle();
    const registry = ok(
      buildValidatedContentRegistry([square("1.0.0", [includeHaggle()]), haggle(), coin()], kinds, [onModule, own]),
    );
    expect(registry.campaigns.get("square")!.version).toBe(`1.0.0+att.${h12([onModule, own])}`);
    expect(registry.campaigns.get("haggle")!.version).toBe(`1.0.0+att.${h12([onModule])}`);
  });

  it("swapping two attachments on one host changes its stamped version", () => {
    const first = haggleOnSquare("first", "bargain", "attach.haggle");
    const second = haggleOnSquare("second", "again", "attach.again");
    const ab = ok(buildValidatedContentRegistry([square(), haggle()], kinds, [first, second]));
    const ba = ok(buildValidatedContentRegistry([square(), haggle()], kinds, [second, first]));
    expect(ab.campaigns.get("square")!.version).not.toBe(ba.campaigns.get("square")!.version);
    expect(ab.campaigns.get("square")!.version).toBe(`1.0.0+att.${h12([first, second])}`);
    expect(ba.campaigns.get("square")!.version).toBe(`1.0.0+att.${h12([second, first])}`);
  });

  it("the pack path does not stamp again — its versions stay the resolution id", () => {
    const pack = (id: string, campaign: BuiltCampaign): ContentPack => ({
      id,
      version: "1.0.0",
      kindId: "story-graph",
      dependsOn: [],
      campaigns: [campaign],
      strings: campaign.strings,
    });
    const attachPack: ContentPack = {
      id: "attach-pack",
      version: "1.0.0",
      kindId: "story-graph",
      dependsOn: [],
      campaigns: [],
      strings: new Map(),
      attachments: [haggleOnSquare()],
    };
    const registry = ok(buildValidatedPackRegistry([pack("square-pack", square()), pack("haggle-pack", haggle()), attachPack], kinds));
    expect(registry.campaigns.get("square")!.version).toBe(registry.resolution);
    expect(registry.campaigns.get("square")!.version).not.toContain("att.");
  });
});

// ---------------------------------------------------------------------------
// S141.5 / S141.6 — the reserved identifier
// ---------------------------------------------------------------------------

describe("S141.5 — `att` is reserved in an authored version's build metadata", () => {
  const REFUSED = ["1.0.0+att", "1.0.0+att.1", "1.0.0+x.att"];
  const ACCEPTED = ["1.0.0-att", "1.0.0+attic", "1.0.0+x-att"];

  function packOf(version: string): ContentPack[] {
    const host = square(version);
    const module = haggle();
    return [
      { id: "square-pack", version: "1.0.0", kindId: "story-graph", dependsOn: [], campaigns: [host], strings: host.strings },
      { id: "haggle-pack", version: "1.0.0", kindId: "story-graph", dependsOn: [], campaigns: [module], strings: module.strings },
    ];
  }

  const withAttachment: ContentPack = {
    id: "attach-pack",
    version: "1.0.0",
    kindId: "story-graph",
    dependsOn: [],
    campaigns: [],
    strings: new Map(),
    attachments: [haggleOnSquare()],
  };

  const entryPoints = {
    "content, without attachments": (v: string) => buildValidatedContentRegistry([square(v), haggle()], kinds),
    "content, with attachments": (v: string) => buildValidatedContentRegistry([square(v), haggle()], kinds, [haggleOnSquare()]),
    "pack, without attachments": (v: string) => buildValidatedPackRegistry(packOf(v), kinds),
    "pack, with attachments": (v: string) => buildValidatedPackRegistry([...packOf(v), withAttachment], kinds),
  } as const;

  for (const [label, build] of Object.entries(entryPoints)) {
    for (const version of REFUSED) {
      it(`${label}: ${version} fails Tier 1 with reserved_version_identifier`, () => {
        const result = build(version);
        expect(result.ok).toBe(false);
        expect(result.value).toBeUndefined();
        expect(result.errors).toEqual([
          {
            code: "reserved_version_identifier",
            messageKey: "core.reason.reserved_version_identifier",
            path: "square",
            details: { version },
          },
        ]);
      });
    }
    for (const version of ACCEPTED) {
      it(`${label}: ${version} builds`, () => {
        const result = build(version);
        expect(result.errors).toEqual([]);
        expect(result.ok).toBe(true);
      });
    }
  }
});

describe("S141.6 — the reserved code is a base code with a core message", () => {
  it("is in BASE_REASON_CODES and has a default-English message", () => {
    expect(BASE_REASON_CODES).toContain("reserved_version_identifier");
    expect(CORE_REASON_MESSAGES.get("core.reason.reserved_version_identifier")).toEqual(expect.any(String));
  });
});

// ---------------------------------------------------------------------------
// S141.7 — portable includes
// ---------------------------------------------------------------------------

const catalog: PortableCatalog = { title: "T", description: "D", duration: "5 min", contentNotice: "", featured: false };

describe("S141.7 — includes ride the story-graph arm", () => {
  const includes: CampaignInclude[] = [{ alias: "haggle", ref: { id: "haggle", version: "1.0.0" }, binding: squareBinding() }];

  it("toPortable writes a story-graph campaign's includes and fromPortable reads them back deep-equal", () => {
    const portable = toPortable(square("1.0.0", includes), catalog);
    expect(portable.campaign.kindId === "story-graph" && portable.campaign.includes).toEqual(includes);
    const back = fromPortable(JSON.parse(JSON.stringify(portable)) as PortableCampaign).built.campaign;
    expect(back.includes).toEqual(includes);
  });

  it("toPortable throws for a simulation campaign with an include", () => {
    const simulation = unwrap(buildStableLifeCampaign());
    const withInclude: BuiltCampaign = { ...simulation, campaign: { ...simulation.campaign, includes } };
    expect(() => toPortable(withInclude, catalog)).toThrow(/includes are not supported for simulation/);
  });

  it("toPortable throws for a world-graph campaign with an include", () => {
    const world = unwrap(buildWorldGraphMvpCampaign());
    const withInclude: BuiltCampaign = { ...world, campaign: { ...world.campaign, includes } };
    expect(() => toPortable(withInclude, catalog)).toThrow(/includes are not supported for world-graph/);
  });

  it("a portable campaign without includes reads back with no includes member", () => {
    const portable = toPortable(square(), catalog);
    expect("includes" in portable.campaign).toBe(false);
    const back = fromPortable(JSON.parse(JSON.stringify(portable)) as PortableCampaign).built.campaign;
    expect("includes" in back).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// S141.8 — the manifest resolution covers attachments
// ---------------------------------------------------------------------------

describe("S141.8 — digestManifestResolution covers attachments", () => {
  const entries: PortableManifestEntry[] = [
    { file: "square.json", id: "square", version: "1.0.0", digest: "sha-256:aa" },
    { file: "haggle.json", id: "haggle", version: "1.0.0", digest: "sha-256:bb" },
  ];
  const first = haggleOnSquare("first", "bargain", "attach.haggle") as PortableCampaignAttachment;
  const second = haggleOnSquare("second", "again", "attach.again") as PortableCampaignAttachment;
  const portableFirst: PortableCampaignAttachment = { ...first, kindId: "story-graph" };
  const portableSecond: PortableCampaignAttachment = { ...second, kindId: "story-graph" };

  // The 0.14.0 recipe, restated: the ordered { id, version, digest } list.
  const PRE_SLICE = digestPortableCampaign(entries.map(({ id, version, digest }) => ({ id, version, digest })));

  it("absent and empty attachments both equal the pre-slice value", () => {
    expect(digestManifestResolution(entries)).toBe(PRE_SLICE);
    expect(digestManifestResolution(entries, undefined)).toBe(PRE_SLICE);
    expect(digestManifestResolution(entries, [])).toBe(PRE_SLICE);
  });

  it("one attachment changes it; reordering two changes it again", () => {
    const one = digestManifestResolution(entries, [portableFirst]);
    const ab = digestManifestResolution(entries, [portableFirst, portableSecond]);
    const ba = digestManifestResolution(entries, [portableSecond, portableFirst]);
    expect(one).not.toBe(PRE_SLICE);
    expect(new Set([PRE_SLICE, one, ab, ba]).size).toBe(4);
    expect(ab).toMatch(/^sha-256:[0-9a-f]{64}$/);
  });
});

// ---------------------------------------------------------------------------
// S141.9 — end to end through the portable format
// ---------------------------------------------------------------------------

describe("S141.9 — a published host, hidden module and attachment play end to end", () => {
  it("builds from portable JSON and plays through the attached choice into the module and back out", () => {
    // Author time: two campaign files and a manifest carrying the attachment.
    const files = {
      "square.json": toPortable(square("1.2.0"), catalog),
      "haggle.json": toPortable(haggle(), { ...catalog, hidden: true }),
    };
    const entries: PortableManifestEntry[] = Object.entries(files).map(([file, portable]) => ({
      file,
      id: portable.campaign.id,
      version: portable.campaign.version,
      digest: digestPortableCampaign(portable),
    }));
    const attachments: PortableCampaignAttachment[] = [
      { kindId: "story-graph", ...(haggleOnSquare() as Omit<PortableCampaignAttachment, "kindId">) },
    ];
    const manifest: PortableManifest = {
      formatVersion: 2,
      campaigns: entries,
      attachments,
      resolution: digestManifestResolution(entries, attachments),
    };

    // Host side: everything crosses JSON.
    const wire = JSON.parse(JSON.stringify({ manifest, files })) as {
      manifest: PortableManifest;
      files: Record<string, PortableCampaign>;
    };
    for (const entry of wire.manifest.campaigns) expect(digestPortableCampaign(wire.files[entry.file])).toBe(entry.digest);
    expect(digestManifestResolution(wire.manifest.campaigns, wire.manifest.attachments)).toBe(wire.manifest.resolution);
    const loaded = wire.manifest.campaigns.map((entry) => fromPortable(wire.files[entry.file]!));
    expect(loaded[1]!.catalog.hidden).toBe(true);

    const registry = ok(buildValidatedContentRegistry(loaded.map((l) => l.built), kinds, wire.manifest.attachments));
    expect(registry.campaigns.get("square")!.version).toBe(`1.2.0+att.${h12(wire.manifest.attachments!)}`);

    const engine = createEngine({ kinds, registry, ids: createCountingIds() });
    let state: GameState = engine.createGame({ campaignId: "square", seed: "s141" }).value!;
    const node = () => (state.kindState as StoryGraphKindState).currentNodeId;
    const step = (actionId: string) => {
      const result = engine.submitAction(state, actionId);
      if (!result.ok || !result.value) throw new Error(`expected ${actionId} — ${JSON.stringify(result.errors)}`);
      state = result.value;
    };

    expect(node()).toBe("plaza");
    step("bargain");
    expect(node()).toBe("haggle::start");
    step("accept");
    expect(node()).toBe("home");
    expect(state.status).toBe("ended");
    expect((state.kindState as StoryGraphKindState).unlockedAchievements).toContain("haggle::bargainer");
  });
});
