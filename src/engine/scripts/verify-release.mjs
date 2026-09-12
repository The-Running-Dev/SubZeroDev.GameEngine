/**
 * The release guards, as one executable path both the release workflow and a local
 * validation run call (W108.5).
 *
 * Before this script the guards were inline shell in
 * `.github/workflows/release-engine-package.yml`, which meant three things:
 *
 *   1. They could only run by pushing a `v*` tag — the one action W108.6 forbids. The
 *      escaped-quote bug that failed the `v0.10.0` release run (run 33721497785, `syntax
 *      error near unexpected token '('`) was fixed blind, and has still never executed.
 *   2. Nothing bound the published archive to the inspected one. `npm publish` packs a
 *      second time; the digest the workflow had just asserted over was never re-checked.
 *   3. `npm view` failing was read as "this version is publishable". An unauthenticated,
 *      forbidden or unreachable registry fails exactly the same way, so the guard could
 *      not tell "not published yet" from "we cannot see the registry at all".
 *
 * Every subcommand here is non-publishing and side-effect-free apart from reading the
 * tree and the archive. `npm publish` is not reachable from this file.
 *
 * Usage:
 *   node scripts/verify-release.mjs mode     --event <name> --ref <git-ref> [--input-tag <tag>]
 *   node scripts/verify-release.mjs tag      --tag <vX.Y.Z> [--manifest <path>]
 *   node scripts/verify-release.mjs clean    [--root <path>] [--path <pathspec>]...
 *   node scripts/verify-release.mjs archive  --archive <path> [--expect <sha256>]
 *   node scripts/verify-release.mjs registry --package <name> --version <x.y.z> [--registry <url>]
 *
 * Exit codes: 0 the guard holds, 1 the guard rejects the candidate, 2 the guard could not
 * be evaluated. 2 is deliberately distinct: an unevaluated guard is not a passed guard,
 * and the release checklist records it as unavailable rather than as evidence.
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { gunzipSync } from "node:zlib";

const DEFAULT_REGISTRY = "https://npm.pkg.github.com";

const EXIT_OK = 0;
const EXIT_REJECTED = 1;
const EXIT_UNEVALUATED = 2;

class Rejected extends Error {}
class Unevaluated extends Error {}

const scriptDir = import.meta.dirname;
const engineRoot = resolve(scriptDir, "..");

function parseArgs(argv) {
  const options = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      options._.push(token);
      continue;
    }
    const name = token.slice(2);
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) {
      options[name] = true;
      continue;
    }
    index += 1;
    if (name === "path") {
      options.path = [...(Array.isArray(options.path) ? options.path : []), value];
      continue;
    }
    options[name] = value;
  }
  return options;
}

function required(options, name) {
  const value = options[name];
  if (typeof value !== "string" || value.length === 0) {
    throw new Unevaluated(`--${name} is required.`);
  }
  return value;
}

/**
 * Which mode the workflow runs in. `publish` is reachable only from a real `v*` tag push;
 * every other trigger is `validate`, and a validation run must not be able to reach the
 * publish step even by passing a tag-shaped input.
 */
function commandMode(options) {
  const event = required(options, "event");
  const ref = required(options, "ref");
  const inputTag = typeof options["input-tag"] === "string" ? options["input-tag"] : "";

  const isTagPush = event === "push" && ref.startsWith("refs/tags/v");
  const mode = isTagPush ? "publish" : "validate";
  const tag = isTagPush ? ref.slice("refs/tags/".length) : inputTag;

  if (tag.length === 0) {
    throw new Unevaluated(
      "No tag to validate against. A validation run must supply --input-tag (the prospective tag, e.g. v0.11.0).",
    );
  }
  if (!/^v\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(tag)) {
    throw new Rejected(`Not a release tag: '${tag}'. Expected vMAJOR.MINOR.PATCH.`);
  }

  return { mode, tag };
}

/** The tag and the manifest version must name the same release. */
function commandTag(options) {
  const tag = required(options, "tag");
  const manifestPath =
    typeof options.manifest === "string"
      ? resolve(options.manifest)
      : resolve(engineRoot, "package.json");

  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (error) {
    throw new Unevaluated(`Could not read the package manifest at ${manifestPath}: ${error.message}`);
  }

  const version = manifest.version;
  if (typeof version !== "string" || !/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Rejected(`The manifest version is not a release version: ${JSON.stringify(version)}`);
  }
  if (`v${version}` !== tag) {
    throw new Rejected(
      `Tag/version mismatch: tag '${tag}' does not name manifest version '${version}' (expected tag 'v${version}').`,
    );
  }

  return { tag, version, name: manifest.name };
}

/**
 * A candidate is the committed tree, not the working tree. Any tracked modification means
 * the archive would carry bytes no commit records, so the recorded candidate SHA would not
 * identify what was actually packed.
 */
function commandClean(options) {
  const root = typeof options.root === "string" ? resolve(options.root) : resolve(engineRoot, "..", "..");
  const pathspecs = Array.isArray(options.path) ? options.path : [];

  let output;
  try {
    output = execFileSync(
      "git",
      ["status", "--porcelain", "--untracked-files=no", ...(pathspecs.length > 0 ? ["--", ...pathspecs] : [])],
      { cwd: root, encoding: "utf8" },
    );
  } catch (error) {
    throw new Unevaluated(`Could not read the git status of ${root}: ${error.message}`);
  }

  const dirty = output.split("\n").filter((line) => line.trim().length > 0);
  if (dirty.length > 0) {
    throw new Rejected(
      `The candidate tree has ${dirty.length} tracked modification(s); a release packs a committed tree:\n${dirty.join("\n")}`,
    );
  }

  let head;
  try {
    head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  } catch (error) {
    throw new Unevaluated(`Could not read HEAD of ${root}: ${error.message}`);
  }

  return { root, head };
}

/**
 * Tar entry names, without shelling out to `tar`. MSYS `tar` on Windows reads a `D:\…`
 * argument as an scp host and fails on content it never opened, which is how the W107
 * report ended up asserting the archive contents by hand. Parsing the 512-byte headers
 * here is both portable and exact.
 */
function tarEntryNames(archiveBytes) {
  const bytes = gunzipSync(archiveBytes);
  const names = [];
  let offset = 0;
  let longName = null;

  while (offset + 512 <= bytes.length) {
    const header = bytes.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;

    const rawName = header.subarray(0, 100).toString("utf8").replace(/\0.*$/, "");
    const prefix = header.subarray(345, 500).toString("utf8").replace(/\0.*$/, "");
    const sizeField = header.subarray(124, 136).toString("utf8").replace(/\0.*$/, "").trim();
    const size = Number.parseInt(sizeField, 8) || 0;
    const typeFlag = String.fromCharCode(header[156]);
    const dataStart = offset + 512;
    const dataEnd = dataStart + size;

    if (typeFlag === "L") {
      // GNU long name: the real name is this entry's body, and it describes the next one.
      longName = bytes.subarray(dataStart, dataEnd).toString("utf8").replace(/\0.*$/, "");
    } else {
      const name = longName ?? (prefix.length > 0 ? `${prefix}/${rawName}` : rawName);
      longName = null;
      if (name.length > 0) names.push(name);
    }

    offset = dataStart + Math.ceil(size / 512) * 512;
  }

  return names;
}

/**
 * The archive is the release. Its digest is the candidate's identity, and the four content
 * rules are the same ones the workflow asserted inline.
 */
function commandArchive(options) {
  const archivePath = resolve(required(options, "archive"));

  let bytes;
  try {
    bytes = readFileSync(archivePath);
  } catch (error) {
    throw new Unevaluated(`Could not read the archive at ${archivePath}: ${error.message}`);
  }

  const digest = createHash("sha256").update(bytes).digest("hex");

  if (typeof options.expect === "string") {
    const expected = options.expect.replace(/^sha256:/, "").toLowerCase();
    if (digest !== expected) {
      throw new Rejected(
        `Archive digest mismatch: ${archivePath} is sha256 ${digest}, expected ${expected}. The archive was modified, repacked or substituted.`,
      );
    }
  }

  let names;
  try {
    names = tarEntryNames(bytes);
  } catch (error) {
    throw new Unevaluated(`Could not read the archive contents of ${archivePath}: ${error.message}`);
  }

  const failures = [];
  if (names.some((name) => /(^|\/)src\//.test(name))) failures.push("contains source files under src/");
  if (names.some((name) => /(^|\/)tsconfig[^/]*\.json$/.test(name))) failures.push("contains tsconfig JSON files");
  if (names.some((name) => /\.test\.(js|mjs|cjs|ts|d\.ts|js\.map|mjs\.map|ts\.map)$/.test(name)))
    failures.push("contains test build artifacts");
  if (!names.some((name) => name.startsWith("package/dist/"))) failures.push("does not contain dist output");

  if (failures.length > 0) {
    throw new Rejected(`Archive ${archivePath} ${failures.join("; ")}.`);
  }

  return { archive: archivePath, digest, entries: names.length };
}

/**
 * Whether this version is already published — and, when that cannot be determined, saying
 * so rather than reading the failure as a free pass. `npm view` exits non-zero for a
 * version that does not exist, for an unauthenticated request, for a forbidden one and for
 * an unreachable registry; only the first is evidence that publication is possible.
 */
async function commandRegistry(options) {
  const name = required(options, "package");
  const version = required(options, "version");
  const registry = (typeof options.registry === "string" ? options.registry : DEFAULT_REGISTRY).replace(/\/+$/, "");
  const spec = `${name}@${version}`;

  if (!/^(@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(name)) {
    throw new Unevaluated(`Not a package name this guard will look up: ${JSON.stringify(name)}`);
  }

  // This asks the *scoped* registry directly rather than shelling out to `npm view`. The
  // shell-out read the ambient registry configuration, so on a maintainer's machine it
  // asked registry.npmjs.org, got a 404 for a package that only exists on GitHub Packages,
  // and reported an already-published version as publishable. The registry a release
  // publishes to is the only one whose answer means anything here.
  const token = process.env.NODE_AUTH_TOKEN ?? process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? "";
  if (token.length === 0) {
    throw new Unevaluated(
      `No registry credential is available (NODE_AUTH_TOKEN/GITHUB_TOKEN/GH_TOKEN), so ${registry} was never asked about ${spec}. Publishability is unknown, not proven.`,
    );
  }

  const url = `${registry}/${name.replace("/", "%2f")}`;
  let response;
  try {
    response = await fetch(url, {
      headers: { authorization: `Bearer ${token}`, accept: "application/json" },
    });
  } catch (error) {
    throw new Unevaluated(
      `${registry} was unreachable while checking ${spec}, so publishability is unknown, not proven: ${error.message}`,
    );
  }

  if (response.status === 401) {
    throw new Unevaluated(
      `${registry} rejected the credential (401) while checking ${spec}, so publishability is unknown, not proven.`,
    );
  }
  if (response.status === 403) {
    throw new Unevaluated(
      `${registry} refused the request (403) while checking ${spec}, so publishability is unknown, not proven.`,
    );
  }
  if (response.status === 404) {
    return {
      spec,
      registry,
      state: "publishable",
      detail: "The registry answered 404: no such package yet, so this version is not taken.",
    };
  }
  if (!response.ok) {
    throw new Unevaluated(
      `${registry} answered ${response.status} while checking ${spec}; treat publishability as unknown.`,
    );
  }

  let packument;
  try {
    packument = await response.json();
  } catch (error) {
    throw new Unevaluated(`${registry} answered 200 with a body this guard could not read: ${error.message}`);
  }

  const published = Object.keys(packument?.versions ?? {});
  if (published.includes(version)) {
    throw new Rejected(
      `${spec} is already published to ${registry}. A published version is never overwritten or reused.`,
    );
  }

  return {
    spec,
    registry,
    state: "publishable",
    detail: `The registry answered with ${published.length} published version(s); ${version} is not among them.`,
  };
}

const commands = {
  mode: commandMode,
  tag: commandTag,
  clean: commandClean,
  archive: commandArchive,
  registry: commandRegistry,
};

async function run(argv) {
  const [name, ...rest] = argv;
  const command = commands[name ?? ""];
  if (command === undefined) {
    return {
      code: EXIT_UNEVALUATED,
      lines: [`Unknown subcommand ${JSON.stringify(name ?? "")}. Expected one of: ${Object.keys(commands).join(", ")}.`],
    };
  }

  try {
    const result = await command(parseArgs(rest));
    return {
      code: EXIT_OK,
      lines: [`OK ${name}`, ...Object.entries(result).map(([key, value]) => `${key}=${value}`)],
    };
  } catch (error) {
    if (error instanceof Rejected) return { code: EXIT_REJECTED, lines: [`REJECTED ${name}`, error.message] };
    if (error instanceof Unevaluated) return { code: EXIT_UNEVALUATED, lines: [`UNEVALUATED ${name}`, error.message] };
    throw error;
  }
}

const { code, lines } = await run(process.argv.slice(2));
for (const line of lines) process.stdout.write(`${line}\n`);
process.exitCode = code;
