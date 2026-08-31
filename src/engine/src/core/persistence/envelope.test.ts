import { describe, it, expect } from "vitest";
import {
  buildSaveEnvelope,
  computeChecksum,
  resolveSaveEnvelope,
  serializeSaveEnvelope,
  CURRENT_SAVE_FORMAT_VERSION,
  CURRENT_SERIALIZATION_VERSION,
} from "./envelope.js";
import { canonicalStringify } from "./canonical.js";
import { ENGINE_VERSION } from "../../version.js";
import type {
  AdvanceResult,
  AvailableAction,
  GameState,
  InitialStateResult,
  Kind,
  KindRegistry,
  SceneBody,
} from "../kernel/types.js";
import type { Campaign, ContentRegistry } from "../registry/types.js";
import type { CommandResult } from "../kernel/reasons.js";
import type { ValidationResult } from "../validation/types.js";

/**
 * The synthetic kind/campaign fixture `plans/38-save-migration-programme.md` (Decision 4)
 * calls for: two declared kind versions and two declared campaign versions, proven against
 * `resolveSaveEnvelope` directly rather than a real Bulgaria campaign. This is also the only
 * level a version mismatch is reachable at all — `SessionStore`'s own `kinds`/`registry` are
 * fixed for a store's whole lifetime (06-extensibility.md's "supplied once" port rule), so a
 * live process's own `saveGame` never stamps an envelope its own `loadGame` would see as
 * stale. `resolveSaveEnvelope` *is* the migration mechanism; testing it directly here is
 * testing the mechanism, not a stand-in for it.
 */
interface SyntheticKindStateV1 {
  counter: number;
  oldField: string;
  currentNodeId: string;
}
interface SyntheticKindStateV2 {
  counter: number;
  renamedField: string;
  currentNodeId: string;
}

function makeKind(version: string, migrateState?: Kind<unknown>["migrateState"]): Kind<unknown> {
  return {
    id: "story-graph",
    version,
    reasonCodes: [],
    reasonMessages: new Map(),
    eventNames: [],
    initialState: (): InitialStateResult<unknown> => ({ state: { counter: 0 }, status: "active", changes: [], messages: [] }),
    availableActions: (): AvailableAction[] => [],
    scene: (): SceneBody => ({ textKey: "test.scene", text: "" }),
    advance: (state): AdvanceResult<unknown> => ({ state, status: "active", changes: [], messages: [] }),
    project: (state) => state,
    validateCampaign: (): ValidationResult => ({ ok: true, errors: [], warnings: [] }),
    outcome: () => ({ terminal: false, terminalId: null }),
    ...(migrateState ? { migrateState } : {}),
  };
}

function makeCampaign(version: string, migrateState?: Campaign["migrateState"]): Campaign {
  return {
    id: "synthetic-campaign",
    kindId: "story-graph",
    version,
    titleKey: "synthetic.title",
    content: {},
    ...(migrateState ? { migrateState } : {}),
  };
}

function makeRegistry(campaign: Campaign): ContentRegistry {
  return { campaigns: new Map([[campaign.id, campaign]]), strings: new Map() };
}

function makeKinds(kind: Kind<unknown>): KindRegistry {
  return { "story-graph": kind } as unknown as KindRegistry;
}

const BASE_STATE: GameState = {
  formatVersion: 1,
  gameId: "synthetic-game",
  kindId: "story-graph",
  campaignId: "synthetic-campaign",
  campaignVersion: "1.0.0",
  seed: "synthetic-seed",
  status: "active",
  kindState: { counter: 3, oldField: "legacy-value", currentNodeId: "old_node_id" } satisfies SyntheticKindStateV1,
  actionLog: [],
};

/** Renames `oldField` → `renamedField`, same shape otherwise. */
function kindMigrateV1toV2(oldState: unknown): CommandResult<unknown> {
  const s = oldState as SyntheticKindStateV1;
  const migrated: SyntheticKindStateV2 = { counter: s.counter, renamedField: s.oldField, currentNodeId: s.currentNodeId };
  return { ok: true, value: migrated, errors: [], warnings: [] };
}

/** Remaps the renamed node id — only succeeds if kind migration already ran (proves
 *  ordering): a still-present `oldField` means campaign migration ran first, which is wrong. */
function campaignMigrateV1toV2(kindState: unknown): CommandResult<unknown> {
  if (kindState !== null && typeof kindState === "object" && "oldField" in kindState) {
    return { ok: false, errors: [{ code: "invalid_state", messageKey: "core.reason.invalid_state" }], warnings: [] };
  }
  const s = kindState as SyntheticKindStateV2;
  const migrated: SyntheticKindStateV2 = { counter: s.counter, renamedField: s.renamedField, currentNodeId: "new_node_id" };
  return { ok: true, value: migrated, errors: [], warnings: [] };
}

function v1Blob(replayCompatible = true): string {
  const kindV1 = makeKind("1.0.0");
  const campaignV1 = makeCampaign("1.0.0");
  const envelope = buildSaveEnvelope({ state: BASE_STATE, kind: kindV1, campaign: campaignV1, replayCompatible });
  return serializeSaveEnvelope(envelope);
}

describe("buildSaveEnvelope / resolveSaveEnvelope — no mismatch", () => {
  it("round-trips when every stamped field still matches the current registry", () => {
    const kind = makeKind("1.0.0");
    const registry = makeRegistry(makeCampaign("1.0.0"));
    const resolution = resolveSaveEnvelope(v1Blob(), makeKinds(kind), registry);
    expect(resolution).toEqual({ ok: true, state: BASE_STATE, replayCompatible: true });
  });

  it("stamps engineVersion and the current save-format/serialization constants", () => {
    const envelope = buildSaveEnvelope({ state: BASE_STATE, kind: makeKind("1.0.0"), campaign: makeCampaign("1.0.0"), replayCompatible: true });
    expect(envelope.engineVersion).toBe(ENGINE_VERSION);
    expect(envelope.saveFormatVersion).toBe(CURRENT_SAVE_FORMAT_VERSION);
    expect(envelope.serializationVersion).toBe(CURRENT_SERIALIZATION_VERSION);
    expect(envelope.checksum).toBe(computeChecksum(canonicalStringify({ state: BASE_STATE, replayCompatible: true })));
  });

  it("a tampered state fails checksum verification as invalid_state", () => {
    const parsed = JSON.parse(v1Blob()) as { state: GameState };
    (parsed.state.kindState as SyntheticKindStateV1).counter = 999;
    const tampered = JSON.stringify(parsed);
    const resolution = resolveSaveEnvelope(tampered, makeKinds(makeKind("1.0.0")), makeRegistry(makeCampaign("1.0.0")));
    expect(resolution).toEqual({ ok: false, code: "invalid_state" });
  });

  it("an unparseable blob fails as invalid_state", () => {
    const resolution = resolveSaveEnvelope("not json", makeKinds(makeKind("1.0.0")), makeRegistry(makeCampaign("1.0.0")));
    expect(resolution).toEqual({ ok: false, code: "invalid_state" });
  });
});

describe("resolveSaveEnvelope — saveFormatVersion / serializationVersion / engineVersion", () => {
  it("a saveFormatVersion mismatch fails as save_requires_migration — neither axis has ever moved", () => {
    const parsed = JSON.parse(v1Blob()) as Record<string, unknown>;
    parsed["saveFormatVersion"] = CURRENT_SAVE_FORMAT_VERSION + 1;
    const resolution = resolveSaveEnvelope(JSON.stringify(parsed), makeKinds(makeKind("1.0.0")), makeRegistry(makeCampaign("1.0.0")));
    expect(resolution).toEqual({ ok: false, code: "save_requires_migration" });
  });

  it("a serializationVersion mismatch fails as save_requires_migration", () => {
    const parsed = JSON.parse(v1Blob()) as Record<string, unknown>;
    parsed["serializationVersion"] = CURRENT_SERIALIZATION_VERSION + 1;
    const resolution = resolveSaveEnvelope(JSON.stringify(parsed), makeKinds(makeKind("1.0.0")), makeRegistry(makeCampaign("1.0.0")));
    expect(resolution).toEqual({ ok: false, code: "save_requires_migration" });
  });

  it("an engineVersion mismatch never gates a load — informational only", () => {
    const parsed = JSON.parse(v1Blob()) as Record<string, unknown>;
    parsed["engineVersion"] = "0.0.1-some-other-build";
    const resolution = resolveSaveEnvelope(JSON.stringify(parsed), makeKinds(makeKind("1.0.0")), makeRegistry(makeCampaign("1.0.0")));
    expect(resolution.ok).toBe(true);
  });
});

describe("resolveSaveEnvelope — unknown campaign/kind", () => {
  it("a campaignId absent from the registry fails as unknown_campaign", () => {
    const emptyRegistry: ContentRegistry = { campaigns: new Map(), strings: new Map() };
    const resolution = resolveSaveEnvelope(v1Blob(), makeKinds(makeKind("1.0.0")), emptyRegistry);
    expect(resolution).toEqual({ ok: false, code: "unknown_campaign" });
  });

  it("a kindId absent from the registry fails as unknown_kind", () => {
    const emptyKinds = {} as KindRegistry;
    const resolution = resolveSaveEnvelope(v1Blob(), emptyKinds, makeRegistry(makeCampaign("1.0.0")));
    expect(resolution).toEqual({ ok: false, code: "unknown_kind" });
  });
});

describe("resolveSaveEnvelope — kindVersion migration", () => {
  it("a kindVersion mismatch with no migrateState registered fails as save_requires_migration", () => {
    const kindV2NoMigration = makeKind("2.0.0");
    const resolution = resolveSaveEnvelope(v1Blob(), makeKinds(kindV2NoMigration), makeRegistry(makeCampaign("1.0.0")));
    expect(resolution).toEqual({ ok: false, code: "save_requires_migration" });
  });

  it("a kindVersion mismatch with a registered migrateState succeeds, migrates kindState, and flips replayCompatible false", () => {
    const kindV2 = makeKind("2.0.0", kindMigrateV1toV2);
    const resolution = resolveSaveEnvelope(v1Blob(), makeKinds(kindV2), makeRegistry(makeCampaign("1.0.0")));
    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error("expected success");
    expect(resolution.state.kindState).toEqual({ counter: 3, renamedField: "legacy-value", currentNodeId: "old_node_id" });
    expect(resolution.replayCompatible).toBe(false);
  });

  it("a kindVersion migration that itself fails yields migration_failed", () => {
    const failingMigration = (): CommandResult<unknown> => ({ ok: false, errors: [{ code: "invalid_state", messageKey: "core.reason.invalid_state" }], warnings: [] });
    const kindV2Failing = makeKind("2.0.0", failingMigration);
    const resolution = resolveSaveEnvelope(v1Blob(), makeKinds(kindV2Failing), makeRegistry(makeCampaign("1.0.0")));
    expect(resolution).toEqual({ ok: false, code: "migration_failed" });
  });

  it("a kind migration that throws is caught and yields migration_failed, not an uncaught exception", () => {
    const throwingMigration = (): CommandResult<unknown> => {
      throw new Error("buggy content-migration code");
    };
    const kindV2Throwing = makeKind("2.0.0", throwingMigration);
    expect(() => resolveSaveEnvelope(v1Blob(), makeKinds(kindV2Throwing), makeRegistry(makeCampaign("1.0.0")))).not.toThrow();
    const resolution = resolveSaveEnvelope(v1Blob(), makeKinds(kindV2Throwing), makeRegistry(makeCampaign("1.0.0")));
    expect(resolution).toEqual({ ok: false, code: "migration_failed" });
  });

  it("a migration that legitimately returns a falsy kindState (0) is accepted, not misread as failure", () => {
    const falsyMigration = (): CommandResult<unknown> => ({ ok: true, value: 0, errors: [], warnings: [] });
    const kindV2Falsy = makeKind("2.0.0", falsyMigration);
    const resolution = resolveSaveEnvelope(v1Blob(), makeKinds(kindV2Falsy), makeRegistry(makeCampaign("1.0.0")));
    expect(resolution).toEqual({ ok: true, state: { ...BASE_STATE, kindState: 0 }, replayCompatible: false });
  });
});

describe("resolveSaveEnvelope — outer/inner consistency", () => {
  it("rejects as invalid_state when the resolved campaign's own kindId disagrees with the envelope's kindId", () => {
    const parsed = JSON.parse(v1Blob()) as Record<string, unknown>;
    parsed["kindId"] = "simulation"; // GameState.kindId is a closed 3-value union; pick a real-but-wrong one
    const mismatchedKindEnvelope = JSON.stringify(parsed);
    const kinds = { "story-graph": makeKind("1.0.0"), simulation: makeKind("1.0.0") } as unknown as KindRegistry;
    const resolution = resolveSaveEnvelope(mismatchedKindEnvelope, kinds, makeRegistry(makeCampaign("1.0.0")));
    expect(resolution).toEqual({ ok: false, code: "invalid_state" });
  });

  it("rejects as invalid_state when the outer campaignId disagrees with the embedded state's campaignId", () => {
    const otherCampaign = makeCampaign("1.0.0");
    otherCampaign.id = "some-other-campaign";
    const parsed = JSON.parse(v1Blob()) as Record<string, unknown>;
    parsed["campaignId"] = "some-other-campaign";
    const registry: ContentRegistry = { campaigns: new Map([["some-other-campaign", otherCampaign]]), strings: new Map() };
    const resolution = resolveSaveEnvelope(JSON.stringify(parsed), makeKinds(makeKind("1.0.0")), registry);
    expect(resolution).toEqual({ ok: false, code: "invalid_state" });
  });
});

describe("resolveSaveEnvelope — campaignVersion migration", () => {
  function v1BlobUnderV1Kind(replayCompatible = true): string {
    // kindVersion matches (both "1.0.0") so only the campaign axis moves.
    return v1Blob(replayCompatible);
  }

  it("a campaignVersion mismatch with no migrateState registered fails as save_requires_migration", () => {
    const campaignV2NoMigration = makeCampaign("2.0.0");
    const resolution = resolveSaveEnvelope(v1BlobUnderV1Kind(), makeKinds(makeKind("1.0.0")), makeRegistry(campaignV2NoMigration));
    expect(resolution).toEqual({ ok: false, code: "save_requires_migration" });
  });

  it("a campaignVersion mismatch with a registered migrateState succeeds and remaps content ids", () => {
    // kindVersion matches here (no kind migration runs), so kindState still legitimately
    // has `oldField` — a plain node-id remap is used instead of `campaignMigrateV1toV2`,
    // whose ordering guard (below) specifically rejects a still-present `oldField`.
    const campaignV2 = makeCampaign("2.0.0", (kindState) => ({ ok: true, value: { ...(kindState as SyntheticKindStateV1), currentNodeId: "new_node_id" }, errors: [], warnings: [] }));
    const resolution = resolveSaveEnvelope(v1BlobUnderV1Kind(), makeKinds(makeKind("1.0.0")), makeRegistry(campaignV2));
    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error("expected success");
    expect((resolution.state.kindState as SyntheticKindStateV1).currentNodeId).toBe("new_node_id");
    expect(resolution.replayCompatible).toBe(false);
  });

  it("a campaign migration that itself fails yields migration_failed", () => {
    const failingMigration = (): CommandResult<unknown> => ({ ok: false, errors: [{ code: "invalid_state", messageKey: "core.reason.invalid_state" }], warnings: [] });
    const campaignV2Failing = makeCampaign("2.0.0", failingMigration);
    const resolution = resolveSaveEnvelope(v1BlobUnderV1Kind(), makeKinds(makeKind("1.0.0")), makeRegistry(campaignV2Failing));
    expect(resolution).toEqual({ ok: false, code: "migration_failed" });
  });
});

describe("resolveSaveEnvelope — both axes move at once: ordering", () => {
  it("runs Kind.migrateState before Campaign.migrateState", () => {
    const kindV2 = makeKind("2.0.0", kindMigrateV1toV2);
    const campaignV2 = makeCampaign("2.0.0", campaignMigrateV1toV2);
    const resolution = resolveSaveEnvelope(v1Blob(), makeKinds(kindV2), makeRegistry(campaignV2));
    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error("expected success — campaignMigrateV1toV2 fails if oldField is still present, proving order");
    expect(resolution.state.kindState).toEqual({ counter: 3, renamedField: "legacy-value", currentNodeId: "new_node_id" });
    expect(resolution.replayCompatible).toBe(false);
  });

  it("fails migration_failed if the campaign migration ran before the kind migration (regression guard)", () => {
    // Sanity-check campaignMigrateV1toV2's own ordering guard fires when it's handed
    // pre-migration kindState directly — proves the earlier test's success isn't vacuous.
    const result = campaignMigrateV1toV2(BASE_STATE.kindState);
    expect(result.ok).toBe(false);
  });
});

describe("resolveSaveEnvelope — replayCompatible is sticky", () => {
  it("stays false on a matching-version load if the envelope was already replayCompatible: false", () => {
    const resolution = resolveSaveEnvelope(v1Blob(false), makeKinds(makeKind("1.0.0")), makeRegistry(makeCampaign("1.0.0")));
    expect(resolution).toEqual({ ok: true, state: BASE_STATE, replayCompatible: false });
  });

  it("rejects as invalid_state if replayCompatible is flipped false → true in the stored blob — the checksum covers it too", () => {
    const parsed = JSON.parse(v1Blob(false)) as Record<string, unknown>;
    parsed["replayCompatible"] = true;
    const resolution = resolveSaveEnvelope(JSON.stringify(parsed), makeKinds(makeKind("1.0.0")), makeRegistry(makeCampaign("1.0.0")));
    expect(resolution).toEqual({ ok: false, code: "invalid_state" });
  });
});
