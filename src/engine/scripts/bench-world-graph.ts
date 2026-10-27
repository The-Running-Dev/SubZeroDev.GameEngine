/** CLI only: performance clocks and host metadata never enter engine state. */
import { execFileSync } from "node:child_process";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { cpus, availableParallelism, platform, release, arch, totalmem } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { WORKLOADS } from "./world-graph-bench-fixture.js";
import { digest, runWorkload, validateOptions } from "./world-graph-bench.js";

export function parseArgs(args: readonly string[]) {
  const values: Record<string, string> = {};
  const allowed = new Set(["samples", "warmups", "seed", "scenario", "out"]);
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]?.slice(2); const value = args[i + 1];
    if (!args[i]?.startsWith("--") || !key || !allowed.has(key) || !value || value.startsWith("--") || values[key] !== undefined) throw new Error(`Invalid argument: ${args[i]}`);
    values[key] = value;
  }
  const options = { samples: Number(values.samples ?? 7), warmups: Number(values.warmups ?? 2), seed: values.seed ?? "world-graph-bench-v1" };
  validateOptions(options);
  const workloads = values.scenario ? WORKLOADS.filter((w) => w.id === values.scenario) : WORKLOADS;
  if (workloads.length === 0) throw new Error(`Unknown scenario: ${values.scenario}`);
  return { options, workloads, out: values.out };
}

export function main(args: readonly string[]): void {
  if (Number(process.versions.node.split(".")[0]) < 24) throw new Error("World-graph benchmark requires Node >=24");
  const { options, workloads, out } = parseArgs(args);
  const packageRoot = fileURLToPath(new URL("../", import.meta.url));
  const git = (...gitArgs: string[]) => execFileSync("git", gitArgs, { cwd: packageRoot, encoding: "utf8" }).trim();
  // Fail before spending time if this isn't an identifiable git checkout.
  const commit = git("rev-parse", "HEAD");
  const status = git("status", "--porcelain", "--untracked-files=normal");
  const results = workloads.map((workload) => {
    console.error(`Benchmark ${workload.id}: ${options.warmups} warm-up + ${options.samples} measured batches`);
    return runWorkload(workload, options);
  });
  const report = {
    schemaVersion: 1, benchmark: "world-graph-full-tick", recordedAt: new Date().toISOString(),
    source: { commit, dirty: status.length > 0, status,
      harnessDigest: digest(["bench-world-graph.ts", "world-graph-bench.ts", "world-graph-bench-fixture.ts"].map((p) => readFileSync(resolve(packageRoot, "scripts", p), "utf8"))),
      lockfileDigest: digest(readFileSync(resolve(packageRoot, "package-lock.json"), "utf8")) },
    runtime: { node: process.version, versions: process.versions, execArgv: process.execArgv, platform: platform(), release: release(), arch: arch(),
      cpu: cpus()[0]?.model ?? "unknown", logicalCpus: cpus().length, availableParallelism: availableParallelism(), totalMemoryBytes: totalmem() },
    options, arguments: args, measurement: { unit: "ms", entrypoint: "advanceTicks", fixtureSetupTimed: false, eventSink: "in-memory recording",
      percentile: "nearest rank: sorted[ceil(0.95 * n) - 1]", diagnostics: "separate instrumented pass; not primary latency", limitsEstablished: false },
    results,
  };
  const json = `${JSON.stringify(report, null, 2)}\n`;
  if (out) { const target = resolve(out); mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, json); }
  else process.stdout.write(json);
}

// #602 fixes the older shared guard; use the portable URL comparison here even when
// this stacked branch is run before #602 lands. It also keeps imports side-effect free.
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { main(process.argv.slice(2)); } catch (error) { console.error(error); process.exitCode = 1; }
}
