# W31 — Save Migration

**Unit:** [`docs/docs/engine/TODO.md`](../docs/docs/engine/TODO.md) — *Known Open Items
Carried In*, "No unit owns the real migration mechanism." Proposed as **W31**.

**Scope:** Build the real save-migration mechanism `04-core.md` §10.2 specifies, in one unit.
Originally drafted as a two-unit split (W31 plumbing / W32 remapping); reconsidered and
combined after evaluating the actual risk profile — see *Decisions* below. Planning only —
no code changes yet.

**Depends on:** Nothing engine-side. Chosen from `plans/33`'s Tranche B list.

---

## Why the Gap Is Bigger Than `TODO.md` Says

`TODO.md`'s entry states the gap narrowly: *"W3's `Engine.migrate` is a pass-through to
`deserialize`... the mechanism 04 §10.2 describes... has no W-numbered unit building it."*
Checking the actual code against that framing turned up four things worth stating plainly
before scoping this unit.

### Finding 1: The real save/load path never touches `SaveEnvelope` at all

`SaveEnvelope` (`core/persistence/types.ts`) is a real, well-specified type — but it has
**zero constructors and zero consumers anywhere in the codebase.** Confirmed by grep, not
assumed. `SessionStore.saveGame`/`loadGame` (`core/session/store.ts:379-402`) store and load a
**raw canonical-serialized blob**, with no wrapper, no checksum, no version stamps of any kind:

```typescript
// saveGame — no envelope, just the bare blob
saves.set(saveId, { saveId, blob: record.blob, savedAtSeq: ..., audience: ... });

// loadGame — mustDeserialize calls engine.deserialize() directly.
// engine.migrate() is never called anywhere in this path.
```

"Migration is a pass-through stub" undersells this considerably. The real gap is that the
save format itself has no version-carrying wrapper in the live system — `migrate` being a
stub is a symptom, not the whole problem.

### Finding 2: `Kind` has no version field, but `SaveEnvelope.kindVersion` needs one — resolved

`04-core.md` §10.2 is explicit about why `kindVersion` is its own field, separate from
`engineVersion`: *"a kind's code can change independently of the engine."* `Kind<KState>`
(`core/kernel/types.ts:112`) has no `version` member — checked, not assumed.

**Decided, not just proposed**: `Kind` gains `readonly version: string`, placed beside `id`
among the other readonly metadata fields. Even though kinds ship inside the same package as
the core with no separate `package.json` (`06-extensibility.md` §7, "Kinds Stay
Engine-Owned"), a PR can still touch only `kinds/story-graph/` without touching `core/` —
that is the real distinction §10.2's reasoning points at. A human-maintained semver, bumped
by whoever edits that kind's code, is the same pattern `Campaign.version` already uses — not
a new paradigm. `story-graph` starts at `"1.0.0"`, matching every campaign's own convention.

### Finding 3: No migration-function mechanism exists anywhere — and it cannot be a port

Neither `04-core.md`, `02-architecture.md` §8, nor `06-extensibility.md`'s full port
catalogue describe a registration or dispatch shape for an actual migration function — only
the *property* one must have ("map old ids forward or fail loudly," "never silently discard
state"). Checked the upstream ancestor spec too (§16.4): four prose bullets, equally thin,
no concrete type.

More importantly, `06-extensibility.md` §6's own checklist for adding a port states the rule
that decides this: *"If a host implementation could change `serialize()` output, it is not a
port. Stop."* A migration function's entire purpose is to change state — that is what
"remap old ids" means. **Migration cannot be a host-supplied port under this project's own
rule.** It has to be engine-or-content-owned code, the same category `Kind` and `Campaign`
already are.

This resolves a design question before it could become a wrong turn: no `MigrationSource`
port, no host callback. Migration logic lives with whatever owns the thing that changed —
the kind, for a kind-state shape change; the campaign, for a content-id rename.

### Finding 4: There is nothing real to migrate from yet

Every real campaign (`bulgaria-bureaucracy`, `-driving`, `-return`, `-inheritance`,
`-enterprise`) is at version `1.0.0` — none has ever been re-published. Proving this
mechanism needs a synthetic fixture, not a real prior version — resolved below.

---

## Decisions

### 1. One unit, not two — reconsidered from the original split

Originally split into W31 (envelope wiring, detection, fail-loud-only) and W32 (the actual
remapping mechanism), mirroring how this project split W20 from W21–23. That precedent
doesn't transfer cleanly on re-examination: W20 had **independent value the moment it
landed** — the tag scheme and `ENGINE_VERSION` were immediately consumed elsewhere, before
the replay oracle existed. W31 alone would not: since every real campaign is still at
`1.0.0`, its new "fail loudly on mismatch" path is **currently unreachable in production** —
nothing could trigger it today, so splitting it out for "ship the lower-risk half first"
reasoning doesn't reduce any live risk. Worse, shipped alone, it is a real behavior change
(a new failure mode) delivering detection with no remediation. Both halves need synthetic
fixtures regardless (Finding 4 applies equally to each) — the process overhead of two plans
and two reviews buys no corresponding risk reduction. One unit.

### 2. `Kind` gains a `version` field

Finding 2, above. Touches the one existing kind construction (`storyGraphKind`).

### 3. No new port

Finding 3, above. Migration functions are kind-owned (state-shape changes) or
campaign-owned (content-id renames), never host-supplied.

### 4. Proven against a synthetic fixture, not a real campaign republish

Mirrors W18's and W21's own established pattern — prove the mechanism generically first,
isolated from shipped content, before ever considering applying it to something real. A
deliberate synthetic kind (or a synthetic second version of a throwaway test campaign, not
any of the five real Bulgaria arcs) exercises both the kind-version and campaign-version
migration paths without putting real, currently-stable content back in motion. Republishing
a real campaign is not ruled out forever, but it is not this unit's job, and it would need
its own justification (which arc, why, what actually changes) that this unit has no reason
to manufacture.

---

## Design

Building on `SessionStore.saveGame`/`loadGame`:

- **`saveGame`** stamps `saveFormatVersion`, `serializationVersion`, `engineVersion`
  (`ENGINE_VERSION`, already exported by W20's `version.ts`), `kindId`, `kindVersion` (from
  `Kind.version`, Decision 2), `campaignId`, `campaignVersion` (from the registry), a
  checksum over `state`, and `replayCompatible: true`.
- **`loadGame`** parses the envelope and verifies the checksum, then checks all five stamped
  fields — not just the two content-facing ones:
  - **`saveFormatVersion` / `serializationVersion` mismatch**: fail loudly
    (`save_requires_migration`). Exactly one value exists for each today (this unit
    introduces the wrapper itself), so — mirroring Finding 4's reasoning that there is
    nothing real to migrate a *campaign* from yet — there is equally nothing to migrate an
    envelope *shape* or a *serializer* format from. Building remapping logic for axes that
    have never moved is exactly the kind of validation-for-a-scenario-that-can't-happen this
    project avoids; a future unit earns that logic only once one of these actually bumps.
  - **`engineVersion` mismatch**: never gates anything by itself. §10.2's own reasoning for
    giving it a separate field — "a kind's code can change independently of the engine" —
    cuts the same way in reverse: an engine patch that touches neither the serializer nor any
    kind's state shape shouldn't block a load. Recorded for provenance only.
  - **`kindVersion` / `campaignVersion` mismatch**: the actual migration this unit builds —
    dispatch to the relevant migration function.
  - **On all fields matching**: deserialize normally, exactly as today.
  - **On a `kindVersion`/`campaignVersion` mismatch**: dispatch to the relevant migration
    function —
    - `Kind`-owned, for a kind-version mismatch (kind-state shape changed):
      `Kind.migrateState?(oldState: unknown, fromVersion: string): CommandResult<KState>`.
    - Campaign-owned, for a campaign-version mismatch (content ids renamed), supplied
      alongside whoever registers the new campaign version.
    - When both differ: kind-shape migration runs first, then campaign-content remapping —
      a kind-state shape change is a precondition for content remapping to even address the
      right fields.
  - **On success**: the migrated state, `replayCompatible: false`, per §10.2's own explicit
    consequence — the recorded action log can no longer be guaranteed to reproduce the
    migrated history.
  - **On failure** (no migration function registered, or the registered one itself fails):
    a loud, typed rejection (e.g. `save_requires_migration` / `migration_failed`) — never a
    silent proceed, matching upstream §16.4's "fail clearly," "never silently discard state."

Proof: a synthetic kind with two declared versions, a fixture saved under the first, loaded
against a registry that only has the second registered, migrating a renamed field forward —
mirroring exactly how W18's determinism harness and W21's replay runner were each proven
against a synthetic kind before (or instead of) touching real content.

**Scope note — no persisted-save corpus exists to migrate from.** `SessionStore` holds saves
in an in-memory `Map` (`core/session/store.ts`) with no persistence port in `06-extensibility.md`'s
catalogue — a save does not survive a process restart today. So "no behavior change for
anything currently saved" (Done-When, below) means *within the same running process*: every
save this unit's `loadGame` will ever see was itself written by this unit's `saveGame`, in
the new enveloped shape. There is no real legacy raw-blob corpus in the wild to detect or
upgrade, and adding that detection path now — before any host persists a save across a
version bump — would be speculative complexity this project's own conventions rule out.
This axis becomes real only once a host adds persistent save storage (deferred to NEaaS,
`SubZeroDev.Platform`); building for it now is out of scope, same as Decision 4's real-campaign
deferral.

---

## Done-When

- `Kind` gains `version: string`; `storyGraphKind` declares `"1.0.0"`.
- `saveGame` produces a real `SaveEnvelope`, not a bare blob; `loadGame` verifies its
  checksum and all five stamped fields — `saveFormatVersion`, `serializationVersion`,
  `engineVersion` (informational only), `kindVersion`, `campaignVersion` — before trusting it.
- All fields matching loads exactly as today — no behavior change for any save produced by
  this unit's own `saveGame` (see the Design section's scope note: no prior-format save
  corpus exists to migrate from, in-process or persisted).
- A `saveFormatVersion` or `serializationVersion` mismatch fails loudly — no migration exists
  for either axis, since neither has ever moved.
- A `kindVersion`/`campaignVersion` mismatch with no registered migration fails loudly, with
  a named reason code, never silently proceeding and never silently discarding state.
- A version mismatch with a registered migration succeeds, producing a state with
  `replayCompatible: false`.
- The synthetic fixture proves both the kind-version and campaign-version migration paths,
  and the ordering when both move at once.
- No real Bulgaria campaign is touched or republished.
- `npm run typecheck && npm run lint && npm test` all pass; test count grows.
- `build/Test-Documentation.ps1` passes for any spec changes (`Kind.version` needs stating in
  `04-core.md` §3's interface listing, not just `core/kernel/types.ts`).

---

## Explicit Non-Goals

- **No content-pack resolution work** (`11-content-packs.md`) — a separate, larger,
  explicitly post-MVP unit.
- **No compression or host-side save metadata** — `04-core.md` §10.2 explicitly excludes
  both from `SaveEnvelope`.
- **No republishing of any real Bulgaria campaign** — Decision 4.
- **No new port** — Decision 3.
