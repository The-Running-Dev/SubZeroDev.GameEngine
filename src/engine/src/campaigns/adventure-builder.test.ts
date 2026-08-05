import { describe, expect, it } from "vitest";
import type { StoryGraphKindState } from "../kinds/story-graph/state.js";
import { migrateV1AdventureState } from "./adventure-builder.js";
import { bulgariaBureaucracySource } from "./bulgaria-bureaucracy.js";

describe("migrateV1AdventureState", () => {
  it("derives the v2 route from a mapped route node", () => {
    const state: StoryGraphKindState = {
      currentNodeId: "legacy-room",
      variables: { route: "archive_route" },
      turn: 2,
      visitedCounts: { "legacy-room": 1 },
      unlockedAchievements: [],
    };

    const result = migrateV1AdventureState(state, "1.0.0", bulgariaBureaucracySource, {
      "legacy-room": "registry_route_3",
    });

    expect(result.ok).toBe(true);
    expect((result.value as StoryGraphKindState).variables.route).toBe("registry_route");
    expect((result.value as StoryGraphKindState).visitedCounts).toEqual({ registry_route_3: 1 });
  });
});
