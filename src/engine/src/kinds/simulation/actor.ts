/**
 * Simulation kind — the shared actor shape (10-simulation-kind.md §6.1–§6.11).
 *
 * Contract: `10-simulation-kind.md` §6.2–§6.11.
 *
 * `ActorState` comes over whole, shared verbatim by the player and every rival
 * (`plans/36-simulation-kind-programme.md` Finding 1) — there is exactly one shape here,
 * never a narrower "player-only" version. Pure type declarations only; no logic.
 */

import type { LocKey } from "../../core/localization/types.js";
import type { ReasonCode } from "../../core/kernel/reasons.js";
import type { Cents, BasisPoints } from "./state.js";

// ---------------------------------------------------------------------------
// §6.3 Identity
// ---------------------------------------------------------------------------

export interface ActorIdentity {
  /** `"player"` or a rival's agent id. */
  actorId: string;
  name: string;
  age: number;
  backgroundId: string;
}

export type PlayerIdentity = ActorIdentity;

// ---------------------------------------------------------------------------
// §6.4 Finances
// ---------------------------------------------------------------------------

export interface FinancialAccount {
  id: string;
  kind: "checking" | "savings" | "credit_card" | "loan" | "investment";
  label: LocKey;

  /** Negative = owed. */
  balanceCents: Cents;
  /** Per annum. */
  interestRate: BasisPoints;

  minimumPaymentCents?: Cents;
  paymentDueWeek?: number;

  openedWeek: number;
  closedWeek?: number;
}

export interface FinancialState {
  cashCents: Cents;
  savingsCents: Cents;
  debtCents: Cents;

  weeklyIncomeCents: Cents;
  weeklyExpensesCents: Cents;

  overdueBalanceCents: Cents;
  creditScore?: number;

  accounts: FinancialAccount[];
}

// ---------------------------------------------------------------------------
// §6.5 Needs
// ---------------------------------------------------------------------------

export interface NeedState {
  health: number;
  energy: number;
  happiness: number;
  stress: number;
  satiety: number;
}

export type NeedKey = keyof NeedState;

export const NEED_POLARITY: Record<NeedKey, "higher_is_better" | "lower_is_better"> = {
  health: "higher_is_better",
  energy: "higher_is_better",
  happiness: "higher_is_better",
  satiety: "higher_is_better",
  stress: "lower_is_better",
};

// ---------------------------------------------------------------------------
// §6.6 Attributes
// ---------------------------------------------------------------------------

export interface AttributeState {
  intelligence: number;
  discipline: number;
  charisma: number;
  creativity: number;
  resilience: number;
  /** No consumer yet — tracked in `TODO.md`'s *Known Open Items*, not repeated here. */
  wisdom: number;
  /** Hidden — never appears in a projection. */
  luck: number;
}

// ---------------------------------------------------------------------------
// §6.7 Education
// ---------------------------------------------------------------------------

export type CredentialLevel =
  | "none"
  | "school"
  | "certificate"
  | "diploma"
  | "degree"
  | "postgraduate";

export interface CourseEnrollment {
  courseId: string;
  startedWeek: number;
  weeksCompleted: number;

  attendedUnits: number;
  studyUnits: number;
  missedSessions: number;

  tuitionPaidCents: Cents;
  tuitionOutstandingCents: Cents;

  /** 0–100, carried from a prior failed attempt. */
  retainedProgress: number;
  status: "active" | "completed" | "failed" | "withdrawn";
}

export interface Credential {
  id: string;
  courseId: string;
  awardedWeek: number;
  level: CredentialLevel;
  labelKey: LocKey;
}

export interface EducationState {
  enrollments: CourseEnrollment[];
  credentials: Credential[];
  completedCourseIds: string[];
  failedCourseIds: string[];
}

// ---------------------------------------------------------------------------
// §6.8 Career
// ---------------------------------------------------------------------------

export type JobTier = "entry" | "skilled" | "professional" | "senior";

export const JOB_TIER_RANK: Record<JobTier, number> = {
  entry: 0,
  skilled: 1,
  professional: 2,
  senior: 3,
};

export interface Employment {
  jobId: string;
  employerId: string;
  startedWeek: number;

  /** 0–100. */
  performance: number;
  /** 0–100, rolling. */
  attendanceRatio: number;
  warnings: number;
  probationUntilWeek?: number;

  weeklyPayCents: Cents;
  weeksAtCurrentPay: number;
}

export interface EmploymentRecord {
  jobId: string;
  employerId: string;
  tier: JobTier;
  startedWeek: number;
  endedWeek: number;
  endReason: ReasonCode;
  finalPerformance: number;
}

export interface JobApplication {
  jobId: string;
  submittedWeek: number;
  resolvesWeek: number;
  contested: boolean;
  outcome?: "pending" | "offered" | "rejected" | "position_filled";
}

export interface CareerState {
  currentEmployment?: Employment;
  history: EmploymentRecord[];

  totalWeeksEmployed: number;
  pendingApplications: JobApplication[];

  highestTierAchieved: JobTier;
}

// ---------------------------------------------------------------------------
// §6.9 Housing
// ---------------------------------------------------------------------------

export type EvictionStage =
  | "none"
  | "warning"
  | "penalty"
  | "formal_notice"
  | "hearing_scheduled"
  | "evicted";

export interface HousingState {
  definitionId: string;
  movedInWeek: number;

  ownership: "renting" | "owned" | "mortgaged" | "staying_with_someone";

  /** 0–100, mutable. */
  damage: number;
  weeklyCostCents: Cents;
  depositPaidCents: Cents;

  rentDueWeek: number;
  overdueRentCents: Cents;
  missedPayments: number;
  evictionStage: EvictionStage;

  landlordNpcId?: string;
}

// ---------------------------------------------------------------------------
// §6.10 Inventory
// ---------------------------------------------------------------------------

export interface InventoryItem {
  instanceId: string;
  definitionId: string;

  quantity: number;
  acquiredWeek: number;
  purchasePriceCents: Cents;

  /** 0–100. */
  condition: number;
  weeksSinceMaintenance: number;
  broken: boolean;
}

// ---------------------------------------------------------------------------
// §6.11 Relationships
// ---------------------------------------------------------------------------

export interface RelationshipState {
  npcId: string;
  category: "professional" | "personal" | "transactional" | "adversarial";

  affinity: number;
  trust: number;
  respect: number;
  /** Hidden — never appears in a projection. */
  resentment: number;

  knownSinceWeek: number;
  lastInteractionWeek?: number;
  interactionCount: number;
}

// ---------------------------------------------------------------------------
// §6.2 The Shared Actor Shape
// ---------------------------------------------------------------------------

export interface ActorState {
  identity: ActorIdentity;
  currentLocationId: string;
  finances: FinancialState;
  needs: NeedState;
  attributes: AttributeState;

  education: EducationState;
  career: CareerState;
  housing: HousingState;

  inventory: InventoryItem[];
  relationships: RelationshipState[];

  /** Needs, skills, attributes and reputation values are integers in `0–100` — enforced
   *  by Tier 1 validation and typed reducers on write, not by the `number` type itself. */
  skills: Record<string, number>;
  traits: string[];
  reputation: Record<string, number>;

  flags: Record<string, boolean>;
  /** Hidden — never appears in a projection. Automatically incremented per emitted
   *  `StateChange.reason`, and explicitly from a `"counter"`-type `Reward`. */
  counters: Record<string, number>;
}

/** The player is an actor. Alias kept for readability at call sites. */
export type PlayerState = ActorState;
