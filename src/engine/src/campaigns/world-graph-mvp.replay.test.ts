import { describe, expect, it } from "vitest";
import { createEngine } from "../core/kernel/engine.js";
import { createCountingIds } from "../core/determinism/counting-ids.js";
import type { KindRegistry } from "../core/kernel/types.js";
import { runReplayFixture, type ReplayRunnerContext } from "../core/replay/runner.js";
import { buildValidatedContentRegistry } from "../core/validation/tiered.js";
import { createInMemoryProfileStore } from "../core/session/profile-store.js";
import { worldGraphKind } from "../kinds/world-graph/kind.js";
import { buildWorldGraphMvpCampaign } from "./world-graph-mvp.js";
import { COMPARING_ACROSS_VERSIONS, CORPUS_DIR, FIXTURES_DIR, fixtureNamesByPrefix, loadExpectedOutcome, loadFixture } from "./replay-corpus.js";

const REPLAY_PROFILE_ID = "world-graph-replay-oracle-profile";

function makeContext(): ReplayRunnerContext {
  const built = buildWorldGraphMvpCampaign();
  if (!built.ok || !built.value) throw new Error("expected world-graph MVP campaign to build");
  const kinds = { "world-graph": worldGraphKind } as unknown as KindRegistry;
  const registryResult = buildValidatedContentRegistry([built.value], kinds);
  if (!registryResult.ok || !registryResult.value) throw new Error("expected world-graph MVP campaign to validate");
  return {
    engine: createEngine({ kinds, registry: registryResult.value, ids: createCountingIds() }),
    kinds,
    registry: registryResult.value,
    profiles: createInMemoryProfileStore(),
    profileId: REPLAY_PROFILE_ID,
  };
}

describe("the world-graph MVP replay corpus", () => {
  const names = fixtureNamesByPrefix("world-graph-mvp-", CORPUS_DIR);

  it("contains both terminal paths", () => {
    expect(fixtureNamesByPrefix("world-graph-mvp-", FIXTURES_DIR)).toEqual(expect.arrayContaining([
      "world-graph-mvp-loss",
      "world-graph-mvp-win",
    ]));
  });

  it.for(names)("%s: matches its committed Outcome", async (name, ctx) => {
    const verdict = await runReplayFixture(makeContext(), loadFixture(name), loadExpectedOutcome(name));
    // 10-design.md §6: `unrunnable` is "not a failure" between engine versions (see
    // bulgaria-bureaucracy.replay.test.ts's own it.each for the full rationale).
    ctx.skip(COMPARING_ACROSS_VERSIONS && verdict.kind === "unrunnable", `${name}: unrunnable against the baseline tag's corpus — not a regression (10-design.md §6)`);
    expect(verdict).toEqual({ kind: "match" });
  });
});
