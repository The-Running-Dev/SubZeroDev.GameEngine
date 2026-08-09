/**
 * W57.1 — the last three non-stub resolvers: `respond_to_event`, `accept_opportunity`,
 * `decline_opportunity`, plus the standing guarantee that `"custom"` reaches resolution
 * nowhere.
 *
 * Contract: `10-simulation-kind.md` §2.3, §4.2, §5.1, §7.6, §7.9.
 */

import { describe, it, expect } from "vitest";
import {
  RESOLVER_TABLE,
  stubResolver,
  acceptOpportunityResolver,
  declineOpportunityResolver,
  respondToEventResolver,
} from "./resolvers.js";
import type { KindContext } from "../../core/kernel/types.js";
import type { SimulationCampaign } from "./campaign.js";
import type { EventDefinition, OpportunityDefinition } from "./content.js";
import type { GameAction } from "./plan.js";
import type { Opportunity, PendingEventResponse, SimulationKindState } from "./state.js";

const OPPORTUNITY: OpportunityDefinition = {
  id: "def-stall", kind: "business", targetId: "stall",
  nameKey: "k.n", descriptionKey: "k.d",
  durationWeeks: 2, weight: 1, requirements: [], contested: false, tags: [],
};

const EVENT: EventDefinition = {
  id: "event-letter", category: "test", titleKey: "k.t", descriptionKey: "k.d",
  weight: 1, conditions: { field: "calendar.currentWeek", operator: "greater_or_equal", value: 1 },
  choices: [
    { id: "c-open", labelKey: "k.c1", timeCost: 2, moneyCostCents: 500, outcomes: [{ outcome: { effects: [], messages: [] } }] },
    { id: "c-bin", labelKey: "k.c2", outcomes: [{ outcome: { effects: [], messages: [] } }] },
  ],
  tags: [],
};

function context(overrides: Partial<SimulationCampaign> = {}): KindContext {
  const content = { opportunities: [OPPORTUNITY], events: [EVENT], locations: [], ...overrides } as unknown as SimulationCampaign;
  return { campaign: { content } } as unknown as KindContext;
}

const STANDING: Opportunity = {
  id: "open-1", definitionId: "def-stall", kind: "business", targetId: "stall",
  offeredWeek: 3, expiresAtWeek: 8,
};

const PENDING: PendingEventResponse = {
  id: "pending-1", eventId: "event-letter", rolledWeek: 4, presentWeek: 5,
  availableChoiceIds: ["c-open", "c-bin"],
};

function state(overrides: Partial<SimulationKindState> = {}): SimulationKindState {
  return {
    calendar: { currentWeek: 5, currentYear: 1, totalTimeUnits: 14, committedTimeUnits: 0, spentTimeUnits: 0 },
    player: {
      needs: { health: 50, energy: 50, happiness: 50, stress: 50, satiety: 50 },
      finances: { cashCents: 10000 },
      flags: {}, counters: {}, skills: {}, inventory: [], relationships: [],
      career: { history: [], totalWeeksEmployed: 0, pendingApplications: [], highestTierAchieved: "entry" },
      housing: { weeklyCostCents: 0 },
      education: { enrollments: [], credentials: [], completedCourseIds: [], failedCourseIds: [] },
    } as unknown as SimulationKindState["player"],
    economy: {} as SimulationKindState["economy"],
    world: {} as SimulationKindState["world"],
    activeEffects: [],
    activeOpportunities: [STANDING],
    scheduledEvents: [],
    pendingEventResponses: [PENDING],
    goals: [],
    resolution: null,
    plan: null,
    ...overrides,
  };
}

function action(overrides: Partial<GameAction> = {}): GameAction {
  return { id: "a-1", type: "accept_opportunity", actorId: "player", parameters: {}, ...overrides };
}

describe("the three W57 resolvers are real, not stubs", () => {
  it.each(["accept_opportunity", "decline_opportunity", "respond_to_event"] as const)(
    "%s is wired to a resolver of its own",
    (type) => {
      expect(RESOLVER_TABLE[type]).not.toBe(stubResolver);
    },
  );

  it("leaves no stub behind for an action type this unit owns", () => {
    expect(RESOLVER_TABLE.accept_opportunity).toBe(acceptOpportunityResolver);
    expect(RESOLVER_TABLE.decline_opportunity).toBe(declineOpportunityResolver);
    expect(RESOLVER_TABLE.respond_to_event).toBe(respondToEventResolver);
  });

  it("has no entry for \"custom\" at all — the table's key type excludes it (§4.2)", () => {
    expect(Object.keys(RESOLVER_TABLE)).not.toContain("custom");
  });
});

describe("accept_opportunity", () => {
  it("accepts a standing offer and takes it off activeOpportunities", () => {
    const a = action({ targetId: "open-1" });
    const s = state();
    expect(acceptOpportunityResolver.canExecute(s, a, context()).valid).toBe(true);
    const outcome = acceptOpportunityResolver.calculate(s, a, context());
    expect(outcome.changes[0]).toMatchObject({ reason: "action_accept_opportunity", visible: true });
    expect(acceptOpportunityResolver.apply(s, outcome).activeOpportunities).toEqual([]);
  });

  it("rejects an opportunity id that is not standing", () => {
    const result = acceptOpportunityResolver.canExecute(state(), action({ targetId: "nope" }), context());
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.code).toBe("unknown_action");
  });

  it("rejects when a definition requirement is unmet, carrying that requirement's own code", () => {
    const gated: OpportunityDefinition = {
      ...OPPORTUNITY,
      requirements: [{
        type: "money",
        condition: { field: "player.finances.cashCents", operator: "greater_or_equal", value: 999999 },
        failureCode: "requirement_unmet",
        messageKey: "core.reason.requirement_unmet",
      }],
    };
    const result = acceptOpportunityResolver.canExecute(state(), action({ targetId: "open-1" }), context({ opportunities: [gated] }));
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.code).toBe("requirement_unmet");
  });
});

describe("decline_opportunity", () => {
  it("declines a standing offer, and is a distinct act from accepting it (§2.3)", () => {
    const a = action({ type: "decline_opportunity", targetId: "open-1" });
    const s = state();
    const outcome = declineOpportunityResolver.calculate(s, a, context());
    expect(outcome.changes[0]?.reason).toBe("action_decline_opportunity");
    expect(declineOpportunityResolver.apply(s, outcome).activeOpportunities).toEqual([]);
  });

  it("is not gated by the requirements accepting would demand", () => {
    const gated: OpportunityDefinition = {
      ...OPPORTUNITY,
      requirements: [{
        type: "money",
        condition: { field: "player.finances.cashCents", operator: "greater_or_equal", value: 999999 },
        failureCode: "requirement_unmet",
        messageKey: "core.reason.requirement_unmet",
      }],
    };
    const result = declineOpportunityResolver.canExecute(state(), action({ type: "decline_opportunity", targetId: "open-1" }), context({ opportunities: [gated] }));
    expect(result.valid).toBe(true);
  });

  it("rejects an offer that is not standing", () => {
    expect(declineOpportunityResolver.canExecute(state(), action({ type: "decline_opportunity", targetId: "gone" }), context()).valid).toBe(false);
  });
});

describe("respond_to_event", () => {
  const respond = (overrides: Record<string, unknown> = {}): GameAction =>
    action({ type: "respond_to_event", targetId: "pending-1", parameters: { choiceId: "c-open", ...overrides } });

  it("accepts a pending response with an offered choice, costing that choice's time and money", () => {
    const validation = respondToEventResolver.canExecute(state(), respond(), context());
    expect(validation).toMatchObject({ valid: true, calculatedTimeCost: 2, calculatedMoneyCostCents: 500 });
  });

  it("rejects a response id that is not pending", () => {
    const a = action({ type: "respond_to_event", targetId: "nope", parameters: { choiceId: "c-open" } });
    expect(respondToEventResolver.canExecute(state(), a, context()).errors[0]?.code).toBe("unknown_action");
  });

  it("rejects a choice the pending response does not offer", () => {
    const a = action({ type: "respond_to_event", targetId: "pending-1", parameters: { choiceId: "c-invented" } });
    expect(respondToEventResolver.canExecute(state(), a, context()).errors[0]?.code).toBe("action_not_available");
  });

  it("rejects a missing choiceId outright rather than picking one", () => {
    const a = action({ type: "respond_to_event", targetId: "pending-1", parameters: {} });
    expect(respondToEventResolver.canExecute(state(), a, context()).valid).toBe(false);
  });

  it("rejects a choice the player cannot afford in time", () => {
    const broke = state({ calendar: { ...state().calendar, spentTimeUnits: 13 } });
    expect(respondToEventResolver.canExecute(broke, respond(), context()).errors[0]?.code).toBe("insufficient_time");
  });

  it("rejects a choice the player cannot afford in money", () => {
    const broke = state({ player: { ...state().player, finances: { cashCents: 100 } } as SimulationKindState["player"] });
    expect(respondToEventResolver.canExecute(broke, respond(), context()).errors[0]?.code).toBe("insufficient_funds");
  });

  it("removes the pending response and books the answer as a scheduled event due this week", () => {
    const s = state();
    const outcome = respondToEventResolver.calculate(s, respond(), context());
    const next = respondToEventResolver.apply(s, outcome);

    expect(next.pendingEventResponses).toEqual([]);
    expect(next.scheduledEvents).toHaveLength(1);
    expect(next.scheduledEvents[0]).toMatchObject({
      eventId: "event-letter", scheduledWeek: 5, createdWeek: 5, payload: { choiceId: "c-open" },
    });
  });

  it("charges the choice's costs through apply, not just through validation", () => {
    const s = state();
    const next = respondToEventResolver.apply(s, respondToEventResolver.calculate(s, respond(), context()));
    expect(next.calendar.spentTimeUnits).toBe(2);
    expect(next.player.finances.cashCents).toBe(9500);
  });

  it("charges nothing for a free choice", () => {
    const s = state();
    const a = action({ type: "respond_to_event", targetId: "pending-1", parameters: { choiceId: "c-bin" } });
    const next = respondToEventResolver.apply(s, respondToEventResolver.calculate(s, a, context()));
    expect(next.calendar.spentTimeUnits).toBe(0);
    expect(next.player.finances.cashCents).toBe(10000);
  });
});
