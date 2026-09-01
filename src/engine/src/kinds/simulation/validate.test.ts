import { describe, it, expect } from "vitest";
import { validateCampaign } from "./validate.js";
import type { SimulationCampaign } from "./campaign.js";
import type {
  GoalDefinition,
  ScenarioDefinition,
  HousingDefinition,
  JobDefinition,
  EmployerDefinition,
  LocationDefinition,
  NPCDefinition,
  CourseDefinition,
  AchievementDefinition,
  BackgroundDefinition,
  BusinessDefinition,
  EventChainDefinition,
  EventDefinition,
  OpportunityDefinition,
  ProjectDefinition,
  RivalConfig,
} from "./content.js";
import type { Campaign } from "../../core/registry/types.js";
import type { StatusEffect } from "./state.js";

function makeGoal(overrides: Partial<GoalDefinition> = {}): GoalDefinition {
  return {
    id: "goal-1",
    labelKey: "goal.label",
    descriptionKey: "goal.description",
    category: "test",
    conditions: { field: "player.needs.happiness", operator: "greater_or_equal", value: 60 },
    ...overrides,
  };
}

function makeScenario(overrides: Partial<ScenarioDefinition> = {}): ScenarioDefinition {
  return {
    id: "scenario-1",
    nameKey: "scenario.name",
    descriptionKey: "scenario.description",
    startingBackgroundIds: [],
    startingCashCents: 0,
    startingHousingId: "housing-1",
    startingLocationId: "loc-1",
    startingInventory: [],
    goalIds: ["goal-1"],
    mode: "classic",
    goalFailurePrecedence: "goals_win",
    ...overrides,
  };
}

function makeHousing(overrides: Partial<HousingDefinition> = {}): HousingDefinition {
  return {
    id: "housing-1",
    nameKey: "housing.name",
    descriptionKey: "housing.description",
    upfrontCostCents: 0,
    weeklyCostCents: 0,
    capacity: 1,
    comfort: 0,
    safety: 0,
    prestige: 0,
    storage: 0,
    commuteModifier: 0,
    energyRecoveryModifier: 0,
    happinessModifier: 0,
    healthModifier: 0,
    maintenanceRisk: 0,
    requirements: [],
    tags: [],
    ...overrides,
  };
}

function makeLocation(overrides: Partial<LocationDefinition> = {}): LocationDefinition {
  return {
    id: "loc-1",
    nameKey: "loc.name",
    descriptionKey: "loc.description",
    connections: [],
    travelTimeUnits: 0,
    actionTypes: [],
    ...overrides,
  };
}

function makeCampaign(content: Partial<SimulationCampaign> = {}): Campaign {
  return {
    id: "test-sim",
    kindId: "simulation",
    version: "1.0.0",
    titleKey: "sim.title",
    content: {
      descriptionKey: "sim.description",
      jobs: [],
      courses: [],
      housing: [makeHousing()],
      items: [],
      events: [],
      npcs: [],
      goals: [makeGoal()],
      scenarios: [makeScenario()],
      difficulties: [],
      opportunities: [],
      achievements: [],
      headlines: [],
      employers: [],
      locations: [makeLocation()],
      backgrounds: [],
      traits: [],
      skills: [],
      projects: [],
      businesses: [],
      scenarioId: "scenario-1",
      goalFailurePrecedence: "goals_win",
      sceneTemplateKey: "sim.scene.status",
      actionLabelKeys: {
        planAdd: "sim.action.plan-add",
        planRemove: "sim.action.plan-remove",
        planClear: "sim.action.plan-clear",
        endWeek: "sim.action.end-week",
      },
      ...content,
    } satisfies SimulationCampaign,
  };
}

const VALID_STRINGS = new Map<string, string>([
  ["sim.description", "A description"],
  ["goal.label", "A goal"],
  ["goal.description", "A goal description"],
  ["scenario.name", "A scenario"],
  ["scenario.description", "A scenario description"],
  ["housing.name", "Housing"],
  ["housing.description", "Housing description"],
  ["loc.name", "A place"],
  ["loc.description", "A place description"],
  ["item.name", "An item"],
  ["item.description", "An item description"],
  ["ach.name", "An achievement"],
  ["ach.description", "An achievement description"],
  ["sim.scene.status", "Week {week}."],
  ["sim.action.plan-add", "Add to plan"],
  ["sim.action.plan-remove", "Remove from plan"],
  ["sim.action.plan-clear", "Clear plan"],
  ["sim.action.end-week", "End week"],
  ["bg.name", "A background"],
  ["bg.description", "A background description"],
  ["rival.name", "A rival"],
  ["project.name", "A project"],
  ["project.description", "A project description"],
  ["business.name", "A business"],
  ["business.description", "A business description"],
]);

describe("validateCampaign", () => {
  it("passes a well-formed campaign with unique ids, resolved references, and every LocKey resolved", () => {
    const campaign = makeCampaign();
    const result = validateCampaign(campaign, VALID_STRINGS);
    expect(result).toEqual({ ok: true, errors: [], warnings: [] });
  });

  it("rejects two goals sharing an id", () => {
    const campaign = makeCampaign({ goals: [makeGoal(), makeGoal()] });
    const result = validateCampaign(campaign, VALID_STRINGS);
    expect(result.ok).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "duplicate_id", path: "goal-1" }),
    );
  });

  it("rejects two housing definitions sharing an id — duplicate ids are checked per collection, independently", () => {
    const campaign = makeCampaign({ housing: [makeHousing(), makeHousing()] });
    const result = validateCampaign(campaign, VALID_STRINGS);
    expect(result.ok).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "duplicate_id", path: "housing-1" }),
    );
  });

  it("rejects a campaign descriptionKey with no authored string", () => {
    const campaign = makeCampaign({ descriptionKey: "sim.missing" });
    const result = validateCampaign(campaign, VALID_STRINGS);
    expect(result.ok).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "missing_string_key", path: "sim.missing" }),
    );
  });

  it("rejects a goal's labelKey or descriptionKey with no authored string", () => {
    const campaign = makeCampaign({ goals: [makeGoal({ labelKey: "goal.missing_label" })] });
    const result = validateCampaign(campaign, VALID_STRINGS);
    expect(result.ok).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "missing_string_key", path: "goal.missing_label" }),
    );
  });

  it("rejects a sceneTemplateKey with no authored string (§9 — fails registry construction, never a raw key at play)", () => {
    const campaign = makeCampaign({ sceneTemplateKey: "sim.scene.missing" });
    const result = validateCampaign(campaign, VALID_STRINGS);
    expect(result.ok).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "missing_string_key", path: "sim.scene.missing" }),
    );
  });

  it("rejects an actionLabelKeys entry with no authored string", () => {
    const campaign = makeCampaign({
      actionLabelKeys: {
        planAdd: "sim.action.missing",
        planRemove: "sim.action.plan-remove",
        planClear: "sim.action.plan-clear",
        endWeek: "sim.action.end-week",
      },
    });
    const result = validateCampaign(campaign, VALID_STRINGS);
    expect(result.ok).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "missing_string_key", path: "sim.action.missing" }),
    );
  });

  it("collects every error rather than stopping at the first", () => {
    const campaign = makeCampaign({
      descriptionKey: "sim.missing",
      goals: [makeGoal(), makeGoal()],
    });
    const result = validateCampaign(campaign, VALID_STRINGS);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });

  // -------------------------------------------------------------------------
  // Cross-references
  // -------------------------------------------------------------------------

  it("rejects a scenario's startingHousingId pointing at no housing definition", () => {
    const campaign = makeCampaign({ scenarios: [makeScenario({ startingHousingId: "housing-nonexistent" })] });
    const result = validateCampaign(campaign, VALID_STRINGS);
    expect(result.ok).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "dangling_reference", path: "housing-nonexistent" }),
    );
  });

  it("rejects a scenario's goalIds entry pointing at no goal definition", () => {
    const campaign = makeCampaign({ scenarios: [makeScenario({ goalIds: ["goal-nonexistent"] })] });
    const result = validateCampaign(campaign, VALID_STRINGS);
    expect(result.ok).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "dangling_reference", path: "goal-nonexistent" }),
    );
  });

  it("rejects a PromotionPath.toJobId pointing at no job definition", () => {
    const job: JobDefinition = {
      id: "job-1",
      titleKey: "job.title",
      descriptionKey: "job.description",
      employerId: "employer-1",
      careerPathId: "path-1",
      tier: "entry",
      schedule: { weeklyTimeCost: 5, flexibility: 0 },
      compensation: { baseWeeklyPayCents: 1000 },
      requirements: [],
      performance: { factors: [], weeklyDriftToward: 50, minimumAcceptable: 0 },
      promotionPaths: [{ toJobId: "job-nonexistent", minimumWeeksInRole: 1, minimumPerformance: 0, requirements: [], contested: false, baseChance: 0 }],
      terminationRules: [],
      contested: false,
      tags: [],
    };
    const campaign = makeCampaign({ jobs: [job] });
    const result = validateCampaign(campaign, VALID_STRINGS);
    expect(result.ok).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "dangling_reference", path: "job-nonexistent" }),
    );
  });

  it("rejects an EmployerDefinition.jobIds entry pointing at no job definition", () => {
    const employer: EmployerDefinition = { id: "employer-1", nameKey: "employer.name", sector: "test", reputation: 0, jobIds: ["job-nonexistent"], npcIds: [] };
    const campaign = makeCampaign({ employers: [employer] });
    const result = validateCampaign(campaign, VALID_STRINGS);
    expect(result.ok).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "dangling_reference", path: "job-nonexistent" }),
    );
  });

  it("rejects a LocationDefinition.connections entry pointing at no location definition", () => {
    const location: LocationDefinition = { id: "loc-1", nameKey: "loc.name", descriptionKey: "loc.description", connections: ["loc-nonexistent"], travelTimeUnits: 0, actionTypes: [] };
    const campaign = makeCampaign({ locations: [location] });
    const result = validateCampaign(campaign, VALID_STRINGS);
    expect(result.ok).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "dangling_reference", path: "loc-nonexistent" }),
    );
  });

  // -------------------------------------------------------------------------
  // Natural-key ids
  // -------------------------------------------------------------------------

  it("rejects an all-digit NPCDefinition.id — indistinguishable from a numeric index otherwise", () => {
    const npc: NPCDefinition = { id: "123", nameKey: "npc.name", descriptionKey: "npc.description", defaultRole: "neighbor", initialRelationship: { affinity: 0, trust: 0, respect: 0, resentment: 0 }, availability: [], tags: [] };
    const campaign = makeCampaign({ npcs: [npc] });
    const result = validateCampaign(campaign, VALID_STRINGS);
    expect(result.ok).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "numeric_natural_key", path: "123" }),
    );
  });

  it("rejects an all-digit CourseDefinition.id", () => {
    const course: CourseDefinition = { id: "456", nameKey: "course.name", descriptionKey: "course.description", providerId: "provider-1", tuitionCents: 0, durationWeeks: 1, weeklyTimeCost: 1, difficulty: 0, requirements: [], rewards: [], failureRules: { minimumAttendanceRatio: 0, minimumStudyUnitsPerWeek: 0, maximumMissedSessions: 0, tuitionGraceWeeks: 0, progressRetainedOnFailure: 0 }, tags: [] };
    const campaign = makeCampaign({ courses: [course] });
    const result = validateCampaign(campaign, VALID_STRINGS);
    expect(result.ok).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "numeric_natural_key", path: "456" }),
    );
  });

  it("rejects an all-digit JobDefinition.id — W53's resolvers.ts addresses it as a natural key too", () => {
    const job: JobDefinition = {
      id: "123",
      titleKey: "job.title",
      descriptionKey: "job.description",
      employerId: "employer-1",
      careerPathId: "path-1",
      tier: "entry",
      schedule: { weeklyTimeCost: 5, flexibility: 0 },
      compensation: { baseWeeklyPayCents: 1000 },
      requirements: [],
      performance: { factors: [], weeklyDriftToward: 50, minimumAcceptable: 0 },
      promotionPaths: [],
      terminationRules: [],
      contested: false,
      tags: [],
    };
    const campaign = makeCampaign({ jobs: [job] });
    const result = validateCampaign(campaign, VALID_STRINGS);
    expect(result.ok).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "numeric_natural_key", path: "123" }),
    );
  });

  // -------------------------------------------------------------------------
  // startingEffects — Modifier addressing (retained from before W52)
  // -------------------------------------------------------------------------

  function makeStartingEffect(overrides: Partial<StatusEffect> = {}): StatusEffect {
    return {
      id: "effect-1",
      sourceId: "campaign",
      sourceKind: "system",
      modifiers: [{ target: "player.needs.energy", operation: "add", value: 10, sourceId: "campaign" }],
      appliedWeek: 1,
      stacking: "refresh",
      descriptionKey: "sim.description",
      visible: true,
      ...overrides,
    };
  }

  it("passes a startingEffects entry with a resolved descriptionKey and a writable modifier target", () => {
    const campaign = makeCampaign({ startingEffects: [makeStartingEffect()] });
    const result = validateCampaign(campaign, VALID_STRINGS);
    expect(result).toEqual({ ok: true, errors: [], warnings: [] });
  });

  it("rejects a startingEffects modifier targeting a read-only derived field", () => {
    const campaign = makeCampaign({
      startingEffects: [makeStartingEffect({ modifiers: [{ target: "world.strangeness", operation: "add", value: 1, sourceId: "campaign" }] })],
    });
    const result = validateCampaign(campaign, VALID_STRINGS);
    expect(result.ok).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "read_only_field", path: "world.strangeness" }),
    );
  });

  it("rejects an ItemDefinition.effects modifier targeting a read-only derived field — Modifier addressing extends to every content collection", () => {
    const campaign = makeCampaign({
      items: [{
        id: "item-1", nameKey: "item.name", descriptionKey: "item.description", category: "misc",
        purchasePriceCents: 0, baseResaleValueCents: 0,
        effects: [{ target: "player.career.effectivePerformance", operation: "add", value: 1, sourceId: "item-1" }],
        stacking: "stack", requirements: [], tags: [],
      }],
    });
    const result = validateCampaign(campaign, VALID_STRINGS);
    expect(result.ok).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "read_only_field", path: "player.career.effectivePerformance" }),
    );
  });

  it("accepts a startingEffects modifier targeting calendar.committedTimeUnits (the time_commit exception)", () => {
    const campaign = makeCampaign({
      startingEffects: [makeStartingEffect({ modifiers: [{ target: "calendar.committedTimeUnits", operation: "add", value: 1, sourceId: "campaign" }] })],
    });
    const result = validateCampaign(campaign, VALID_STRINGS);
    expect(result.ok).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Tier 2 — unreachable content
  // -------------------------------------------------------------------------

  it("warns on a GoalDefinition no scenario's goalIds ever names", () => {
    const campaign = makeCampaign({
      goals: [makeGoal(), makeGoal({ id: "goal-orphan" })],
      scenarios: [makeScenario({ goalIds: ["goal-1"] })],
    });
    const result = validateCampaign(campaign, VALID_STRINGS);
    expect(result.ok).toBe(true);
    expect(result.warnings).toContainEqual(
      expect.objectContaining({ code: "unreachable_content", path: "goal-orphan" }),
    );
  });

  it("warns on an ItemDefinition no scenario's starting inventory ever references", () => {
    const campaign = makeCampaign({
      items: [{ id: "item-orphan", nameKey: "item.name", descriptionKey: "item.description", category: "misc", purchasePriceCents: 0, baseResaleValueCents: 0, effects: [], stacking: "stack", requirements: [], tags: [] }],
    });
    const result = validateCampaign(campaign, VALID_STRINGS);
    expect(result.ok).toBe(true);
    expect(result.warnings).toContainEqual(
      expect.objectContaining({ code: "unreachable_content", path: "item-orphan" }),
    );
  });

  // -------------------------------------------------------------------------
  // Tier 2 — an achievement condition referencing an unwritten counter/flag
  // -------------------------------------------------------------------------

  it("warns on an AchievementDefinition.condition referencing a counter no Reward in the campaign ever grants", () => {
    const achievement: AchievementDefinition = {
      id: "ach-1", nameKey: "ach.name", descriptionKey: "ach.description",
      condition: { field: "player.counters.things_done", operator: "greater_or_equal", value: 1 },
      hidden: false, scope: "profile",
    };
    const campaign = makeCampaign({ achievements: [achievement] });
    const result = validateCampaign(campaign, VALID_STRINGS);
    expect(result.ok).toBe(true);
    expect(result.warnings).toContainEqual(
      expect.objectContaining({ code: "unsatisfiable_achievement", path: "ach-1" }),
    );
  });

  it("does not warn when a goal's own reward grants the counter an achievement condition checks", () => {
    const achievement: AchievementDefinition = {
      id: "ach-1", nameKey: "ach.name", descriptionKey: "ach.description",
      condition: { field: "player.counters.things_done", operator: "greater_or_equal", value: 1 },
      hidden: false, scope: "profile",
    };
    const campaign = makeCampaign({
      achievements: [achievement],
      goals: [makeGoal({ rewards: [{ type: "counter", target: "things_done" }] })],
    });
    const result = validateCampaign(campaign, VALID_STRINGS);
    expect(result.warnings).not.toContainEqual(
      expect.objectContaining({ code: "unsatisfiable_achievement" }),
    );
  });

  it("does not warn on a counter key that only `advance.ts`'s automatic reason-code fold grants, with no matching Reward", () => {
    const achievement: AchievementDefinition = {
      id: "ach-1", nameKey: "ach.name", descriptionKey: "ach.description",
      condition: { field: "player.counters.action_rest", operator: "greater_or_equal", value: 1 },
      hidden: false, scope: "profile",
    };
    const campaign = makeCampaign({ achievements: [achievement] });
    const result = validateCampaign(campaign, VALID_STRINGS);
    expect(result.warnings).not.toContainEqual(
      expect.objectContaining({ code: "unsatisfiable_achievement" }),
    );
  });

  // -------------------------------------------------------------------------
  // attendanceTracking.windowWeeks — W100.1/W100.6 (§7.11, §14)
  // -------------------------------------------------------------------------

  it("passes when attendanceTracking is absent (0.10 behaviour)", () => {
    const campaign = makeCampaign();
    const result = validateCampaign(campaign, VALID_STRINGS);
    expect(result.ok).toBe(true);
  });

  it("passes a positive integer windowWeeks", () => {
    const campaign = makeCampaign({ attendanceTracking: { windowWeeks: 4 } });
    const result = validateCampaign(campaign, VALID_STRINGS);
    expect(result.ok).toBe(true);
  });

  it("rejects a zero windowWeeks", () => {
    const campaign = makeCampaign({ attendanceTracking: { windowWeeks: 0 } });
    const result = validateCampaign(campaign, VALID_STRINGS);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "invalid_attendance_window", path: "attendanceTracking.windowWeeks" }),
    );
  });

  it("rejects a negative windowWeeks", () => {
    const campaign = makeCampaign({ attendanceTracking: { windowWeeks: -2 } });
    const result = validateCampaign(campaign, VALID_STRINGS);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "invalid_attendance_window", path: "attendanceTracking.windowWeeks" }),
    );
  });

  it("rejects a non-integer windowWeeks", () => {
    const campaign = makeCampaign({ attendanceTracking: { windowWeeks: 2.5 } });
    const result = validateCampaign(campaign, VALID_STRINGS);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "invalid_attendance_window", path: "attendanceTracking.windowWeeks" }),
    );
  });

  // -------------------------------------------------------------------------
  // W101 — projects, businesses, and scenario-declared rivals (§7.8, §7.12, §14)
  // -------------------------------------------------------------------------

  function makeBackground(overrides: Partial<BackgroundDefinition> = {}): BackgroundDefinition {
    return {
      id: "bg-1", nameKey: "bg.name", descriptionKey: "bg.description",
      startingAttributes: { intelligence: 50, discipline: 50, charisma: 50, creativity: 50, resilience: 50, wisdom: 50, luck: 50 },
      startingSkills: {}, startingCredentials: [], startingTraits: [], startingCashModifierCents: 0,
      ...overrides,
    };
  }

  function makeRival(overrides: Partial<RivalConfig> = {}): RivalConfig {
    return { agentId: "agent-1", strategyId: "aggressive", displayNameKey: "rival.name", startingBackgroundId: "bg-1", ...overrides };
  }

  function makeProject(overrides: Partial<ProjectDefinition> = {}): ProjectDefinition {
    return {
      id: "project-1", nameKey: "project.name", descriptionKey: "project.description",
      requirements: [], requiredUnits: 4, weeklyTimeCost: 2, startCostCents: 0, rewards: [], tags: [],
      ...overrides,
    };
  }

  function makeBusiness(overrides: Partial<BusinessDefinition> = {}): BusinessDefinition {
    return {
      id: "business-1", nameKey: "business.name", descriptionKey: "business.description",
      requirements: [], startupCostCents: 0, weeklyRevenueCents: 0, weeklyExpensesCents: 0, minimumCashCents: 0, tags: [],
      ...overrides,
    };
  }

  it("passes a scenario declaring a real rival against a registered strategy and a resolving background", () => {
    const campaign = makeCampaign({
      backgrounds: [makeBackground()],
      scenarios: [makeScenario({ rivals: [makeRival()] })],
    });
    const result = validateCampaign(campaign, VALID_STRINGS);
    expect(result.ok).toBe(true);
  });

  it("rejects unknown_rival_strategy when strategyId names no registered AgentStrategy", () => {
    const campaign = makeCampaign({
      backgrounds: [makeBackground()],
      scenarios: [makeScenario({ rivals: [makeRival({ strategyId: "no-such-strategy" })] })],
    });
    const result = validateCampaign(campaign, VALID_STRINGS);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "unknown_rival_strategy", path: "no-such-strategy" }),
    );
  });

  it("rejects dangling_reference when RivalConfig.startingBackgroundId resolves to no BackgroundDefinition", () => {
    const campaign = makeCampaign({
      backgrounds: [],
      scenarios: [makeScenario({ rivals: [makeRival({ startingBackgroundId: "no-such-background" })] })],
    });
    const result = validateCampaign(campaign, VALID_STRINGS);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "dangling_reference", path: "no-such-background" }),
    );
  });

  it("rejects duplicate_id when two rivals in one scenario share an agentId", () => {
    const campaign = makeCampaign({
      backgrounds: [makeBackground()],
      scenarios: [makeScenario({ rivals: [makeRival(), makeRival({ displayNameKey: "rival.name" })] })],
    });
    const result = validateCampaign(campaign, VALID_STRINGS);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "duplicate_id", path: "agent-1" }),
    );
  });

  it("absent/empty rivals is valid — zero rivals is every 0.10 scenario's own value", () => {
    const campaign = makeCampaign({ scenarios: [makeScenario()] });
    const result = validateCampaign(campaign, VALID_STRINGS);
    expect(result.ok).toBe(true);
  });

  it("rejects duplicate_id when two ProjectDefinitions share an id", () => {
    const campaign = makeCampaign({ projects: [makeProject(), makeProject()] });
    const result = validateCampaign(campaign, VALID_STRINGS);
    expect(result.errors).toContainEqual(expect.objectContaining({ code: "duplicate_id", path: "project-1" }));
  });

  it("rejects duplicate_id when two BusinessDefinitions share an id", () => {
    const campaign = makeCampaign({ businesses: [makeBusiness(), makeBusiness()] });
    const result = validateCampaign(campaign, VALID_STRINGS);
    expect(result.errors).toContainEqual(expect.objectContaining({ code: "duplicate_id", path: "business-1" }));
  });

  it("rejects missing_string_key when a ProjectDefinition/BusinessDefinition names an unregistered string", () => {
    const campaign = makeCampaign({
      projects: [makeProject({ nameKey: "project.missing" })],
      businesses: [makeBusiness({ descriptionKey: "business.missing" })],
    });
    const result = validateCampaign(campaign, VALID_STRINGS);
    expect(result.errors).toContainEqual(expect.objectContaining({ code: "missing_string_key", path: "project.missing" }));
    expect(result.errors).toContainEqual(expect.objectContaining({ code: "missing_string_key", path: "business.missing" }));
  });

  it("an OpportunityDefinition of kind \"business\" resolves against content.businesses", () => {
    const opportunity: OpportunityDefinition = {
      id: "opp-1", kind: "business", targetId: "business-1",
      nameKey: "business.name", descriptionKey: "business.description",
      durationWeeks: 1, weight: 1, requirements: [], contested: false, tags: [],
    };
    const passing = makeCampaign({ businesses: [makeBusiness()], opportunities: [opportunity] });
    expect(validateCampaign(passing, VALID_STRINGS).ok).toBe(true);

    const failing = makeCampaign({ businesses: [], opportunities: [opportunity] });
    expect(validateCampaign(failing, VALID_STRINGS).errors).toContainEqual(
      expect.objectContaining({ code: "dangling_reference", path: "business-1" }),
    );
  });

  // ---------------------------------------------------------------------------
  // W102 — eventChains (§7.13, §14)
  // ---------------------------------------------------------------------------

  function makeEvent(overrides: Partial<EventDefinition> = {}): EventDefinition {
    return {
      id: "event-1",
      category: "test",
      titleKey: "sim.description",
      descriptionKey: "sim.description",
      weight: 1,
      conditions: { field: "calendar.currentWeek", operator: "greater_or_equal", value: 1 },
      tags: [],
      ...overrides,
    };
  }

  it("rejects duplicate_id when two EventChainDefinitions share an id", () => {
    const chains: EventChainDefinition[] = [{ id: "chain-1", scope: "game" }, { id: "chain-1", scope: "profile" }];
    const result = validateCampaign(makeCampaign({ eventChains: chains }), VALID_STRINGS);
    expect(result.errors).toContainEqual(expect.objectContaining({ code: "duplicate_id", path: "chain-1" }));
  });

  it("rejects dangling_reference when an EventDefinition.chainId names no declared chain", () => {
    const result = validateCampaign(
      makeCampaign({ events: [makeEvent({ chainId: "no-such-chain" })], eventChains: [] }),
      VALID_STRINGS,
    );
    expect(result.errors).toContainEqual(expect.objectContaining({ code: "dangling_reference", path: "no-such-chain" }));
  });

  it("passes when an EventDefinition.chainId resolves against a declared EventChainDefinition", () => {
    const result = validateCampaign(
      makeCampaign({ events: [makeEvent({ chainId: "chain-1" })], eventChains: [{ id: "chain-1", scope: "game" }] }),
      VALID_STRINGS,
    );
    expect(result.ok).toBe(true);
  });

  it("warns unreachable_content when a declared chain is never named by any EventDefinition.chainId", () => {
    const result = validateCampaign(makeCampaign({ eventChains: [{ id: "chain-orphan", scope: "game" }] }), VALID_STRINGS);
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: "unreachable_content", path: "chain-orphan" }));
  });
});
