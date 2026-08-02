import { describe, it, expect } from "vitest";
import { initialState } from "./initial.js";
import type { SimulationCampaign } from "./campaign.js";
import type { Campaign } from "../../core/registry/types.js";
import type { CalendarState, EconomyState, WorldState } from "./state.js";
import type { PlayerState } from "./actor.js";
import type { GoalDefinition } from "./content.js";

const startingCalendar: CalendarState = {
  currentWeek: 1,
  currentYear: 1,
  totalTimeUnits: 14,
  committedTimeUnits: 0,
  spentTimeUnits: 0,
};

const startingPlayer: PlayerState = {
  identity: { actorId: "player", name: "Test Subject", age: 25, backgroundId: "bg-1" },
  currentLocationId: "loc-1",
  finances: { cashCents: 10000, savingsCents: 0, debtCents: 0, weeklyIncomeCents: 0, weeklyExpensesCents: 0, overdueBalanceCents: 0, accounts: [] },
  needs: { health: 80, energy: 80, happiness: 60, stress: 20, satiety: 80 },
  attributes: { intelligence: 50, discipline: 50, charisma: 50, creativity: 50, resilience: 50, wisdom: 50, luck: 50 },
  education: { enrollments: [], credentials: [], completedCourseIds: [], failedCourseIds: [] },
  career: { history: [], totalWeeksEmployed: 0, pendingApplications: [], highestTierAchieved: "entry" },
  housing: {
    definitionId: "housing-1",
    movedInWeek: 1,
    ownership: "renting",
    damage: 0,
    weeklyCostCents: 5000,
    depositPaidCents: 0,
    rentDueWeek: 1,
    overdueRentCents: 0,
    missedPayments: 0,
    evictionStage: "none",
  },
  inventory: [],
  relationships: [],
  skills: {},
  traits: [],
  reputation: {},
  flags: {},
  counters: {},
};

const startingEconomy: EconomyState = {
  inflation: 200,
  unemploymentRate: 500,
  interestRate: 300,
  sectorDemand: {},
  marketPrices: {},
  publishedIndicators: [],
  flags: {},
};

const startingWorld: WorldState = {
  npcs: [],
  locations: [],
  jobMarket: { openings: [] },
  eventCooldowns: {},
  firedUniqueEvents: [],
  chainStates: [],
  strangenessBase: 0,
  headlinePool: { remainingIds: [], cyclesCompleted: 0 },
  agents: [],
  flags: {},
};

const goalDefinitions: GoalDefinition[] = [
  {
    id: "goal-happy",
    labelKey: "goal.happy",
    descriptionKey: "goal.happy.description",
    category: "happiness",
    conditions: { field: "player.needs.happiness", operator: "greater_or_equal", value: 60 },
  },
];

const simulationCampaign: SimulationCampaign = {
  descriptionKey: "sim.description",
  startingCalendar,
  startingPlayer,
  startingEconomy,
  startingWorld,
  goals: goalDefinitions,
  goalFailurePrecedence: "goals_win",
};

const campaign: Campaign = {
  id: "test-sim-campaign",
  kindId: "simulation",
  version: "1.0.0",
  titleKey: "sim.title",
  content: simulationCampaign,
};

describe("initialState", () => {
  it("carries the campaign's starting calendar, player, economy, and world through unchanged", () => {
    const result = initialState(campaign);
    expect(result.state.calendar).toEqual(startingCalendar);
    expect(result.state.player).toEqual(startingPlayer);
    expect(result.state.economy).toEqual(startingEconomy);
    expect(result.state.world).toEqual(startingWorld);
  });

  it("starts every list field with no campaign-independent entries empty", () => {
    const result = initialState(campaign);
    expect(result.state.activeEffects).toEqual([]);
    expect(result.state.activeOpportunities).toEqual([]);
    expect(result.state.scheduledEvents).toEqual([]);
    expect(result.state.pendingEventResponses).toEqual([]);
  });

  it("seeds no goals for a campaign that declares none", () => {
    const noGoalsCampaign: SimulationCampaign = { ...simulationCampaign, goals: [] };
    const result = initialState({ ...campaign, content: noGoalsCampaign });
    expect(result.state.goals).toEqual([]);
  });

  it("starts with a real, empty plan for the campaign's own starting week — never null", () => {
    const result = initialState(campaign);
    expect(result.state.plan).toEqual({ week: 1, actions: [] });
  });

  it("seeds one active GoalState per campaign GoalDefinition", () => {
    const result = initialState(campaign);
    expect(result.state.goals).toEqual([
      {
        definitionId: "goal-happy",
        status: "active",
        satisfiedThisWeek: false,
        consecutiveWeeksSatisfied: 0,
        progressNotes: [],
      },
    ]);
  });

  it("status is always active", () => {
    const result = initialState(campaign);
    expect(result.status).toBe("active");
  });

  it("returns no changes or messages", () => {
    const result = initialState(campaign);
    expect(result.changes).toEqual([]);
    expect(result.messages).toEqual([]);
  });
});
