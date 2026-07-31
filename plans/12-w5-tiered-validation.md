# W5 — Tiered Validation

**Status:** Draft — implementing immediately after this document (user directive: "plan
and execute").

**Unit:** [`docs/docs/engine/TODO.md`](../docs/docs/engine/TODO.md) — W5

**Scope:** The Tier 1 / Tier 2 framework, core-owned identifier and `LocKey` rules,
delegating kind-specific checks to `Kind.validateCampaign`. Gates W4's
`buildContentRegistry` so an unvalidated registry can never be frozen.

## Authority

- [`docs/docs/engine/04-core.md`](../docs/docs/engine/04-core.md) §11 (the tiers), §17
  (identifier conventions).
- `validation/types.ts` (`ValidationResult`, `ValidationError`, `ValidationWarning`, W1),
  `kernel/types.ts`'s `Kind.validateCampaign` (W1), `registry/build.ts`'s
  `buildContentRegistry` (W4) — read in full; none of the three change.

## What's Actually Buildable Now

04 §11's Tier 1 list — "referential integrity, schema conformance, declared variables,
path validity, duplicate ids, missing string keys" — is split across two owners by what
each one can see:

- **Node/choice/variable/achievement/ending ids, referential integrity within a campaign's
  own graph** — all live inside `Campaign.content: unknown`, opaque to the core by design.
  Only a kind's own `validateCampaign` can check these (story-graph's is 03 §11, not built
  until W9+). Nothing to build here now beyond the delegation call itself.
- **Campaign identity and the one `LocKey` the core touches directly** — `Campaign.id`
  (kebab-case, 04 §17's table) and `Campaign.titleKey` (dotted `type.id[.field]` shape,
  and it must resolve in that campaign's own strings — "missing string keys" applied to
  the one key the core owns). Fully buildable and testable without any real kind.
- **Duplicate campaign ids** — already caught by W4's `buildContentRegistry` (added on
  that PR's review; see `plans/11-w4-registry-authoring-localization.md`'s follow-up
  commit). Not re-implemented here — `Kind.validateCampaign` is scoped to one campaign at
  a time (04 §3) and could never have caught this anyway; W4 already owns it correctly.

Tier 2's three named examples — unreachable content, unexpected cycles,
`no_reachable_choice` — are all story-graph-specific graph-topology concepts. The core has
no Tier-2 checks of its own to contribute; this unit's job for Tier 2 is purely to collect
and pass through whatever a kind's `validateCampaign` reports.

## Decisions

### 1. Three new base reason codes: `invalid_identifier`, `invalid_loc_key`, `missing_string_key`

For the two core-owned Tier-1 checks above (id shape, `LocKey` shape) plus the one
core-owned instance of "missing string keys" (campaign `titleKey`). `missing_string_key`
deliberately reuses 04 §11's own phrase rather than inventing new terminology. Same
reasoning as W3 Decision 2 and W4 Decision 1: one coherent `core.reason.*`-backed
vocabulary, grown as each genuinely core-owned rejection needs a code. Brings
`BASE_REASON_CODES` to 15.

### 2. The gate is a new function, not a change to `buildContentRegistry`

`buildValidatedContentRegistry` (`validation/tiered.ts`) runs every campaign's Tier-1
checks (core-owned + delegated) first; only if none fail does it call W4's
`buildContentRegistry`. "An unvalidated registry can never be frozen" holds for anyone who
enters through this function — the documented, intended front door. `buildContentRegistry`
itself stays untouched and still exported, the same lower-level primitive it was in W4
(useful directly in tests, and it already has its own independent duplicate-id safety net).
Splitting rather than modifying keeps W4's function doing exactly one thing, matching this
project's "one unit, one responsibility" units-of-work discipline.

### 3. Missing-string-key check uses the campaign's own `strings`, not the merged registry

`buildValidatedContentRegistry` checks `builtCampaign.strings.has(campaign.titleKey)` —
the campaign's *own* built strings, from before any cross-campaign merge. A `titleKey`
is that campaign's own identity; if its text wasn't authored as part of that campaign,
something is wrong regardless of what any other campaign or the core happens to also
define at that key.

### 4. An unregistered kind is a Tier-1 failure, not a crash

If `kinds[campaign.kindId]` doesn't resolve, delegation is impossible — reported as
`unknown_kind` (already a base code, from W3) rather than throwing, and validation moves
on to the next campaign instead of stopping the whole batch.

## Design

### Files

```
src/engine/src/core/
  kernel/
    reasons.ts        # edit — +3 codes, +3 messages (CORE_REASON_MESSAGES self-updates;
                        #        the existing completeness test needs no edit)
  validation/
    tiered.ts         # new — buildValidatedContentRegistry
    tiered.test.ts      # new
```

### `buildValidatedContentRegistry`

```typescript
function buildValidatedContentRegistry(
  builtCampaigns: readonly BuiltCampaign[],
  kinds: KindRegistry,
): CommandResult<ContentRegistry>;
```

Per campaign, in order: campaign-id shape (kebab-case), `titleKey` shape (dotted `LocKey`),
`titleKey` presence in that campaign's own strings, then delegate to
`kinds[campaign.kindId].validateCampaign(campaign)` — its errors and warnings both fold
into the aggregate (errors as Tier 1, warnings as Tier 2), continuing through every
campaign rather than stopping at the first so one report shows everything wrong at once
(same accumulate-don't-fail-fast shape as `mergeStringTables`, W4).

If any error accumulated across any campaign: return `ok:false` with all of them,
**`buildContentRegistry` is never called** — nothing is frozen. Otherwise: call
`buildContentRegistry(builtCampaigns)`; if that itself fails (duplicate ids, string
conflicts, protected-namespace writes), surface its errors; on success, return its
`ContentRegistry` with the Tier-2 warnings collected along the way attached.

## Test Plan

Mapped to TODO's W5 done-criteria, using a local stub `Kind` (same self-contained-test-file
style `kernel/engine.test.ts` already established — no shared test-kind module):

- [ ] A Tier 1 error (bad campaign-id shape; bad `titleKey` shape; missing `titleKey`
      string; a stub kind returning a `validateCampaign` error) fails with a `path` set,
      and — critically — the resulting `CommandResult` carries no `value`.
- [ ] A Tier 2 warning (a stub kind returning a `validateCampaign` warning) still loads
      (`ok:true`, a real `ContentRegistry` in `value`) and is reported in `warnings`.
- [ ] A malformed campaign id (uppercase, underscore, leading hyphen) fails with
      `invalid_identifier`; a malformed `titleKey` (no dot, uppercase) fails with
      `invalid_loc_key`.
- [ ] `buildContentRegistry` is never reached when Tier 1 fails — proven by a duplicate
      campaign id *and* a bad campaign-id shape in the same batch both surfacing as
      errors, rather than the duplicate-id check (which lives in `buildContentRegistry`)
      silently winning by being the only one that ran.
- [ ] Multiple Tier-1 problems across multiple campaigns all appear in one result, not
      just the first encountered.
- [ ] An unregistered kind reports `unknown_kind` instead of throwing.

## Explicit Non-Goals

- No kind-specific Tier 1 (dangling nodes, undeclared variables, etc.) — that's the
  story-graph kind's own `validateCampaign`, arriving with W9+; a stub kind fills in here.
- No Tier 2 checks generated by the core itself — none exist to generate; pass-through only.
- No Tier 3 (simulation-time, unwinnable campaigns) — 04 §11 explicitly places it at
  determinism-harness time (W18), not load.
- No change to `validation/types.ts`, `kernel/types.ts`, or `registry/build.ts`.
