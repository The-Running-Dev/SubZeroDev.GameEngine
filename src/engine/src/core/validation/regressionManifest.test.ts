/**
 * W96.2 — the regression evidence manifest.
 *
 * Names, per shipped kind, the test suites and golden replay fixtures that constitute this
 * repository's regression evidence, and fails `npm test` — the same gate CI already runs —
 * when any named file is missing. `fixtureNamesByPrefix` (`replay-corpus.ts`) enumerates
 * whatever fixtures happen to exist; deleting one just shrinks what it enumerates without
 * failing anything (only `world-graph-mvp.replay.test.ts` and `long-horizon.replay.test.ts`
 * guarded their two terminal fixtures this way, and only for `win`/`loss`). This file is the
 * complement: an explicit list per kind, so a deleted suite or fixture is a named, failing
 * assertion rather than a smaller number nobody compared against anything.
 */

import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FIXTURES_DIR } from "../../campaigns/replay-corpus.js";

const SRC_ROOT = fileURLToPath(new URL("../../", import.meta.url));

interface KindManifest {
  readonly kind: string;
  /** Paths relative to `src/`. */
  readonly suiteFiles: readonly string[];
  /** Fixture base names in `fixtures/replay/` — each names a `.fixture.json`/`.outcome.json` pair. */
  readonly fixtureNames: readonly string[];
}

const MANIFEST: readonly KindManifest[] = [
  {
    kind: "story-graph",
    suiteFiles: [
      "kinds/story-graph/advance.test.ts",
      "kinds/story-graph/settle.test.ts",
      "kinds/story-graph/achievements.test.ts",
      "kinds/story-graph/variables.test.ts",
      "kinds/story-graph/validate.test.ts",
      "campaigns/bulgaria-bureaucracy.replay.test.ts",
      "campaigns/bulgaria-bureaucracy.determinism.test.ts",
      "campaigns/bulgaria-bureaucracy.freeze.test.ts",
      "campaigns/bulgaria-bureaucracy.locale.test.ts",
      "campaigns/bulgaria-bureaucracy.observability.test.ts",
    ],
    fixtureNames: ["bureaucracy-full-arc", "bureaucracy-gated-choice", "bureaucracy-mid-arc"],
  },
  {
    kind: "simulation",
    suiteFiles: [
      "kinds/simulation/advance.test.ts",
      "kinds/simulation/endOfWeek.test.ts",
      "kinds/simulation/endOfWeek.w57.test.ts",
      "kinds/simulation/startOfWeek.test.ts",
      "kinds/simulation/events.test.ts",
      "kinds/simulation/resolvers.test.ts",
      "kinds/simulation/resolvers.w57.test.ts",
      "campaigns/stable-life.replay.test.ts",
      "campaigns/stable-life.broken.test.ts",
      "campaigns/stable-life.client-parity.test.ts",
      "campaigns/bulgaria-stable-life.replay.test.ts",
      "campaigns/long-horizon.replay.test.ts",
      "campaigns/stable-life-events.test.ts",
      "campaigns/stable-life-packs.test.ts",
    ],
    fixtureNames: [
      "bulgaria-stable-life-loss", "bulgaria-stable-life-win",
      "long-horizon-loss", "long-horizon-win",
      "stable-life-education", "stable-life-education-withdrawal", "stable-life-effect-expiry",
      "stable-life-employment", "stable-life-events-headline", "stable-life-events-week-limit",
      "stable-life-housing-avoiding-eviction", "stable-life-housing-eviction",
      "stable-life-loss", "stable-life-possessions", "stable-life-win",
    ],
  },
  {
    kind: "world-graph",
    suiteFiles: [
      "kinds/world-graph/kind.test.ts",
      "kinds/world-graph/reasons.test.ts",
      "kinds/world-graph/spatial.test.ts",
      "kinds/world-graph/tick/pipeline.test.ts",
      "kinds/world-graph/tick/effects.test.ts",
      "campaigns/world-graph-mvp.test.ts",
      "campaigns/world-graph-mvp.replay.test.ts",
    ],
    fixtureNames: [
      "world-graph-mvp-achievement", "world-graph-mvp-cleaning", "world-graph-mvp-construction",
      "world-graph-mvp-incidents", "world-graph-mvp-loss", "world-graph-mvp-restock", "world-graph-mvp-win",
    ],
  },
];

describe("W96.2 regression evidence manifest", () => {
  for (const entry of MANIFEST) {
    describe(entry.kind, () => {
      it.each(entry.suiteFiles)("names suite %s, and it exists", (relativePath) => {
        expect(existsSync(`${SRC_ROOT}${relativePath}`), relativePath).toBe(true);
      });

      it.each(entry.fixtureNames)("names the %s fixture pair, and both files exist", (name) => {
        expect(existsSync(`${FIXTURES_DIR}${name}.fixture.json`), `${name}.fixture.json`).toBe(true);
        expect(existsSync(`${FIXTURES_DIR}${name}.outcome.json`), `${name}.outcome.json`).toBe(true);
      });
    });
  }
});
