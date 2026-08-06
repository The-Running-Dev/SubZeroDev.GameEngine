/**
 * Simulation kind — the projection (10-simulation-kind.md §9).
 *
 * Contract: `10-simulation-kind.md` §9.
 *
 * `SimulationView` repeats nothing the generic `Scene`/`PlayerView` already carries —
 * identity, `gameId` and `status` live there already. `PublicWorldState` is the second
 * type this file declares: `AgentStrategy.selectActions` (`content.ts`, §7.10) resolves
 * against it now instead of an undeclared `unknown`.
 *
 * Never emitted, for either audience: `seed`, `actionLog`, raw `kindState`,
 * `AgentState.strategy`, `RelationshipState.resentment`, `AttributeState.luck`,
 * `ActorState.counters`, or an unrevealed `Opportunity` — asserted by name in `view.test.ts`,
 * not by review. `audience` is accepted (the `Kind.project` signature requires it) but not
 * branched on — this kind draws no `ai`-specific distinction yet, the same choice
 * `kinds/story-graph/view.ts` made.
 */

import type { KindContext } from "../../core/kernel/types.js";
import type { ProjectionAudience } from "../../core/projection/types.js";
import type { LocKey } from "../../core/localization/types.js";
import type { ActorIdentity, AttributeState, EducationState, CareerState, HousingState, InventoryItem, FinancialState, NeedState } from "./actor.js";
import type { ActionType, GameAction } from "./plan.js";
import type {
  Cents,
  BasisPoints,
  DemandBand,
  Opportunity,
  StatusEffect,
  PendingEventResponse,
  GoalProgressNote,
  LocationState,
  JobOpening,
} from "./state.js";
import { demandBand } from "./state.js";
import { ACTION_TYPES } from "./plan.js";
import type { SimulationKindState } from "./state.js";
import { resolveEffectiveAttributes, resolveEffectiveNeeds, resolveEffectiveSkills } from "./derived.js";

export interface VisibleRelationship {
  npcId: string;
  category: "professional" | "personal" | "transactional" | "adversarial";
  affinity: number;
  trust: number;
  respect: number;
  knownSinceWeek: number;
  lastInteractionWeek?: number;
  interactionCount: number;
}

export interface VisibleStatusEffect {
  id: string;
  sourceKind: StatusEffect["sourceKind"];
  descriptionKey: LocKey;
  expiresAtWeek?: number;
}

export interface VisibleOpportunity {
  id: string;
  kind: Opportunity["kind"];
  targetId: string;
  offeredWeek: number;
  expiresAtWeek: number;
}

export interface VisibleGoal {
  definitionId: string;
  status: "active" | "completed" | "failed";
  satisfiedThisWeek: boolean;
  consecutiveWeeksSatisfied: number;
  requiredDurationWeeks?: number;
  progressNotes: GoalProgressNote[];
}

export interface PublicLocationState {
  definitionId: string;
  discovered: boolean;
  accessible: boolean;
}

export interface PublicJobOpening {
  jobId: string;
  contested: boolean;
  positionsAvailable?: number;
  expiresAtWeek?: number;
}

/** Sector demand is banded, never the raw value (§2.5) — exposing the exact number would
 *  let a player optimise against the job-availability formula directly. An indicator key
 *  is present only when it is in `EconomyState.publishedIndicators`. */
export interface PublicEconomyView {
  sectorDemand: Record<string, DemandBand>;
  marketPrices: Record<string, Cents>;
  indicators: Partial<Record<"inflation" | "unemploymentRate" | "interestRate", BasisPoints>>;
}

export interface SimulationViewCalendar {
  currentWeek: number;
  currentYear: number;
  season?: "spring" | "summer" | "autumn" | "winter";
  totalTimeUnits: number;
  committedTimeUnits: number;
  /** Derived: `totalTimeUnits - committedTimeUnits - spentTimeUnits` (§2.1) — never stored. */
  availableTimeUnits: number;
}

export interface SimulationView {
  calendar: SimulationViewCalendar;

  identity: ActorIdentity;
  currentLocationId: string;
  finances: FinancialState;
  needs: NeedState;
  attributes: Omit<AttributeState, "luck">;
  education: EducationState;
  career: CareerState;
  housing: HousingState;
  inventory: InventoryItem[];
  relationships: VisibleRelationship[];

  skills: Record<string, number>;
  traits: string[];
  reputation: Record<string, number>;

  activeEffects: VisibleStatusEffect[];
  activeOpportunities: VisibleOpportunity[];
  pendingEventResponses: PendingEventResponse[];

  goals: VisibleGoal[];

  plan: {
    week: number;
    actions: readonly GameAction[];
    availableActionTypes: readonly ActionType[];
  };

  world: {
    locations: PublicLocationState[];
    jobMarket: { openings: PublicJobOpening[] };
    economy: PublicEconomyView;
  };
}

/** The shape `AgentStrategy.selectActions` (§7.10) decides from — "the same visible
 *  information a client would see," never an actor's own private state. Deliberately
 *  smaller than `SimulationView`: no finances, needs, or plan, since those belong to
 *  whichever actor is deciding, not to the world. Not yet exercised at runtime — no unit
 *  before this one wires a rival agent into `end_week`'s resolution. */
export interface PublicWorldState {
  calendar: SimulationViewCalendar;
  locations: PublicLocationState[];
  jobMarket: { openings: PublicJobOpening[] };
  economy: PublicEconomyView;
}

const PLAN_ACTION_TYPES: readonly ActionType[] = ACTION_TYPES.filter((t) => t !== "custom");

function visibleRelationships(relationships: SimulationKindState["player"]["relationships"]): VisibleRelationship[] {
  return relationships.map((r) => ({
    npcId: r.npcId,
    category: r.category,
    affinity: r.affinity,
    trust: r.trust,
    respect: r.respect,
    knownSinceWeek: r.knownSinceWeek,
    ...(r.lastInteractionWeek !== undefined ? { lastInteractionWeek: r.lastInteractionWeek } : {}),
    interactionCount: r.interactionCount,
  }));
}

function visibleEffects(effects: readonly StatusEffect[]): VisibleStatusEffect[] {
  return effects
    .filter((e) => e.visible)
    .map((e) => ({
      id: e.id,
      sourceKind: e.sourceKind,
      descriptionKey: e.descriptionKey,
      ...(e.expiresAtWeek !== undefined ? { expiresAtWeek: e.expiresAtWeek } : {}),
    }));
}

function visibleOpportunities(opportunities: readonly Opportunity[]): VisibleOpportunity[] {
  return opportunities.map((o) => ({
    id: o.id,
    kind: o.kind,
    targetId: o.targetId,
    offeredWeek: o.offeredWeek,
    expiresAtWeek: o.expiresAtWeek,
  }));
}

function visibleGoals(goals: SimulationKindState["goals"]): VisibleGoal[] {
  return goals.map((g) => ({
    definitionId: g.definitionId,
    status: g.status,
    satisfiedThisWeek: g.satisfiedThisWeek,
    consecutiveWeeksSatisfied: g.consecutiveWeeksSatisfied,
    ...(g.requiredDurationWeeks !== undefined ? { requiredDurationWeeks: g.requiredDurationWeeks } : {}),
    progressNotes: g.progressNotes,
  }));
}

function publicLocations(locations: readonly LocationState[]): PublicLocationState[] {
  return locations.map((l) => ({ definitionId: l.definitionId, discovered: l.discovered, accessible: l.accessible }));
}

function publicJobOpenings(openings: readonly JobOpening[]): PublicJobOpening[] {
  return openings.map((o) => ({
    jobId: o.jobId,
    contested: o.contested,
    ...(o.positionsAvailable !== undefined ? { positionsAvailable: o.positionsAvailable } : {}),
    ...(o.expiresAtWeek !== undefined ? { expiresAtWeek: o.expiresAtWeek } : {}),
  }));
}

function publicEconomy(economy: SimulationKindState["economy"]): PublicEconomyView {
  const sectorDemand: Record<string, DemandBand> = {};
  for (const key of Object.keys(economy.sectorDemand).sort()) {
    sectorDemand[key] = demandBand(economy.sectorDemand[key]!);
  }

  const marketPrices: Record<string, Cents> = {};
  for (const key of Object.keys(economy.marketPrices).sort()) {
    marketPrices[key] = economy.marketPrices[key]!;
  }

  const indicators: PublicEconomyView["indicators"] = {};
  for (const key of economy.publishedIndicators) {
    if (key === "inflation") indicators.inflation = economy.inflation;
    else if (key === "unemploymentRate") indicators.unemploymentRate = economy.unemploymentRate;
    else if (key === "interestRate") indicators.interestRate = economy.interestRate;
  }

  return { sectorDemand, marketPrices, indicators };
}

function calendarView(calendar: SimulationKindState["calendar"]): SimulationViewCalendar {
  return {
    currentWeek: calendar.currentWeek,
    currentYear: calendar.currentYear,
    ...(calendar.season !== undefined ? { season: calendar.season } : {}),
    totalTimeUnits: calendar.totalTimeUnits,
    committedTimeUnits: calendar.committedTimeUnits,
    availableTimeUnits: calendar.totalTimeUnits - calendar.committedTimeUnits - calendar.spentTimeUnits,
  };
}

export function project(
  state: SimulationKindState,
  audience: ProjectionAudience,
  ctx: KindContext,
): SimulationView {
  void audience;
  void ctx;

  return {
    calendar: calendarView(state.calendar),

    identity: state.player.identity,
    currentLocationId: state.player.currentLocationId,
    finances: state.player.finances,
    needs: resolveEffectiveNeeds(state),
    attributes: resolveEffectiveAttributes(state),
    education: state.player.education,
    career: state.player.career,
    housing: state.player.housing,
    inventory: state.player.inventory,
    relationships: visibleRelationships(state.player.relationships),

    skills: resolveEffectiveSkills(state),
    traits: state.player.traits,
    reputation: state.player.reputation,

    activeEffects: visibleEffects(state.activeEffects),
    activeOpportunities: visibleOpportunities(state.activeOpportunities),
    pendingEventResponses: state.pendingEventResponses,

    goals: visibleGoals(state.goals),

    plan: {
      week: state.plan?.week ?? state.calendar.currentWeek,
      actions: state.plan?.actions ?? [],
      availableActionTypes: PLAN_ACTION_TYPES,
    },

    world: {
      locations: publicLocations(state.world.locations),
      jobMarket: { openings: publicJobOpenings(state.world.jobMarket.openings) },
      economy: publicEconomy(state.economy),
    },
  };
}

/** Unused today (§7.10 — no unit before this one wires a rival into resolution); kept so
 *  `SimulationCampaign`'s own future scenario-agent wiring has a real builder to call
 *  rather than reconstructing this shape by hand at every future call site. */
export function projectPublicWorldState(state: SimulationKindState): PublicWorldState {
  return {
    calendar: calendarView(state.calendar),
    locations: publicLocations(state.world.locations),
    jobMarket: { openings: publicJobOpenings(state.world.jobMarket.openings) },
    economy: publicEconomy(state.economy),
  };
}
