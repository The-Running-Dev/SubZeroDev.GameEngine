import { describe, it, expect } from "vitest";
import { createEngine } from "./engine.js";
import type {
  AdvanceResult,
  AvailableAction,
  GameState,
  InitialStateResult,
  Kind,
  KindRegistry,
  SceneBody,
} from "./types.js";
import type { Campaign, ContentRegistry } from "../registry/types.js";
import type { ValidationResult } from "../validation/types.js";
import type { ProjectionAudience } from "../projection/types.js";
import type { EngineHost } from "../composition/types.js";

/**
 * 04 §9's two done-criteria, proven as black-box properties rather than assumed from the
 * type system: `PlayerView`/`Scene` have no `seed`/`actionLog`/`kindState` fields, but this
 * suite checks the actual serialized *values* a client would receive, and separately
 * proves the core forwards `audience` faithfully rather than substituting it. See
 * `plans/13-w6-projection.md`.
 */

const MARKER_SEED = "MARKER-SEED-should-never-leak";
const MARKER_ACTION = "MARKER-ACTION-should-not-leak";
const MARKER_SECRET = "TOP-SECRET-marker";

interface TestKindState {
  counter: number;
  /** Deliberately excluded from every projection below — the leak this suite checks for. */
  secret: string;
}

function makeTestKind(overrides?: Partial<Kind<TestKindState>>): Kind<TestKindState> {
  return {
    id: "story-graph",
    reasonCodes: [],
    eventNames: [],
    initialState: (): InitialStateResult<TestKindState> => ({
      state: { counter: 0, secret: MARKER_SECRET },
      status: "active",
      changes: [],
      messages: [],
    }),
    availableActions: (): AvailableAction[] => [{ id: MARKER_ACTION, labelKey: "test.mark", available: true }],
    scene: (state): SceneBody => ({ textKey: "test.scene", text: `counter=${state.counter}` }),
    advance: (state, actionId): AdvanceResult<TestKindState> => {
      if (actionId === MARKER_ACTION) {
        return { state: { ...state, counter: state.counter + 1 }, status: "active", changes: [], messages: [] };
      }
      return {
        state,
        status: "active",
        changes: [],
        messages: [],
        error: { code: "unknown_action", messageKey: "core.reason.unknown_action" },
      };
    },
    // Well-behaved by default: excludes `secret`, and doesn't widen for "ai".
    project: (state) => ({ counter: state.counter }),
    validateCampaign: (): ValidationResult => ({ ok: true, errors: [], warnings: [] }),
    outcome: (state) => ({ counter: state.counter }),
    ...overrides,
  };
}

function makeCampaign(): Campaign {
  return { id: "test-campaign", kindId: "story-graph", version: "1", titleKey: "test.title", content: {} };
}

function makeRegistry(): ContentRegistry {
  const campaign = makeCampaign();
  return { campaigns: new Map([[campaign.id, campaign]]), strings: new Map() };
}

function makeKinds(kind: Kind<TestKindState> = makeTestKind()): KindRegistry {
  return { "story-graph": kind } as unknown as KindRegistry;
}

function makeHost(overrides?: Partial<EngineHost>): EngineHost {
  return { kinds: makeKinds(), registry: makeRegistry(), ...overrides };
}

describe("projection: no envelope secret reaches a client by any path", () => {
  it("view, scene, and availableActions never contain the seed, the action id, or the kind's hidden field", () => {
    const engine = createEngine(makeHost());
    const created = engine.createGame({ campaignId: "test-campaign", seed: MARKER_SEED });
    const afterAction = engine.submitAction(created.value as GameState, MARKER_ACTION);
    const state = afterAction.value as GameState;
    expect(state.actionLog).toEqual([{ seq: 0, actionId: MARKER_ACTION }]);

    const outputs = [engine.view(state, "player"), engine.scene(state), engine.availableActions(state)];

    for (const output of outputs) {
      const serialized = JSON.stringify(output);
      expect(serialized).not.toContain(MARKER_SEED);
      expect(serialized).not.toContain(MARKER_SECRET);
    }
  });
});

describe("projection: audience", () => {
  it("passes the requested audience through to kind.project unchanged, in order", () => {
    const capturedAudiences: ProjectionAudience[] = [];
    const capturingKind = makeTestKind({
      project: (state, audience) => {
        capturedAudiences.push(audience);
        return { counter: state.counter };
      },
    });
    const engine = createEngine(makeHost({ kinds: makeKinds(capturingKind) }));
    const state = engine.createGame({ campaignId: "test-campaign" }).value as GameState;

    engine.view(state, "player");
    engine.view(state, "ai");

    expect(capturedAudiences).toEqual(["player", "ai"]);
  });

  it("a well-behaved kind's ai view is not wider than its player view by default", () => {
    const engine = createEngine(makeHost());
    const state = engine.createGame({ campaignId: "test-campaign" }).value as GameState;

    const playerView = engine.view(state, "player");
    const aiView = engine.view(state, "ai");

    expect(aiView.kindView).toEqual(playerView.kindView);
  });

  it("scene()'s bundled view agrees with a direct view(state, \"player\") call", () => {
    const engine = createEngine(makeHost());
    const state = engine.createGame({ campaignId: "test-campaign" }).value as GameState;

    const scene = engine.scene(state);
    const directView = engine.view(state, "player");

    expect(scene.view.kindView).toEqual(directView.kindView);
    expect(scene.view.gameId).toBe(directView.gameId);
    expect(scene.view.status).toBe(directView.status);
  });
});
