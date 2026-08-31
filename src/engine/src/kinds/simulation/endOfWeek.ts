/**
 * Simulation kind — the end-of-week systems (10-simulation-kind.md §3, upstream §12.2).
 *
 * Contract: `10-simulation-kind.md` §3.
 *
 * Sixteen systems, in the normative order the contract fixes:
 * `employment, education, finance_income, business, inventory, housing, finance_reconcile,
 * needs, relationships, opportunities, events, headline, goals, failure, week_limit,
 * achievements`. `history` is deliberately absent, not stubbed — it is not adopted state
 * (§2), so there is nothing for a system to mutate; skipping it entirely is the correct
 * behavior, not a missing one.
 *
 * **`business` (§7.12, W101) sits immediately after `finance_income`, before `inventory`/
 * `housing`** — business revenue/expenses must post before `housing` charges rent, the same
 * reason `finance_income` itself runs before `housing` (`90-decisions.md`'s W101 gate 3).
 *
 * **W57 closes the last of the stubs.** `opportunities` gains revoke and offer either side
 * of the expiry it already had, `events` fires scheduled and random events, `headline`
 * chooses a headline from derived world strangeness, `achievements` unlocks against
 * `AchievementDefinition.condition`, and `week_limit` — a system upstream never named — makes
 * the third terminal path reachable. `relationships` is now the only stub left, and stays
 * one: no weekly relationship rule exists anywhere in this contract to implement (see its
 * own definition site below, and W56's *Out of scope*). Every system emits
 * `kind.simulation.system.ran` at `trace` (§11), the same ordering-verification technique
 * `startOfWeek.ts` uses. `goals`/`failure` additionally emit `goal.achieved`/`goal.failed`
 * (§11, `info`) per goal transitioning this week — `week.ended` itself is `advance.ts`'s
 * own emit, once, after this whole pipeline returns.
 *
 * **`employment`/`finance_income`/`housing` (W53).** `employment` does two jobs: it
 * resolves `CareerState.pendingApplications` whose `resolvesWeek` has arrived into a real
 * `Employment` (§7.2's own reasoning for why hiring lives here and not in
 * `resolvers.ts`'s `apply_for_job`), and it advances any existing `Employment.performance`
 * — toward `JobPerformanceRules.weeklyDriftToward` absent work this week, or up by a fixed
 * bonus if `player.flags.workedThisWeek` — then checks each uncontested `PromotionPath`
 * (contested promotion competition is out of scope here, §5.1's own `Requirement`
 * evaluation reused via `evaluateSimulationCondition`). `finance_income` pays
 * `Employment.weeklyPayCents` (plus overtime, from `player.flags.workedOvertimeThisWeek`)
 * into `cashCents` — real logic, but still a stub for wages, scheduled expenses, or courses
 * this unit doesn't wire. `housing` levies `HousingState.weeklyCostCents` against that same
 * `cashCents`, real enough to prove §3's own ordering claim: "`finance_income` ... must run
 * *before* `housing`, so rent is payable from this week's own wages." Both read
 * `jobs: readonly JobDefinition[]`, threaded in from `advance.ts`'s own `content.jobs` —
 * the same parameter shape `goalDefs` already uses.
 *
 * **`finance_reconcile` (W55).** `housing` (above) charges the full rent unconditionally —
 * `cashCents` may go negative, proving §3's ordering claim by an actual overdraw — but
 * returns `missedCents`, computed from this week's own charge alone (never read back off a
 * balance that may already carry prior weeks' unresolved debt), which this system alone
 * consumes. A nonzero `missedCents` levies a placeholder 10% late fee on top
 * of it into `HousingState.overdueRentCents`, increments `missedPayments`, and advances
 * `evictionStage` by exactly one rung on a fixed ladder (`none → warning → penalty →
 * formal_notice → hearing_scheduled → evicted`) — never more than one, regardless of how
 * large the shortfall. A week `housing` fully collected is a no-op here: arrears already on
 * the books are untouched, since this system only ever escalates. The only cure is
 * `resolvers.ts`'s `pay_bills`, which clears `overdueRentCents`/`missedPayments` and resets
 * `evictionStage` to `"none"` — a player action, not an end-of-week system, the same split
 * `financeIncome`/`housing` already draw between "happens regardless" and "something the
 * player did."
 *
 * **`education` (W54).** Advances every *active* `CourseEnrollment` by one week: `weeksCompleted`
 * always increments, `attendedUnits`/`missedSessions` split on whether `resolvers.ts`'s
 * `attend_class` set `player.flags.attendedClass:<courseId>` this week (cleared here once
 * read, the same clear-after-both-consumers-have-seen-it discipline `financeIncome` already
 * uses for the two work flags). Once `weeksCompleted` reaches `CourseDefinition.durationWeeks`,
 * `CourseFailureRules` decides pass or fail — attendance ratio, missed-session count, total
 * `studyUnits` against `minimumStudyUnitsPerWeek × durationWeeks`, and (if set) a stress cap.
 * A pass applies the course's `"skill"`-type `Reward`s (raising `player.skills.<id>` to at
 * least the reward's value — never lowering an already-higher skill) and, if
 * `awardsCredential` is set, appends a `Credential`; a fail sets `retainedProgress` from
 * `CourseFailureRules.progressRetainedOnFailure`. Either way the enrollment's own `status`
 * flips and it stays in `enrollments` as history — unlike a filled `JobOpening`, nothing here
 * removes it. Threaded `courses: readonly CourseDefinition[]` the same plain-parameter way
 * `jobs` already is.
 */

import type { ResolutionEmitter } from "../../core/observability/types.js";
import type { RngHandle } from "../../core/determinism/types.js";
import type { OutcomeMessage, StateChange } from "../../core/kernel/reasons.js";
import type { ActorState, Credential, CourseEnrollment, Employment, EvictionStage, JobApplication, NeedKey, RelationshipState } from "./actor.js";
import type { AttendanceTrackingConfig, RelationshipDriftRule } from "./campaign.js";
import type {
  AchievementDefinition,
  BusinessDefinition,
  CourseDefinition,
  EventDefinition,
  EventOutcome,
  GoalDefinition,
  GoalFailurePrecedence,
  HeadlineDefinition,
  ItemDefinition,
  JobDefinition,
  OpportunityDefinition,
} from "./content.js";
import { evaluateSimulationCondition } from "./conditions.js";
import { derivedValueResolver } from "./derived.js";
import { runSystems, type SystemEntry } from "../../core/pipeline/systems.js";
import { SIMULATION_EVENTS } from "./events.js";
import { collectModifiers, combineModifiers, insertStatusEffect } from "./modifiers.js";
import { governingMaintenanceRule } from "./resolvers.js";
import type {
  Cents,
  ContestClaim,
  GoalState,
  JobOpening,
  Opportunity,
  PendingEventResponse,
  ScheduledEvent,
  SimulationKindState,
  SimulationResolution,
  StatusEffect,
} from "./state.js";
import { resolveContest } from "./state.js";

function ranSystem(emit: ResolutionEmitter, system: string): void {
  emit.emit(SIMULATION_EVENTS.systemRan.name, SIMULATION_EVENTS.systemRan.severity, { data: { system, phase: "end_of_week" } });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Weekly need drift, real logic against provisional rates — `TODO.md`'s *Known Open
 * Items* already tracks these as needing a balancing pass once the sim harness runs;
 * the mechanism (drift, then clamp once, emitting one `StateChange` per touched need) is
 * genuine, only the numbers are placeholder. Drifts the *base* value (§6.1) — `derived.ts`
 * layers any active `player.needs.*` modifier over this on read, so drift and modifiers
 * never fight over the same stored number.
 */
const DRIFT_PER_WEEK: Readonly<Record<NeedKey, number>> = {
  health: -1,
  energy: -3,
  happiness: -2,
  satiety: -4,
  stress: 2,
};

function needs(state: SimulationKindState): { state: SimulationKindState; changes: StateChange[] } {
  const changes: StateChange[] = [];
  const nextNeeds = { ...state.player.needs };

  for (const key of (Object.keys(DRIFT_PER_WEEK) as NeedKey[]).sort()) {
    const before = state.player.needs[key];
    const after = clamp(before + DRIFT_PER_WEEK[key], 0, 100);
    if (after === before) continue;
    nextNeeds[key] = after;
    changes.push({
      path: `player.needs.${key}`,
      op: "set",
      value: after,
      previous: before,
      reason: "need_drift",
      visible: true,
    });
  }

  return {
    state: { ...state, player: { ...state.player, needs: nextNeeds } },
    changes,
  };
}

/** An opportunity is live for the week only while `expiresAtWeek` is still ahead of it —
 *  one predicate, applied both when expiring a standing offer and when deciding whether a
 *  freshly generated one is even worth adding (see `opportunities` below). */
function stillOpen(expiresAtWeek: number, currentWeek: number): boolean {
  return expiresAtWeek > currentWeek;
}

/**
 * **`RngHandle.weightedPick` throws on any weight that is not a positive integer**
 * (`core/determinism/pcg32.ts`), and nothing validates `weight` at authoring or
 * campaign-build time. `weight: 0` is the natural way for an author to say "this only ever
 * fires when a chain schedules it, never on the random roll" — so left unfiltered, the first
 * week such a definition's `conditions` hold would throw out of `advance` entirely rather
 * than reject an action. Drawing pools are therefore narrowed to drawable weights first, and
 * an all-unweighted pool simply means nothing is drawn that week.
 */
function drawable(weight: number | undefined): boolean {
  return weight !== undefined && Number.isInteger(weight) && weight > 0;
}

/**
 * Real logic (W57) — §2.3's full lifecycle, in the order it fixes: **revoke, then expire,
 * then offer.** Revoking and expiring before offering is what lets a slot freed this week be
 * re-offered this week rather than next.
 *
 * **Revoke** drops any `contested` opportunity whose target position is now *filled* —
 * §2.3's "a contested position filled by a rival." With no rivals wired (§7.10 is an open
 * gap, and W57's own *Out of scope*), the only filling this engine can observe is the
 * player's own hire, so that is exactly what the predicate tests; it gains rivals by
 * widening, without changing shape.
 *
 * **Absence from `world.jobMarket.openings` is deliberately *not* the test, and reading it
 * as one was a defect.** That collection is not a world job market: `search_for_work`
 * (`resolvers.ts`) is its only writer, so it holds the jobs *this player has surfaced* and
 * is empty until they look. Treating "not in openings" as "filled" revoked every contested
 * `job_offer` on the first pass after it was offered — an unsolicited headhunt could never
 * outlive one week — and made a `contested` `promotion` unable to survive at all, since a
 * promotion target is reached through `JobDefinition.promotionPaths` and is never posted as
 * an opening in the first place.
 *
 * **Expire** drops anything `expiresAtWeek` has passed, unchanged from W39.
 *
 * **Offer** draws at most one new opportunity per week from the eligible pool, weighted, from
 * the week's own `system` stream. Eligible means: `conditions` satisfied, not already
 * standing, and — for a `job_offer`/`promotion` — a target the player does not already hold.
 * One per week is a placeholder rate, the same caveat `DRIFT_PER_WEEK` carries; the
 * *mechanism* (weighted draw from a filtered pool, `expiresAtWeek` from `durationWeeks`) is
 * the contract's.
 *
 * **An offer that would already have expired is never added at all.** `durationWeeks: 0`
 * puts `expiresAtWeek` at the current week, which `stillOpen` (above) already calls closed —
 * so it never enters `activeOpportunities` and never reaches `SimulationView` (W57.3). The
 * alternative, adding it now for `expire` to remove next week, would surface an offer the
 * player provably could not take.
 */
function opportunities(
  state: SimulationKindState,
  defs: readonly OpportunityDefinition[],
  rng: RngHandle | undefined,
): { state: SimulationKindState; changes: StateChange[] } {
  const week = state.calendar.currentWeek;
  const changes: StateChange[] = [];
  const heldJobId = state.player.career.currentEmployment?.jobId;

  const surviving: Opportunity[] = [];
  for (const open of state.activeOpportunities) {
    const def = defs.find((d) => d.id === open.definitionId);
    const revoked = def?.contested === true
      && (open.kind === "job_offer" || open.kind === "promotion")
      && open.targetId === heldJobId;
    if (revoked) {
      changes.push({ path: `activeOpportunities.${open.id}`, op: "set", value: open.definitionId, reason: "opportunity_revoked", visible: true });
      continue;
    }
    if (!stillOpen(open.expiresAtWeek, week)) {
      changes.push({ path: `activeOpportunities.${open.id}`, op: "set", value: open.definitionId, reason: "opportunity_expired", visible: true });
      continue;
    }
    surviving.push(open);
  }

  const standing = new Set(surviving.map((o) => o.definitionId));
  const eligible = defs.filter((def) => {
    if (!drawable(def.weight)) return false;
    if (standing.has(def.id)) return false;
    if ((def.kind === "job_offer" || def.kind === "promotion") && def.targetId === heldJobId) return false;
    if (def.conditions !== undefined && !evaluateSimulationCondition(def.conditions, state)) return false;
    return stillOpen(week + def.durationWeeks, week);
  });

  if (rng === undefined || eligible.length === 0) {
    return { state: { ...state, activeOpportunities: surviving }, changes };
  }

  const drawn = rng.weightedPick(eligible.map((item) => ({ item, weight: item.weight })));
  const offered: Opportunity = {
    id: `${drawn.id}-${week}`,
    definitionId: drawn.id,
    kind: drawn.kind,
    targetId: drawn.targetId,
    offeredWeek: week,
    expiresAtWeek: week + drawn.durationWeeks,
    ...(drawn.terms !== undefined ? { terms: drawn.terms } : {}),
  };
  changes.push({ path: `activeOpportunities.${offered.id}`, op: "set", value: drawn.id, reason: "opportunity_offered", visible: true });

  return { state: { ...state, activeOpportunities: [...surviving, offered] }, changes };
}

const PERFORMANCE_WORK_BONUS = 8;
/** Fraction of the gap to `weeklyDriftToward` closed each week absent work — placeholder,
 *  same caveat as `DRIFT_PER_WEEK`. */
const PERFORMANCE_DRIFT_RATE = 0.2;

function findJob(jobs: readonly JobDefinition[], jobId: string): JobDefinition | undefined {
  return jobs.find((j) => j.id === jobId);
}

/**
 * Fills one position of the named `JobOpening` (W94.4). A finite opening
 * (`positionsAvailable` defined, §7.2) decrements and stays listed while more than one
 * position remains, and is retired — removed — only when the position filled was its last.
 * An unbounded opening (`positionsAvailable` absent, uncontested) keeps its prior,
 * single-hire-retires-it behavior, unchanged by this unit.
 *
 * Actor-agnostic by construction: nothing here reads who filled the position, so the same
 * transition applies whether the caller is `resolveApplications`' own player hire or, once
 * §7.10's rivals are wired into resolution, a scripted rival's — the identity lives entirely
 * on the caller's side.
 */
export function fillJobOpening(openings: readonly JobOpening[], jobId: string): JobOpening[] {
  return openings.flatMap((opening) => {
    if (opening.jobId !== jobId) return [opening];
    if (opening.positionsAvailable === undefined) return [];
    if (opening.positionsAvailable > 1) return [{ ...opening, positionsAvailable: opening.positionsAvailable - 1 }];
    return [];
  });
}

/** One actor's pending job application, tagged with who filed it — the unit
 *  `resolveApplications` groups by `jobId` to build one `ContestClaim[]` per contested
 *  opening (§2.2, W101). */
interface DueApplication {
  actorId: string;
  application: JobApplication;
}

/**
 * Resolves every `pendingApplications` entry whose `resolvesWeek` has arrived, across the
 * player **and every `world.agents[]`** (§7.10, W101 — the same "one shape, one code path"
 * `relationships()` already applies). Hires into `currentEmployment` if the actor isn't
 * already employed and didn't win a hire earlier in this same pass; otherwise the
 * application is simply dropped (this kind has no concept of holding two jobs, and no
 * "decline offer" action exists for an actor to have refused it explicitly).
 *
 * **Contest, not first-come-first-served, once more than one actor's due application names
 * the same `jobId` on a finite opening.** Every due applicant for that `jobId` becomes one
 * `ContestClaim` (§2.2) — `score` is the applicant's `attributes.discipline` (W101's own
 * judgement call, recorded in the slice's plan/PR: economic balance of what should
 * determine hiring priority is out of scope, and this is the simplest already-declared
 * proxy) — resolved by `resolveContest`, never by iteration order. An opening with no
 * `positionsAvailable` (unbounded) keeps every prior week's behaviour: every due applicant
 * hired, no contest. Job groups are processed in `jobId` order (sorted, the sorted-
 * iteration rule, §2), not discovery order, so which job resolves first never depends on
 * which actor applied to it.
 *
 * Fills the `JobOpening` via `fillJobOpening` (W94.4) once per position actually won, so a
 * second `apply_for_job` against a now-exhausted finite posting fails `requirement_unmet`
 * once `positionsAvailable` actually reaches zero. An application whose `jobId` no longer
 * resolves against `jobs` (content removed or renamed) is dropped the same way, but emits
 * `employment.application_lost` first — the only trace of it otherwise.
 */
function resolveApplications(
  state: SimulationKindState,
  jobs: readonly JobDefinition[],
  emit: ResolutionEmitter,
): SimulationKindState {
  const week = state.calendar.currentWeek;
  const actorRefs: readonly { id: string; actor: ActorState }[] = [
    { id: "player", actor: state.player },
    ...state.world.agents.map((a) => ({ id: a.id, actor: a.actor })),
  ];

  const remainingByActor = new Map<string, JobApplication[]>();
  const dueByJob = new Map<string, DueApplication[]>();
  for (const ref of actorRefs) {
    const remaining: JobApplication[] = [];
    for (const application of ref.actor.career.pendingApplications) {
      if (application.resolvesWeek > week) {
        remaining.push(application);
        continue;
      }
      const list = dueByJob.get(application.jobId) ?? [];
      list.push({ actorId: ref.id, application });
      dueByJob.set(application.jobId, list);
    }
    remainingByActor.set(ref.id, remaining);
  }

  if (dueByJob.size === 0) return state;

  const alreadyEmployed = new Set(actorRefs.filter((r) => r.actor.career.currentEmployment !== undefined).map((r) => r.id));
  const hiredThisPass = new Set<string>();
  const employmentByActor = new Map<string, Employment>();
  let openings = state.world.jobMarket.openings;

  const jobIds = [...dueByJob.keys()].sort((a, b) => a.localeCompare(b, "en-US-POSIX"));
  for (const jobId of jobIds) {
    const applicants = dueByJob.get(jobId)!;
    const job = findJob(jobs, jobId);
    if (!job) {
      for (let i = 0; i < applicants.length; i += 1) {
        emit.emit(SIMULATION_EVENTS.employmentApplicationLost.name, SIMULATION_EVENTS.employmentApplicationLost.severity, { data: { jobId } });
      }
      continue;
    }

    const eligible = applicants.filter((a) => !alreadyEmployed.has(a.actorId) && !hiredThisPass.has(a.actorId));
    if (eligible.length === 0) continue;

    const opening = openings.find((o) => o.jobId === jobId);
    const positionsAvailable = opening?.positionsAvailable;
    // No genuine contest when every eligible applicant already fits the opening — every one
    // hired, the same as an unbounded opening, and no `ContestClaim` score needs computing.
    const won: readonly string[] = positionsAvailable === undefined || eligible.length <= positionsAvailable
      ? eligible.map((a) => a.actorId)
      : resolveContest(
        eligible.map((a): ContestClaim => ({ actorId: a.actorId, score: actorFor(actorRefs, a.actorId).attributes.discipline })),
        positionsAvailable,
      ).won;

    for (const actorId of won) {
      hiredThisPass.add(actorId);
      employmentByActor.set(actorId, {
        jobId: job.id,
        employerId: job.employerId,
        startedWeek: week,
        performance: 50,
        attendanceRatio: 100,
        warnings: 0,
        weeklyPayCents: job.compensation.baseWeeklyPayCents,
        weeksAtCurrentPay: 0,
      });
    }

    if (won.length > 0) {
      if (positionsAvailable === undefined) {
        openings = fillJobOpening(openings, jobId);
      } else {
        for (let i = 0; i < won.length; i += 1) openings = fillJobOpening(openings, jobId);
      }
    }
  }

  let next = state;
  for (const ref of actorRefs) {
    const remaining = remainingByActor.get(ref.id)!;
    const hired = employmentByActor.get(ref.id);
    if (remaining.length === ref.actor.career.pendingApplications.length && hired === undefined) continue;
    const updatedActor: ActorState = {
      ...ref.actor,
      career: { ...ref.actor.career, pendingApplications: remaining, ...(hired ? { currentEmployment: hired } : {}) },
    };
    next = ref.id === "player"
      ? { ...next, player: updatedActor }
      : { ...next, world: { ...next.world, agents: next.world.agents.map((a) => (a.id === ref.id ? { ...a, actor: updatedActor } : a)) } };
  }

  return { ...next, world: { ...next.world, jobMarket: { openings } } };
}

function actorFor(actorRefs: readonly { id: string; actor: ActorState }[], actorId: string): ActorState {
  return actorRefs.find((r) => r.id === actorId)!.actor;
}

/** Advances `Employment.performance` toward `weeklyDriftToward` absent work this week, or up
 *  by a fixed bonus if the player worked. Checks every uncontested `PromotionPath` in listed
 *  order and takes the first one whose `minimumWeeksInRole`, `minimumPerformance` and
 *  `requirements` are all satisfied — `minimumWeeksInRole` measures tenure *in the role*, so
 *  a promotion resets `startedWeek` to the promotion week along with `weeksAtCurrentPay`;
 *  otherwise a later `PromotionPath` would keep measuring from the original hire date and a
 *  multi-step career path could chain faster than `minimumWeeksInRole` intends.
 *
 *  **`attendanceConfig` (W100, §7.11), when present, updates `attendanceRatio` here too** —
 *  the same "evaluated before `financeIncome`'s reset" timing §7.11 requires, since this
 *  system runs first and reads the same still-set `workedThisWeek` flag `performance` above
 *  already does. */
function advanceEmployment(
  state: SimulationKindState,
  jobs: readonly JobDefinition[],
  attendanceConfig: AttendanceTrackingConfig | undefined,
): { state: SimulationKindState; changes: StateChange[] } {
  const employment = state.player.career.currentEmployment;
  if (!employment) return { state, changes: [] };
  const job = findJob(jobs, employment.jobId);
  if (!job) return { state, changes: [] };

  const workedThisWeek = state.player.flags["workedThisWeek"] === true;
  const performance = workedThisWeek
    ? clamp(employment.performance + PERFORMANCE_WORK_BONUS, 0, 100)
    : clamp(Math.round(employment.performance + PERFORMANCE_DRIFT_RATE * (job.performance.weeklyDriftToward - employment.performance)), 0, 100);

  let next: Employment = { ...employment, performance };
  const changes: StateChange[] = [];

  if (attendanceConfig !== undefined) {
    const weeklyRatio = workedThisWeek ? 100 : 0;
    const windowWeeks = attendanceConfig.windowWeeks;
    const before = next.attendanceRatio;
    const attendanceRatio = clamp(Math.round((before * (windowWeeks - 1) + weeklyRatio) / windowWeeks), 0, 100);
    if (attendanceRatio !== before) {
      next = { ...next, attendanceRatio };
      changes.push({
        path: "player.career.currentEmployment.attendanceRatio", op: "set", value: attendanceRatio,
        previous: before, reason: "attendance_updated", visible: true,
      });
    }
  }

  for (const path of job.promotionPaths) {
    if (path.contested) continue;
    if (state.calendar.currentWeek - employment.startedWeek < path.minimumWeeksInRole) continue;
    if (performance < path.minimumPerformance) continue;
    if (!path.requirements.every((r) => evaluateSimulationCondition(r.condition, state))) continue;
    const target = findJob(jobs, path.toJobId);
    if (!target) continue;
    next = {
      ...next,
      jobId: target.id,
      employerId: target.employerId,
      startedWeek: state.calendar.currentWeek,
      weeklyPayCents: target.compensation.baseWeeklyPayCents,
      weeksAtCurrentPay: 0,
    };
    break;
  }

  return {
    state: {
      ...state,
      player: {
        ...state.player,
        career: { ...state.player.career, currentEmployment: next, totalWeeksEmployed: state.player.career.totalWeeksEmployed + 1 },
      },
    },
    changes,
  };
}

/** Real logic (W53) — resolves due applications into a hire, then advances whatever
 *  `Employment` results. A hire that lands *this same week* is not advanced yet — the
 *  employee hasn't worked a week under it, so `totalWeeksEmployed` and performance
 *  drift/promotion would otherwise be evaluated against zero elapsed time; the same skip
 *  applies to attendance tracking (W100), for the identical reason. */
function employment(
  state: SimulationKindState,
  jobs: readonly JobDefinition[],
  emit: ResolutionEmitter,
  attendanceConfig: AttendanceTrackingConfig | undefined,
): { state: SimulationKindState; changes: StateChange[] } {
  const wasEmployed = state.player.career.currentEmployment !== undefined;
  const resolved = resolveApplications(state, jobs, emit);
  const hiredThisWeek = !wasEmployed && resolved.player.career.currentEmployment !== undefined;
  return hiredThisWeek ? { state: resolved, changes: [] } : advanceEmployment(resolved, jobs, attendanceConfig);
}

function findCourse(courses: readonly CourseDefinition[], courseId: string): CourseDefinition | undefined {
  return courses.find((c) => c.id === courseId);
}

function attendanceFlagKey(courseId: string): string {
  return `attendedClass:${courseId}`;
}

/** Real logic (W54). See this file's own header for the pass/fail rule and what a
 *  completion awards. Returns state changes so clients receive audit records for skill
 *  awards, completions, and failures alongside action-resolver changes. */
function education(state: SimulationKindState, courses: readonly CourseDefinition[]): { state: SimulationKindState; changes: StateChange[] } {
  let working = state;
  const changes: StateChange[] = [];
  const nextEnrollments: CourseEnrollment[] = [];
  let credentials = state.player.education.credentials;
  let completedCourseIds = state.player.education.completedCourseIds;
  let failedCourseIds = state.player.education.failedCourseIds;
  let flags = state.player.flags;

  for (const enrollment of state.player.education.enrollments) {
    if (enrollment.status !== "active") {
      nextEnrollments.push(enrollment);
      continue;
    }
    const course = findCourse(courses, enrollment.courseId);
    if (!course) {
      nextEnrollments.push(enrollment);
      continue;
    }

    const flagKey = attendanceFlagKey(enrollment.courseId);
    const attended = flags[flagKey] === true;
    if (flagKey in flags) flags = { ...flags, [flagKey]: false };

    const weeksCompleted = enrollment.weeksCompleted + 1;
    const attendedUnits = enrollment.attendedUnits + (attended ? 1 : 0);
    const missedSessions = enrollment.missedSessions + (attended ? 0 : 1);

    if (weeksCompleted < course.durationWeeks) {
      nextEnrollments.push({ ...enrollment, weeksCompleted, attendedUnits, missedSessions });
      continue;
    }

    const attendanceRatio = Math.round((attendedUnits / weeksCompleted) * 100);
    const failed = attendanceRatio < course.failureRules.minimumAttendanceRatio
      || missedSessions > course.failureRules.maximumMissedSessions
      || enrollment.studyUnits < course.failureRules.minimumStudyUnitsPerWeek * course.durationWeeks
      || (course.failureRules.maximumStress !== undefined && state.player.needs.stress > course.failureRules.maximumStress);

    if (failed) {
      nextEnrollments.push({
        ...enrollment, weeksCompleted, attendedUnits, missedSessions,
        status: "failed", retainedProgress: course.failureRules.progressRetainedOnFailure,
      });
      if (!failedCourseIds.includes(course.id)) failedCourseIds = [...failedCourseIds, course.id];
      changes.push({ path: `player.education.enrollments.${course.id}.status`, op: "set", value: "failed", previous: "active", reason: "education_course_failed", visible: true });
      continue;
    }

    nextEnrollments.push({ ...enrollment, weeksCompleted, attendedUnits, missedSessions, status: "completed" });
    if (!completedCourseIds.includes(course.id)) completedCourseIds = [...completedCourseIds, course.id];
    changes.push({ path: `player.education.enrollments.${course.id}.status`, op: "set", value: "completed", previous: "active", reason: "education_course_completed", visible: true });

    for (const reward of course.rewards) {
      if (reward.type !== "skill" || reward.target === undefined || typeof reward.value !== "number") continue;
      const skillId = reward.target;
      const current = working.player.skills[skillId] ?? 0;
      const awarded = Math.min(100, Math.max(0, Math.max(current, reward.value)));
      if (awarded === current) continue;
      working = { ...working, player: { ...working.player, skills: { ...working.player.skills, [skillId]: awarded } } };
      changes.push({ path: `player.skills.${skillId}`, op: "set", value: awarded, previous: current, reason: "education_skill_awarded", visible: true });
    }

    if (course.awardsCredential !== undefined && course.awardsCredential !== "none") {
      const credential: Credential = {
        id: `${course.id}-credential-${state.calendar.currentWeek}`,
        courseId: course.id,
        awardedWeek: state.calendar.currentWeek,
        level: course.awardsCredential,
        labelKey: course.nameKey,
      };
      credentials = [...credentials, credential];
      changes.push({ path: "player.education.credentials", op: "set", value: credential.id, reason: "education_credential_awarded", visible: true });
    }
  }

  return {
    state: {
      ...working,
      player: {
        ...working.player,
        flags,
        education: { enrollments: nextEnrollments, credentials, completedCourseIds, failedCourseIds },
      },
    },
    changes,
  };
}

/** Real logic (W53) — pays `Employment.weeklyPayCents` into `cashCents`, plus overtime pay
 *  from `job.compensation.overtimeRate` when `player.flags.workedOvertimeThisWeek` (set by
 *  `resolvers.ts`'s `work_overtime`), scaled off the employee's current `weeklyPayCents` —
 *  the same basis as the base wage above it, so a `negotiate_job_terms` raise (§7.9) is
 *  reflected in overtime pay too, not just the base. Wages a course or scheduled expense
 *  would add are still unwired (`CourseDefinition`, out of scope — W54). Runs *before*
 *  `housing` (§3) so rent is payable out of this same week's wages.
 *
 *  Clears both weekly work flags here — but only when there's an `Employment` to have set
 *  them, the same condition `advanceEmployment` used to gate its own (too-early) clear on —
 *  once both consumers (`advanceEmployment`'s own performance-bonus read, above in
 *  `employment()`, and this system's own overtime read) have seen them for the week.
 *  Clearing earlier, inside `advanceEmployment`, meant this system always read
 *  `workedOvertimeThisWeek` as already-reset and never paid overtime. */
export function financeIncome(state: SimulationKindState, jobs: readonly JobDefinition[]): { state: SimulationKindState; changes: StateChange[] } {
  const employment = state.player.career.currentEmployment;
  if (!employment) return { state, changes: [] };

  const flags = { ...state.player.flags, workedThisWeek: false, workedOvertimeThisWeek: false };
  const clearedState: SimulationKindState = { ...state, player: { ...state.player, flags } };
  const job = findJob(jobs, employment.jobId);

  let pay = employment.weeklyPayCents;
  const workedOvertime = state.player.flags["workedOvertimeThisWeek"] === true;
  if (workedOvertime && job?.compensation.overtimeRate) {
    pay += Math.round(employment.weeklyPayCents * job.compensation.overtimeRate / 10_000);
  }
  if (pay === 0) return { state: clearedState, changes: [] };

  const before = state.player.finances.cashCents;
  return {
    state: {
      ...clearedState,
      player: { ...clearedState.player, finances: { ...clearedState.player.finances, cashCents: before + pay } },
    },
    changes: [{ path: "player.finances.cashCents", op: "increment", value: pay, previous: before, reason: "wage_payment", visible: true }],
  };
}

/** One actor's `"operating"` `BusinessRecord`s, posted once (§7.12, W101). Modifier
 *  composition reuses `modifiers.ts`'s own multiply-once-round-once rule exactly — no new
 *  rounding rule. A record whose `cashOnHandCents` drops below `minimumCashCents` after this
 *  post closes immediately (`closedReason: "business_insolvent"`) — no separate grace-period
 *  ladder distinct from `HousingState.evictionStage`, per `90-decisions.md`'s W101 gate 3. */
function operateBusinesses(
  state: SimulationKindState,
  actor: ActorState,
  addressPrefix: string,
  businesses: readonly BusinessDefinition[],
  week: number,
): { actor: ActorState; changes: StateChange[] } {
  const changes: StateChange[] = [];
  const records = actor.businesses.map((record) => {
    if (record.status !== "operating") return record;
    const def = businesses.find((b) => b.id === record.definitionId);
    if (!def) return record;
    const base = `${addressPrefix}.businesses.${record.instanceId}`;

    const revenue = combineModifiers(def.weeklyRevenueCents, collectModifiers(state.activeEffects, `${base}.revenue`));
    const expenses = combineModifiers(def.weeklyExpensesCents, collectModifiers(state.activeEffects, `${base}.expenses`));
    const after = record.cashOnHandCents + revenue - expenses;

    if (revenue !== 0) changes.push({ path: `${base}.cashOnHandCents`, op: "increment", value: revenue, reason: "business_revenue", visible: true });
    if (expenses !== 0) changes.push({ path: `${base}.cashOnHandCents`, op: "decrement", value: expenses, reason: "business_expense", visible: true });

    if (after < def.minimumCashCents) {
      changes.push({ path: `${base}.status`, op: "set", value: "closed", previous: "operating", reason: "business_insolvent", visible: true });
      return {
        ...record, cashOnHandCents: after, weeksOperated: record.weeksOperated + 1,
        status: "closed" as const, closedWeek: week, closedReason: "business_insolvent",
      };
    }
    return { ...record, cashOnHandCents: after, weeksOperated: record.weeksOperated + 1 };
  });

  return { actor: { ...actor, businesses: records }, changes };
}

/** Real logic (W101) — runs over the player **and every `world.agents[].actor`**, the same
 *  forward-compatible shape `relationships()` already uses: businesses are an `ActorState`
 *  field (§6.12), shared structurally even though no shipped scenario yet gives a rival
 *  one. */
export function business(state: SimulationKindState, businesses: readonly BusinessDefinition[]): { state: SimulationKindState; changes: StateChange[] } {
  if (businesses.length === 0) return { state, changes: [] };
  const week = state.calendar.currentWeek;

  const playerResult = operateBusinesses(state, state.player, "player", businesses, week);
  const changes = [...playerResult.changes];

  const agents = state.world.agents.map((agent) => {
    const result = operateBusinesses(state, agent.actor, `world.agents.${agent.id}.actor`, businesses, week);
    changes.push(...result.changes);
    return { ...agent, actor: result.actor };
  });

  return { state: { ...state, player: playerResult.actor, world: { ...state.world, agents } }, changes };
}

/** A per-item `StatusEffect`'s id, derived from the instance's own natural key (§6) so the
 *  sync below is a pure set comparison rather than a search. Colon-separated for the same
 *  reason `attendedClass:<courseId>` is — it cannot collide with a campaign-authored id. */
function itemEffectId(instanceId: string): string {
  return `item:${instanceId}`;
}

/**
 * Real logic (W56) — two jobs, in this order.
 *
 * **Decay.** Every item ages one week (`weeksSinceMaintenance`), and if the **governing**
 * `MaintenanceRule` — the first listed, `resolvers.ts`'s `governingMaintenanceRule`, shared
 * so the two cannot diverge — has had its `intervalWeeks` elapse since the last service, its
 * `conditionLossIfSkipped` comes off `condition`, clamped to `0–100`. Summing every elapsed
 * rule instead would charge condition for rules `maintain_item` can never service, and let one
 * service clear penalties it never paid for. An item with no `maintenanceRules` never decays —
 * §7.5 gives condition no other decay source, and inventing a flat rate for a possession the
 * content says needs no upkeep would be a rule this contract does not have. Skipping
 * maintenance keeps costing every week the interval stays elapsed; `resolvers.ts`'s
 * `maintain_item` is the only thing that resets the clock.
 *
 * **Effect sync.** `ItemDefinition.effects` reach `activeEffects` from here, not from `shop`
 * — `resolvers.ts`'s own header states why (`apply` has no `ctx`, and a `modifiers` array is
 * not addressable by the scalar natural-key convention). Every `sourceKind: "item"` effect is
 * rebuilt from the inventory each week, so **an item at zero condition simply stops
 * contributing its modifiers and stays in inventory** — exactly the distinction W56.3 draws,
 * and the reason a repaired item resumes contributing without anything having to remember it
 * once did. Effects from any other source are carried through untouched.
 *
 * `breakageChanceAtZeroCondition` (§7.5) is deliberately **not** applied: it is a random draw,
 * and the end-of-week pipeline is handed an emitter, not a `KindContext` — there is no
 * `ctx.derive` here to take a deterministic substream from. `InventoryItem.broken` therefore
 * only ever moves through `repair_item`. Recorded as an open item rather than resolved by
 * making the roll deterministic, which would misrepresent a chance as a certainty.
 */
function inventory(state: SimulationKindState, items: readonly ItemDefinition[]): { state: SimulationKindState; changes: StateChange[] } {
  const changes: StateChange[] = [];
  const findItem = (definitionId: string): ItemDefinition | undefined => items.find((d) => d.id === definitionId);

  const nextInventory = state.player.inventory.map((item) => {
    const weeksSinceMaintenance = item.weeksSinceMaintenance + 1;
    const rule = governingMaintenanceRule(findItem(item.definitionId));
    const loss = rule !== undefined && weeksSinceMaintenance >= rule.intervalWeeks ? rule.conditionLossIfSkipped : 0;
    const condition = clamp(item.condition - loss, 0, 100);
    if (condition !== item.condition) {
      changes.push({
        path: `player.inventory.${item.instanceId}.condition`, op: "set", value: condition,
        previous: item.condition, reason: "item_condition_decayed", visible: true,
      });
    }
    return { ...item, weeksSinceMaintenance, condition };
  });

  let activeEffects = state.activeEffects.filter((effect) => effect.sourceKind !== "item");
  for (const item of nextInventory) {
    if (item.condition <= 0) continue;
    const def = findItem(item.definitionId);
    if (!def || def.effects.length === 0) continue;
    const id = itemEffectId(item.instanceId);
    activeEffects = insertStatusEffect(activeEffects, {
      id,
      sourceId: item.instanceId,
      sourceKind: "item",
      modifiers: def.effects,
      // Preserved across weeks: `appliedWeek` breaks `set`-modifier priority ties
      // (`modifiers.ts`), so rebuilding it each week would silently re-date the effect.
      appliedWeek: state.activeEffects.find((e) => e.id === id)?.appliedWeek ?? state.calendar.currentWeek,
      stacking: def.stacking,
      descriptionKey: def.nameKey,
      visible: true,
    });
  }

  return {
    state: {
      ...state,
      player: { ...state.player, inventory: nextInventory },
      activeEffects,
    },
    changes,
  };
}

/** Real logic (W53; revised W55) — levies `HousingState.weeklyCostCents` against
 *  `cashCents` unconditionally, same as W53: `cashCents` may go negative (§3's own ordering
 *  claim is proved by exactly this — rent charged before wages arrive genuinely overdraws,
 *  not merely "goes unpaid"). `missedCents` is *not* read back off the resulting negative
 *  balance, though — that would double-count an already-negative balance carried in from a
 *  prior unresolved week into this week's own arrears levy. Instead it's computed from what
 *  this week's own charge alone could and couldn't cover against the cash on hand *before*
 *  this charge, so `finance_reconcile` (below) only ever levies a fee against balances
 *  `housing` charged this week, per its own contract. */
export function housing(state: SimulationKindState): { state: SimulationKindState; changes: StateChange[]; missedCents: Cents } {
  const rent = state.player.housing.weeklyCostCents;
  if (rent === 0) return { state, changes: [], missedCents: 0 };
  const before = state.player.finances.cashCents;
  const missedCents = Math.max(0, rent - Math.max(0, before));
  return {
    state: {
      ...state,
      player: { ...state.player, finances: { ...state.player.finances, cashCents: before - rent } },
    },
    changes: [{ path: "player.finances.cashCents", op: "decrement", value: rent, previous: before, reason: "rent_charged", visible: true }],
    missedCents,
  };
}

const EVICTION_LADDER: readonly EvictionStage[] = [
  "none", "warning", "penalty", "formal_notice", "hearing_scheduled", "evicted",
];

function advanceEvictionStage(stage: EvictionStage): EvictionStage {
  const index = EVICTION_LADDER.indexOf(stage);
  return EVICTION_LADDER[Math.min(index + 1, EVICTION_LADDER.length - 1)]!;
}

/** Basis points — 10%, levied on the rent `housing` (above) just failed to collect in
 *  full. Placeholder, the same status every other unbalanced numeric rule in this kind
 *  carries (`negotiateJobTermsResolver`'s `NEGOTIATE_RAISE_BPS`, `TODO.md`'s *Known Open
 *  Items*). */
const LATE_FEE_BPS = 1000;

/** Real logic (W55) — `missedCents` (from `housing`, above, in the same pass) is the only
 *  input: this system levies a late fee on top of it, adds both to `HousingState.
 *  overdueRentCents`, and advances `evictionStage` by exactly one rung on the ladder —
 *  never more than one, regardless of how large `missedCents` is, so a single very bad
 *  week reads the same as any other missed week. A week where `housing` collected the
 *  full rent (`missedCents === 0`) is a no-op: arrears already on the books stay exactly
 *  where they are until the player clears them with `pay_bills` (`resolvers.ts`) — this
 *  system only ever escalates, never cures. */
export function financeReconcile(state: SimulationKindState, missedCents: Cents): { state: SimulationKindState; changes: StateChange[] } {
  if (missedCents <= 0) return { state, changes: [] };

  const lateFee = Math.round((missedCents * LATE_FEE_BPS) / 10_000);
  const arrears = missedCents + lateFee;
  const housingBefore = state.player.housing;
  const nextStage = advanceEvictionStage(housingBefore.evictionStage);

  const changes: StateChange[] = [
    {
      path: "player.housing.overdueRentCents", op: "increment", value: arrears,
      previous: housingBefore.overdueRentCents, reason: "rent_overdue", visible: true,
    },
    {
      path: "player.housing.missedPayments", op: "increment", value: 1,
      previous: housingBefore.missedPayments, reason: "rent_overdue", visible: true,
    },
  ];
  if (nextStage !== housingBefore.evictionStage) {
    changes.push({
      path: "player.housing.evictionStage", op: "set", value: nextStage,
      previous: housingBefore.evictionStage, reason: "eviction_advanced", visible: true,
    });
  }

  return {
    state: {
      ...state,
      player: {
        ...state.player,
        housing: {
          ...housingBefore,
          overdueRentCents: housingBefore.overdueRentCents + arrears,
          missedPayments: housingBefore.missedPayments + 1,
          evictionStage: nextStage,
        },
      },
    },
    changes,
  };
}

/** Real logic (W100, §7.11) — closes the stub W56/W57 left. Applies every
 *  `SimulationCampaign.relationshipDrift` rule, in array order, to every actor's
 *  `RelationshipState[]` — the player's and each `WorldState.agents[].actor`'s alike, the
 *  same "one shape, one code path" rule §6.2 states for every other actor-state system.
 *  Absent `rules` (the default) leaves this the no-op it has always been. */
function applyRelationshipDrift(
  relationships: readonly RelationshipState[],
  rules: readonly RelationshipDriftRule[],
  pathPrefix: string,
): { relationships: RelationshipState[]; changes: StateChange[] } {
  const changes: StateChange[] = [];
  let next = relationships;

  for (const rule of rules) {
    next = next.map((rel) => {
      if (rule.categories !== undefined && rule.categories.length > 0 && !rule.categories.includes(rel.category)) {
        return rel;
      }

      let updated = rel;
      const drift = (key: "affinity" | "trust" | "respect" | "resentment", delta: number | undefined, visible: boolean): void => {
        if (delta === undefined) return;
        const before = updated[key];
        const after = clamp(before + delta, 0, 100);
        if (after === before) return;
        updated = { ...updated, [key]: after };
        changes.push({
          path: `${pathPrefix}.${rel.npcId}.${key}`, op: "set", value: after,
          previous: before, reason: "relationship_drift", visible,
        });
      };

      // Clamp to 0–100 before the next rule runs (§7.11) — each rule's `map` above already
      // completes over every relationship before the loop moves to the next rule.
      drift("affinity", rule.affinityDelta, true);
      drift("trust", rule.trustDelta, true);
      drift("respect", rule.respectDelta, true);
      // Hidden from projection (§6.11) — emitted the same way `socialize` already emits it
      // (`resolvers.ts`): `visible: false`, never omitted from the audit trail entirely.
      drift("resentment", rule.resentmentDelta, false);
      return updated;
    });
  }

  return { relationships: [...next], changes };
}

function relationships(
  state: SimulationKindState,
  rules: readonly RelationshipDriftRule[],
): { state: SimulationKindState; changes: StateChange[] } {
  if (rules.length === 0) return { state, changes: [] };

  const player = applyRelationshipDrift(state.player.relationships, rules, "player.relationships");
  const changes = [...player.changes];

  // `WorldState.agents` is empty in every shipped scenario (§7.10) — forward compatible with
  // rivals without changing shape once one exists, exercised by nothing yet.
  const agents = state.world.agents.map((agent) => {
    const result = applyRelationshipDrift(agent.actor.relationships, rules, `world.agents.${agent.id}.actor.relationships`);
    changes.push(...result.changes);
    return { ...agent, actor: { ...agent.actor, relationships: result.relationships } };
  });

  return {
    state: {
      ...state,
      player: { ...state.player, relationships: player.relationships },
      world: { ...state.world, agents },
    },
    changes,
  };
}

/** How far one fired event moves `world.strangenessBase`. A placeholder rate, the same
 *  status `DRIFT_PER_WEEK` and `LATE_FEE_BPS` carry — §2.2 stores `strangenessBase` and §7.9
 *  reads strangeness back through `HeadlineDefinition`, but nothing in this contract states
 *  what moves it. "Something happened, so the world reads a little stranger" is the smallest
 *  rule that makes the stored field live and `headline`'s own §3 ordering observable. */
const STRANGENESS_PER_EVENT = 5;

/**
 * Applies one `EventOutcome` (§7.6). `effects` become a single `StatusEffect` with
 * `sourceKind: "event"` — the source kind §2.3 declares for exactly this — rather than being
 * written into fields directly, so an event's influence expires the same way every other
 * modifier does. `scheduledEvents` append per §2.3's creation rule, inheriting
 * `chainId`/`chainStep` from the event that scheduled them; `endsChain` cancels every pending
 * `ScheduledEvent` sharing that `chainId`.
 *
 * **`rewards` are deliberately not applied.** §7.1 declares `Reward.target`/`value` as
 * `unknown` across every `RewardType` and states plainly that a real dispatcher is
 * out of scope until something needs one ("**Revisit when** `Reward` gains a real
 * dispatcher, not before"). Inventing per-type semantics here would be writing that
 * dispatcher inside an event handler, three sections away from where it belongs.
 *
 * **`messages` are collected, not dropped.** They are the one part of an `EventOutcome` that
 * is finished content rather than a deferred mechanism — an authored `OutcomeMessage` with a
 * `LocKey` and a `visible` flag, the same shape `ActionOutcome.messages` already carries to
 * the player through `advance.ts`. Discarding them silently meant a campaign could author
 * event flavour text, see the modifier land, and never learn the text went nowhere.
 * `generatedEvents`/`generatedOpportunities` remain unapplied, and now say so: both name ids
 * whose *creation* semantics §7.6 leaves to the same undesigned dispatcher `rewards` waits on.
 */
function applyEventOutcome(
  state: SimulationKindState,
  def: EventDefinition,
  outcome: EventOutcome,
  messages: OutcomeMessage[],
  firing: number,
): SimulationKindState {
  const week = state.calendar.currentWeek;
  let next = state;

  messages.push(...outcome.messages);

  if (outcome.effects.length > 0) {
    const effect: StatusEffect = {
      id: `event:${def.id}:${week}`,
      sourceId: def.id,
      sourceKind: "event",
      modifiers: [...outcome.effects],
      appliedWeek: week,
      stacking: "refresh",
      descriptionKey: def.descriptionKey,
      visible: true,
    };
    next = { ...next, activeEffects: insertStatusEffect(next.activeEffects, effect) };
  }

  let scheduled = next.scheduledEvents;
  if (outcome.endsChain === true && def.chainId !== undefined) {
    scheduled = scheduled.filter((s) => s.chainId !== def.chainId);
  }
  // `eventId` and target week alone do not identify a scheduled entry: two events firing in
  // the same pass can each schedule the same follow-up onto the same week. Four things do —
  // the scheduling definition, the week it fired in, *which* firing of that pass it was, and
  // the entry's index within the outcome. `firing` is load-bearing rather than belt-and-
  // braces: `def.id` alone is not enough, because one definition can fire twice in a single
  // pass (two due `ScheduledEvent`s naming it, or `cooldownWeeks: 0` letting the scheduled
  // firing be drawn again), and `week` alone is not enough either, because one definition
  // firing in two different weeks can schedule the same index onto the same target week
  // through two choices with different `inWeeks`.
  (outcome.scheduledEvents ?? []).forEach((entry, index) => {
    scheduled = [...scheduled, {
      id: `scheduled-${def.id}-${week}-${firing}-${index}-${entry.eventId}-${week + entry.inWeeks}`,
      eventId: entry.eventId,
      scheduledWeek: week + entry.inWeeks,
      createdWeek: week,
      ...(def.chainId !== undefined ? { chainId: def.chainId } : {}),
      ...(def.chainStep !== undefined ? { chainStep: def.chainStep } : {}),
    }];
  });

  return { ...next, scheduledEvents: scheduled };
}

/** Picks the `ConditionalOutcome` (§7.6) a fired choice resolves to: those whose
 *  `condition` passes, weighted when weights are authored and first-listed otherwise —
 *  the same "listed order, first match" fallback `advanceEmployment` uses for
 *  `promotionPaths`. `onDegree` is not consulted: it filters on an `ActionOutcome.degree`
 *  (§5.3) that only a skill `check` produces, and `EventChoice.check` is not evaluated here. */
function selectOutcome(
  candidates: readonly { condition?: unknown; weight?: number; outcome: EventOutcome }[],
  state: SimulationKindState,
  rng: RngHandle | undefined,
): EventOutcome | undefined {
  const eligible = candidates.filter(
    (c) => c.condition === undefined || evaluateSimulationCondition(c.condition as never, state),
  );
  if (eligible.length === 0) return undefined;
  // `drawable`, not `weight > 0`: `weightedPick` rejects a non-integer weight as hard as a
  // zero one, so an author writing `weight: 1.5` would throw rather than fall back.
  const weighted = eligible.filter((c) => drawable(c.weight));
  if (rng !== undefined && weighted.length > 0) {
    return rng.weightedPick(weighted.map((item) => ({ item, weight: item.weight! }))).outcome;
  }
  return eligible[0]!.outcome;
}

/**
 * Fires one event: books its cooldown and uniqueness, shifts world strangeness, and then
 * either queues a `PendingEventResponse` (an event with `choices`, §2.3's deferred model) or
 * applies its `automaticOutcome` immediately (§7.6). A `choiceId` — carried in on a
 * `ScheduledEvent.payload` by `respond_to_event` (`resolvers.ts`) — resolves the choice the
 * player already answered instead of deferring it again.
 *
 * **No `EngineEvent` is emitted for a firing.** §11's table is the closed set of names this
 * kind may emit (`Kind.eventNames`, 05 §9), and it does not name one — `system.ran` already
 * marks that `events` ran, and the `event_fired` `StateChange` below is the per-event record.
 * Adding a name here would be widening the contract's own event surface from a slice.
 */
function fireEvent(
  state: SimulationKindState,
  def: EventDefinition,
  choiceId: string | undefined,
  rng: RngHandle | undefined,
  changes: StateChange[],
  messages: OutcomeMessage[],
  firing: number,
): SimulationKindState {
  const week = state.calendar.currentWeek;

  // **An answered choice is not a second firing.** The event already rolled last week —
  // booking its cooldown and shifting strangeness again here would count one occurrence
  // twice, and would let a two-week deferral make the world twice as strange as the same
  // event resolved immediately. Resolving the answer applies the outcome and nothing else.
  if (choiceId !== undefined) {
    const choice = def.choices?.find((c) => c.id === choiceId);
    const selected = choice === undefined ? undefined : selectOutcome(choice.outcomes, state, rng);
    return selected === undefined ? state : applyEventOutcome(state, def, selected, messages, firing);
  }

  const strangenessBefore = state.world.strangenessBase;
  const strangenessBase = clamp(strangenessBefore + STRANGENESS_PER_EVENT, 0, 100);
  const next: SimulationKindState = {
    ...state,
    world: {
      ...state.world,
      strangenessBase,
      eventCooldowns: { ...state.world.eventCooldowns, [def.id]: week },
      firedUniqueEvents: def.unique === true && !state.world.firedUniqueEvents.includes(def.id)
        ? [...state.world.firedUniqueEvents, def.id]
        : state.world.firedUniqueEvents,
    },
  };
  changes.push({ path: "world.strangenessBase", op: "set", value: strangenessBase, previous: strangenessBefore, reason: "event_fired", visible: true });
  if (strangenessBase !== strangenessBefore) {
    // `world.strangeness` is a formula-only `DerivedPath` (`derived.ts`) with no stored
    // counterpart, so a change *named* for it must carry the derived value, not the stored
    // base — reporting the base meant this visible change and `headline`'s own read two
    // systems later disagreed about the same path whenever any effect modified it.
    const derivedBefore = derivedValueResolver.resolve("world.strangeness", strangenessBefore, state.activeEffects);
    const derivedAfter = derivedValueResolver.resolve("world.strangeness", strangenessBase, state.activeEffects);
    changes.push({ path: "world.strangeness", op: "set", value: derivedAfter, previous: derivedBefore, reason: "world_strangeness_shifted", visible: true });
  }

  if (def.choices !== undefined && def.choices.length > 0) {
    const pending: PendingEventResponse = {
      id: `pending-${def.id}-${week}`,
      eventId: def.id,
      rolledWeek: week,
      presentWeek: week + 1,
      availableChoiceIds: def.choices.map((c) => c.id),
    };
    return { ...next, pendingEventResponses: [...next.pendingEventResponses, pending] };
  }

  return def.automaticOutcome === undefined ? next : applyEventOutcome(next, def, def.automaticOutcome, messages, firing);
}

/**
 * Real logic (W57) — §2.3's firing order exactly: **every due `ScheduledEvent` first,
 * unconditionally, then random eligible events by weight.**
 *
 * Scheduled events ignore weight, cooldown, uniqueness and their own `conditions`, because
 * they were already committed to when scheduled — §2.3 records that re-checking eligibility
 * at fire time was considered and rejected, since it lets a multi-week chain break silently
 * in the middle. They fire in `id` order, which is stable and campaign-authored, so a week
 * with two due events is not at the mercy of insertion order.
 *
 * The random roll then draws at most one event per week from the eligible pool — `conditions`
 * satisfied, `cooldownWeeks` elapsed since `world.eventCooldowns[id]`, and not already in
 * `firedUniqueEvents` if `unique`. One per week is a placeholder rate (`DRIFT_PER_WEEK`'s own
 * caveat); the eligibility rule and the weighting are the contract's.
 *
 * **A deferred `PendingEventResponse` is never answered in the week it was queued.** It is
 * created with `presentWeek = rolledWeek + 1` and nothing here consumes one — the player
 * answers it with `respond_to_event` during the *next* week, which schedules the answer back
 * through this same system as a due `ScheduledEvent` carrying the chosen `choiceId`.
 */
function events(
  state: SimulationKindState,
  defs: readonly EventDefinition[],
  rng: RngHandle | undefined,
): { state: SimulationKindState; changes: StateChange[]; messages: OutcomeMessage[] } {
  const week = state.calendar.currentWeek;
  const changes: StateChange[] = [];
  const messages: OutcomeMessage[] = [];
  const find = (id: string): EventDefinition | undefined => defs.find((d) => d.id === id);

  const due: ScheduledEvent[] = state.scheduledEvents
    .filter((s) => s.scheduledWeek <= week)
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  let next: SimulationKindState = {
    ...state,
    scheduledEvents: state.scheduledEvents.filter((s) => s.scheduledWeek > week),
  };

  // Counts every firing this pass makes, scheduled and drawn alike, so `applyEventOutcome`
  // can mint scheduled-event ids that stay distinct when one definition fires more than
  // once — two due entries naming it, or a `cooldownWeeks: 0` definition winning the random
  // draw in the same week it fired from the schedule.
  let firing = 0;

  for (const entry of due) {
    const def = find(entry.eventId);
    if (!def) continue;
    const answered = entry.payload?.["choiceId"];
    next = fireEvent(next, def, typeof answered === "string" ? answered : undefined, rng, changes, messages, firing);
    firing += 1;
  }

  const eligible = defs.filter((def) => {
    // `drawable` first: an un-drawable weight is a scheduled-only event (see the helper),
    // not an error, and `weightedPick` would throw on it rather than skip it.
    if (!drawable(def.weight)) return false;
    if (def.unique === true && next.world.firedUniqueEvents.includes(def.id)) return false;
    const lastFired = next.world.eventCooldowns[def.id];
    if (lastFired !== undefined && def.cooldownWeeks !== undefined && week - lastFired < def.cooldownWeeks) return false;
    if (lastFired !== undefined && def.cooldownWeeks === undefined) return false;
    return evaluateSimulationCondition(def.conditions, next);
  });

  if (rng !== undefined && eligible.length > 0) {
    const drawn = rng.weightedPick(eligible.map((item) => ({ item, weight: item.weight })));
    next = fireEvent(next, drawn, undefined, rng, changes, messages, firing);
    firing += 1;
  }

  return { state: next, changes, messages };
}

/**
 * Real logic (W57) — picks this week's headline and records it in
 * `world.headlinePool.shownThisWeek` (§2.2).
 *
 * **Reads *derived* strangeness, and reads it here rather than earlier, which is the whole
 * reason §3 orders `headline` after `events`.** `world.strangeness` is a formula-only
 * `DerivedPath` (`derived.ts`) with no stored counterpart, so the effective value is
 * `strangenessBase` with every active modifier layered over it — including a `StatusEffect`
 * an event attached moments ago in this same pass. A week's headline can therefore reference
 * the strangeness that week's own events moved (W57.4).
 *
 * Selection is a pool cycle, not a fresh draw: eligible headlines are those whose
 * `minStrangeness`/`maxStrangeness` bracket contains the current value and whose `conditions`
 * pass; the first eligible id still in `remainingIds` is shown and consumed. When the
 * remaining pool holds no eligible id, it refills from the full eligible set and
 * `cyclesCompleted` increments — which is what that field is for. First in authored order,
 * not a weighted draw: §7.9 gives `HeadlineDefinition` no `weight`.
 *
 * **A week with nothing eligible clears `shownThisWeek` rather than leaving it alone.** The
 * field is named for the week it belongs to; carrying last week's id forward through a quiet
 * week would report stale news as current, and a client cannot tell the two apart because
 * the absence of a `headline_shown` change is not something a projection reads. Cleared by
 * omitting the key, not by writing `undefined` — `canonicalStringify` (§2) drops neither
 * silently, and the field is optional precisely so "no headline this week" is expressible.
 *
 * **Clearing an *exhausted* pool counts its cycle then and there.** `shownThisWeek` is the
 * only evidence that a pool with no `remainingIds` has ever been filled, and `firstFill`
 * below reads exactly that evidence to tell a spent pool from the untouched one
 * `initial.ts` builds. Dropping the field without counting would make the next refill look
 * like the first, and a completed cycle would vanish for every quiet week that happened to
 * land on an empty pool. The total is the same either way; only the week the increment
 * lands in moves, and it lands in the week the pool was actually spent.
 */
function headline(
  state: SimulationKindState,
  defs: readonly HeadlineDefinition[],
): { state: SimulationKindState; changes: StateChange[] } {
  const strangeness = derivedValueResolver.resolve("world.strangeness", state.world.strangenessBase, state.activeEffects);

  const eligible = defs.filter((def) => {
    if (def.minStrangeness !== undefined && strangeness < def.minStrangeness) return false;
    if (def.maxStrangeness !== undefined && strangeness > def.maxStrangeness) return false;
    if (def.conditions !== undefined && !evaluateSimulationCondition(def.conditions, state)) return false;
    return true;
  });
  const pool = state.world.headlinePool;
  if (eligible.length === 0) {
    // Optional chain, not an assertion: a campaign with no headlines at all never reaches
    // the pool below, and this branch must stay as tolerant of a headline-free game as the
    // early return it replaced — there is nothing to clear when there is no pool.
    if (pool?.shownThisWeek === undefined) return { state, changes: [] };
    // Rebuilt field by field rather than destructured with a discarded `shownThisWeek`: the
    // key has to be *absent*, and naming a binding only to throw it away is the unused
    // variable the lint rule is right to reject.
    //
    // An empty `remainingIds` alongside a set `shownThisWeek` is a pool that has just been
    // spent to the last id. Count that cycle before the clear removes the only thing that
    // distinguishes it from a pool that has never been filled (see the note above).
    const spent = pool.remainingIds.length === 0;
    return {
      state: {
        ...state,
        world: {
          ...state.world,
          headlinePool: {
            remainingIds: pool.remainingIds,
            cyclesCompleted: spent ? pool.cyclesCompleted + 1 : pool.cyclesCompleted,
          },
        },
      },
      changes: [],
    };
  }

  let remainingIds = pool.remainingIds;
  let cyclesCompleted = pool.cyclesCompleted;

  let chosen = eligible.find((def) => remainingIds.includes(def.id));
  if (chosen === undefined) {
    // The very first fill is not a completed cycle — an empty pool that has never shown
    // anything is a game that has not started cycling, not one that has been round once.
    const firstFill = pool.remainingIds.length === 0 && pool.shownThisWeek === undefined;
    remainingIds = eligible.map((def) => def.id);
    if (!firstFill) cyclesCompleted += 1;
    chosen = eligible[0]!;
  }

  const shown = chosen.id;
  return {
    state: {
      ...state,
      world: {
        ...state.world,
        headlinePool: { remainingIds: remainingIds.filter((id) => id !== shown), shownThisWeek: shown, cyclesCompleted },
      },
    },
    changes: [{ path: "world.headlinePool.shownThisWeek", op: "set", value: shown, ...(pool.shownThisWeek !== undefined ? { previous: pool.shownThisWeek } : {}), reason: "headline_shown", visible: true }],
  };
}

function goalDef(goalDefs: readonly GoalDefinition[], id: string): GoalDefinition | undefined {
  return goalDefs.find((def) => def.id === id);
}

/**
 * Real logic. Evaluates each active `GoalState`'s `GoalDefinition.conditions` (§7.8) —
 * persistent per §2.4: `consecutiveWeeksSatisfied` increments on a satisfied week and
 * resets to zero the moment it isn't (no partial credit), `status` becomes `"completed"`
 * once that counter reaches `requiredDurationWeeks` (default 1 — satisfied once is enough
 * unless a goal says otherwise).
 *
 * **Precedence with `failure` lives here, not there.** The end-of-week order fixes `goals`
 * before `failure` (§3) — that fixed order is what makes `goalFailurePrecedence` (upstream
 * §12.3) a completion-side decision: `"goals_win"` (default) completes a goal this week
 * even if its failure condition also tripped, leaving nothing for `failure` to catch;
 * `"failure_wins"` defers instead, so the still-active goal falls through to `failure`
 * below. Neither mode needs the systems to run in a different order.
 */
function goals(
  state: SimulationKindState,
  goalDefs: readonly GoalDefinition[],
  precedence: GoalFailurePrecedence,
  emit: ResolutionEmitter,
): SimulationKindState {
  const nextGoals: GoalState[] = state.goals.map((goal) => {
    if (goal.status !== "active") return goal;
    const def = goalDef(goalDefs, goal.definitionId);
    if (!def) return goal;

    const met = evaluateSimulationCondition(def.conditions, state);
    if (!met) return { ...goal, satisfiedThisWeek: false, consecutiveWeeksSatisfied: 0 };

    const failed = def.failureConditions !== undefined
      && evaluateSimulationCondition(def.failureConditions, state);
    if (failed && precedence === "failure_wins") {
      return { ...goal, satisfiedThisWeek: false, consecutiveWeeksSatisfied: 0 };
    }

    const consecutiveWeeksSatisfied = goal.consecutiveWeeksSatisfied + 1;
    const firstSatisfiedWeek = goal.firstSatisfiedWeek ?? state.calendar.currentWeek;
    const required = def.requiredDurationWeeks ?? 1;

    if (consecutiveWeeksSatisfied >= required) {
      emit.emit(SIMULATION_EVENTS.goalAchieved.name, SIMULATION_EVENTS.goalAchieved.severity, { data: { goalId: goal.definitionId } });
      return {
        ...goal,
        status: "completed",
        satisfiedThisWeek: true,
        consecutiveWeeksSatisfied,
        firstSatisfiedWeek,
        completedWeek: state.calendar.currentWeek,
      };
    }
    return { ...goal, satisfiedThisWeek: true, consecutiveWeeksSatisfied, firstSatisfiedWeek };
  });

  return { ...state, goals: nextGoals };
}

/**
 * Real logic. Catches whatever `goals` (above) left `"active"` with a tripped
 * `failureConditions` — under `"goals_win"` (default), that's any goal that failed without
 * also completing; under `"failure_wins"`, it's a goal `goals` deliberately deferred
 * because both conditions tripped the same week.
 *
 * **This system also writes `state.resolution` for the two goal-shaped endings** (§12,
 * W57). It is the last point in the pass where the goal set is final, so it is the only
 * place that can say "no goal is still active" without being contradicted a step later.
 * `week_limit` (below) then fills in the third ending, and only into a still-`null` field —
 * which is the mechanism that makes goals and failure win the tie (§12's precedence).
 */
function failure(state: SimulationKindState, goalDefs: readonly GoalDefinition[], emit: ResolutionEmitter): SimulationKindState {
  const nextGoals: GoalState[] = state.goals.map((goal) => {
    if (goal.status !== "active") return goal;
    const def = goalDef(goalDefs, goal.definitionId);
    if (!def?.failureConditions) return goal;

    const failed = evaluateSimulationCondition(def.failureConditions, state);
    if (!failed) return goal;

    emit.emit(SIMULATION_EVENTS.goalFailed.name, SIMULATION_EVENTS.goalFailed.severity, { data: { goalId: goal.definitionId } });
    return { ...goal, status: "failed", failedWeek: state.calendar.currentWeek };
  });

  const next: SimulationKindState = { ...state, goals: nextGoals };
  // `?? null`, not `!== null`: `deserialize` is a bare `JSON.parse` with no migration step,
  // so a session persisted before `resolution` existed comes back with the key absent. A
  // strict `!== null` treats that `undefined` as "already resolved" and short-circuits —
  // leaving the save permanently unwinnable and unlosable. Same guard in `weekLimit` below.
  if ((next.resolution ?? null) !== null) return next;
  if (nextGoals.length === 0 || nextGoals.some((goal) => goal.status === "active")) return next;

  const goalsMet = nextGoals.filter((g) => g.status === "completed").map((g) => g.definitionId).sort();
  const goalsFailed = nextGoals.filter((g) => g.status === "failed").map((g) => g.definitionId).sort();
  const resolution: SimulationResolution = {
    resolution: goalsFailed.length > 0 ? "failed" : "goals_met",
    goalsMet,
    goalsFailed,
    resolvedAtWeek: state.calendar.currentWeek,
  };
  return { ...next, resolution };
}

/**
 * Real logic (W57) — the system §3 adds between `failure` and `achievements`, absent from
 * upstream, which schedules no week-limit check anywhere in `END_WEEK_SYSTEM_ORDER`.
 *
 * **It writes only into a still-`null` `resolution`, and that is the whole of §12's
 * precedence rule.** `goals` and `failure` have already had their turn (and already applied
 * `goalFailurePrecedence` between themselves) by the time this runs, so a week that both
 * exhausts `weekLimit` and lands every goal keeps `goals_met`, and a week that both fails
 * and exhausts it keeps the more specific `failed`. `week_limit_reached` is never a
 * tie-break result — it is what a week reports when neither `goals` nor `failure` had
 * anything to say, i.e. play ran out of scenario before it resolved either way.
 *
 * A scenario with no `weekLimit` never resolves this way, which is why the third terminal
 * path was unreachable by construction before this unit.
 */
function weekLimit(state: SimulationKindState, limit: number | undefined): SimulationKindState {
  if ((state.resolution ?? null) !== null) return state;
  if (limit === undefined || state.calendar.currentWeek < limit) return state;

  return {
    ...state,
    resolution: {
      resolution: "week_limit_reached",
      goalsMet: state.goals.filter((g) => g.status === "completed").map((g) => g.definitionId).sort(),
      goalsFailed: state.goals.filter((g) => g.status === "failed").map((g) => g.definitionId).sort(),
      resolvedAtWeek: state.calendar.currentWeek,
    },
  };
}

/** Where an unlocked achievement is remembered *within a game*. Colon-separated for the
 *  same reason `attendedClass:<courseId>` is (`resolvers.ts`): it cannot collide with a
 *  campaign-authored flag id, and it stays addressable by a `Condition`, whose field paths
 *  split on `.` alone. §2 declares no achievement collection on `SimulationKindState` and
 *  this unit does not add one — the durable record is the profile's (04 §7.1), and this flag
 *  is only what stops a second unlock in a later week. */
function achievementFlagKey(achievementId: string): string {
  return `achieved:${achievementId}`;
}

/**
 * Real logic (W57) — evaluates every not-yet-unlocked `AchievementDefinition.condition`
 * (§7.9) in authored order and emits one `achievement_unlocked` `StateChange` per unlock.
 *
 * **Runs after `goals`/`failure` *and* after `week_limit`,** so a condition can depend on a
 * counter those systems just moved and on the final `resolution` itself — W57.5 requires the
 * first, and §3's placement of `week_limit` before this system is what buys the second.
 *
 * **The unlock reaches the `ProfileStore` through the `StateChange`, not from here.** The
 * cross-kind convention is a `visible` change at `achieved.<id>` with reason
 * `achievement_unlocked`; `session/store.ts`'s `upsertAchievements` reads exactly that path
 * after a successful action and upserts it against the session's `profileId` (04 §7.1), which
 * is what makes the unlock outlive the session. A kind never touches the store itself —
 * `KindContext` deliberately exposes no profile, so a profile read can never reach `advance`.
 * `story-graph/achievements.ts` is the same code against the same convention.
 *
 * Unlocking is once per game: the in-game record is a `player.flags` entry, and the profile
 * upsert is independently idempotent, so a repeat week emits nothing and a repeat session
 * adds nothing.
 */
function achievements(
  state: SimulationKindState,
  defs: readonly AchievementDefinition[],
): { state: SimulationKindState; changes: StateChange[] } {
  const changes: StateChange[] = [];
  let flags = state.player.flags;

  for (const def of defs) {
    const key = achievementFlagKey(def.id);
    if (flags[key] === true) continue;
    // Re-read against the flags written so far, so an achievement whose condition depends on
    // one unlocked earlier in this same pass sees it — `story-graph`'s own rebuild-per-unlock
    // rule (`achievements.ts`, plan 20 Decision 2), kept identical.
    const working: SimulationKindState = { ...state, player: { ...state.player, flags } };
    if (!evaluateSimulationCondition(def.condition, working)) continue;

    flags = { ...flags, [key]: true };
    changes.push({ path: `achieved.${def.id}`, op: "set", value: true, reason: "achievement_unlocked", visible: true });
  }

  if (changes.length === 0) return { state, changes };
  return { state: { ...state, player: { ...state.player, flags } }, changes };
}

/**
 * The content and the week's own randomness the four W57 systems need, collected into one
 * trailing parameter rather than four more positional ones — `runEndOfWeek` had already
 * reached seven. Every field is optional so a caller that wires none of them (every test
 * predating W57) still gets the pre-W57 behaviour: no events roll, no opportunity is
 * offered, no headline is chosen, no achievement unlocks, and no week limit applies.
 */
export interface EndOfWeekWorld {
  events?: readonly EventDefinition[];
  opportunities?: readonly OpportunityDefinition[];
  headlines?: readonly HeadlineDefinition[];
  achievements?: readonly AchievementDefinition[];
  /** `SimulationCampaign.businesses` (§7.12, W101). Absent leaves `business` a no-op, the
   *  same optional-collection default every other W57+ collection here already has. */
  businesses?: readonly BusinessDefinition[];
  /** `ScenarioDefinition.weekLimit` (§7.8) — absent means the scenario has no cap, and
   *  `week_limit_reached` is then unreachable by design rather than by omission. */
  weekLimit?: number;
  /** This week's `system`-stream handle (04 §3.1), derived by `advance.ts`. Absent means no
   *  random draw is taken at all — scheduled events still fire, since §2.3 fires those
   *  unconditionally. */
  rng?: RngHandle;
  /** `SimulationCampaign.relationshipDrift` (§7.11). Absent leaves `relationships` a no-op. */
  relationshipDrift?: readonly RelationshipDriftRule[];
  /** `SimulationCampaign.attendanceTracking` (§7.11). Absent leaves `Employment.
   *  attendanceRatio` unmaintained, exactly as it was before W100. */
  attendanceTracking?: AttendanceTrackingConfig;
}
/**
 * The frame the fifteen end-of-week systems are threaded through (04 §20).
 *
 * Everything above the emitter is what a system may change; everything from `emit` down is
 * this week's fixed input, carried on the frame because §20's substrate threads one value and
 * reads no field of it. Splitting them into a separate "context" parameter would mean a
 * second thing to thread, which the substrate has no way to carry.
 */
interface EndOfWeekFrame {
  readonly state: SimulationKindState;
  readonly changes: readonly StateChange[];
  readonly messages: readonly OutcomeMessage[];
  /**
   * The one durable handoff in this pass: `housing` computes it from this week's own charge
   * alone, and `finance_reconcile`, immediately after, is its only reader. It lives on the
   * frame rather than in a closure because that is exactly what a handoff between two systems
   * in an ordered list is — §3's ordering claim made visible instead of implicit.
   */
  readonly missedCents: Cents;
  readonly emit: ResolutionEmitter;
  readonly goalDefs: readonly GoalDefinition[];
  readonly goalFailurePrecedence: GoalFailurePrecedence;
  readonly jobs: readonly JobDefinition[];
  readonly courses: readonly CourseDefinition[];
  readonly items: readonly ItemDefinition[];
  readonly world: EndOfWeekWorld;
}

/** A system that returns state alone. */
function plain(frame: EndOfWeekFrame, state: SimulationKindState): EndOfWeekFrame {
  return { ...frame, state };
}

/** A system that returns state plus this week's changes, appended in execution order —
 *  which is the order `runEndOfWeek` concatenated them in before the fold existed. */
function withChanges(frame: EndOfWeekFrame, result: { state: SimulationKindState; changes: readonly StateChange[] }): EndOfWeekFrame {
  return { ...frame, state: result.state, changes: [...frame.changes, ...result.changes] };
}

/**
 * Every entry emits its own `kind.simulation.system.ran` after running, which is where §20
 * puts a per-system trace event: the substrate emits nothing, so the emission closes over the
 * system and the event together at the point the list is built. `world-graph` wraps nothing
 * and therefore still emits none, on the same substrate with no flag distinguishing them.
 *
 * After, never before — §11 reads the stream as "this system has now run", and moving the
 * emission ahead of the call would reorder it against every domain event the system itself
 * emits.
 */
function traced(id: string, run: (frame: EndOfWeekFrame) => EndOfWeekFrame): SystemEntry<EndOfWeekFrame> {
  return {
    id,
    run: (frame) => {
      const next = run(frame);
      ranSystem(next.emit, id);
      return next;
    },
  };
}

/**
 * The normative order (§3, upstream §12.2), as one declared list rather than fifteen
 * hand-sequenced statements. The ids are the contract's own and are unchanged: the stream a
 * `system.ran` reader sees is identical to the one the statement sequence produced.
 */
const END_OF_WEEK_SYSTEMS: readonly SystemEntry<EndOfWeekFrame>[] = [
  traced("employment", (frame) => withChanges(frame, employment(frame.state, frame.jobs, frame.emit, frame.world.attendanceTracking))),
  traced("education", (frame) => withChanges(frame, education(frame.state, frame.courses))),
  traced("finance_income", (frame) => withChanges(frame, financeIncome(frame.state, frame.jobs))),
  traced("business", (frame) => withChanges(frame, business(frame.state, frame.world.businesses ?? []))),
  traced("inventory", (frame) => withChanges(frame, inventory(frame.state, frame.items))),
  traced("housing", (frame) => {
    const result = housing(frame.state);
    return { ...withChanges(frame, result), missedCents: result.missedCents };
  }),
  traced("finance_reconcile", (frame) => withChanges(frame, financeReconcile(frame.state, frame.missedCents))),
  traced("needs", (frame) => withChanges(frame, needs(frame.state))),
  traced("relationships", (frame) => withChanges(frame, relationships(frame.state, frame.world.relationshipDrift ?? []))),
  traced("opportunities", (frame) => withChanges(frame, opportunities(frame.state, frame.world.opportunities ?? [], frame.world.rng))),
  traced("events", (frame) => {
    const result = events(frame.state, frame.world.events ?? [], frame.world.rng);
    // `events` is the only system that produces player-facing text: an `EventOutcome`'s
    // `messages` (§7.6). `advance.ts` folds these into the same `AdvanceResult.messages`
    // channel a resolver's `ActionOutcome.messages` reach (04 §12), so an event's flavour
    // text arrives by the same route as an action's.
    return { ...withChanges(frame, result), messages: [...frame.messages, ...result.messages] };
  }),
  traced("headline", (frame) => withChanges(frame, headline(frame.state, frame.world.headlines ?? []))),
  traced("goals", (frame) => plain(frame, goals(frame.state, frame.goalDefs, frame.goalFailurePrecedence, frame.emit))),
  traced("failure", (frame) => plain(frame, failure(frame.state, frame.goalDefs, frame.emit))),
  traced("week_limit", (frame) => plain(frame, weekLimit(frame.state, frame.world.weekLimit))),
  traced("achievements", (frame) => withChanges(frame, achievements(frame.state, frame.world.achievements ?? []))),
];

/** The declared order, for tests and guards that check it without running a week. Same role
 *  `WORLD_GRAPH_SYSTEM_IDS` plays for the other tick-driven kind. */
export const END_OF_WEEK_SYSTEM_IDS: readonly string[] = END_OF_WEEK_SYSTEMS.map(({ id }) => id);

export function runEndOfWeek(
  state: SimulationKindState,
  emit: ResolutionEmitter,
  goalDefs: readonly GoalDefinition[],
  goalFailurePrecedence: GoalFailurePrecedence,
  jobs: readonly JobDefinition[] = [],
  courses: readonly CourseDefinition[] = [],
  items: readonly ItemDefinition[] = [],
  world: EndOfWeekWorld = {},
): { state: SimulationKindState; changes: StateChange[]; messages: OutcomeMessage[] } {
  const final = runSystems<EndOfWeekFrame>(
    { state, changes: [], messages: [], missedCents: 0, emit, goalDefs, goalFailurePrecedence, jobs, courses, items, world },
    END_OF_WEEK_SYSTEMS,
  );
  return { state: final.state, changes: [...final.changes], messages: [...final.messages] };
}
