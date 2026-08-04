import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createEngine } from "../core/kernel/engine.js";
import { createCountingIds } from "../core/determinism/counting-ids.js";
import type { KindRegistry } from "../core/kernel/types.js";
import { runReplayFixture, type ReplayRunnerContext } from "../core/replay/runner.js";
import type { Outcome, ReplayFixture } from "../core/replay/types.js";
import { buildValidatedContentRegistry } from "../core/validation/tiered.js";
import { createInMemoryProfileStore } from "../core/session/profile-store.js";
import { worldGraphKind } from "../kinds/world-graph/kind.js";
import { buildWorldGraphMvpCampaign } from "./world-graph-mvp.js";

const FIXTURES_DIR = fileURLToPath(new URL("../../fixtures/replay/", import.meta.url));
const REPLAY_PROFILE_ID = "world-graph-replay-oracle-profile";
const rawOverride = process.env.REPLAY_BASELINE_DIR;
const CORPUS_DIR = rawOverride ? `${rawOverride.replace(/[/\\]+$/, "")}/` : FIXTURES_DIR;

function loadFixture(name: string): ReplayFixture {
  return JSON.parse(readFileSync(`${CORPUS_DIR}${name}.fixture.json`, "utf8")) as ReplayFixture;
}

function loadExpectedOutcome(name: string): Outcome {
  return JSON.parse(readFileSync(`${CORPUS_DIR}${name}.outcome.json`, "utf8")) as Outcome;
}

function fixtureNames(directory: string): string[] {
  return readdirSync(directory)
    .filter((file) => file.startsWith("world-graph-mvp-") && file.endsWith(".fixture.json"))
    .map((file) => file.slice(0, -".fixture.json".length))
    .sort();
}

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
  const names = fixtureNames(CORPUS_DIR);

  it("contains both terminal paths", () => {
    expect(fixtureNames(FIXTURES_DIR)).toEqual(expect.arrayContaining([
      "world-graph-mvp-loss",
      "world-graph-mvp-win",
    ]));
  });

  it.each(names)("%s: matches its committed Outcome", async (name) => {
    await expect(runReplayFixture(makeContext(), loadFixture(name), loadExpectedOutcome(name)))
      .resolves.toEqual({ kind: "match" });
  });
});
