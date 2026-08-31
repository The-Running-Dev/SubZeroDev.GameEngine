/**
 * Simulation kind — content-definition types (10-simulation-kind.md §7, §8.1).
 *
 * Contract: `10-simulation-kind.md` §7.1–§7.10, §8.1.
 *
 * Campaign data, loaded through the content registry (04 §10.1) exactly as story-graph
 * campaigns are — no new loading mechanism. Pure type declarations only; no resolution
 * logic, no wiring into `RESOLVER_TABLE` or the week pipeline (that's the next build unit,
 * against this settled surface — the same "contract before code" discipline the four
 * contract units W32–W35 already used one level up, per `plans/36-simulation-kind-
 * programme.md`'s own callout for why this unit exists on its own).
 *
 * `Requirement`/`RequirementType` (§8.1) are declared first even though they're formally a
 * different contract section — every type below references them by name, the same reason
 * `state.ts` colocated `NPCState` next to `WorldState` despite `NPCState` formally being
 * §7.7's content.
 *
 * `NPCState`/`AgentState`/`NPCMemory`/`NPCRelationship`/`AvailabilityRule`/`Modifier`
 * already exist in `state.ts` (W36) as runtime state, not campaign content — this file
 * ports only their content-side counterparts (`NPCDefinition`, `AgentStrategy`) and
 * everything else §7 names. `Reward` was the one §7.1 type `state.ts` didn't already need.
 */

import type { LocKey } from "../../core/localization/types.js";
import type { ReasonCode, OutcomeMessage } from "../../core/kernel/reasons.js";
import type { Condition } from "../../core/condition/types.js";
import type {
  Cents,
  BasisPoints,
  Modifier,
  NPCRelationship,
  AvailabilityRule,
  OpportunityKind,
  AgentState,
} from "./state.js";
import type { AttributeState, CredentialLevel, JobTier } from "./actor.js";
import type { ActionType, GameAction } from "./plan.js";
import type { ActionOutcome } from "./resolvers.js";
import type { PublicWorldState } from "./view.js";

// ---------------------------------------------------------------------------
// §8.1 Requirements — declared first; every §7 type below references it
// ---------------------------------------------------------------------------

export type RequirementType =
  | "skill" | "attribute" | "credential" | "item" | "money"
  | "relationship" | "location" | "event_completed" | "need"
  | "job_tier" | "age" | "flag";

export interface Requirement {
  type: RequirementType;
  condition: Condition;
  failureCode: ReasonCode;
  messageKey: LocKey;
}

// ---------------------------------------------------------------------------
// §7.1 Modifiers and Rewards — `Modifier` itself already lives in `state.ts`
// ---------------------------------------------------------------------------

export type RewardType =
  | "credential" | "skill" | "attribute" | "money" | "item"
  | "reputation" | "relationship" | "unlock_location"
  | "unlock_course" | "opportunity" | "flag" | "modifier"
  | "counter";

/** `target`/`value` are optional and untyped (`unknown`) across every `RewardType` — upstream
 *  never narrows a `"money"` reward's `value` from a `"modifier"` reward's, and this port does
 *  not invent that narrowing on upstream's behalf (§7.1's own "provisional, not resolved
 *  here" callout). **Revisit when** `Reward` gains a real dispatcher, not before. */
export interface Reward {
  type: RewardType;
  target?: string;
  value?: unknown;
  parameters?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// §7.2 Jobs
// ---------------------------------------------------------------------------

export interface JobSchedule {
  weeklyTimeCost: number;
  flexibility: number;
  requiredDays?: string[];
  shiftTypes?: string[];
  remoteEligible?: boolean;
}

export interface JobCompensation {
  baseWeeklyPayCents: Cents;
  performanceBonusCents?: Cents;
  commissionRate?: BasisPoints;
  overtimeRate?: BasisPoints;
  benefits?: string[];
}

export interface PerformanceFactor {
  source: "skill" | "attribute" | "need" | "relationship" | "item" | "housing";
  key: string;
  /** May be negative — stress, for instance. */
  weight: number;
}

export interface JobPerformanceRules {
  factors: PerformanceFactor[];
  /** Performance regresses toward this baseline absent other input. */
  weeklyDriftToward: number;
  minimumAcceptable: number;
}

export interface PromotionPath {
  toJobId: string;
  minimumWeeksInRole: number;
  minimumPerformance: number;
  requirements: Requirement[];
  contested: boolean;
  baseChance: number;
}

export interface TerminationRule {
  code: ReasonCode;
  condition: Condition;
  warningsBeforeTermination: number;
  severanceWeeks?: number;
  messageKey: LocKey;
}

/** `positionsAvailable` follows `JobOpening`'s own rule (`state.ts` §2.2): optional,
 *  absent = unbounded, never `Number.POSITIVE_INFINITY`. */
export interface JobDefinition {
  id: string;
  titleKey: LocKey;
  descriptionKey: LocKey;

  employerId: string;
  careerPathId: string;
  tier: JobTier;

  schedule: JobSchedule;
  compensation: JobCompensation;

  requirements: Requirement[];
  performance: JobPerformanceRules;

  promotionPaths: PromotionPath[];
  terminationRules: TerminationRule[];

  contested: boolean;
  positionsAvailable?: number;

  tags: string[];
}

// ---------------------------------------------------------------------------
// §7.3 Courses
// ---------------------------------------------------------------------------

export interface CourseFailureRules {
  minimumAttendanceRatio: number;
  minimumStudyUnitsPerWeek: number;
  maximumMissedSessions: number;
  tuitionGraceWeeks: number;
  maximumStress?: number;
  /** 0–100. */
  progressRetainedOnFailure: number;
}

export interface CourseDefinition {
  id: string;
  nameKey: LocKey;
  descriptionKey: LocKey;
  providerId: string;

  tuitionCents: Cents;
  durationWeeks: number;
  weeklyTimeCost: number;
  difficulty: number;

  /** Absent = uncapped. */
  seatsAvailable?: number;
  requirements: Requirement[];
  rewards: Reward[];
  awardsCredential?: CredentialLevel;

  failureRules: CourseFailureRules;
  tags: string[];
}

// ---------------------------------------------------------------------------
// §7.4 Housing
// ---------------------------------------------------------------------------

/** `comfort`/`safety` (with runtime `damage`, `actor.ts`) feed `player.housing.quality` —
 *  the derived, read-only value this kind computes rather than stores (§6.1, §6.9). */
export interface HousingDefinition {
  id: string;
  nameKey: LocKey;
  descriptionKey: LocKey;

  upfrontCostCents: Cents;
  weeklyCostCents: Cents;
  depositCents?: Cents;

  capacity: number;
  comfort: number;
  safety: number;
  prestige: number;
  storage: number;

  commuteModifier: number;
  energyRecoveryModifier: number;
  happinessModifier: number;
  healthModifier: number;

  maintenanceRisk: number;
  /** Absent = uncapped. */
  unitsAvailable?: number;

  requirements: Requirement[];
  tags: string[];
}

// ---------------------------------------------------------------------------
// §7.5 Items
// ---------------------------------------------------------------------------

export interface CheckDefinition {
  skill?: string;
  attribute?: keyof AttributeState;
  difficulty: number;

  modifiers?: CheckModifier[];
  criticalSuccessMargin?: number;
  criticalFailureMargin?: number;

  /** Default 5. */
  minimumChance?: number;
  /** Default 95. */
  maximumChance?: number;
}

export interface CheckModifier {
  source: "skill" | "attribute" | "need" | "reputation" | "relationship" | "item";
  key: string;
  weight: number;
}

export interface MaintenanceRule {
  intervalWeeks: number;
  costCents: Cents;
  timeCost: number;
  skillCheck?: CheckDefinition;
  conditionLossIfSkipped: number;
  breakageChanceAtZeroCondition: number;
}

export interface ItemDefinition {
  id: string;
  nameKey: LocKey;
  descriptionKey: LocKey;
  category: string;

  purchasePriceCents: Cents;
  baseResaleValueCents: Cents;
  weeklyCostCents?: Cents;

  effects: Modifier[];
  stacking: "refresh" | "stack";

  durability?: number;
  maintenanceRules?: MaintenanceRule[];

  requirements: Requirement[];
  tags: string[];
}

// ---------------------------------------------------------------------------
// §7.6 Events — `CheckDefinition`/`CheckModifier` declared above, in §7.5
// ---------------------------------------------------------------------------

export interface EventOutcome {
  effects: Modifier[];
  rewards?: Reward[];
  messages: OutcomeMessage[];

  generatedEvents?: string[];
  scheduledEvents?: Array<{ eventId: string; inWeeks: number }>;
  generatedOpportunities?: string[];

  advancesChain?: boolean;
  endsChain?: boolean;
}

export interface ConditionalOutcome {
  condition?: Condition;
  onDegree?: ActionOutcome["degree"][];
  weight?: number;
  outcome: EventOutcome;
}

export interface EventChoice {
  id: string;
  labelKey: LocKey;

  timeCost?: number;
  moneyCostCents?: Cents;

  requirements?: Requirement[];
  check?: CheckDefinition;

  outcomes: ConditionalOutcome[];
}

/**
 * An event whose selected choice has outcomes (has `choices` at all) defers to the
 * following week via `PendingEventResponse` (`state.ts` §2.3); an event with only
 * `automaticOutcome` resolves immediately within end-of-week processing (§3's end-of-week
 * order).
 */
export interface EventDefinition {
  id: string;
  category: string;
  titleKey: LocKey;
  descriptionKey: LocKey;

  weight: number;
  conditions: Condition;

  cooldownWeeks?: number;
  unique?: boolean;

  choices?: EventChoice[];
  automaticOutcome?: EventOutcome;

  chainId?: string;
  chainStep?: number;

  tags: string[];
}

// ---------------------------------------------------------------------------
// §7.7 NPCs — only the content half; `NPCState`/`NPCMemory`/`NPCRelationship`/
// `AvailabilityRule` already live in `state.ts` as runtime state
// ---------------------------------------------------------------------------

export interface NPCDefinition {
  id: string;
  nameKey: LocKey;
  descriptionKey: LocKey;

  defaultRole: string;
  initialRelationship: NPCRelationship;
  availability: AvailabilityRule[];

  tags: string[];
}

// ---------------------------------------------------------------------------
// §7.8 Goals, Scenarios, and Difficulty
// ---------------------------------------------------------------------------

export interface GoalDefinition {
  id: string;
  labelKey: LocKey;
  descriptionKey: LocKey;
  category: string;

  conditions: Condition;
  requiredDurationWeeks?: number;
  failureConditions?: Condition;

  rewards?: Reward[];
}

export type GameMode = "classic" | "open_life" | "challenge";

/** Default `"goals_win"`. Provisional against `week_limit_reached`'s own precedence — §12
 *  (Terminal Identity)'s own callout stands; restating the type here does not resolve it. */
export type GoalFailurePrecedence = "goals_win" | "failure_wins";

export interface ScenarioDefinition {
  id: string;
  nameKey: LocKey;
  descriptionKey: LocKey;

  startingBackgroundIds: string[];
  startingCashCents: Cents;
  startingHousingId: string;
  startingLocationId: string;
  startingInventory: Array<{ definitionId: string; quantity: number }>;

  goalIds: string[];
  weekLimit?: number;
  mode: GameMode;

  goalFailurePrecedence: GoalFailurePrecedence;

  /** Zero or more scripted rivals this scenario starts with (§7.8, W101). Absent or empty
   *  builds `WorldState.agents: []` exactly as `initialState` already does — this field adds
   *  a new source `initialState` reads, not a new default it can silently change. */
  rivals?: readonly RivalConfig[];
}

/** §7.10's own open gap, closed: the natural home it named for how a campaign selects a
 *  rival's engine-owned strategy (W101). One entry per rival this scenario starts with. */
export interface RivalConfig {
  /** `AgentState.id` (`state.ts`) — must be unique within this scenario's own `rivals` array. */
  agentId: string;
  /** `AgentStrategy.id` (§7.10, below) — Tier 1: `unknown_rival_strategy` when unresolved. */
  strategyId: string;
  displayNameKey: LocKey;

  /** Same `BackgroundDefinition` mechanism the player's own starting state uses. */
  startingBackgroundId: string;
  /** Applied once, at `initialState`, on top of the background. */
  initialConditions?: Modifier[];
}

/** Every rival advantage is declared here and nowhere else — what makes an "any advantage
 *  must be explicit" audit possible at all (§7.8's own callout, echoing §6.2's actor-state
 *  parity concern). */
export interface DifficultyDefinition {
  id: string;
  labelKey: LocKey;

  economyModifiers: Modifier[];
  needDriftModifiers: Modifier[];
  checkDifficultyOffset: number;

  rivalInformationAccess: "standard" | "enhanced";
  rivalStartingAdvantages: Modifier[];
}

// ---------------------------------------------------------------------------
// §7.9 Supporting Definitions
// ---------------------------------------------------------------------------

export interface OpportunityDefinition {
  id: string;
  kind: OpportunityKind;
  /** A jobId, courseId, housingId, or npcId — by `kind`. */
  targetId: string;

  nameKey: LocKey;
  descriptionKey: LocKey;

  /** How long the offer stands once made. */
  durationWeeks: number;
  /** Pool selection weight — hidden, never projected. */
  weight: number;
  /** Eligibility to be offered at all. */
  conditions?: Condition;
  /** What accepting demands. */
  requirements?: Requirement[];

  terms?: Record<string, unknown>;
  acceptRewards?: Reward[];
  /** May be revoked when the position is filled (`state.ts` §2.3). */
  contested: boolean;

  tags: string[];
}

export interface AchievementDefinition {
  id: string;
  /** Player-facing flavour, not a mechanical description. */
  nameKey: LocKey;
  descriptionKey: LocKey;

  /** Typically over counters (`actor.ts`'s `ActorState.counters`). */
  condition: Condition;
  /** `true` = not listed until unlocked. */
  hidden: boolean;

  /** v1: always profile-scoped. */
  scope: "profile";
}

export interface HeadlineDefinition {
  id: string;
  textKey: LocKey;

  minStrangeness?: number;
  maxStrangeness?: number;
  conditions?: Condition;

  tags: string[];
}

export interface EmployerDefinition {
  id: string;
  nameKey: LocKey;
  sector: string;
  /** Hidden. */
  reputation: number;
  jobIds: string[];
  npcIds: string[];
}

/**
 * `travel`'s map is an explicit adjacency graph, not pathfinding — `travel` moves to an
 * *adjacent* location only, valid when the target appears in `connections`, at a cost of
 * that location's own `travelTimeUnits`. A multi-hop journey costs multiple actions by
 * design (§7.9's own callout: geography is a real budget line, not a solved-away
 * convenience). An action whose type isn't in `actionTypes` fails with `wrong_location`.
 */
export interface LocationDefinition {
  id: string;
  nameKey: LocKey;
  descriptionKey: LocKey;

  /** Adjacent location ids — the map graph. */
  connections: string[];
  /** Cost to enter this location from an adjacent one. */
  travelTimeUnits: number;
  actionTypes: ActionType[];

  unlockedBy?: Condition;
}

export interface BackgroundDefinition {
  id: string;
  nameKey: LocKey;
  descriptionKey: LocKey;
  startingAttributes: AttributeState;
  startingSkills: Record<string, number>;
  startingCredentials: CredentialLevel[];
  startingTraits: string[];
  startingCashModifierCents: Cents;
}

export interface TraitDefinition {
  id: string;
  nameKey: LocKey;
  descriptionKey: LocKey;
  effects: Modifier[];
  conflictsWith: string[];
}

export interface SkillDefinition {
  id: string;
  nameKey: LocKey;
  category: string;
  decayPerWeek: number;
}

// ---------------------------------------------------------------------------
// §7.12 Projects and Businesses (W101)
// ---------------------------------------------------------------------------

/** "Definition declares the shape, `Requirement[]`/`Reward[]` reuse the existing vocabulary" —
 *  the same `JobDefinition`/`Employment` split (§6.8), against `ProjectRuntimeState` (`state.ts`
 *  §6.12). Neither adds a `RequirementType`, `RewardType`, or `Condition` operator of its own. */
export interface ProjectDefinition {
  id: string;
  nameKey: LocKey;
  descriptionKey: LocKey;

  /** Gates `start_project`. */
  requirements: Requirement[];
  /** Total `ProjectRuntimeState.progressUnits` to complete. */
  requiredUnits: number;
  /** `work_on_project`'s own time cost. */
  weeklyTimeCost: number;
  startCostCents: Cents;

  /** Granted once, on completion. */
  rewards: Reward[];
  tags: string[];
}

export interface BusinessDefinition {
  id: string;
  nameKey: LocKey;
  descriptionKey: LocKey;

  /** Gates `start_business`. */
  requirements: Requirement[];
  startupCostCents: Cents;

  /** Before modifiers (§7.1). */
  weeklyRevenueCents: Cents;
  /** Before modifiers (§7.1). */
  weeklyExpensesCents: Cents;
  /** Breached ⇒ `closedReason: "business_insolvent"` (`state.ts` §6.12). */
  minimumCashCents: Cents;

  tags: string[];
}

// ---------------------------------------------------------------------------
// §7.10 Agents — only the strategy half; `AgentState` already lives in `state.ts`
// ---------------------------------------------------------------------------

/**
 * Engine-owned, never campaign content (§7.10's own callout: `selectActions` is a function,
 * so it cannot be represented in campaign JSON/YAML at all) — a fixed, in-repository
 * registry of named behaviors, keyed by `id`. Declared here anyway, alongside the content
 * types, because `WorldState.agents: AgentState[]` and every other §7.10 reference already
 * treats it as part of this same cluster; §7.10 itself groups it with the content-definition
 * types for the same reason before calling out the distinction.
 *
 * `view`'s type is `PublicWorldState` (`view.ts`, §9) — declared there, alongside
 * `SimulationView`, by the same unit that closed this forward reference (W50).
 */
export interface AgentStrategy {
  id: string;
  selectActions(view: PublicWorldState, agent: AgentState): GameAction[];
}
