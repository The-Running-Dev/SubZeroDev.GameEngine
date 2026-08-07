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
import type { InitialStateResult } from "../../core/kernel/types.js";
import type { SimulationCampaign } from "./campaign.js";
import type {
  CalendarState,
  EconomyState,
  WorldState,
  GoalState,
  SimulationKindState,
} from "./state.js";
import type { InventoryItem, PlayerState } from "./actor.js";
import type { BackgroundDefinition, ScenarioDefinition } from "./content.js";

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
    skills,
    traits,
    reputation: {},
    flags: {},
    counters: {},
  };
}

function buildWorld(): WorldState {
  return {
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
}

/** One `GoalState` per `GoalDefinition` the campaign declares, all `"active"` — the
 *  `goals`/`failure` end-of-week systems (`endOfWeek.ts`) are what moves a goal off this
 *  starting state, never `initialState` itself. */
function startingGoals(goals: SimulationCampaign["goals"]): GoalState[] {
  return goals.map((goal) => ({
    definitionId: goal.id,
    status: "active",
    satisfiedThisWeek: false,
    consecutiveWeeksSatisfied: 0,
    progressNotes: [],
  }));
}

/**
 * Takes no `KindContext` — nothing here emits an event or draws randomness (week one gets
 * no start-of-week pass; §3's own callout is explicit that it hasn't run yet). A function
 * with fewer parameters than `Kind.initialState` declares still satisfies it structurally,
 * so there is no unused parameter to carry just for the interface match.
 */
export function initialState(campaign: Campaign): InitialStateResult<SimulationKindState> {
  const content = campaign.content as SimulationCampaign;
  const scenario = findScenario(content);
  const calendar = buildCalendar();

  const state: SimulationKindState = {
    calendar,
    player: buildPlayer(content, scenario),
    economy: STARTING_ECONOMY,
    world: buildWorld(),

    activeEffects: content.startingEffects ? [...content.startingEffects] : [],
    activeOpportunities: [],
    scheduledEvents: [],
    pendingEventResponses: [],

    goals: startingGoals(content.goals),
    plan: { week: calendar.currentWeek, actions: [] },
  };

  return { state, status: "active", changes: [], messages: [] };
}
