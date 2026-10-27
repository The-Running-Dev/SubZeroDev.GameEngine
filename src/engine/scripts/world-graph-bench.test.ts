import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { createFixture, validateWorkload, WORKLOADS } from "./world-graph-bench-fixture.js";
import { digest, runWorkload, summarize } from "./world-graph-bench.js";
import { parseArgs } from "./bench-world-graph.js";
import { WORLD_GRAPH_SYSTEM_IDS } from "../src/kinds/world-graph/tick/order.js";
import { WORLD_GRAPH_SYSTEMS } from "../src/kinds/world-graph/tick/pipeline.js";

const small = { id: "test", mapSize: 8, seekingGuests: 2, serviceBuildings: 1, productsPerBuilding: 2, staff: 2, batchTicks: 4 };
const options = { samples: 2, warmups: 1, seed: "bench-tests" };

describe("world-graph benchmark correctness (no latency thresholds)", () => {
  it.each(WORKLOADS)("validates and builds $id with the requested workload", (workload) => {
    const f = createFixture(workload, options.seed);
    expect(f.state.map.width).toBe(workload.mapSize);
    expect(f.state.map.terrain).toHaveLength(workload.mapSize ** 2);
    expect(f.state.guests).toHaveLength(workload.seekingGuests);
    expect(f.state.guests.every((g) => g.lifecycle === "seeking")).toBe(true);
    expect(f.state.buildings).toHaveLength(workload.serviceBuildings);
    expect(f.state.buildings.every((b) => Object.keys(b.pricesCents).length === workload.productsPerBuilding)).toBe(true);
    expect(f.state.staff).toHaveLength(workload.staff);
    expect(f.state.incidents).toHaveLength(workload.staff);
    expect(f.state.resolution).toBeNull();
  });

  it("reconstructs identical seeded fixtures and changes layout with a different seed", () => {
    const fingerprint = (seed: string) => { const f = createFixture(small, seed); return digest({ state: f.state, content: f.content }); };
    expect(fingerprint("a")).toBe(fingerprint("a"));
    expect(fingerprint("a")).not.toBe(fingerprint("b"));
  });

  it.each([
    { mapSize: 65 }, { mapSize: 7 }, { mapSize: NaN }, { seekingGuests: 0 }, { seekingGuests: 33 },
    { serviceBuildings: 0 }, { serviceBuildings: 9 }, { productsPerBuilding: 0 }, { productsPerBuilding: 5 },
    { staff: -1 }, { staff: 5 }, { batchTicks: 0 }, { batchTicks: 17 }, { batchTicks: 1.5 },
  ])("rejects out-of-bounds workload %j", (invalid) => {
    expect(() => validateWorkload({ ...small, ...invalid })).toThrow();
  });

  it("runs all twenty systems, retains staff pathfinding, counts ticks and preserves repeatability", () => {
    const first = runWorkload(small, options);
    const second = runWorkload(small, options);
    expect(first.workload).toEqual(small);
    expect(first.processedTicks).toBe(8);
    expect(first.rawSamples.map((s) => s.processedTicks)).toEqual([4, 4]);
    expect(first.warmupTicks).toBe(4);
    expect(first.verification.identicalOutputBatches).toBe(4);
    expect(first.verification.extraTicks).toBe(12);
    expect(first.verification).toEqual(second.verification);
    expect(Object.keys(first.diagnostic.systems)).toEqual([...WORLD_GRAPH_SYSTEM_IDS]);
    expect(Object.values(first.diagnostic.systems).every((s) => s.samples === 4)).toBe(true);
    expect(first.diagnostic.ticks.map((t) => t.tick)).toEqual([1, 2, 3, 4]);
    expect(first.diagnostic.ticks[0]!.assignedStaffAfter).toBe(2);
    expect(first.diagnostic.ticks[0]!.staffWithPathsAfter).toBeGreaterThan(0);
    expect(first.rawSamples.every((s) => s.eventCount > 0)).toBe(true);
  });

  it("rejects a non-repeatable production output", () => {
    const system = WORLD_GRAPH_SYSTEMS.find((s) => s.id === "finance")!;
    const original = system.run;
    let calls = 0;
    const spy = vi.spyOn(system, "run").mockImplementation((frame) => {
      const next = original(frame);
      return { ...next, state: { ...next.state, finances: { ...next.state.finances, cashCents: next.state.finances.cashCents + ++calls } } };
    });
    try { expect(() => runWorkload(small, options)).toThrow("Non-repeatable batch"); }
    finally { spy.mockRestore(); }
  });

  it("rejects an early terminal batch instead of reporting fewer ticks", () => {
    const system = WORLD_GRAPH_SYSTEMS.find((s) => s.id === "objectives")!;
    const original = system.run;
    const spy = vi.spyOn(system, "run").mockImplementation((frame) => {
      const next = original(frame);
      return { ...next, state: { ...next.state, resolution: { resolution: "objectives_met", objectiveIds: [], failureId: null, resolvedAtTick: frame.processingTick } } };
    });
    try { expect(() => runWorkload(small, options)).toThrow("ended early"); }
    finally { spy.mockRestore(); }
  });

  it("detects a difference introduced only in the diagnostic pass", () => {
    const system = WORLD_GRAPH_SYSTEMS.find((s) => s.id === "finance")!;
    const original = system.run;
    let calls = 0;
    const spy = vi.spyOn(system, "run").mockImplementation((frame) => {
      const next = original(frame);
      calls += 1;
      if (calls <= small.batchTicks * (1 + options.warmups + options.samples)) return next;
      return { ...next, state: { ...next.state, finances: { ...next.state.finances, cashCents: next.state.finances.cashCents + 1 } } };
    });
    try { expect(() => runWorkload(small, options)).toThrow("Instrumentation changed"); }
    finally { spy.mockRestore(); }
  });

  it("computes an even median and nearest-rank p95 without mutating input", () => {
    const values = [4, 1, 3, 2];
    expect(summarize(values)).toEqual({ samples: 4, medianMs: 2.5, p95Ms: 4, minMs: 1, maxMs: 4 });
    expect(values).toEqual([4, 1, 3, 2]);
    expect(summarize(Array.from({ length: 20 }, (_, i) => i + 1)).p95Ms).toBe(19);
    expect(() => summarize([])).toThrow();
    expect(() => summarize([Infinity])).toThrow();
  });

  it.each([
    ["--samples", "32"], ["--samples", "1"], ["--samples", "NaN"], ["--warmups", "0"], ["--warmups", "6"],
    ["--scenario", "unknown"], ["--typo", "1"], ["--samples"], ["--samples", "2", "--samples", "3"],
  ])("rejects invalid CLI arguments %j", (...args) => {
    expect(() => parseArgs(args)).toThrow();
  });

  it("executes the actual Node CLI and emits parseable results with provenance", () => {
    const directory = mkdtempSync(join(tmpdir(), "world-graph-bench-"));
    const output = join(directory, "results.json");
    try {
      execFileSync(process.execPath, ["--import", "tsx", "scripts/bench-world-graph.ts", "--scenario", "baseline", "--samples", "2", "--warmups", "1", "--out", output], {
        cwd: fileURLToPath(new URL("../", import.meta.url)), stdio: "pipe",
      });
      const result = JSON.parse(readFileSync(output, "utf8"));
      expect(result.schemaVersion).toBe(1);
      expect(result.source.commit).toMatch(/^[a-f0-9]{40}$/);
      expect(result.runtime.node).toBe(process.version);
      expect(result.results).toHaveLength(1);
      expect(result.results[0].processedTicks).toBe(2);
      expect(result.measurement.limitsEstablished).toBe(false);
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
});
