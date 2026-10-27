import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { describe, it, expect } from "vitest";

import { isMainModule } from "./run-if-main.js";

const ENGINE_ROOT = fileURLToPath(new URL("../", import.meta.url));

/**
 * Runs a `scripts/` CLI as its own process — the way `npm run <name>` does — rather than
 * importing its helpers. The entrypoint guard is the thing under test, and an imported helper
 * never passes through it: every CLI's helpers were tested while the commands themselves did
 * nothing on Windows.
 */
function runCli(script: string, args: readonly string[]): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(process.execPath, ["--import", "tsx", `scripts/${script}.ts`, ...args], {
    cwd: ENGINE_ROOT,
    encoding: "utf8",
    timeout: 60_000,
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

describe("isMainModule", () => {
  it("matches the platform's own path for this file, relative or absolute", () => {
    const self = fileURLToPath(import.meta.url);
    expect(isMainModule(import.meta.url, self)).toBe(true);
    expect(isMainModule(pathToFileURL(resolve(self)).href, self)).toBe(true);
  });

  it("refuses a different file and a missing entrypoint", () => {
    expect(isMainModule(import.meta.url, fileURLToPath(new URL("./run-if-main.ts", import.meta.url)))).toBe(false);
    expect(isMainModule(import.meta.url, undefined)).toBe(false);
  });
});

describe("scripts/ CLIs run as processes", () => {
  const invalid: ReadonlyArray<readonly [string, readonly string[], RegExp]> = [
    ["graph-campaign", ["nonexistent"], /Usage: graph-campaign/],
    ["check-content", ["nonexistent"], /Usage: check-content/],
    ["validate-campaign", ["nonexistent"], /Usage: validate-campaign/],
    ["loc-coverage", [], /Usage: loc-coverage/],
    ["diff-resolution", ["nope", "nope"], /Unknown pack set/],
  ];

  it.each(invalid)("%s rejects invalid input with a diagnostic and a nonzero exit", (script, args, diagnostic) => {
    const run = runCli(script, args);
    expect(run.status).toBe(1);
    expect(run.stderr).toMatch(diagnostic);
  });

  const valid: ReadonlyArray<readonly [string, readonly string[], RegExp]> = [
    ["graph-campaign", ["bulgaria-bureaucracy"], /"bulgaria-bureaucracy" — \d+ node\(s\)/],
    ["check-content", ["bulgaria-bureaucracy"], /Checked "bulgaria-bureaucracy": 0 error\(s\)/],
    ["validate-campaign", ["bulgaria-bureaucracy"], /Explored \d+ state\(s\)/],
    ["loc-coverage", ["--shelf"], /campaigns have a second locale/],
    ["diff-resolution", ["--list"], /base\+bulgaria/],
  ];

  it.each(valid)("%s produces its report for valid input", (script, args, report) => {
    const run = runCli(script, args);
    expect(run.stderr).toBe("");
    expect(run.status).toBe(0);
    expect(run.stdout).toMatch(report);
  });
});
