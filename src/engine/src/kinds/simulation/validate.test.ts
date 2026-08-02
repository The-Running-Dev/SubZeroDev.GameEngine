import { describe, it, expect } from "vitest";
import { validateCampaign } from "./validate.js";
import type { SimulationCampaign } from "./campaign.js";
import type { GoalDefinition } from "./content.js";
import type { Campaign } from "../../core/registry/types.js";
import type { CalendarState, EconomyState, WorldState } from "./state.js";
import type { PlayerState } from "./actor.js";

const startingCalendar: CalendarState = {
  currentWeek: 1, currentYear: 1, totalTimeUnits: 14, committedTimeUnits: 0, spentTimeUnits: 0,
};
const startingPlayer = {} as PlayerState;
const startingEconomy = {} as EconomyState;
const startingWorld = {} as WorldState;

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

function makeCampaign(content: Partial<SimulationCampaign> = {}): Campaign {
  return {
    id: "test-sim",
    kindId: "simulation",
    version: "1.0.0",
    titleKey: "sim.title",
    content: {
      descriptionKey: "sim.description",
      startingCalendar,
      startingPlayer,
      startingEconomy,
      startingWorld,
      goals: [],
      goalFailurePrecedence: "goals_win",
      ...content,
    } satisfies SimulationCampaign,
  };
}

const VALID_STRINGS = new Map<string, string>([
  ["sim.description", "A description"],
  ["goal.label", "A goal"],
  ["goal.description", "A goal description"],
]);

describe("validateCampaign", () => {
  it("passes a campaign with unique goal ids and every LocKey resolved", () => {
    const campaign = makeCampaign({ goals: [makeGoal()] });
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

  it("rejects a campaign descriptionKey with no authored string", () => {
    const campaign = makeCampaign({ descriptionKey: "sim.missing", goals: [] });
    const result = validateCampaign(campaign, VALID_STRINGS);
    expect(result.ok).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "missing_string_key", path: "sim.missing" }),
    );
  });

  it("rejects a goal's labelKey or descriptionKey with no authored string", () => {
    const campaign = makeCampaign({
      goals: [makeGoal({ labelKey: "goal.missing_label" })],
    });
    const result = validateCampaign(campaign, VALID_STRINGS);
    expect(result.ok).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "missing_string_key", path: "goal.missing_label" }),
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
});
