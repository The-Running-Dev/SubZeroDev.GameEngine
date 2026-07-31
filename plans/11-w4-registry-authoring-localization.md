# W4 — Registry, Authoring Builder, Localization

**Status:** Draft — implementing immediately after this document (user directive: "plan
and execute").

**Unit:** [`docs/docs/engine/TODO.md`](../docs/docs/engine/TODO.md) — W4

**Scope:** The frozen in-memory `ContentRegistry`; the `AuthoredText` → `BuiltCampaign`
pure builder; the protected `core.reason.*` string merge; a minimal `LocKey` resolution
utility. Parsing and file I/O stay in an outer adapter that doesn't exist yet — this unit
never reads a file.

## Authority

- [`docs/docs/engine/04-core.md`](../docs/docs/engine/04-core.md) §10.1 (registry, the
  authoring boundary), §12 (reason codes, the protected namespace), §17 (identifier
  conventions).
- `registry/types.ts`, `localization/types.ts`, `kernel/reasons.ts`, `validation/types.ts`
  — read in full; only `kernel/reasons.ts` changes (additive), no other `types.ts` file
  is touched.
- `docs/docs/engine/OPEN-QUESTIONS.md` §1.2 — the base reason-code set was called
  "finalized" once already and grown twice since (W3: `plans/09-w3-pure-engine-kernel.md`
  Decision 2). This unit grows it again — see Decision 1.

## What's Actually Buildable Now

`Campaign.content: unknown` is opaque to the core by design (04 §2's anti-drift rule
applied to §10.1) — the core cannot walk into a kind's own content to find embedded
`AuthoredText`. So the per-kind half of "authoring → registry" (declaring a source type,
walking it, replacing each `AuthoredText` with its `LocKey`) is necessarily **each kind's
own future work** (story-graph's arrives with W9+), not this unit's. What *is* core's job,
and fully buildable without any real kind existing: the **generic merge/freeze mechanism**
every kind's builder will call into — deduplicate identical key/text pairs, hard-fail on a
conflicting one, reject a write into the protected namespace, and assemble the frozen
`ContentRegistry`. `registry/types.ts` already has `AuthoredText`/`BuiltCampaign` typed
from W1, so tests use synthetic `Campaign`/`AuthoredText` fixtures — the same style
`kernel/engine.test.ts` already uses for synthetic campaigns.

## Decisions

### 1. Two new base reason codes: `string_conflict`, `protected_string_key`

Neither of W4's two hard-fail conditions ("the same key with different text," "a write
into `core.reason.*`") has an existing code. Recommendation: add them to
`BASE_REASON_CODES` rather than starting a second, parallel vocabulary for
"registry-assembly-time" codes — the set already grew from 7 to 10 in W3 for the identical
reason (a genuine core-owned rejection needing a stable code), and 04 §12's definition of
the base set ("kind-agnostic base vocabulary") doesn't restrict it to runtime action
rejection specifically. One coherent `core.reason.*`-backed vocabulary beats two
half-populated ones. Brings the set to 12.

### 2. `buildCampaign`/`buildContentRegistry` return `CommandResult`, never throw

These validate **authored content** — a real author can trigger a key/text conflict with a
typo — which is the same class of problem Tier 1 validation (04 §11) reports via
`ValidationError`, not a programmer-error assertion. Contrast W3a's namespace checks
(`makeResolutionEmitters`), which throw because only a bug in engine/kind *code* can reach
them. `CommandResult<T>` (already the vocabulary `createGame`/`deserialize` use) is the
right shape here for the same reason.

### 3. Kind-declared reason codes are not validated for a message in this unit

04 §12: "Kinds own the strings for codes *they* add." `Kind<KState>` (`kernel/types.ts`,
W1) has `reasonCodes: readonly ReasonCode[]` but **no field for supplying their
messages** — there's no mechanism yet for a kind to register a string for its own code.
Inventing one now would be designing ahead of the kind that needs it. TODO's W4
done-criterion ("a registered reason code with no message fails construction") is
satisfied for the **base set**, which is what's checkable today; kind-reason-code message
coverage is deferred to whichever unit actually gives a kind a way to supply one (probably
folds into W5's `validateCampaign` delegation, which has both the registry and the kind by
then).

### 4. Base-code message completeness is a compile-time guarantee, not a runtime check

`CORE_REASON_MESSAGES` is built from a `Record<BaseReasonCode, string>` literal — TypeScript
refuses to compile if any `BaseReasonCode` is missing an entry. This is strictly stronger
than "fails construction": it fails the *build*. A lightweight test still asserts the
completeness property directly, as documentation and as a regression guard if the
construction ever changes shape.

### 5. No duplicate-campaign-id check in `buildContentRegistry`

"Duplicate ids" is explicitly a **Tier 1** concern (04 §11's list names it directly), which
is W5's `validateCampaign`, run *before* a registry is frozen (04 §11's own opening line:
"Every campaign is validated before the registry is frozen"). Adding an id-collision check
here would duplicate a rule that has a named, later owner — `buildContentRegistry` trusts
its input the same way `submitAction` trusts a `GameState` it didn't validate itself.

### 6. `resolveLocKey` operates on the registry's native `ReadonlyMap`, not `StringTable`

`ContentRegistry.strings` is a `ReadonlyMap<LocKey, string>`; the client-facing
`StringTable` (`localization/types.ts`) is a `Readonly<Record<LocKey, string>>` — a
different shape, narrowed to one session's campaign/locale (04 §7's `getStrings`). That
narrowing + Map→Record conversion is W7's job. This unit's `resolveLocKey` is a minimal
lookup against the Map form the registry actually owns.

## Design

### Files

```
src/engine/src/core/
  kernel/
    reasons.ts        # edit — +2 codes, + CORE_REASON_MESSAGES
    reasons.test.ts     # new
  registry/
    strings.ts         # new — mergeStringTables, the shared dedup/conflict primitive
    strings.test.ts      # new
    build.ts           # new — buildCampaign, buildContentRegistry
    build.test.ts        # new
  localization/
    resolve.ts         # new — resolveLocKey
    resolve.test.ts      # new
```

### `mergeStringTables` — the one dedup/conflict primitive, used twice

```typescript
interface StringConflict { key: LocKey; existing: string; incoming: string; }

function mergeStringTables(
  tables: readonly ReadonlyMap<LocKey, string>[],
): { ok: true; strings: ReadonlyMap<LocKey, string> } | { ok: false; conflicts: readonly StringConflict[] };
```

Folds every table left to right: identical key+text pairs dedupe silently; the same key
with different text is recorded as a conflict (accumulated, not fail-fast, so one error
report shows every conflict rather than one at a time). Used by both `buildCampaign`
(folding a flat `AuthoredText[]`, each entry lifted into its own singleton map) and
`buildContentRegistry` (folding `CORE_REASON_MESSAGES` plus every campaign's `strings`).

### `buildCampaign`

```typescript
function buildCampaign(campaign: Campaign, authoredText: readonly AuthoredText[]): CommandResult<BuiltCampaign>;
```

The "AuthoredText → BuiltCampaign pure builder" — generic, reused by every future kind's
own source-schema builder once one exists.

### `buildContentRegistry`

```typescript
function buildContentRegistry(builtCampaigns: readonly BuiltCampaign[]): CommandResult<ContentRegistry>;
```

1. **Protected namespace, checked independently of the merge.** Scans every campaign's own
   `strings` keys for the `core.reason.` prefix *before* merging — necessary because a
   campaign string that happens to match the core's own default text would otherwise
   dedupe silently and never surface as a conflict, letting a protected-namespace write
   slip through unnoticed.
2. **Merge**, via `mergeStringTables([CORE_REASON_MESSAGES, ...campaigns' strings])`.
3. Freeze and return `{ campaigns: Map(...), strings: merge.strings }`.

### `CORE_REASON_MESSAGES` (`kernel/reasons.ts`)

```typescript
const CORE_REASON_TEXT: Readonly<Record<BaseReasonCode, string>> = { /* one English
  sentence per code — compile error if one is missing */ };

export const CORE_REASON_MESSAGES: ReadonlyMap<LocKey, string> = new Map(
  BASE_REASON_CODES.map((code) => [`core.reason.${code}`, CORE_REASON_TEXT[code]] as const),
);
```

## Test Plan

Mapped to TODO's W4 done-criteria:

- [ ] Identical key/text pairs across multiple `AuthoredText` entries (and across two
      campaigns' `strings`) dedupe into one entry.
- [ ] The same key with different text — within one campaign's `authoredText`, and across
      two different campaigns — fails with `string_conflict`, reporting every conflict
      found, not just the first.
- [ ] A campaign's `strings` containing a `core.reason.*` key is rejected with
      `protected_string_key`, **even when the text is identical** to the core's own
      default (the silent-dedupe trap Decision/design section above calls out).
- [ ] `CORE_REASON_MESSAGES` has an entry for every `BASE_REASON_CODES` member (the
      runtime mirror of the compile-time guarantee).
- [ ] `buildContentRegistry([])` (no campaigns) still succeeds, with `strings` containing
      exactly the core messages.
- [ ] `resolveLocKey` returns the string for a present key and `undefined` for an absent
      one; a resolved value round-trips through a `buildContentRegistry` result.
- [ ] No new file imports `fs`, `node:fs`, `path`, `http`, or `node:http` (grep-style
      check, or just visual confirmation — no filesystem/network I/O, per TODO's own
      done-criterion).

## Explicit Non-Goals

- No kind-specific source-schema builder (walking a real kind's authored content) — W9+.
- No Tier 1/2 validation (`validateCampaign`, duplicate ids, referential integrity) — W5.
- No `getStrings`/session-scoped `StringTable` narrowing — W7.
- No change to any committed `types.ts`.

## Suggested Commit Breakdown

All small enough for one PR, same as W3/W3a:

1. `kernel/reasons.ts` + test — the two new codes and `CORE_REASON_MESSAGES`.
2. `registry/strings.ts` + test — `mergeStringTables`.
3. `registry/build.ts` + test — `buildCampaign`, `buildContentRegistry`.
4. `localization/resolve.ts` + test — `resolveLocKey`.
