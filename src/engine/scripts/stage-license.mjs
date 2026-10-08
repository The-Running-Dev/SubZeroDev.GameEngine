/**
 * Stages the repository's `LICENSE` beside this package's `package.json` for the length of
 * one `npm pack` (S128). npm ships a root `LICENSE` whatever `files` says, but the package
 * root is `src/engine/`, and the licence lives once, at the repository root — a second
 * tracked copy here would be a promise the two diverge. So `prepack` copies it in,
 * `postpack` removes it, and `.gitignore` covers the window between.
 *
 * Usage: node scripts/stage-license.mjs copy | remove
 */

import { copyFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const engineRoot = resolve(import.meta.dirname, "..");
const source = resolve(engineRoot, "..", "..", "LICENSE");
const staged = resolve(engineRoot, "LICENSE");

const [command] = process.argv.slice(2);
if (command === "copy") {
  copyFileSync(source, staged);
} else if (command === "remove") {
  rmSync(staged, { force: true });
} else {
  process.stderr.write(`Unknown command ${JSON.stringify(command ?? "")}. Expected copy or remove.\n`);
  process.exitCode = 2;
}
