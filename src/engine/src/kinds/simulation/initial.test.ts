import { describe, it, expect } from "vitest";
import { initialState } from "./initial.js";
import type { SimulationCampaign } from "./campaign.js";
import type { Campaign } from "../../core/registry/types.js";
import type { GoalDefinition, BackgroundDefinition, HousingDefinition, ScenarioDefinition, ItemDefinition } from "./content.js";

const background: BackgroundDefinition = {
  id: "bg-1",
  nameKey: "bg.name",
  descriptionKey: "bg.description",
  startingAttributes: { intelligence: 50, discipline: 50, charisma: 50, creativity: 50, resilience: 50, wisdom: 50, luck: 50 },
  startingSkills: {},
  startingCredentials: [],
  startingTraits: [],
  startingCashModifierCents: 0,
};

const housing: HousingDefinition = {
  id: "housing-1",
  nameKey: "housing.name",
  descriptionKey: "housing.description",
  upfrontCostCents: 0,
  weeklyCostCents: 5000,
  capacity: 1,
  comfort: 50,
  safety: 50,
  prestige: 10,
  storage: 20,
  commuteModifier: 0,
  energyRecoveryModifier: 0,
  happinessModifier: 0,
  healthModifier: 0,
  maintenanceRisk: 10,
  requirements: [],
  tags: [],
};

const scenario: ScenarioDefinition = {
  id: "scenario-1",
  nameKey: "scenario.name",
  descriptionKey: "scenario.description",
  startingBackgroundIds: ["bg-1"],
  startingCashCents: 10000,
  startingHousingId: "housing-1",
  startingLocationId: "loc-1",
  startingInventory: [],
  goalIds: ["goal-happy"],
  mode: "classic",
  goalFailurePrecedence: "goals_win",
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
  jobs: [],
  courses: [],
  housing: [housing],
  items: [],
  events: [],
  npcs: [],
  goals: goalDefinitions,
  scenarios: [scenario],
  difficulties: [],
  opportunities: [],
  achievements: [],
  headlines: [],
  employers: [],
  locations: [],
  backgrounds: [background],
  traits: [],
  skills: [],
  projects: [],
  businesses: [],
  scenarioId: "scenario-1",
  goalFailurePrecedence: "goals_win",
  sceneTemplateKey: "sim.scene.status",
  actionLabelKeys: { planAdd: "sim.action.plan-add", planRemove: "sim.action.plan-remove", planClear: "sim.action.plan-clear", endWeek: "sim.action.end-week" },
};

const campaign: Campaign = {
  id: "test-sim-campaign",
  kindId: "simulation",
  version: "1.0.0",
  titleKey: "sim.title",
  content: simulationCampaign,
};

describe("initialState", () => {
  it("builds the player's identity, location, cash, and housing from the scenario and its referenced content", () => {
    const result = initialState(campaign);
    expect(result.state.player.currentLocationId).toBe("loc-1");
    expect(result.state.player.finances.cashCents).toBe(10000);
    expect(result.state.player.identity.backgroundId).toBe("bg-1");
    expect(result.state.player.housing).toEqual({
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
    });
  });

  it("takes attributes, skills, traits, and the cash modifier from the scenario's backgrounds", () => {
    const richBackground: BackgroundDefinition = {
      ...background,
      id: "bg-rich",
      startingAttributes: { ...background.startingAttributes, intelligence: 80 },
      startingSkills: { cooking: 40 },
      startingTraits: ["frugal"],
      startingCashModifierCents: 500,
    };
    const richScenario: ScenarioDefinition = { ...scenario, startingBackgroundIds: ["bg-rich"] };
    const richCampaign: SimulationCampaign = {
      ...simulationCampaign,
      backgrounds: [richBackground],
      scenarios: [richScenario],
    };
    const result = initialState({ ...campaign, content: richCampaign });
    expect(result.state.player.attributes.intelligence).toBe(80);
    expect(result.state.player.skills).toEqual({ cooking: 40 });
    expect(result.state.player.traits).toEqual(["frugal"]);
    expect(result.state.player.finances.cashCents).toBe(10500);
  });

  it("builds inventory instances from the scenario's starting inventory and the matching item definitions", () => {
    const item: ItemDefinition = {
      id: "item-book",
      nameKey: "item.name",
      descriptionKey: "item.description",
      category: "misc",
      purchasePriceCents: 1200,
      baseResaleValueCents: 400,
      effects: [],
      stacking: "stack",
      requirements: [],
      tags: [],
    };
    const invScenario: ScenarioDefinition = {
      ...scenario,
      startingInventory: [{ definitionId: "item-book", quantity: 2 }],
    };
    const invCampaign: SimulationCampaign = { ...simulationCampaign, items: [item], scenarios: [invScenario] };
    const result = initialState({ ...campaign, content: invCampaign });
    expect(result.state.player.inventory).toEqual([
      {
        instanceId: "item-0",
        definitionId: "item-book",
        quantity: 2,
        acquiredWeek: 1,
        purchasePriceCents: 1200,
        condition: 100,
        weeksSinceMaintenance: 0,
        broken: false,
      },
    ]);
  });

  it("starts every list field with no campaign-independent entries empty", () => {
    const result = initialState(campaign);
    expect(result.state.activeEffects).toEqual([]);
    expect(result.state.activeOpportunities).toEqual([]);
    expect(result.state.scheduledEvents).toEqual([]);
    expect(result.state.pendingEventResponses).toEqual([]);
  });

  it("seeds no goals for a scenario that declares none", () => {
    const noGoalsScenario: ScenarioDefinition = { ...scenario, goalIds: [] };
    const noGoalsCampaign: SimulationCampaign = { ...simulationCampaign, goals: [], scenarios: [noGoalsScenario] };
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

  it("seeds only the active scenario's own goalIds, not every campaign GoalDefinition", () => {
    const otherGoal: GoalDefinition = {
      id: "goal-other",
      labelKey: "goal.other",
      descriptionKey: "goal.other.description",
      category: "other",
      conditions: { field: "player.needs.energy", operator: "greater_or_equal", value: 60 },
    };
    const otherScenario: ScenarioDefinition = {
      ...scenario,
      id: "scenario-2",
      goalIds: ["goal-other"],
    };
    const multiScenarioCampaign: SimulationCampaign = {
      ...simulationCampaign,
      goals: [...goalDefinitions, otherGoal],
      scenarios: [scenario, otherScenario],
      scenarioId: "scenario-1",
    };
    const result = initialState({ ...campaign, content: multiScenarioCampaign });
    expect(result.state.goals.map((g) => g.definitionId)).toEqual(["goal-happy"]);
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

// ---------------------------------------------------------------------------
// W102 — seeding `world.chainStates` from a campaign's declared eventChains and the
// migrated `profileData` argument (§2.2, §7.1)
// ---------------------------------------------------------------------------

describe("initialState — profile-scoped chain seeding (W102)", () => {
  const withChains = (): Campaign => ({
    ...campaign,
    content: {
      ...simulationCampaign,
      eventChains: [
        { id: "profile-chain", scope: "profile" },
        { id: "game-chain", scope: "game" },
      ],
    } satisfies SimulationCampaign,
  });

  it("a campaign declaring no eventChains produces a chainStates identical to before this field existed", () => {
    const result = initialState(campaign);
    expect(result.state.world.chainStates).toEqual([]);
  });

  it("an anonymous session (no profileData) seeds every profile-scoped chain at step 0, inactive", () => {
    const result = initialState(withChains());
    expect(result.state.world.chainStates).toEqual([
      { chainId: "profile-chain", scope: "profile", currentStep: 0, startedWeek: 0, active: false },
    ]);
  });

  it("never seeds a game-scoped chain — chainStates starts empty of those, unchanged", () => {
    const result = initialState(withChains());
    expect(result.state.world.chainStates.some((c) => c.chainId === "game-chain")).toBe(false);
  });

  it("seeds a profile-scoped chain's currentStep from the matching SimulationProfileChainRecord.furthestStep", () => {
    const profileData = { chains: [{ campaignId: campaign.id, chainId: "profile-chain", furthestStep: 4 }] };
    const result = initialState(withChains(), undefined, profileData);
    expect(result.state.world.chainStates).toEqual([
      { chainId: "profile-chain", scope: "profile", currentStep: 4, startedWeek: 0, active: false },
    ]);
  });

  it("ignores a furthestStep recorded under a different campaignId", () => {
    const profileData = { chains: [{ campaignId: "some-other-campaign", chainId: "profile-chain", furthestStep: 9 }] };
    const result = initialState(withChains(), undefined, profileData);
    expect(result.state.world.chainStates[0]!.currentStep).toBe(0);
  });

  it("a malformed profileData argument degrades to the same as no cross-game history", () => {
    const result = initialState(withChains(), undefined, { not: "the right shape" });
    expect(result.state.world.chainStates[0]!.currentStep).toBe(0);
  });
});
