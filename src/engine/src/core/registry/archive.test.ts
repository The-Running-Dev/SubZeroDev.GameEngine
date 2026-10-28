import { describe, it, expect } from "vitest";
import { canonicalDigest, createContentArchive, epochDigest, type EpochForm, type StoredEpoch } from "./archive.js";
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
  canonicalDigest as rootCanonicalDigest,
  epochDigest as rootEpochDigest,
  type EpochForm as RootEpochForm,
  type EpochPublication as RootEpochPublication,
  type RestoreResult as RootRestoreResult,
  type StoredEpoch as RootStoredEpoch,
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
  const table = new Map(strings);
  return {
    campaigns: new Map(campaigns.map((c) => [c.id, c])),
    strings: table,
    provenance: new Map(campaigns.map((c) => [c.id, { strings: table, attachments: [] }])),
  };
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

  it("validates against the campaign's authored strings united with the running catalog", () => {
    const seen: ReadonlyMap<string, string>[] = [];
    const watching = { "story-graph": { ...testKind, validateCampaign: (c: Campaign, s: ReadonlyMap<string, string>) => (seen.push(s), testKind.validateCampaign(c, s)) } } as unknown as KindRegistry;
    const archive = createContentArchive({ kinds: watching, initial: registry([campaign("1")]) });
    const next = registry([campaign("2")], [["test.title", "Test 2"]]);

    archive.publish(next);

    expect(Object.fromEntries(seen.at(-1)!)).toEqual({ ...Object.fromEntries(CORE_REASON_MESSAGES), "test.title": "Test 2" });
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

  it("is per campaign: a publication that does not hold a campaign leaves its answer where it was", () => {
    const archive = createContentArchive({ kinds, initial: registry([campaign("1")]) });
    archive.publish(registry([campaign("1", { steps: [1] }, "other")]));

    expect(archive.latest().campaigns.has("test-campaign")).toBe(false);
    expect(archive.current(scope)).toBe("1");
    expect(archive.current({ ...scope, campaignId: "other" })).toBe("1");
    expect(archive.current({ ...scope, campaignId: "never-published" })).toBeUndefined();
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

  it("the epoch identity helpers and types are exported from the package root (C28)", () => {
    const stored: RootStoredEpoch = rootCreateContentArchive({ kinds, initial: registry([campaign("1")]) }).stored("test-campaign", "1")!;
    const form: RootEpochForm = stored.form;
    const publication: RootEpochPublication = stored.publication;
    const result: RootRestoreResult = createContentArchive({ kinds, initial: registry([campaign("1")]) }).restore(stored);
    expect(rootEpochDigest).toBe(epochDigest);
    expect(rootCanonicalDigest).toBe(canonicalDigest);
    expect(rootEpochDigest(form)).toBe(stored.digest);
    expect(publication.kindId).toBe("story-graph");
    expect(result.outcome).toBe("restored");
  });
});

// A kind registry whose running catalog reserves one kind key, as a newer engine would.
function kindsReserving(keys: string[], version = "1.0.0"): KindRegistry {
  return { "story-graph": { ...testKind, version, reasonMessages: new Map(keys.map((key) => [key, "Engine text"])) } } as unknown as KindRegistry;
}

/** A stored epoch with its form changed and its digest recomputed, so integrity holds. */
function resealed(stored: StoredEpoch, change: (form: EpochForm) => EpochForm, publication = stored.publication): StoredEpoch {
  const form = change(structuredClone(stored.form) as EpochForm);
  return { form, publication, digest: epochDigest(form) };
}

describe("C28 — publish refuses what it cannot name", () => {
  it("refuses a registry without provenance, per campaign, storing nothing", () => {
    const archive = createContentArchive({ kinds, initial: registry([campaign("1")]) });
    const before = archive.latest();
    const full = registry([campaign("2"), campaign("1", { steps: [1] }, "other")]);
    const bare: ContentRegistry = { campaigns: full.campaigns, strings: full.strings };

    const result = archive.publish(bare);

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual([
      { code: "content_provenance_missing", messageKey: "core.reason.content_provenance_missing", path: "test-campaign" },
      { code: "content_provenance_missing", messageKey: "core.reason.content_provenance_missing", path: "other" },
    ]);
    expect(archive.resolve("test-campaign", "2")).toBeUndefined();
    expect(archive.latest()).toBe(before);
  });

  it("refuses a campaign missing from a provenance that names others", () => {
    const archive = createContentArchive({ kinds, initial: registry([campaign("1")]) });
    const next = registry([campaign("2"), campaign("1", { steps: [1] }, "other")]);
    const partial = { ...next, provenance: new Map([...next.provenance!].filter(([id]) => id === "test-campaign")) };

    expect(archive.publish(partial).errors.map((e) => e.path)).toEqual(["other"]);
  });

  it("refuses an authored key under core.reason., in the core catalog, or in a kind's catalog", () => {
    const archive = createContentArchive({ kinds: kindsReserving(["story-graph.reason.custom"]), initial: registry([campaign("1")]) });

    for (const key of ["core.reason.anything_at_all", "core.reason.unknown_action", "story-graph.reason.custom"]) {
      const result = archive.publish(registry([campaign("2")], [["test.title", "Test"], [key, "Authored"]]));
      expect(result.errors).toEqual([
        {
          code: "protected_string_key",
          messageKey: "core.reason.protected_string_key",
          path: key,
          details: { campaignId: "test-campaign", reason: "engine_reserved" },
        },
      ]);
    }
    expect(archive.resolve("test-campaign", "2")).toBeUndefined();
  });

  it("refuses an authored key containing ~, the response-alias namespace", () => {
    const archive = createContentArchive({ kinds, initial: registry([campaign("1")]) });

    const result = archive.publish(registry([campaign("2")], [["test.title", "Test"], ["~test.title", "x"], ["a~b", "y"]]));

    expect(result.errors.map((e) => [e.path, e.details?.reason])).toEqual([
      ["~test.title", "response_alias_namespace"],
      ["a~b", "response_alias_namespace"],
    ]);
  });

  it("refuses before validating, so an invalid campaign with a reserved key reports only the key", () => {
    const archive = createContentArchive({ kinds, initial: registry([campaign("1")]) });
    const result = archive.publish(registry([campaign("2", { steps: [1], invalid: true })], [["core.reason.x", "x"]]));
    expect(result.errors.map((e) => e.code)).toEqual(["protected_string_key"]);
  });

  it("a key in the merged table but not in provenance is not authored, and the running catalog's text wins", () => {
    const archive = createContentArchive({ kinds, initial: registry([campaign("1")]) });
    const next = registry([campaign("2")]);
    const merged: ContentRegistry = { ...next, strings: new Map([...next.strings, ["core.reason.unknown_action", "stale copy"]]) };

    expect(archive.publish(merged).ok).toBe(true);
    expect(archive.resolve("test-campaign", "2")?.strings.get("core.reason.unknown_action")).toBe(
      CORE_REASON_MESSAGES.get("core.reason.unknown_action"),
    );
  });
});

describe("C28 — the stored form and its digest", () => {
  it("stores the authored form only, with a sorted publication record and its digest", () => {
    const archive = createContentArchive({
      kinds: kindsReserving(["story-graph.reason.custom"]),
      initial: registry([campaign("1")], [["test.title", "Test"], ["a.first", "A"]]),
    });

    const stored = archive.stored("test-campaign", "1")!;

    expect(stored.form).toEqual({
      campaign: { id: "test-campaign", kindId: "story-graph", version: "1", titleKey: "test.title", content: { steps: [1] } },
      attachments: [],
      strings: { "a.first": "A", "test.title": "Test" },
    });
    expect(Object.keys(stored.form.strings)).toEqual(["a.first", "test.title"]);
    expect(stored.publication.kindId).toBe("story-graph");
    expect(stored.publication.kindVersion).toBe("1.0.0");
    expect(stored.publication.reservedKeys).toEqual([...CORE_REASON_MESSAGES.keys(), "story-graph.reason.custom"].sort());
    expect(stored.digest).toBe(epochDigest(stored.form));
    expect(Object.isFrozen(stored.form.campaign)).toBe(true);
    expect(archive.stored("test-campaign", "2")).toBeUndefined();
  });

  it("the digest does not depend on string order or on the running catalog", () => {
    const one = createContentArchive({ kinds, initial: registry([campaign("1")], [["a", "1"], ["b", "2"]]) });
    const two = createContentArchive({
      kinds: kindsReserving(["story-graph.reason.custom"]),
      initial: registry([campaign("1")], [["b", "2"], ["a", "1"]]),
    });
    expect(one.stored("test-campaign", "1")!.digest).toBe(two.stored("test-campaign", "1")!.digest);
  });

  it("the digest changes with any authored string, the content, or an attachment", () => {
    const base = createContentArchive({ kinds, initial: registry([campaign("1")]) }).stored("test-campaign", "1")!;
    const variants = [
      resealed(base, (f) => ({ ...f, strings: { ...f.strings, "test.title": "Other" } })),
      resealed(base, (f) => ({ ...f, campaign: { ...f.campaign, content: { steps: [2] } } })),
      resealed(base, (f) => ({ ...f, attachments: [{ id: "a", version: "1" } as unknown as EpochForm["attachments"][number]] })),
    ];
    for (const variant of variants) expect(variant.digest).not.toBe(base.digest);
  });

  it("an empty includes is not hashed, so it names the same epoch as none", () => {
    const one = createContentArchive({ kinds, initial: registry([campaign("1")]) });
    const two = createContentArchive({ kinds, initial: registry([{ ...campaign("1"), includes: [] }]) });
    expect(two.stored("test-campaign", "1")!.digest).toBe(one.stored("test-campaign", "1")!.digest);
  });

  it("canonicalDigest is the sha-256 of the canonical form, independent of key order", () => {
    expect(canonicalDigest({ b: 1, a: [2, { d: 3, c: 4 }] })).toBe(canonicalDigest({ a: [2, { c: 4, d: 3 }], b: 1 }));
    expect(canonicalDigest({ a: 1 })).toMatch(/^[0-9a-f]{64}$/);
    expect(canonicalDigest({ a: 1 })).not.toBe(canonicalDigest({ a: 2 }));
  });
});

describe("C28 — restore", () => {
  const scope = { campaignId: "test-campaign", sessionId: "s1" };

  function publishedElsewhere(version = "2", strings: [string, string][] = [["test.title", "Test"]]): StoredEpoch {
    const source = createContentArchive({ kinds, initial: registry([campaign("1")]) });
    expect(source.publish(registry([campaign(version, { steps: [7] })], strings)).ok).toBe(true);
    return source.stored("test-campaign", version)!;
  }

  it("brings back an epoch from what was persisted, without moving latest or current", () => {
    const archive = createContentArchive({ kinds, initial: registry([campaign("1")]) });
    const before = archive.latest();
    const persisted = JSON.parse(JSON.stringify(publishedElsewhere("2", [["test.title", "Test"], ["test.only", "Only"]]))) as StoredEpoch;

    const result = archive.restore(persisted);

    expect(result).toEqual({ outcome: "restored", ref: { campaignId: "test-campaign", campaignVersion: "2" }, warnings: [] });
    const served = archive.resolve("test-campaign", "2")!;
    expect(served.campaigns.get("test-campaign")?.content).toEqual({ steps: [7] });
    expect(served.strings.get("test.only")).toBe("Only");
    expect(served.strings.get("core.reason.unknown_action")).toBe(CORE_REASON_MESSAGES.get("core.reason.unknown_action"));
    expect(served.resolution).toBeUndefined();
    expect(archive.latest()).toBe(before);
    expect(archive.current(scope)).toBe("1");
    expect(archive.authoredKeys().has("test.only")).toBe(true);
    expect(archive.stored("test-campaign", "2")).toEqual(persisted);
  });

  it("reattaches migrateState, which the form never carries", () => {
    const archive = createContentArchive({ kinds, initial: registry([campaign("1")]) });
    const migrateState = (s: unknown) => ({ ok: true, value: s, errors: [], warnings: [] });

    archive.restore(publishedElsewhere(), { migrateState });

    expect(archive.resolve("test-campaign", "2")?.campaigns.get("test-campaign")?.migrateState).toBe(migrateState);
  });

  it("restoring an epoch the archive already holds is a no-op success", () => {
    const archive = createContentArchive({ kinds, initial: registry([campaign("1")]) });
    const held = archive.resolve("test-campaign", "1");

    expect(archive.restore(archive.stored("test-campaign", "1")!).outcome).toBe("restored");
    expect(archive.resolve("test-campaign", "1")).toBe(held);
  });

  it("a digest that does not match the form is an integrity failure, holding nothing", () => {
    const archive = createContentArchive({ kinds, initial: registry([campaign("1")]) });
    const stored = publishedElsewhere();
    const tampered: StoredEpoch = { ...stored, form: { ...stored.form, strings: { ...stored.form.strings, "test.title": "Tampered" } } };

    expect(archive.restore(tampered)).toEqual({
      outcome: "integrity_failure",
      ref: { campaignId: "test-campaign", campaignVersion: "2" },
      errors: [
        {
          code: "invalid_state",
          messageKey: "core.reason.invalid_state",
          path: "test-campaign",
          details: { campaignVersion: "2", reason: "digest_mismatch" },
        },
      ],
    });
    expect(archive.resolve("test-campaign", "2")).toBeUndefined();
  });

  it("an authored key the publishing engine reserved is an integrity failure: that engine could not have accepted it", () => {
    const archive = createContentArchive({ kinds, initial: registry([campaign("1")]) });
    const stored = publishedElsewhere();
    const reservedThen = resealed(stored, (f) => ({ ...f, strings: { ...f.strings, "story-graph.reason.old": "x" } }), {
      ...stored.publication,
      reservedKeys: [...stored.publication.reservedKeys, "story-graph.reason.old"].sort(),
    });
    const underPrefix = resealed(stored, (f) => ({ ...f, strings: { ...f.strings, "core.reason.never_a_code": "x" } }));

    expect(archive.restore(reservedThen)).toMatchObject({
      outcome: "integrity_failure",
      errors: [{ code: "protected_string_key", path: "story-graph.reason.old", details: { campaignId: "test-campaign", reason: "engine_reserved" } }],
    });
    expect(archive.restore(underPrefix)).toMatchObject({ outcome: "integrity_failure", errors: [{ path: "core.reason.never_a_code" }] });
    expect(archive.resolve("test-campaign", "2")).toBeUndefined();
  });

  it("a held key with a different form is an integrity failure", () => {
    const archive = createContentArchive({ kinds, initial: registry([campaign("1")]) });
    const other = resealed(archive.stored("test-campaign", "1")!, (f) => ({ ...f, campaign: { ...f.campaign, content: { steps: [5] } } }));

    expect(archive.restore(other)).toMatchObject({
      outcome: "integrity_failure",
      errors: [{ code: "content_version_conflict", path: "test-campaign", details: { campaignVersion: "1" } }],
    });
    expect(archive.resolve("test-campaign", "1")?.campaigns.get("test-campaign")?.content).toEqual({ steps: [1] });
  });

  it("content the running kind rejects is unsupported, a potential regression when the same kind version published it", () => {
    const archive = createContentArchive({ kinds, initial: registry([campaign("1")]) });
    const invalid = resealed(publishedElsewhere(), (f) => ({ ...f, campaign: { ...f.campaign, content: { steps: [1], invalid: true } } }));

    expect(archive.restore(invalid)).toEqual({
      outcome: "unsupported",
      ref: { campaignId: "test-campaign", campaignVersion: "2" },
      rejectedBy: { kindId: "story-graph", kindVersion: "1.0.0" },
      publishedBy: { kindId: "story-graph", kindVersion: "1.0.0" },
      errors: [{ code: "missing_string_key", messageKey: "core.reason.missing_string_key", path: "test-campaign" }],
      warning: {
        code: "epoch_unsupported",
        messageKey: "core.reason.epoch_unsupported",
        path: "test-campaign",
        details: { campaignId: "test-campaign", campaignVersion: "2", potentialRegression: true },
      },
    });
    expect(archive.resolve("test-campaign", "2")).toBeUndefined();
  });

  it("is not a potential regression when a different kind version published it", () => {
    const archive = createContentArchive({ kinds: kindsReserving([], "2.0.0"), initial: registry([campaign("1")]) });
    const invalid = resealed(publishedElsewhere(), (f) => ({ ...f, campaign: { ...f.campaign, content: { steps: [1], invalid: true } } }));

    const result = archive.restore(invalid);

    expect(result).toMatchObject({ outcome: "unsupported", rejectedBy: { kindVersion: "2.0.0" }, publishedBy: { kindVersion: "1.0.0" } });
    expect(result.outcome === "unsupported" && result.warning.details?.potentialRegression).toBe(false);
  });

  it("a kind this process does not register is unsupported, with an empty rejecting version", () => {
    const archive = createContentArchive({ kinds, initial: registry([campaign("1")]) });
    const stored = publishedElsewhere();
    const worldGraph = "world-graph" as Campaign["kindId"];
    const orphan = resealed(stored, (f) => ({ ...f, campaign: { ...f.campaign, kindId: worldGraph } }), { ...stored.publication, kindId: worldGraph });

    expect(archive.restore(orphan)).toMatchObject({
      outcome: "unsupported",
      rejectedBy: { kindId: "world-graph", kindVersion: "" },
      errors: [{ code: "unknown_kind", path: "world-graph" }],
      warning: { details: { potentialRegression: false } },
    });
  });

  it("an authored key the running engine reserves but the publishing one did not restores with a sorted collision warning, authored text winning", () => {
    const stored = publishedElsewhere("2", [["test.title", "Test"], ["story-graph.reason.new", "Authored text"], ["story-graph.reason.later", "Also"]]);
    const archive = createContentArchive({ kinds: kindsReserving(["story-graph.reason.new"]), initial: registry([campaign("1")]) });
    const newer = createContentArchive({ kinds: kindsReserving(["story-graph.reason.new", "story-graph.reason.later"]), initial: registry([campaign("1")]) });

    expect(archive.restore(stored)).toEqual({
      outcome: "restored",
      ref: { campaignId: "test-campaign", campaignVersion: "2" },
      warnings: [
        {
          code: "historical_string_collision",
          messageKey: "core.reason.historical_string_collision",
          path: "story-graph.reason.new",
          details: { campaignId: "test-campaign", campaignVersion: "2", key: "story-graph.reason.new" },
        },
      ],
    });
    expect(archive.resolve("test-campaign", "2")?.strings.get("story-graph.reason.new")).toBe("Authored text");
    expect(newer.restore(stored)).toMatchObject({ warnings: [{ path: "story-graph.reason.later" }, { path: "story-graph.reason.new" }] });
  });
});
