/**
 * The engine's own release version — `capturedUnder` for the replay regression oracle
 * (`07-replay.md` §2), and the value a fixture is stamped with when it is captured or
 * regenerated.
 *
 * Read from `package.json` at import time rather than duplicated as a literal, so there is
 * exactly one place a release bumps the version. `fs.readFileSync` is a boundary read, not
 * an engine-logic one — nothing under `advance` reaches this module, so it does not reopen
 * the determinism guard's `Date.now`/`Math.random` boundary; it is release metadata, not
 * game state.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const packageJsonPath = fileURLToPath(new URL("../package.json", import.meta.url));

interface PackageJsonShape {
  readonly version: string;
}

const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as PackageJsonShape;

export const ENGINE_VERSION: string = packageJson.version;
