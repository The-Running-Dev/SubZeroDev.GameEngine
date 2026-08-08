import { describe, it, expect } from "vitest";
import { runStartOfWeek } from "./startOfWeek.js";
import type { ResolutionEmitter } from "../../core/observability/types.js";
import type { CourseEnrollment } from "./actor.js";
import type { CourseDefinition } from "./content.js";
import type { SimulationKindState, StatusEffect } from "./state.js";

const courseFixture: CourseDefinition = {
  id: "course-fixture", nameKey: "course.name", descriptionKey: "course.description",
  providerId: "provider-1", tuitionCents: 0, durationWeeks: 4, weeklyTimeCost: 4, difficulty: 0,
  requirements: [], rewards: [],
  failureRules: { minimumAttendanceRatio: 0, minimumStudyUnitsPerWeek: 0, maximumMissedSessions: 99, tuitionGraceWeeks: 0, progressRetainedOnFailure: 0 },
  tags: [],
};

function enrollmentFixture(overrides: Partial<CourseEnrollment> = {}): CourseEnrollment {
  return {
    courseId: "course-fixture", startedWeek: 1, weeksCompleted: 0,
    attendedUnits: 0, studyUnits: 0, missedSessions: 0,
    tuitionPaidCents: 0, tuitionOutstandingCents: 0, retainedProgress: 0,
    status: "active",
    ...overrides,
  };
}

function recordingEmitter(): { emit: ResolutionEmitter; systems: string[]; expiredEffectIds: string[] } {
  const systems: string[] = [];
  const expiredEffectIds: string[] = [];
  return {
    emit: {
      emit: (name, _severity, detail) => {
        if (name === "kind.simulation.system.ran") systems.push(String(detail?.data?.["system"]));
        if (name === "kind.simulation.effect.expired") expiredEffectIds.push(String(detail?.data?.["effectId"]));
      },
    },
    systems,
    expiredEffectIds,
  };
}

function makeEffect(overrides: Partial<StatusEffect> = {}): StatusEffect {
  return {
    id: "effect-1",
    sourceId: "item-1",
    sourceKind: "item",
    modifiers: [],
    appliedWeek: 1,
    stacking: "refresh",
    descriptionKey: "effect.description",
    visible: true,
    ...overrides,
  };
}

function baseState(overrides: Partial<SimulationKindState> = {}): SimulationKindState {
  return {
    calendar: { currentWeek: 5, currentYear: 1, totalTimeUnits: 14, committedTimeUnits: 4, spentTimeUnits: 10 },
    player: {
      education: { enrollments: [], credentials: [], completedCourseIds: [], failedCourseIds: [] },
    } as unknown as SimulationKindState["player"],
    economy: {} as SimulationKindState["economy"],
    world: {} as SimulationKindState["world"],
    activeEffects: [],
    activeOpportunities: [],
    scheduledEvents: [],
    pendingEventResponses: [],
    goals: [],
    plan: null,
    ...overrides,
  };
}

describe("runStartOfWeek", () => {
  it("increments currentWeek and resets spentTimeUnits", () => {
    const { emit } = recordingEmitter();
    const result = runStartOfWeek(baseState(), emit);
    expect(result.calendar.currentWeek).toBe(6);
    expect(result.calendar.spentTimeUnits).toBe(0);
  });

  it("recomputes committedTimeUnits to 0 with no active course enrollments (job commitments stay unwired)", () => {
    const { emit } = recordingEmitter();
    const result = runStartOfWeek(baseState(), emit);
    expect(result.calendar.committedTimeUnits).toBe(0);
  });

  it("W54 — sums weeklyTimeCost across every active enrollment's course, ignoring a completed one", () => {
    const { emit } = recordingEmitter();
    const courses: CourseDefinition[] = [
      { ...courseFixture, id: "course-a", weeklyTimeCost: 4 },
      { ...courseFixture, id: "course-b", weeklyTimeCost: 3 },
    ];
    const state = baseState({
      player: {
        education: {
          enrollments: [
            enrollmentFixture({ courseId: "course-a", status: "active" }),
            enrollmentFixture({ courseId: "course-b", status: "completed" }),
          ],
          credentials: [], completedCourseIds: [], failedCourseIds: [],
        },
      } as unknown as SimulationKindState["player"],
    });
    const result = runStartOfWeek(state, emit, courses);
    expect(result.calendar.committedTimeUnits).toBe(4);
  });

  it("W54 — an enrollment whose course no longer resolves contributes nothing", () => {
    const { emit } = recordingEmitter();
    const state = baseState({
      player: {
        education: {
          enrollments: [enrollmentFixture({ courseId: "course-missing", status: "active" })],
          credentials: [], completedCourseIds: [], failedCourseIds: [],
        },
      } as unknown as SimulationKindState["player"],
    });
    const result = runStartOfWeek(state, emit, []);
    expect(result.calendar.committedTimeUnits).toBe(0);
  });

  it("layers a StatusEffect's Modifier targeting calendar.committedTimeUnits over the recomputed base", () => {
    const { emit } = recordingEmitter();
    const state = baseState({
      activeEffects: [makeEffect({
        id: "mandatory-training",
        expiresAtWeek: 20,
        modifiers: [{ target: "calendar.committedTimeUnits", operation: "add", value: 3, sourceId: "event-1" }],
      })],
    });
    const result = runStartOfWeek(state, emit);
    expect(result.calendar.committedTimeUnits).toBe(3);
  });

  it("W51.4 — an activeEffect reducing committed time changes the recomputed budget, and once it expires the same week the recomputed budget is un-reduced", () => {
    const { emit } = recordingEmitter();
    // Week 5 -> 6. A permanent +6 commitment plus a -3 reduction expiring at week 6 (still
    // active throughout week 6, per the effects system's own kept-through-its-final-week rule).
    const state = baseState({
      activeEffects: [
        makeEffect({
          id: "base-commitment",
          modifiers: [{ target: "calendar.committedTimeUnits", operation: "add", value: 6, sourceId: "job-1" }],
        }),
        makeEffect({
          id: "reduced-hours", expiresAtWeek: 6,
          modifiers: [{ target: "calendar.committedTimeUnits", operation: "subtract", value: 3, sourceId: "event-2" }],
        }),
      ],
    });
    const duringWeek6 = runStartOfWeek(state, emit);
    expect(duringWeek6.calendar.committedTimeUnits).toBe(3);

    const duringWeek7 = runStartOfWeek(duringWeek6, emit);
    expect(duringWeek7.calendar.committedTimeUnits).toBe(6);
  });

  it("clamps committedTimeUnits to the calendar invariant (never below 0)", () => {
    const { emit } = recordingEmitter();
    const state = baseState({
      activeEffects: [makeEffect({
        id: "over-reduction",
        expiresAtWeek: 20,
        modifiers: [{ target: "calendar.committedTimeUnits", operation: "subtract", value: 99, sourceId: "x" }],
      })],
    });
    const result = runStartOfWeek(state, emit);
    expect(result.calendar.committedTimeUnits).toBe(0);
  });

  it("removes an effect whose expiresAtWeek is strictly before the new week", () => {
    const { emit } = recordingEmitter();
    const state = baseState({ activeEffects: [makeEffect({ id: "expired", expiresAtWeek: 5 })] });
    const result = runStartOfWeek(state, emit);
    expect(result.activeEffects).toEqual([]);
  });

  it("keeps an effect whose expiresAtWeek equals the new week — it still applies throughout that week", () => {
    const { emit } = recordingEmitter();
    const state = baseState({ activeEffects: [makeEffect({ id: "expiring-this-week", expiresAtWeek: 6 })] });
    const result = runStartOfWeek(state, emit);
    expect(result.activeEffects.map((e) => e.id)).toEqual(["expiring-this-week"]);
  });

  it("keeps an effect whose expiresAtWeek is still in the future", () => {
    const { emit } = recordingEmitter();
    const state = baseState({ activeEffects: [makeEffect({ id: "ongoing", expiresAtWeek: 20 })] });
    const result = runStartOfWeek(state, emit);
    expect(result.activeEffects.map((e) => e.id)).toEqual(["ongoing"]);
  });

  it("emits effect.expired with the expired effect's id, and nothing for a kept effect", () => {
    const { emit, expiredEffectIds } = recordingEmitter();
    const state = baseState({
      activeEffects: [makeEffect({ id: "expired", expiresAtWeek: 5 }), makeEffect({ id: "kept", expiresAtWeek: 20 })],
    });
    runStartOfWeek(state, emit);
    expect(expiredEffectIds).toEqual(["expired"]);
  });

  it("keeps a permanent effect (no expiresAtWeek) regardless of week", () => {
    const { emit } = recordingEmitter();
    const state = baseState({ activeEffects: [makeEffect({ id: "permanent" })] });
    const result = runStartOfWeek(state, emit);
    expect(result.activeEffects.map((e) => e.id)).toEqual(["permanent"]);
  });

  it("runs the four systems in the documented order: time_advance, effects, time_commit, events", () => {
    const { emit, systems } = recordingEmitter();
    runStartOfWeek(baseState(), emit);
    expect(systems).toEqual(["time_advance", "effects", "time_commit", "events"]);
  });
});
