/**
 * The replay regression oracle's real corpus, run against the actual Bureaucracy campaign.
 *
 * Contract: `07-replay.md` §4, §6, §7.
 *
 * Mirrors `bulgaria-bureaucracy.determinism.test.ts`'s own split (W18): that suite proves a
 * build replays byte-identically against *itself*; this proves the current build still
 * produces the recorded `Outcome` for each committed fixture — a build against a *previous*
 * one, per 07 §1's own distinction. Lives beside the campaign, not under `core/replay/`,
 * for the same reason that suite does: the dependency-arrow lint rule (`eslint.config.js`)
 * forbids `src/core/**` from importing a kind at all, even in a test.
 *
 * `fixtures/replay/` holds plain JSON, not vitest snapshots (07 §4) — `vitest -u` would
 * rewrite every committed outcome in one keystroke, exactly the rubber-stamp regeneration
 * §7 exists to prevent.
 *
 * `REPLAY_BASELINE_DIR` is what turns this into the actual cross-*version* comparison 07 §1
 * distinguishes from a within-build self-check: W23's release-tag CI job points it at a
 * checkout of the *previous* tag's own `fixtures/replay/` — both the `.fixture.json` and the
 * `.outcome.json` together, not outcomes alone. Pulling only the previous tag's outcomes
 * while still reading this commit's fixture inputs would compare the current engine against
 * a fixture whose `submissions` may have since changed shape — not a clean version-to-version
 * comparison. Unset in the default run (every PR/push), where the baseline is simply this
 * commit's own committed corpus.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createEngine } from "../core/kernel/engine.js";
import { buildValidatedContentRegistry } from "../core/validation/tiered.js";
import { createInMemoryProfileStore } from "../core/session/profile-store.js";
import { storyGraphKind } from "../kinds/story-graph/kind.js";
import { createCountingIds } from "../core/determinism/counting-ids.js";
import { buildReplayOutcome, findDivergence, runReplayFixture, type ReplayRunnerContext } from "../core/replay/runner.js";
import type { Outcome, ReplayFixture } from "../core/replay/types.js";
import type { KindRegistry } from "../core/kernel/types.js";
import { buildBulgariaBureaucracyCampaign } from "./bulgaria-bureaucracy.js";

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

/** Every `bureaucracy-*.fixture.json` in the corpus, by name — new fixtures need no
 *  test-file edit to be picked up, only the committed pair of files (07 §4). In
 *  cross-version mode this is the *previous* tag's own fixture set, not the current
 *  commit's — a fixture added since then simply isn't enumerated here at all, and one
 *  removed since then still is, because both come from the same snapshot the outcomes do.
 *
 *  **The `bureaucracy-` prefix is load-bearing, not decorative, since W40.**
 *  `fixtures/replay/` is one shared, flat directory across every kind's own corpus — W22
 *  never anticipated a second kind landing fixtures beside its own. Filtering only by
 *  `.fixture.json` picked up `simulation`'s `stable-life-*` fixtures too, which then failed
 *  here with `unrunnable: campaign_withdrawn` (this registry only knows `story-graph`).
 *  `stable-life.replay.test.ts` mirrors this same prefix filter for its own corpus, so the
 *  two coexist in one directory without enumerating each other's fixtures. */
const FIXTURE_NAMES = readdirSync(CORPUS_DIR)
  .filter((f) => f.startsWith("bureaucracy-") && f.endsWith(".fixture.json"))
  .map((f) => f.slice(0, -".fixture.json".length))
  .sort();

/** A fresh `ReplayRunnerContext` per call — each fixture gets its own counting `IdSource`
 *  starting at 0 (07 §5) and its own in-memory `ProfileStore`, so achievements from one
 *  fixture never leak into another's. */
function makeContext(): ReplayRunnerContext {
  const built = buildBulgariaBureaucracyCampaign();
  if (!built.ok || !built.value) throw new Error("expected the real campaign to build");
  const kinds = { "story-graph": storyGraphKind } as unknown as KindRegistry;
  const registryResult = buildValidatedContentRegistry([built.value], kinds);
  if (!registryResult.ok || !registryResult.value) throw new Error("expected the real campaign to validate");

  return {
    engine: createEngine({ kinds, registry: registryResult.value, ids: createCountingIds() }),
    kinds,
    registry: registryResult.value,
    profiles: createInMemoryProfileStore(),
    profileId: REPLAY_PROFILE_ID,
  };
}

describe("the replay corpus (07-replay.md §4)", () => {
  it("the corpus is non-empty — every MVP §5 playable box has a fixture", () => {
    expect(FIXTURE_NAMES.length).toBeGreaterThan(0);
  });

  it.each(FIXTURE_NAMES)("%s: matches its committed Outcome", async (name) => {
    const fixture = loadFixture(name);
    const expected = loadExpectedOutcome(name);
    const verdict = await runReplayFixture(makeContext(), fixture, expected);
    expect(verdict).toEqual({ kind: "match" });
  });

  // Everything below is a mechanics check against this commit's own fixed fixture names,
  // not a cross-version comparison — skipped when comparing against an arbitrary previous
  // tag, which may not have (or may no longer name identically) these specific fixtures.
  // The it.each loop above is the whole of what cross-version mode needs.

  it.skipIf(COMPARING_ACROSS_VERSIONS)("bureaucracy-gated-choice: the gate rejects go_home, then continue_cycle x2 opens it", async () => {
    // The one fixture that is also 07 §6's own worked example: a rejected submission
    // followed by a later one that recovers — proof the runner doesn't stop at the
    // rejection (07 §6, "a rejected action does not stop the replay").
    const fixture = loadFixture("bureaucracy-gated-choice");
    const result = await buildReplayOutcome(makeContext(), fixture);
    if (result.kind !== "outcome") throw new Error("expected an outcome");

    expect(result.outcome.decisions[1]).toEqual({
      index: 1,
      seq: null,
      actionId: "go_home",
      accepted: false,
      reason: "requirement_unmet",
    });
    expect(result.outcome.finalStatus).toBe("ended");
  });

  it.skipIf(COMPARING_ACROSS_VERSIONS)("a hand-edited outcome produces diverged with the right at — the regression this oracle exists to catch", async () => {
    const fixture = loadFixture("bureaucracy-full-arc");
    const expected = loadExpectedOutcome("bureaucracy-full-arc");

    // Simulates exactly 07 §7's own example: a choice that used to succeed now gated.
    const handEdited: Outcome = {
      ...expected,
      decisions: expected.decisions.map((d, i) => (i === 3 ? { ...d, accepted: false, seq: null, reason: "requirement_unmet" } : d)),
    };

    const verdict = await runReplayFixture(makeContext(), fixture, handEdited);
    expect(verdict).toEqual({
      kind: "diverged",
      at: 3,
      capturedUnder: fixture.capturedUnder,
      expected: handEdited,
      actual: expect.objectContaining({ finalStatus: "ended" }),
    });
  });

  it.skipIf(COMPARING_ACROSS_VERSIONS)("reports unrunnable, not a crash, for a fixture whose campaign no longer exists", async () => {
    const fixture = loadFixture("bureaucracy-full-arc");
    const withdrawn: ReplayFixture = { ...fixture, config: { ...fixture.config, campaignId: "does-not-exist" } };

    const verdict = await runReplayFixture(makeContext(), withdrawn, loadExpectedOutcome("bureaucracy-full-arc"));
    expect(verdict).toEqual({ kind: "unrunnable", reason: "campaign_withdrawn" });
  });

  it.skipIf(COMPARING_ACROSS_VERSIONS)("reports unrunnable for a fixture pinned to a campaignVersion the registry no longer has", async () => {
    const fixture = loadFixture("bureaucracy-full-arc");
    const staleVersion: ReplayFixture = { ...fixture, campaignVersion: "0.0.1" };

    const verdict = await runReplayFixture(makeContext(), staleVersion, loadExpectedOutcome("bureaucracy-full-arc"));
    expect(verdict).toEqual({ kind: "unrunnable", reason: "campaign_version_missing" });
  });

  it.skipIf(COMPARING_ACROSS_VERSIONS)("findDivergence(expected, expected) is always undefined — a fixture never diverges from itself", async () => {
    for (const name of FIXTURE_NAMES) {
      const expected = loadExpectedOutcome(name);
      expect(findDivergence(expected, expected)).toBeUndefined();
    }
  });
});
