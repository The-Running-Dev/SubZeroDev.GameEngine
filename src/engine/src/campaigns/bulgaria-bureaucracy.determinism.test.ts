import { describe, it, expect } from "vitest";
import { runFixture, type PlaythroughFixture } from "../core/determinism/harness.js";
import { createEngine } from "../core/kernel/engine.js";
import { createRecordingEmitter, nullEmitter } from "../core/observability/emitter.js";
import type { EngineEvent } from "../core/observability/types.js";
import { buildValidatedContentRegistry } from "../core/validation/tiered.js";
import type { Engine, Kind, KindRegistry, InitialStateResult, AvailableAction, SceneBody, AdvanceResult } from "../core/kernel/types.js";
import type { IdSource } from "../core/composition/types.js";
import { validateCampaign } from "../kinds/story-graph/validate.js";
import { STORY_GRAPH_REASON_CODES } from "../kinds/story-graph/reasons.js";
import { initialState } from "../kinds/story-graph/settle.js";
import { availableActions, scene } from "../kinds/story-graph/scene.js";
import { advance } from "../kinds/story-graph/advance.js";
import { project } from "../kinds/story-graph/view.js";
import type { StoryGraphKindState } from "../kinds/story-graph/state.js";
import { buildBulgariaBureaucracyCampaign, BULGARIA_BUREAUCRACY_CAMPAIGN_ID } from "./bulgaria-bureaucracy.js";

// The scan-verified seed whose first weighted pick at clerk_review (3 expired : 1 room_14)
// lands on room_14 — see plans/22-w15-bureaucracy-campaign-and-broken-fixtures.md.
const SEED = "bureaucracy-seed-3";

// gameId comes from crypto.randomUUID() by default regardless of seed (06-extensibility.md
// §5.1) — every comparison below needs it fixed too, or two "identical" runs would only
// ever differ in this one field.
const FIXED_IDS: IdSource = { newGameId: () => "fixed-game-id", newSeed: () => "fixed-seed" };

function makeStoryGraphKind(): Kind<StoryGraphKindState> {
  return {
    id: "story-graph",
    reasonCodes: STORY_GRAPH_REASON_CODES,
    eventNames: [
      "kind.story-graph.settle.step",
      "kind.story-graph.node.entered",
      "kind.story-graph.random.picked",
      "kind.story-graph.settle.guard_tripped",
    ],
    initialState: (c, ctx): InitialStateResult<StoryGraphKindState> => initialState(c, ctx),
    availableActions: (state, ctx): AvailableAction[] => availableActions(state, ctx),
    scene: (state, ctx): SceneBody => scene(state, ctx),
    advance: (state, actionId, params, ctx): AdvanceResult<StoryGraphKindState> => advance(state, actionId, params, ctx),
    project: (state, audience, ctx) => project(state, audience, ctx),
    validateCampaign: (campaign, strings) => validateCampaign(campaign, strings),
    outcome: (state) => ({ endingId: state.endingId ?? null }),
  };
}

function buildEngine(ids?: IdSource): Engine {
  const built = buildBulgariaBureaucracyCampaign();
  if (!built.ok || !built.value) throw new Error("expected the real campaign to build");
  const kinds = { "story-graph": makeStoryGraphKind() } as unknown as KindRegistry;
  const registryResult = buildValidatedContentRegistry([built.value], kinds);
  if (!registryResult.ok || !registryResult.value) throw new Error("expected the real campaign to validate");
  return createEngine({ kinds, registry: registryResult.value, ...(ids ? { ids } : {}) });
}

/** `gameId` legitimately changes between independent runs without a fixed `IdSource` — the
 *  fixtures below always supply one, but this keeps the comparison itself honest even so. */
function normalizeEvents(events: readonly EngineEvent[]): unknown[] {
  return events.map((event) => {
    const clone: Record<string, unknown> = { ...event };
    delete clone["gameId"];
    return clone;
  });
}

const FULL_ARC_FIXTURE: PlaythroughFixture = {
  name: "full arc to the ending",
  config: { campaignId: BULGARIA_BUREAUCRACY_CAMPAIGN_ID, seed: SEED },
  actionLog: [
    { seq: 0, actionId: "wait" },
    { seq: 1, actionId: "continue_cycle" },
    { seq: 2, actionId: "continue_cycle" },
    { seq: 3, actionId: "go_home" },
  ],
};

const MID_ARC_FIXTURE: PlaythroughFixture = {
  name: "mid-arc, non-terminal",
  config: { campaignId: BULGARIA_BUREAUCRACY_CAMPAIGN_ID, seed: SEED },
  actionLog: [{ seq: 0, actionId: "wait" }],
};

const FIXTURES: PlaythroughFixture[] = [FULL_ARC_FIXTURE, MID_ARC_FIXTURE];

describe("determinism harness — the real Bureaucracy campaign (04-core.md §14)", () => {
  it.each(FIXTURES)("$name: serialize() output is golden-filed", (fixture) => {
    const engine = buildEngine(FIXED_IDS);
    expect(runFixture(engine, fixture)).toMatchSnapshot();
  });

  it("the full-arc fixture actually reaches the ending and unlocks the achievement — the golden file isn't snapshotting a no-op", () => {
    const engine = buildEngine(FIXED_IDS);
    const serialized = runFixture(engine, FULL_ARC_FIXTURE);
    const parsed = JSON.parse(serialized) as {
      status: string;
      kindState: { endingId?: string; unlockedAchievements: string[]; variables: { office_visits: number } };
    };
    expect(parsed.status).toBe("ended");
    expect(parsed.kindState.endingId).toBe("ultimate_reward");
    expect(parsed.kindState.unlockedAchievements).toEqual(["it_builds_character"]);
    expect(parsed.kindState.variables.office_visits).toBe(3);
  });

  it("a one-character difference is detectable — the sensitivity toMatchSnapshot() itself relies on", () => {
    const engine = buildEngine(FIXED_IDS);
    const serialized = runFixture(engine, MID_ARC_FIXTURE);
    const lastChar = serialized.at(-1);
    const corrupted = serialized.slice(0, -1) + (lastChar === "}" ? ")" : "}");

    expect(corrupted).not.toBe(serialized);
    expect(corrupted).toHaveLength(serialized.length);
  });

  it.each(FIXTURES)("$name: deserialize(serialize(state)) round-trips", (fixture) => {
    const engine = buildEngine(FIXED_IDS);
    const serialized = runFixture(engine, fixture);
    const result = engine.deserialize(serialized);
    expect(result.ok).toBe(true);
    expect(engine.serialize(result.value!)).toBe(serialized);
  });

  it.each(FIXTURES)("$name: replays byte-identically under nullEmitter and recordingEmitter", (fixture) => {
    const withoutRecording = runFixture(buildEngine(FIXED_IDS).withEmitter(nullEmitter), fixture);
    const withRecording = runFixture(buildEngine(FIXED_IDS).withEmitter(createRecordingEmitter()), fixture);
    expect(withRecording).toBe(withoutRecording);
  });

  it.each(FIXTURES)("$name: replayed twice under recordingEmitter yields the identical event sequence", (fixture) => {
    const firstRecorder = createRecordingEmitter();
    runFixture(buildEngine(FIXED_IDS).withEmitter(firstRecorder), fixture);
    const secondRecorder = createRecordingEmitter();
    runFixture(buildEngine(FIXED_IDS).withEmitter(secondRecorder), fixture);
    expect(normalizeEvents(firstRecorder.events)).toEqual(normalizeEvents(secondRecorder.events));
  });

  it.each(FIXTURES)("$name: event stream is golden-filed", (fixture) => {
    const recorder = createRecordingEmitter();
    runFixture(buildEngine(FIXED_IDS).withEmitter(recorder), fixture);
    expect(normalizeEvents(recorder.events)).toMatchSnapshot();
  });

  describe("property: N fixed seeds, each run twice, match", () => {
    const PROPERTY_SEEDS = ["property-seed-alpha", "property-seed-bravo", "property-seed-charlie", "property-seed-delta", "property-seed-echo"];

    it.each(PROPERTY_SEEDS)("seed %s reproduces itself", (seed) => {
      const fixture: PlaythroughFixture = {
        name: `property-${seed}`,
        config: { campaignId: BULGARIA_BUREAUCRACY_CAMPAIGN_ID, seed },
        actionLog: [{ seq: 0, actionId: "wait" }],
      };
      const engine = buildEngine(FIXED_IDS);
      expect(runFixture(engine, fixture)).toBe(runFixture(engine, fixture));
    });
  });
});
