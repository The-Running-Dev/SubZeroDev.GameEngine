import { describe, expect, it } from "vitest";
import { createCountingIds } from "./counting-ids.js";

describe("createCountingIds", () => {
  it("counts game ids and seeds independently, each starting at 0", () => {
    const ids = createCountingIds();
    expect(ids.newGameId()).toBe("counting-game-id-0");
    expect(ids.newGameId()).toBe("counting-game-id-1");
    expect(ids.newSeed()).toBe("counting-seed-0");
    expect(ids.newSeed()).toBe("counting-seed-1");
  });

  it("does not couple seed numbering to how many game ids were allocated first", () => {
    // The bug PR #72 fixed: a single shared counter would make the first auto-generated
    // seed "counting-seed-2" here (after two newGameId() calls), not "counting-seed-0".
    const ids = createCountingIds();
    ids.newGameId();
    ids.newGameId();
    expect(ids.newSeed()).toBe("counting-seed-0");
  });

  it("a fresh instance always starts both counters at 0", () => {
    const first = createCountingIds();
    first.newGameId();
    first.newSeed();

    const second = createCountingIds();
    expect(second.newGameId()).toBe("counting-game-id-0");
    expect(second.newSeed()).toBe("counting-seed-0");
  });
});
