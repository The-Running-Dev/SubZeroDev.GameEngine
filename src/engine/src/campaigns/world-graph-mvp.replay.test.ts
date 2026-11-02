import { describe, expect, it } from "vitest";
import { createEngine } from "../core/kernel/engine.js";
import { createCountingIds } from "../core/determinism/counting-ids.js";
import type { KindRegistry } from "../core/kernel/types.js";
import type { ContentRegistry } from "../core/registry/types.js";
import { buildReplayOutcome, createReplayContext, runReplayFixture, type ReplayRunnerContext } from "../core/replay/runner.js";
import { buildValidatedContentRegistry } from "../core/validation/tiered.js";
import { createInMemoryProfileStore } from "../core/session/profile-store.js";
import { worldGraphKind } from "../kinds/world-graph/kind.js";
import { buildWorldGraphMvpCampaign } from "./world-graph-mvp.js";
import { COMPARING_ACROSS_VERSIONS, CORPUS_DIR, FIXTURES_DIR, fixtureNamesByPrefix, loadExpectedOutcome, loadFixture, statesThatFailToDeserialize } from "./replay-corpus.js";

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

// S126: every state the corpus passes through is one its kind's `validateState` accepts.
describe("the replay corpus deserializes (S126)", () => {
  it.for(fixtureNamesByPrefix("world-graph-mvp-", FIXTURES_DIR))("%s: every state it reaches round-trips through deserialize", (name) => {
    expect(statesThatFailToDeserialize(makeContext().engine, loadFixture(name, FIXTURES_DIR))).toEqual([]);
  });
});

// S140.5: `createReplayContext` judges a fixture against the host's *current* publication
// (20-contract §19; 07 §6). The committed corpus, not a baseline override: the point is the
// context, not cross-version comparison.
describe("S140.5 — a helper-built context judges a committed fixture against the current publication", () => {
  const NAME = "world-graph-mvp-win";
  const fixture = loadFixture(NAME, FIXTURES_DIR);

  /** The host has withdrawn every campaign; the engine's archive still holds the old epoch. */
  const WITHDRAWN: ContentRegistry = { campaigns: new Map(), strings: new Map(), provenance: new Map() };

  it("replays to match when the registry is the current publication", async () => {
    const { engine, registry } = makeContext();
    const verdict = await runReplayFixture(createReplayContext(engine, registry), fixture, loadExpectedOutcome(NAME, FIXTURES_DIR));
    expect(verdict).toEqual({ kind: "match" });
  });

  it("reports campaign_withdrawn when the current publication no longer has the campaign", async () => {
    const { engine } = makeContext();
    expect(engine.content.resolve(fixture.config.campaignId, fixture.campaignVersion)).toBeDefined();
    const result = await buildReplayOutcome(createReplayContext(engine, WITHDRAWN), fixture);
    expect(result).toEqual({ kind: "unrunnable", reason: "campaign_withdrawn" });
  });

  it("a hand-built context resolved at the fixture's own version runs instead — the verdict the helper's registry guards", async () => {
    const { engine } = makeContext();
    const resolved = engine.content.resolve(fixture.config.campaignId, fixture.campaignVersion);
    if (!resolved) throw new Error("expected the archive to hold the fixture's version");
    const handBuilt: ReplayRunnerContext = { ...createReplayContext(engine, WITHDRAWN), registry: resolved };
    expect((await buildReplayOutcome(handBuilt, fixture)).kind).toBe("outcome");
  });
});
