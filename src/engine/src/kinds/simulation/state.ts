/**
 * Simulation kind — the runtime state (10-simulation-kind.md §2.1–§2.5).
 *
 * Contract: `10-simulation-kind.md` §2, §2.1–§2.5.
 *
 * Pure type declarations plus the one pure helper (`demandBand`) the contract names
 * alongside `EconomyState` — no resolution logic here. `NPCState`/`AgentState` (§7.7,
 * §7.10 in the contract) are runtime state too, not campaign content, despite their
 * content-side counterparts living in the future content-definition-types unit — see
 * `actor.ts`, which holds them alongside `ActorState` for the same reason the contract
 * places them together.
 */

import type { LocKey } from "../../core/localization/types.js";
import type { ActorState, PlayerState } from "./actor.js";
import type { WeeklyActionPlan } from "./plan.js";

/** Money is integer cents; rates are integer basis points (§2). Simulation-kind
 *  primitives — no other kind has a money concept. */
export type Cents = number;
export type BasisPoints = number;

// ---------------------------------------------------------------------------
// §2.1 Calendar State
// ---------------------------------------------------------------------------

export interface CalendarState {
  currentWeek: number;
  currentYear: number;
  season?: "spring" | "summer" | "autumn" | "winter";

  totalTimeUnits: number;
  committedTimeUnits: number;
  spentTimeUnits: number;
}

// ---------------------------------------------------------------------------
// §2.2 World State
// ---------------------------------------------------------------------------

export interface HeadlinePoolState {
  remainingIds: string[];
  shownThisWeek?: string;
  cyclesCompleted: number;
}

export interface LocationState {
  definitionId: string;
  discovered: boolean;
  accessible: boolean;
}

export interface JobOpening {
  jobId: string;
  contested: boolean;
  /** Absent = uncontested, unbounded (§2.2) — never `Number.POSITIVE_INFINITY`;
   *  `canonicalStringify` rejects non-finite numbers outright. */
  positionsAvailable?: number;
  postedWeek: number;
  expiresAtWeek?: number;
}

export interface JobMarketState {
  openings: JobOpening[];
}

export type ChainScope = "game" | "profile";

export interface EventChainState {
  chainId: string;
  scope: ChainScope;
  currentStep: number;
  startedWeek: number;
  active: boolean;
}

export interface WorldState {
  npcs: NPCState[];
  locations: LocationState[];

  jobMarket: JobMarketState;
  /** eventId → week last fired. Sorted-iteration rule applies (§2). */
  eventCooldowns: Record<string, number>;
  firedUniqueEvents: string[];
  chainStates: EventChainState[];

  /** 0–100; the derived value (§6.1) adds modifiers. Never appears in a projection. */
  strangenessBase: number;
  headlinePool: HeadlinePoolState;

  /** Rivals; empty in `open_life` mode. */
  agents: AgentState[];

  flags: Record<string, boolean>;
}

// ---------------------------------------------------------------------------
// §2.3 Effects, Opportunities, and Scheduled Events
// ---------------------------------------------------------------------------

/** A campaign-declared modifier, applied over a base value (§6.1). Small enough, and
 *  referenced structurally enough from state (`StatusEffect.modifiers`), to belong here
 *  rather than waiting on the larger content-definition-types unit. */
export interface Modifier {
  /** Must resolve to a writable *stored* field — never a §6.1 `DerivedPath`. */
  target: string;
  operation: "add" | "subtract" | "multiply" | "set";
  value: number;
  durationWeeks?: number;
  sourceId: string;
  /** `set` conflict resolution; default 0. */
  priority?: number;
}

export interface StatusEffect {
  id: string;
  sourceId: string;
  sourceKind: "item" | "housing" | "trait" | "event" | "job" | "course" | "system";

  modifiers: Modifier[];

  appliedWeek: number;
  /** Absent = permanent while source persists. */
  expiresAtWeek?: number;
  stacking: "refresh" | "stack";
  descriptionKey: LocKey;
  visible: boolean;
}

export type OpportunityKind =
  | "job_offer" | "promotion" | "course_place"
  | "housing" | "business" | "social";

export interface Opportunity {
  /** Unique per occurrence. */
  id: string;
  definitionId: string;
  kind: OpportunityKind;
  targetId: string;

  offeredWeek: number;
  expiresAtWeek: number;

  terms?: Record<string, unknown>;
}

export interface ScheduledEvent {
  id: string;
  eventId: string;
  scheduledWeek: number;
  createdWeek: number;

  chainId?: string;
  chainStep?: number;
  payload?: Record<string, unknown>;
}

export interface PendingEventResponse {
  id: string;
  eventId: string;
  /** Week N — when it fired. */
  rolledWeek: number;
  /** Week N+1 — when the player answers. */
  presentWeek: number;
  availableChoiceIds: string[];
}

// ---------------------------------------------------------------------------
// §2.4 Goal State
// ---------------------------------------------------------------------------

export interface GoalProgressNote {
  conditionIndex: number;
  satisfied: boolean;
  currentValue: unknown;
  targetValue: unknown;
}

export interface GoalState {
  definitionId: string;
  status: "active" | "completed" | "failed";

  satisfiedThisWeek: boolean;
  /** Resets to zero on any unsatisfied week — no partial credit. */
  consecutiveWeeksSatisfied: number;
  requiredDurationWeeks?: number;

  firstSatisfiedWeek?: number;
  completedWeek?: number;
  failedWeek?: number;

  progressNotes: GoalProgressNote[];
}

// ---------------------------------------------------------------------------
// §2.5 Economy State
// ---------------------------------------------------------------------------

export interface EconomyState {
  inflation: BasisPoints;
  unemploymentRate: BasisPoints;
  interestRate: BasisPoints;

  /** Exact value — hidden. Sorted-iteration rule applies (§2). */
  sectorDemand: Record<string, number>;
  /** Sorted-iteration rule applies (§2). */
  marketPrices: Record<string, Cents>;

  /** Which keys the player is allowed to see. */
  publishedIndicators: string[];
  flags: Record<string, boolean>;
}

export type DemandBand = "cold" | "steady" | "hot";

/** `<35` cold, `35–65` steady, `>65` hot. Thresholds are provisional (`TODO.md`'s
 *  *Known Open Items*) — tune once real demand distributions exist to tune against. */
export function demandBand(value: number): DemandBand {
  if (value < 35) return "cold";
  if (value <= 65) return "steady";
  return "hot";
}

// ---------------------------------------------------------------------------
// NPC and Agent runtime state (contract §7.7, §7.10 — state, not content)
// ---------------------------------------------------------------------------

export interface AvailabilityRule {
  locationId?: string;
  fromWeek?: number;
  toWeek?: number;
  /** `Condition`, deferred to whichever unit actually evaluates availability — kept as
   *  `unknown` here rather than importing the core `Condition` type for a field nothing
   *  in this unit reads. */
  condition?: unknown;
}

export interface NPCMemory {
  id: string;
  /** Whom this memory concerns — an `ActorIdentity.actorId` (`actor.ts`). */
  aboutActorId: string;
  eventId?: string;
  week: number;

  category: string;
  magnitude: number;

  descriptionKey: LocKey;
  expiresAtWeek?: number;
}

/** The affective dimensions, structurally — held by actors (`actor.ts`'s
 *  `RelationshipState`), not by NPCs. */
export interface NPCRelationship {
  affinity: number;
  trust: number;
  respect: number;
  /** Hidden — never appears in a projection. */
  resentment: number;
}

export interface NPCState {
  id: string;
  definitionId: string;

  memories: NPCMemory[];

  currentRole: string;
  availability: AvailabilityRule[];

  flags: Record<string, boolean>;
}

/** Import cycle note: `AgentState.actor: ActorState` is declared in `actor.ts`, which
 *  itself has no need to import from this file — `WorldState.agents` is the only
 *  direction the reference runs. */
export interface AgentState {
  id: string;
  strategyId: string;
  displayNameKey: LocKey;

  actor: ActorState;

  goals: GoalState[];

  planningDepth: number;
  /** Hidden — never projected. */
  strategy: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// §2 KindState — What Belongs Here
// ---------------------------------------------------------------------------

export interface SimulationKindState {
  calendar: CalendarState;
  player: PlayerState;
  economy: EconomyState;
  world: WorldState;

  activeEffects: StatusEffect[];
  activeOpportunities: Opportunity[];
  scheduledEvents: ScheduledEvent[];
  pendingEventResponses: PendingEventResponse[];

  goals: GoalState[];
  /** The week being assembled. */
  plan: WeeklyActionPlan | null;
}
