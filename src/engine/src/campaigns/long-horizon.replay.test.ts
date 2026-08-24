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
 * **One observation this unit's own out-of-scope line explicitly does not fix**:
 * `long-horizon-loss`'s `pendingEventResponses` grows from 0 to 37 over the run, because
 * its own weekly policy never answers one (`long-horizon.ts`'s policy is deliberately
 * inactive so the eviction arithmetic stays exact) — nothing in this kind expires an
 * unanswered `PendingEventResponse`. That is exactly the shape of defect W89 exists to be
 * the first thing able to see (`design/30-slices.md`'s own W89.6 callout); the ceiling
 * below is asserted as an observed fact of this fixture, not a claim that the collection is
 * actually bounded — see the flagged follow-up this PR names.
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
import { buildLongHorizonWinCampaign, buildLongHorizonLossCampaign } from "./long-horizon.js";
import { buildSimulationCampaign, type SimulationCampaignSource } from "../kinds/simulation/source.js";
import { buildCampaign } from "../core/registry/build.js";
import type { BuiltCampaign, Campaign } from "../core/registry/types.js";
import { CORPUS_DIR, FIXTURES_DIR, fixtureNamesByPrefix, loadExpectedOutcome, loadFixture } from "./replay-corpus.js";

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
  return {
    engine: createEngine({ kinds, registry: buildRegistry(), ids: createCountingIds() }),
    kinds,
    registry: buildRegistry(),
    profiles: createInMemoryProfileStore(),
    profileId: REPLAY_PROFILE_ID,
  };
}

const LONG_HORIZON_FIXTURE_NAMES = fixtureNamesByPrefix(PREFIX, FIXTURES_DIR);

// ---------------------------------------------------------------------------
// W89.1, W89.2 (in part), W89.7 — the corpus-match loop, mirroring every other kind's own
// ---------------------------------------------------------------------------

describe("the Long Horizon replay corpus (07-replay.md §4)", () => {
  it("this commit's own corpus is non-empty", () => {
    expect(LONG_HORIZON_FIXTURE_NAMES.length).toBeGreaterThan(0);
  });

  it.for(fixtureNamesByPrefix(PREFIX, CORPUS_DIR))("%s: matches its committed Outcome", async (name) => {
    const fixture = loadFixture(name);
    const expected = loadExpectedOutcome(name);
    const verdict = await runReplayFixture(makeContext(), fixture, expected);
    expect(verdict).toEqual({ kind: "match" });
  });

  it("long-horizon-win plays at least 150 weeks to a goals_met outcome", () => {
    const outcome = loadExpectedOutcome("long-horizon-win");
    expect(outcome.finalStatus).toBe("ended");
    expect(outcome.terminal).toEqual({ resolution: "goals_met", goalsMet: ["goal-established"], goalsFailed: [] });
  });

  it("long-horizon-loss plays at least 150 weeks to a failed outcome via the eviction ladder", () => {
    const outcome = loadExpectedOutcome("long-horizon-loss");
    expect(outcome.finalStatus).toBe("ended");
    expect(outcome.terminal).toEqual({ resolution: "failed", goalsMet: [], goalsFailed: ["goal-stay-housed"] });
  });
});

// ---------------------------------------------------------------------------
// Shared: play a fixture's submissions directly against a fresh engine, collecting the
// weekly count and the final `GameState` — every assertion below except the corpus loop
// and the determinism-harness replay needs the real `kindState`/`serialize()` output,
// which `Outcome` (07 §2) deliberately does not carry.
// ---------------------------------------------------------------------------

async function playFixture(name: string, ids?: IdSource) {
  const engine = createEngine({ kinds, registry: buildRegistry(), ...(ids ? { ids } : {}) });
  const fixture = loadFixture(name);
  const created = engine.createGame(fixture.config);
  if (!created.ok || !created.value) throw new Error(`${name}: expected createGame to succeed`);

  let state = created.value;
  let weeksPlayed = 0;
  const actionTypesResolved = new Set<string>();

  for (const submission of fixture.submissions) {
    const result = engine.submitAction(state, submission.actionId, submission.params);
    if (!result.ok || !result.value) throw new Error(`${name}: expected "${submission.actionId}" to be accepted`);
    state = result.value;
    if (submission.actionId === "end_week") weeksPlayed += 1;
    const actionType = submission.params?.["actionType"];
    if (submission.actionId === "plan.add" && typeof actionType === "string") actionTypesResolved.add(actionType);
  }

  return { engine, state, weeksPlayed, actionTypesResolved };
}

// ---------------------------------------------------------------------------
// W89.3 — every one of the 27 dispatched ActionTypes resolves at least once, combined
// across the two committed long runs, counted against RESOLVER_TABLE's own non-stub
// entries so the count moves on its own when P1 (start_project/work_on_project/
// start_business/operate_business) is answered.
// ---------------------------------------------------------------------------

describe("W89.3 — every dispatched ActionType resolves at least once", () => {
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
// W89.4 — each of the fourteen non-relationship end-of-week systems (`relationships` is
// the fifteenth, excluded per the decision recorded in `design/90-decisions.md`'s open
// register: no weekly relationship rule exists in the contract yet, so it can never emit
// anything beyond `system.ran`) is observed doing something at least once over the two
// runs, combined — a `system.ran` event alone does not count (10-simulation-kind.md's own
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

  if (state.status === "ended") { seen.add("goals"); seen.add("failure"); }
  return seen;
}

describe("W89.4 — each non-relationship end-of-week system is observed doing something", () => {
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

describe("W89.5 — byte-identical replay and a save/restore split", () => {
  it.for(["long-horizon-win", "long-horizon-loss"])("%s: the determinism harness replays byte-identically", (name) => {
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

  it.for(["long-horizon-win", "long-horizon-loss"])(
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

  it.for(["long-horizon-win", "long-horizon-loss"])("%s: replays identically under nullEmitter and a recordingEmitter", (name) => {
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

describe("W89.6 — serialized size and unbounded-collection counts, week one against final week", () => {
  it.for(["long-horizon-win", "long-horizon-loss"])("%s: week one is small and well under the stated ceiling", async (name) => {
    const engine = createEngine({ kinds, registry: buildRegistry() });
    const fixture = loadFixture(name);
    const created = engine.createGame(fixture.config);
    if (!created.ok || !created.value) throw new Error(`${name}: expected createGame to succeed`);

    const week1 = unboundedCollectionCounts(created.value.kindState as SimulationKindState);
    for (const count of Object.values(week1)) expect(count).toBeLessThanOrEqual(1);
    expect(engine.serialize(created.value).length).toBeLessThan(5_000);
  });

  it.for(["long-horizon-win", "long-horizon-loss"])("%s: the final week stays under a stated ceiling for every collection and the serialized size", async (name) => {
    const { engine, state } = await playFixture(name);
    const final = unboundedCollectionCounts(state.kindState as SimulationKindState);

    // A generous, stated ceiling per collection — not a claim every one of these is
    // actually bounded by contract. `pendingEventResponses` in particular is not: see
    // this file's own header for `long-horizon-loss`'s unanswered-response growth, the
    // exact shape of defect this ceiling exists to make visible rather than to excuse.
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
