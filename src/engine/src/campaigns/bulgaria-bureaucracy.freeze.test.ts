/**
 * The Bureaucracy campaign is frozen regression evidence, not a publication source (W74a,
 * `design/30-slices.md`; `02-architecture.md` §13; `04-core.md` §19). Today
 * `bulgaria-bureaucracy.ts`/`.bg.ts` are both the replay oracle's baseline and a shipped
 * publication, so an edit made for the story's sake — a corrected typo, a rebalanced stat —
 * silently moves the baseline everything else is measured against, and the move only shows
 * up much later as an unrelated replay failure nobody can date.
 *
 * `bulgaria-bureaucracy.freeze.golden.json` pins both locale builds byte-for-byte: each
 * build's `toPortable()` form (the same shape `scripts/export-campaigns.ts` digests, so this
 * mirrors what a real publication step would see) canonically serialized, and that same
 * value's `digestPortableCampaign`. A mismatch on either fails with a named message, not a
 * bare digest diff — the whole point is that whoever breaks this reads *why* immediately,
 * rather than filing it as a mysterious replay regression days later.
 */

import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { canonicalStringify } from "../core/persistence/canonical.js";
import { toPortable } from "../portable/format.js";
import { digestPortableCampaign } from "../portable/digest.js";
import { buildBulgariaBureaucracyCampaign, bulgariaBureaucracyCatalog, bulgariaBureaucracyMigration } from "./bulgaria-bureaucracy.js";
import { buildBulgariaBureaucracyCampaignBG } from "./bulgaria-bureaucracy.bg.js";
import golden from "./bulgaria-bureaucracy.freeze.golden.json" with { type: "json" };

const FROZEN_MESSAGE =
  "bulgaria-bureaucracy is frozen regression evidence (W74a, 02-architecture.md §13): this " +
  "edit changed the built campaign. If the story changed on purpose, the replay corpus in " +
  "fixtures/replay/ and this golden (bulgaria-bureaucracy.freeze.golden.json) must be " +
  "regenerated together — a lone golden update silently moves the oracle everything else is " +
  "measured against.";

function enPortable() {
  const built = buildBulgariaBureaucracyCampaign();
  if (!built.ok || !built.value) throw new Error("expected the real campaign to build");
  return toPortable(built.value, bulgariaBureaucracyCatalog, bulgariaBureaucracyMigration);
}

function bgPortable() {
  const built = buildBulgariaBureaucracyCampaignBG();
  if (!built.ok || !built.value) throw new Error("expected the Bulgarian campaign to build");
  return toPortable(built.value, bulgariaBureaucracyCatalog);
}

describe("W74a — the Bureaucracy fixture is frozen byte-for-byte", () => {
  it("W74a.1 — the English build's canonical serialization matches the committed golden", () => {
    expect(canonicalStringify(enPortable()), FROZEN_MESSAGE).toBe(golden.en.canonical);
  });

  it("W74a.1 — the English build's digestPortableCampaign matches the committed golden", () => {
    expect(digestPortableCampaign(enPortable()), FROZEN_MESSAGE).toBe(golden.en.digest);
  });

  it("W74a.1 — the Bulgarian build's canonical serialization matches the committed golden", () => {
    expect(canonicalStringify(bgPortable()), FROZEN_MESSAGE).toBe(golden.bg.canonical);
  });

  it("W74a.1 — the Bulgarian build's digestPortableCampaign matches the committed golden", () => {
    expect(digestPortableCampaign(bgPortable()), FROZEN_MESSAGE).toBe(golden.bg.digest);
  });

  it("W74a.1 — the comparison is sensitive to a one-character change, not just gross structural drift", () => {
    const corrupted = `${golden.en.canonical.slice(0, -1)}${golden.en.canonical.endsWith("}") ? ")" : "}"}`;
    expect(() => expect(canonicalStringify(enPortable()), FROZEN_MESSAGE).toBe(corrupted)).toThrow();
  });

  it("W74a.2 — the failure message names the freeze and the regeneration path, not a bare digest mismatch", () => {
    expect(FROZEN_MESSAGE).toContain("frozen regression evidence");
    expect(FROZEN_MESSAGE).toContain("replay corpus");
  });

  it("W74a.3 — all four evidence suites exist beside this one", () => {
    const suites = [
      "bulgaria-bureaucracy.replay.test.ts",
      "bulgaria-bureaucracy.determinism.test.ts",
      "bulgaria-bureaucracy.locale.test.ts",
      "bulgaria-bureaucracy.observability.test.ts",
    ];
    for (const suite of suites) {
      const path = fileURLToPath(new URL(suite, import.meta.url));
      expect(existsSync(path), `${suite} is one of the four evidence suites this freeze depends on (replay, determinism, locale, observability) — deleting it must fail this check, not silently shrink the evidence`).toBe(true);
    }
  });
});
