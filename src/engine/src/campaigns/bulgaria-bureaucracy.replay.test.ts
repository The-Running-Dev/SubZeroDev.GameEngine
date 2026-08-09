/**
 * The replay regression oracle's real corpus, run against the actual Bureaucracy campaign.
 *
 * Contract: `07-replay.md` §4, §6, §7.
 *
 * Mirrors `story-campaign-expansion.test.ts`'s own split (W64, which absorbed the earlier
 * per-campaign determinism suites): that suite proves a build replays byte-identically
 * against *itself*; this proves the current build still produces the recorded `Outcome` for
 * each committed fixture — a build against a *previous* one, per 07 §1's own distinction.
 * Lives beside the campaign, not under `core/replay/`, for the same reason that suite does:
 * the dependency-arrow lint rule (`eslint.config.js`) forbids `src/core/**` from importing a
 * kind at all, even in a test.
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
 *
 * `CORPUS_DIR`/`COMPARING_ACROSS_VERSIONS`/`loadFixture`/`loadExpectedOutcome`/fixture-name
 * enumeration are shared with every other kind's replay test file via `./replay-corpus.js` —
 * see that module's own doc comment for why this scaffolding doesn't need to live under
 * `core/replay/**` to be shared.
 */

import { describe, it, expect } from "vitest";
import { createEngine } from "../core/kernel/engine.js";
import { buildValidatedContentRegistry } from "../core/validation/tiered.js";
import { createInMemoryProfileStore } from "../core/session/profile-store.js";
import { storyGraphKind } from "../kinds/story-graph/kind.js";
import { createCountingIds } from "../core/determinism/counting-ids.js";
import { buildReplayOutcome, findDivergence, runReplayFixture, type ReplayRunnerContext } from "../core/replay/runner.js";
import type { Outcome, ReplayFixture } from "../core/replay/types.js";
import type { KindRegistry } from "../core/kernel/types.js";
import { buildBulgariaBureaucracyCampaign } from "./bulgaria-bureaucracy.js";
import {
  COMPARING_ACROSS_VERSIONS,
  CORPUS_DIR,
  FIXTURES_DIR,
  fixtureNamesByPrefix,
  loadExpectedOutcome,
  loadFixture,
  outcomeNamesByPrefix,
} from "./replay-corpus.js";

const REPLAY_PROFILE_ID = "replay-oracle-profile";

const FIXTURE_NAMES = fixtureNamesByPrefix("bureaucracy-", CORPUS_DIR);

/** Always this commit's own directory, never `CORPUS_DIR` — a membership claim about *this*
 *  commit's corpus must not weaken in cross-version mode, where `CORPUS_DIR` becomes the
 *  baseline tag's extracted directory and a mismatch there is a fact about the baseline, not
 *  about this commit. Same split `stable-life.replay.test.ts` makes between
 *  `CURRENT_STABLE_LIFE_FIXTURE_NAMES` and `STABLE_LIFE_FIXTURE_NAMES`. */
const CURRENT_BUREAUCRACY_FIXTURE_NAMES = fixtureNamesByPrefix("bureaucracy-", FIXTURES_DIR);

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

  // The corpus asserts its own membership (07 §4): directory enumeration alone doesn't
  // catch an orphaned file on either side — a `.fixture.json` committed with no matching
  // `.outcome.json`, or vice versa. Distinct from #189 (that drop was the whole test file
  // going missing, which no assertion inside this file could have caught; both fixture and
  // outcome files survived it unmatched to nothing). Always FIXTURES_DIR, for the same
  // reason CURRENT_BUREAUCRACY_FIXTURE_NAMES above is: a same-commit orphan must fail here
  // even when CORPUS_DIR is pointed at a baseline tag for the cross-version job.
  it("every bureaucracy-prefixed fixture has a matching committed outcome, and vice versa", () => {
    expect(CURRENT_BUREAUCRACY_FIXTURE_NAMES).toEqual(outcomeNamesByPrefix("bureaucracy-", FIXTURES_DIR));
  });

  it.for(FIXTURE_NAMES)("%s: matches its committed Outcome", async (name, ctx) => {
    const fixture = loadFixture(name);
    const expected = loadExpectedOutcome(name);
    const verdict = await runReplayFixture(makeContext(), fixture, expected);
    // 10-design.md §6: `unrunnable` is "not a failure" — a withdrawn campaign or a
    // campaignVersion the registry no longer has is a legitimate content decision between
    // engine versions, not a regression. That distinction only matters in cross-version mode:
    // this commit's own corpus (the default run) must always be runnable against this
    // commit's own build, so an `unrunnable` verdict there still fails the assertion below.
    ctx.skip(COMPARING_ACROSS_VERSIONS && verdict.kind === "unrunnable", `${name}: unrunnable against the baseline tag's corpus — not a regression (10-design.md §6)`);
    expect(verdict).toEqual({ kind: "match" });
  });
});

// Everything below is a mechanics check against this commit's own fixed fixture names, not a
// cross-version comparison — skipped when comparing against an arbitrary previous tag, whose
// same-named fixtures may hold entirely different content (submissions, gates, decision
// shapes) than the ones these assertions are hard-coded against. The it.each loop above is
// the whole of what cross-version mode needs.
describe.skipIf(COMPARING_ACROSS_VERSIONS)("the replay corpus's mechanics (07-replay.md §6, §7)", () => {
  it("bureaucracy-gated-choice: the gate rejects registry_route_call_in_favour, then registry_route_steady recovers", async () => {
    // The one fixture that is also 07 §6's own worked example: a rejected submission
    // followed by a later one that recovers — proof the runner doesn't stop at the
    // rejection (07 §6, "a rejected action does not stop the replay"). registry_route_3's
    // call_in_favour choice requires connections >= 1 (adventure-builder.ts), which this
    // fixture's route (push, then improvise) never grants.
    const fixture = loadFixture("bureaucracy-gated-choice");
    const result = await buildReplayOutcome(makeContext(), fixture);
    if (result.kind !== "outcome") throw new Error("expected an outcome");

    expect(result.outcome.decisions[5]).toEqual({
      index: 5,
      seq: null,
      actionId: "registry_route_call_in_favour",
      accepted: false,
      reason: "requirement_unmet",
    });
    expect(result.outcome.finalStatus).toBe("ended");
  });

  it("a hand-edited outcome produces diverged with the right at — the regression this oracle exists to catch", async () => {
    const fixture = loadFixture("bureaucracy-full-arc");
    const expected = loadExpectedOutcome("bureaucracy-full-arc");

    // Simulates exactly 07 §7's own example: a choice that used to succeed now gated.
    const handEdited: Outcome = {
      ...expected,
      decisions: expected.decisions.map((d, i) => (i === 4 ? { ...d, accepted: false, seq: null, reason: "requirement_unmet" } : d)),
    };

    const verdict = await runReplayFixture(makeContext(), fixture, handEdited);
    expect(verdict).toEqual({
      kind: "diverged",
      at: 4,
      capturedUnder: fixture.capturedUnder,
      expected: handEdited,
      actual: expect.objectContaining({ finalStatus: "ended" }),
    });
  });

  it("reports unrunnable, not a crash, for a fixture whose campaign no longer exists", async () => {
    const fixture = loadFixture("bureaucracy-full-arc");
    const withdrawn: ReplayFixture = { ...fixture, config: { ...fixture.config, campaignId: "does-not-exist" } };

    const verdict = await runReplayFixture(makeContext(), withdrawn, loadExpectedOutcome("bureaucracy-full-arc"));
    expect(verdict).toEqual({ kind: "unrunnable", reason: "campaign_withdrawn" });
  });

  it("reports unrunnable for a fixture pinned to a campaignVersion the registry no longer has", async () => {
    const fixture = loadFixture("bureaucracy-full-arc");
    const staleVersion: ReplayFixture = { ...fixture, campaignVersion: "0.0.1" };

    const verdict = await runReplayFixture(makeContext(), staleVersion, loadExpectedOutcome("bureaucracy-full-arc"));
    expect(verdict).toEqual({ kind: "unrunnable", reason: "campaign_version_missing" });
  });

  it("findDivergence(expected, expected) is always undefined — a fixture never diverges from itself", async () => {
    for (const name of FIXTURE_NAMES) {
      const expected = loadExpectedOutcome(name);
      expect(findDivergence(expected, expected)).toBeUndefined();
    }
  });
});
