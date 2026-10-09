import { describe, it, expect } from "vitest";
import { buildReplayOutcome, findDivergence, runReplayFixture, type ReplayRunnerContext } from "./runner.js";
import type { Outcome, ReplayFixture, Submission } from "./types.js";
import { createContentArchive } from "../registry/archive.js";
import { createEngine } from "../kernel/engine.js";
import { createInMemoryProfileStore } from "../session/profile-store.js";
import type {
  AdvanceResult,
  AvailableAction,
  InitialStateResult,
  Kind,
  KindRegistry,
  SceneBody,
} from "../kernel/types.js";
import type { Campaign, ContentRegistry } from "../registry/types.js";
import type { ValidationResult } from "../validation/types.js";
import type { EngineHost, IdSource } from "../composition/types.js";

// A fixed IdSource, the same reasoning `core/determinism/harness.test.ts` gives: the default
// is `crypto.randomUUID()` (composition/defaults.ts), and a reproducible replay needs a
// pinned `gameId` (06-extensibility.md §5.1, 07-replay.md §5).
const FIXED_IDS: IdSource = { newGameId: () => "fixed-game-id", newSeed: () => "fixed-seed" };
const PROFILE_ID = "test-profile";

interface TestKindState {
  counter: number;
  endingId?: string;
}

function makeTestKind(): Kind<TestKindState> {
  return {
    id: "story-graph",
    version: "1.0.0",
    reasonCodes: [],
    reasonMessages: new Map(),
    eventNames: [],
    initialState: (): InitialStateResult<TestKindState> => ({
      state: { counter: 0 },
      status: "active",
      changes: [],
      messages: [],
    }),
    availableActions: (): AvailableAction[] => [{ id: "increment", labelKey: "test.increment", available: true }],
    scene: (state): SceneBody => ({ textKey: "test.scene", text: `counter=${state.counter}` }),
    advance: (state, actionId): AdvanceResult<TestKindState> => {
      if (actionId === "increment") {
        const counter = state.counter + 1;
        // Unlocks "milestone" the moment counter reaches 2 — the same
        // `achievement_unlocked`/`achieved.<id>` convention `session/store.ts` reads.
        const changes =
          counter === 2
            ? [{ path: "achieved.milestone", op: "set" as const, value: true, reason: "achievement_unlocked", visible: true }]
            : [];
        return { state: { ...state, counter }, status: "active", changes, messages: [] };
      }
      if (actionId === "end") {
        return { state: { ...state, endingId: "the_end" }, status: "ended", changes: [], messages: [] };
      }
      return {
        state,
        status: "active",
        changes: [],
        messages: [],
        error: { code: "unknown_action", messageKey: "core.reason.unknown_action" },
      };
    },
    project: (state) => ({ counter: state.counter }),
    validateCampaign: (): ValidationResult => ({ ok: true, errors: [], warnings: [] }),
    validateState: () => true,
    outcome: (state) => {
      const endingId = state.endingId ?? null;
      return { terminal: endingId !== null, terminalId: endingId, endingId };
    },
  };
}

function makeRegistry(version = "1"): ContentRegistry {
  const campaign: Campaign = { id: "test-campaign", kindId: "story-graph", version, titleKey: "test.title", content: {} };
  return { campaigns: new Map([["test-campaign", campaign]]), strings: new Map() };
}

function makeContext(registry: ContentRegistry = makeRegistry()): ReplayRunnerContext {
  const kinds = { "story-graph": makeTestKind() } as unknown as KindRegistry;
  const host: EngineHost = { kinds, registry, ids: FIXED_IDS };
  return {
    engine: createEngine(host),
    kinds,
    registry,
    profiles: createInMemoryProfileStore(),
    profileId: PROFILE_ID,
  };
}

function makeFixture(overrides?: Partial<ReplayFixture>): ReplayFixture {
  return {
    name: "two increments then end",
    config: { campaignId: "test-campaign", seed: "fixed-seed" },
    campaignVersion: "1",
    capturedUnder: "0.1.0",
    submissions: [{ actionId: "increment" }, { actionId: "increment" }, { actionId: "end" }],
    ...overrides,
  };
}

describe("buildReplayOutcome", () => {
  it("throws when config.seed is explicitly null — a fixture parsed from untyped JSON could still smuggle one past the type", async () => {
    // `config.seed ?? ids.newSeed()` (kernel/engine.ts) is nullish coalescing, not an
    // `undefined` check, so a guard that only rejected `undefined` would still let a null
    // seed reach a non-reproducible fallback silently — same reasoning as
    // `core/determinism/harness.test.ts`'s equivalent case for `runFixture`.
    const fixture = { ...makeFixture(), config: { campaignId: "test-campaign", seed: null } } as unknown as ReplayFixture;
    await expect(buildReplayOutcome(makeContext(), fixture)).rejects.toThrow(/config\.seed is required/);
  });

  it("builds finalStatus, acceptedActions, decisions, achievements, and terminal from a real replay", async () => {
    const result = await buildReplayOutcome(makeContext(), makeFixture());
    if (result.kind !== "outcome") throw new Error("expected an outcome");

    expect(result.outcome.finalStatus).toBe("ended");
    expect(result.outcome.acceptedActions).toBe(3);
    expect(result.outcome.decisions).toEqual([
      { index: 0, seq: 0, actionId: "increment", accepted: true },
      { index: 1, seq: 1, actionId: "increment", accepted: true },
      { index: 2, seq: 2, actionId: "end", accepted: true },
    ]);
    expect(result.outcome.achievements).toEqual(["milestone"]);
    expect(result.outcome.terminal).toEqual({ terminal: true, terminalId: "the_end", endingId: "the_end" });
  });

  it("a rejected submission records seq: null and a reason, and does not stop the replay", async () => {
    const fixture = makeFixture({
      submissions: [{ actionId: "increment" }, { actionId: "totally_fake" }, { actionId: "increment" }],
    });
    const result = await buildReplayOutcome(makeContext(), fixture);
    if (result.kind !== "outcome") throw new Error("expected an outcome");

    expect(result.outcome.decisions).toEqual([
      { index: 0, seq: 0, actionId: "increment", accepted: true },
      { index: 1, seq: null, actionId: "totally_fake", accepted: false, reason: "unknown_action" },
      { index: 2, seq: 1, actionId: "increment", accepted: true },
    ]);
    // The second increment still landed — the rejection in between changed nothing.
    expect(result.outcome.achievements).toEqual(["milestone"]);
  });

  it("reports campaign_withdrawn when the fixture's campaignId does not exist in the registry", async () => {
    const fixture = makeFixture({ config: { campaignId: "does-not-exist", seed: "fixed-seed" } });
    const result = await buildReplayOutcome(makeContext(), fixture);
    expect(result).toEqual({ kind: "unrunnable", reason: "campaign_withdrawn" });
  });

  it("reports campaign_version_missing when the campaign exists but at a different version", async () => {
    const result = await buildReplayOutcome(makeContext(makeRegistry("2")), makeFixture({ campaignVersion: "1" }));
    expect(result).toEqual({ kind: "unrunnable", reason: "campaign_version_missing" });
  });
});

describe("findDivergence", () => {
  it("returns undefined when every field matches — the match verdict", async () => {
    const context = makeContext();
    const first = await buildReplayOutcome(context, makeFixture());
    const second = await buildReplayOutcome(makeContext(), makeFixture());
    if (first.kind !== "outcome" || second.kind !== "outcome") throw new Error("expected outcomes");

    expect(findDivergence(first.outcome, second.outcome)).toBeUndefined();
  });

  it("reports the index of the first differing Decision, not a seq", async () => {
    const expected = await buildReplayOutcome(makeContext(), makeFixture());
    if (expected.kind !== "outcome") throw new Error("expected an outcome");

    // A run where the third submission was rejected instead of accepted.
    const actual = {
      ...expected.outcome,
      decisions: [
        expected.outcome.decisions[0]!,
        expected.outcome.decisions[1]!,
        { index: 2, seq: null, actionId: "end", accepted: false, reason: "requirement_unmet" },
      ],
    };

    expect(findDivergence(expected.outcome, actual)).toBe(2);
  });

  it("reports submissions.length when every Decision matches but achievements/terminal differ", async () => {
    const expected = await buildReplayOutcome(makeContext(), makeFixture());
    if (expected.kind !== "outcome") throw new Error("expected an outcome");

    const actual = { ...expected.outcome, terminal: { endingId: "a_different_ending" } };
    expect(findDivergence(expected.outcome, actual)).toBe(expected.outcome.decisions.length);
  });

  it("catches a corrupted index even when every other Decision field matches", async () => {
    // A hand-edited .outcome.json with decisions reordered or an index typo'd — every other
    // field could still agree, and index is itself part of the committed artifact (07 §3.1),
    // not a value the comparator is free to re-derive from array position and trust blindly.
    const expected = await buildReplayOutcome(makeContext(), makeFixture());
    if (expected.kind !== "outcome") throw new Error("expected an outcome");

    const actual = {
      ...expected.outcome,
      decisions: expected.outcome.decisions.map((d, i) => (i === 1 ? { ...d, index: 99 } : d)),
    };
    expect(findDivergence(expected.outcome, actual)).toBe(1);
  });
});

describe("runReplayFixture", () => {
  it("matches a fixture against its own freshly-built Outcome", async () => {
    const expected = await buildReplayOutcome(makeContext(), makeFixture());
    if (expected.kind !== "outcome") throw new Error("expected an outcome");

    const verdict = await runReplayFixture(makeContext(), makeFixture(), expected.outcome);
    expect(verdict).toEqual({ kind: "match" });
  });

  it("reports diverged with capturedUnder and both outcomes when the game no longer plays the same way", async () => {
    const expected = await buildReplayOutcome(makeContext(), makeFixture());
    if (expected.kind !== "outcome") throw new Error("expected an outcome");

    // A fixture whose middle submission the current engine now rejects.
    const changedFixture = makeFixture({
      submissions: [{ actionId: "increment" }, { actionId: "totally_fake" }, { actionId: "end" }],
    });
    const verdict = await runReplayFixture(makeContext(), changedFixture, expected.outcome);

    expect(verdict.kind).toBe("diverged");
    if (verdict.kind !== "diverged") throw new Error("expected diverged");
    expect(verdict.at).toBe(1);
    expect(verdict.capturedUnder).toBe("0.1.0");
    expect(verdict.expected).toEqual(expected.outcome);
  });

  it("surfaces unrunnable straight through, without attempting a comparison", async () => {
    const fixture = makeFixture({ config: { campaignId: "does-not-exist", seed: "fixed-seed" } });
    const verdict = await runReplayFixture(makeContext(), fixture, {
      finalStatus: "ended",
      acceptedActions: 0,
      decisions: [],
      achievements: [],
    });
    expect(verdict).toEqual({ kind: "unrunnable", reason: "campaign_withdrawn" });
  });
});

// ---------------------------------------------------------------------------
// S135 — the oracle crosses content epochs (07 §2, §3, §6)
// ---------------------------------------------------------------------------

/** The test kind, adopting any epoch whose content does not say `refuse`. */
function makeAdoptingKind(): Kind<TestKindState> {
  return {
    ...makeTestKind(),
    adoptContent: (state, _from, to) =>
      (to.content as { refuse?: boolean }).refuse ? { adopt: false, reason: "content_incompatible" } : { adopt: true, state },
  };
}

function epochRegistry(version: string, content: Record<string, unknown> = {}): ContentRegistry {
  const campaign: Campaign = { id: "test-campaign", kindId: "story-graph", version, titleKey: "test.title", content };
  return { campaigns: new Map([["test-campaign", campaign]]), strings: new Map() };
}

/** An engine whose default epoch is `registry`'s, over an archive that also holds `others`. */
function makeEpochContext(registry: ContentRegistry, others: readonly ContentRegistry[]): ReplayRunnerContext {
  const kinds = { "story-graph": makeAdoptingKind() } as unknown as KindRegistry;
  const archive = createContentArchive({ kinds, initial: registry });
  for (const other of others) {
    if (!archive.publish(other).ok) throw new Error("expected the epoch to publish");
  }
  const host: EngineHost = { kinds, registry, ids: FIXED_IDS, archive };
  return { engine: createEngine(host), kinds, registry, profiles: createInMemoryProfileStore(), profileId: PROFILE_ID };
}

const CROSSING: readonly Submission[] = [{ actionId: "increment" }, { adopt: "2" }, { actionId: "increment" }, { actionId: "end" }];

describe("S135.1 — Submission and Decision are unions; an action-only fixture reads unchanged", () => {
  it("an action-only fixture's decisions are ActionDecisions, carrying no adopt field", async () => {
    const result = await buildReplayOutcome(makeContext(), makeFixture());
    if (result.kind !== "outcome") throw new Error("expected an outcome");
    expect(result.outcome.decisions.every((d) => !("adopt" in d))).toBe(true);
  });

  it("an outcome recorded before content epochs still matches as plain JSON", async () => {
    const recorded = JSON.parse(
      JSON.stringify({
        finalStatus: "ended",
        acceptedActions: 3,
        decisions: [
          { index: 0, seq: 0, actionId: "increment", accepted: true },
          { index: 1, seq: 1, actionId: "increment", accepted: true },
          { index: 2, seq: 2, actionId: "end", accepted: true },
        ],
        achievements: ["milestone"],
        terminal: { terminal: true, terminalId: "the_end", endingId: "the_end" },
      }),
    ) as Outcome;
    const fixture = JSON.parse(JSON.stringify(makeFixture())) as ReplayFixture;
    expect(await runReplayFixture(makeContext(), fixture, recorded)).toEqual({ kind: "match" });
  });
});

describe("S135.2 — every version the fixture names resolves through the engine's content first", () => {
  it("starts on the fixture's campaignVersion, not the registry's, when the archive holds it", async () => {
    const context = makeEpochContext(epochRegistry("2"), [epochRegistry("1")]);
    const result = await buildReplayOutcome(context, makeFixture({ campaignVersion: "1", submissions: [{ actionId: "increment" }, { adopt: "2" }] }));
    if (result.kind !== "outcome") throw new Error("expected an outcome");
    // Only a game that started on "1" can adopt "2" — one created on the registry's "2"
    // would be refused nothing and append nothing (adoptContent step 0).
    expect(result.outcome.decisions[1]).toEqual({ index: 1, seq: 1, adopt: "2", accepted: true });
  });

  it("an adopted version the archive does not hold is campaign_version_missing, before anything runs", async () => {
    const context = makeEpochContext(epochRegistry("1"), [epochRegistry("2")]);
    const result = await buildReplayOutcome(context, makeFixture({ submissions: [{ actionId: "increment" }, { adopt: "3" }] }));
    expect(result).toEqual({ kind: "unrunnable", reason: "campaign_version_missing" });
  });

  it("a starting version the archive does not hold is campaign_version_missing", async () => {
    const context = makeEpochContext(epochRegistry("2"), [epochRegistry("3")]);
    expect(await buildReplayOutcome(context, makeFixture({ campaignVersion: "1" }))).toEqual({
      kind: "unrunnable",
      reason: "campaign_version_missing",
    });
  });

  it("a campaign id the registry no longer has is still campaign_withdrawn", async () => {
    const context = makeEpochContext(epochRegistry("1"), [epochRegistry("2")]);
    const fixture = makeFixture({ config: { campaignId: "does-not-exist", seed: "fixed-seed" }, submissions: CROSSING });
    expect(await buildReplayOutcome(context, fixture)).toEqual({ kind: "unrunnable", reason: "campaign_withdrawn" });
  });
});

describe("S135.3 — an adoption runs through adoptContent, counts in decisions, never in acceptedActions", () => {
  it("records an accepted AdoptionDecision at the content entry's seq, and acceptedActions counts actions only", async () => {
    const context = makeEpochContext(epochRegistry("1"), [epochRegistry("2")]);
    const result = await buildReplayOutcome(context, makeFixture({ submissions: CROSSING }));
    if (result.kind !== "outcome") throw new Error("expected an outcome");

    expect(result.outcome.decisions).toEqual([
      { index: 0, seq: 0, actionId: "increment", accepted: true },
      { index: 1, seq: 1, adopt: "2", accepted: true },
      { index: 2, seq: 2, actionId: "increment", accepted: true },
      { index: 3, seq: 3, actionId: "end", accepted: true },
    ]);
    expect(result.outcome.acceptedActions).toBe(3);
    expect(result.outcome.finalStatus).toBe("ended");
    expect(result.outcome.achievements).toEqual(["milestone"]);
  });

  it("a refusal records accepted: false with its reason and no seq, and the replay continues on the pinned epoch", async () => {
    const context = makeEpochContext(epochRegistry("1"), [epochRegistry("2", { refuse: true })]);
    const result = await buildReplayOutcome(context, makeFixture({ submissions: CROSSING }));
    if (result.kind !== "outcome") throw new Error("expected an outcome");

    expect(result.outcome.decisions[1]).toEqual({ index: 1, seq: null, adopt: "2", accepted: false, reason: "content_incompatible" });
    expect(result.outcome.decisions[2]).toEqual({ index: 2, seq: 1, actionId: "increment", accepted: true });
    expect(result.outcome.acceptedActions).toBe(3);
  });

  it("an adoption the kind now refuses is diverged at that index", async () => {
    const recorded = await buildReplayOutcome(makeEpochContext(epochRegistry("1"), [epochRegistry("2")]), makeFixture({ submissions: CROSSING }));
    if (recorded.kind !== "outcome") throw new Error("expected an outcome");

    const refusing = makeEpochContext(epochRegistry("1"), [epochRegistry("2", { refuse: true })]);
    const verdict = await runReplayFixture(refusing, makeFixture({ submissions: CROSSING }), recorded.outcome);
    expect(verdict.kind).toBe("diverged");
    if (verdict.kind !== "diverged") throw new Error("expected diverged");
    expect(verdict.at).toBe(1);
  });

  it("matches a crossing fixture against its own recorded outcome", async () => {
    const context = (): ReplayRunnerContext => makeEpochContext(epochRegistry("1"), [epochRegistry("2")]);
    const recorded = await buildReplayOutcome(context(), makeFixture({ submissions: CROSSING }));
    if (recorded.kind !== "outcome") throw new Error("expected an outcome");
    expect(await runReplayFixture(context(), makeFixture({ submissions: CROSSING }), recorded.outcome)).toEqual({ kind: "match" });
  });

  it("findDivergence tells an adoption from an action at the same index", () => {
    const base: Outcome = { finalStatus: "active", acceptedActions: 0, decisions: [{ index: 0, seq: 0, adopt: "2", accepted: true }], achievements: [] };
    const asAction: Outcome = { ...base, decisions: [{ index: 0, seq: 0, actionId: "2", accepted: true }] };
    const otherVersion: Outcome = { ...base, decisions: [{ index: 0, seq: 0, adopt: "3", accepted: true }] };
    expect(findDivergence(base, asAction)).toBe(0);
    expect(findDivergence(asAction, base)).toBe(0);
    expect(findDivergence(base, otherVersion)).toBe(0);
    expect(findDivergence(base, base)).toBeUndefined();
  });

  it("throws on an adoption naming the version the game is already on — a fixture records only adoptions that happened", async () => {
    const context = makeEpochContext(epochRegistry("1"), [epochRegistry("2")]);
    await expect(buildReplayOutcome(context, makeFixture({ submissions: [{ adopt: "1" }] }))).rejects.toThrow(/already on/);
  });
});
