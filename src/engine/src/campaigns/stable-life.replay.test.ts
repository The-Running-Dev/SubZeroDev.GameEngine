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
import type { HousingState } from "../kinds/simulation/actor.js";
import type { SimulationKindState } from "../kinds/simulation/state.js";
import { createCountingIds } from "../core/determinism/counting-ids.js";
import { runReplayFixture, type ReplayRunnerContext } from "../core/replay/runner.js";
import type { Outcome, ReplayFixture } from "../core/replay/types.js";
import type { KindRegistry } from "../core/kernel/types.js";
import { buildStableLifeCampaign } from "./stable-life.js";
import { buildStableLifeEffectsCampaign } from "./stable-life-effects.js";
import { buildStableLifeHousingCampaign } from "./stable-life-housing.js";

const FIXTURES_DIR = fileURLToPath(new URL("../../fixtures/replay/", import.meta.url));
const REPLAY_PROFILE_ID = "replay-oracle-profile";

const rawOverride = process.env.REPLAY_BASELINE_DIR;
const CORPUS_DIR = rawOverride ? `${rawOverride.replace(/[/\\]+$/, "")}/` : FIXTURES_DIR;

function loadFixture(name: string): ReplayFixture {
  return JSON.parse(readFileSync(`${CORPUS_DIR}${name}.fixture.json`, "utf8")) as ReplayFixture;
}

function loadExpectedOutcome(name: string): Outcome {
  return JSON.parse(readFileSync(`${CORPUS_DIR}${name}.outcome.json`, "utf8")) as Outcome;
}

function stableLifeFixtureNames(dir: string): string[] {
  return readdirSync(dir)
    .filter((f) => f.startsWith("stable-life-") && f.endsWith(".fixture.json"))
    .map((f) => f.slice(0, -".fixture.json".length))
    .sort();
}

/** Always this commit's own directory, never `CORPUS_DIR` — unlike the `it.each` loop
 *  below, "this commit shipped a non-empty corpus" is not a claim that gets weaker in
 *  cross-version mode, so it isn't allowed to skip there. A baseline tag predating this
 *  corpus (W40) legitimately has none, but that's a fact about the *baseline*, not about
 *  whether this commit's own corpus regressed to empty — the two must not share one
 *  skip condition, which is exactly what a prior version of this file got wrong. */
const CURRENT_STABLE_LIFE_FIXTURE_NAMES = stableLifeFixtureNames(FIXTURES_DIR);

/** Sourced from `CORPUS_DIR`, which is the baseline override in cross-version mode — the
 *  set actually replayed against below. */
const STABLE_LIFE_FIXTURE_NAMES = stableLifeFixtureNames(CORPUS_DIR);

/**
 * Registers `stable-life`, `stable-life-effects` (W51.6), and `stable-life-housing` (W55)
 * — a fixture's own `config.campaignId` picks which one it replays against; the filename
 * prefix scan above is what makes any of them part of "the Stable Life replay corpus"
 * regardless.
 */
function makeContext(): ReplayRunnerContext {
  const built = buildStableLifeCampaign();
  if (!built.ok || !built.value) throw new Error("expected the Stable Life fixture campaign to build");
  const builtEffects = buildStableLifeEffectsCampaign();
  if (!builtEffects.ok || !builtEffects.value) throw new Error("expected the Stable Life: Effects fixture campaign to build");
  const builtHousing = buildStableLifeHousingCampaign();
  if (!builtHousing.ok || !builtHousing.value) throw new Error("expected the Stable Life: Housing fixture campaign to build");
  const kinds = { simulation: simulationKind } as unknown as KindRegistry;
  const registryResult = buildValidatedContentRegistry([built.value, builtEffects.value, builtHousing.value], kinds);
  if (!registryResult.ok || !registryResult.value) throw new Error("expected the Stable Life fixture campaigns to validate");

  return {
    engine: createEngine({ kinds, registry: registryResult.value, ids: createCountingIds() }),
    kinds,
    registry: registryResult.value,
    profiles: createInMemoryProfileStore(),
    profileId: REPLAY_PROFILE_ID,
  };
}

describe("the Stable Life replay corpus (07-replay.md §4)", () => {
  // Non-empty, not an exact name list — matches bureaucracy's own "the corpus is
  // non-empty" test (07 §4): a new stable-life-* fixture needs only its committed
  // .fixture.json/.outcome.json pair, never a test-file edit to be picked up here.
  // Never skipped: this checks the current commit's own directory unconditionally, so a
  // same-commit regression (fixtures accidentally deleted) still fails even when running
  // in cross-version mode for an unrelated reason.
  it("this commit's own corpus is non-empty", () => {
    expect(CURRENT_STABLE_LIFE_FIXTURE_NAMES.length).toBeGreaterThan(0);
  });

  it.each(STABLE_LIFE_FIXTURE_NAMES)("%s: matches its committed Outcome", async (name) => {
    const fixture = loadFixture(name);
    const expected = loadExpectedOutcome(name);
    const verdict = await runReplayFixture(makeContext(), fixture, expected);
    expect(verdict).toEqual({ kind: "match" });
  });
});

/**
 * W55.6's two housing fixtures both produce an `Outcome` with active status, no
 * achievements, and a null terminal result regardless of `evictionStage` — none of
 * `Outcome`'s cross-version-stable fields (07-replay.md §2) depend on it, so the `it.each`
 * loop above proves the two fixtures replay byte-identically but not that eviction actually
 * diverges the way W55.6 requires. `evictionStage` lives in `kindState`, which `Outcome`
 * deliberately excludes (07 §2's own scope), so proving the requirement means driving each
 * fixture's submissions through the engine directly — the same one `buildReplayOutcome`
 * uses internally — and reading the final `HousingState` back off `GameState.kindState`.
 */
describe("W55.6 — the housing fixtures actually reach and avoid eviction", () => {
  async function finalHousing(fixtureName: string): Promise<HousingState> {
    const fixture = loadFixture(fixtureName);
    const ctx = makeContext();
    const created = ctx.engine.createGame(fixture.config);
    if (!created.ok || !created.value) throw new Error(`expected "${fixtureName}" to create a game`);

    let state = created.value;
    for (const submission of fixture.submissions) {
      const result = ctx.engine.submitAction(state, submission.actionId, submission.params);
      if (result.ok && result.value) state = result.value;
    }
    return (state.kindState as SimulationKindState).player.housing;
  }

  it("stable-life-housing-eviction reaches the evicted stage", async () => {
    const housing = await finalHousing("stable-life-housing-eviction");
    expect(housing.evictionStage).toBe("evicted");
  });

  it("stable-life-housing-avoiding-eviction never accrues arrears", async () => {
    const housing = await finalHousing("stable-life-housing-avoiding-eviction");
    expect(housing.evictionStage).toBe("none");
    expect(housing.overdueRentCents).toBe(0);
  });
});
