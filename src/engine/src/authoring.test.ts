/**
 * The author-time surface is closed (W74.7; contract §19, *Published Narrative Authoring*).
 *
 * Two separate claims, because a boundary is only real when something fails on being crossed:
 *
 * - **Nothing enters or leaves unnoticed.** Every exported name — value *and* type — is
 *   compared against a committed sorted list, so adding one fails exactly as loudly as
 *   removing one. Values come from the runtime namespace; types cannot, since they are
 *   erased, so they come from parsing the source with the compiler the package builds with.
 *   The two are cross-checked against each other so the parser cannot quietly go blind.
 * - **No published narrative is reachable through it.** Not by name, and not through the
 *   module graph either. The walk follows exactly the edges that survive erasure — with
 *   `verbatimModuleSyntax`, every statement except `import type` / `export type` is a real
 *   runtime load — so `export type { … } from "./index.js"`, which would otherwise drag in
 *   every published campaign the root exports, correctly counts as no edge at all.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as ts from "typescript";
import * as authoring from "./authoring.js";

/** The documented author-time surface. Sorted, so the exact-match assertions below fail if
 *  either list drifts out of order. */
const AUTHORING_VALUE_EXPORTS = [
  "buildAdventureCampaign",
  "buildCampaign",
  "buildReplayOutcome",
  "buildStoryGraphCampaign",
  "createAdventureSource",
  "digestManifestResolution",
  "digestPortableCampaign",
  "findDivergence",
  "migrateV1AdventureState",
  "runReplayFixture",
  "toPortable",
];

const AUTHORING_TYPE_EXPORTS = [
  "AchievementDefinitionSource",
  "AdventureConfig",
  "AdventureEnding",
  "AdventureRoute",
  "AuthoredText",
  "AutoNodeSource",
  "BuiltCampaign",
  "Campaign",
  "ChoiceNodeSource",
  "ChoiceSource",
  "CommandResult",
  "Condition",
  "Consequence",
  "EndingNodeSource",
  "NodeSource",
  "Outcome",
  "PortableCampaign",
  "PortableCampaignBody",
  "PortableCatalog",
  "PortableManifest",
  "PortableManifestEntry",
  "PortableMigration",
  "RandomNodeSource",
  "RandomTransition",
  "ReplayFixture",
  "ReplayResult",
  "ReplayRunnerContext",
  "ReplayVerdict",
  "StoryGraphCampaign",
  "StoryGraphCampaignSource",
  "StoryGraphKindState",
  "Submission",
  "VarValue",
  "VariableDeclSource",
  "VariableSchemaSource",
];

/**
 * The published narrative families W74.7 names. Matched by whole word, case-insensitively,
 * against names split on `-`/`_` and camelCase boundaries — so `bulgaria-driving` (a campaign
 * id), `buildBulgariaDrivingCampaign` (a builder) and `BULGARIA_DRIVING_CAMPAIGN_ID` (its id
 * constant) are all one needle, but an unrelated word that merely contains a family's letters
 * (e.g. "kawasaki") is not.
 */
const PUBLISHED_NARRATIVE_FAMILIES = ["bulgaria-", "lucifer-", "saki-", "what-would-lucifer-do"];

const WORD_BOUNDARY = " ";

const words = (name: string): string[] =>
  name
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/([A-Za-z])(\d)/g, "$1 $2")
    .replace(/(\d)([A-Za-z])/g, "$1 $2")
    .split(/[-_\s]+/)
    .map((word) => word.toLowerCase())
    .filter((word) => word.length > 0);

const wordKey = (name: string): string => `${WORD_BOUNDARY}${words(name).join(WORD_BOUNDARY)}${WORD_BOUNDARY}`;

const namesPublishedNarrative = (name: string): boolean => {
  const haystack = wordKey(name);
  return PUBLISHED_NARRATIVE_FAMILIES.some((family) => haystack.includes(wordKey(family)));
};

const SOURCE_ROOT = dirname(fileURLToPath(import.meta.url));
const AUTHORING_SOURCE = resolve(SOURCE_ROOT, "authoring.ts");
const EXPORT_CAMPAIGNS_SOURCE = resolve(SOURCE_ROOT, "../scripts/export-campaigns.ts");

const sourceFileCache = new Map<string, ts.SourceFile>();

const parse = (file: string): ts.SourceFile => {
  const cached = sourceFileCache.get(file);
  if (cached !== undefined) return cached;
  const sourceFile = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  sourceFileCache.set(file, sourceFile);
  return sourceFile;
};

/**
 * Names re-exported by a module, split the way erasure splits them. Every export declaration
 * must be a named-exports clause (`export { … } from "…"` / `export type { … } from "…"`) —
 * an `export * from "…"` or a locally declared export would be invisible to this walk, so it
 * fails loudly here rather than silently reporting an incomplete list.
 */
function declaredExports(file: string): { readonly values: string[]; readonly types: string[] } {
  const values: string[] = [];
  const types: string[] = [];
  for (const statement of parse(file).statements) {
    if (!ts.isExportDeclaration(statement)) continue;
    const clause = statement.exportClause;
    if (clause === undefined || !ts.isNamedExports(clause)) {
      throw new Error(
        `${file}: unsupported export declaration (expected a named-exports clause): "${statement.getText()}"`,
      );
    }
    for (const specifier of clause.elements) {
      (statement.isTypeOnly || specifier.isTypeOnly ? types : values).push(specifier.name.text);
    }
  }
  return { values: values.sort(), types: types.sort() };
}

/**
 * The specifiers of a module that still exist after type erasure. `import type` and
 * `export type` are gone; everything else — including `import { type A } from "…"`, whose
 * *statement* survives even though its binding does not — is a real load.
 */
function runtimeSpecifiers(file: string): string[] {
  const specifiers: string[] = [];
  for (const statement of parse(file).statements) {
    let moduleSpecifier: ts.Expression | undefined;
    if (ts.isImportDeclaration(statement)) {
      if (statement.importClause?.isTypeOnly === true) continue;
      moduleSpecifier = statement.moduleSpecifier;
    } else if (ts.isExportDeclaration(statement)) {
      if (statement.isTypeOnly) continue;
      moduleSpecifier = statement.moduleSpecifier;
    }
    if (moduleSpecifier !== undefined && ts.isStringLiteral(moduleSpecifier)) specifiers.push(moduleSpecifier.text);
  }
  return specifiers;
}

/**
 * Resolves a relative runtime specifier to the `.ts` source it compiles from, or `undefined`
 * for a non-source leaf (`.json`) that ends the walk without being parsed as one. Every
 * relative *module* specifier in this package is `.js`-suffixed (NodeNext-style); anything
 * else fails loudly here rather than as a confusing `ENOENT` several calls later.
 */
function specifierToSourceFile(fromFile: string, specifier: string): string | undefined {
  if (specifier.endsWith(".js")) return resolve(dirname(fromFile), specifier.replace(/\.js$/, ".ts"));
  if (specifier.endsWith(".json")) return undefined;
  throw new Error(`${fromFile}: unsupported relative specifier (expected a ".js" or ".json" extension): "${specifier}"`);
}

/** Every source file `authoring.ts` actually loads, transitively, as repository-root-relative paths. */
function runtimeModuleGraph(entry: string): string[] {
  const seen = new Set<string>();
  const pending = [entry];
  while (pending.length > 0) {
    const file = pending.pop() as string;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const specifier of runtimeSpecifiers(file)) {
      if (!specifier.startsWith(".")) continue;
      const sourceFile = specifierToSourceFile(file, specifier);
      if (sourceFile !== undefined) pending.push(sourceFile);
    }
  }
  return [...seen].map((file) => relative(SOURCE_ROOT, file).replaceAll("\\", "/")).sort();
}

/** The campaign source-file basenames `export-campaigns.ts` actually publishes — the real
 *  manifest `PUBLISHED_NARRATIVE_FAMILIES` exists to match, read directly so the two cannot
 *  silently drift apart. */
function publishedCampaignBasenames(): string[] {
  const basenames: string[] = [];
  for (const statement of parse(EXPORT_CAMPAIGNS_SOURCE).statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    const specifier = statement.moduleSpecifier;
    if (!ts.isStringLiteral(specifier)) continue;
    const match = /^\.\.\/src\/campaigns\/(.+)\.js$/.exec(specifier.text);
    const basename = match?.[1];
    if (basename !== undefined) basenames.push(basename);
  }
  return basenames;
}

describe("the author-time subpath is closed (W74.7)", () => {
  it("exports exactly the committed values — a name added or removed fails here", () => {
    expect(Object.keys(authoring).sort()).toEqual(AUTHORING_VALUE_EXPORTS);
  });

  it("exports exactly the committed types — a name added or removed fails here", () => {
    expect(declaredExports(AUTHORING_SOURCE).types).toEqual(AUTHORING_TYPE_EXPORTS);
  });

  it("parses the same value exports the runtime reports, so the type half is trustworthy", () => {
    expect(declaredExports(AUTHORING_SOURCE).values).toEqual(Object.keys(authoring).sort());
  });

  it("retains the shared adventure builder, which is not a published campaign", () => {
    expect(typeof authoring.buildAdventureCampaign).toBe("function");
    expect(typeof authoring.createAdventureSource).toBe("function");
  });

  it("covers every campaign export-campaigns.ts actually publishes, so a new family can't go unmatched", () => {
    const uncovered = publishedCampaignBasenames().filter((basename) => !namesPublishedNarrative(basename));
    expect(uncovered).toEqual([]);
  });

  it("names no published campaign builder, id constant or campaign id", () => {
    const surfaced = [...AUTHORING_VALUE_EXPORTS, ...AUTHORING_TYPE_EXPORTS].filter(namesPublishedNarrative);
    expect(surfaced).toEqual([]);
  });

  it("exports no string value that is a published campaign id", () => {
    const exported: readonly unknown[] = Object.values(authoring);
    const ids = exported.filter((value): value is string => typeof value === "string");
    expect(ids.filter(namesPublishedNarrative)).toEqual([]);
  });

  it("loads no published campaign module, transitively", () => {
    const graph = runtimeModuleGraph(AUTHORING_SOURCE);

    // Without this the walk could pass by reaching nothing at all. `campaigns/` is exactly
    // where a published campaign would appear, and the shared builder proves we get there.
    expect(graph).toContain("campaigns/adventure-builder.ts");

    const basenames = graph.map((file) => (file.split("/").pop() ?? "").replace(/\.ts$/, ""));
    expect(basenames.filter(namesPublishedNarrative)).toEqual([]);
  });
});
