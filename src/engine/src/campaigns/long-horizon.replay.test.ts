/**
 * W89, "A Game-Length Life" — the long-horizon replay corpus, plus the assertions no
 * three-week fixture could ever make (`design/30-slices.md`'s own W89.1-W89.8).
 *
 * Contract: `07-replay.md` §4, §6, §7 (the corpus); `04-core.md` §14 (a build against
 * itself); `10-simulation-kind.md` §3 (the fifteen end-of-week systems), §13
 * (determinism), §12 (terminal identity).
 *
 * Mirrors `stable-life.replay.test.ts`'s own corpus-match loop (W89.1, W89.2 in part,
 * W89.7 for free from every other kind's corpus continuing to pass unchanged). Everything
 * below that loop is specific to this unit: W89.3 (action-type coverage), W89.4 (system
 * coverage), W89.5 (byte-identical replay, and a save/restore split matching a continuous
 * session), W89.6 (serialized size and unbounded-collection counts, week one against
 * final), and W89's own week_limit side-test (the fifteenth system, isolated per the
 * decision recorded in `long-horizon.ts`'s own header and in this unit's PR — neither
 * `long-horizon-win` nor `long-horizon-loss` can reach it without contradicting W89.2's
 * own two terminal paths).
 *
 * **W94 regenerated both fixtures.** The defect this file's own header used to flag here —
 * `long-horizon-loss`'s `pendingEventResponses` growing from 0 to 37 unanswered, because
 * nothing rejected `end_week` while one sat pending — is what `advance.ts`'s
 * `event_response_pending` gate (W94.1/W94.2) now closes. Both committed submission logs
 * were replayed through the gated engine and re-captured: every `PendingEventResponse` this
 * run generates is answered with a queued `respond_to_event` before the `end_week` that
 * would otherwise resolve it, `W94.5 — no pending response is ever bypassed` below is the
 * assertion that stayed unwritable before this unit, and `pendingEventResponses` in the
 * committed `.outcome.json` for both runs now ends at zero rather than accumulating.
 */

import { describe, it, expect } from "vitest";
import { createEngine } from "../core/kernel/engine.js";
import { buildValidatedContentRegistry } from "../core/validation/tiered.js";
import { createInMemoryProfileStore } from "../core/session/profile-store.js";
import { createCountingIds } from "../core/determinism/counting-ids.js";
import { createRecordingEmitter, nullEmitter } from "../core/observability/emitter.js";
import { runFixture, type PlaythroughFixture } from "../core/determinism/harness.js";
import { runReplayFixture, type ReplayRunnerContext } from "../core/replay/runner.js";
import type { KindRegistry, Engine } from "../core/kernel/types.js";
import type { IdSource } from "../core/composition/types.js";
import { simulationKind } from "../kinds/simulation/kind.js";
import { RESOLVER_TABLE, stubResolver } from "../kinds/simulation/resolvers.js";
import type { SimulationKindState } from "../kinds/simulation/state.js";
import { unaddressedPendingResponses } from "../kinds/simulation/state.js";
import { buildLongHorizonWinCampaign, buildLongHorizonLossCampaign } from "./long-horizon.js";
import { buildSimulationCampaign, type SimulationCampaignSource } from "../kinds/simulation/source.js";
import { buildCampaign } from "../core/registry/build.js";
import type { BuiltCampaign, Campaign } from "../core/registry/types.js";
import { COMPARING_ACROSS_VERSIONS, CORPUS_DIR, FIXTURES_DIR, fixtureNamesByPrefix, hasFixture, loadExpectedOutcome, loadFixture } from "./replay-corpus.js";

const REPLAY_PROFILE_ID = "long-horizon-replay-profile";
const PREFIX = "long-horizon-";

const kinds: KindRegistry = { simulation: simulationKind } as unknown as KindRegistry;

function buildRegistry() {
  const win = buildLongHorizonWinCampaign();
  const loss = buildLongHorizonLossCampaign();
  if (!win.ok || !win.value) throw new Error("expected the Long Horizon (Win) fixture campaign to build");
  if (!loss.ok || !loss.value) throw new Error("expected the Long Horizon (Loss) fixture campaign to build");
  const registryResult = buildValidatedContentRegistry([win.value, loss.value], kinds);
  if (!registryResult.ok || !registryResult.value) throw new Error("expected the Long Horizon fixture campaigns to validate");
  return registryResult.value;
}

function makeContext(): ReplayRunnerContext {
  // One registry, shared by the engine and the context — not two builds of the same
  // content, which is what `stable-life.replay.test.ts` does and what the runner assumes.
  const registry = buildRegistry();
  return {
    engine: createEngine({ kinds, registry, ids: createCountingIds() }),
    kinds,
    registry,
    profiles: createInMemoryProfileStore(),
    profileId: REPLAY_PROFILE_ID,
  };
}

/** Only meaningful when comparing across versions — in the default run `CORPUS_DIR` is this
 *  commit's own `FIXTURES_DIR`, so a missing fixture there is a real regression rather than
 *  the baseline tag predating W89, and must still fail loudly rather than skip. Mirrors
 *  `stable-life.replay.test.ts`'s own helper, for the reason its comment gives. */
function hasFixtureInBaseline(...names: string[]): boolean {
  return !COMPARING_ACROSS_VERSIONS || names.every((name) => hasFixture(name));
}

const BOTH_RUNS = ["long-horizon-win", "long-horizon-loss"];
const HAS_BOTH_RUNS = hasFixtureInBaseline(...BOTH_RUNS);

const LONG_HORIZON_FIXTURE_NAMES = fixtureNamesByPrefix(PREFIX, FIXTURES_DIR);

// ---------------------------------------------------------------------------
// W89.1, W89.2 (in part), W89.7 — the corpus-match loop, mirroring every other kind's own
// ---------------------------------------------------------------------------

describe("the Long Horizon replay corpus (07-replay.md §4)", () => {
  it("this commit's own corpus is non-empty", () => {
    expect(LONG_HORIZON_FIXTURE_NAMES.length).toBeGreaterThan(0);
  });

  it.for(fixtureNamesByPrefix(PREFIX, CORPUS_DIR))("%s: matches its committed Outcome", async (name, ctx) => {
    const fixture = loadFixture(name);
    const expected = loadExpectedOutcome(name);
    const verdict = await runReplayFixture(makeContext(), fixture, expected);
    // 10-design.md §6: `unrunnable` is "not a failure" between engine versions — only in
    // cross-version mode, where a withdrawn campaign or moved campaignVersion is a legitimate
    // content decision rather than a same-commit regression (see stable-life's own loop).
    ctx.skip(COMPARING_ACROSS_VERSIONS && verdict.kind === "unrunnable", `${name}: unrunnable against the baseline tag's corpus — not a regression (10-design.md §6)`);
    expect(verdict).toEqual({ kind: "match" });
  });

  // The week count is asserted from a real run, not from the committed `Outcome`: 07 §2's
  // cross-version-stable vocabulary carries `finalStatus`/`terminal`/`achievements` and no
  // notion of elapsed time at all, so "at least a hundred and fifty weeks" — the whole of
  // W89.1, and the only thing separating these two fixtures from every three-week one in
  // the corpus — is unprovable from the outcome file alone.
  it.skipIf(!HAS_BOTH_RUNS)("long-horizon-win plays at least 150 weeks to a goals_met outcome", async () => {
    const outcome = loadExpectedOutcome("long-horizon-win");
    expect(outcome.finalStatus).toBe("ended");
    expect(outcome.terminal).toEqual({ resolution: "goals_met", goalsMet: ["goal-established"], goalsFailed: [] });
    const { weeksPlayed } = await playFixture("long-horizon-win");
    expect(weeksPlayed).toBeGreaterThanOrEqual(150);
  });

  it.skipIf(!HAS_BOTH_RUNS)("long-horizon-loss plays at least 150 weeks to a failed outcome via the eviction ladder", async () => {
    const outcome = loadExpectedOutcome("long-horizon-loss");
    expect(outcome.finalStatus).toBe("ended");
    expect(outcome.terminal).toEqual({ resolution: "failed", goalsMet: [], goalsFailed: ["goal-stay-housed"] });
    const { weeksPlayed } = await playFixture("long-horizon-loss");
    expect(weeksPlayed).toBeGreaterThanOrEqual(150);
  });
});

// ---------------------------------------------------------------------------
// Shared: play a fixture's submissions directly against a fresh engine, collecting the
// weekly count and the final `GameState` — every assertion below except the corpus loop
// and the determinism-harness replay needs the real `kindState`/`serialize()` output,
// which `Outcome` (07 §2) deliberately does not carry.
// ---------------------------------------------------------------------------

/** `advance.ts`'s own per-resolved-action event (§5.3) — the only place the engine states
 *  which `ActionType`s a week's `end_week` actually put through a resolver. Not exported
 *  from `advance.ts`, but declared in `Kind.eventNames` (`kind.ts`), which is the contract
 *  surface a reader checks this string against. */
const ACTION_RESOLVED_EVENT = "kind.simulation.action.resolved";

async function playFixture(name: string) {
  // A recording emitter, so `actionTypesResolved` below is what the engine *resolved* and
  // not merely what the fixture planned: a `plan.add` a later `plan.remove`/`plan.clear`
  // takes back never reaches a resolver, and counting submissions would score it covered.
  // W89.5 below already proves recording changes no output.
  const emitter = createRecordingEmitter();
  const engine = createEngine({ kinds, registry: buildRegistry() }).withEmitter(emitter);
  const fixture = loadFixture(name);
  const created = engine.createGame(fixture.config);
  if (!created.ok || !created.value) throw new Error(`${name}: expected createGame to succeed`);

  let state = created.value;
  let weeksPlayed = 0;

  for (const submission of fixture.submissions) {
    const result = engine.submitAction(state, submission.actionId, submission.params);
    if (!result.ok || !result.value) throw new Error(`${name}: expected "${submission.actionId}" to be accepted`);
    state = result.value;
    if (submission.actionId === "end_week") weeksPlayed += 1;
  }

  const actionTypesResolved = new Set<string>();
  for (const event of emitter.events) {
    if (event.name !== ACTION_RESOLVED_EVENT) continue;
    const actionType = event.data?.["actionType"];
    if (typeof actionType === "string") actionTypesResolved.add(actionType);
  }

  return { engine, state, weeksPlayed, actionTypesResolved };
}

// ---------------------------------------------------------------------------
// W89.3 — every one of the 27 dispatched ActionTypes resolves at least once, combined
// across the two committed long runs, counted against RESOLVER_TABLE's own non-stub
// entries so the count moves on its own when P1 (start_project/work_on_project/
// start_business/operate_business) is answered.
// ---------------------------------------------------------------------------

describe.skipIf(!HAS_BOTH_RUNS)("W89.3 — every dispatched ActionType resolves at least once", () => {
  const NON_STUB_ACTION_TYPES = Object.entries(RESOLVER_TABLE)
    .filter(([, resolver]) => resolver !== stubResolver)
    .map(([actionType]) => actionType)
    .sort();

  it("RESOLVER_TABLE currently names 27 non-stub ActionTypes", () => {
    // Not the point of this test on its own — see the next one — but a stated number
    // catches RESOLVER_TABLE drifting silently out from under the coverage assertion.
    expect(NON_STUB_ACTION_TYPES.length).toBe(27);
  });

  it("the win and loss runs' resolved ActionTypes, combined, cover every non-stub entry", async () => {
    const win = await playFixture("long-horizon-win");
    const loss = await playFixture("long-horizon-loss");
    const combined = new Set([...win.actionTypesResolved, ...loss.actionTypesResolved]);
    expect([...combined].sort()).toEqual(NON_STUB_ACTION_TYPES);
  });
});

// ---------------------------------------------------------------------------
// W89.4 — thirteen of the fifteen end-of-week systems are observed doing something at
// least once over the two runs, combined. The two this block does not cover, counted off
// the list below rather than restated: `relationships`, excluded per the decision recorded
// in `design/90-decisions.md`'s open register (no weekly relationship rule exists in the
// contract yet, so it can never emit anything beyond `system.ran`), and `week_limit`, which
// neither long run can reach without contradicting W89.2 and so gets the isolated side test
// at the bottom of this file. Fourteen of fifteen across the file; thirteen here.
// A `system.ran` event alone does not count (10-simulation-kind.md's own
// W89.4 wording), so this reads the actual `StateChange.reason` vocabulary each system
// produces (`endOfWeek.ts`'s own header), not the trace event every system emits
// regardless. `employment` has no StateChange of its own, so it is read from a change in
// `player.career` instead. `goals`/`failure` both write into `state.resolution` (see
// `endOfWeek.ts`'s own doc comment on `failure`) — a game reaching `"ended"` proves both
// fired for real, not just that a goal was tracked.
// ---------------------------------------------------------------------------

const REASON_TO_SYSTEM: Readonly<Record<string, string>> = {
  education_course_failed: "education", education_course_completed: "education",
  education_skill_awarded: "education", education_credential_awarded: "education",
  wage_payment: "finance_income",
  item_condition_decayed: "inventory",
  rent_charged: "housing",
  rent_overdue: "finance_reconcile", eviction_advanced: "finance_reconcile",
  need_drift: "needs",
  opportunity_offered: "opportunities", opportunity_expired: "opportunities", opportunity_revoked: "opportunities",
  event_fired: "events", world_strangeness_shifted: "events",
  headline_shown: "headline",
  achievement_unlocked: "achievements",
};

const NON_RELATIONSHIP_NON_WEEK_LIMIT_SYSTEMS = [
  "employment", "education", "finance_income", "inventory", "housing", "finance_reconcile",
  "needs", "opportunities", "events", "headline", "goals", "failure", "achievements",
].sort();

async function observedSystems(name: string): Promise<Set<string>> {
  const engine = createEngine({ kinds, registry: buildRegistry() });
  const fixture = loadFixture(name);
  const created = engine.createGame(fixture.config);
  if (!created.ok || !created.value) throw new Error(`${name}: expected createGame to succeed`);

  let state = created.value;
  let lastCareer = JSON.stringify(state.kindState && (state.kindState as SimulationKindState).player.career);
  const seen = new Set<string>();

  for (const submission of fixture.submissions) {
    const result = engine.submitAction(state, submission.actionId, submission.params);
    if (!result.ok || !result.value) throw new Error(`${name}: expected "${submission.actionId}" to be accepted`);
    for (const change of result.changes) {
      const system = REASON_TO_SYSTEM[change.reason];
      if (system) seen.add(system);
    }
    state = result.value;
    const career = JSON.stringify((state.kindState as SimulationKindState).player.career);
    if (career !== lastCareer) { seen.add("employment"); lastCareer = career; }
  }

  const resolution = (state.kindState as SimulationKindState).resolution?.resolution;
  if (resolution === "goals_met") seen.add("goals");
  if (resolution === "failed") seen.add("failure");
  return seen;
}

describe.skipIf(!HAS_BOTH_RUNS)("W89.4 — each non-relationship end-of-week system is observed doing something", () => {
  it("the win and loss runs, combined, exercise all thirteen non-relationship, non-week_limit systems", async () => {
    const winSystems = await observedSystems("long-horizon-win");
    const lossSystems = await observedSystems("long-horizon-loss");
    const combined = new Set([...winSystems, ...lossSystems]);
    expect([...combined].sort()).toEqual(NON_RELATIONSHIP_NON_WEEK_LIMIT_SYSTEMS);
  });
});

// ---------------------------------------------------------------------------
// W89.5 — byte-identical replay (the determinism harness, 04 §14), and byte-identical
// output whether the same submissions run as one continuous session or as a save/restore
// split partway through.
// ---------------------------------------------------------------------------

const FIXED_IDS: IdSource = { newGameId: () => "long-horizon-fixed-game-id", newSeed: () => "long-horizon-fixed-seed" };

function toActionLog(submissions: readonly { actionId: string; params?: Record<string, unknown> }[]) {
  return submissions.map((submission, index) => ({
    seq: index,
    actionId: submission.actionId,
    ...(submission.params !== undefined ? { params: submission.params as Record<string, string | number | boolean> } : {}),
  }));
}

describe.skipIf(!HAS_BOTH_RUNS)("W89.5 — byte-identical replay and a save/restore split", () => {
  it.for(BOTH_RUNS)("%s: the determinism harness replays byte-identically", (name) => {
    const fixture = loadFixture(name);
    const playthrough: PlaythroughFixture = {
      name,
      config: fixture.config,
      actionLog: toActionLog(fixture.submissions),
    };
    const engineA = createEngine({ kinds, registry: buildRegistry(), ids: FIXED_IDS });
    const engineB = createEngine({ kinds, registry: buildRegistry(), ids: FIXED_IDS });
    expect(runFixture(engineA, playthrough)).toBe(runFixture(engineB, playthrough));
  });

  it.for(BOTH_RUNS)(
    "%s: one continuous session and a save/restore split partway through end byte-identical",
    async (name) => {
      const fixture = loadFixture(name);

      // Baseline: every submission, one continuous session.
      const baselineEngine = createEngine({ kinds, registry: buildRegistry(), ids: FIXED_IDS });
      const baselineCreated = baselineEngine.createGame(fixture.config);
      if (!baselineCreated.ok || !baselineCreated.value) throw new Error(`${name}: expected createGame to succeed`);
      let baselineState = baselineCreated.value;
      for (const submission of fixture.submissions) {
        const result = baselineEngine.submitAction(baselineState, submission.actionId, submission.params);
        if (!result.ok || !result.value) throw new Error(`${name}: expected "${submission.actionId}" to be accepted`);
        baselineState = result.value;
      }
      const baselineSerialized = baselineEngine.serialize(baselineState);

      // Split: same submissions, same seed/ids, but serialize()/deserialize() partway
      // through — proving nothing accumulated outside the serialized state itself.
      const splitAt = Math.floor(fixture.submissions.length / 2);
      const splitEngine = createEngine({ kinds, registry: buildRegistry(), ids: FIXED_IDS });
      const splitCreated = splitEngine.createGame(fixture.config);
      if (!splitCreated.ok || !splitCreated.value) throw new Error(`${name}: expected createGame to succeed`);
      let splitState = splitCreated.value;
      for (const submission of fixture.submissions.slice(0, splitAt)) {
        const result = splitEngine.submitAction(splitState, submission.actionId, submission.params);
        if (!result.ok || !result.value) throw new Error(`${name}: expected "${submission.actionId}" to be accepted`);
        splitState = result.value;
      }
      const saved = splitEngine.serialize(splitState);
      const restored = splitEngine.deserialize(saved);
      expect(restored.ok).toBe(true);
      let rehydratedState = restored.value!;
      for (const submission of fixture.submissions.slice(splitAt)) {
        const result = splitEngine.submitAction(rehydratedState, submission.actionId, submission.params);
        if (!result.ok || !result.value) throw new Error(`${name}: expected "${submission.actionId}" to be accepted`);
        rehydratedState = result.value;
      }

      expect(splitEngine.serialize(rehydratedState)).toBe(baselineSerialized);
    },
  );

  it.for(BOTH_RUNS)("%s: replays identically under nullEmitter and a recordingEmitter", (name) => {
    const fixture = loadFixture(name);
    const playthrough: PlaythroughFixture = { name, config: fixture.config, actionLog: toActionLog(fixture.submissions) };
    const withoutRecording = runFixture(createEngine({ kinds, registry: buildRegistry(), ids: FIXED_IDS }).withEmitter(nullEmitter), playthrough);
    const withRecording = runFixture(createEngine({ kinds, registry: buildRegistry(), ids: FIXED_IDS }).withEmitter(createRecordingEmitter()), playthrough);
    expect(withRecording).toBe(withoutRecording);
  });
});

// ---------------------------------------------------------------------------
// W89.6 — serialized size and the count of each unbounded collection, week one against
// the final week, committed with a stated ceiling.
// ---------------------------------------------------------------------------

function unboundedCollectionCounts(ks: SimulationKindState) {
  return {
    activeEffects: ks.activeEffects.length,
    activeOpportunities: ks.activeOpportunities.length,
    scheduledEvents: ks.scheduledEvents.length,
    pendingEventResponses: ks.pendingEventResponses.length,
    goals: ks.goals.length,
    pendingApplications: ks.player.career.pendingApplications.length,
    employmentHistory: ks.player.career.history.length,
    inventory: ks.player.inventory.length,
    relationships: ks.player.relationships.length,
    flagKeys: Object.keys(ks.player.flags).length,
    counterKeys: Object.keys(ks.player.counters).length,
    jobMarketOpenings: ks.world.jobMarket.openings.length,
  };
}

describe.skipIf(!HAS_BOTH_RUNS)("W89.6 — serialized size and unbounded-collection counts, week one against final week", () => {
  it.for(BOTH_RUNS)("%s: week one is small and well under the stated ceiling", async (name) => {
    const engine = createEngine({ kinds, registry: buildRegistry() });
    const fixture = loadFixture(name);
    const created = engine.createGame(fixture.config);
    if (!created.ok || !created.value) throw new Error(`${name}: expected createGame to succeed`);

    const week1 = unboundedCollectionCounts(created.value.kindState as SimulationKindState);
    for (const count of Object.values(week1)) expect(count).toBeLessThanOrEqual(1);
    expect(engine.serialize(created.value).length).toBeLessThan(5_000);
  });

  it.for(BOTH_RUNS)("%s: the final week stays under a stated ceiling for every collection and the serialized size", async (name) => {
    const { engine, state } = await playFixture(name);
    const final = unboundedCollectionCounts(state.kindState as SimulationKindState);

    // A generous, stated ceiling per collection — not a claim every one of these is
    // actually bounded by contract. `pendingEventResponses` stays well under it now that
    // W94.1's gate gets a response answered before another week can pass, unlike this
    // file's own header before W94 — every existing `PendingEventResponse` is answered the
    // same week it is presented, so this run never lets more than one accumulate at once.
    expect(final.activeEffects).toBeLessThanOrEqual(10);
    expect(final.activeOpportunities).toBeLessThanOrEqual(10);
    expect(final.scheduledEvents).toBeLessThanOrEqual(10);
    expect(final.pendingEventResponses).toBeLessThanOrEqual(50);
    expect(final.goals).toBeLessThanOrEqual(5);
    expect(final.pendingApplications).toBeLessThanOrEqual(10);
    expect(final.employmentHistory).toBeLessThanOrEqual(10);
    expect(final.inventory).toBeLessThanOrEqual(10);
    expect(final.relationships).toBeLessThanOrEqual(10);
    expect(final.flagKeys).toBeLessThanOrEqual(20);
    expect(final.counterKeys).toBeLessThanOrEqual(100);
    expect(final.jobMarketOpenings).toBeLessThanOrEqual(10);

    expect(engine.serialize(state).length).toBeLessThan(200_000);
  });
});

// ---------------------------------------------------------------------------
// W94.5 — the win and loss paths run their full length without ever bypassing a pending
// event response: every `end_week` in the recorded log happens with no unaddressed pending
// response, and every submission is accepted — the gate exists to reject, not to be dodged
// by a submission log that simply never triggers it, and not to be "passed" by a run in
// which nothing was accepted at all.
// ---------------------------------------------------------------------------

describe.skipIf(!HAS_BOTH_RUNS)("W94.5 — no pending response is ever bypassed", () => {
  it.for(BOTH_RUNS)("%s: every accepted end_week runs with no unaddressed pending response", async (name) => {
    const engine = createEngine({ kinds, registry: buildRegistry() });
    const fixture = loadFixture(name);
    const created = engine.createGame(fixture.config);
    if (!created.ok || !created.value) throw new Error(`${name}: expected createGame to succeed`);

    let state = created.value;
    let acceptedCount = 0;
    let endWeekCount = 0;

    for (const [index, submission] of fixture.submissions.entries()) {
      if (submission.actionId === "end_week") {
        // The gate's own condition (`unaddressedPendingResponses`, `state.ts`) — not "no
        // pending at all": a response presented this week is legitimately still in
        // `pendingEventResponses` right up until this same `end_week` resolves the queued
        // `respond_to_event` that answers it. Imported rather than re-implemented here, so
        // this asserts against the gate the engine actually applies.
        expect(unaddressedPendingResponses(state.kindState as SimulationKindState)).toEqual([]);
        endWeekCount += 1;
      }
      const result = engine.submitAction(state, submission.actionId, submission.params);
      // Refusing to swallow a rejection is what stops the three closing expectations passing
      // vacuously: an engine that rejected the whole log would leave `state` at
      // `createGame`'s own empty `pendingEventResponses`, leave `endWeekCount` counting
      // submissions rather than acceptances, and still satisfy every one of them.
      if (!result.ok || !result.value) {
        throw new Error(`${name}: submission ${index} (${submission.actionId}) was rejected as ${result.errors[0]?.code ?? "unknown"}`);
      }
      state = result.value;
      acceptedCount += 1;
    }

    expect(acceptedCount).toBe(fixture.submissions.length);
    expect(endWeekCount).toBeGreaterThanOrEqual(150);
    expect((state.kindState as SimulationKindState).pendingEventResponses).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// The fifteenth system, isolated — `week_limit` cannot fire within either 150-week run
// without contradicting W89.2's own two terminal paths (goals_met, and failed via the
// eviction ladder), so it gets its own short, non-corpus fixture here, the same
// direct-`submitAction` technique `stable-life.replay.test.ts`'s own W55.6 describe block
// uses. Not registered in the replay corpus — this proves the mechanism, not a long run.
// ---------------------------------------------------------------------------

const WEEK_LIMIT_CAMPAIGN_ID = "long-horizon-week-limit-side-test";

function buildWeekLimitCampaign(): BuiltCampaign {
  const source: SimulationCampaignSource = {
    description: { key: "long-horizon-week-limit.campaign.description", text: "A short scenario, solely to prove week_limit_reached." },
    jobs: [], courses: [], items: [], events: [], npcs: [], opportunities: [], achievements: [], headlines: [],
    difficulties: [], traits: [], skills: [],
    housing: [{
      id: "housing-free",
      name: { key: "long-horizon-week-limit.housing.free.name", text: "Free Housing" },
      description: { key: "long-horizon-week-limit.housing.free.description", text: "No rent, so nothing here can end the game but the week limit." },
      upfrontCostCents: 0, weeklyCostCents: 0,
      capacity: 1, comfort: 50, safety: 50, prestige: 0, storage: 0,
      commuteModifier: 0, energyRecoveryModifier: 0, happinessModifier: 0, healthModifier: 0,
      maintenanceRisk: 0, requirements: [], tags: [],
    }],
    employers: [],
    locations: [{
      id: "home",
      name: { key: "long-horizon-week-limit.location.home.name", text: "Home" },
      description: { key: "long-horizon-week-limit.location.home.description", text: "Where the week starts and ends." },
      connections: [], travelTimeUnits: 0, actionTypes: ["eat", "rest"],
    }],
    backgrounds: [{
      id: "background-default",
      name: { key: "long-horizon-week-limit.background.default.name", text: "A Fresh Start" },
      description: { key: "long-horizon-week-limit.background.default.description", text: "No particular head start, no particular deficit." },
      startingAttributes: { intelligence: 50, discipline: 50, charisma: 50, creativity: 50, resilience: 50, wisdom: 50, luck: 50 },
      startingSkills: {}, startingCredentials: [], startingTraits: [], startingCashModifierCents: 0,
    }],
    // `goals: []` — the same "nothing here can resolve the game first" reasoning
    // `stable-life-housing.ts`'s own header gives for its identical choice — so the only
    // way this scenario ever reaches `"ended"` is `week_limit_reached`.
    goals: [],
    scenarios: [{
      id: "scenario-week-limit",
      name: { key: "long-horizon-week-limit.scenario.name", text: "Week Limit Side Test" },
      description: { key: "long-horizon-week-limit.scenario.description", text: "Three weeks, and nothing else that could end it first." },
      startingBackgroundIds: ["background-default"],
      startingCashCents: 0, startingHousingId: "housing-free", startingLocationId: "home",
      startingInventory: [], goalIds: [], weekLimit: 3, mode: "classic", goalFailurePrecedence: "goals_win",
    }],
    scenarioId: "scenario-week-limit",
    goalFailurePrecedence: "goals_win",
    sceneTemplate: { key: "long-horizon-week-limit.scene.status", text: "Week {week}." },
    actionLabels: {
      planAdd: { key: "long-horizon-week-limit.action.plan-add.label", text: "Add to plan" },
      planRemove: { key: "long-horizon-week-limit.action.plan-remove.label", text: "Remove from plan" },
      planClear: { key: "long-horizon-week-limit.action.plan-clear.label", text: "Clear plan" },
      endWeek: { key: "long-horizon-week-limit.action.end-week.label", text: "End week" },
    },
  };

  const { content, authoredText } = buildSimulationCampaign(source);
  const campaign: Campaign = { id: WEEK_LIMIT_CAMPAIGN_ID, kindId: "simulation", version: "1.0.0", titleKey: "long-horizon-week-limit.campaign.title", content };
  const built = buildCampaign(campaign, [{ key: "long-horizon-week-limit.campaign.title", text: "Week Limit Side Test" }, ...authoredText]);
  if (!built.ok || !built.value) throw new Error(`expected the week_limit side-test campaign to build — ${JSON.stringify(built.errors)}`);
  return built.value;
}

describe("the fifteenth system, isolated — week_limit_reached", () => {
  it("a scenario with no goals and a weekLimit of 3 resolves week_limit_reached at week 3", () => {
    const registryResult = buildValidatedContentRegistry([buildWeekLimitCampaign()], kinds);
    if (!registryResult.ok || !registryResult.value) throw new Error("expected the week_limit side-test campaign to validate");
    const engine: Engine = createEngine({ kinds, registry: registryResult.value });

    const created = engine.createGame({ campaignId: WEEK_LIMIT_CAMPAIGN_ID, seed: "week-limit-seed" });
    if (!created.ok || !created.value) throw new Error("expected the week_limit side-test to create a game");

    let state = created.value;
    for (let week = 1; week <= 3; week++) {
      const result = engine.submitAction(state, "end_week");
      if (!result.ok || !result.value) throw new Error(`expected week ${week}'s end_week to be accepted`);
      state = result.value;
    }

    expect(state.status).toBe("ended");
    const kindState = state.kindState as SimulationKindState;
    expect(kindState.resolution).toEqual({
      resolution: "week_limit_reached", goalsMet: [], goalsFailed: [], resolvedAtWeek: 3,
    });
  });
});
