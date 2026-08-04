import { describe, it, expect } from "vitest";
import { scene } from "./scene.js";
import type { SimulationCampaign } from "./campaign.js";
import type { SimulationKindState } from "./state.js";
import type { KindContext } from "../../core/kernel/types.js";

const baseState: SimulationKindState = {
  calendar: { currentWeek: 4, currentYear: 2, totalTimeUnits: 14, committedTimeUnits: 0, spentTimeUnits: 0 },
  player: {
    identity: { actorId: "player", name: "Alex", age: 28, backgroundId: "bg-1" },
    currentLocationId: "home",
    finances: { cashCents: 123456, savingsCents: 0, debtCents: 0, weeklyIncomeCents: 0, weeklyExpensesCents: 0, overdueBalanceCents: 0, accounts: [] },
    needs: { health: 80, energy: 55, happiness: 60, stress: 20, satiety: 80 },
    attributes: { intelligence: 50, discipline: 50, charisma: 50, creativity: 50, resilience: 50, wisdom: 50, luck: 50 },
    education: { enrollments: [], credentials: [], completedCourseIds: [], failedCourseIds: [] },
    career: { history: [], totalWeeksEmployed: 0, pendingApplications: [], highestTierAchieved: "entry" },
    housing: { definitionId: "h", movedInWeek: 1, ownership: "renting", damage: 0, weeklyCostCents: 0, depositPaidCents: 0, rentDueWeek: 1, overdueRentCents: 0, missedPayments: 0, evictionStage: "none" },
    inventory: [], relationships: [], skills: {}, traits: [], reputation: {}, flags: {}, counters: {},
  },
  economy: { inflation: 0, unemploymentRate: 0, interestRate: 0, sectorDemand: {}, marketPrices: {}, publishedIndicators: [], flags: {} },
  world: { npcs: [], locations: [], jobMarket: { openings: [] }, eventCooldowns: {}, firedUniqueEvents: [], chainStates: [], strangenessBase: 0, headlinePool: { remainingIds: [], cyclesCompleted: 0 }, agents: [], flags: {} },
  activeEffects: [], activeOpportunities: [], scheduledEvents: [], pendingEventResponses: [],
  goals: [],
  plan: { week: 4, actions: [] },
};

function campaignContent(overrides?: Partial<SimulationCampaign>): SimulationCampaign {
  return {
    descriptionKey: "sim.description",
    startingCalendar: baseState.calendar,
    startingPlayer: baseState.player,
    startingEconomy: baseState.economy,
    startingWorld: baseState.world,
    goals: [],
    goalFailurePrecedence: "goals_win",
    sceneTemplateKey: "sim.scene.status",
    actionLabelKeys: { planAdd: "sim.action.plan-add", planRemove: "sim.action.plan-remove", planClear: "sim.action.plan-clear", endWeek: "sim.action.end-week" },
    ...overrides,
  };
}

function ctxWithStrings(content: SimulationCampaign, strings: ReadonlyMap<string, string>): KindContext {
  return {
    registry: { campaigns: new Map(), strings },
    campaign: { id: "c", kindId: "simulation", version: "1", titleKey: "t", content },
    rng: { nextInt: () => 0, nextPercent: () => 0, pick: (items) => items[0]!, weightedPick: (items) => items[0]!.item },
    derive() {
      return this.rng;
    },
    seq: 0,
    emit: { emit: () => undefined },
  };
}

describe("scene (10-simulation-kind.md §9)", () => {
  it("renders the campaign's template against the registry string table, interpolating calendar/finance/needs", () => {
    const template = "Week {week} of Year {year}. Cash: ${cash}. Health {health} Energy {energy} Happiness {happiness} Stress {stress} Satiety {satiety}.";
    const strings = new Map([["sim.scene.status", template]]);
    const body = scene(baseState, ctxWithStrings(campaignContent(), strings));

    expect(body.textKey).toBe("sim.scene.status");
    expect(body.text).toBe("Week 4 of Year 2. Cash: $1234.56. Health 80 Energy 55 Happiness 60 Stress 20 Satiety 80.");
  });

  it("W50.5 — a sceneTemplateKey the registry cannot resolve throws rather than rendering a raw key at play", () => {
    const strings = new Map<string, string>();
    expect(() => scene(baseState, ctxWithStrings(campaignContent(), strings))).toThrow();
  });

  it("leaves an unmatched placeholder as-is rather than throwing", () => {
    const strings = new Map([["sim.scene.status", "Week {week}, {unknownPlaceholder}."]]);
    const body = scene(baseState, ctxWithStrings(campaignContent(), strings));
    expect(body.text).toBe("Week 4, {unknownPlaceholder}.");
  });
});
