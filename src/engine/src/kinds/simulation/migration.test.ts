import { describe, it, expect } from "vitest";
import { applySimulationMigration, type SimulationMigration } from "./migration.js";
import type { SimulationCampaign } from "./campaign.js";

/** A minimal, partial `SimulationCampaign` — only the collections a given test's `require`
 *  step actually resolves against are populated; every other field is `[]`, which is all
 *  `applySimulationMigration` ever reads off `campaign` (it never touches `kindState`'s own
 *  shape beyond the reference sites the four ops name). */
function campaignWith(overrides: Partial<SimulationCampaign>): SimulationCampaign {
  return {
    descriptionKey: "d", jobs: [], courses: [], housing: [], items: [], events: [], npcs: [], goals: [],
    scenarios: [], difficulties: [], opportunities: [], achievements: [], headlines: [], employers: [],
    locations: [], backgrounds: [], traits: [], skills: [], projects: [], businesses: [],
    scenarioId: "s1", goalFailurePrecedence: "failure_first",
    sceneTemplateKey: "t", actionLabelKeys: { planAdd: "a", planRemove: "b", planClear: "c", endWeek: "d" },
    ...overrides,
  } as SimulationCampaign;
}

function baseState(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    player: {
      housing: { definitionId: "apt-1" },
      inventory: [{ definitionId: "widget", instanceId: "i1" }],
      education: { enrollments: [{ courseId: "c1" }], credentials: [], completedCourseIds: ["c1"], failedCourseIds: [] },
      career: {
        currentEmployment: { jobId: "job-1" },
        history: [{ jobId: "job-old" }],
        pendingApplications: [{ jobId: "job-2" }],
      },
    },
    world: {
      agents: [{ actor: { housing: { definitionId: "apt-1" }, inventory: [], career: {}, education: {} } }],
      jobMarket: { openings: [{ jobId: "job-1" }] },
      eventCooldowns: { "event-1": 3 },
      firedUniqueEvents: ["event-2"],
    },
    scheduledEvents: [{ eventId: "event-1" }],
    pendingEventResponses: [{ eventId: "event-2" }],
    ...overrides,
  };
}

function migrate(state: Record<string, unknown>, migration: SimulationMigration, campaign = campaignWith({})) {
  return applySimulationMigration(state, migration.fromVersion, campaign, migration);
}

describe("applySimulationMigration — W102", () => {
  it("fails loudly when the save's own version doesn't match what the migration declares", () => {
    const result = applySimulationMigration(baseState(), "0.8.0", campaignWith({}), { fromVersion: "0.9.0", steps: [] });
    expect(result.ok).toBe(false);
  });

  it("succeeds with an empty step list when the version matches", () => {
    const result = migrate(baseState(), { fromVersion: "0.9.0", steps: [] });
    expect(result.ok).toBe(true);
  });

  it("fails loudly against a non-object kindState", () => {
    const result = applySimulationMigration("not an object", "0.9.0", campaignWith({}), { fromVersion: "0.9.0", steps: [] });
    expect(result.ok).toBe(false);
  });

  describe("remap", () => {
    it("renames an item reference on the player's inventory", () => {
      const result = migrate(baseState(), { fromVersion: "0.9.0", steps: [{ op: "remap", domain: "item", map: { widget: "gadget" } }] });
      expect(result.ok).toBe(true);
      const state = result.value as Record<string, unknown>;
      expect((state["player"] as { inventory: { definitionId: string }[] }).inventory[0]!.definitionId).toBe("gadget");
    });

    it("renames a job reference on both the player and every world.agents[].actor", () => {
      const state = baseState({
        world: {
          ...baseState()["world"] as Record<string, unknown>,
          agents: [{ actor: { housing: {}, inventory: [], career: { currentEmployment: { jobId: "job-1" }, history: [], pendingApplications: [] }, education: {} } }],
        },
      });
      const result = migrate(state, { fromVersion: "0.9.0", steps: [{ op: "remap", domain: "job", map: { "job-1": "job-1-renamed" } }] });
      expect(result.ok).toBe(true);
      const next = result.value as Record<string, unknown>;
      const player = next["player"] as { career: { currentEmployment: { jobId: string } } };
      expect(player.career.currentEmployment.jobId).toBe("job-1-renamed");
      const agent = (next["world"] as { agents: { actor: { career: { currentEmployment: { jobId: string } } } }[] }).agents[0]!;
      expect(agent.actor.career.currentEmployment.jobId).toBe("job-1-renamed");
    });

    it("renames an event id across eventCooldowns keys, firedUniqueEvents, scheduledEvents and pendingEventResponses", () => {
      const result = migrate(baseState(), {
        fromVersion: "0.9.0",
        steps: [{ op: "remap", domain: "event", map: { "event-1": "event-1-new", "event-2": "event-2-new" } }],
      });
      expect(result.ok).toBe(true);
      const state = result.value as Record<string, unknown>;
      const world = state["world"] as { eventCooldowns: Record<string, number>; firedUniqueEvents: string[] };
      expect(world.eventCooldowns).toEqual({ "event-1-new": 3 });
      expect(world.firedUniqueEvents).toEqual(["event-2-new"]);
      expect((state["scheduledEvents"] as { eventId: string }[])[0]!.eventId).toBe("event-1-new");
      expect((state["pendingEventResponses"] as { eventId: string }[])[0]!.eventId).toBe("event-2-new");
    });

    it("renames a course reference across enrollments, completedCourseIds and failedCourseIds", () => {
      const result = migrate(baseState(), { fromVersion: "0.9.0", steps: [{ op: "remap", domain: "course", map: { c1: "c1-new" } }] });
      const state = result.value as Record<string, unknown>;
      const education = (state["player"] as Record<string, unknown>)["education"] as { enrollments: { courseId: string }[]; completedCourseIds: string[] };
      expect(education.enrollments[0]!.courseId).toBe("c1-new");
      expect(education.completedCourseIds).toEqual(["c1-new"]);
    });
  });

  describe("remove", () => {
    it("drops an item from the inventory array entirely", () => {
      const result = migrate(baseState(), { fromVersion: "0.9.0", steps: [{ op: "remove", domain: "item", ids: ["widget"] }] });
      const state = result.value as Record<string, unknown>;
      expect((state["player"] as { inventory: unknown[] }).inventory).toEqual([]);
    });

    it("leaves a single-valued housing site absent, rather than deleting the whole housing object", () => {
      const result = migrate(baseState(), { fromVersion: "0.9.0", steps: [{ op: "remove", domain: "housing", ids: ["apt-1"] }] });
      const state = result.value as Record<string, unknown>;
      const housing = (state["player"] as Record<string, unknown>)["housing"] as Record<string, unknown>;
      expect("definitionId" in housing).toBe(false);
    });

    it("drops the whole currentEmployment when its jobId is removed, leaving history/pendingApplications entries alone unless named", () => {
      const result = migrate(baseState(), { fromVersion: "0.9.0", steps: [{ op: "remove", domain: "job", ids: ["job-1"] }] });
      const state = result.value as Record<string, unknown>;
      const career = (state["player"] as Record<string, unknown>)["career"] as Record<string, unknown>;
      expect(career["currentEmployment"]).toBeUndefined();
      expect((career["history"] as { jobId: string }[]).map((h) => h.jobId)).toEqual(["job-old"]);
    });
  });

  describe("default", () => {
    it("fills a housing site left absent by an earlier remove, and never overwrites one that still resolves", () => {
      // The agent's own housing is a different id ("apt-2") so the "apt-1" remove step
      // only strips the player's — proving default doesn't touch a site that still resolves.
      const state = baseState({
        world: {
          ...(baseState()["world"] as Record<string, unknown>),
          agents: [{ actor: { housing: { definitionId: "apt-2" }, inventory: [], career: {}, education: {} } }],
        },
      });
      const result = migrate(state, {
        fromVersion: "0.9.0",
        steps: [
          { op: "remove", domain: "housing", ids: ["apt-1"] },
          { op: "default", domain: "housing", id: "apt-fallback" },
        ],
      });
      expect(result.ok).toBe(true);
      const next = result.value as Record<string, unknown>;
      const housing = (next["player"] as Record<string, unknown>)["housing"] as Record<string, unknown>;
      expect(housing["definitionId"]).toBe("apt-fallback");
      // The agent's own housing was never removed, so default must not touch it.
      const agent = (next["world"] as { agents: { actor: { housing: Record<string, unknown> } }[] }).agents[0]!;
      expect(agent.actor.housing["definitionId"]).toBe("apt-2");
    });

    it("is a no-op for a domain with no single-valued site (e.g. item)", () => {
      const result = migrate(baseState(), { fromVersion: "0.9.0", steps: [{ op: "default", domain: "item", id: "whatever" }] });
      expect(result.ok).toBe(true);
      expect(result.value).toEqual(baseState());
    });
  });

  describe("require", () => {
    it("fails the load when a surviving reference doesn't resolve against the new campaign", () => {
      const result = migrate(baseState(), { fromVersion: "0.9.0", steps: [{ op: "require", domain: "item" }] }, campaignWith({ items: [] }));
      expect(result.ok).toBe(false);
    });

    it("succeeds once every surviving reference resolves", () => {
      const result = migrate(
        baseState(),
        { fromVersion: "0.9.0", steps: [{ op: "remap", domain: "item", map: { widget: "gadget" } }, { op: "require", domain: "item" }] },
        campaignWith({ items: [{ id: "gadget" } as SimulationCampaign["items"][number]] }),
      );
      expect(result.ok).toBe(true);
    });

    it("checks a housing default against the new campaign too", () => {
      const failing = migrate(
        baseState(),
        {
          fromVersion: "0.9.0",
          steps: [
            { op: "remove", domain: "housing", ids: ["apt-1"] },
            { op: "default", domain: "housing", id: "apt-fallback" },
            { op: "require", domain: "housing" },
          ],
        },
        campaignWith({ housing: [] }),
      );
      expect(failing.ok).toBe(false);

      const succeeding = migrate(
        baseState(),
        {
          fromVersion: "0.9.0",
          steps: [
            { op: "remove", domain: "housing", ids: ["apt-1"] },
            { op: "default", domain: "housing", id: "apt-fallback" },
            { op: "require", domain: "housing" },
          ],
        },
        campaignWith({ housing: [{ id: "apt-fallback" } as SimulationCampaign["housing"][number]] }),
      );
      expect(succeeding.ok).toBe(true);
    });
  });

  it("applies steps in array order — a remap then a require against the renamed id", () => {
    const result = migrate(
      baseState(),
      {
        fromVersion: "0.9.0",
        steps: [
          { op: "remap", domain: "event", map: { "event-1": "event-1-new" } },
          { op: "remove", domain: "event", ids: ["event-2"] },
          { op: "require", domain: "event" },
        ],
      },
      campaignWith({ events: [{ id: "event-1-new" } as SimulationCampaign["events"][number]] }),
    );
    expect(result.ok).toBe(true);
  });
});
