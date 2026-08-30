/**
 * W57 — the four end-of-week systems this unit un-stubbed, plus the one it added.
 *
 * Contract: `10-simulation-kind.md` §2.3 (opportunity and scheduled-event lifecycles),
 * §3 (`END_WEEK_SYSTEM_ORDER`), §7.6, §7.9, §12.
 *
 * Kept in its own file rather than grown onto `endOfWeek.test.ts`: that file's `baseState`
 * is deliberately minimal (a `{}` cast for `economy`, empty content lists), and every test
 * here needs real `world` content, a real `RngHandle`, and campaign definitions. Sharing one
 * fixture builder across both would mean widening the older one for cases it does not have.
 */

import { describe, it, expect } from "vitest";
import { runEndOfWeek } from "./endOfWeek.js";
import { canonicalStringify } from "../../core/persistence/canonical.js";
import { rngHandleFor } from "../../core/determinism/rng.js";
import type { RngHandle } from "../../core/determinism/types.js";
import type { ResolutionEmitter } from "../../core/observability/types.js";
import type { Employment, NeedState } from "./actor.js";
import type {
  AchievementDefinition,
  EventDefinition,
  GoalDefinition,
  HeadlineDefinition,
  OpportunityDefinition,
} from "./content.js";
import type { GoalState, Opportunity, SimulationKindState } from "./state.js";

const NO_GOALS: readonly GoalDefinition[] = [];
const NEEDS: NeedState = { health: 50, energy: 50, happiness: 50, stress: 50, satiety: 50 };

function silentEmitter(): ResolutionEmitter {
  return { emit: () => undefined };
}

function rng(): RngHandle {
  return rngHandleFor("w57-seed", { kind: "system", system: "end_of_week", seq: 0 });
}

function baseState(overrides: Partial<SimulationKindState> = {}): SimulationKindState {
  return {
    calendar: { currentWeek: 5, currentYear: 1, totalTimeUnits: 14, committedTimeUnits: 0, spentTimeUnits: 0 },
    player: {
      needs: { ...NEEDS },
      career: { history: [], totalWeeksEmployed: 0, pendingApplications: [], highestTierAchieved: "entry" },
      housing: { weeklyCostCents: 0 },
      finances: { cashCents: 0 },
      education: { enrollments: [], credentials: [], completedCourseIds: [], failedCourseIds: [] },
      skills: {},
      flags: {},
      counters: {},
      inventory: [],
      relationships: [],
    } as unknown as SimulationKindState["player"],
    economy: {} as SimulationKindState["economy"],
    world: {
      npcs: [], locations: [], agents: [], flags: {},
      jobMarket: { openings: [] },
      eventCooldowns: {}, firedUniqueEvents: [], chainStates: [],
      strangenessBase: 0,
      headlinePool: { remainingIds: [], cyclesCompleted: 0 },
    },
    activeEffects: [],
    activeOpportunities: [],
    scheduledEvents: [],
    pendingEventResponses: [],
    goals: [],
    resolution: null,
    plan: null,
    ...overrides,
  };
}

function run(state: SimulationKindState, world: Parameters<typeof runEndOfWeek>[7]): ReturnType<typeof runEndOfWeek> {
  return runEndOfWeek(state, silentEmitter(), NO_GOALS, "goals_win", [], [], [], world);
}

// ---------------------------------------------------------------------------
// W57.7 — which systems are still stubs
// ---------------------------------------------------------------------------

describe("the stub ledger after W57 (W57.7)", () => {
  it("relationships is the only end-of-week system that still does nothing", () => {
    // Every other system has a test above (or in `endOfWeek.test.ts`) proving it moves
    // state given the content it needs. This pins the *negative* half: `relationships` is a
    // deliberate no-op because no weekly relationship rule exists in the contract to
    // implement — see its own definition site in `endOfWeek.ts`.
    const before = baseState({
      player: {
        ...baseState().player,
        relationships: [{ npcId: "npc-1", category: "friend", affinity: 40, trust: 40, respect: 40, resentment: 0, knownSinceWeek: 1, interactionCount: 3 }],
      } as unknown as SimulationKindState["player"],
    });
    const after = run(before, {});
    expect(after.state.player.relationships).toEqual(before.player.relationships);
  });

  it("history is absent from the order entirely rather than stubbed inside it", () => {
    // §2 does not adopt `history` as state, so there is nothing for a system to mutate;
    // skipping it is correct behaviour, not a missing implementation.
    const systems: string[] = [];
    const emit: ResolutionEmitter = {
      emit: (name, _severity, detail) => {
        if (name === "kind.simulation.system.ran") systems.push(String(detail?.data?.["system"]));
      },
    };
    runEndOfWeek(baseState(), emit, NO_GOALS, "goals_win");
    expect(systems).not.toContain("history");
  });
});

// ---------------------------------------------------------------------------
// W57.3 — the opportunities lifecycle: revoke and expire before offer
// ---------------------------------------------------------------------------

function opportunityDef(overrides: Partial<OpportunityDefinition> = {}): OpportunityDefinition {
  return {
    id: "def-stall",
    kind: "business",
    targetId: "stall",
    nameKey: "k.name",
    descriptionKey: "k.desc",
    durationWeeks: 2,
    weight: 1,
    requirements: [],
    contested: false,
    tags: [],
    ...overrides,
  };
}

function standing(overrides: Partial<Opportunity> = {}): Opportunity {
  return {
    id: "open-1", definitionId: "def-stall", kind: "business", targetId: "stall",
    offeredWeek: 4, expiresAtWeek: 9, ...overrides,
  };
}

describe("opportunities — §2.3's lifecycle (W57.3)", () => {
  it("expires an opportunity whose expiresAtWeek has arrived", () => {
    const state = baseState({ activeOpportunities: [standing({ expiresAtWeek: 5 })] });
    const result = run(state, { opportunities: [] });
    expect(result.state.activeOpportunities).toEqual([]);
    expect(result.changes.some((c) => c.reason === "opportunity_expired")).toBe(true);
  });

  it("keeps an opportunity whose expiresAtWeek is still ahead", () => {
    const state = baseState({ activeOpportunities: [standing({ expiresAtWeek: 6 })] });
    expect(run(state, { opportunities: [] }).state.activeOpportunities.map((o) => o.id)).toEqual(["open-1"]);
  });

  /** The one filling this engine can actually observe: the player took the position. A
   *  complete `Employment` rather than a cast-away partial — `employment`, `financeIncome`
   *  and `housing` all run over this state before `opportunities` does, and a missing
   *  `weeklyPayCents` alone is enough to settle the week's wages to `NaN`. */
  function employedIn(jobId: string): SimulationKindState["player"] {
    const base = baseState().player;
    const employment: Employment = {
      jobId,
      employerId: "emp-1",
      startedWeek: 1,
      performance: 50,
      attendanceRatio: 100,
      warnings: 0,
      weeklyPayCents: 50_000,
      weeksAtCurrentPay: 4,
    };
    return { ...base, career: { ...base.career, currentEmployment: employment } };
  }

  it("revokes a contested job offer whose target position the player now holds", () => {
    const state = baseState({
      player: employedIn("job-1"),
      activeOpportunities: [standing({ id: "open-job", kind: "job_offer", targetId: "job-1", definitionId: "def-job" })],
    });
    const result = run(state, { opportunities: [opportunityDef({ id: "def-job", kind: "job_offer", targetId: "job-1", contested: true })] });
    expect(result.state.activeOpportunities).toEqual([]);
    expect(result.changes.some((c) => c.reason === "opportunity_revoked")).toBe(true);
  });

  it("does not revoke a contested offer merely because the job market is empty", () => {
    // `world.jobMarket.openings` is written only by `search_for_work` — it is what *this
    // player has surfaced*, not a world market, and is empty until they look. Reading its
    // emptiness as "filled by a rival" revoked every unsolicited contested offer one week
    // after it was made, whatever its `durationWeeks`.
    const state = baseState({
      activeOpportunities: [standing({ id: "open-job", kind: "job_offer", targetId: "job-1", definitionId: "def-job" })],
    });
    const result = run(state, { opportunities: [opportunityDef({ id: "def-job", kind: "job_offer", targetId: "job-1", contested: true })] });
    expect(result.state.activeOpportunities.map((o) => o.id)).toEqual(["open-job"]);
    expect(result.changes.some((c) => c.reason === "opportunity_revoked")).toBe(false);
  });

  it("leaves a contested promotion standing — its target is never posted as an opening", () => {
    // A promotion target is reached through `JobDefinition.promotionPaths`, so it can never
    // appear in `openings` at all; the old rule made a contested promotion unable to survive
    // a single pass.
    const state = baseState({
      activeOpportunities: [standing({ id: "open-promo", kind: "promotion", targetId: "job-senior", definitionId: "def-promo" })],
    });
    const result = run(state, { opportunities: [opportunityDef({ id: "def-promo", kind: "promotion", targetId: "job-senior", contested: true })] });
    expect(result.state.activeOpportunities.map((o) => o.id)).toEqual(["open-promo"]);
  });

  it("does not revoke an uncontested offer even for a position the player now holds", () => {
    const state = baseState({
      player: employedIn("job-1"),
      activeOpportunities: [standing({ id: "open-job", kind: "job_offer", targetId: "job-1", definitionId: "def-job" })],
    });
    const result = run(state, { opportunities: [opportunityDef({ id: "def-job", kind: "job_offer", targetId: "job-1", contested: false })] });
    expect(result.state.activeOpportunities.map((o) => o.id)).toEqual(["open-job"]);
  });

  it("never offers a definition whose weight cannot be drawn — it does not throw either", () => {
    // `weightedPick` rejects any weight that is not a positive integer, so `weight: 0` (the
    // natural "scheduled-only, never rolls" authoring) would have thrown out of `advance`.
    const result = run(baseState(), { opportunities: [opportunityDef({ weight: 0 })], rng: rng() });
    expect(result.state.activeOpportunities).toEqual([]);
  });

  it("offers from the eligible pool, dated from the definition's durationWeeks", () => {
    const result = run(baseState(), { opportunities: [opportunityDef({ durationWeeks: 3 })], rng: rng() });
    expect(result.state.activeOpportunities).toHaveLength(1);
    expect(result.state.activeOpportunities[0]).toMatchObject({ definitionId: "def-stall", offeredWeek: 5, expiresAtWeek: 8 });
    expect(result.changes.some((c) => c.reason === "opportunity_offered")).toBe(true);
  });

  it("never offers a second copy of an opportunity already standing", () => {
    const state = baseState({ activeOpportunities: [standing()] });
    const result = run(state, { opportunities: [opportunityDef()], rng: rng() });
    expect(result.state.activeOpportunities).toHaveLength(1);
  });

  it("skips a definition whose conditions do not hold", () => {
    const def = opportunityDef({ conditions: { field: "calendar.currentWeek", operator: "greater_or_equal", value: 99 } });
    expect(run(baseState(), { opportunities: [def], rng: rng() }).state.activeOpportunities).toEqual([]);
  });

  it("an opportunity offered and expired within one week never becomes visible at all", () => {
    // `durationWeeks: 0` puts `expiresAtWeek` on the offering week itself. Revoke and expire
    // run *before* offer (§2.3), so nothing downstream would remove it this week — it must
    // never be added, or a client would show an offer the player provably cannot take.
    const result = run(baseState(), { opportunities: [opportunityDef({ durationWeeks: 0 })], rng: rng() });
    expect(result.state.activeOpportunities).toEqual([]);
    expect(result.changes.some((c) => c.reason === "opportunity_offered")).toBe(false);
  });

  it("frees a slot and refills it in the same week — the point of revoke/expire before offer", () => {
    const state = baseState({ activeOpportunities: [standing({ expiresAtWeek: 5 })] });
    const result = run(state, { opportunities: [opportunityDef({ durationWeeks: 2 })], rng: rng() });
    expect(result.state.activeOpportunities).toHaveLength(1);
    expect(result.state.activeOpportunities[0]!.offeredWeek).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// W57.2 — events: scheduled before random, and deferral to the following week
// ---------------------------------------------------------------------------

/** `exactOptionalPropertyTypes` is on, so a plain `Partial` would refuse an explicit
 *  `automaticOutcome: undefined` — which is exactly how a choice-bearing event is written
 *  here. This mapped type allows the explicit undefined without loosening the real type. */
type EventDefOverrides = { [K in keyof EventDefinition]?: EventDefinition[K] | undefined };

function eventDef(overrides: EventDefOverrides = {}): EventDefinition {
  const base: EventDefinition = {
    id: "event-1",
    category: "test",
    titleKey: "k.title",
    descriptionKey: "k.desc",
    weight: 1,
    conditions: { field: "calendar.currentWeek", operator: "greater_or_equal", value: 1 },
    unique: true,
    automaticOutcome: { effects: [], messages: [] },
    tags: [],
  };
  // `automaticOutcome: undefined` is a real instruction here ("this event has choices
  // instead"), so the spread must be allowed to erase it — hence the widened override type
  // and the assertion back, rather than a `Partial` that would reject the call outright.
  return { ...base, ...overrides } as EventDefinition;
}

describe("events — §2.3's firing order and deferred responses (W57.2)", () => {
  it("fires a due scheduled event and removes it from scheduledEvents", () => {
    const state = baseState({
      scheduledEvents: [{ id: "s-1", eventId: "event-1", scheduledWeek: 5, createdWeek: 3 }],
    });
    const result = run(state, { events: [eventDef()] });
    expect(result.state.scheduledEvents).toEqual([]);
    expect(result.state.world.eventCooldowns["event-1"]).toBe(5);
  });

  it("leaves a scheduled event alone until its week arrives", () => {
    const state = baseState({
      scheduledEvents: [{ id: "s-1", eventId: "event-1", scheduledWeek: 7, createdWeek: 3 }],
    });
    expect(run(state, { events: [eventDef()] }).state.scheduledEvents.map((s) => s.id)).toEqual(["s-1"]);
  });

  it("fires a due scheduled event unconditionally, even with its own conditions false", () => {
    // §2.3 rejects re-checking eligibility at fire time: it lets a multi-week chain break
    // silently in the middle, which is worse than an event firing on a stale premise.
    const def = eventDef({ conditions: { field: "calendar.currentWeek", operator: "greater_or_equal", value: 99 } });
    const state = baseState({
      scheduledEvents: [{ id: "s-1", eventId: "event-1", scheduledWeek: 5, createdWeek: 3 }],
    });
    expect(run(state, { events: [def] }).state.world.eventCooldowns["event-1"]).toBe(5);
  });

  it("fires scheduled events before rolling a random one", () => {
    const scheduled = eventDef({ id: "event-scheduled", conditions: { field: "calendar.currentWeek", operator: "greater_or_equal", value: 99 } });
    const rollable = eventDef({ id: "event-random" });
    const state = baseState({
      scheduledEvents: [{ id: "s-1", eventId: "event-scheduled", scheduledWeek: 5, createdWeek: 3 }],
    });
    const result = run(state, { events: [scheduled, rollable], rng: rng() });
    // Both fired; the scheduled one is provably first because it moved strangeness from a
    // base the random roll then moved again — two shifts, not one.
    expect(result.state.world.strangenessBase).toBe(10);
  });

  it("queues an event with choices as a PendingEventResponse for the NEXT week", () => {
    const def = eventDef({ automaticOutcome: undefined, choices: [{ id: "c-1", labelKey: "k.c1", outcomes: [{ outcome: { effects: [], messages: [] } }] }] });
    const result = run(baseState(), { events: [def], rng: rng() });
    expect(result.state.pendingEventResponses).toHaveLength(1);
    expect(result.state.pendingEventResponses[0]).toMatchObject({ eventId: "event-1", rolledWeek: 5, presentWeek: 6 });
  });

  it("never resolves a deferred response in the week it was queued", () => {
    const def = eventDef({ automaticOutcome: undefined, choices: [{ id: "c-1", labelKey: "k.c1", outcomes: [{ outcome: { effects: [{ target: "player.needs.stress", operation: "add", value: 10, sourceId: "event-1" }], messages: [] } }] }] });
    const result = run(baseState(), { events: [def], rng: rng() });
    // The choice's own effect must not have been applied — the player has not chosen yet.
    expect(result.state.activeEffects).toEqual([]);
  });

  it("respects cooldownWeeks — an event on cooldown is not rolled", () => {
    const def = eventDef({ unique: false, cooldownWeeks: 4 });
    const state = baseState({
      world: { ...baseState().world, eventCooldowns: { "event-1": 3 } },
    });
    expect(run(state, { events: [def], rng: rng() }).state.world.strangenessBase).toBe(0);
  });

  it("respects unique — an event already in firedUniqueEvents is not rolled again", () => {
    const state = baseState({
      world: { ...baseState().world, firedUniqueEvents: ["event-1"] },
    });
    expect(run(state, { events: [eventDef()], rng: rng() }).state.world.strangenessBase).toBe(0);
  });

  it("applies an automatic outcome's effects as an event-sourced StatusEffect", () => {
    const def = eventDef({ automaticOutcome: { effects: [{ target: "player.needs.happiness", operation: "subtract", value: 5, sourceId: "event-1" }], messages: [] } });
    const result = run(baseState(), { events: [def], rng: rng() });
    expect(result.state.activeEffects).toHaveLength(1);
    expect(result.state.activeEffects[0]).toMatchObject({ sourceKind: "event", sourceId: "event-1", appliedWeek: 5 });
  });

  it("survives a save/load round trip immediately after insertion (W95.2)", () => {
    const def = eventDef({ automaticOutcome: { effects: [{ target: "player.needs.happiness", operation: "subtract", value: 5, sourceId: "event-1" }], messages: [] } });
    const result = run(baseState(), { events: [def], rng: rng() });
    const restored = JSON.parse(canonicalStringify(result.state)) as SimulationKindState;
    expect(restored.activeEffects).toEqual(result.state.activeEffects);
  });

  it("a same-source refresh replaces the prior week's layer rather than stacking it (W95.1) — the defect this unit fixes: two firings of the same event definition in different weeks used to coexist because the old dedup key included the week", () => {
    const def = eventDef({
      unique: false,
      cooldownWeeks: 0,
      automaticOutcome: { effects: [{ target: "player.needs.happiness", operation: "subtract", value: 5, sourceId: "event-1" }], messages: [] },
    });
    const week5 = run(baseState(), { events: [def], rng: rng() });
    expect(week5.state.activeEffects).toHaveLength(1);
    const week9 = run(
      { ...week5.state, calendar: { ...week5.state.calendar, currentWeek: 9 } },
      { events: [def], rng: rng() },
    );
    expect(week9.state.activeEffects).toHaveLength(1);
    expect(week9.state.activeEffects[0]).toMatchObject({ sourceKind: "event", sourceId: "event-1", appliedWeek: 9 });
  });

  it("schedules a follow-up event from an outcome, inheriting the chain", () => {
    const def = eventDef({ chainId: "chain-a", chainStep: 1, automaticOutcome: { effects: [], messages: [], scheduledEvents: [{ eventId: "event-2", inWeeks: 2 }] } });
    const result = run(baseState(), { events: [def], rng: rng() });
    expect(result.state.scheduledEvents).toHaveLength(1);
    expect(result.state.scheduledEvents[0]).toMatchObject({ eventId: "event-2", scheduledWeek: 7, chainId: "chain-a", chainStep: 1 });
  });

  it("cancels a chain's pending scheduled events when an outcome ends it", () => {
    const def = eventDef({ chainId: "chain-a", automaticOutcome: { effects: [], messages: [], endsChain: true } });
    const state = baseState({
      scheduledEvents: [{ id: "s-later", eventId: "event-9", scheduledWeek: 8, createdWeek: 4, chainId: "chain-a" }],
    });
    expect(run(state, { events: [def], rng: rng() }).state.scheduledEvents).toEqual([]);
  });

  it("resolves an answered choice carried in on a scheduled event's payload", () => {
    const def = eventDef({
      automaticOutcome: undefined,
      choices: [{ id: "c-open", labelKey: "k.c", outcomes: [{ outcome: { effects: [{ target: "player.needs.stress", operation: "add", value: 5, sourceId: "event-1" }], messages: [] } }] }],
    });
    const state = baseState({
      scheduledEvents: [{ id: "answer-1", eventId: "event-1", scheduledWeek: 5, createdWeek: 5, payload: { choiceId: "c-open" } }],
    });
    const result = run(state, { events: [def] });
    expect(result.state.activeEffects).toHaveLength(1);
    // Answering is not a second firing: strangeness does not move again, and no new
    // `PendingEventResponse` is queued for the same event.
    expect(result.state.world.strangenessBase).toBe(0);
    expect(result.state.pendingEventResponses).toEqual([]);
  });

  it("skips a weight the RNG cannot draw instead of throwing out of the pass", () => {
    // `weightedPick` rejects any weight that is not a positive integer. `weight: 0` is the
    // natural way to author "this only ever fires when a chain schedules it" — unfiltered,
    // the first week its conditions held threw an Error out of `advance` entirely.
    const scheduledOnly = eventDef({ id: "event-chain-only", weight: 0 });
    expect(() => run(baseState(), { events: [scheduledOnly], rng: rng() })).not.toThrow();
    expect(run(baseState(), { events: [scheduledOnly], rng: rng() }).state.world.strangenessBase).toBe(0);
  });

  it("still fires an undrawable event when a chain schedules it — the whole point of weight 0", () => {
    const scheduledOnly = eventDef({ id: "event-chain-only", weight: 0 });
    const state = baseState({
      scheduledEvents: [{ id: "s-1", eventId: "event-chain-only", scheduledWeek: 5, createdWeek: 3 }],
    });
    expect(run(state, { events: [scheduledOnly], rng: rng() }).state.world.eventCooldowns["event-chain-only"]).toBe(5);
  });

  it("carries an outcome's authored messages out of the pass", () => {
    const def = eventDef({
      automaticOutcome: { effects: [], messages: [{ key: "k.power-cut", visible: true }] },
    });
    expect(run(baseState(), { events: [def], rng: rng() }).messages).toEqual([{ key: "k.power-cut", visible: true }]);
  });

  it("reports the derived value on the world.strangeness change, not the stored base", () => {
    // `world.strangeness` is a formula-only `DerivedPath`; a change named for it that
    // carried `strangenessBase` disagreed with `headline`'s own read two systems later.
    const state = baseState({
      activeEffects: [{
        id: "e-1", sourceId: "s", sourceKind: "system",
        modifiers: [{ target: "world.strangeness", operation: "add", value: 40, sourceId: "s" }],
        appliedWeek: 1, stacking: "refresh", descriptionKey: "k", visible: true,
      }],
    });
    const change = run(state, { events: [eventDef()], rng: rng() })
      .changes.find((c) => c.path === "world.strangeness");
    expect(change).toMatchObject({ value: 45, previous: 40 });
  });

  it("gives two events scheduling the same follow-up onto one week distinct ids", () => {
    // Sharing an id fired the follow-up twice and made `endsChain` cancellation ambiguous.
    const spec = { effects: [], messages: [], scheduledEvents: [{ eventId: "event-follow", inWeeks: 2 }] };
    const first = eventDef({ id: "event-a", automaticOutcome: spec });
    const second = eventDef({ id: "event-b", automaticOutcome: spec, conditions: { field: "calendar.currentWeek", operator: "greater_or_equal", value: 99 } });
    const state = baseState({
      scheduledEvents: [{ id: "s-1", eventId: "event-b", scheduledWeek: 5, createdWeek: 3 }],
    });
    const result = run(state, { events: [first, second], rng: rng() });
    const ids = result.state.scheduledEvents.map((s) => s.id);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });

  it("gives one definition's two firings in a single pass distinct ids too", () => {
    // `def.id` and the entry index are not enough on their own: two chains can schedule the
    // *same* follow-up onto one week, which is exactly what distinct ids above now allow, and
    // both entries then fire that one definition in a single pass. Without the firing
    // ordinal both firings mint the identical scheduled id.
    const def = eventDef({
      id: "event-follow",
      conditions: { field: "calendar.currentWeek", operator: "greater_or_equal", value: 99 },
      automaticOutcome: { effects: [], messages: [], scheduledEvents: [{ eventId: "event-x", inWeeks: 2 }] },
    });
    const state = baseState({
      scheduledEvents: [
        { id: "s-1", eventId: "event-follow", scheduledWeek: 5, createdWeek: 3 },
        { id: "s-2", eventId: "event-follow", scheduledWeek: 5, createdWeek: 3 },
      ],
    });
    const ids = run(state, { events: [def], rng: rng() }).state.scheduledEvents.map((s) => s.id);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });

  it("takes no random draw at all when no rng is supplied, but still fires scheduled events", () => {
    const state = baseState({
      scheduledEvents: [{ id: "s-1", eventId: "event-1", scheduledWeek: 5, createdWeek: 3 }],
    });
    const result = run(state, { events: [eventDef(), eventDef({ id: "event-2" })] });
    expect(result.state.world.strangenessBase).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// W57.4 — headline reads strangeness after events moved it
// ---------------------------------------------------------------------------

const QUIET: HeadlineDefinition = { id: "h-quiet", textKey: "k.quiet", maxStrangeness: 4, tags: [] };
const STRANGE: HeadlineDefinition = { id: "h-strange", textKey: "k.strange", minStrangeness: 5, tags: [] };

describe("headline — §3's ordering, made observable (W57.4)", () => {
  it("shows the quiet headline in a week where no event fired", () => {
    const result = run(baseState(), { events: [], headlines: [QUIET, STRANGE] });
    expect(result.state.world.headlinePool.shownThisWeek).toBe("h-quiet");
  });

  it("shows the strange headline in a week whose own event moved strangeness — the same state, one event apart", () => {
    const result = run(baseState(), { events: [eventDef()], headlines: [QUIET, STRANGE], rng: rng() });
    expect(result.state.world.strangenessBase).toBe(5);
    expect(result.state.world.headlinePool.shownThisWeek).toBe("h-strange");
  });

  it("reads derived strangeness, not the stored base — a modifier alone flips the headline", () => {
    const state = baseState({
      activeEffects: [{
        id: "e-1", sourceId: "s", sourceKind: "system",
        modifiers: [{ target: "world.strangeness", operation: "add", value: 40, sourceId: "s" }],
        appliedWeek: 1, stacking: "refresh", descriptionKey: "k", visible: true,
      }],
    });
    const result = run(state, { events: [], headlines: [QUIET, STRANGE] });
    expect(result.state.world.strangenessBase).toBe(0);
    expect(result.state.world.headlinePool.shownThisWeek).toBe("h-strange");
  });

  it("consumes the pool, then refills it and counts a completed cycle", () => {
    const a: HeadlineDefinition = { id: "h-a", textKey: "k.a", tags: [] };
    const b: HeadlineDefinition = { id: "h-b", textKey: "k.b", tags: [] };
    const first = run(baseState(), { headlines: [a, b] });
    expect(first.state.world.headlinePool).toMatchObject({ shownThisWeek: "h-a", remainingIds: ["h-b"], cyclesCompleted: 0 });

    const second = run(baseState({ world: first.state.world }), { headlines: [a, b] });
    expect(second.state.world.headlinePool).toMatchObject({ shownThisWeek: "h-b", remainingIds: [], cyclesCompleted: 0 });

    const third = run(baseState({ world: second.state.world }), { headlines: [a, b] });
    expect(third.state.world.headlinePool).toMatchObject({ shownThisWeek: "h-a", cyclesCompleted: 1 });
  });

  it("leaves the pool untouched when no headline is eligible and none was ever shown", () => {
    const result = run(baseState(), { headlines: [STRANGE] });
    expect(result.state.world.headlinePool.shownThisWeek).toBeUndefined();
  });

  it("clears last week's headline in a week with nothing eligible, rather than carrying it", () => {
    // `shownThisWeek` is named for the week it belongs to. Leaving it alone reported stale
    // news as current, and no projection can tell the two apart — the absence of a
    // `headline_shown` change is not something a client reads.
    const shown = run(baseState(), { headlines: [QUIET] });
    expect(shown.state.world.headlinePool.shownThisWeek).toBe("h-quiet");

    const quietWeek = run(baseState({ world: shown.state.world }), { headlines: [STRANGE] });
    expect(quietWeek.state.world.headlinePool.shownThisWeek).toBeUndefined();
    expect("shownThisWeek" in quietWeek.state.world.headlinePool).toBe(false);
  });

  it("counts the cycle when the quiet week clears a pool that was already spent", () => {
    // `shownThisWeek` is the only thing distinguishing a spent pool from the untouched one
    // `initial.ts` builds, and `firstFill` reads it. Clearing it without counting made the
    // next refill look like the first, silently losing a completed cycle.
    const a: HeadlineDefinition = { id: "h-a", textKey: "k.a", tags: [] };
    const b: HeadlineDefinition = { id: "h-b", textKey: "k.b", tags: [] };
    const w1 = run(baseState(), { headlines: [a, b] });
    const w2 = run(baseState({ world: w1.state.world }), { headlines: [a, b] });
    expect(w2.state.world.headlinePool).toMatchObject({ remainingIds: [], cyclesCompleted: 0 });

    const quiet = run(baseState({ world: w2.state.world }), { headlines: [STRANGE] });
    expect(quiet.state.world.headlinePool).toMatchObject({ remainingIds: [], cyclesCompleted: 1 });

    // The refill that follows does not count it a second time — the same total the same
    // three weeks reach without the quiet week in the middle.
    const w4 = run(baseState({ world: quiet.state.world }), { headlines: [a, b] });
    expect(w4.state.world.headlinePool).toMatchObject({ shownThisWeek: "h-a", cyclesCompleted: 1 });
  });

  it("does not count a cycle when the quiet week clears a pool with entries left", () => {
    const a: HeadlineDefinition = { id: "h-a", textKey: "k.a", tags: [] };
    const b: HeadlineDefinition = { id: "h-b", textKey: "k.b", tags: [] };
    const w1 = run(baseState(), { headlines: [a, b] });
    expect(w1.state.world.headlinePool).toMatchObject({ remainingIds: ["h-b"], cyclesCompleted: 0 });

    const quiet = run(baseState({ world: w1.state.world }), { headlines: [STRANGE] });
    expect(quiet.state.world.headlinePool).toMatchObject({ remainingIds: ["h-b"], cyclesCompleted: 0 });
  });
});

// ---------------------------------------------------------------------------
// W57.5 — achievements
// ---------------------------------------------------------------------------

function achievementDef(overrides: Partial<AchievementDefinition> = {}): AchievementDefinition {
  return {
    id: "ach-1",
    nameKey: "k.name",
    descriptionKey: "k.desc",
    condition: { field: "player.counters.need_drift", operator: "greater_or_equal", value: 1 },
    hidden: false,
    scope: "profile",
    ...overrides,
  };
}

describe("achievements — unlocking once, through the cross-kind StateChange (W57.5)", () => {
  it("emits an achievement_unlocked change at achieved.<id> when the condition holds", () => {
    const state = baseState({
      player: { ...baseState().player, counters: { need_drift: 3 } } as SimulationKindState["player"],
    });
    const result = run(state, { achievements: [achievementDef()] });
    const unlock = result.changes.find((c) => c.reason === "achievement_unlocked");
    expect(unlock).toMatchObject({ path: "achieved.ach-1", value: true, visible: true });
  });

  it("does not unlock while the condition is unmet", () => {
    const result = run(baseState(), { achievements: [achievementDef()] });
    expect(result.changes.some((c) => c.reason === "achievement_unlocked")).toBe(false);
  });

  it("treats an unwritten counter as zero rather than throwing", () => {
    // `player.counters` only gains a key once something of that kind has happened, so the
    // first week's evaluation would otherwise compare against `undefined`.
    expect(() => run(baseState(), { achievements: [achievementDef()] })).not.toThrow();
  });

  it("unlocks exactly once across repeated weeks", () => {
    const state = baseState({
      player: { ...baseState().player, counters: { need_drift: 3 } } as SimulationKindState["player"],
    });
    const first = run(state, { achievements: [achievementDef()] });
    expect(first.changes.filter((c) => c.reason === "achievement_unlocked")).toHaveLength(1);

    const second = run({ ...state, player: first.state.player }, { achievements: [achievementDef()] });
    expect(second.changes.filter((c) => c.reason === "achievement_unlocked")).toHaveLength(0);
  });

  it("lets one achievement's condition see another unlocked earlier in the same pass", () => {
    const state = baseState({
      player: { ...baseState().player, counters: { need_drift: 3 } } as SimulationKindState["player"],
    });
    const chained = achievementDef({
      id: "ach-2",
      condition: { field: "player.flags.achieved:ach-1", operator: "equals", value: true },
    });
    const result = run(state, { achievements: [achievementDef(), chained] });
    expect(result.changes.filter((c) => c.reason === "achievement_unlocked").map((c) => c.path))
      .toEqual(["achieved.ach-1", "achieved.ach-2"]);
  });
});

// ---------------------------------------------------------------------------
// W57.6 — week_limit and §12's precedence
// ---------------------------------------------------------------------------

function goal(status: GoalState["status"], definitionId = "goal-1"): GoalState {
  return { definitionId, status, satisfiedThisWeek: false, consecutiveWeeksSatisfied: 0, progressNotes: [] };
}

const ALWAYS: GoalDefinition = {
  id: "goal-1", labelKey: "k.l", descriptionKey: "k.d", category: "test",
  conditions: { field: "calendar.currentWeek", operator: "greater_or_equal", value: 1 },
};

const NEVER: GoalDefinition = {
  id: "goal-1", labelKey: "k.l", descriptionKey: "k.d", category: "test",
  conditions: { field: "calendar.currentWeek", operator: "greater_or_equal", value: 99 },
  failureConditions: { field: "calendar.currentWeek", operator: "greater_or_equal", value: 99 },
};

describe("week_limit — the third terminal path (W57.6)", () => {
  it("resolves week_limit_reached once the cap is reached with nothing else decided", () => {
    const state = baseState({ goals: [goal("active")] });
    const result = runEndOfWeek(state, silentEmitter(), [NEVER], "goals_win", [], [], [], { weekLimit: 5 });
    expect(result.state.resolution).toEqual({
      resolution: "week_limit_reached", goalsMet: [], goalsFailed: [], resolvedAtWeek: 5,
    });
  });

  it("stays null below the cap", () => {
    const state = baseState({ goals: [goal("active")] });
    const result = runEndOfWeek(state, silentEmitter(), [NEVER], "goals_win", [], [], [], { weekLimit: 9 });
    expect(result.state.resolution).toBeNull();
  });

  it("stays null forever when the scenario declares no weekLimit", () => {
    // Week 50, well past any cap a fixture would set, with a goal that still resolves
    // neither way — the only thing keeping `resolution` null is the absent `weekLimit`.
    const state = baseState({ goals: [goal("active")], calendar: { ...baseState().calendar, currentWeek: 50 } });
    expect(runEndOfWeek(state, silentEmitter(), [NEVER], "goals_win", [], [], [], {}).state.resolution).toBeNull();
  });

  it("goals_met wins a week that also exhausts the cap — §12's precedence", () => {
    const state = baseState({ goals: [goal("active")] });
    const result = runEndOfWeek(state, silentEmitter(), [ALWAYS], "goals_win", [], [], [], { weekLimit: 5 });
    expect(result.state.resolution).toMatchObject({ resolution: "goals_met", goalsMet: ["goal-1"] });
  });

  it("failed wins a week that also exhausts the cap — the more specific fact", () => {
    const failing: GoalDefinition = {
      ...ALWAYS,
      conditions: { field: "calendar.currentWeek", operator: "greater_or_equal", value: 99 },
      failureConditions: { field: "calendar.currentWeek", operator: "greater_or_equal", value: 1 },
    };
    const state = baseState({ goals: [goal("active")] });
    const result = runEndOfWeek(state, silentEmitter(), [failing], "goals_win", [], [], [], { weekLimit: 5 });
    expect(result.state.resolution).toMatchObject({ resolution: "failed", goalsFailed: ["goal-1"] });
  });

  it("never overwrites a resolution already decided in an earlier week", () => {
    const decided = baseState({
      goals: [goal("completed")],
      resolution: { resolution: "goals_met", goalsMet: ["goal-1"], goalsFailed: [], resolvedAtWeek: 2 },
    });
    const result = runEndOfWeek(decided, silentEmitter(), [ALWAYS], "goals_win", [], [], [], { weekLimit: 5 });
    expect(result.state.resolution).toMatchObject({ resolution: "goals_met", resolvedAtWeek: 2 });
  });

  it("resolves a scenario with no goals purely on the cap", () => {
    const result = runEndOfWeek(baseState(), silentEmitter(), NO_GOALS, "goals_win", [], [], [], { weekLimit: 5 });
    expect(result.state.resolution?.resolution).toBe("week_limit_reached");
  });

  it("resolves a session persisted before `resolution` existed, where the field is absent", () => {
    // `deserialize` is a bare `JSON.parse` with no migration step, so an older save comes
    // back with the key missing rather than `null`. A strict `!== null` guard read that
    // `undefined` as "already resolved" and short-circuited both `failure` and `week_limit`,
    // leaving the save permanently unwinnable and unlosable.
    const legacy = baseState();
    delete (legacy as Partial<SimulationKindState>).resolution;
    const result = runEndOfWeek(legacy, silentEmitter(), NO_GOALS, "goals_win", [], [], [], { weekLimit: 5 });
    expect(result.state.resolution?.resolution).toBe("week_limit_reached");
  });

  it("resolves goals on a legacy save too — `failure` carries the same guard", () => {
    const legacy = baseState({ goals: [goal("active")] });
    delete (legacy as Partial<SimulationKindState>).resolution;
    const result = runEndOfWeek(legacy, silentEmitter(), [ALWAYS], "goals_win", [], [], [], {});
    expect(result.state.resolution).toMatchObject({ resolution: "goals_met", goalsMet: ["goal-1"] });
  });

  it("achievements can see the final resolution, because week_limit ran first", () => {
    const onEnding = achievementDef({
      id: "ach-ending",
      condition: { field: "resolution.resolution", operator: "equals", value: "week_limit_reached" },
    });
    const result = runEndOfWeek(baseState(), silentEmitter(), NO_GOALS, "goals_win", [], [], [], { weekLimit: 5, achievements: [onEnding] });
    expect(result.changes.some((c) => c.path === "achieved.ach-ending")).toBe(true);
  });
});
