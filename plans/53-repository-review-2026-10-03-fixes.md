# 53 — Repository Review (2026-10-03): Fixing the Reproduced Defects

**Status:** plan only — nothing executed. Each slice below needs sign-off before it is opened.

**Source:** `GameEngine-repository-review-2026-10-03.md` (external review, inspected at
`19442c4`, package 0.11.0). Its probes are kept at `artifacts/inspection-probes.mts`.

## 0. Re-verification at `5a5e445` (2026-10-08)

The review is five days and 23 commits old, so every finding was re-checked before planning.
`npx tsx artifacts/inspection-probes.mts` from `src/engine/` reproduces **all four probed
engine defects** at current `main`; the two unprobed ones were re-read in source.

| # | Finding | Sev | Still present | Evidence at `5a5e445` |
|---|---|---|---|---|
| F1 | Hidden `StateChange`s returned by `submitAction`/`previewAction` | P1 | **Yes** | Probe prints `var.secret = 8675309` in both responses. `store.ts:719-729`, `:744-755` return `result.changes`/`messages` unfiltered — while `20-contract.md` §7 (`SessionActionResult.changes`, "audit records, `visible`-gated") says they are gated. **Implementation diverges from contract.** MCP `choose`/`preview_action` and the text client inherit it through the store |
| F2 | Rejected action strands the session under a CAS adapter | P1 | **Yes** | Probe: invalid action, then two valid attempts both `storage_failure`. `store.ts:661` increments `attemptCounter` before dispatch; only the accept path writes. Root cause is in **our** contract: §7.2 gives adapters no version field, so Adventures inferred one from `attemptCounter` ("increments by exactly 1 on every write") — an assumption the engine never made |
| F3 | Failed durable save stays listed and loadable | P2 | **Yes** | Probe. `store.ts:783` `saves.set` precedes `await writeSave` |
| F4 | Caller can mutate a returned state's `actionLog` | P2 | **Yes** | Probe. `engine.ts:221` logs the caller's `params` object by reference |
| F5 | `deserialize` accepts `kindState: null`, mismatched `campaignVersion`, and never checks `kindId` against the campaign | P2 | **Yes** | Probe (null and version). `engine.ts:378` checks presence only; `deserializeState` checks campaign and kind existence independently. `branchSession` (`store.ts:873`) already checks version — the raw path is the outlier |
| F6 | Store caches and lock maps never shrink | P2 | **Yes** | `store.ts:396-424`: `sessions`, `saves`, three lock maps; `runExclusive` sets a tail and never removes it |
| F7 | Package has no `license` field / `LICENSE` file | hygiene | **Yes** | `src/engine/package.json` `files: ["dist"]`, no `license`; `LICENSE` exists only at repo root |
| F8 | CI change detector ignores `consumer-smoke/` | hygiene | **Yes** | `ci.yml` diffs `-- src/engine` only; a consumer-smoke-only PR skips the engine job |

Not reproduced against Adventures' live Postgres — the review didn't either. F2's reproduction is
the engine plus an in-memory adapter carrying Adventures' exact predicate
(`SubZeroDev.Adventures/server/src/persistence.ts`, `where sessions.attempt_counter =
excluded.attempt_counter - 1`), which is sufficient: the defect is the predicate's premise.

## 1. Slices

Numbered from S121 per the ledger convention. One at a time, each runnable, each through
`/agentkit:next`'s normal gate. Order is by severity, then by contract cost — F1 needs no
amendment if D1 goes as recommended, F2 does.

### S121 — One player-response projection at the session boundary (F1)

- **Change.** In `store.ts`, a single `toPlayerResult(result)` applied on all four exits of
  `submitAction` and `previewAction` (accept and reject, each): `changes` and `messages`
  filtered to `visible === true`. Applied **after** the profile upsert, which must keep reading
  the full `result.changes` (`achievement_unlocked`, kind-data `fold`).
- **Not touched.** The pure engine's `ActionResult` stays complete — it is the internal audit
  surface (replay, observability, profile fold). The boundary is the store, which is where §7
  already says a client never receives the envelope.
- **Contract.** None (D1 decided: store filters) — the code is brought to the existing §7 comment.
  Tighten the §7 comment to state *who* gates (one sentence), and the §12 line "`visible` gates
  what a client may show".
- **Tests.** (a) The review's shape: serialize the *entire* `SessionActionResult` to JSON and
  scan for a secret marker, across preview/submit × accept/reject — not `scene` or `view`.
  (b) A hidden `OutcomeMessage`. (c) Profile upsert still unlocks a hidden-path achievement.
  (d) Same scan through the MCP `choose`/`preview_action` tools. Revert-the-fix check.
- **Downstream.** Adventures returns the store result as its HTTP body, so it is fixed by the
  submodule bump with no code change. Its client must not depend on hidden changes — check
  before bumping.

### S122 — A committed revision, separate from the attempt counter (F2)

- **Change.**
  1. `StoredSessionRecord` gains `revision: number` — `0` on create/load/branch, `+1` on every
     accepted write, **never** on a rejection or preview. `attemptCounter` stays what it is:
     telemetry stamping (plan 14 Decision 4), no longer something an adapter may compare.
  2. §7.2 states the CAS rule explicitly so no adapter infers one again: *an adapter that
     detects concurrent writers accepts a `put` for an existing `sessionId` only when its
     stored `revision` equals the incoming `revision - 1`, and otherwise throws a
     `SessionPersistenceConflict`-branded error.*
  3. On `concurrent_modification`, `submitAction` **evicts** the cached record instead of
     restoring it. Restoring is correct for `storage_failure` (the cache was right, the write
     failed); on a conflict the cache itself is stale — another instance wrote — so the retry
     the shipped message asks for must re-read persistence. §7.2's blockquote already permits
     "restore or evict"; this picks evict for the conflict case.
- **Contract.** Amendment: one field on `StoredSessionRecord`, one rule in §7.2, mirrored in
  `04-core`'s generated page. Shape decided in D2.
- **Tests (composition, not unit).** A reusable in-memory CAS adapter in the session test
  helpers, then: rejected → valid succeeds; preview → valid succeeds; two store instances over
  one adapter race, loser gets `concurrent_modification`, retry succeeds and sees the winner's
  state; `storage_failure` still restores. Revert-the-fix check on each.
- **Downstream (Adventures, separate PR after the engine release).** Migration adding a
  `revision` column (backfill `0` is safe: every existing row's next write is then
  `revision 1`), CAS predicate moved to it, conflict thrown with `name =
  "SessionPersistenceConflict"` so it surfaces as `concurrent_modification` rather than 503.
  Run its skipped Postgres suite somewhere that can.

### S123 — A save exists only once it is durable (F3)

- **Change.** `saveGame` publishes to `saves` after `writeSave` resolves. `createSession`,
  `loadGame` and `branchSession` already write before `sessions.set` — audit confirms, no
  change.
- **Contract.** One sentence beside §7.2's blockquote: a failed write leaves no cache trace —
  the general form of the rule the conflict case already states.
- **Tests.** Failing `saves.put` → `listSaves` excludes it, `loadGame` raises `unknown_save`,
  and a fresh store instance over the same adapter agrees.

### S124 — The engine owns what it logs (F4)

- **Change.** `submitAction`/`previewAction` in `engine.ts` copy `params` once on entry
  (`ActionParams` is a flat record of primitives, so a shallow copy is complete) and use the
  copy for both `kind.advance` and `LoggedAction`. Freezing is not needed and not proposed.
- **Contract.** None — §4 already says the engine never mutates its input; this is the
  converse ownership the type implied but didn't enforce. One sentence in §4.
- **Tests.** The probe as a test: mutate after submit, `serialize` unchanged. Determinism and
  replay suites unaffected (byte-identical output for non-mutating callers).
- **Audit, not fix.** The review's "similar ownership assumptions around campaign structures":
  check whether `buildValidatedContentRegistry` copies or freezes host-supplied campaigns.
  Whatever it finds goes to `90-decisions.md`'s open register, not into this slice.

### S125 — `deserialize` checks identity agreement (F5, part 1)

- **Change.** `deserializeState` additionally rejects `kindId !== campaign.kindId` with
  `invalid_state`. No policy question. The `campaignVersion` mismatch is **not** handled here
  (see D3). It becomes the trigger for content-epoch adoption, a separate design.
- **Contract.** Amendment to §2/§4's deserialize rules, covering the kind-agreement check only.
- **Tests.** The rejection, with its event. The save-envelope path still migrates.
- **Known and retained until epochs land.** On the raw path, a session serialized under one
  resolution and deserialized under another is still accepted silently. Record this in the
  open-register entry D3 creates, not as a fix here.

### S126 — Kind-owned state validation (F5, part 2)

- **Change.** A new required `Kind.validateState(kindState, campaign): boolean` on the seam,
  implemented by all three kinds as a structural check of their own `kindState`, called by
  `deserializeState` after the S125 checks and after migration.
- **Contract.** Kind-seam amendment (`20-contract.md` Kind interface, each kind's own section,
  the conformance list). The most expensive slice here: three shapes to state exactly.
- **Tests.** Per kind: a valid state round-trips; `null`, a missing required field and a
  wrong-typed field each reject `invalid_state`; every committed replay fixture and save
  fixture still deserializes.
- **Sizing note.** If any one kind's check is not small, S126 splits per kind rather than
  growing.

### S127 — Bounded store lifetime (F6)

- **Change.**
  1. `runExclusive` removes a lock entry when its run settles **and** the map's current value
     is still that run's tail — a newer queued operation must never be dropped.
  2. Cache bound (D4 decided). When `persistence` is supplied, sessions are held in an LRU under
     an optional `sessionCacheLimit`, which is unbounded by default. Saves are not
     cached either, and reads go to persistence. Without `persistence`, both maps are the
     storage and stay unbounded.
- **Contract.** (1) none. (2) the `sessionCacheLimit` option, contracted in `10-design.md`'s
  06 block.
- **Tests.** Lock map empty after N sequential and N concurrent commands on one session; a
  queued operation survives the earlier one's cleanup. Eviction: an evicted session reloads from
  persistence and continues identically.
- **Not here.** Cache/session/blob metrics — a separate observability question, recorded in the
  open register.

### S128 — Release hygiene (F7, F8)

- `src/engine/package.json`: `"license": "MIT"`; ship the repository `LICENSE` in the tarball
  (copied at pack time, not duplicated in the tree). `scripts/verify-release.mjs` asserts the
  archive contains it.
- `ci.yml` change detector: pathspec `src/engine consumer-smoke .github/workflows/ci.yml`.
- `agent.md:137`'s "15 tests" — replaced with a pointer to `npm test`, not a new number (the
  review's "generate volatile facts" point; a number would drift again).

## 2. Decisions needed before the affected slice opens

Presented one at a time for sign-off, per the working conventions.

- **D1 (S121) — who gates `visible`.** **Decided 2026-10-08: the store filters, for every
  audience, `ai` included.** *Recommendation as presented: the store filters, for every audience.*
  §7's "`visible`-gated" on `SessionActionResult` reads most naturally as "the store has
  gated them", and a client-side gate cannot hide anything from a client. Alternative: keep
  them and require clients to filter — costs nothing now and leaves the leak. A middle option
  (unfiltered for `audience: "ai"`) is not recommended: `ai` is the rival view (§9), narrower
  in intent, not privileged.
- **D2 (S122) — revision shape.** **Decided 2026-10-08: a `revision` field on
  `StoredSessionRecord` plus the stated `revision - 1` rule.** *Recommendation as presented:
  the same.* Matches the shape Adventures already uses, so its migration
  is a column rename in spirit. Alternative: `put(record, expectedRevision)` — more explicit
  at the call, but changes the adapter signature every host implements, and a host that
  ignores the extra argument still type-checks, so it enforces less than it appears to.
- **D3 (S125) — live session on changed content.** **Decided 2026-10-08: content is injected
  into running sessions by *content epochs*. This is spun out to a design pass, not a fix slice.**
  The first recommendation was to reject on mismatch with `save_requires_migration`. It was
  rejected because it defeats the purpose. Since W120, `campaignVersion` is the resolution
  digest and attachments are part of it, so injecting a side quest changes the version of every
  live session on that campaign. Rejecting on mismatch would end exactly the sessions injection
  exists for. The settled answers:
  1. **Scope: both.** Host-wide publication reaches every live session on a campaign, and
     per-session overlays layer on top of it. Per-session overlays need a content store and a
     privacy story (08 treats params as hostile).
  2. **Replay stays exact.** Adoption is a logged system entry
     (`{ seq, system: "content", from, to }` over `ResolutionId`s). Replay switches content at
     that seq, so adopting no longer costs `replayCompatible`. The replay oracle has to be able
     to retrieve the resolution chain, which adds a failure mode in place of
     `campaign_version_missing`.
  3. **A session that cannot adopt stays pinned** to its epoch. Published resolutions are kept
     content-addressed by `ResolutionId`. This is the version-addressed registry, used as a
     fallback and for replay, not as the default path.
  4. **The kind judges adoptability** (for example `Kind.adoptContent?(kindState, from, to)`).
     Additive changes adopt by default. A breaking change needs the campaign's `migrateState`,
     or the session stays pinned.
  Two mechanisms are also implied. A host-side registry handle (`current()` / `publish()`)
  validates through the tiered pipeline *before* the swap, so injected content fails at publish
  time and never at `requireNode`. Sessions adopt only at a turn boundary, on the next touch.
  Contract cost: a registry handle, a `Kind` seam, a `LoggedAction` variant, and replay and
  fixture identity. That cost is why this runs as `/agentkit:design` (Opus, high) and not
  inside this plan.
- **D4 (S127) — cache bound.** **Decided 2026-10-08: opt-in LRU for sessions, and saves are not
  cached at all.** *Recommendation as presented: when `persistence` is supplied, cache sessions
  under a host-supplied `sessionCacheLimit` (LRU, default unbounded so behaviour is unchanged
  until a host opts in), and stop caching saves at all — they are written once and read
  rarely.* Without `persistence` the cache *is* the storage and stays unbounded by
  definition. Alternative: a fixed internal LRU with no option — no contract change, but a
  number the engine has no basis to choose.

## 3. Out of scope for this plan

The review's non-defect recommendations go to `design/90-decisions.md`'s open register as one
entry each, not into slices: documentation front door and capability map; performance
envelope and benchmarks (pathfinder, action-log copying); module splits; a story-extension
contract to replace Adventures' structural merge; the "three directions proven" wording;
naming. Several are product calls rather than defects, and none blocks the eight above.

**Content epochs (D3)** get their own open-register entry, carrying D3's four settled answers
and S125's retained raw-path gap. That entry is the input to the `/agentkit:design` pass. It
overlaps the "story-extension contract" item above. The design pass decides whether it subsumes
that item.

## 4. Sequence

1. Sign off D1, then S121.
2. Sign off D2, then S122; engine release; Adventures PR (revision column, branded conflict,
   Postgres suite run).
3. S123, S124 — no decisions; can follow directly.
4. S125, then S126. D3 is decided and spun out, so S125 no longer waits on it.
5. S127. D4 is decided.
6. S128 any time.
7. Add S121–S128 to `design/30-slices.md` once signed off; open-register entries for §3.
