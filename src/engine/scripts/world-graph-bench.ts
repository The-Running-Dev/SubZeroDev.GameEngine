import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import { canonicalize } from "subzerodev-data-json";
import { rngHandleFor } from "../src/core/determinism/rng.js";
import { advanceTicks } from "../src/kinds/world-graph/tick/batch.js";
import { BatchChanges } from "../src/kinds/world-graph/tick/changes.js";
import { runWorldGraphTick, WORLD_GRAPH_SYSTEMS } from "../src/kinds/world-graph/tick/pipeline.js";
import { assertReferentialIntegrity } from "../src/kinds/world-graph/actions/common.js";
import { createFixture, validateWorkload, type Workload } from "./world-graph-bench-fixture.js";

export const digest = (value: unknown): string => createHash("sha256").update(canonicalize(value)).digest("hex");
export function summarize(values: readonly number[]) {
  if (values.length === 0 || values.some((n) => !Number.isFinite(n) || n < 0)) throw new Error("Invalid latency samples");
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return { samples: sorted.length, medianMs: sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2,
    p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1]!, minMs: sorted[0]!, maxMs: sorted.at(-1)! };
}

export interface BenchOptions { readonly samples: number; readonly warmups: number; readonly seed: string }
export function validateOptions(options: BenchOptions): void {
  if (!Number.isSafeInteger(options.samples) || options.samples < 2 || options.samples > 31) throw new Error("samples must be 2..31");
  if (!Number.isSafeInteger(options.warmups) || options.warmups < 1 || options.warmups > 5) throw new Error("warmups must be 1..5");
  if (!options.seed || options.seed.length > 128) throw new Error("seed must contain 1..128 characters");
}

export function runWorkload(w: Workload, options: BenchOptions) {
  validateWorkload(w); validateOptions(options);
  const fixture = createFixture(w, options.seed);
  const fixtureDigest = digest({ state: fixture.state, content: fixture.content });
  function fresh() {
    // All construction, cloning and event-buffer setup are outside the measured interval.
    const events: unknown[] = [];
    return { state: structuredClone(fixture.state), events,
      ctx: { ...fixture.ctx, rng: rngHandleFor(options.seed, { kind: "action", seq: 0 }), emit: { emit: (...args: Parameters<typeof fixture.ctx.emit.emit>) => { events.push(args); } } } };
  }
  function execute() {
    const input = fresh();
    const start = performance.now();
    const result = advanceTicks(input.state, { ticks: w.batchTicks }, input.ctx);
    const elapsedMs = performance.now() - start;
    if (result.error || result.state.tick - input.state.tick !== w.batchTicks || result.state.resolution !== null) throw new Error("Benchmark batch was rejected or ended early");
    assertReferentialIntegrity(result.state);
    // Hashing and assertions are outside the measured interval, including for warm-ups.
    return { elapsedMs, processedTicks: result.state.tick - input.state.tick, outputDigest: digest({ result, events: input.events }),
      pipelineEventsDigest: digest(input.events.slice(1, -1)), stateDigest: digest(result.state), changesDigest: digest(result.changes), eventCount: input.events.length };
  }
  const reference = execute();
  let verificationBatches = 1;
  const check = (result: ReturnType<typeof execute>) => {
    verificationBatches += 1;
    if (result.outputDigest !== reference.outputDigest) throw new Error(`Non-repeatable batch: ${w.id}`);
  };
  // Warm-ups restart from exactly the measured workload, rather than silently draining it.
  for (let i = 0; i < options.warmups; i += 1) check(execute());
  const samples = Array.from({ length: options.samples }, () => { const result = execute(); check(result); return result; });

  // A separate diagnostic pass wraps all real entries without replacing or skipping any.
  // Its timing overhead is never included in the primary advanceTicks samples.
  const diagnostic = fresh();
  const changes = new BatchChanges();
  const systemSamples = Object.fromEntries(WORLD_GRAPH_SYSTEMS.map(({ id }) => [id, [] as number[]]));
  const systems = WORLD_GRAPH_SYSTEMS.map(({ id, run }) => ({ id, run: (frame: Parameters<typeof run>[0]) => {
    const start = performance.now(); const next = run(frame); systemSamples[id]!.push(performance.now() - start); return next;
  } }));
  let state = diagnostic.state;
  const ticks = [];
  for (let i = 0; i < w.batchTicks; i += 1) {
    const seekingBefore = state.guests.filter((g) => g.lifecycle === "seeking").length;
    const start = performance.now();
    state = runWorldGraphTick(state, fixture.content, diagnostic.ctx, changes, systems);
    const elapsedMs = performance.now() - start;
    ticks.push({ tick: state.tick, seekingBefore, elapsedMs, seekingAfter: state.guests.filter((g) => g.lifecycle === "seeking").length,
      queuedAfter: state.guests.filter((g) => g.lifecycle === "queued").length, assignedStaffAfter: state.staff.filter((s) => s.task !== null).length,
      staffWithPathsAfter: state.staff.filter((s) => s.path.length > 0).length, servicesCompleted: state.counters.servicesCompleted });
  }
  if (digest(state) !== reference.stateDigest || digest(changes.finish()) !== reference.changesDigest || digest(diagnostic.events) !== reference.pipelineEventsDigest) throw new Error("Instrumentation changed state, changes or events");

  // Check the production batch boundary against a split into individual actions. Changes
  // and batch events are deliberately not compared: their aggregation differs by contract.
  const split = fresh();
  let splitState = split.state;
  for (let i = 0; i < w.batchTicks; i += 1) {
    const result = advanceTicks(splitState, { ticks: 1 }, { ...split.ctx, seq: i, rng: rngHandleFor(options.seed, { kind: "action", seq: i }) });
    if (result.error) throw new Error("Split batch rejected");
    splitState = result.state;
  }
  if (digest(splitState) !== reference.stateDigest) throw new Error("Batch partition changed state");
  if (digest({ state: fixture.state, content: fixture.content }) !== fixtureDigest) throw new Error("Benchmark mutated its fixture");
  return {
    workload: w, seed: options.seed, fixtureDigest, validationWarnings: fixture.validationWarnings,
    latency: summarize(samples.map((s) => s.elapsedMs)),
    amortizedMsPerTick: summarize(samples.map((s) => s.elapsedMs / s.processedTicks)),
    measuredBatches: samples.length, processedTicks: samples.reduce((n, s) => n + s.processedTicks, 0),
    warmupBatches: options.warmups, warmupTicks: options.warmups * w.batchTicks,
    verification: { identicalOutputBatches: verificationBatches, outputDigest: reference.outputDigest, finalStateDigest: reference.stateDigest,
      instrumentationParity: true, splitBatchParity: true, fixtureUnchanged: true, extraTicks: 3 * w.batchTicks },
    rawSamples: samples,
    diagnostic: { ticks, tickLatency: summarize(ticks.map((t) => t.elapsedMs)),
      systems: Object.fromEntries(Object.entries(systemSamples).map(([id, values]) => [id, summarize(values)])) },
  };
}
