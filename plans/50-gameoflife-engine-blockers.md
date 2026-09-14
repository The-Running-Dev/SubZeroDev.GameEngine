# Plan — Implementing the five 2026-09-07 simulation-kind amendments

**Status:** proposed, not started. Written 2026-09-07 against engine `main` @ 56295a6.

## What is true today (verified in this tree, not from the decision text)

Five decision entries dated 2026-09-07 in `design/90-decisions.md:1483-1545` amend the
simulation kind, each citing a GameOfLife issue. Every one is contract-only; none is
implemented:

| Decision | GameOfLife issue | Code site | State at 56295a6 |
|---|---|---|---|
| `Modifier.target` grows `player.reputation.*` | #108 (first half) | `src/engine/src/kinds/simulation/validate.ts:76` | `WRITABLE_TARGET_PREFIXES` is needs/attributes/skills + `calendar.committedTimeUnits`. Absent. |
| `ItemDefinition.weeklyCostCents` charged per instance | #108 (second half) | `src/engine/src/kinds/simulation/endOfWeek.ts:820` | The **type field exists** (`content.ts:267`, optional) and is read by nothing; `housing` levies only `HousingState.weeklyCostCents`. Charge absent. |
| `HousingDefinition.utilitiesCents`/`transportCents` | #109 | `src/engine/src/kinds/simulation/content.ts:197` | Neither field exists. No `"vehicle"` tag check anywhere. |
| `NPCDefinition.startingMemories` | #110 | `src/engine/src/kinds/simulation/content.ts:366` | No memory field. |
| `Condition.collection` over seven state arrays | #107 | `src/engine/src/kinds/simulation/conditions.ts:71` | `unresolvableCollection` throws unconditionally. |

`grep -rn "startingMemories\|utilitiesCents\|transportCents\|unknown_collection" src/` returns
nothing. `design/FROZEN.md` does not exist, so authoring commands are available.

Two further facts, both confirmed against the live tracker and `design/30-slices.md`:

- **The engine tracker covers one of the five.** `#418` (open, enhancement) is the collection
  gap. Nothing covers the other four; the highest engine issue is `#425`.
- **The decision ids collide.** `30-slices.md:4525` is `W105 — Documentation and Landing
  Publication Review`, whose criteria are `W105.1`–`W105.7` (docs/landing). The five decisions
  reuse `W105.1`–`W105.5` for unrelated simulation amendments. No slice schedules them, so the
  amendments have no scheduled home upstream — they land only if someone reads
  `90-decisions.md` rather than the tracker.

## The five changes, sized

Ordered by dependency, not by issue number.

1. **Reputation as a Modifier target** (#108a) — one `DerivedPath` union member, one
   `WRITABLE_TARGET_PREFIXES` entry, and the matching `derived.ts`/`resolveEffectiveField` case
   the decision explicitly left out of its own scope. Small. No state shape change; no fixture
   churn unless a campaign starts using it.
2. **`NPCDefinition.startingMemories`** (#110) — one optional field plus the seeding point in
   whichever reducer first materialises an `NPCState`. Small. Absent ⇒ `memories: []`, today's
   behaviour, so no fixture churn.
3. **`Condition.collection`** (#107, closes `#418`) — replace `unresolvableCollection` with a
   resolver over the seven declared arrays, plus a **new Tier 1 `unknown_collection`** check in
   `validate.ts`. Medium. Load-time failure, not runtime, per the decision. Needs both a
   positive and a rejecting negative case with counts stated (house rule: a validator that has
   never failed constrains nothing).
4. **Item running costs** (#108b) — sum `weeklyCostCents` (absent = 0) over inventory items with
   `condition > 0` and charge it in the `inventory` system, unconditionally, no arrears.
   Medium — **it changes `cashCents` trajectories, so committed replay fixtures move.**
5. **Housing utilities/transport** (#109) — two optional `HousingDefinition` fields, matching
   stamped-at-move-in `HousingState` fields, the combined levy through the existing arrears
   pipeline, and the `"vehicle"`-tag transport waiver (this kind's first engine-reserved tag),
   which means threading `items: readonly ItemDefinition[]` into `housing`. Largest, and the
   **only state-shape change**: a `kindVersion` bump plus `Kind.migrateState` migrating existing
   saves to `0`. Fixtures move here too.

**Do 5 last and alone.** It is the only one that bumps `kindVersion`; batching it with anything
else means either two bumps or a unit that does not fit one session.

## Known cost: replay fixtures

`src/engine/fixtures/replay/` holds 50 fixtures. Items 4 and 5 both change simulation-kind cash
outcomes, so the `stable-life*`, `bulgaria-stable-life*` and `long-horizon*` fixtures will need
regenerating. That is expected, not a regression — but each regenerated fixture must be diffed
and the change explained in the PR, or the replay corpus stops being an oracle.

## Proposed sequence

### Phase 0 — Ledger hygiene (small, unblocks everything else)

1. **Renumber the five decision ids** in `design/90-decisions.md` so they stop colliding with
   `W105`'s docs criteria. Recommendation: drop the `W105.n` prefix from the decision headings
   entirely and let each entry name its GameOfLife issue plus the new W id from step 2 — decision
   entries elsewhere in this file are dated-and-titled, not W-numbered, so the prefix was the
   anomaly. Cost of reversing: a `sed` over five headings and any cross-reference.
2. **Add five units to `design/30-slices.md`** as `W109`–`W113`, in the order above, each with
   its contract refs, dependencies and `Done when` criteria carrying stable per-criterion ids.
   Place them **after `W108`** — `W108`'s own scope forbids adding a feature after the verified
   0.11 candidate, so these are 0.12 scope. `W113` (housing) declares the `kindVersion` bump.
3. Regenerate human docs (`./build/ConvertTo-HumanDocumentation.ps1`) and run
   `./build/Test-Documentation.ps1`.
4. **Fresh session**, then `/track` — it opens one issue per new unit. Link `#418` to `W111`
   rather than letting `/track` open a duplicate.

### Phase 1 — Record the two deliberate shortfalls upstream

Both amendments knowingly fall short of what the game issue asked, and neither repository records
it yet:

- **GameOfLife#108** — travel time is deferred, not amended. `item-used-bicycle` stays
  unexpressible after `W109` lands: no stored per-actor travel-time field exists, and
  `HousingDefinition.commuteModifier` is itself unread by any system. Comment on the issue saying
  so, and confirm the engine's open register in `90-decisions.md` carries it (the decision text
  names it; check it is in the register, not only the prose).
- **GameOfLife#107** — a collection member cannot be joined to its content definition, so "any
  owned car" must enumerate `definitionId`s rather than test `ItemDefinition.category`.
  `event-car-breakdown` gets a workable but enumerating form. Comment on the issue with the
  authoring shape that actually works, so the game side is not left discovering it at
  implementation time.

Writing to GameOfLife issues is an external write and needs a go-ahead per issue.

### Phase 2 — Implementation, one unit per session

`/slice W109` … `/slice W113`, each in its own session, each ending `/verify` → `/pr`. Gates per
unit: `npm run typecheck`, `npm run lint`, `npm test` in `src/engine/`, plus
`./build/Test-Documentation.ps1` for any unit that touches `design/`.

Per-unit specifics worth stating now:

- `W111` (collections) — state both counts: cases accepted, and cases the new
  `unknown_collection` check rejects.
- `W112` (item costs) — the regression test is the charge itself; verify by reverting the charge
  and confirming failure.
- `W113` (housing) — migration needs a save written at the pre-bump `kindVersion` as a fixture,
  round-tripped through `loadEnvelope`.

## Decisions taken (user, 2026-09-07)

All four settled; nothing in this plan is open.

1. **0.12 scope.** All five land after `W108`. The 0.11 candidate stays verified and is not
   reopened — `W108.3`'s "no feature after the candidate" rule holds. Consequence accepted: the
   four GameOfLife issues stay blocked until 0.11 ships.
2. **Renumber the decision ids.** Drop the `W105.n` prefix from the five headings in
   `90-decisions.md`; they become dated-and-titled like every other entry in that file. Rejected:
   repointing them to the new `W109`–`W113` ids (would need re-editing if the numbering shifts)
   and leaving the collision recorded as known.
3. **Five units, 1:1 with the GameOfLife issues** — `W109`–`W113` as sized above. Rejected:
   merging the two small units, which would make one engine issue answer two game issues.
4. **Comment both shortfalls upstream** — GameOfLife #108 (travel-time deferral) and #107 (no
   content join). Authorized to post directly, not draft-for-review.
