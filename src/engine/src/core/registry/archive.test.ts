import { describe, it, expect } from "vitest";
import { createContentArchive } from "./archive.js";
import { createEngine } from "../kernel/engine.js";
import type { AdvanceResult, InitialStateResult, Kind, KindRegistry, SceneBody } from "../kernel/types.js";
import { BASE_REASON_CODES, CORE_REASON_MESSAGES } from "../kernel/reasons.js";
import type { Campaign, ContentRegistry } from "./types.js";
import type { ValidationResult } from "../validation/types.js";
// S131.7: the archive and channel are reachable from the package root.
import {
  createContentArchive as rootCreateContentArchive,
  type ContentArchive as RootContentArchive,
  type ContentChannel as RootContentChannel,
  type ContentScope as RootContentScope,
  type EpochRef as RootEpochRef,
} from "../../index.js";

interface Counter {
  counter: number;
}

interface TestContent {
  steps: number[];
  invalid?: boolean;
}

// A kind whose validator refuses `content.invalid`, and whose scene reads the campaign the
// engine resolved for the state — so a game is visibly playing the content of its own epoch.
const testKind: Kind<Counter> = {
  id: "story-graph",
  version: "1.0.0",
  reasonCodes: [],
  reasonMessages: new Map(),
  eventNames: [],
  initialState: (): InitialStateResult<Counter> => ({ state: { counter: 0 }, status: "active", changes: [], messages: [] }),
  availableActions: () => [{ id: "increment", labelKey: "test.increment", available: true }],
  scene: (state, ctx): SceneBody => ({
    textKey: "test.scene",
    text: `counter=${state.counter} steps=${(ctx.campaign.content as TestContent).steps.join(",")}`,
  }),
  advance: (state, _actionId, _params, ctx): AdvanceResult<Counter> => ({
    state: { counter: state.counter + ((ctx.campaign.content as TestContent).steps[0] ?? 0) },
    status: "active",
    changes: [],
    messages: [],
  }),
  project: (state) => ({ counter: state.counter }),
  validateState: () => true,
  outcome: () => ({ terminal: false, terminalId: null }),
  validateCampaign: (campaign): ValidationResult => {
    const invalid = (campaign.content as TestContent).invalid === true;
    return {
      ok: !invalid,
      errors: invalid ? [{ code: "missing_string_key", messageKey: "core.reason.missing_string_key", path: campaign.id }] : [],
      warnings: [],
    };
  },
};

const kinds = { "story-graph": testKind } as unknown as KindRegistry;

function campaign(version: string, content: TestContent = { steps: [1] }, id = "test-campaign"): Campaign {
  return { id, kindId: "story-graph", version, titleKey: "test.title", content };
}

function registry(campaigns: Campaign[], strings: [string, string][] = [["test.title", "Test"]]): ContentRegistry {
  return { campaigns: new Map(campaigns.map((c) => [c.id, c])), strings: new Map(strings) };
}

describe("S131.1 — createContentArchive", () => {
  it("resolves every campaign of `initial` at its version", () => {
    const initial = registry([campaign("1"), campaign("7", { steps: [2] }, "other")]);
    const archive = createContentArchive({ kinds, initial });

    expect(archive.resolve("test-campaign", "1")?.campaigns.get("test-campaign")?.version).toBe("1");
    expect(archive.resolve("other", "7")?.campaigns.get("other")?.content).toEqual({ steps: [2] });
    expect(archive.resolve("test-campaign", "2")).toBeUndefined();
    expect(archive.resolve("missing", "1")).toBeUndefined();
  });

  it("throws when `initial` fails validation", () => {
    expect(() => createContentArchive({ kinds, initial: registry([campaign("1", { steps: [1], invalid: true })]) })).toThrow(
      /initial registry fails validation: missing_string_key \(test-campaign\)/,
    );
  });

  it("throws when a campaign's kind is not registered", () => {
    const orphan = { ...campaign("1"), kindId: "world-graph" } as Campaign;
    expect(() => createContentArchive({ kinds, initial: registry([orphan]) })).toThrow(/unknown_kind \(world-graph\)/);
  });
});

describe("S131.2 — publish validates every campaign", () => {
  it("refuses with the validator's errors, stores nothing and leaves latest unchanged", () => {
    const archive = createContentArchive({ kinds, initial: registry([campaign("1")]) });
    const before = archive.latest();

    const result = archive.publish(registry([campaign("2", { steps: [1], invalid: true })]));

    expect(result.ok).toBe(false);
    expect(result.value).toBeUndefined();
    expect(result.errors).toEqual([{ code: "missing_string_key", messageKey: "core.reason.missing_string_key", path: "test-campaign" }]);
    expect(archive.resolve("test-campaign", "2")).toBeUndefined();
    expect(archive.latest()).toBe(before);
  });

  it("validates against the publication's own strings", () => {
    const seen: ReadonlyMap<string, string>[] = [];
    const watching = { "story-graph": { ...testKind, validateCampaign: (c: Campaign, s: ReadonlyMap<string, string>) => (seen.push(s), testKind.validateCampaign(c, s)) } } as unknown as KindRegistry;
    const archive = createContentArchive({ kinds: watching, initial: registry([campaign("1")]) });
    const next = registry([campaign("2")], [["test.title", "Test 2"]]);

    archive.publish(next);

    expect(seen.at(-1)).toBe(next.strings);
  });
});

describe("S131.3 — one key names one content", () => {
  it("refuses a held key whose content differs with content_version_conflict, storing nothing", () => {
    const archive = createContentArchive({ kinds, initial: registry([campaign("1")]) });
    const before = archive.latest();

    const result = archive.publish(registry([campaign("1", { steps: [5] }), campaign("1", { steps: [1] }, "fresh")]));

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual([
      {
        code: "content_version_conflict",
        messageKey: "core.reason.content_version_conflict",
        path: "test-campaign",
        details: { campaignVersion: "1" },
      },
    ]);
    expect(archive.resolve("test-campaign", "1")?.campaigns.get("test-campaign")?.content).toEqual({ steps: [1] });
    // The new key in the refused publication is not stored either.
    expect(archive.resolve("fresh", "1")).toBeUndefined();
    expect(archive.latest()).toBe(before);
  });

  it("a change to one string under an unchanged version is a conflict", () => {
    const archive = createContentArchive({ kinds, initial: registry([campaign("1")], [["test.title", "Test"], ["test.extra", "a"]]) });

    const result = archive.publish(registry([campaign("1")], [["test.title", "Test"], ["test.extra", "b"]]));

    expect(result.errors.map((e) => e.code)).toEqual(["content_version_conflict"]);
  });

  it("a string added under an unchanged version is a conflict too", () => {
    const archive = createContentArchive({ kinds, initial: registry([campaign("1")]) });
    const result = archive.publish(registry([campaign("1")], [["test.title", "Test"], ["test.new", "n"]]));
    expect(result.errors.map((e) => e.code)).toEqual(["content_version_conflict"]);
  });

  it("an identical republish succeeds and adds no epochs, whatever order its strings are in", () => {
    const archive = createContentArchive({ kinds, initial: registry([campaign("1")], [["a.one", "1"], ["b.two", "2"]]) });

    const result = archive.publish(registry([campaign("1")], [["b.two", "2"], ["a.one", "1"]]));

    expect(result).toEqual({ ok: true, value: [], errors: [], warnings: [] });
  });

  it("migrateState is not content: a republish that differs only in it is identical", () => {
    const archive = createContentArchive({ kinds, initial: registry([campaign("1")]) });
    const withMigration: Campaign = { ...campaign("1"), migrateState: (s) => ({ ok: true, value: s, errors: [], warnings: [] }) };
    expect(archive.publish(registry([withMigration]))).toMatchObject({ ok: true, value: [] });
  });

  it("a new key returns its EpochRef, and a held identical key in the same publication does not", () => {
    const archive = createContentArchive({ kinds, initial: registry([campaign("1"), campaign("1", { steps: [3] }, "other")]) });

    const result = archive.publish(registry([campaign("2", { steps: [9] }), campaign("1", { steps: [3] }, "other")]));

    expect(result).toEqual({ ok: true, value: [{ campaignId: "test-campaign", campaignVersion: "2" }], errors: [], warnings: [] });
    expect(archive.resolve("test-campaign", "1")?.campaigns.get("test-campaign")?.content).toEqual({ steps: [1] });
    expect(archive.resolve("test-campaign", "2")?.campaigns.get("test-campaign")?.content).toEqual({ steps: [9] });
  });
});

describe("S131.4 — what the archive serves is a deep-frozen copy", () => {
  it("mutating the registry after publish changes nothing resolve answers", () => {
    const archive = createContentArchive({ kinds, initial: registry([campaign("1")]) });
    const content: TestContent = { steps: [4] };
    const next = registry([campaign("2", content)]);
    archive.publish(next);

    content.steps.push(99);
    (next.campaigns as Map<string, Campaign>).set("test-campaign", campaign("2", { steps: [0] }));
    (next.campaigns as Map<string, Campaign>).set("late", campaign("2", { steps: [0] }, "late"));
    (next.strings as Map<string, string>).set("test.title", "Changed");

    const served = archive.resolve("test-campaign", "2")!;
    expect(served.campaigns.get("test-campaign")?.content).toEqual({ steps: [4] });
    expect(served.campaigns.has("late")).toBe(false);
    expect(served.strings.get("test.title")).toBe("Test");
  });

  it("refuses mutation of what it serves", () => {
    const archive = createContentArchive({ kinds, initial: registry([campaign("1")]) });
    const served = archive.resolve("test-campaign", "1")!;
    const held = served.campaigns.get("test-campaign")!;

    expect(() => (held.content as TestContent).steps.push(2)).toThrow(TypeError);
    expect(() => {
      (held as { version: string }).version = "9";
    }).toThrow(TypeError);
    expect(() => (served.campaigns as Map<string, Campaign>).set("x", held)).toThrow(TypeError);
    expect(() => (served.strings as Map<string, string>).delete("test.title")).toThrow(TypeError);
    expect(() => (served.strings as Map<string, string>).clear()).toThrow(TypeError);
    expect(archive.resolve("test-campaign", "1")?.campaigns.get("test-campaign")?.content).toEqual({ steps: [1] });
  });

  it("keeps migrateState by reference", () => {
    const migrateState = (s: unknown) => ({ ok: true, value: s, errors: [], warnings: [] });
    const archive = createContentArchive({ kinds, initial: registry([{ ...campaign("1"), migrateState }]) });

    expect(archive.resolve("test-campaign", "1")?.campaigns.get("test-campaign")?.migrateState).toBe(migrateState);
  });

  it("keeps the registry's resolution", () => {
    const archive = createContentArchive({ kinds, initial: { ...registry([campaign("1")]), resolution: "abc" } });
    expect(archive.resolve("test-campaign", "1")?.resolution).toBe("abc");
  });
});

describe("S131.5 — latest and the channel", () => {
  const scope = { campaignId: "test-campaign", sessionId: "s1" };

  it("latest is the last publication that succeeded, and current answers its version for every scope", () => {
    const archive = createContentArchive({ kinds, initial: registry([campaign("1")]) });
    expect(archive.current(scope)).toBe("1");

    archive.publish(registry([campaign("2")]));
    expect(archive.latest().campaigns.get("test-campaign")?.version).toBe("2");
    expect(archive.current(scope)).toBe("2");
    expect(archive.current({ ...scope, sessionId: "s2", profileId: "p1" })).toBe("2");

    // A refusal leaves the channel where it was.
    archive.publish(registry([campaign("3", { steps: [1], invalid: true })]));
    expect(archive.current(scope)).toBe("2");

    // An identical republish of an older epoch is still a success, so it becomes the latest.
    archive.publish(registry([campaign("1")]));
    expect(archive.current(scope)).toBe("1");
  });

  it("answers undefined for a campaign the latest publication does not hold", () => {
    const archive = createContentArchive({ kinds, initial: registry([campaign("1")]) });
    archive.publish(registry([campaign("1", { steps: [1] }, "other")]));

    expect(archive.current(scope)).toBeUndefined();
    // Still resolvable: the archive never evicts.
    expect(archive.resolve("test-campaign", "1")).toBeDefined();
  });
});

describe("S131.6 — an engine over a content archive keeps playing an older epoch (C22)", () => {
  const ids = { newGameId: () => "g", newSeed: () => "seed" };

  it("a game created on one epoch plays unchanged after a newer epoch is published", () => {
    const initial = registry([campaign("1", { steps: [1] })]);
    const archive = createContentArchive({ kinds, initial });
    const engine = createEngine({ kinds, registry: initial, archive, ids });
    const control = createEngine({ kinds, registry: initial, ids });

    const created = engine.createGame({ campaignId: "test-campaign" }).value!;
    const reference = control.createGame({ campaignId: "test-campaign" }).value!;

    expect(archive.publish(registry([campaign("2", { steps: [10] })])).ok).toBe(true);

    const played = engine.submitAction(created, "increment").value!;
    const expected = control.submitAction(reference, "increment").value!;
    expect(played.campaignVersion).toBe("1");
    expect(engine.serialize(played)).toBe(control.serialize(expected));
    expect(engine.scene(played).body.text).toBe("counter=1 steps=1");
    expect(engine.serialize(engine.deserialize(engine.serialize(played)).value!)).toBe(engine.serialize(played));

    // The newer epoch is playable alongside it.
    const newer = engine.createGame({ campaignId: "test-campaign" }, "2").value!;
    expect(engine.scene(engine.submitAction(newer, "increment").value!).body.text).toBe("counter=10 steps=10");
  });
});

describe("S131.7 — the base reason code and the package root", () => {
  it("content_version_conflict is a base reason code with a message", () => {
    expect(BASE_REASON_CODES).toContain("content_version_conflict");
    expect(CORE_REASON_MESSAGES.get("core.reason.content_version_conflict")).toMatch(/already published/);
  });

  it("the archive and its types are exported from the package root", () => {
    const archive: RootContentArchive = rootCreateContentArchive({ kinds, initial: registry([campaign("1")]) });
    const channel: RootContentChannel = archive;
    const scope: RootContentScope = { campaignId: "test-campaign", sessionId: "s" };
    const ref: RootEpochRef = { campaignId: "test-campaign", campaignVersion: "1" };
    expect(rootCreateContentArchive).toBe(createContentArchive);
    expect(channel.current(scope)).toBe(ref.campaignVersion);
  });
});
