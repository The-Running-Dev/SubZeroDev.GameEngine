/**
 * Content — "Stable Life: Effects" (10-simulation-kind.md §6.1, §7.1; W51.6, re-authored
 * onto the real §7 content surface by W52).
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

import type { BuiltCampaign, Campaign } from "../core/registry/types.js";
import type { CommandResult } from "../core/kernel/reasons.js";
import { buildCampaign } from "../core/registry/build.js";
import { buildSimulationCampaign, type SimulationCampaignSource } from "../kinds/simulation/source.js";

export const STABLE_LIFE_EFFECTS_CAMPAIGN_ID = "stable-life-effects";

const stableLifeEffectsSource: SimulationCampaignSource = {
  description: {
    key: "stable-life-effects.campaign.description",
    text: "Twelve months to establish something resembling a stable life, one effect richer.",
  },

  jobs: [],
  courses: [],
  housing: [
    {
      id: "housing-default",
      name: { key: "stable-life-effects.housing.default.name", text: "A Small Rental" },
      description: { key: "stable-life-effects.housing.default.description", text: "Modest, but the rent is due every week regardless." },
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
    },
  ],
  items: [],
  events: [],
  npcs: [],
  goals: [
    {
      id: "goal-well-rested",
      label: { key: "stable-life-effects.goal.well-rested.label", text: "Well Rested" },
      description: {
        key: "stable-life-effects.goal.well-rested.description",
        text: "Keep your energy at 70 or above for two weeks running.",
      },
      category: "wellbeing",
      conditions: { field: "player.needs.energy", operator: "greater_or_equal", value: 70 },
      requiredDurationWeeks: 2,
      failureConditions: { field: "player.needs.energy", operator: "less_than", value: 40 },
    },
  ],
  scenarios: [
    {
      id: "scenario-stable-life-effects",
      name: { key: "stable-life-effects.scenario.name", text: "Stable Life: Effects" },
      description: {
        key: "stable-life-effects.scenario.description",
        text: "Twelve months to establish something resembling a stable life, one effect richer.",
      },
      startingBackgroundIds: ["background-default"],
      startingCashCents: 20000,
      startingHousingId: "housing-default",
      startingLocationId: "home",
      startingInventory: [],
      goalIds: ["goal-well-rested"],
      mode: "classic",
      goalFailurePrecedence: "goals_win",
    },
  ],
  difficulties: [],
  opportunities: [],
  achievements: [],
  headlines: [],
  employers: [],
  locations: [
    {
      id: "home",
      name: { key: "stable-life-effects.location.home.name", text: "Home" },
      description: { key: "stable-life-effects.location.home.description", text: "Where the week starts and ends." },
      connections: [],
      travelTimeUnits: 0,
      actionTypes: ["eat", "rest", "exercise", "socialize"],
    },
  ],
  backgrounds: [
    {
      id: "background-default",
      name: { key: "stable-life-effects.background.default.name", text: "A Fresh Start" },
      description: { key: "stable-life-effects.background.default.description", text: "No particular head start, no particular deficit." },
      startingAttributes: {
        intelligence: 50, discipline: 50, charisma: 50, creativity: 50,
        resilience: 50, wisdom: 50, luck: 50,
      },
      startingSkills: {},
      startingCredentials: [],
      startingTraits: [],
      startingCashModifierCents: 0,
    },
  ],
  traits: [],
  skills: [],

  scenarioId: "scenario-stable-life-effects",
  goalFailurePrecedence: "goals_win",

  startingEffects: [
    {
      id: "effect-focused-rest",
      sourceId: "fixture-focused-rest",
      sourceKind: "system",
      modifiers: [
        { target: "player.needs.energy", operation: "add", value: 15, sourceId: "fixture-focused-rest" },
      ],
      appliedWeek: 1,
      expiresAtWeek: 2,
      stacking: "refresh",
      descriptionKey: "stable-life-effects.effect.focused-rest.description",
      visible: true,
    },
  ],

  sceneTemplate: {
    key: "stable-life-effects.scene.status",
    text: "Week {week} of Year {year}. Cash: ${cash}. Health {health} · Energy {energy} · Happiness {happiness} · Stress {stress} · Satiety {satiety}.",
  },
  actionLabels: {
    planAdd: { key: "stable-life-effects.action.plan-add.label", text: "Add to plan" },
    planRemove: { key: "stable-life-effects.action.plan-remove.label", text: "Remove from plan" },
    planClear: { key: "stable-life-effects.action.plan-clear.label", text: "Clear plan" },
    endWeek: { key: "stable-life-effects.action.end-week.label", text: "End week" },
  },
};

const EFFECT_DESCRIPTION = {
  key: "stable-life-effects.effect.focused-rest.description",
  text: "Focused Rest — a temporary boost to energy.",
};

/** Mirrors `buildStableLifeCampaign`'s own assembly exactly — see its doc comment. */
export function buildStableLifeEffectsCampaign(): CommandResult<BuiltCampaign> {
  const { content, authoredText } = buildSimulationCampaign(stableLifeEffectsSource);
  const campaign: Campaign = {
    id: STABLE_LIFE_EFFECTS_CAMPAIGN_ID,
    kindId: "simulation",
    version: "1.0.0",
    titleKey: "stable-life-effects.campaign.title",
    content,
  };
  return buildCampaign(campaign, [
    { key: "stable-life-effects.campaign.title", text: "Stable Life: Effects" },
    EFFECT_DESCRIPTION,
    ...authoredText,
  ]);
}
