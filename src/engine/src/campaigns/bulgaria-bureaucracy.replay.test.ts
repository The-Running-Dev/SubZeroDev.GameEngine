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
 * `REPLAY_EXPECTED_OUTCOMES_DIR` is what turns this into the actual cross-*version*
 * comparison 07 §1 distinguishes from a within-build self-check: W23's release-tag CI job
 * points it at a checkout of the *previous* tag's `.outcome.json` files, so this build's
 * engine and this commit's fixtures are compared against a genuinely earlier build's
 * recorded outcomes. Unset in the default run (every PR/push), where "expected" is simply
 * this commit's own committed corpus.
 */

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
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

const rawOverride = process.env.REPLAY_EXPECTED_OUTCOMES_DIR;
const EXPECTED_OUTCOMES_DIR = rawOverride ? `${rawOverride.replace(/[/\\]+$/, "")}/` : FIXTURES_DIR;
const COMPARING_ACROSS_VERSIONS = EXPECTED_OUTCOMES_DIR !== FIXTURES_DIR;

function loadFixture(name: string): ReplayFixture {
  return JSON.parse(readFileSync(`${FIXTURES_DIR}${name}.fixture.json`, "utf8")) as ReplayFixture;
}

/**
 * `undefined` only in cross-version mode, for a fixture added since the comparison
 * target's tag — nothing to compare yet, not a failure, the same "not a failure" framing
 * `unrunnable` gets (07 §6). In the default (same-commit) mode a missing `.outcome.json`
 * beside an existing `.fixture.json` is a real authoring bug and still throws.
 */
function loadExpectedOutcome(name: string): Outcome | undefined {
  const path = `${EXPECTED_OUTCOMES_DIR}${name}.outcome.json`;
  if (COMPARING_ACROSS_VERSIONS && !existsSync(path)) return undefined;
  return JSON.parse(readFileSync(path, "utf8")) as Outcome;
}

/** For the direct (non-`it.each`) test cases below, which only ever run in default mode
 *  against this commit's own corpus — never `undefined` there. */
function requireExpectedOutcome(name: string): Outcome {
  const outcome = loadExpectedOutcome(name);
  if (!outcome) throw new Error(`no committed outcome for "${name}"`);
  return outcome;
}

/** Every `*.fixture.json` in the corpus, by name — new fixtures need no test-file edit to
 *  be picked up, only the committed pair of files (07 §4). */
const FIXTURE_NAMES = readdirSync(FIXTURES_DIR)
  .filter((f) => f.endsWith(".fixture.json"))
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
    const expected = loadExpectedOutcome(name);
    if (expected === undefined) return; // added since the comparison target — no baseline yet

    const fixture = loadFixture(name);
    const verdict = await runReplayFixture(makeContext(), fixture, expected);
    expect(verdict).toEqual({ kind: "match" });
  });

  it("bureaucracy-gated-choice: the gate rejects go_home, then continue_cycle x2 opens it", async () => {
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

  it("a hand-edited outcome produces diverged with the right at — the regression this oracle exists to catch", async () => {
    const fixture = loadFixture("bureaucracy-full-arc");
    const expected = requireExpectedOutcome("bureaucracy-full-arc");

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

  it("reports unrunnable, not a crash, for a fixture whose campaign no longer exists", async () => {
    const fixture = loadFixture("bureaucracy-full-arc");
    const withdrawn: ReplayFixture = { ...fixture, config: { ...fixture.config, campaignId: "does-not-exist" } };

    const verdict = await runReplayFixture(makeContext(), withdrawn, requireExpectedOutcome("bureaucracy-full-arc"));
    expect(verdict).toEqual({ kind: "unrunnable", reason: "campaign_withdrawn" });
  });

  it("reports unrunnable for a fixture pinned to a campaignVersion the registry no longer has", async () => {
    const fixture = loadFixture("bureaucracy-full-arc");
    const staleVersion: ReplayFixture = { ...fixture, campaignVersion: "0.0.1" };

    const verdict = await runReplayFixture(makeContext(), staleVersion, requireExpectedOutcome("bureaucracy-full-arc"));
    expect(verdict).toEqual({ kind: "unrunnable", reason: "campaign_version_missing" });
  });

  // Skipped in cross-version mode: this checks findDivergence's own reflexivity, not
  // anything specific to the previous tag's corpus, and not every fixture has a baseline
  // there (`requireExpectedOutcome` throws on purpose for a genuinely missing one).
  it.skipIf(COMPARING_ACROSS_VERSIONS)("findDivergence(expected, expected) is always undefined — a fixture never diverges from itself", async () => {
    for (const name of FIXTURE_NAMES) {
      const expected = requireExpectedOutcome(name);
      expect(findDivergence(expected, expected)).toBeUndefined();
    }
  });

});
