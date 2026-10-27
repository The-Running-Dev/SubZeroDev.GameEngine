# 54 — Durable Content Epochs in SubZeroDev.Adventures

Finding 5 of the 2026-10-17 repository review (P1): Adventures refreshes content by building a new
engine and store, so a durable session stamped with an earlier campaign version fails with
`unknown_campaign` after any refresh. Approved in principle on 2026-10-17. Planning only: nothing
here is executed until the decisions in §2 are signed off and the go signal is given.

Evidence: SubZeroDev.Adventures `origin/main` ac3f97d, engine submodule 81327a1.

- `server/src/composition.ts`. `createServerDemo` calls `createEngine({ kinds: KINDS, registry })`
  and `createInMemorySessionStore`, with no `archive` and no `content` channel.
- `server/src/content-cell.ts` publishes a whole new `ServerDemo` per successful rebuild.
- The pinned engine already exports `createContentArchive`, `EngineHost.archive` and
  `SessionHost.content`, so most of this is host work. §2 D1 is the exception.

## 1. Scope

**In:**
- One engine, store and archive per process.
- Durable, immutable epochs, plus an explicit publication manifest with a current pointer.
- Atomic, recoverable publication.
- Exact epoch hydration with digest verification.
- An access-scoped channel, so compatible adoption happens.
- A catalog that stays current without replacing the store.
- A narrowly classified `campaign_version_unavailable`.
- Database conflict protection across replicas.
- A defined private-content retention policy.

**Out:**
- Retiring `shared/campaign-extension.ts`. It stays. Attachments do not cover what it does: a
  `StoryGraphAttachment` adds exactly one choice to a host node, and nothing adds achievements.
  An engine follow-up for that is registered in `design/90-decisions.md`, not built here.
- `sessionCacheLimit` (Finding 6) is a separate item.

**Prerequisite:** #602 merges, then the already-approved Adventures `initialization` round-trip
change lands. This work bumps the submodule past both, together with the engine change D1 needs.

## 2. Decisions needed before work starts

### D1 — Epoch identity — **approved 2026-10-17: (a) and (b), with the requirements below**

**Approved rule.**
- An epoch is identified by three things:
  - the campaign's canonical content, as composed;
  - its explicit composition inputs: `includes`, and the attachments applied to it, in order;
  - its authored string table, which is its own strings plus every module it composes,
    transitively.
- Unrelated campaigns are outside that identity, and so are core and kind-owned messages.
- Engine-owned messages are supplied from the running engine's catalog whenever a runtime
  registry is assembled.
- Historical *authored narrative* strings are preserved. Historical *engine-error wording* is
  not promised through epochs. If that wording is ever needed, it takes a separately identified
  catalog snapshot.

**Requirements carried into §3 and §5.**
- **Ownership comes from provenance, never from a prefix.** String ownership survives registry
  construction:
  - `ContentRegistry` gains a per-campaign authored table;
  - `buildContentRegistry` and `composeValidateAndAssemble` populate it from the
    `BuiltCampaign` strings and the composition's `validationStrings`;
  - an authored key that happens to equal an engine-owned key, text included, stays in the
    authored table and is not discarded.

  The fix is not confined to `archive.ts`: today's merged `strings` table cannot say who owns a
  key.
- **The hashed input is exactly what is persisted.** It is the composed campaign data (no
  `migrateState`), the composition inputs and the authored table, in canonical form.
  - Hydration recomputes the digest from that stored form and does not recompose, so a change
    to `Kind.composeContent` in an engine upgrade cannot alter a stored epoch's identity.
  - The engine exports the digest function, so host and engine cannot diverge.
- **Packs.** A registry built through `buildValidatedPackRegistry` folds strings per key across
  the whole pack set, so a pack can rewrite any key a campaign renders. For those registries,
  each campaign's authored table is the fold's whole authored table, still minus engine-owned
  messages. The coupling there is real, not accidental, so it is stated rather than engineered
  away. Adventures does not use packs.
- **Publication is per campaign; activation is not.** Campaigns validate and publish into the
  archive one registry each. The catalog publication the host selects (§3.2) activates whole
  and atomically. A campaign that fails validation fails the publication exactly as it does
  today: core campaigns all-or-nothing, submissions quarantined. This change adds no
  partial-refresh behaviour.
- **The channel is per campaign.** After several registries are published, `archive.latest()`
  names only the last one, so it is not the channel. The host supplies a channel that answers
  each campaign's active version from the current publication, under the host's authorization
  policy.
  - The reference archive's own `current` is corrected in the same engine slice, to answer the
    last version published *for that campaign*. `latest()` is unchanged.
  - Adventures still uses its own channel, not the reference one.

Follow-on decisions: D1.1, D1.2 and D1.3, all decided, below.

### D1.1 — An authored key the engine owns — **decided 2026-10-17**

**New publications.**
- An authored key reserved by the running engine is refused, whether or not its text matches.
- What is reserved:
  - the existing `core.reason.` prefix, kept as it is;
  - every explicit key in the core catalog and in each registered kind's `reasonMessages`.
- Before landing, the engine fixtures and the Adventures content are checked for collisions. Any
  that exist are corrected explicitly, by renaming the authored key and its references. Nothing
  removes an authored string or its provenance silently.

**Previously persisted epochs.**
- The epoch's authored strings and digest stay exactly as stored.
- An engine upgrade that claims an authored key neither rewrites that text nor, on its own,
  stops the host from starting.
- Engine-owned messages resolve through the running engine's catalog, separately from authored
  content. No flattened table may let either meaning overwrite the other.
- Each such key gets a structured warning, `historical_string_collision`, carrying the
  `{campaignId, campaignVersion, key}`.

**Where the exception applies.** Only to an already persisted epoch whose identity is verified.
It is a separate archive entry point, `restore`, and never `publish`:
- `restore` takes only the stored epoch form and its stored digest, and refuses a mismatch.
- The stored form records the reserved-key set the epoch was checked against when it was
  published.
- `restore` tolerates a collision only for a key that was *not* reserved at that point. Anything
  else is refused, exactly as `publish` refuses it.
- In Adventures, `restore` is called only from boot hydration over `content_epochs`, and rows
  there are written only by the publication path.

The flat string table cannot hold two meanings for one key. D1.3 decides how responses
carry both.

### D1.3 — How one key carries two meanings — **decided 2026-10-17**

`StringTable` is `Readonly<Record<LocKey, string>>`. `getStrings`, `CampaignCatalog.strings`
and offline bundles all return one flat table, and clients resolve every reference against it.
Origin is a property of each reference *value*, not of a field:
- story-graph's `reasonKey` is `choice.requirementFailKey ?? "core.reason.requirement_unmet"`,
  authored or engine depending on the choice;
- world-graph projects `world-graph.action.*` and `world-graph.scene.*` next to authored
  `nameKey`s;
- simulation projects `simulation.negotiate.*` and `simulation.finance.investment`.

**Decision: response-only aliases for engine-owned references.** Authored keys, authoritative
state, action logs, replay inputs and epoch digests are unchanged.
- Aliasing the *authored* side is ruled out. Simulation's and world-graph's `kindState` store
  LocKeys copied from content (`descriptionKey`, `displayNameKey`, `nameKey`), so rewriting them
  would change `serialize()` and break cross-version replay.
- A typed origin on every reference (`LocRef = { key, origin }` with a split table) stays a
  possible future API redesign, registered in the open register. It is not this slice.

**The reserved response namespace.**
- An alias is any key containing `~`. `~` is reserved to engine responses.
- `publish` refuses an authored key containing `~`, as `protected_string_key` with
  `details.reason: "response_alias_namespace"`, extending D1.1's refusal. `restore` tolerates it
  for a legacy epoch (below).
- Engine catalog keys (core and every registered kind) may not contain `~`. An engine test
  enforces it; it is what makes the alias map injective.
- `LocKey` stays `string` in the type. The authored-key restriction is stated in the contract
  next to the existing shape rule, `LOC_KEY_SHAPE` in
  `src/engine/src/core/validation/tiered.ts`, which today is enforced for `titleKey` only.

**Legacy keys in the namespace.** A grammar added now cannot guarantee that no persisted epoch
used `~`, because only `titleKey` was ever shape-checked.
- Checked 2026-10-17: the 1957 authored keys in Adventures `origin/main`
  (`public/campaigns/*.json`) and the engine campaign sources use no character outside
  `[a-z0-9._-]`. Nothing occupies the namespace today. The fallback covers what was not scanned
  and epochs restored later.
- The alias of engine key `k` is `~k` when no authored key in scope equals it. Otherwise it is
  `~1~k`, `~2~k`, …, the smallest `n` whose form is unoccupied. Engine keys contain no `~`, so
  distinct engine keys never produce the same alias.
- An authored entry is never overwritten, renamed or dropped to make room for an alias.
- **Scope** is the authored key set of every epoch in the archive. A new publication can add
  neither a collision (D1.1) nor a `~` key, so the map changes only when `restore` adds an
  epoch: in practice, once per boot. Every surface, session and replica holding the same epochs
  computes the same map.

**Which references are aliased: by known ownership, never by matching text.**
- An engine key `k` is *colliding* when some epoch in scope authors `k`. In production only
  colliding keys are aliased. Every other engine reference is emitted unchanged, as today.
- Aliases are applied where an engine-owned reference is produced. The store does not rewrite
  every `messageKey`, and nothing rewrites every occurrence of a catalog key. An authored
  reference whose literal key equals an engine key is left alone.
- The contract carries an **ownership table**, one row per producer, each row verified against
  the code during the slice:
  - core `CommandResult` and `ValidationError` reason codes, and store warnings
    (`core.reason.${code}`): engine;
  - each kind's `reasonMessages` keys emitted from `resolve` and validation: engine;
  - story-graph's scene `reasonKey` and its requirement-failure error: authored when
    `requirementFailKey` is set, engine otherwise. This is mixed, so ownership travels per value;
  - world-graph's `world-graph.action.*` and `world-graph.scene.*`, and simulation's
    `simulation.negotiate.*` and `simulation.finance.investment`: engine;
  - every LocKey read from content or `kindState` (`nameKey`, `titleKey`, world-graph alert
    `titleKey` and `messageKey`, `descriptionKey`, `displayNameKey`): authored;
  - outcome messages: per producer, each recorded in the table.
- Where one field is mixed-origin, the producer marks each value's ownership on an internal
  carrier. It is not exported and not serialized, and exists only between the producer and the
  response boundary. It never reaches a public type.

**Aliasing stays outside execution.**
- The mapping function is available only to response projection: `project`, the available-action
  list, previews, and the store's response builder.
- It is *not* a member of the `KindContext` handed to state construction, `resolve` or
  `migrateState`, nor of anything feeding the action log, the audit data used for profile
  folding, or `serialize()`. The absence is a type-level guarantee, not a convention.
- Errors and outcome messages produced inside `resolve` are aliased by the store when it builds
  the response, after logging and profile folding have consumed the unaliased values.

**One mapping across every response surface.** Projections, available actions, previews,
errors, outcome messages, `getStrings`, `listCampaigns` and catalog strings, and offline bundles
use the same map, and agree on both references and table entries.
- A response table holds:
  - the authored strings of every live epoch contributing to the response;
  - each unaliased engine key, with the running engine's text;
  - each alias, with the running engine's text.
- So for a colliding `k`, entry `k` is the authored text and entry `alias(k)` the engine text.
- An action response whose messages come from the old epoch while its scene comes from the newly
  adopted one draws on both epochs' authored strings. The map is archive-wide, so both halves use
  the same aliases.
- Aliases are response-scoped presentation identifiers. The client contract states that a client
  must not persist one apart from the table it arrived with.

**Proof criterion.** A forced-alias test context aliases *every* engine-owned reference.
- Every engine-owned reference must be aliased and resolve to the engine's text.
- Every authored reference must remain unchanged, including when its literal key equals an
  engine-owned key.
- There is deliberately no blanket "no raw engine key appears" assertion. It would reject the
  historical collision this design exists to support.
- Coverage:
  - all three kinds;
  - accepted and rejected actions;
  - previews;
  - authored requirement-failure messages;
  - epoch-crossing responses;
  - offline bundles;
  - a legacy authored key occupying `~k`, which forces the `~1~k` fallback.
- Existing serialized golden and replay fixtures pass unchanged. Presentation expectations may
  change deliberately to verify aliases, and the pull request lists each one.

### D1.2 — A stored epoch that an upgraded kind no longer validates — **decided 2026-10-17**

Hydration brings each stored epoch back through `restore` (D1.1), which, like `publish`, runs
the *current* kind's `validateCampaign`. An engine upgrade that tightens validation can
therefore reject an epoch whose digest is intact.

**Decision: retain the verified epoch, classified as unsupported by this runtime.**
- Previously persisted content does not bypass current validation because it once passed.
  `restore` always validates.
- `restore` reports three outcomes apart:
  - **integrity failure**, a digest mismatch: the boot fails (§4, *Hydration identity*);
  - **unsupported**, a verified epoch the running kind rejects;
  - **restored**.
- An unsupported epoch:
  - keeps its authored content, version, digest and publication history exactly as stored.
    Nothing rewrites a row, assigns a new digest, or moves the publication pointer;
  - is recorded with the rejecting `kindId` and `kindVersion`, the publishing ones, and the
    validation diagnostics. This is a runtime classification, recomputed at every boot and
    emitted as a structured `epoch_unsupported` warning. It is not persisted, since a later
    runtime may support the epoch again;
  - is not entered into the executable archive, so the engine resolver never returns it, and the
    channel never offers it for adoption.
- **The host keeps running.** Supported campaigns, and sessions on supported epochs, are
  unaffected. That includes sessions pinned on an older, supported epoch of a campaign whose
  current epoch is unsupported: they get no offer and stay pinned.
- **Requests needing the epoch.** An authorized request that needs it (resume, load, branch,
  strings, offline bundle) gets a recoverable `409` with `campaign_version_unsupported`. That is
  distinct from `campaign_version_unavailable` (the epoch is missing, §3.6) and from an integrity
  failure (which never reaches a request).
- **The publication manifest is preserved.** A campaign whose current entry names an unsupported
  epoch is reported in the catalog as unavailable with that code, and refuses `createSession`.
  It is never switched to another version, and the publication is never rewritten.

**Recovery** is one of three things, each explicit:
- a compatible runtime: the next boot re-validates, and the epoch is restored under its stored
  digest;
- a validated compatibility fix in the kind, released as an engine change;
- an explicit migration of the affected sessions, under the existing migration and
  replay-compatibility rules. A migrated session is replay-incompatible, and capture refuses it
  as today.

Nothing reinterprets an existing session under another epoch automatically. A content fix
published as a new version is a new epoch; it does not touch sessions on the unsupported one.

**A rejection is not evidence the break was intended.** "Unsupported" is the operational
classification only. When the running kind's `kindVersion` equals the publishing one, the
upgrade promised compatibility for that content, so the warning carries
`potentialRegression: true`. The release notes then carry it as an item to investigate, not as
an accepted break.

Rejected alternatives:
- Failing the boot lets one historical epoch brick the host after an upgrade.
- Skipping validation on hydration serves content the running kind has said it cannot play.

### D1 as presented — why identity was coupled

The rule is fixed in `10-design.md` 16 §3.4, and `archive.ts`'s `epochDigest` implements it: an
epoch's identity is the campaign's canonical digest plus the publishing registry's **full**
`strings` table. `buildContentRegistry` (`src/engine/src/core/registry/build.ts`) always merges
`CORE_REASON_MESSAGES`, plus any kind messages, into that table. For Adventures that has two
consequences:

1. **Cross-campaign coupling.** Adventures builds one registry for every campaign. If one campaign
   edits a string, or a new campaign is added with its own strings, every other campaign's digest
   changes at its unchanged version. The publication is then refused with
   `content_version_conflict`, so adding a campaign would refuse the whole refresh.
2. **Engine coupling.** Suppose a submodule bump edits any `core.reason.*` text. The next
   publication of every unchanged campaign then conflicts with its stored epoch, permanently. The
   host cannot mint new versions for content it did not author, submissions included.

Recommendation as presented (approved, and refined by the requirements above):
- **(a) Host side, no engine change:** publish **one registry per campaign**, holding that campaign
  and its own strings. This removes coupling 1, matches `stringsFor`'s existing per-campaign
  privacy partition, and isolates a failing submission to itself.
- **(b) Engine contract amendment, in this repository, before the Adventures work:** exclude
  engine-owned strings (`core.reason.*` and kind messages) from the epoch digest. They are
  versioned by the engine (`kindVersion`, the package version), not by content. A stored epoch
  still keeps its own copy, so an old session renders the text it resolved.
  - Edits: 16 §3.4 and `20-contract.md` §4 (the `ContentArchive` publish rule), plus `archive.ts`.
  - Recorded in the decision log.
  - Cost is low today: no archive digest is persisted anywhere yet, so nothing needs migrating.

Alternatives:
- (a) alone leaves coupling 2: the first engine upgrade that touches a reason message bricks
  refresh.
- Having the host recompute a digest that ignores core strings would be a second, divergent
  implementation of the identity rule.

### D2 — Extended campaigns need their own version — **decided 2026-10-17**

Today an extension changes a base campaign's content under its authored version. With
content-addressing, that is refused as soon as the base's unextended epoch is held. The same
happens when an extension is added, edited, quarantined or revoked under an unchanged base.

Facts checked 2026-10-17:
- **Same author.** An extension may extend only a campaign by the same author.
  `server/src/campaigns/submissions.ts` (Adventures `origin/main`) rejects one targeting another
  owner's campaign or core content. The only core extension is
  `public/campaigns/getting-started-extension.json`, extending `getting-started`.
- **Order is meaningful.** `mergeExtensions` (`shared/campaign-extension.ts`) applies extensions in
  the order it receives them: it appends added choices to a node's choice list and added
  achievements to the achievement list. Reordering two extensions that touch the same node
  reorders that node's choices.
- **No version shape is validated in the engine.** Versions compare exactly, never as a range.
- **Include pinning.** `compose.ts` checks `include.ref.version` against each module's *authored*
  version, through the `authoredVersions` map.
- **Digest helpers.** The engine's canonical digest comes from `subzerodev-data-json`
  (`canonicalize`, `sha256Hex`). Adventures does not depend on that library.

**Decision: a campaign with applied extensions publishes under a derived version.** Without
extensions it keeps its authored version, unchanged. This decision does not authorize broader
extension targets or any change to attachment semantics.

**The authored version is preserved.** The derived version names one extension composition.
It never rewrites the author's source version, which stays in the stored epoch form and in the
catalog's provenance. Include pins keep resolving against it, because the derived version is
applied after composition, the way packs apply theirs.

**Encoding.**
- No build metadata: `<authored>+ext.<12 hex>`, for example `1.2.0+ext.3f9a0c41b2de`.
- Existing build metadata: the `ext` identifier pair is appended to it, never a second `+`:
  `1.2.0+build.5` becomes `1.2.0+build.5.ext.3f9a0c41b2de`. That is valid SemVer build metadata
  (dot-separated identifiers of `[0-9A-Za-z-]`).
- **The `ext` build-metadata identifier is reserved.** An authored version whose build metadata
  already contains an `ext` identifier is refused at publication. Otherwise an authored version
  could equal another composition's derived one. With the reservation, every derived version
  splits unambiguously into authored version and suffix.

**Derivation.**
- The extensions digest is `sha256Hex(canonicalize(...))` over, for each applied extension *in
  application order*:
  - its id and authored version;
  - the payload `mergeExtensions` reads (added nodes, added choices with their target nodes,
    added achievements);
  - its authored strings.
- Excluded: timestamps, source URLs and row ids, unrelated campaigns, the base campaign's own
  content (its authored version already names that), and every engine-owned message.
- The application order hashed is the order `mergeExtensions` actually receives. The slice makes
  that order deterministic and documents it: a restart over the same inputs must produce the
  same order, and so the same identity.
- **Not circular.** The suffix is computed from extension inputs alone, before the derived
  version is inserted into the campaign. Only then is D1's epoch digest computed, over the
  composed campaign carrying the derived version.
- **One canonicalizer.** Adventures does not reimplement canonicalization. The engine slice
  exports the digest helper next to D1(b)'s exported epoch-digest function, which is a contract
  item. The alternative, a direct Adventures dependency on `subzerodev-data-json`, would need its
  own dependency decision.

**The full digest is retained.**
- `content_epochs` gains an `extensions_digest` column holding the full 64 hex digits, null for
  an unextended epoch. It is metadata, not epoch-digest input.
- The 12 hex digits are a shortened identifier. Before inserting, publication checks
  `(campaign_id, derived version)`. If it is already held with a different full extensions
  digest, the publication is refused with the explicit `derived_version_collision`. For core,
  that refuses the publication; for a submission, it quarantines the submission.
- An identity is never overwritten or reused for different content.

**Exact equality throughout.**
- Archive keys, the `campaign_version` columns, session and save stamps, adoption checks, the
  channel's offers and offline bundles all carry the complete derived version, and compare it
  byte for byte.
- No SemVer precedence, and no normalization that strips build metadata, is used to select,
  order or compare publications. A test pins this, because SemVer precedence ignores build
  metadata by definition.
- What is offered is decided by the active manifest alone.

**Publication stays explicit.**
- Changing an extension, its strings or the application order produces a new derived identity.
- Removing every extension returns the campaign to its authored identity.
- Re-selecting an earlier composition is an explicit publication naming that existing epoch
  (§3.5), never something inferred from version ordering.
- Sessions on a previous composition stay pinned, as with any version change.

**Compared with `packVersion`** (`src/engine/src/campaigns/stable-life-packs.ts`), which this
follows where its rules fit:
- **Same:**
  - a version derived from a canonical digest of what ships, so the version moves on its own when
    content does;
  - a 12-hex shortened suffix;
  - attachments hashed only when present.
- **Different:**
  - the prefix is the authored version, not a fixed `1.0.0`;
  - only the extension inputs are hashed, not the whole campaign;
  - order is preserved, because `mergeExtensions` is order-sensitive. Pack strings are sorted;
  - the full digest is retained and a shortened collision is refused, which `packVersion` does
    not check;
  - the `ext` identifier is reserved.

### D3 — Private-content retention (policy) — **decided 2026-10-17**

Approved with six amendments, incorporated below: the in-memory deletion design (§5.1),
immediate request-time enforcement (§5.2), the external-ledger failure protocol (§5.3),
permanent deletion identities (§5.4), the retention inventory and backup limit (§7), and
composed-epoch dependencies (§5.5). The corrected `403`/`404` premise is accepted for this
slice. The existing session-existence disclosure is registered separately, as
[SubZeroDev.Adventures#86](https://github.com/The-Running-Dev/SubZeroDev.Adventures/issues/86).

Facts checked 2026-10-17 on Adventures `origin/main`:
- **Private content** is a `content_sources` row with a non-null `owner_player_id`, whether its
  `visibility` is `private` or `public`. An ownerless row is an admin source; core is the
  built-in source.
- **Revocation exists only as an admin action.** `POST /api/admin/content/submissions/:id/reject`
  sets `status` rejected and `visibility` private, whatever the row's state. `.../approve`
  reverses it. The owner cannot set `public` (only request it), and has no "unpublish" path.
- **Deletion paths:**
  - the owner, through `DELETE /api/content/:id` (`removeOwnedSubmission`);
  - an admin, through `DELETE /api/admin/content/sources/:id` (`removeContentSource`), on any row
    but the built-in one (`cannot_remove_builtin`);
  - `mergePlayers` (`server/src/principal.ts`), which deletes the merged guest's `players` row.
    It repoints sessions, saves and discussion posts first, but not `content_sources`, so the
    `on delete cascade` on `owner_player_id` silently deletes a guest's submissions.
  - All three are hard `delete`s today. No account-deletion route exists.
- **Content-carrying tables:** `content_sources` (`payload`, and `last_error` and
  `quarantine_reason`, which can quote it); `sessions` (blob, `campaign_id` since migration 005);
  `saves` (blob, `campaign_id`); `offline_grants` (`bundle`, `checkpoint`, which holds the source
  session's raw blob; `owner_id` may be null); `offline_runs` (`inputs`, `blob`);
  `offline_receipts` (`receipt` jsonb); `achievements` (`campaign_id`, `achievement_id`, an
  authored identifier). `discussion_posts` is not keyed by campaign.
- **In memory, Adventures:** per build, a `ServerDemo` (registry, catalog, `offlineBundles` map),
  the content cell's per-source status (with `lastError`), and an engine built with
  `createEngine({ kinds, registry })` over the whole build's registry
  (`server/src/composition.ts`). No `Emitter` is supplied, so engine events are discarded.
- **In memory, engine** (`src/engine/src/core/session/store.ts`):
  - With persistence, only sessions are cached (`sessionCacheLimit`, LRU). A save is read from
    persistence each time, so the `saves` map stays empty.
  - A session a command holds is pinned and never evicted. A persistence read in flight is
    shared by every caller that misses meanwhile.
  - A `concurrent_modification` from persistence restores and evicts the cached record.
  - There is no public operation to drop one session.
  - `listCampaigns` and `createSession`'s no-offer fallback read the construction-time
    registry. `resolveEpoch` (`kernel/engine.ts`) asks the archive on every call and caches
    nothing.
- **The archive contract** (`20-contract.md`, `ResolutionArchive`): "the same key answers the
  same registry for the archive's lifetime". The reference archive never evicts. 10-design
  Content Epochs §6 allows a host archive to drop an epoch once no live session, save or
  retained fixture names it, counting every content entry's `from` and `to` after the last
  migration entry, not only the current version. `createEngine` throws when the archive lacks a
  construction-registry campaign at its registered version.
- **Today's disclosure behaviour is not uniform.** For a session or save id owned by someone
  else, `ownedStore` answers `403 forbidden`; for an id that does not exist, `404
  unknown_session` / `unknown_save`. So a non-owner can already tell a live id from an unknown
  one (Adventures#86). For a campaign: `403 forbidden` when it is registered but inaccessible,
  `404 unknown_campaign` when it is not registered. Submission routes answer `404 not_found` to
  a non-owner.
- **Logs:** Fastify's default logger (`logger: true` outside tests, `server/src/app.ts`) writes
  each request's method, raw URL, host and remote address, and each response's status. No body
  or header is logged. The error handler logs the full error, message and stack, for every
  response it answers `internal_error` (`request.log.error`, `server/src/routes/session.ts`, and
  the discussion and identity routes). Output goes to stdout, and neither compose file sets a
  `logging:` driver, so Docker's default `json-file` keeps it with no rotation.
- **Not present:** tracing, error reporting, queues and scheduled jobs. No `setInterval` exists
  in `server/src`; `maintenance-cli.ts` runs once per deploy. The server writes no files: it
  only reads the committed disk snapshot, which is core content. Replay computes in memory.
  Recovery exports and downloaded offline bundles are device-side.
- **No backup configuration** exists in the repository. The database is the `adventures-db`
  Docker volume, deployed through Portainer.

#### 1. Revocation versus deletion

| | Revocation | Permanent deletion |
|---|---|---|
| What it is | The campaign stops being available to anyone but its owner | The content, and everything derived from it, is removed |
| Who requests it | An admin (`reject`) | The owner, for their own submission; an admin, for any player submission |
| Reversible | Yes, by an admin `approve`. Everything is restored as it was | **No.** No undo and no grace period. Irreversible from the moment the request is recorded (§5.3); no restore from backup brings it back (§5.3, §5.4) |
| Publication | A new publication whose entry records the campaign as private (`reason: refresh`); access filtering (§3.4) does the rest | A new publication without it (`reason: deletion`) |

- **Admin sources** (ownerless rows): an admin delete is a **withdrawal**, never a purge. Their
  epochs are retained and their sessions keep playing. Core is never deleted, as today.
- **`mergePlayers`** stops being a deletion path: it repoints `content_sources.owner_player_id`
  to the surviving player, as it already does for sessions and saves, and the foreign key
  becomes `on delete restrict`. This is a behaviour change: a guest who upgrades now keeps their
  submissions instead of silently losing them.
- **Editing is not deletion.** A changed submission publishes a new epoch; the previous one is
  retained for sessions pinned on it. An owner who wants old content gone deletes it.
- Every path that removes private content runs the one deletion protocol (§5.3). No other
  `delete` of these tables exists.

#### 2. Retained data

| Data | After revocation | After permanent deletion |
|---|---|---|
| Archived epochs of the campaign (every version) | Retained unchanged | Purged |
| Composed epochs (D2) containing a deleted extension, current and historical | Retained unchanged | Purged (§5.5). Base epochs without it are retained |
| Authored strings | Retained (part of each epoch) | Purged with each epoch |
| `content_sources` row (payload, label, review notes, `last_error`, `quarantine_reason`) | Retained, `status` rejected | Purged |
| Sessions and saves that depend on a purged epoch (§5.5), every player's | Retained unchanged | Purged; contentless tombstone kept (§6) |
| Achievement rows for the campaign | Retained | Purged, since `achievement_id` is authored. For an extension, only the ids it added |
| Server-held offline grants, runs and receipts that depend on a purged epoch | Retained | Purged; grant and run tombstones kept |
| Server-generated offline bundles | Not served to non-owners | Dropped |
| Historical publication entries naming a purged epoch | Retained | Replaced by contentless entry markers (§5.5) |
| Deletion ledger entry and deleted source id (§5.4) | — | Retained permanently, contentless |

- Deletion purges the dependent sessions, saves, grants and runs **before** the epochs, which
  satisfies the Content Epochs §6 rule that an epoch is dropped only when nothing names it.
- Badges are retained: they are account-wide and not authored.
- **Not recallable, stated rather than hidden:** an offline bundle, a local run, a recovery
  export, or a cached string table already on a device cannot be recalled. Revocation and
  deletion stop the server serving, syncing and renewing it.

#### 3. Access after revocation

| Caller | Catalog | New session | Their existing sessions and saves | Strings, offline download, offline sync |
|---|---|---|---|---|
| The owner | Listed | Allowed | Full access | Allowed |
| Another player with sessions in it | Absent | `403 forbidden` (today's response for an inaccessible campaign) | **Retained but refused:** resume, load and branch answer `403 campaign_access_revoked` | `403 campaign_access_revoked` |
| Any other caller | Absent | `403 forbidden` | — | `403 forbidden` |
| An admin | Moderation queue, as today | As any player | No session access, as today | As any player |

- **Existing sessions do not keep access**, except the owner's. Access is checked against the
  current state on every request (§5.2), not only at session start.
- `campaign_access_revoked` goes only to the session's own player, who already knows the session
  and campaign. Ownership is checked first, so everyone else gets today's response.
- An `approve` restores access to everyone, and their sessions resume where they stopped.

#### 4. Purge timing

| | Serving | Database | Memory | Backups |
|---|---|---|---|---|
| Epochs, composed epochs, strings, catalog entries | **Refused on every replica from the moment the deletion is recorded** (§5.2, §5.3) | Purged by the purge transaction (§5.3) | Retired on each replica at its next request, or within 60 s if idle (§5.1) | Expire within the supported limit (§7); re-purged on any restore |
| Sessions, saves | As above | Purged, tombstoned | Cached session forgotten at the same point | As above |
| Grants, runs, receipts, achievements, bundles | As above | Purged, grant and run tombstones written | Bundle cache entry dropped at the same point | As above |
| `content_sources` row | — | Purged | Content-cell status recomputed | As above |
| Historical publication entries | — | Replaced by contentless markers | — | As above |
| Tombstones | Answer `410` for 365 days (§6) | Swept after 365 days | — | As above |
| Ledger, entry markers, deleted source ids | — | **Permanent** | Retired-key set, permanent for the process | As above |
| Logs | — | — | — | Bounded by rotation (§7) |

- **The 60-second timer never gates serving.** It only releases memory on a replica that
  receives no request, runs the reconciler (§5.3), and sweeps expired tombstones. A request never
  relies on it.
- **Exceptions, stated:** "removed from memory" means unreachable and released to garbage
  collection, not overwritten; "purged" from Postgres means deleted from the live tables, with
  physical reuse of the space left to Postgres (§7); device-held copies, as in §2.

#### 5. Deletion enforcement

##### 5.1 Where private content lives in memory

One engine and one session store per process, as today and as §3 requires. The store is never
rebuilt, so its per-session locks, pinning and shared reads keep their guarantees.
- **Replay engines** (`createReplayEngine`, one per replay with a pinned `IdSource`) persist
  nothing, but resolve content. They are given the same host archive and core-only registry, so
  a retired key fails there too. Found by D4's entry-point inventory.
- **The construction-time registry holds core content only.** `createEngine` and the store are
  given the built-in source's registry, never a submission or admin source. So
  `listCampaigns`, the no-offer `createSession` fallback, and the engine's own registry copy can
  never reach private content, and nothing private lives in a registry that cannot be dropped.
  Every other epoch reaches the engine only through the host archive.
- **The host archive.** Adventures supplies its own `ResolutionArchive` and `ContentChannel`,
  backed by `content_epochs`. It holds each published per-campaign registry by epoch key, and a
  **retired-key set** holding only the hashes of §5.4.
  - `retire(key)` drops the registry and adds the key's hash. A retired key answers `undefined`
    for the rest of the process, and `publish` refuses it. It never answers another registry, so
    C23 holds.
  - Retirement is allowed only after the purge transaction has committed, which is when the §6
    retention rule is satisfied: nothing that names the epoch remains.
  - **Contract amendment, engine slice:** `ResolutionArchive.resolve`'s purity becomes "the
    same key answers the same registry, or `undefined` once the host has retired it under the
    Content Epochs §6 retention rule; a retired key never answers again". The engine caches no
    resolution, so retirement takes effect on the next call.
- **Everything else derived from an epoch** is rebuilt or dropped when it is retired: the catalog
  and manifest (one reference swap, §3.2), D1.3's alias map and response string tables, the
  offline-bundle cache (keyed by epoch key, replacing the per-build `offlineBundles` map), and
  the content cell's per-source status.
- **Cached sessions.** `SessionStore.forget(sessionId): Promise<void>`, a contract amendment
  for the engine slice:
  - it waits for any command holding the session, and any persistence read in flight for it, to
    settle;
  - then it drops the cached record without writing;
  - a read that started before `forget` and resolves after it is returned to its caller but
    not cached.
  - It never changes `serialize()` output. Saves need no counterpart, because the store caches
    none with persistence.
- **Applying a deletion in memory** is one serialized step per replica, in state order (§5.2):
  forget each purged session id the replica caches, retire each purged key, then rebuild the
  derived structures. It runs when a request finds the replica behind, or on the timer.

##### 5.2 Request-time enforcement and fencing

- **The state counter.** `content_current` gains `state_seq`, incremented in the same
  transaction as every change that can withdraw access: a publication, a revocation or
  approval, a recorded deletion, and a completed purge.
- **Every request that can reach non-core content checks it first**, before any cached data is
  used. That includes the catalog, `createSession`, every session and save route, strings, and
  offline download, sync and renewal.
  - The check reads `content_current`, one row.
  - If `state_seq` equals the replica's applied value, the in-memory deletion, block and access
    state is current, and the request continues.
  - Otherwise the replica first catches up: it reads the deletion and access changes since its
    applied value, applies them in memory (§5.1), and re-hydrates a changed publication (§3.3).
    Only then does the request continue.
  - A `state_seq` *lower* than the replica's applied value means the database was restored under
    a running replica. The replica withholds all private content until the reconciler (§5.3)
    completes.
  - Session and save routes already read the row's owner (`ownedStore`). That read also returns
    `campaign_id` and `campaign_version`, and a miss consults the tombstones (§6).
- **Fail closed.** If the check, the catch-up, or the reconciler it waits on fails, every
  private-content request answers `503 storage_failure`, the existing mapping. Core content is
  never deleted or blocked, so serving it does not depend on the check.
- **A read** that passed the check before a deletion was recorded is ordered before the
  deletion. Every request that checks afterwards is refused. So no request starts serving
  deleted content after the deletion is recorded, on any replica.
- **Fencing writes.** Every write that stores something naming an epoch takes a shared
  transaction-level advisory lock on that epoch's key, and checks inside the same transaction
  that the key is neither blocked nor deleted. That covers session create, command, branch and
  migration writes, saves, grants, runs, receipts and achievements. Recording a deletion takes
  the same locks exclusively, in sorted order (§5.3). So a write either commits before the
  deletion is recorded, and the purge removes what it wrote, or checks after it, and is refused.
  - A refused session write reaches the store as `concurrent_modification`. The store restores
    and evicts its cached record, as it already does, and the host re-checks and answers `410`
    or `403` (§6).
  - A write after the purge fails anyway: the `sessions.revision` compare-and-swap finds no row,
    and the epoch-reference foreign keys (§5.5) refuse a new row naming a purged epoch.
  - No write can therefore recreate a purged row, and no foreign-key failure surfaces as a `500`.
- **Fencing publication.** A publication commits under the publication advisory lock, which
  recording a deletion also takes. At commit, every candidate epoch's sources (through
  `content_epoch_sources`) must be neither blocked nor deleted, and no candidate key hash may
  be in the ledger. Otherwise the publication is refused with `source_deleted` and rebuilt from
  the current sources.
  - In memory, activation applies in `state_seq` order, and `publish` refuses a retired key. A
    late activation cannot republish what a deletion retired.

##### 5.3 The deletion protocol

Three steps, each idempotent, with one irreversibility point.

1. **Record (database, one transaction).** Under the publication lock and the exclusive epoch-key
   locks:
   - compute the affected epochs: every `content_epochs` row whose `content_epoch_sources`
     includes the source (§5.5);
   - insert the `content_deletions` row in state `pending`, with its block on each affected key
     hash;
   - increment `state_seq`, and commit.

   **The commit is the irreversibility point.** From then on, every replica refuses the
   content (§5.2), no route cancels a pending deletion, and every later step only moves forward.
   A failure before the commit leaves nothing changed, and the request answers the error.
2. **Append (external ledger).** Append the contentless entry, keyed by `deletion_id`, so a
   repeated append is a no-op. Record the external `seq` it was given on the database row.
3. **Purge (database, one transaction).** Under the same locks:
   - purge the dependent sessions, saves, grants, runs, receipts and achievement rows, writing
     tombstones;
   - replace the historical publication entries with markers, and purge the epochs;
   - delete the `content_sources` row;
   - commit a `reason: deletion` publication through §3.2's compare-and-swap, if the current
     publication still names an affected epoch;
   - set the row's `purged_at`, null the clear-text keys the purge used, increment `state_seq`,
     and commit.

   Then each replica applies it in memory (§5.1).

- **Order and response.** The purge does not wait for the append, so the live tables are cleared
  even while the external ledger is unreachable. The route answers `204` when all three steps
  are done, and `202` with `deletion_pending` when the deletion is recorded but a later step has
  not finished. The content is refused either way.
- **The reconciler** finishes every incomplete deletion. It runs at boot before any private
  content is served, on the 60-second timer, and after each deletion request. One replica runs
  it at a time, under a try-lock. In order:
  1. pull external entries above the database's applied high-water `seq`, and insert any missing
     one as `pending` (`on conflict do nothing`);
  2. append each row that has no external `seq`;
  3. purge each row that has no `purged_at`;
  4. advance the high-water `seq`.

  Every step is a no-op when already done: a purge of absent rows deletes nothing, and tombstones
  and markers are inserted `on conflict do nothing`.
- **Failure at each boundary:**

  | Fails | State left | Content | Completed by |
  |---|---|---|---|
  | Before the record commits | Nothing changed | Accessible; the deletion was not accepted | The requester retrying |
  | After the record, before the append | `pending`, no external `seq` | Refused | The reconciler appends, then purges |
  | The append (external store down) | `pending` or purged, no external `seq` | Refused | The reconciler appends when the store returns |
  | After the append, before the purge | `pending`, external `seq` set | Refused | The reconciler purges |
  | During the purge | The purge rolled back; `pending` | Refused | The reconciler purges |
  | After the purge commits, before memory | Purged | Refused (§5.2); bytes resident until applied | The replica's next request or timer tick |

- **Backup restoration.**
  - The runbook stops the hosts first. Boot then serves core content only, and withholds every
    private campaign until the reconciler completes. That includes boot with the external store
    unreachable, with a warning.
  - A restored database that predates a deletion gets it back from the external ledger as
    `pending`, so the content is refused before it is served, and purged again.
  - A running replica that sees `state_seq` go backwards withholds private content the same way
    (§5.2).
  - **Stated limit:** a deletion recorded but not yet appended is lost if the database is
    restored to a backup older than its record. Its requester was answered `202`, not `204`.
  - Which external store, and its client library, is an execution-time dependency decision with
    its own decision-log entry.

##### 5.4 Permanent identities

- **The ledger is permanent.** `content_deletions` holds `deletion_id`, `seq`, the external
  `seq`, the deleted `source_id`, the hash of each deleted epoch key
  (`sha256Hex(canonicalize([campaignId, campaignVersion]))`), the state, `deleted_at`,
  `purged_at`, the actor's role, and, for an admin, the admin's player id. It holds no content,
  title or strings, and no clear-text key once purged. The external ledger holds the same fields.
- **A deleted epoch key is never published again.** Publication refuses it permanently with
  `campaign_version_deleted`; the author bumps the version. A deleted `source_id` is never
  reused, and an entry naming it is refused with `source_deleted`.
- **Enforcement never expires.** A late offline sync, a historical publication, a rollback or a
  restored backup naming a deleted key is refused by the ledger, whatever the age.
- **Tombstone expiry is separate.** The 365-day window (§6) is a response policy. It decides
  whether a player is told `410`, never whether deleted content can return.

##### 5.5 Dependencies of composed epochs

- **`content_epoch_sources`** joins each epoch to every source it was composed from: the base
  campaign's source and each applied extension's, written at publication. Deleting a source
  affects every epoch it appears in, including historical compositions no longer published.
- **A base campaign's own epochs are unaffected** by deleting an extension: an epoch composed
  without it does not name its source. They, and the sessions on them, are preserved.
- **Dependency follows the retention rule** (Content Epochs §6), not the current version alone.
  A session or save depends on an epoch when the envelope or any content entry after the last
  migration entry names it as `from` or `to`. A session that adopted away from a deleted
  composition still depends on it for replay, and is purged.
  - Four join tables record this, written from the blob in the same transaction as every write:
    `session_epochs`, `save_epochs`, `grant_epochs` and `run_epochs`. Each cascades from its
    holder, and references `content_epochs` `on delete restrict`.
  - So an epoch cannot be purged while anything still names it, and the purge selects its
    dependents exactly, without parsing blobs.
  - The `campaign_version` column of §3.1 still names the current version for §3.6; the join
    tables name every dependency.
- **Historical publication entries** naming a purged epoch become
  `content_publication_entry_markers`: `publication_id`, the epoch key hash, and `deletion_id`.
  The entry row, with its catalog metadata, is deleted.
  - The publication record keeps its shape: which entries it had, and which a deletion removed.
  - A rollback to it re-selects its remaining entries and reports each marker as withdrawn by
    deletion. It never substitutes another version.
- **Republishing the base.** The deletion's own publication withdraws any base entry that named
  an affected composition. The refresh that follows republishes the base under the composition
  without the extension: a new derived version, or an existing epoch re-selected explicitly
  (D2).

##### 5.6 Account merging and restart

- **`mergePlayers`** repoints `content_sources`, pending deletions' actor, and every session,
  save, grant and run tombstone to the surviving player, in its transaction.
  - Tombstones and `content_sources` reference `players` `on delete restrict`.
  - A merge that races a purge fails its guest delete, and retries the repoint, so no tombstone
    is left naming a removed player.
  - So tombstone ownership follows the surviving account: before the merge, and for a deletion
    the survivor requests afterwards.
- **Restart.** Everything is in the database. Hydration loads only `content_epochs`, where the
  purged rows are gone, and marks the ledger's hashes retired. Boot runs the reconciler before
  serving private content.

#### 6. Tombstones

- **Contents.**
  - Session and save tombstones: the id, `profile_id`, `deletion_id`, `deleted_at`.
  - Grant tombstones: the token's hash and `owner_id`. Run tombstones: `owner_id` and
    `local_run_id`.
  - No campaign id, title, version or content.
  - A grant with no owner gets no tombstone: no one is authorized to learn of it.
- **Retention:** 365 days, as a response policy only (§5.4). The timer sweeps expired ones, and a
  read ignores one past its window whether or not it has been swept. The window covers offline
  devices that sync late.
- **Who gets `410 campaign_deleted`:** only a caller whose principal is the tombstone's
  `profile_id` or `owner_id`, which follows a merge (§5.6).
- **Everyone else gets exactly today's response for that id:** `403 forbidden` while the
  tombstone exists, as the live row gave them, so the deletion discloses nothing new. After
  expiry, `404 unknown_session` / `unknown_save`, as for an id that never existed.
- **Campaign-level requests** (catalog, `createSession`, strings by campaign) for a deleted
  campaign answer `404 unknown_campaign` to everyone, the owner included, as for one never
  registered. There is no campaign tombstone.
- **Not changed here:** today's `403`/`404` split already tells a non-owner that a live session
  id exists. This policy does not widen it. It is registered as
  [SubZeroDev.Adventures#86](https://github.com/The-Running-Dev/SubZeroDev.Adventures/issues/86),
  and a change there carries over to the tombstone responses.

#### 7. Retention outside the tables

| Where | Carries private content? | Behaviour |
|---|---|---|
| Request logs | Identifiers only: session, save and source ids, and campaign ids in raw URLs | **Changed by the slice:** the request serializer logs the matched route pattern, not the raw URL, so request logs carry no ids |
| Error logs (`internal_error`) | Possibly: an unexpected error's message or stack can quote a campaign id, node id or string | Not purged on deletion. Bounded by rotation (below) |
| Postgres logs | No: Postgres logs no bind parameters by default (`log_parameter_max_length_on_error = 0`), and the slice keeps that | Bounded by the same rotation |
| Log rotation | — | **Configuration requirement:** both services in `docker-compose.yml` set `logging: { driver: json-file, options: { max-size: 10m, max-file: "5" } }`. That bounds retention to 50 MB per container, discarded when the container is recreated |
| Tracing, error reporting | None exist | A future reporter must apply the same serializer rules, stated in the deployment docs |
| Engine events | Discarded: no `Emitter` is supplied | A future sink must not record `ActionParams` or strings, as 05 requires |
| Queued jobs | None exist | The reconciler and tombstone sweep (§5.3, §6) hold only ids and hashes |
| Temporary and export storage | None on the server | Recovery exports and offline bundles are device-side (§2) |
| Postgres dead tuples and WAL | Yes, until reclaimed | Deleted rows are unreachable at once. Their space is reclaimed by autovacuum and WAL recycling, not overwritten. Stated as an exception, like memory |
| Backups, including WAL archives for point-in-time recovery | Yes, until they expire | **Supported limit: 30 days.** Below |

- **The backup limit.** A deployment's backups must expire within 30 days. That is the supported
  maximum, and a configuration requirement:
  - `BACKUP_RETENTION_DAYS` is a required variable in `docker-compose.yml`, guarded `:?` like the
    stack's other required variables, and listed in its operator prerequisites.
  - The host refuses to start when it is unset, not an integer, or above 30.
  - The deletion confirmation and the deployment docs state the configured value.
  - The host cannot inspect a provider's backups, so the variable is the operator's attestation.
    Configuring longer backups is unsupported.
- **How deletion is described**, in the route's confirmation and the docs: active copies are
  purged when the deletion is recorded and its purge runs; backup copies expire within
  `BACKUP_RETENTION_DAYS` under this stated exception; a restored backup never serves them,
  because reconciliation purges them again first; error logs may hold identifiers until
  rotated out; copies already on a device cannot be recalled.

#### 8. Verification

Each case runs over real Postgres, with two players, A (owner) and B, and a public campaign
both have sessions, saves and offline grants in:
- **Revocation.**
  - B's catalog loses it; B's `createSession` gets `403 forbidden`.
  - B's resume, load, branch, strings, download and sync get `403 campaign_access_revoked`.
  - A's are unaffected, and every table is unchanged.
  - A third player probing B's session id gets `403 forbidden`.
  - `approve` restores B's session, which continues identically.
- **Deletion, data.**
  - Afterwards, no row of `content_epochs`, publication entries, `sessions`, `saves`, the four
    epoch join tables, `offline_grants`, `offline_runs`, `offline_receipts` or `achievements`
    names the campaign.
  - A query over every jsonb and text column finds no authored string, node id or payload
    fragment of it.
  - Tombstones, markers and the ledger hold only the listed fields, and the ledger no clear-text
    key.
- **Deletion, responses.**
  - B's session and save get `410 campaign_deleted`.
  - A third player gets `403 forbidden` for the same ids before tombstone expiry, and `404` after
    (clock injected).
  - The campaign id answers `404 unknown_campaign` to A and B.
  - Every private-content response carries `no-store`.
- **Immediate enforcement.**
  - On a second replica holding the campaign and B's session in memory, with its timer stopped,
    the first request after the deletion is recorded is refused. No request is served from
    cached data after the record commits.
  - With the `content_current` read failing, every private-content route answers `503
    storage_failure` and core content is still served.
  - With the database restored under a running replica (`state_seq` lower), private content is
    withheld until the reconciler completes.
- **Memory.**
  - On every replica, after it applies the deletion: the archive answers `undefined` for each
    purged key and `publish` refuses it; the alias map, response string tables, catalog and
    bundle cache no longer include it; the store no longer caches B's session (`forget`).
  - The construction-time registry contains only core campaigns.
  - An idle replica applies the deletion within one timer tick.
- **Concurrent operations.** Each runs against a deletion paused, by injection, before the
  record, between the record and the purge, and after the purge:
  - an action, a save and a load on B's session, and a branch;
  - a session creation, a grant creation and an offline sync;
  - an achievement unlock.

  Each either completes and is ordered before the record, with its rows then purged, or is
  refused with `410` or `403`. None is served after the record, none recreates a row after the
  purge, none surfaces a foreign-key failure as `500`, and the store holds no record for B's
  session afterwards.
- **Failure at each boundary** of §5.3's table, injected one at a time: the state left, the
  content refused, and the reconciler finishing to the same end state as an uninterrupted
  deletion. Running the reconciler twice changes nothing.
- **Backup restoration.**
  - Snapshot, delete, restore the snapshot, boot: only core is served until reconciliation;
    reconciliation re-records and purges, and the result equals the post-deletion state.
  - With the external store unreachable at boot, private content stays withheld.
  - A restore to before a recorded but unappended deletion loses it, and its requester was
    answered `202`.
- **Permanence.**
  - Republishing a deleted key is refused with `campaign_version_deleted`, before and after the
    tombstone window (clock injected two years ahead).
  - A late offline sync naming a deleted key is refused after tombstone expiry.
  - A rollback to a publication that named a deleted epoch re-selects only its other entries
    and reports the marker.
- **Composed epochs.**
  - Deleting an extension purges every composition containing it, current and historical, and
    every session and save depending on one, including a session that adopted away from it.
  - Base epochs without the extension, and their sessions, are untouched; the base is
    republished without it.
  - The historical publication keeps a marker for each removed entry.
- **Concurrent publication.** A publication built before the deletion and committed after is
  refused with `source_deleted`, in the database and in memory.
- **Account merging.**
  - A guest's submission survives the merge under the survivor, and its existing tombstones
    follow the merge.
  - The survivor deletes it after the merge: the tombstones name the survivor, the survivor gets
    `410`, and the guest id, no longer a principal, gets nothing.
  - A merge racing a purge leaves no tombstone naming the removed guest.
- **Retention outside the tables.**
  - A request log line carries the route pattern, not an id.
  - The host refuses to start without a valid `BACKUP_RETENTION_DAYS`.
  - The compose validation (`scripts/validate-compose.sh`) fails without the `logging:` options.
- **No other path.** A test fails if any `delete from` targets these tables outside the
  protocol.

#### Tradeoffs of this decision

- **An owner deleting a public campaign removes other players' sessions**, including sessions
  that only passed through a deleted composition. The alternative, keeping them, makes deletion
  incomplete and breaks their replay.
- **The external ledger is new infrastructure and a new dependency.** The host withholds private
  content at boot, or after a detected restore, while it is unreachable. The alternative, a
  runbook step re-applying deletions after a restore, relies on the step being remembered
  during an incident, and loses the ledger along with the database in a disaster.
- **A one-row database read on every private-content request** is the cost of immediate
  enforcement. Without it, a replica serves from memory until its next refresh.
- **Write fencing** adds an advisory lock and a check to every content-naming write, and four
  join tables written from the blob. The alternative, the `campaign_version` column alone, misses
  a session's earlier epochs and cannot fence them.
- **Two engine contract amendments**: `SessionStore.forget`, and retirement in
  `ResolutionArchive`'s purity. Without them, purged bytes stay resident, and the host archive
  would contradict the contract.
- **No grace period.** Accidental deletion is unrecoverable, from backups too.
- **Deleted versions are never reused**, so the author bumps the version.
- **Tombstones link a player to a deletion for a year.** A shorter window gives late-syncing
  devices a generic error instead of `410`.
- **Hashed epoch keys** do not resist guessing a short, low-entropy campaign id. They keep the id
  out of the ledger in clear, nothing more.
- **The backup limit is an attestation**, since the host cannot inspect a provider's backups.
- **A recorded but unappended deletion** does not survive a restore to before it. The window is
  one network round trip, and its requester is told the deletion is pending.
- **`mergePlayers` keeps a guest's submissions**, where today it loses them.

### D4 — Where the catalog comes from — **decided 2026-10-17: (a)**

Adventures serves the current catalog and gates session creation. **D4 needs no engine change.**
The engine amendments approved under D1 and D3 stay in scope (§5).

Facts checked 2026-10-17:
- **Engine** (`src/engine/src/core/session/store.ts`):
  - `listCampaigns(profileId?)` maps the construction-time registry's campaigns to
    `{ campaignId, kindId, titleKey }`, with each title string. Given a profile, it adds
    `progress`. It makes no engine call and consults no channel.
  - `createSession` asks the channel once, scoped by campaign, new session id and profile. With
    no offer, it takes the campaign from the construction-time registry and calls `createGame`
    without a version.
  - It caches the new record only after the persistence write succeeds. A write the adapter
    reports as a conflict surfaces as `concurrent_modification`, with nothing cached.
  - `branchSession` and `loadGame` also write a new record at revision 0.
  - The listing gap is already registered: `90-decisions.md`, *The catalog does not list a
    campaign that first appears in a publication*, and `20-contract.md`'s known gaps.
- **Adventures** (`origin/main`):
  - `GET /api/campaigns` (`server/src/routes/session.ts`) builds its `campaigns` list from the
    host's own catalog (`demo.all`, provenance, access). It calls `listCampaigns()` only for
    `summaries`, which back the browser's `RemoteSessionStore.listCampaigns()`.
  - It passes **no `profileId`**, so no `progress` is ever computed. The profile store persists
    no terminals anyway (`server/src/profile-store.ts`).
  - `ownedStore.createSession` refuses an inaccessible registered campaign with `403`. An
    unregistered one passes through to the store's own `unknown_campaign`.
  - Sessions persist through one upsert (`persistence.ts`, `put`), an insert at revision 0.
  - `POST /api/offline/download/:campaignId` without a `sessionId` issues a grant for a fresh
    run on the device. With one, it checkpoints that session, replaying its log against the
    *current* bundle.
  - Replay (`routes/replay.ts`) builds engines through `createReplayEngine` and persists nothing.
- **D3 changes the stakes.** The construction-time registry is core only (D3 §5.1). So
  `listCampaigns` lists core campaigns only, and the no-offer fallback can start only a core
  campaign. That includes one the current publication has withdrawn.

**Corrected premise.** The proposal first said a few lines of progress logic would be
reimplemented from `kinds[kindId].terminalCount`. That was wrong: Adventures never asks for
progress. This decision makes no progress change. `progress` stays absent, as today.

#### 1. The catalog

- **Built from the current publication manifest**, after the request gate (D3 §5.2) has
  confirmed the replica's state is current. It is never built from the construction-time
  registry, and `listCampaigns` is no longer called by the route.
- **Filtered by the caller's access**, under §3.4's rule and D3 §3. A deleted campaign, or one
  with a pending deletion, is absent for everyone.
- **Each entry** carries:
  - `campaignId`, `kindId` and `titleKey`, from the current entry's epoch;
  - its title string, from that epoch's authored table, through D1.3's response aliases. The
    `strings` table is bounded to the summaries' title keys, as `CampaignCatalog` requires;
  - **availability:** `available: false`, with `campaign_version_unsupported`, when this replica
    holds the current epoch as unsupported (D1.2); and `offline`, read from the epoch-keyed
    bundle cache (D3 §5.1).
- `campaigns` lists every accessible entry. `summaries` lists only the available ones, because
  the browser starts sessions from them.

#### 2. Creating a session

Every path that starts or derives a session goes through one **admission**: the route's gate
decides what the new record may name, and the persistence write enforces it.
- **The gate**, run by the route before calling the store:
  - **A new start** selects the current publication's entry for the campaign, and refuses:
    - a campaign absent from it, withdrawn, deleted, or pending deletion, with `404
      unknown_campaign`;
    - an inaccessible one, with `403 forbidden` (unchanged);
    - an unsupported one, with `409 campaign_version_unsupported`.
  - **A derived record** (branch, load, offline checkpoint) names its source. It is gated by the
    source's existing-session policy, not the catalog (§4 below).
- **The admission context.** The gate records its result in a request-scoped context: Node's
  `AsyncLocalStorage`, built in, so no new dependency. A new start records `{ campaignId,
  campaignVersion }`; a derived record records its source.
  - **The channel** answers `createSession`'s one offer with exactly the admitted version, so the
    store resolves it through the archive. The construction-time fallback is never taken, for
    any campaign.
  - **The persistence adapter** refuses any revision-0 write, and any grant insert, without an
    admission context. A creating path the gate misses therefore fails closed.
- **The write is fenced**, reusing D3 §5.2. In the revision-0 write's transaction, the adapter:
  - takes the shared advisory lock on the record's epoch key, and checks it is neither blocked
    nor deleted;
  - reads `content_current` `for share`, so a publication cannot commit between the check and
    the insert;
  - for a new start, checks that the record's `campaign_version` is still the current entry,
    and the profile may still reach it;
  - for a derived record, checks that its epochs are among its source's (D3 §5.5), or are the
    current, accessible entry a load adopted to;
  - writes the record's epoch rows (D3 §5.5).
- **A refused write** reaches the store as `concurrent_modification`, and nothing is cached. The
  route re-gates once:
  - if the campaign is no longer startable, it answers as the gate would;
  - if a newer version is current, it retries once on it;
  - a second conflict answers `409 concurrent_modification`.

  So a creation either commits before a publication, revocation or deletion, and is from then on
  an existing session under those policies, or it is refused. None starts on content the current
  state no longer admits.

#### 3. Every entry point that creates a session

| Entry point | Admission | Version |
|---|---|---|
| `POST /api/sessions` | New start | The current entry's |
| `POST /api/offline/download/:campaignId`, no `sessionId` | New start, for the grant | The current entry's. The bundle is built from that epoch, and the grant insert is fenced the same way |
| `POST /api/offline/download/:campaignId`, with a `sessionId` | Derived from that session | The session's recorded epoch. The bundle is built from that epoch, **not the current one**: a change from today, where an updated campaign would refuse every checkpoint |
| `POST /api/sessions/:id/branch` | Derived from the session | The epoch the source held at the branch point, which may be earlier than its current one |
| `POST /api/saves/:saveId/load` | Derived from the save | The save's epoch, or the current entry if the load adopts (§3.4) |
| `POST /api/offline/sync` | Derived from the grant | The grant's recorded epoch. It writes runs, not sessions, under D3's fencing |
| Replay and replay verification | None: nothing is persisted | The session's own epochs, through the host archive. Replay engines get the same host archive and core-only registry as the store (D3 §5.1) |

Paths checked on Adventures `origin/main`.

#### 4. Existing sessions

- A catalog change never rewrites a stored session or save. A new publication changes what new
  starts select and what the channel offers at adoption points (§3.4). Nothing else.
- Existing sessions stay bound to their recorded epochs, subject to the decided policies:
  - adoption at the four adoption points (§3.4);
  - access (D3 §3): the owner keeps access after a revocation, and others are refused;
  - unsupported content (D1.2): `409 campaign_version_unsupported`;
  - deletion (D3): `410` for the player.
- A withdrawn campaign's existing sessions resume, branch, load and checkpoint on their recorded
  epochs. Only new starts are refused.

#### Tradeoffs of this decision

- **The host owns the catalog's shape**, which the route already does for its `campaigns` half.
  A future `progress` would need the host to compute it.
- **The admission context is an implicit channel** between the route, the content channel and
  the persistence adapter. The alternative, passing a version through `createSession`, is an
  engine contract change, which D4 excludes. The fail-closed adapter check is what keeps an
  implicit channel safe.
- **A creation racing a publication can be refused and retried** once, and rarely answers
  `409 concurrent_modification`.
- **Checkpoint downloads change behaviour**: they now build from the session's own epoch.
- **Reversing it** is deleting the host gate and admission code once the registered engine
  follow-up (listing and creating through the channel with a scope) lands. Nothing stored
  depends on it.

## 3. Design

### 3.1 Schema (one new migration)

- **`content_epochs`** — `(campaign_id, campaign_version)` primary key, `digest`, `epoch`,
  `first_publication_id`, `published_kind_id`, `published_kind_version`,
  `published_engine_version`, `extensions_digest`, `created_at`.
  - The three `published_*` columns are metadata for D1.2's diagnostics, not digest input.
  - `extensions_digest` (D2) holds the full extensions digest, null for an unextended epoch. It is
    metadata, checked at publication against a shortened-suffix collision.
  - `epoch` is a `jsonb` holding D1's authored epoch form, the exact input the engine's digest
    function hashes:
    - the composed campaign data, after extension merge and composition, without `migrateState`;
    - `includes` and the applied attachments;
    - the authored string table.
  - It holds no core or kind messages.
  - Immutable. Insert only, never updated.
  - Deletion happens only under D3's permanent-deletion path.
- **`content_publications`** — `publication_id`, `seq` (unique, monotonic), `parent_publication_id`,
  `reason` (`refresh` / `rollback` / `withdrawal` / `deletion`), `created_at`, `created_by`.
- **`content_publication_entries`** — `(publication_id, campaign_id)` primary key,
  `campaign_version` referencing `content_epochs`, plus the catalog metadata and provenance
  snapshot the HTTP catalog needs.
  - A campaign absent from a publication is withdrawn from it.
- **`content_current`** — a single row holding `publication_id`. This is the only thing that says
  what is current. "Latest" is never inferred from row order or `seq`.
- **`sessions` and `saves`** gain a `campaign_version` column, backfilled from each blob's
  envelope.
  - It is needed to say which epochs are referenced, and to classify `campaign_version_unavailable`
    without parsing failures.
  - It is checked against the blob on every write.
- **`content_current`** also gains `state_seq` (D3 §5.2) and `applied_external_seq`, the
  external ledger's high-water mark (D3 §5.3).
- **`content_epoch_sources`** — `(campaign_id, campaign_version, source_id)`, referencing
  `content_epochs` `on delete cascade`: every source an epoch was composed from (D3 §5.5).
- **`content_deletions`** — the permanent ledger (D3 §5.4): `deletion_id` primary key, `seq`
  (unique, monotonic), `external_seq` (null until appended), `source_id`, `state` (`pending` /
  `purged`), `deleted_at`, `purged_at`, `actor_role`, and `actor_player_id`, referencing `players`
  `on delete restrict`.
  - `pending_keys` holds the clear-text epoch keys the purge needs, and is nulled at purge.
  - **`content_deletion_keys`** — `(deletion_id, epoch_key_hash)`, unique on the hash: the block
    set while pending, and the permanent refusal set afterwards.
- **Dependency tables** (D3 §5.5): `session_epochs`, `save_epochs`, `grant_epochs` and
  `run_epochs`, each the holder's id plus `(campaign_id, campaign_version)`.
  - Each cascades from its holder and references `content_epochs` `on delete restrict`.
  - So every epoch a holder can name must be in `content_epochs`: the first-boot disk snapshot
    is committed as the first publication before any session write.
- **`content_publication_entry_markers`** — `(publication_id, epoch_key_hash)` primary key, plus
  `deletion_id`. It replaces a historical entry naming a purged epoch.
- **Tombstones** (D3 §6): `session_tombstones` and `save_tombstones` (the id, `profile_id`,
  `deletion_id`, `deleted_at`); `grant_tombstones` (token hash, `owner_id`, `deletion_id`,
  `deleted_at`); `run_tombstones` (`owner_id`, `local_run_id`, `deletion_id`, `deleted_at`).
  - The player columns reference `players` `on delete restrict`, and `mergePlayers` repoints them
    (D3 §5.6).
- **`content_sources.owner_player_id`** changes from `on delete cascade` to `on delete restrict`
  (D3 §1).

### 3.2 Publication: validate, commit, activate

1. **Build the candidate** from the sources: core all-or-nothing, submissions quarantined per
   campaign as today.
   - Each campaign becomes its own registry (D1a), with its version derived per D2.
   - The whole candidate is validated with `buildValidatedContentRegistry`.
   - Each per-campaign registry is checked against the in-memory archive and `content_epochs` for
     a same-key, different-digest conflict.
   - A core conflict refuses the publication; a submission conflict quarantines that submission.
2. **Commit, in one transaction, under a publication advisory lock:**
   - insert the new epochs (`on conflict do nothing`, digests already checked);
   - insert the publication and its entries;
   - compare-and-swap `content_current` from the publication it was built against.
   - If the swap fails, another publisher won and this refresh is refused. Nothing is half
     written. **The commit is the activation point.**
3. **Activate in memory:**
   - `archive.publish` each new per-campaign registry;
   - build the catalog view from the committed entries;
   - swap one reference holding the manifest and catalog together.
4. **If the process stops between 2 and 3**, the restart hydrates the committed pointer, which is
   correct by construction.
5. **If step 3 fails in a running process** (a defect, since everything was validated), the cell
   reports `activationFailed` and refuses further publications until a restart re-hydrates from
   the database.
6. A refused or failed publication never touches `content_current`, so it cannot become current
   at restart.

### 3.3 Boot hydration

- Load every row of `content_epochs` and recompute its digest from the stored epoch form, with
  the engine's exported function and no recomposition.
  - A mismatch fails the boot loudly. It never serves content whose identity changed.
- Assemble each runtime registry as the authored table plus the *running* engine's core and
  kind messages, with D1.1's rule on a collision. Reattach `migrateState` from code by campaign
  id. Then publish it into the archive, in `first_publication_id` order.
  - An upgraded engine therefore supplies every reason key it now requires, including keys
    added after the epoch was stored.
- An epoch the upgraded kind no longer validates is held as unsupported, not restored into the
  archive, and the boot continues (D1.2).
- Load the current publication's entries for the catalog and channel.
- The boot no longer depends on content sources being reachable. Fetching sources becomes the
  refresh's job, which retires the crash-loop class `bootstrapFallback` exists for.
- The disk snapshot remains the first-boot path only, when `content_current` is empty.

### 3.4 Channel and access

- A scoped `ContentChannel` answers `scope.campaignId`'s own entry in the current manifest.
  - That is its version, but only if the scope's profile may reach the campaign under
    `accessibleCampaignIds`. Otherwise there is no offer.
  - Every published campaign gets its own offer. `archive.latest()`, which names one registry,
    is never consulted.
- Adoption then follows the engine:
  - the session adopts at the four adoption points;
  - a refusal leaves it pinned on its epoch;
  - a session on a withdrawn campaign is offered nothing, and stays on its epoch.
- The reference archive's own `current` is not used, because its global latest policy ignores
  access.
- Access is checked again on every session read, save, load, strings and offline-bundle request,
  against the current state (D3 §5.2).

### 3.5 Rollback

Rollback to an older publication is a **new** publication whose entries name older epochs, with
`reason: rollback`, through the same path as §3.2.
- Sessions already on a newer epoch stay pinned there. It is retained, and the engine refuses an
  adoption that has no migration path backwards.
- New sessions start on the rolled-back version.

**Reverting this change** is not dropping the tables. Once sessions and saves name retained
epochs, the tables are history they depend on. A revert of the code must keep the migration,
hydrate the archive, or migrate those sessions forward first.

### 3.6 `campaign_version_unavailable`

Before resuming, loading, or branching, the host reads the session or save's `campaign_version`
column and checks the archive.
- **When the epoch is held as unsupported** (D1.2), it returns `409` with
  `campaign_version_unsupported` and does not take the miss path.
- **When the key is deleted**, the tombstone answers first (D3 §6), and the miss path never
  runs: a retired key is never re-hydrated.
- **On a miss**, it first re-hydrates from `content_epochs`, because another replica may have
  published. Only if the database also lacks the epoch does it return `409` with
  `campaign_version_unavailable`.
- **When the epoch is present**, every other failure keeps its current classification: corruption,
  `migration_failed`, `invalid_state`, and a persistence conflict.

### 3.7 Multiple replicas

- The per-process store gives local ordering. Across replicas, the existing compare-and-swap on
  `sessions.revision` stays the session guard.
- The `content_current` compare-and-swap with the advisory lock is the publication guard.
- A replica learns of a new publication on its next refresh, or on §3.6's miss path. No replica
  ever serves a version its archive cannot resolve.
- Deletion, revocation and access state is not left to the refresh: every request checks
  `state_seq` first, and catches up before using cached data (D3 §5.2).

## 4. Tests

The review's cycle:
1. Create a session and save.
2. Refresh content.
3. Continue, branch and load.
4. Restart the host.
5. Repeat.

Each case runs over real Postgres:

- **A compatible change.** The session adopts at the next adoption point.
- **An incompatible change.** The kind refuses the adoption; the session stays pinned and stays
  playable.
- **A new campaign id.** The catalog lists it and sessions start in it, without replacing the
  store.
- **An updated title, and a withdrawal.** The catalog reflects both; a session in the withdrawn
  campaign keeps playing its epoch.
- **An unavailable old version.** Returns `409 campaign_version_unavailable`.
- **A corrupt blob and a migration failure.** Neither returns that code.
- **A failed publication.** The old content keeps serving and `content_current` is unchanged,
  including after a restart.
- **A restart during publication**, injected after commit and before activation. It comes back on
  the committed publication. Injected before commit, it comes back on the old one.
- **Concurrent refresh and action requests.** Each action sees the old or the new manifest whole,
  never a mix; two concurrent publishers produce one winner and one clean refusal.
- **A rollback to an older publication.** New sessions start on the old version; sessions on the
  newer epoch stay pinned there.
- **Cross-user private-content isolation.** Player B never receives player A's private campaign
  through the catalog, an adoption offer, historical strings, a save, a load, or an offline bundle.
  This covers before revocation, after revocation, and after permanent deletion (`410`). D3 §8
  lists the retention cases in full.
- **Hydration identity.** Tampering with a stored epoch's input fails the boot.
- **D1.2, unsupported epochs.** Under a fixture kind that rejects one stored epoch:
  - a restart with supported and unsupported epochs together boots, and every supported campaign
    and session keeps working, including one pinned on an older supported epoch of the affected
    campaign;
  - resume, load, branch, strings and offline-bundle requests on the unsupported epoch get `409`
    `campaign_version_unsupported`, distinct from a missing epoch's
    `campaign_version_unavailable`;
  - the channel makes no offer for it, and an adoption into it is refused;
  - the catalog reports the affected campaign unavailable, and `createSession` is refused;
  - `content_epochs`, the publication tables, `sessions` and `saves` are byte-identical before
    and after the boot;
  - the `epoch_unsupported` warning names the kinds, versions and diagnostics, and sets
    `potentialRegression` when the kind version is unchanged;
  - a restart under a compatible kind restores the epoch under its stored digest, and its
    sessions resume.
- **D1, engine side.** Positive and negative cases, with counts:
  - Editing B's strings, or adding B, does not conflict with an unchanged A.
  - Changing only core or kind message text does not conflict with an existing epoch.
  - Changing A's authored content, or A's strings, under its existing version still conflicts.
    So does a change in a module A composes.
  - An authored key that equals an engine key, text included, survives in the authored table
    and in the digest.
  - Every campaign published as its own registry is resolvable, and the reference archive's
    `current` offers each one its own version.
- **D1.1 and D1.3.** Each of these is a test:
  - A new publication with an engine-reserved key is refused, for identical text and for
    different text.
  - Under an upgraded-engine fixture that claims an existing authored key:
    - the historical authored string is unchanged;
    - an engine error using that key still displays the engine's message;
    - both meanings stay correct through a restart and through `getStrings`, the session
      responses and an offline bundle;
    - the epoch digest is unchanged;
    - the `historical_string_collision` warning names the epoch and key.
  - `publish` cannot reach the historical exception. `restore` refuses a collision with a key
    that was reserved when the epoch claims to have been published.
  - `publish` refuses an authored key containing `~`; an engine test refuses a catalog key
    containing `~`.
- **D1.3, forced-alias matrix.** Under a context that aliases every engine-owned reference, run
  each of the three kinds through accepted and rejected actions, previews, an authored
  requirement-failure message, an epoch-crossing response and an offline bundle. In every case:
  - every engine-owned reference is aliased and resolves to the engine's text;
  - every authored reference is unchanged, including one whose literal key equals an engine key;
  - references and table entries agree across projections, available actions, errors, outcome
    messages, `getStrings`, catalog strings and the bundle.
- **D1.3, legacy namespace.** A restored epoch authoring `~k` forces `alias(k) = ~1~k`; the
  authored `~k` entry is unchanged and still resolves.
- **D1.3, execution untouched.** Existing serialized golden and replay fixtures pass unchanged,
  under the forced-alias context as well as without it. The `KindContext` given to `resolve` and
  `migrateState` has no alias member, checked at type level.
- **D2, derived versions.**
  - The same inputs give the same derived version across a restart.
  - Changing an extension's content, or only its strings, changes the identity.
  - Reordering two extensions that touch the same node changes the identity.
  - Removing every extension returns the authored version.
  - `1.2.0+build.5` becomes `1.2.0+build.5.ext.<12 hex>`, and an authored version already
    carrying an `ext` identifier is refused.
  - Changing only engine message text leaves the identity unchanged.
  - A forced shortened-hash collision (a stubbed digest) is refused with
    `derived_version_collision`, and the held epoch is untouched.
  - The complete derived version survives save, load and adoption exactly. Two versions differing
    only in build metadata are distinct everywhere, including in the channel's offer.
- **D1, Adventures side.**
  - Every published campaign stays discoverable in the catalog and gets its own current-version
    offer.
  - A restart under an upgraded engine fixture (changed and added reason messages) reconstructs
    the same authored digests, and the runtime registry carries the new engine's required keys.
- **D4, catalog and creation.** Over real Postgres:
  - **New campaigns.** A submission, and a core campaign added by a refresh after boot, neither
    in the construction-time registry: each appears in the catalog with its title string, and
    starts on its published version.
  - **Updated publications.** After an update, new sessions start on the new version. Existing
    sessions keep their recorded epochs until an adoption point, and a stored blob is
    byte-identical before and after the publication when no action ran.
  - **Direct refusals.** `POST /api/sessions` and a fresh offline download are each refused for
    a withdrawn (`404 unknown_campaign`), unauthorized (`403 forbidden`), unsupported (`409
    campaign_version_unsupported`), deleted and pending-deletion (`404 unknown_campaign`)
    campaign. That includes a withdrawn core campaign still in the construction-time registry.
    No session row, grant or cached record is left.
  - **Existing sessions.** On a withdrawn campaign, resume, branch, load and checkpoint download
    continue on recorded epochs. A branch before an adoption entry resolves the earlier epoch. A
    checkpoint bundle is built from the session's epoch, and succeeds after the campaign is
    updated.
  - **Availability.** An unsupported current epoch is listed with `available: false` and absent
    from `summaries`; `offline` follows the bundle cache.
  - **Concurrency.** A creation paused after its gate and before its write, against a
    publication (update, withdrawal), a revocation and a deletion record committing meanwhile:
    it is refused and re-gated, starts on the new version after an update, and never commits on
    content the new state does not admit. One committing first is then an existing session
    under the matching policy.
  - **Every entry point.** A revision-0 session write, and a grant insert, without an admission
    context is refused. A test enumerates the registered routes and fails if one reaching
    `createSession`, `branchSession`, `loadGame` or a grant insert is missing from D4 §3's table.

## 5. Order of work

1. **Engine slice, in this repository:** D1(b), landed before any Adventures schema work.
   - **Contract.** Amend 16 §3.4 (the identity rule and the engine-wording non-promise) and
     `20-contract.md`:
     - §4: the `ContentRegistry` authored-table field, the exported epoch-digest function and
       its authored epoch form, and the reference `current` made per campaign;
     - the exported canonical digest helper D2's extensions digest uses;
     - the generalised `protected_string_key`, `restore`, the recorded reserved-key set and
       `historical_string_collision`, per D1.1;
     - `restore`'s three outcomes (restored, unsupported with its diagnostics, integrity
       failure), the `epoch_unsupported` warning, and `campaign_version_unsupported`, per D1.2;
     - D1.3's response aliases: the reserved `~` namespace and its authored-key restriction, the
       alias rule and its fallback, the ownership table, the projection-only mapping function
       on the Kind seam, and every affected response surface (projections, available actions,
       previews, errors, outcome messages, `getStrings`, catalog strings, offline bundles, and
       the client contract's non-persistence rule). Settled in the contract before any code.
     - D3 §5.1: `SessionStore.forget(sessionId)`, and the `ResolutionArchive` purity clause
       amended to allow a host to retire a key permanently under the Content Epochs §6 rule.
   - **Before landing.** A collision sweep over the engine fixtures and the Adventures content,
     each collision corrected explicitly.
   - **Code.**
     - `registry/types.ts` and `registry/build.ts`: string provenance.
     - `validation/tiered.ts`: thread `validationStrings` through, and set the pack-registry
       authored table.
     - `registry/archive.ts`: digest over the authored form; runtime assembly with the running
       engine's messages; the per-campaign `current`.
     - `session/store.ts`: `forget`, waiting on the session lock and any read in flight.
   - **Records.** Tests; a decision-log entry; regenerated docs; the attachment follow-up
     registered in the open register, together with origin-tagged references (D1.3's deferred
     redesign); and D4's resolution added to the existing `listCampaigns` register entry.
2. **Adventures:** the approved `initialization` change. Bump the submodule to the merge commit of
   step 1, which also contains #602.
3. **Adventures, this plan:**
   - schema;
   - publication path;
   - hydration;
   - channel and access;
   - catalog and the creation admission on every entry point (D4);
   - the `409` and `410` mapping;
   - the request gate and write fencing, the deletion protocol and reconciler, and the external
     ledger, whose store and client library get their own decision-log entry (D3 §5);
   - `mergePlayers` repointing, the request-log serializer, log rotation, and
     `BACKUP_RETENTION_DAYS` (D3 §5.6, §7);
   - tests.

   Branched from a clean worktree off `origin/main`. The local checkout has unrelated uncommitted
   work on `feature/j9-verified-manifest-resolution`.
