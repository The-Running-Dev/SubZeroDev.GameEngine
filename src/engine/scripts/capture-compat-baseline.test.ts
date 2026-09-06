/**
 * W104.2 — every 0.10 built-in campaign registry still produces the same canonical runtime
 * content (initial `Scene` — projection, available actions, status — and Tier-1/2 findings)
 * as its recorded `v0.10.0` baseline (`fixtures/compat/v0.10.0/*.json`, captured by this same
 * script — `capture-compat-baseline.ts` header — run against that tag).
 *
 * None of these campaigns opt into any field W93-W103 added (projects, businesses, event
 * chains, ...); they predate the additive programme, so this is the "fields omitted" half of
 * the criterion by construction, not by a separate toggle — there is no field to omit that
 * these fixtures ever populated. A future built-in campaign that *does* opt in belongs in its
 * own comparison, not this one.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { ENTRIES, captureEntry } from "./capture-compat-baseline.js";

const BASELINE_DIR = fileURLToPath(new URL("../fixtures/compat/v0.10.0/", import.meta.url));

describe("W104.2 compatibility baseline — v0.10.0 vs HEAD", () => {
  it.each(ENTRIES)("$label: matches the committed v0.10.0 baseline", async (entry) => {
    const baseline = JSON.parse(readFileSync(`${BASELINE_DIR}${entry.label}.json`, "utf8"));
    const captured = await captureEntry(entry);
    expect(captured).toEqual(baseline);
  });
});
