/**
 * The replay regression oracle's corpus, run against the "Stable Life" fixture campaign.
 *
 * Contract: `07-replay.md` §4, §6, §7.
 *
 * Mirrors `bulgaria-bureaucracy.replay.test.ts`'s own structure exactly (same reasons: a
 * committed `Outcome` per fixture, not a vitest snapshot; `REPLAY_BASELINE_DIR` is what
 * turns this into the cross-*version* comparison 07 §1 distinguishes from a within-build
 * check). The mechanics checks that suite adds beyond the core `it.each` loop — a rejected
 * submission that still lets the replay continue, a hand-edited outcome producing
 * `diverged`, `unrunnable` for a withdrawn/mismatched campaign — are runner-level behavior
 * already covered there; this file doesn't duplicate them per kind.
 *
 * Two fixtures: `stable-life-win` (three weeks of `rest`, completing the "Well Rested"
 * goal — the two-consecutive-week persistence requirement `endOfWeek.ts`'s `goals` system
 * implements is what makes three weeks, not two, the actual proof) and `stable-life-loss`
 * (four weeks of nothing, tripping `failureConditions`). Both were captured by running the
 * real engine once, not hand-typed — `seq` numbering in particular depends on
 * `createCountingIds()`'s own behavior, not arithmetic worth re-deriving by hand.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createEngine } from "../core/kernel/engine.js";
import { buildValidatedContentRegistry } from "../core/validation/tiered.js";
import { createInMemoryProfileStore } from "../core/session/profile-store.js";
import { simulationKind } from "../kinds/simulation/kind.js";
import { createCountingIds } from "../core/determinism/counting-ids.js";
import { runReplayFixture, type ReplayRunnerContext } from "../core/replay/runner.js";
import type { Outcome, ReplayFixture } from "../core/replay/types.js";
import type { KindRegistry } from "../core/kernel/types.js";
import { buildStableLifeCampaign } from "./stable-life.js";

const FIXTURES_DIR = fileURLToPath(new URL("../../fixtures/replay/", import.meta.url));
const REPLAY_PROFILE_ID = "replay-oracle-profile";

const rawOverride = process.env.REPLAY_BASELINE_DIR;
const CORPUS_DIR = rawOverride ? `${rawOverride.replace(/[/\\]+$/, "")}/` : FIXTURES_DIR;
const COMPARING_ACROSS_VERSIONS = CORPUS_DIR !== FIXTURES_DIR;

function loadFixture(name: string): ReplayFixture {
  return JSON.parse(readFileSync(`${CORPUS_DIR}${name}.fixture.json`, "utf8")) as ReplayFixture;
}

function loadExpectedOutcome(name: string): Outcome {
  return JSON.parse(readFileSync(`${CORPUS_DIR}${name}.outcome.json`, "utf8")) as Outcome;
}

const STABLE_LIFE_FIXTURE_NAMES = readdirSync(CORPUS_DIR)
  .filter((f) => f.startsWith("stable-life-") && f.endsWith(".fixture.json"))
  .map((f) => f.slice(0, -".fixture.json".length))
  .sort();

function makeContext(): ReplayRunnerContext {
  const built = buildStableLifeCampaign();
  if (!built.ok || !built.value) throw new Error("expected the Stable Life fixture campaign to build");
  const kinds = { simulation: simulationKind } as unknown as KindRegistry;
  const registryResult = buildValidatedContentRegistry([built.value], kinds);
  if (!registryResult.ok || !registryResult.value) throw new Error("expected the Stable Life fixture campaign to validate");

  return {
    engine: createEngine({ kinds, registry: registryResult.value, ids: createCountingIds() }),
    kinds,
    registry: registryResult.value,
    profiles: createInMemoryProfileStore(),
    profileId: REPLAY_PROFILE_ID,
  };
}

describe("the Stable Life replay corpus (07-replay.md §4)", () => {
  // Skipped in cross-version mode: a baseline tag predating this corpus (W40) has neither
  // fixture, and that is a legitimate transition (07 §8), not a regression — the it.each
  // below simply runs zero cases against such a baseline, which is not itself a failure.
  it.skipIf(COMPARING_ACROSS_VERSIONS)("both fixtures are present", () => {
    expect(STABLE_LIFE_FIXTURE_NAMES).toEqual(["stable-life-loss", "stable-life-win"]);
  });

  it.each(STABLE_LIFE_FIXTURE_NAMES)("%s: matches its committed Outcome", async (name) => {
    const fixture = loadFixture(name);
    const expected = loadExpectedOutcome(name);
    const verdict = await runReplayFixture(makeContext(), fixture, expected);
    expect(verdict).toEqual({ kind: "match" });
  });
});
