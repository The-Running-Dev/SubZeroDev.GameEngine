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

  // 04 §10.2: an extension that keeps this function is called from the version it extends.
  it("passes its own 2.0.0 shape through, moving no id and re-deriving no route", () => {
    const state: StoryGraphKindState = {
      currentNodeId: "registry_route_3",
      variables: { ...Object.fromEntries(Object.entries(bulgariaBureaucracySource.variables).map(([n, d]) => [n, d.initial])), route: "archive_route" },
      turn: 4,
      visitedCounts: { registry_route_3: 2 },
      unlockedAchievements: [],
    };

    const result = migrateV1AdventureState(state, "2.0.0", bulgariaBureaucracySource, { registry_route_3: "somewhere_else" });

    expect(result.ok).toBe(true);
    expect(result.value).toEqual(state);
  });

  it("fails for a version it cannot reach", () => {
    const state: StoryGraphKindState = { currentNodeId: "registry_route_3", variables: {}, turn: 0, visitedCounts: {}, unlockedAchievements: [] };
    for (const fromVersion of ["0.9.0", "1.5.0", "2.1.0"]) {
      const result = migrateV1AdventureState(state, fromVersion, bulgariaBureaucracySource, {});
      expect(result).toMatchObject({ ok: false, errors: [{ code: "migration_failed" }] });
    }
  });
});
