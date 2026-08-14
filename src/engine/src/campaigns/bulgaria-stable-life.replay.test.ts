/**
 * The replay regression oracle's corpus, run against the Bulgarian resolution of "Stable
 * Life" (W72). Mirrors `stable-life.replay.test.ts`'s own structure — see that file's header
 * for why the scaffolding lives in `replay-corpus.ts` rather than being hand-copied per
 * kind/pack.
 *
 * **A dedicated context, not `stable-life.replay.test.ts`'s own `makeContext`.** That file's
 * registry is a flat array of standalone campaigns; the Bulgarian resolution instead needs
 * `resolvePacks` → `buildValidatedContentRegistry` (11 §3, `stable-life-packs.test.ts`'s own
 * `resolve` helper) because `campaignId: "stable-life"` is shared with the base pack — the
 * two can only coexist in one registry as one fold's winner, never as two array entries.
 *
 * `bulgaria-stable-life-win` (two weeks of `rest`, reaching the Well Rested goal — one fewer
 * week than the base pack's own three, since `startingEffects`' `effect-rakia-lek` adds a
 * temporary +10 energy the base pack doesn't carry) and `bulgaria-stable-life-loss` (four
 * weeks of nothing, tripping `failureConditions`) were both captured by running the real
 * engine once, not hand-typed.
 */

import { describe, it, expect } from "vitest";
import { createEngine } from "../core/kernel/engine.js";
import { buildValidatedContentRegistry } from "../core/validation/tiered.js";
import { createInMemoryProfileStore } from "../core/session/profile-store.js";
import { createCountingIds } from "../core/determinism/counting-ids.js";
import { runReplayFixture, type ReplayRunnerContext } from "../core/replay/runner.js";
import type { KindRegistry } from "../core/kernel/types.js";
import type { ContentRegistry } from "../core/registry/types.js";
import { simulationKind } from "../kinds/simulation/kind.js";
import { resolvePacks } from "../core/registry/packs.js";
import { stableLifeBasePack, bulgariaCulturePack } from "./stable-life-packs.js";
import {
  COMPARING_ACROSS_VERSIONS,
  CORPUS_DIR,
  FIXTURES_DIR,
  fixtureNamesByPrefix,
  loadExpectedOutcome,
  loadFixture,
} from "./replay-corpus.js";

const REPLAY_PROFILE_ID = "bulgaria-replay-oracle-profile";
const kinds = { simulation: simulationKind } as unknown as KindRegistry;

function resolveBulgarianRegistry(): ContentRegistry {
  const folded = resolvePacks([stableLifeBasePack, bulgariaCulturePack]);
  if (!folded.ok || !folded.value) throw new Error("expected the Bulgarian pack set to fold");
  const { campaigns, strings, resolution } = folded.value;
  if (resolution === undefined) throw new Error("expected the fold to name its resolution");

  const validated = buildValidatedContentRegistry(
    [...campaigns.values()].map((campaign) => ({ campaign, strings })),
    kinds,
  );
  if (!validated.ok || !validated.value) throw new Error("expected the folded registry to validate");

  return { ...validated.value, resolution };
}

function makeContext(): ReplayRunnerContext {
  return {
    engine: createEngine({ kinds, registry: resolveBulgarianRegistry(), ids: createCountingIds() }),
    kinds,
    registry: resolveBulgarianRegistry(),
    profiles: createInMemoryProfileStore(),
    profileId: REPLAY_PROFILE_ID,
  };
}

const CURRENT_BULGARIA_STABLE_LIFE_FIXTURE_NAMES = fixtureNamesByPrefix("bulgaria-stable-life-", FIXTURES_DIR);
const BULGARIA_STABLE_LIFE_FIXTURE_NAMES = fixtureNamesByPrefix("bulgaria-stable-life-", CORPUS_DIR);

describe("the Bulgarian Stable Life replay corpus (07-replay.md §4, W72.2)", () => {
  it("this commit's own corpus is non-empty", () => {
    expect(CURRENT_BULGARIA_STABLE_LIFE_FIXTURE_NAMES.length).toBeGreaterThan(0);
  });

  it.for(BULGARIA_STABLE_LIFE_FIXTURE_NAMES)("%s: matches its committed Outcome", async (name, ctx) => {
    const fixture = loadFixture(name);
    const expected = loadExpectedOutcome(name);
    const verdict = await runReplayFixture(makeContext(), fixture, expected);
    ctx.skip(COMPARING_ACROSS_VERSIONS && verdict.kind === "unrunnable", `${name}: unrunnable against the baseline tag's corpus — not a regression (10-design.md §6)`);
    expect(verdict).toEqual({ kind: "match" });
  });

  it("reaches goals_met and failed — the both-paths bar W40 set for stable-life (W72.2)", async () => {
    const win = loadExpectedOutcome("bulgaria-stable-life-win").terminal as { resolution: string };
    const loss = loadExpectedOutcome("bulgaria-stable-life-loss").terminal as { resolution: string };
    expect(win.resolution).toBe("goals_met");
    expect(loss.resolution).toBe("failed");
  });
});
