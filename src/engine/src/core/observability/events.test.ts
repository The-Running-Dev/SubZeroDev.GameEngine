import { describe, it, expect } from "vitest";
import { CORE_EVENTS } from "./events.js";

describe("CORE_EVENTS", () => {
  it("every name is namespaced under core.*", () => {
    for (const def of Object.values(CORE_EVENTS)) {
      expect(def.name.startsWith("core.")).toBe(true);
    }
  });

  it("matches the severities in 05-observability.md §8", () => {
    expect(CORE_EVENTS.gameCreated.severity).toBe("info");
    expect(CORE_EVENTS.actionAccepted.severity).toBe("info");
    expect(CORE_EVENTS.actionRejected.severity).toBe("info");
    expect(CORE_EVENTS.gameEnded.severity).toBe("info");
    expect(CORE_EVENTS.rngStreamDerived.severity).toBe("trace");
    expect(CORE_EVENTS.serializeCompleted.severity).toBe("debug");
    expect(CORE_EVENTS.deserializeRejected.severity).toBe("error");
    expect(CORE_EVENTS.validationCompleted.severity).toBe("info");
    expect(CORE_EVENTS.migrationApplied.severity).toBe("warn");
  });

  it("has no duplicate names", () => {
    const names = Object.values(CORE_EVENTS).map((d) => d.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
