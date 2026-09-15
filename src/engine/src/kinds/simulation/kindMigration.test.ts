import { describe, it, expect } from "vitest";
import { migrateSimulationKindState } from "./kindMigration.js";

const FROM_VERSION = "1.0.0";

function v100Save(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    player: {
      identity: { actorId: "player", name: "Test", age: 25, backgroundId: "bg-1" },
      housing: {
        definitionId: "housing-1", movedInWeek: 1, ownership: "renting", damage: 0,
        weeklyCostCents: 5000, depositPaidCents: 0, rentDueWeek: 1, overdueRentCents: 0,
        missedPayments: 0, evictionStage: "none",
      },
    },
    world: { agents: [] },
    ...overrides,
  };
}

describe("W113.6 — migrateSimulationKindState", () => {
  it("rejects a fromVersion other than the one it accepts", () => {
    const result = migrateSimulationKindState(v100Save(), "0.9.0");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]?.code).toBe("migration_failed");
  });

  it("rejects a state that isn't a plain object", () => {
    const result = migrateSimulationKindState(null, FROM_VERSION);
    expect(result.ok).toBe(false);
  });

  it("defaults player.housing.utilitiesCents and transportCents to zero", () => {
    const result = migrateSimulationKindState(v100Save(), FROM_VERSION);
    expect(result.ok).toBe(true);
    if (!result.ok || result.value === undefined) return;
    expect(result.value.player.housing.utilitiesCents).toBe(0);
    expect(result.value.player.housing.transportCents).toBe(0);
    // Every field the v1.0.0 save already carried survives untouched.
    expect(result.value.player.housing.weeklyCostCents).toBe(5000);
    expect(result.value.player.housing.definitionId).toBe("housing-1");
  });

  it("defaults every world.agents[].actor.housing the same way as the player", () => {
    const save = v100Save({
      world: {
        agents: [
          { id: "agent-1", actor: { housing: { weeklyCostCents: 3000 } } },
          { id: "agent-2", actor: { housing: { weeklyCostCents: 4000 } } },
        ],
      },
    });
    const result = migrateSimulationKindState(save, FROM_VERSION);
    expect(result.ok).toBe(true);
    if (!result.ok || result.value === undefined) return;
    const agents = result.value.world.agents as unknown as { actor: { housing: { weeklyCostCents: number; utilitiesCents: number; transportCents: number } } }[];
    expect(agents[0]!.actor.housing).toMatchObject({ weeklyCostCents: 3000, utilitiesCents: 0, transportCents: 0 });
    expect(agents[1]!.actor.housing).toMatchObject({ weeklyCostCents: 4000, utilitiesCents: 0, transportCents: 0 });
  });

  it("is idempotent against a state that already carries the new fields", () => {
    const alreadyMigrated = v100Save({
      player: {
        ...v100Save().player as Record<string, unknown>,
        housing: {
          ...(v100Save().player as { housing: Record<string, unknown> }).housing,
          utilitiesCents: 1500, transportCents: 800,
        },
      },
    });
    const result = migrateSimulationKindState(alreadyMigrated, FROM_VERSION);
    expect(result.ok).toBe(true);
    if (!result.ok || result.value === undefined) return;
    // Already-set non-default values are preserved, not overwritten with the defaults.
    expect(result.value.player.housing.utilitiesCents).toBe(1500);
    expect(result.value.player.housing.transportCents).toBe(800);
  });

  it("round-trips a fixture holding a v1.0.0 save through load with both new fields defaulted to zero", () => {
    const fixture = v100Save({
      player: {
        ...v100Save().player as Record<string, unknown>,
        finances: { cashCents: 12345 },
      },
    });
    const result = migrateSimulationKindState(fixture, FROM_VERSION);
    expect(result.ok).toBe(true);
    if (!result.ok || result.value === undefined) return;
    expect(result.value.player.housing.utilitiesCents).toBe(0);
    expect(result.value.player.housing.transportCents).toBe(0);
    expect((result.value.player as unknown as { finances: { cashCents: number } }).finances.cashCents).toBe(12345);
  });
});
