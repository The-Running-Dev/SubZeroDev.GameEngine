/**
 * Packs the engine and installs that tarball into this project.
 *
 * The dependency is installed rather than declared because the only honest way to
 * declare it is `file:../src/engine/<name>-<version>.tgz`, and that path carries the
 * engine's version — so it goes stale on every bump. It did: the committed pin said
 * `0.1.0` while `package.json` moved to `0.3.0`, leaving a dependency pointing at a
 * file that would never exist.
 *
 * Installing a *packed tarball* rather than linking the source tree is deliberate and
 * load-bearing (`plans/40-w41-engine-consumer-boundary.md`, Decision 2): a `file:` link
 * to `src/engine` resolves through `src/`, so the smoke test would pass while `exports`,
 * `files` and the declaration emit were all still broken — proving nothing about the
 * artefact that actually ships.
 *
 * CI does the same thing inline (`.github/workflows/ci.yml`, "Consumer smoke"); this
 * script is the local equivalent, so `npm run install:engine && npm run build &&
 * npm run smoke` works from a clean checkout.
 */

import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const enginePath = fileURLToPath(new URL("../src/engine", import.meta.url));
const here = fileURLToPath(new URL(".", import.meta.url));

/**
 * Run npm through its own JS entry point rather than the `npm`/`npm.cmd` shim.
 *
 * Two Windows-specific traps this avoids, both hit while writing it: `execFileSync("npm",…)`
 * cannot launch `npm.cmd` at all, and Node refuses to spawn a `.cmd` without a shell
 * (EINVAL — the CVE-2024-27980 mitigation). Reaching for `shell: true` fixes both and
 * introduces a third problem, DEP0190: arguments are concatenated rather than escaped.
 *
 * `npm_execpath` is set by npm for any script it runs and points at `npm-cli.js`, so
 * `node <npm-cli.js> …` sidesteps the shim entirely and is identical on every platform.
 */
const npmCli = process.env["npm_execpath"];
if (!npmCli) {
  throw new Error("npm_execpath is unset — run this through `npm run install:engine`, not `node` directly");
}

const runNpm = (args, options) => execFileSync(process.execPath, [npmCli, ...args], options);

const tarball = runNpm(["pack", "--silent"], { cwd: enginePath, encoding: "utf8" }).trim();

if (!tarball) {
  throw new Error("npm pack produced no tarball name");
}

console.log(`packed ${tarball}`);

runNpm(["install", "--no-save", "--no-audit", "--no-fund", `${enginePath}/${tarball}`], {
  cwd: here,
  stdio: "inherit",
});
