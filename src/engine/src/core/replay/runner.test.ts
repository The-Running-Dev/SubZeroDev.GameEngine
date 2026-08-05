import { describe, it, expect } from "vitest";
import { buildReplayOutcome, findDivergence, runReplayFixture, type ReplayRunnerContext } from "./runner.js";
import type { ReplayFixture } from "./types.js";
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
    outcome: (state) => ({ endingId: state.endingId ?? null }),
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
    expect(result.outcome.terminal).toEqual({ endingId: "the_end" });
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
