// Proves the package-backed merge (subzerodev-platform-ui-landing-page@0.2.0's
// `merge` CLI command) against a real landing build and a fixture documentation
// output, so the workflows' `npm --prefix site run merge` step is verified
// before it ever runs for real. Mirrors what the deleted build/Merge-LandingPage.ps1
// used to assert: "/", "/roadmap/" and "/docs/" all present afterwards, and the
// protected docs/ subtree byte-identical. Also proves the guard's negative path
// (30-slices.md W69.6).

import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const siteRoot = fileURLToPath(new URL("..", import.meta.url));
const cliPath = fileURLToPath(
  new URL(
    "../node_modules/subzerodev-platform-ui-landing-page/dist/cli.js",
    import.meta.url,
  ),
);
const landingDist = join(siteRoot, "dist");

function runMerge(landing, docsOutput) {
  return spawnSync(
    process.execPath,
    [
      cliPath,
      "merge",
      "--landing-dist",
      landing,
      "--docs-output",
      docsOutput,
      "--protected-path",
      "docs",
    ],
    { encoding: "utf8" },
  );
}

async function fingerprint(root) {
  const files = new Map();
  async function visit(directory) {
    for (const item of await readdir(directory)) {
      const path = join(directory, item);
      const info = await stat(path);
      if (info.isDirectory()) await visit(path);
      else
        files.set(
          path,
          createHash("sha256")
            .update(await readFile(path))
            .digest("hex"),
        );
    }
  }
  await visit(root);
  return files;
}

// --- Positive path: a real landing build merges onto a fixture docs output ---

const docsOutput = await mkdtemp(join(tmpdir(), "szd-merge-verify-"));
try {
  await writeFile(
    join(docsOutput, "index.html"),
    "<!doctype html><title>stale docs homepage</title>",
    "utf8",
  );
  await mkdir(join(docsOutput, "docs"), { recursive: true });
  await writeFile(join(docsOutput, "docs", "marker.txt"), "protected", "utf8");

  const before = await fingerprint(join(docsOutput, "docs"));

  const result = runMerge(landingDist, docsOutput);
  if (result.status !== 0)
    throw new Error(`Merge of a real landing build failed:\n${result.stderr}`);

  const mergedIndex = await readFile(join(docsOutput, "index.html"), "utf8");
  const builtIndex = await readFile(join(landingDist, "index.html"), "utf8");
  if (mergedIndex !== builtIndex)
    throw new Error("Merged '/' does not match the built landing index.html.");

  const mergedRoadmap = await readFile(
    join(docsOutput, "roadmap", "index.html"),
    "utf8",
  );
  const builtRoadmap = await readFile(
    join(landingDist, "roadmap", "index.html"),
    "utf8",
  );
  if (mergedRoadmap !== builtRoadmap)
    throw new Error(
      "Merged '/roadmap/' does not match the built landing roadmap/index.html.",
    );

  const after = await fingerprint(join(docsOutput, "docs"));
  if (
    before.size !== after.size ||
    ![...before].every(([path, hash]) => after.get(path) === hash)
  )
    throw new Error("Merge changed the protected 'docs/' subtree.");
} finally {
  await rm(docsOutput, { recursive: true, force: true });
}

// --- Negative path: a landing build containing a top-level 'docs/' is rejected ---

const badLanding = await mkdtemp(join(tmpdir(), "szd-merge-bad-landing-"));
const badDocsOutput = await mkdtemp(join(tmpdir(), "szd-merge-bad-output-"));
try {
  await writeFile(join(badLanding, "index.html"), "<!doctype html>", "utf8");
  await mkdir(join(badLanding, "docs"), { recursive: true });
  await writeFile(join(badLanding, "docs", "intruder.txt"), "nope", "utf8");

  await mkdir(join(badDocsOutput, "docs"), { recursive: true });
  await writeFile(
    join(badDocsOutput, "docs", "marker.txt"),
    "protected",
    "utf8",
  );

  const result = runMerge(badLanding, badDocsOutput);
  if (result.status === 0)
    throw new Error(
      "Merge succeeded against a landing build containing a top-level 'docs/' path -- the guard's negative path did not fire.",
    );
  if (!/protected path/i.test(result.stderr))
    throw new Error(`Merge failed for the wrong reason:\n${result.stderr}`);
} finally {
  await rm(badLanding, { recursive: true, force: true });
  await rm(badDocsOutput, { recursive: true, force: true });
}

console.log(
  "Package-backed merge proven: '/', '/roadmap/' and the protected 'docs/' subtree all verified, and the top-level 'docs/' guard rejects a bad landing build.",
);
