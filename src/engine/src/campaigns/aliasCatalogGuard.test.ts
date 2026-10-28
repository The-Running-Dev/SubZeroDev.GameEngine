import { describe, it, expect } from "vitest";
import { runningCatalog } from "../core/kernel/aliases.js";
import { CORE_REASON_MESSAGES } from "../core/kernel/reasons.js";
import type { KindRegistry } from "../core/kernel/types.js";
import { storyGraphKind } from "../kinds/story-graph/kind.js";
import { simulationKind } from "../kinds/simulation/kind.js";
import { worldGraphKind } from "../kinds/world-graph/kind.js";

// C29 (20-contract §7): the alias form `~k` / `~n~k` is injective only while no engine key
// contains `~`. This guards the shipped catalog — every kind registered together.

describe("C29 — the shipped running catalog", () => {
  it("no key in the shipped running catalog contains ~, so distinct engine keys never share an alias", () => {
    const catalog = runningCatalog({ "story-graph": storyGraphKind, simulation: simulationKind, "world-graph": worldGraphKind } as unknown as KindRegistry);
    expect(catalog.size).toBeGreaterThan(CORE_REASON_MESSAGES.size);
    expect([...catalog.keys()].filter((key) => key.includes("~"))).toEqual([]);
  });
});
