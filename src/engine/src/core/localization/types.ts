/**
 * Localization — `LocKey` resolution against string tables.
 *
 * Contract: `04-core.md` §12, §17.
 *
 * Note on scope. §1.1's module table maps the whole of §12 here, but §12 also declares
 * the core result vocabulary — `ReasonCode`, `StateChange`, `OutcomeMessage`,
 * `CommandResult`, `ActionResult`. Those are what `advance` and `submitAction` return,
 * so they live in `kernel`; this module owns only the localization half. The table has
 * not been amended, so the split is recorded here rather than left implicit.
 */

/**
 * A key into the string table. Dotted and namespaced, stable, additive, never renamed —
 * the same discipline `ReasonCode` and `EventName` carry, and for the same reason:
 * clients and tooling depend on the meaning not moving.
 *
 * The core reserves `core.reason.*` (04 §12); registry construction rejects any attempt
 * by a campaign to write into that namespace.
 */
export type LocKey = string;

/** The built, frozen form a client resolves keys against (04 §7). */
export type StringTable = Readonly<Record<LocKey, string>>;
