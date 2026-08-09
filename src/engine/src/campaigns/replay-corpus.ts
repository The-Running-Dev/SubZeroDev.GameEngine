/**
 * Shared fixture-I/O scaffolding for `*.replay.test.ts` files — one per kind, but all reading
 * from the same flat `fixtures/replay/` directory (07-replay.md §4). `CORPUS_DIR` resolution
 * (respecting `REPLAY_BASELINE_DIR` for W23's release-tag cross-version job), fixture/outcome
 * loading, existence checks, and prefix-filtered fixture-name enumeration are identical across
 * every kind's replay test file, so they live here once rather than being hand-copied per file.
 *
 * Deliberately outside `core/replay/**`: that module may not import a kind at all
 * (`eslint.config.js`'s dependency-arrow rule), but nothing here does either — this is fixture
 * I/O, not kind-specific test setup (each file's own `makeContext()` stays local for that
 * reason). Living beside the campaigns it serves keeps it on the correct side of that boundary
 * without needing the exemption.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Outcome, ReplayFixture } from "../core/replay/types.js";

export const FIXTURES_DIR = fileURLToPath(new URL("../../fixtures/replay/", import.meta.url));

const rawOverride = process.env.REPLAY_BASELINE_DIR;

/** This commit's own corpus by default; the baseline tag's extracted corpus when W23's
 *  release-tag job sets `REPLAY_BASELINE_DIR`. */
export const CORPUS_DIR = rawOverride ? `${rawOverride.replace(/[/\\]+$/, "")}/` : FIXTURES_DIR;

/** True only when `REPLAY_BASELINE_DIR` points `CORPUS_DIR` somewhere other than this
 *  commit's own fixtures — i.e. the actual cross-*version* comparison 07-replay.md §1
 *  distinguishes from a within-build self-check. */
export const COMPARING_ACROSS_VERSIONS = CORPUS_DIR !== FIXTURES_DIR;

export function loadFixture(name: string, dir: string = CORPUS_DIR): ReplayFixture {
  return JSON.parse(readFileSync(`${dir}${name}.fixture.json`, "utf8")) as ReplayFixture;
}

export function loadExpectedOutcome(name: string, dir: string = CORPUS_DIR): Outcome {
  return JSON.parse(readFileSync(`${dir}${name}.outcome.json`, "utf8")) as Outcome;
}

/** In cross-version mode `dir` (default `CORPUS_DIR`) is the baseline tag's extracted
 *  fixtures, which legitimately lacks a fixture added after that tag. Callers that need a
 *  named fixture to exist only when *not* comparing across versions should gate on
 *  `COMPARING_ACROSS_VERSIONS` themselves — this only answers "is the file there." */
export function hasFixture(name: string, dir: string = CORPUS_DIR): boolean {
  return existsSync(`${dir}${name}.fixture.json`);
}

/** Every `<prefix>*.fixture.json` in `dir` (default `CORPUS_DIR`), by name, sorted — a new
 *  fixture needs no test-file edit to be picked up, only the committed pair of files (07 §4).
 *
 *  **The prefix is load-bearing, not decorative, since W40.** `fixtures/replay/` is one
 *  shared, flat directory across every kind's own corpus — filtering only by `.fixture.json`
 *  picks up every other kind's fixtures too, which then fail with `unrunnable:
 *  campaign_withdrawn` against a registry that only knows one kind. Each kind's replay test
 *  file must filter by its own fixture-name prefix so they coexist in one directory without
 *  enumerating each other's fixtures. */
export function fixtureNamesByPrefix(prefix: string, dir: string = CORPUS_DIR): string[] {
  return readdirSync(dir)
    .filter((f) => f.startsWith(prefix) && f.endsWith(".fixture.json"))
    .map((f) => f.slice(0, -".fixture.json".length))
    .sort();
}
