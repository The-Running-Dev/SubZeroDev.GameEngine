/**
 * Content — "Stable Life: Effects" (10-simulation-kind.md §6.1, §7.1; W51.6).
 *
 * **A second, standalone fixture campaign, not a variant of `stable-life.ts`.** W51.6 needs
 * a replay fixture covering a `StatusEffect` applying and expiring, and the only lever a
 * campaign has to seed one before the content that grants effects at runtime exists (jobs,
 * courses, items — still out of scope) is `SimulationCampaign.startingEffects`. Adding that
 * to the shared `stable-life` content would change its `initialState` and, with it, every
 * fixture and golden snapshot already committed against it (`stable-life-win`/`-loss`
 * replay fixtures, `stable-life.client-parity.test.ts`'s snapshot) — so this campaign is its
 * own, otherwise-minimal copy of that shape instead.
 *
 * One hand-authored effect, `effect-focused-rest`: `+15` to `player.needs.energy`
 * (`derived.ts`'s `DerivedPath`), `sourceKind: "system"`, `expiresAtWeek: 2`. Present from
 * `initialState` on, still active through week 2 (`startOfWeek.ts`'s `effects()` keeps an
 * effect through the week it expires in), gone once `end_week` advances into week 3 —
 * exactly the applying-then-expiring shape W51.6 asks for.
 */

import type { AuthoredText, BuiltCampaign, Campaign } from "../core/registry/types.js";
import type { CommandResult } from "../core/kernel/reasons.js";
import { buildCampaign } from "../core/registry/build.js";
import type { GoalDefinition } from "../kinds/simulation/content.js";
import type { SimulationCampaign } from "../kinds/simulation/campaign.js";
import type { CalendarState, EconomyState, StatusEffect, WorldState } from "../kinds/simulation/state.js";
import type { PlayerState } from "../kinds/simulation/actor.js";

export const STABLE_LIFE_EFFECTS_CAMPAIGN_ID = "stable-life-effects";

const TITLE: AuthoredText = { key: "stable-life-effects.campaign.title", text: "Stable Life: Effects" };
const DESCRIPTION: AuthoredText = {
  key: "stable-life-effects.campaign.description",
  text: "Twelve months to establish something resembling a stable life, one effect richer.",
};
const GOAL_LABEL: AuthoredText = { key: "stable-life-effects.goal.well-rested.label", text: "Well Rested" };
const GOAL_DESCRIPTION: AuthoredText = {
  key: "stable-life-effects.goal.well-rested.description",
  text: "Keep your energy at 70 or above for two weeks running.",
};
const EFFECT_DESCRIPTION: AuthoredText = {
  key: "stable-life-effects.effect.focused-rest.description",
  text: "Focused Rest — a temporary boost to energy.",
};
const SCENE_TEMPLATE: AuthoredText = {
  key: "stable-life-effects.scene.status",
  text: "Week {week} of Year {year}. Cash: ${cash}. Health {health} · Energy {energy} · Happiness {happiness} · Stress {stress} · Satiety {satiety}.",
};
const ACTION_PLAN_ADD_LABEL: AuthoredText = { key: "stable-life-effects.action.plan-add.label", text: "Add to plan" };
const ACTION_PLAN_REMOVE_LABEL: AuthoredText = { key: "stable-life-effects.action.plan-remove.label", text: "Remove from plan" };
const ACTION_PLAN_CLEAR_LABEL: AuthoredText = { key: "stable-life-effects.action.plan-clear.label", text: "Clear plan" };
const ACTION_END_WEEK_LABEL: AuthoredText = { key: "stable-life-effects.action.end-week.label", text: "End week" };

const wellRestedGoal: GoalDefinition = {
  id: "goal-well-rested",
  labelKey: GOAL_LABEL.key,
  descriptionKey: GOAL_DESCRIPTION.key,
  category: "wellbeing",
  conditions: { field: "player.needs.energy", operator: "greater_or_equal", value: 70 },
  requiredDurationWeeks: 2,
  failureConditions: { field: "player.needs.energy", operator: "less_than", value: 40 },
};

const focusedRestEffect: StatusEffect = {
  id: "effect-focused-rest",
  sourceId: "fixture-focused-rest",
  sourceKind: "system",
  modifiers: [
    { target: "player.needs.energy", operation: "add", value: 15, sourceId: "fixture-focused-rest" },
  ],
  appliedWeek: 1,
  expiresAtWeek: 2,
  stacking: "refresh",
  descriptionKey: EFFECT_DESCRIPTION.key,
  visible: true,
};

const startingCalendar: CalendarState = {
  currentWeek: 1,
  currentYear: 1,
  totalTimeUnits: 14,
  committedTimeUnits: 0,
  spentTimeUnits: 0,
};

const startingPlayer: PlayerState = {
  identity: { actorId: "player", name: "Alex", age: 28, backgroundId: "background-default" },
  currentLocationId: "home",
  finances: {
    cashCents: 20000,
    savingsCents: 0,
    debtCents: 0,
    weeklyIncomeCents: 0,
    weeklyExpensesCents: 0,
    overdueBalanceCents: 0,
    accounts: [],
  },
  needs: { health: 80, energy: 50, happiness: 60, stress: 20, satiety: 80 },
  attributes: {
    intelligence: 50, discipline: 50, charisma: 50, creativity: 50,
    resilience: 50, wisdom: 50, luck: 50,
  },
  education: { enrollments: [], credentials: [], completedCourseIds: [], failedCourseIds: [] },
  career: { history: [], totalWeeksEmployed: 0, pendingApplications: [], highestTierAchieved: "entry" },
  housing: {
    definitionId: "housing-default",
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

const stableLifeEffectsContent: SimulationCampaign = {
  descriptionKey: DESCRIPTION.key,
  startingCalendar,
  startingPlayer,
  startingEconomy,
  startingWorld,
  goals: [wellRestedGoal],
  goalFailurePrecedence: "goals_win",
  sceneTemplateKey: SCENE_TEMPLATE.key,
  actionLabelKeys: {
    planAdd: ACTION_PLAN_ADD_LABEL.key,
    planRemove: ACTION_PLAN_REMOVE_LABEL.key,
    planClear: ACTION_PLAN_CLEAR_LABEL.key,
    endWeek: ACTION_END_WEEK_LABEL.key,
  },
  startingEffects: [focusedRestEffect],
};

/** Mirrors `buildStableLifeCampaign`'s own assembly exactly — see its doc comment. */
export function buildStableLifeEffectsCampaign(): CommandResult<BuiltCampaign> {
  const campaign: Campaign = {
    id: STABLE_LIFE_EFFECTS_CAMPAIGN_ID,
    kindId: "simulation",
    version: "1.0.0",
    titleKey: TITLE.key,
    content: stableLifeEffectsContent,
  };
  return buildCampaign(campaign, [
    TITLE,
    DESCRIPTION,
    GOAL_LABEL,
    GOAL_DESCRIPTION,
    EFFECT_DESCRIPTION,
    SCENE_TEMPLATE,
    ACTION_PLAN_ADD_LABEL,
    ACTION_PLAN_REMOVE_LABEL,
    ACTION_PLAN_CLEAR_LABEL,
    ACTION_END_WEEK_LABEL,
  ]);
}
