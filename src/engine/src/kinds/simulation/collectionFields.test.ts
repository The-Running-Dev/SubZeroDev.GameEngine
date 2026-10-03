import { describe, expect, it } from "vitest";
import { COLLECTION_FIELDS, type FieldTable } from "./collectionFields.js";
import type { InventoryItem, JobApplication } from "./actor.js";
import type { NPCState } from "./state.js";

/**
 * W116.5 — the field table is typed against each item type's properties. These cases are
 * proved by `tsc` (`npm run typecheck`), not by vitest: each `@ts-expect-error` is itself a
 * compile error if the line beneath it ever stops failing, so the table cannot silently stop
 * constraining.
 */
describe("collection field table typing (W116.5)", () => {
  it("rejects a table that leaves a property out", () => {
    // @ts-expect-error — `broken` is declared by InventoryItem and missing here.
    const missing: FieldTable<InventoryItem> = {
      instanceId: "scalar",
      definitionId: "scalar",
      quantity: "scalar",
      acquiredWeek: "scalar",
      purchasePriceCents: "scalar",
      condition: "scalar",
      weeksSinceMaintenance: "scalar",
    };
    expect(missing).toBeDefined();
  });

  it("rejects a table naming a property the type does not declare", () => {
    const extra: FieldTable<JobApplication> = {
      jobId: "scalar",
      submittedWeek: "scalar",
      resolvesWeek: "scalar",
      contested: "scalar",
      outcome: "optional",
      // @ts-expect-error — JobApplication has no `salary`.
      salary: "scalar",
    };
    expect(extra).toBeDefined();
  });

  it("rejects an optional property classified as required", () => {
    const wrong: FieldTable<JobApplication> = {
      jobId: "scalar",
      submittedWeek: "scalar",
      resolvesWeek: "scalar",
      contested: "scalar",
      // @ts-expect-error — `outcome` is declared `?`, so it must be "optional".
      outcome: "scalar",
    };
    expect(wrong).toBeDefined();
  });

  it("rejects an array or object property classified as scalar", () => {
    const wrong: FieldTable<NPCState> = {
      id: "scalar",
      definitionId: "scalar",
      // @ts-expect-error — `memories` is an array, so it must be "composite".
      memories: "scalar",
      currentRole: "scalar",
      availability: "composite",
      flags: "composite",
    };
    expect(wrong).toBeDefined();
  });

  it("covers exactly §8.2's eight collections, each with at least one legal field", () => {
    expect(Object.keys(COLLECTION_FIELDS)).toHaveLength(8);
    for (const fields of Object.values(COLLECTION_FIELDS)) {
      expect(Object.values(fields).some((kind) => kind !== "composite")).toBe(true);
    }
  });
});
