/**
 * Content — "Стабилен живот" (Stable Life: Bulgaria), the full setting (10-simulation-kind.md
 * §7, §12; W72).
 *
 * **W72's job, not W71's.** W71 proved the mechanism with a voice-only layer over the same
 * campaign object `stable-life.ts` builds; every field there stayed structurally identical to
 * the base pack, so the two were deep-equal except for six overridden action/scene strings.
 * This file is a wholly independent `SimulationCampaignSource`, built and validated on its own,
 * authoring a Bulgarian jobs market, a bazaar, two events, a neighbour, a moped, a starting
 * effect, an opportunity and an achievement — every collection `stable-life.ts` populates, plus
 * the ones it leaves empty, per W72.1. It replaces `stable-life` wholesale by id (11 §3); the
 * base pack's own content is untouched by this file and stays reachable under `[base]` alone.
 *
 * **The goal keeps the base's exact numbers on purpose.** `goal-well-rested` mirrors
 * `stable-life.ts`'s `goal-well-rested` field-for-field (energy ≥ 70 sustained two weeks,
 * failure below 40) and the starting economics match too (200 lv start, 5000 stotinki/week
 * rent) — `endOfWeek.ts`'s drift and rent mechanics are engine-owned, not campaign content, so
 * the loss arc (do nothing four weeks) replays identically to the base pack's own. The win arc
 * is one week shorter here (two `rest`s, not the base's three) because `startingEffects`'
 * `effect-rakia-lek` grants a temporary +10 energy the base pack doesn't carry — see
 * `bulgaria-stable-life.replay.test.ts`'s own header for the arithmetic. Re-deriving different
 * threshold numbers would only risk an unproven arc; the "different game" claim rests on jobs,
 * places, events, possessions and voice, not on reinventing the wellbeing goal's thresholds.
 *
 * **Two locations, not one**, the same reason `stable-life-possessions.ts` added its market:
 * `home` for rest/work/study/events, `bazaar` for `shop`/`sell_item`/`repair_item` on the
 * moped — so `travel` and both possession resolvers are exercised by a real map rather than
 * only by a synthetic fixture campaign.
 */

import type { BuiltCampaign, Campaign } from "../core/registry/types.js";
import type { CommandResult } from "../core/kernel/reasons.js";
import { buildCampaign } from "../core/registry/build.js";
import { buildSimulationCampaign, type SimulationCampaignSource } from "../kinds/simulation/source.js";

export const BULGARIA_STABLE_LIFE_CAMPAIGN_ID = "stable-life";

const STARTING_EFFECT_DESCRIPTION = {
  key: "bulgaria-stable-life.effect.rakia-lek.description",
  text: "Ракия лек — дядо ти се закле, че лекува всичко. Временно повдига енергията.",
};

/**
 * `buildEvent` (`kinds/simulation/source.ts`) only lifts `title`/`description` into
 * `authoredText` — `EventChoice.labelKey` and `EventOutcome.messages[].key` pass through
 * unlifted (`validate.ts`'s `validateLocKeys` documents skipping them too), so every such
 * key an event uses has to be supplied here explicitly or it renders as a bare key to the
 * player.
 */
const EVENT_TEXT = [
  { key: "bulgaria-stable-life.event.power-cut.message", text: "Токът угасна посред вечеря. Свещите пак влизат в употреба." },
  { key: "bulgaria-stable-life.event.baba-letter.choice.open", text: "Отвори писмото" },
  { key: "bulgaria-stable-life.event.baba-letter.choice.call", text: "Обади се вместо това" },
  { key: "bulgaria-stable-life.event.baba-letter.message.opened", text: "Съвети, поръчения и едно наставление — всичко на два реда." },
  { key: "bulgaria-stable-life.event.baba-letter.message.called", text: "Гласът ѝ звучи същия, независимо колко години минават." },
];

export const bulgariaStableLifeSource: SimulationCampaignSource = {
  description: {
    key: "bulgaria-stable-life.campaign.description",
    text: "Дванайсет месеца, за да стъпиш на краката си — на бунището на базара, не другаде.",
  },

  jobs: [
    {
      id: "job-market-vendor",
      title: { key: "bulgaria-stable-life.job.vendor.title", text: "Продавач на базара" },
      description: {
        key: "bulgaria-stable-life.job.vendor.description",
        text: "Кантар, дребни пари и клиенти, които се пазарят за принцип.",
      },
      employerId: "employer-bazaar",
      careerPathId: "career-retail",
      tier: "entry",
      schedule: { weeklyTimeCost: 6, flexibility: 50 },
      compensation: { baseWeeklyPayCents: 30000, overtimeRate: 5000 },
      requirements: [],
      performance: { factors: [], weeklyDriftToward: 50, minimumAcceptable: 0 },
      promotionPaths: [],
      terminationRules: [],
      contested: false,
      tags: [],
    },
    {
      id: "job-market-bookkeeper",
      title: { key: "bulgaria-stable-life.job.bookkeeper.title", text: "Счетоводител на базара" },
      description: {
        key: "bulgaria-stable-life.job.bookkeeper.description",
        text: "Води тефтерите на всички щандове, включително и своя собствен.",
      },
      employerId: "employer-bazaar",
      careerPathId: "career-finance",
      tier: "skilled",
      schedule: { weeklyTimeCost: 6, flexibility: 50 },
      compensation: { baseWeeklyPayCents: 45000 },
      requirements: [{
        type: "skill",
        condition: { field: "player.skills.schetovodstvo", operator: "greater_or_equal", value: 50 },
        failureCode: "requirement_unmet",
        messageKey: "core.reason.requirement_unmet",
      }],
      performance: { factors: [], weeklyDriftToward: 50, minimumAcceptable: 0 },
      promotionPaths: [],
      terminationRules: [],
      contested: false,
      tags: [],
    },
  ],

  courses: [
    {
      id: "course-schetovodstvo",
      name: { key: "bulgaria-stable-life.course.schetovodstvo.name", text: "Основи на счетоводството" },
      description: {
        key: "bulgaria-stable-life.course.schetovodstvo.description",
        text: "Вечерен курс в читалището — тефтери, разписки и къде наистина отидоха парите.",
      },
      providerId: "provider-chitalishte",
      tuitionCents: 10000,
      durationWeeks: 2,
      weeklyTimeCost: 2,
      difficulty: 20,
      requirements: [],
      rewards: [{ type: "skill", target: "schetovodstvo", value: 50 }],
      awardsCredential: "certificate",
      failureRules: {
        minimumAttendanceRatio: 50,
        minimumStudyUnitsPerWeek: 1,
        maximumMissedSessions: 1,
        tuitionGraceWeeks: 0,
        progressRetainedOnFailure: 25,
      },
      tags: [],
    },
  ],

  housing: [
    {
      id: "housing-panelka",
      name: { key: "bulgaria-stable-life.housing.panelka.name", text: "Апартамент в панелка" },
      description: {
        key: "bulgaria-stable-life.housing.panelka.description",
        text: "Скромен, но наемът идва всяка седмица, независимо от всичко.",
      },
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

  items: [
    {
      id: "item-moped",
      name: { key: "bulgaria-stable-life.item.moped.name", text: "Стар мотопед" },
      description: {
        key: "bulgaria-stable-life.item.moped.description",
        text: "По-бърз от ходенето пеша, докато веригата не се скъса.",
      },
      category: "transport",
      purchasePriceCents: 8000,
      baseResaleValueCents: 4000,
      effects: [
        { target: "player.needs.energy", operation: "add", value: 5, sourceId: "item-moped" },
      ],
      stacking: "refresh",
      durability: 100,
      maintenanceRules: [
        {
          intervalWeeks: 1,
          costCents: 500,
          timeCost: 1,
          conditionLossIfSkipped: 50,
          breakageChanceAtZeroCondition: 0,
        },
      ],
      requirements: [],
      tags: [],
    },
  ],

  events: [
    {
      id: "event-power-cut",
      category: "household",
      title: { key: "bulgaria-stable-life.event.power-cut.title", text: "Токът спря" },
      description: {
        key: "bulgaria-stable-life.event.power-cut.description",
        text: "Без предупреждение, без обяснение, без ток.",
      },
      weight: 1,
      conditions: { field: "calendar.currentWeek", operator: "greater_or_equal", value: 2 },
      unique: true,
      automaticOutcome: {
        effects: [{ target: "player.needs.happiness", operation: "subtract", value: 5, durationWeeks: 1, sourceId: "event-power-cut" }],
        messages: [{ key: "bulgaria-stable-life.event.power-cut.message", visible: true }],
      },
      tags: [],
    },
    {
      id: "event-baba-letter",
      category: "household",
      title: { key: "bulgaria-stable-life.event.baba-letter.title", text: "Писмо от баба" },
      description: {
        key: "bulgaria-stable-life.event.baba-letter.description",
        text: "Адресирано до теб, изписано на ръка, с настоятелен подпис.",
      },
      weight: 1,
      conditions: { field: "calendar.currentWeek", operator: "greater_or_equal", value: 3 },
      unique: true,
      choices: [
        {
          id: "choice-open-it",
          labelKey: "bulgaria-stable-life.event.baba-letter.choice.open",
          timeCost: 1,
          outcomes: [{
            outcome: {
              effects: [{ target: "player.needs.stress", operation: "add", value: 5, durationWeeks: 1, sourceId: "event-baba-letter" }],
              messages: [{ key: "bulgaria-stable-life.event.baba-letter.message.opened", visible: true }],
            },
          }],
        },
        {
          id: "choice-call-instead",
          labelKey: "bulgaria-stable-life.event.baba-letter.choice.call",
          outcomes: [{
            outcome: {
              effects: [{ target: "player.needs.happiness", operation: "add", value: 5, durationWeeks: 1, sourceId: "event-baba-letter" }],
              messages: [{ key: "bulgaria-stable-life.event.baba-letter.message.called", visible: true }],
            },
          }],
        },
      ],
      tags: [],
    },
  ],

  npcs: [
    {
      id: "npc-komshiyka",
      name: { key: "bulgaria-stable-life.npc.komshiyka.name", text: "Комшийката" },
      description: {
        key: "bulgaria-stable-life.npc.komshiyka.description",
        text: "Винаги на стълбището, винаги по средата на нещо, което не е нейна работа.",
      },
      defaultRole: "neighbour",
      initialRelationship: { affinity: 10, trust: 10, respect: 10, resentment: 0 },
      availability: [{ locationId: "home" }],
      tags: [],
    },
  ],

  goals: [
    {
      id: "goal-well-rested",
      label: { key: "bulgaria-stable-life.goal.well-rested.label", text: "Отпочинал" },
      description: {
        key: "bulgaria-stable-life.goal.well-rested.description",
        text: "Задръж енергията си на 70 или повече две седмици подред.",
      },
      category: "wellbeing",
      conditions: { field: "player.needs.energy", operator: "greater_or_equal", value: 70 },
      requiredDurationWeeks: 2,
      failureConditions: { field: "player.needs.energy", operator: "less_than", value: 40 },
    },
  ],

  scenarios: [
    {
      id: "scenario-bulgaria-stable-life",
      name: { key: "bulgaria-stable-life.scenario.name", text: "Стабилен живот" },
      description: {
        key: "bulgaria-stable-life.scenario.description",
        text: "Дванайсет месеца, за да стъпиш на краката си.",
      },
      startingBackgroundIds: ["background-nachalo"],
      startingCashCents: 20000,
      startingHousingId: "housing-panelka",
      startingLocationId: "home",
      startingInventory: [{ definitionId: "item-moped", quantity: 1 }],
      goalIds: ["goal-well-rested"],
      mode: "classic",
      goalFailurePrecedence: "goals_win",
    },
  ],

  difficulties: [],
  projects: [],
  businesses: [],

  opportunities: [
    {
      id: "opportunity-komshiyka-coffee",
      kind: "social",
      targetId: "npc-komshiyka",
      name: { key: "bulgaria-stable-life.opportunity.coffee.name", text: "Кафе с комшийката" },
      description: {
        key: "bulgaria-stable-life.opportunity.coffee.description",
        text: "Тя вече е сложила кафеника. Отказът е технически възможен.",
      },
      durationWeeks: 1,
      weight: 1,
      requirements: [],
      contested: false,
      tags: [],
    },
  ],

  achievements: [
    {
      id: "achievement-purva-sedmitsa",
      name: { key: "bulgaria-stable-life.achievement.first-week.name", text: "Първата седмица" },
      description: {
        key: "bulgaria-stable-life.achievement.first-week.description",
        text: "Оцеля една седмица. Летвата си остава там, където си я оставил.",
      },
      condition: { field: "player.counters.need_drift", operator: "greater_or_equal", value: 1 },
      hidden: false,
      scope: "profile",
    },
  ],

  headlines: [
    {
      id: "headline-quiet",
      text: { key: "bulgaria-stable-life.headline.quiet", text: "Нищо особено никъде" },
      maxStrangeness: 4,
      tags: [],
    },
    {
      id: "headline-strange",
      text: { key: "bulgaria-stable-life.headline.strange", text: "Жителите съобщават, че нещо не е наред" },
      minStrangeness: 5,
      tags: [],
    },
  ],

  employers: [
    {
      id: "employer-bazaar",
      name: { key: "bulgaria-stable-life.employer.bazaar.name", text: "Централният базар" },
      sector: "retail",
      reputation: 50,
      jobIds: ["job-market-vendor", "job-market-bookkeeper"],
      npcIds: [],
    },
  ],

  locations: [
    {
      id: "home",
      name: { key: "bulgaria-stable-life.location.home.name", text: "Вкъщи" },
      description: { key: "bulgaria-stable-life.location.home.description", text: "Където седмицата започва и свършва." },
      connections: ["bazaar"],
      travelTimeUnits: 2,
      actionTypes: [
        "eat", "rest", "exercise", "socialize",
        "search_for_work", "apply_for_job", "negotiate_job_terms", "work", "work_overtime",
        "enroll_course", "attend_class", "study", "withdraw_course",
        "respond_to_event", "accept_opportunity", "decline_opportunity",
        "maintain_item", "repair_item", "travel",
      ],
    },
    {
      id: "bazaar",
      name: { key: "bulgaria-stable-life.location.bazaar.name", text: "Базарът" },
      description: { key: "bulgaria-stable-life.location.bazaar.description", text: "Всичко втора ръка, нищо гарантирано." },
      connections: ["home"],
      travelTimeUnits: 2,
      actionTypes: ["shop", "sell_item", "repair_item", "travel"],
    },
  ],

  backgrounds: [
    {
      id: "background-nachalo",
      name: { key: "bulgaria-stable-life.background.nachalo.name", text: "Ново начало" },
      description: {
        key: "bulgaria-stable-life.background.nachalo.description",
        text: "Без особена преднина, без особен недостиг.",
      },
      startingAttributes: {
        intelligence: 50, discipline: 50, charisma: 50, creativity: 50,
        resilience: 50, wisdom: 50, luck: 50,
      },
      startingSkills: { schetovodstvo: 0 },
      startingCredentials: [],
      startingTraits: [],
      startingCashModifierCents: 0,
    },
  ],

  traits: [],
  skills: [],

  scenarioId: "scenario-bulgaria-stable-life",
  goalFailurePrecedence: "goals_win",

  startingEffects: [
    {
      id: "effect-rakia-lek",
      sourceId: "fixture-rakia-lek",
      sourceKind: "system",
      modifiers: [
        { target: "player.needs.energy", operation: "add", value: 10, sourceId: "fixture-rakia-lek" },
      ],
      appliedWeek: 1,
      expiresAtWeek: 2,
      stacking: "refresh",
      descriptionKey: "bulgaria-stable-life.effect.rakia-lek.description",
      visible: true,
    },
  ],

  sceneTemplate: {
    key: "bulgaria-stable-life.scene.status",
    text: "Седмица {week}, година {year}. Пари: {cash} лв. Здраве {health} · Енергия {energy} · Щастие {happiness} · Стрес {stress} · Ситост {satiety}.",
  },
  actionLabels: {
    planAdd: { key: "bulgaria-stable-life.action.plan-add.label", text: "Добави към плана" },
    planRemove: { key: "bulgaria-stable-life.action.plan-remove.label", text: "Премахни от плана" },
    planClear: { key: "bulgaria-stable-life.action.plan-clear.label", text: "Изчисти плана" },
    endWeek: { key: "bulgaria-stable-life.action.end-week.label", text: "Приключи седмицата" },
  },
};

/** Mirrors `buildStableLifeCampaign`'s own assembly exactly — see its doc comment. */
export function buildBulgariaStableLifeCampaign(): CommandResult<BuiltCampaign> {
  const { content, authoredText } = buildSimulationCampaign(bulgariaStableLifeSource);
  const campaign: Campaign = {
    id: BULGARIA_STABLE_LIFE_CAMPAIGN_ID,
    kindId: "simulation",
    version: "1.0.0",
    titleKey: "bulgaria-stable-life.campaign.title",
    content,
  };
  return buildCampaign(campaign, [
    { key: "bulgaria-stable-life.campaign.title", text: "Стабилен живот" },
    STARTING_EFFECT_DESCRIPTION,
    ...EVENT_TEXT,
    ...authoredText,
  ]);
}
