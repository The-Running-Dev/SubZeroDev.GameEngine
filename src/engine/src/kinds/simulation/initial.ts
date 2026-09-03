/**
 * Simulation kind — `Kind.initialState` (10-simulation-kind.md §3; W52.2).
 *
 * Contract: `10-simulation-kind.md` §3.
 *
 * **Builds week one from a `ScenarioDefinition`, not from literal state blobs.** Prior units
 * (W40–W51) authored `SimulationCampaign.startingCalendar`/`startingPlayer`/`startingEconomy`/
 * `startingWorld` directly; this unit resolves `campaign.scenarioId` against
 * `campaign.scenarios` and assembles the same four state slices from it plus the supporting
 * content it references (`backgrounds`, `housing`, `locations`, `items`) — the authoring
 * surface `campaign.ts`'s own header describes.
 *
 * Assumes `campaign` already passed `Kind.validateCampaign` (`validate.ts`): every id this
 * file resolves — `scenario.startingBackgroundIds`, `startingHousingId`, `startingLocationId`,
 * `startingInventory[].definitionId` — is Tier-1-checked to exist before a game ever starts,
 * so lookups here assume success rather than re-deriving a validation error.
 *
 * **Three judgement calls the contract doesn't settle, recorded here rather than guessed at
 * silently:**
 * - `startingBackgroundIds` is a *list*; `ActorIdentity.backgroundId` is a single field.
 *   `identity.backgroundId` takes the *first* listed background — the "primary" one for
 *   display — while every listed background still contributes mechanically below.
 * - Combining multiple backgrounds has no stated merge rule. Applied in listed order:
 *   `startingAttributes` (a complete `AttributeState` per background) replaces wholesale,
 *   later background wins; `startingSkills` merges key-by-key, later wins on conflict;
 *   `startingTraits` accumulates (union); `startingCashModifierCents` sums.
 *   `startingCredentials: CredentialLevel[]` is **not** converted into `EducationState`'s
 *   `Credential[]` — a `Credential` needs an `id`, a `courseId` and a `labelKey` a background
 *   has none of, and inventing that mapping here would be exactly the kind of "narrowing
 *   upstream never made" `content.ts`'s own `Reward` callout declines to do. Deferred until a
 *   real need forces the shape, the same status `Reward.value` already carries.
 * - `HousingDefinition` has no `ownership` field; every scenario starts `"renting"`, the
 *   only ownership mode a fresh move-in can be without a purchase/mortgage action this kind
 *   doesn't have yet (`resolvers.ts`).
 * - `ActorIdentity.name`/`age` and `NeedState`'s starting values have no source in §7 either
 *   — held as fixed engine defaults (`DEFAULT_PLAYER_NAME`/`DEFAULT_PLAYER_AGE`/
 *   `DEFAULT_STARTING_NEEDS` below), the same treatment `totalTimeUnits` and the starting
 *   `EconomyState` already get. A real per-scenario source for all three is a follow-up
 *   design decision, not one this unit's `Touches` covers.
 *
 * `ScenarioDefinition.weekLimit`/`mode` are read nowhere below — `outcome.ts`'s own header
 * already defers `week_limit_reached` for the identical reason (no settled precedence, no
 * state field to compare against); `mode`'s only stated effect (`WorldState.agents` doc
 * comment, `state.ts`) is rival configuration `content.ts` §7.10 calls a real, still-open gap.
 * Both stay authored-but-unconsumed, the same deferred status those sections already record.
 *
 * `totalTimeUnits` (14) and the starting `EconomyState` indicators are fixed engine
 * defaults, not sourced from any §7 content type — no collection here declares them
 * (upstream fixes `totalTimeUnits` at the same constant, 10 §2.1's own callout).
 */

import type { Campaign } from "../../core/registry/types.js";
import type { InitialStateResult, KindContext } from "../../core/kernel/types.js";
import type { SimulationCampaign } from "./campaign.js";
import type {
  AgentState,
  CalendarState,
  EconomyState,
  EventChainState,
  WorldState,
  GoalState,
  Modifier,
  SimulationKindState,
} from "./state.js";
import type { ActorState, InventoryItem, PlayerState } from "./actor.js";
import type { BackgroundDefinition, RivalConfig, ScenarioDefinition } from "./content.js";
import { combineModifiers, type ResolvedModifier } from "./modifiers.js";
import { furthestStepsFor, resolveProfileData } from "./profile.js";

/** Upstream's fixed weekly time budget (§2.1's own callout — not campaign-authored). */
const WEEKLY_TIME_UNITS = 14;

/** `ActorIdentity.name`/`age` have no source anywhere in §7: no `ScenarioDefinition` or
 *  `BackgroundDefinition` field names a starting player name or age. Held as the same fixed
 *  engine default every campaign predating this unit hardcoded, alongside
 *  `WEEKLY_TIME_UNITS`/`STARTING_ECONOMY` above — an open gap, not a scenario-specific
 *  value, until a real content type is added to carry it. */
const DEFAULT_PLAYER_NAME = "Alex";
const DEFAULT_PLAYER_AGE = 28;

/** `NeedState`'s starting values have no §7 source either — `BackgroundDefinition` declares
 *  `startingAttributes`/`startingSkills` but no `startingNeeds`. A real per-scenario or
 *  per-background field is the honest fix (out of scope: it would change `content.ts`'s
 *  declared shape, a signature change this unit's own `Touches` doesn't cover); until then
 *  every campaign starts at the same fixed baseline every campaign already hardcoded. */
const DEFAULT_STARTING_NEEDS: PlayerState["needs"] = { health: 80, energy: 50, happiness: 60, stress: 20, satiety: 80 };

/** Fixed engine starting economy — no §7 content type supplies these yet (this file's own
 *  header). */
const STARTING_ECONOMY: EconomyState = {
  inflation: 200,
  unemploymentRate: 500,
  interestRate: 300,
  sectorDemand: {},
  marketPrices: {},
  publishedIndicators: [],
  flags: {},
};

function findScenario(campaign: SimulationCampaign): ScenarioDefinition {
  return campaign.scenarios.find((s) => s.id === campaign.scenarioId)!;
}

function findBackgrounds(campaign: SimulationCampaign, scenario: ScenarioDefinition): BackgroundDefinition[] {
  return scenario.startingBackgroundIds.map((id) => campaign.backgrounds.find((b) => b.id === id)!);
}

function buildCalendar(): CalendarState {
  return {
    currentWeek: 1,
    currentYear: 1,
    totalTimeUnits: WEEKLY_TIME_UNITS,
    committedTimeUnits: 0,
    spentTimeUnits: 0,
  };
}

function buildPlayer(campaign: SimulationCampaign, scenario: ScenarioDefinition): PlayerState {
  const backgrounds = findBackgrounds(campaign, scenario);
  const housingDef = campaign.housing.find((h) => h.id === scenario.startingHousingId)!;

  const attributes = Object.assign({}, ...backgrounds.map((b) => b.startingAttributes)) as PlayerState["attributes"];
  const skills = Object.assign({}, ...backgrounds.map((b) => b.startingSkills)) as Record<string, number>;
  const traits = [...new Set(backgrounds.flatMap((b) => b.startingTraits))];
  const cashModifierCents = backgrounds.reduce((sum, b) => sum + b.startingCashModifierCents, 0);

  const inventory: InventoryItem[] = scenario.startingInventory.map((entry, index) => {
    const itemDef = campaign.items.find((i) => i.id === entry.definitionId)!;
    return {
      instanceId: `item-${index}`,
      definitionId: entry.definitionId,
      quantity: entry.quantity,
      acquiredWeek: 1,
      purchasePriceCents: itemDef.purchasePriceCents,
      condition: 100,
      weeksSinceMaintenance: 0,
      broken: false,
    };
  });

  return {
    identity: {
      actorId: "player",
      name: DEFAULT_PLAYER_NAME,
      age: DEFAULT_PLAYER_AGE,
      backgroundId: backgrounds[0]!.id,
    },
    currentLocationId: scenario.startingLocationId,
    finances: {
      cashCents: scenario.startingCashCents + cashModifierCents,
      savingsCents: 0,
      debtCents: 0,
      weeklyIncomeCents: 0,
      weeklyExpensesCents: 0,
      overdueBalanceCents: 0,
      accounts: [],
    },
    needs: DEFAULT_STARTING_NEEDS,
    attributes,
    education: { enrollments: [], credentials: [], completedCourseIds: [], failedCourseIds: [] },
    career: { history: [], totalWeeksEmployed: 0, pendingApplications: [], highestTierAchieved: "entry" },
    housing: {
      definitionId: housingDef.id,
      movedInWeek: 1,
      ownership: "renting",
      damage: 0,
      weeklyCostCents: housingDef.weeklyCostCents,
      depositPaidCents: housingDef.depositCents ?? 0,
      rentDueWeek: 1,
      overdueRentCents: 0,
      missedPayments: 0,
      evictionStage: "none",
    },
    inventory,
    relationships: [],
    projects: [],
    businesses: [],
    skills,
    traits,
    reputation: {},
    flags: {},
    counters: {},
  };
}

/** Every `Modifier` targeting the same field, combined by `modifiers.ts`'s own rule (§6.1:
 *  add/subtract summed, multiply combined into one product and rounded once) and applied
 *  directly to the field it names — a one-shot construction-time transform, not an ongoing
 *  `StatusEffect`. Only `player.needs.*`/`player.attributes.*`/`player.skills.*` are
 *  meaningful on a freshly-built actor (`validate.ts`'s own `WRITABLE_TARGET_PREFIXES`);
 *  anything else is silently a no-op rather than throwing on a validated campaign's own
 *  content. Clamped to `0–100`, this kind's declared integer range for all three (§6.2). */
function applyInitialConditions(actor: ActorState, modifiers: readonly Modifier[]): ActorState {
  if (modifiers.length === 0) return actor;

  const byTarget = new Map<string, ResolvedModifier[]>();
  for (const modifier of modifiers) {
    const list = byTarget.get(modifier.target) ?? [];
    list.push({ modifier, appliedWeek: 1 });
    byTarget.set(modifier.target, list);
  }

  let needs = actor.needs;
  let attributes = actor.attributes;
  let skills = actor.skills;

  for (const [target, resolved] of byTarget) {
    const clamp = (value: number): number => Math.min(100, Math.max(0, value));
    if (target.startsWith("player.needs.")) {
      const key = target.slice("player.needs.".length) as keyof typeof needs;
      needs = { ...needs, [key]: clamp(combineModifiers(needs[key], resolved)) };
    } else if (target.startsWith("player.attributes.")) {
      const key = target.slice("player.attributes.".length) as keyof typeof attributes;
      attributes = { ...attributes, [key]: clamp(combineModifiers(attributes[key], resolved)) };
    } else if (target.startsWith("player.skills.")) {
      const key = target.slice("player.skills.".length);
      skills = { ...skills, [key]: clamp(combineModifiers(skills[key] ?? 0, resolved)) };
    }
  }

  return { ...actor, needs, attributes, skills };
}

/** One `AgentState` per `RivalConfig`, in array order (§7.10, W101 — deterministic content
 *  order, not a runtime sort). A rival's starting `ActorState` is its own background —
 *  `RivalConfig.startingBackgroundId`, the same `BackgroundDefinition` mechanism the player's
 *  own `startingBackgroundIds` uses — with `initialConditions` applied on top.
 *  `DifficultyDefinition.rivalStartingAdvantages` stays unconsumed: no mechanism anywhere in
 *  this tree lets a campaign or player select a `DifficultyDefinition` yet, and wiring that
 *  selection is a different unit's `Touches`, not this one's (recorded in the slice's own
 *  plan/PR). A rival starts at the scenario's own location and housing — nothing in §7.8
 *  gives a rival its own, and `ActorState.housing` is not optional. */
function buildRivalActor(campaign: SimulationCampaign, scenario: ScenarioDefinition, rival: RivalConfig): ActorState {
  const background = campaign.backgrounds.find((b) => b.id === rival.startingBackgroundId)!;
  const housingDef = campaign.housing.find((h) => h.id === scenario.startingHousingId)!;

  const base: ActorState = {
    identity: {
      actorId: rival.agentId,
      name: rival.agentId,
      age: DEFAULT_PLAYER_AGE,
      backgroundId: background.id,
    },
    currentLocationId: scenario.startingLocationId,
    finances: {
      cashCents: background.startingCashModifierCents,
      savingsCents: 0,
      debtCents: 0,
      weeklyIncomeCents: 0,
      weeklyExpensesCents: 0,
      overdueBalanceCents: 0,
      accounts: [],
    },
    needs: DEFAULT_STARTING_NEEDS,
    attributes: background.startingAttributes,
    education: { enrollments: [], credentials: [], completedCourseIds: [], failedCourseIds: [] },
    career: { history: [], totalWeeksEmployed: 0, pendingApplications: [], highestTierAchieved: "entry" },
    housing: {
      definitionId: housingDef.id,
      movedInWeek: 1,
      ownership: "renting",
      damage: 0,
      weeklyCostCents: housingDef.weeklyCostCents,
      depositPaidCents: housingDef.depositCents ?? 0,
      rentDueWeek: 1,
      overdueRentCents: 0,
      missedPayments: 0,
      evictionStage: "none",
    },
    inventory: [],
    relationships: [],
    projects: [],
    businesses: [],
    skills: background.startingSkills,
    traits: [...background.startingTraits],
    reputation: {},
    flags: {},
    counters: {},
  };

  return applyInitialConditions(base, rival.initialConditions ?? []);
}

function buildAgents(campaign: SimulationCampaign, scenario: ScenarioDefinition): AgentState[] {
  return (scenario.rivals ?? []).map((rival) => ({
    id: rival.agentId,
    strategyId: rival.strategyId,
    displayNameKey: rival.displayNameKey,
    actor: buildRivalActor(campaign, scenario, rival),
    goals: [],
    planningDepth: 0,
    strategy: {},
    rngSeq: 0,
  }));
}

/**
 * `"profile"`-scoped chains only (§2.2) — a `"game"`-scoped chain is never seeded, and
 * `world.chainStates` starts empty of those exactly as it always has; the `events`
 * end-of-week system creates one the first time it fires. A `"profile"`-scoped chain's
 * `currentStep` seeds from the matching `SimulationProfileChainRecord.furthestStep`, or `0`
 * when the profile (or campaign) has none; `startedWeek: 0`; `active: false` until its next
 * step fires, the same as an unseeded chain.
 */
function seedProfileChains(campaign: SimulationCampaign, campaignId: string, profileData: unknown): EventChainState[] {
  const furthestSteps = furthestStepsFor(resolveProfileData(profileData), campaignId);
  return (campaign.eventChains ?? [])
    .filter((chain) => chain.scope === "profile")
    .map((chain) => ({
      chainId: chain.id,
      scope: "profile" as const,
      currentStep: furthestSteps.get(chain.id) ?? 0,
      startedWeek: 0,
      active: false,
    }));
}

/** `npcs`/`locations` start unpopulated — a documented gap, not an oversight (issue #425).
 *  §7.7/§7.9 forward-reference `NPCState`/`LocationState` as content-seeded runtime state,
 *  and GameOfLife's own lifecycle seeds one `NPCState` per `NPCDefinition` and one
 *  `LocationState` per reachable `LocationDefinition` at creation. Seeding them here was
 *  tried and reverted: it changes every committed replay/golden fixture's `world` shape
 *  (a `ReplayFixture`/corpus promotion is a reviewed one-way door, `08-session-capture.md`
 *  §7) and several shipped campaigns' `scenarios[].startingLocationId` has no matching
 *  `LocationDefinition` at all, which only stayed harmless while nothing read `world.
 *  locations`. Both are real defects this function is not the place to fix. `resolvers.ts`'s
 *  travel/socialize resolvers already read `campaign.locations`/`campaign.npcs` directly, so
 *  gameplay is unaffected; `view.ts`'s `PublicLocationState` projection stays empty until
 *  either the mirror is done deliberately (seeding plus fixing the campaign content that
 *  assumes it can skip declaring `LocationDefinition`s) or §2.2's `WorldState.npcs`/
 *  `locations` fields are narrowed to match what's actually shipped — a decision for
 *  `/contract`, not this file. */
function buildWorld(campaign: SimulationCampaign, scenario: ScenarioDefinition, campaignId: string, profileData: unknown): WorldState {
  return {
    npcs: [],
    locations: [],
    jobMarket: { openings: [] },
    eventCooldowns: {},
    firedUniqueEvents: [],
    chainStates: seedProfileChains(campaign, campaignId, profileData),
    strangenessBase: 0,
    headlinePool: { remainingIds: [], cyclesCompleted: 0 },
    agents: buildAgents(campaign, scenario),
    flags: {},
  };
}

/** One `GoalState` per `GoalDefinition` the *active scenario* declares via its own
 *  `goalIds` (§7.8) — not every `GoalDefinition` the campaign declares. A campaign's goals
 *  are scenario-scoped: §14's Tier 2 `unreachable_content` check already treats a
 *  `GoalDefinition` no scenario's `goalIds` names as unreachable, which only holds if a
 *  scenario never seeds another scenario's goals into a game it doesn't own. The
 *  `goals`/`failure` end-of-week systems (`endOfWeek.ts`) are what moves a goal off this
 *  starting state, never `initialState` itself. */
function startingGoals(campaign: SimulationCampaign, scenario: ScenarioDefinition): GoalState[] {
  return scenario.goalIds
    .map((id) => campaign.goals.find((g) => g.id === id)!)
    .map((goal) => ({
      definitionId: goal.id,
      status: "active",
      satisfiedThisWeek: false,
      consecutiveWeeksSatisfied: 0,
      progressNotes: [],
    }));
}

/**
 * `ctx` is unused below — nothing here emits an event or draws randomness (week one gets no
 * start-of-week pass; §3's own callout is explicit that it hasn't run yet) — but is declared
 * to match `Kind.initialState`'s signature exactly, the same as every other kind's own
 * `initialState`. `profileData` (§7.1) is the resolved, already-migrated cross-game slice;
 * absent for an anonymous session or a campaign declaring no `"profile"`-scoped chains.
 */
export function initialState(campaign: Campaign, _ctx?: KindContext, profileData?: unknown): InitialStateResult<SimulationKindState> {
  const content = campaign.content as SimulationCampaign;
  const scenario = findScenario(content);
  const calendar = buildCalendar();

  const state: SimulationKindState = {
    calendar,
    player: buildPlayer(content, scenario),
    economy: STARTING_ECONOMY,
    world: buildWorld(content, scenario, campaign.id, profileData),

    activeEffects: content.startingEffects ? [...content.startingEffects] : [],
    activeOpportunities: [],
    scheduledEvents: [],
    pendingEventResponses: [],

    goals: startingGoals(content, scenario),
    // §12 — a game starts live. Only `end_week`'s `goals`/`failure`/`week_limit` systems
    // ever write this, and only once (`endOfWeek.ts`).
    resolution: null,
    plan: { week: calendar.currentWeek, actions: [] },
  };

  return { state, status: "active", changes: [], messages: [] };
}
