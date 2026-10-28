---
sidebar_label: Content Epochs
---

# Content Epochs — Live Content Without a Reload

<!-- Generated from design/10-design.md by build/ConvertTo-HumanDocumentation.ps1. Do not edit directly. -->

**Document status:** Revision 2 — red-team findings F1–F3 resolved (`90-decisions.md`, 2026-10-08), post-MVP

**Reading order:** after [`11-content-packs.md`](11-content-packs.md), whose `ResolutionId`
this treats as an epoch, [`04-core.md`](04-core.md) §2, §4 and §7, which it amends, and
[`07-replay.md`](07-replay.md) §2, whose fixture it extends.

> **Scope of this document**
>
> How new content reaches a host that is already running — a side quest published into a live
> campaign — without rebuilding the engine, and what that means for each session already
> playing it: when it may move to the new content, who decides whether it can, how the move is
> recorded so replay stays exact, and what happens to a session that cannot move.
>
> It does **not** specify how a host stores, distributes or authorizes publications. It owns
> the in-process seam a host publishes through and the rules every session obeys at it.

---

## 1. The Gap This Closes

The registry is frozen at construction (04 §10.1) and every port is supplied once and never
swapped (06 §4). New content therefore means a new `Engine`, a new `SessionStore`, and a
reload. 11 §8 deferred lazy loading for the same reason: a registry that changes under a
running engine is a registry nothing has validated.

The envelope already had the identity it needed. Since 11 §6, `campaignVersion` is the
resolution digest, and since W120 an attachment is part of that digest — so injecting a side
quest changes the version of every live session on that campaign. What was missing is the rule
for what a running session does when that happens. `deserialize` did not compare the version
at all, which was recorded as a known gap until this design (`90-decisions.md`, *Found by the
2026-10-03 repository review*); rejecting the mismatch would have ended exactly the sessions
injection exists for.

Three directions were settled before this design began, and everything below follows from
them:

- **Replay stays exact.** Moving a session to new content is a logged entry, not a migration,
  so it does not cost `replayCompatible`.
- **A session that cannot move stays pinned** to the content it is playing, which therefore
  has to remain resolvable.
- **The kind judges whether a move is safe.** The core cannot read `kindState` (04 §2), so it
  cannot know whether a removed node is one the player is standing on.

---

## 2. Terms

| Term | Meaning |
|---|---|
| **Epoch** | One resolution of one campaign, named by `(campaignId, campaignVersion)`. Under packs the version is a `ResolutionId` (11 §6); without packs it is the campaign's authored version. |
| **Archive** | Every epoch a host can still run. The engine resolves a state's content through it. |
| **Channel** | The host's answer to "which epoch should this session be on?" |
| **Adoption** | Moving one session from its epoch to another, recorded at one log position. |
| **Pinned** | A session that stays on its epoch, because adoption was refused or never offered. |
| **Adoption point** | One of the four places the session store asks the channel and may adopt (§5.3). |
| **Epoch entry** | A log entry that changes `campaignVersion`: a content entry (an adoption) or a migration entry (a migrated load over a log that already carries an epoch entry, §3.5). |

---

## 3. Data Model

### 3.1 The log carries epoch entries

The envelope gains no field. The element type of `actionLog` widens from `LoggedAction` to a
union. One new member records an adoption; the other records a migrated load (§3.5):

```typescript
type LoggedEntry = LoggedAction | LoggedContent | LoggedMigration;

interface LoggedContent {
  seq: number;          // consumes a seq, exactly like an action
  system: "content";
  from: string;         // the campaignVersion before adoption
  to: string;           // the campaignVersion after; equals GameState.campaignVersion until the next epoch entry
}

interface LoggedMigration {
  seq: number;          // consumes a seq, exactly like an action
  system: "migration";
  from: string;         // the campaignVersion the save was made under
  to: string;           // the campaignVersion the migration restamped
}
```

`GameState.campaignVersion` remains the one place a state's current epoch lives. An epoch
entry records the transition, not the state, so the two never disagree: the last epoch entry's
`to` *is* `campaignVersion`, and an engine check enforces it on `deserialize`. **Once a log
carries an epoch entry, every change of `campaignVersion` leaves one** — an adoption always
appends a content entry, and a migrated load over such a log appends a migration entry (§3.5).
A log with none has never adopted; if it was migrated, `replayCompatible: false` on its record
says so, and nothing replays it.

**The replay input becomes `{ seed, starting version, actionLog }`, and the starting version
is derived, not stored.** It is the first epoch entry's `from`, or `campaignVersion` when the
log has none. A stored `startingCampaignVersion` field would have duplicated what the log
already says — the sixth entry in the envelope-duplication ledger, avoided rather than
recorded.

### 3.2 Sequence numbers and randomness

A content entry takes the seq it would have had as an action, and the next action takes the
one after. Randomness is unaffected in kind: `submitAction` derives its stream from
`action:${seq}` with `seq` the log length (04 §8), so an action after an adoption draws a
stream no other action in that game draws. **Adoption itself draws nothing** — there is no
`content` stream — because nothing about content selection may be random; if it were, the
recorded `to` would be the only thing replay could trust and the kind's judgement would be
unreproducible.

### 3.3 Format version

`GameState.formatVersion` moves from `1` to `2` **only on a state whose log carries an epoch
entry.** `adoptContent` writes `2` when it appends a content entry; a migrated load appends a
migration entry only to a state that is already `2`, and never changes the stamp. A game that
never adopts keeps `1` — through a migrated load too — and serializes byte-identically to today. The reader accepts both, and holds the stamp to the log both ways: a version-`2`
state whose log carries no epoch entry is refused `invalid_state`, so an unepoched game has one
encoding, not two (`90-decisions.md`, 2026-10-09, S130). An engine predating this design
rejects a version-`2` state with `invalid_state`, which is the correct answer — it would read
an epoch entry as an action with no `actionId` — and still reads every state that carries none,
which contains nothing it cannot understand.

> **Why not bump unconditionally.** Every golden file and every stored session would change
> for a feature none of them use, and an older engine would refuse states it reads perfectly
> well. A version stamp names the shape the bytes actually use; a state with no content entry
> uses the old one.

### 3.4 The archive

An archive maps `(campaignId, campaignVersion)` to the `ContentRegistry` that epoch was
published in. It is **content-addressed**: one key names one content, permanently. The
in-memory archive (§4.3) refuses a second publication of the same key with different content,
and accepts an identical one as a no-op.

What "the same content" means is fixed so two archives agree on it, and it is **what the
campaign authored, not the merged table it was played with** (04 C28). An epoch's identity is
the canonical digest (`epochDigest`, 04 §4) of its `EpochForm`, three parts:

- **The composed campaign** — `id`, `kindId`, `version`, `titleKey`, `content`, and `includes`
  when present and non-empty, exactly as 11 §6 has it.
- **Its composition inputs** — the `includes` above, and the attachments applied to it in
  application order (04 §10.4).
- **Its authored strings** — its own and those of every module it composes, transitively, from
  the registry's `provenance` (04 §10.1). For a pack registry, the fold minus engine messages.

Strings are part of an epoch because a session renders through the string table it resolved;
a publication that changes an authored string without changing a version is the silent drift
content-addressing exists to refuse. **Engine messages are not part of it.** The core catalog
and each kind's `reasonMessages` are the running engine's, so an engine upgrade that rewords
an error does not turn every held epoch into a conflict; engine keys resolve from the running
catalog (§5.7), and historical engine wording is not promised. **Ownership is by provenance,
never by prefix**: an authored key that equals an engine key stays authored, and §5.7 says how
both reach a response.

**What is hashed is exactly what is stored.** A durable archive persists the `EpochForm`, the
`EpochPublication` beside it (unhashed: the publishing kind and the reserved keys at that
time), and the digest. Restoring recomputes the digest from the stored form without
recomposing anything, so a module or attachment that has since changed cannot change an epoch
that was published before it did (§5.1a).

**A key resolves to the registry it was first published in**, never repointed to a later
publication's identical copy: what `resolve` answers for a key never changes
(`90-decisions.md`, 2026-10-09, S131).

### 3.5 A migrated load leaves a migration entry

04 §10.2's migration path restamps `campaignVersion` to the loading campaign's own. Before this
revision it left the log untouched, and on a log that already carried a content entry that broke
C26: a save at `e2` whose last content entry ends at `e2`, migrated onto `e3`, would be a state
whose `campaignVersion` and last `to` disagree — refused `invalid_state` by the next `deserialize`
of the session it had just loaded into (red-team F1).

So **a migration that changes `campaignVersion` on a log that already carries an epoch entry
appends a `LoggedMigration { from, to }`**, in the same step that restamps it and sets
`replayCompatible: false`. `from` is the state's `campaignVersion` — which the save's wrapper
must match, or the load is `invalid_state` — and `to` the registry campaign's; the entry is
appended only after the kind accepts the migrated state, so a refused migration appends nothing
(`90-decisions.md`, 2026-10-09, S134). The state is already `formatVersion: 2`, and stays so. A migration
over a log with no epoch entry appends nothing: C26 holds there without one, and the state keeps
`formatVersion: 1`, so a host that migrates but never adopts writes exactly the saves it writes
today, and an engine predating epochs still reads them. Such a log's derived starting version
names the epoch it migrated onto rather than the one its actions were taken on — but the log is
never replayed (`replayCompatible: false`), and the strings and retention rules read that epoch
correctly. A migration that changes only `kindVersion` restamps no version and appends nothing.

**A migration entry is not replayable, and the log says so.** A migration is not a step replay
can perform — the epoch it left is, by construction, one this host could not resolve — so:

- **The entry implies the record.** A state whose log carries a migration entry passed through
  a migrated load, so its save and session record are `replayCompatible: false`. The converse
  does not hold — a migrated log with no epoch entry carries no migration entry — so the
  record stays the authority, and the entry makes the refusal readable from the state where one
  exists.
- **`branchSession` refuses** such a session, as it already refuses `replayCompatible: false`.
- **Capture has no submission for one** (08 §2), so no fixture carries one.
- **Only the epochs after the last migration entry are live.** Retention (§6) and the
  session's string table (§5.7) count the log from there: what came before is history the
  session can no longer replay, and nothing resolves through it.

A migration remains idempotent against its own output (04 §10.2): the second load finds no
version mismatch, runs no migration, and appends no second entry.

---

## 4. Module Boundaries

| Who | Owns | Never |
|---|---|---|
| **Pure engine** | Resolving a state's content by `(state.campaignId, state.campaignVersion)`; `adoptContent`; the content entry | Deciding *when* to adopt or *to what*; publishing |
| **Kind** | `adoptContent?` — whether this state can move from one campaign to another, and what it becomes | Reading the archive, the channel, or the log |
| **Campaign** | `migrateState?` — re-addressing ids the new content renamed, run before the kind judges | Deciding adoptability |
| **Session store** | The four adoption points, consulting the channel, persisting the adopted state in the same write; aliasing engine keys in errors, warnings and messages (§5.7); `forget` on the layer (06 §5.2) | Validating content; choosing a version itself |
| **Host** | Publishing; restoring stored epochs at boot (§5.1a); the channel's policy (one version for everyone, per-profile overlays, staged rollout); durable storage, retention and retirement | Writing a content entry by hand; recomposing a stored epoch |

### 4.1 The engine resolves by state

Every operation that takes a state — `scene`, `view`, `availableActions`, `submitAction`,
`previewAction`, `deserialize`, `migrate`, `adoptContent` — resolves its campaign and string
table through the archive by the state's own `(campaignId, campaignVersion)`, and hands that
registry to the kind as `KindContext.registry` (04 §3.1). The engine's construction-time
`registry` stops being *the* content and becomes *the default epoch*: the one `createGame`
starts on when no version is asked for.

`createGame` takes an optional version. Absent, it starts on the registry's; present, on that
epoch, or fails `unknown_campaign`. **`NewGameConfig` does not change.** 07 §2 records why a
fixture's config carries no version — config is what a player chose, and a version is not
something a player chooses — and that reasoning still holds. The version is the caller's
second argument: the session store passes the channel's answer, the replay runner passes the
fixture's starting version.

The archive is an engine port because content resolution happens inside the pure engine and
the default works: with no archive, the engine builds one holding only its `registry`, and
every behaviour is today's. An archive that does not contain every campaign of `registry` at
its registered version is a construction error, the same treatment a missing kind gets (04 §4)
— the default epoch has to be resolvable.

**The engine reads its registry's campaign map once, at construction.** The default archive and
the version `createGame` starts on both come from that copy, so a host mutating the registry
afterwards changes neither which content a key names nor where a new game starts. **An epoch
resolves only when the archive's answer holds the campaign at that exact version.** A registry
that holds it at another version counts as unresolved — `unknown_campaign` from `createGame`,
`deserialize` and `migrate`, and a construction error for the default epoch — because trusting
it would play a state against content it does not name (`90-decisions.md`, 2026-10-09, S129).

### 4.2 The channel is a session-layer port

The channel answers one question per adoption point: given this campaign, this session and
this profile, which version should it be on? It is a session-layer port, not an engine port,
because *when* is a session-layer concern — the engine is stateless and has no notion of a
session to be offered anything.

A host serving one version to everyone returns its latest publication. A host running
per-profile overlays (a private side quest, an experiment variant) returns a different version
per scope. Omitting the channel is today's behaviour exactly: no session is ever offered a
version, so none adopts.

> **Experiments compose without a new mechanism.** 06 §4 has a host running more than one
> assignment combination build one session layer per `{Engine, ContentRegistry, experiments}`
> tuple. Under epochs that remains correct and is no longer the only option: a channel that
> answers per profile can route each variant to its own resolution inside one layer, and the
> identity story is unchanged — two variants are two `ResolutionId`s, which is what 11 §5a
> already relies on.

### 4.3 The in-memory archive

The engine ships one reference implementation that is both archive and channel. `publish`
takes a built registry, re-runs every campaign's `validateCampaign` against it, refuses a
content conflict, and stores deep-frozen copies — data copied and frozen, functions
(`migrateState`) kept by reference, since they cannot be copied and are code, not content. Its
channel answers **per campaign**: the version of `scope.campaignId` in the last successful
publication that held that campaign. Publication is still whole — a refused publication changes
nothing — but a later publication that omits a campaign no longer withdraws it from the
channel. `latest()` is unchanged: the last registry published whole.

It also exposes what a durable host needs around it: `stored(campaignId, campaignVersion)`
returns the `StoredEpoch` to persist; `restore(stored)` re-enters one at boot (§5.1a), moving
neither `latest()` nor the channel; and `authoredKeys()` answers the alias scope (§5.7).

**Copying at publish answers the by-reference hazard for archived content.** The registry a
host builds still holds its campaigns by reference (`90-decisions.md`), but nothing the archive
serves can be mutated after it validated it. A host that wants the same guarantee for its
default epoch publishes the registry through the archive rather than relying on construction.

The in-memory archive is append-only and never evicts. A host that needs eviction or
durability supplies its own (§6).

---

## 5. Control Flow

### 5.1 Publishing

```text
host builds a registry (resolvePacks + buildValidatedContentRegistry, or by hand)
archive.publish(registry):
  no registry.provenance → content_provenance_missing
  any authored key reserved, or containing `~` → protected_string_key
  for each campaign: form = (composed campaign, attachments, provenance strings); digest = epochDigest(form)
  for each campaign: kind.validateCampaign(campaign, form.strings ∪ running engine catalog) — any error → refuse
  for each campaign: key = (id, version); if held with a different digest → content_version_conflict
  store frozen copies and each StoredEpoch; latest = this registry; current[id] = version
  → the epochs newly added (an identical republish adds none)
```

The in-memory archive never retires. A host archive that does (§6) also refuses to publish a
retired key, even with an identical digest: retired means `resolve` answers `undefined` for it
forever, and republishing would make it answer again.

### 5.1a Restoring at boot

A durable host re-enters its stored epochs before it serves anything:

```text
for each stored epoch:
  archive.restore(stored):
    epochDigest(stored.form) ≠ stored.digest              → integrity_failure
    an authored key is in stored.publication.reservedKeys  → integrity_failure
    key held with a different digest                      → integrity_failure
    running kind's validateCampaign(form, form.strings ∪ running engine catalog) errors
                                                          → unsupported (not entered)
    otherwise enter it                                    → restored
  integrity_failure → the boot fails
  unsupported       → record it; never offer that version
```

**Restore never recomposes.** The stored form is the composed campaign, so a module that has
changed since, or a pack that no longer resolves, cannot change it — and the digest check proves
the stored bytes are the bytes that were published.

**It always validates, and an unsupported epoch fails soft.** A kind upgrade can make an old
epoch invalid under the running kind; failing the boot for that would let one stale campaign take
the whole host down. So an epoch the running kind rejects is `unsupported`: not entered, never
offered by the channel, and recorded with both kind identities and the validation errors. A
request naming it is the host's `campaign_version_unsupported` (409), distinct from its own
`campaign_version_unavailable`, which means a version it does not offer at all. The warning
`epoch_unsupported` is recomputed on every boot, never persisted, and sets
`potentialRegression: true` when the rejecting and publishing `kindVersion`s are equal — the
same kind rejecting what it accepted is a regression, not an upgrade.

**A key that was not reserved when it was published is tolerated.** An authored key the running
engine now reserves — an engine release added a kind message under that name — restores with a
`historical_string_collision` warning `{campaignId, campaignVersion, key}`, and §5.7's aliases
keep both meanings reachable. A key that was already reserved at publication could only be in
the form if the store was tampered with, so it is an integrity failure. An authored `~` key in a
legacy epoch is tolerated the same way.

`restore` moves neither `latest()` nor the channel: which version a new session starts on is the
host's publication, not the order it reloaded its history in.

No session is touched. Publication only changes what the channel will answer at the next
adoption point. A campaign whose `kindId` names no registered kind has no `validateCampaign` to
run and refuses the publication `unknown_kind`, as `buildValidatedContentRegistry` would; the
core-owned Tier 1 checks are not re-run, since nothing between building a registry and
publishing it can change them (`90-decisions.md`, 2026-10-09, S131).

### 5.2 Creating a session

`createSession` asks the channel for the campaign's version and calls `createGame(config,
version)`. No channel, or a channel with no answer, starts on the registry's version; an answer
that is not a string is read as no answer. Creation is not an adoption: the game starts on that
epoch, with no content entry, exactly as if it had been the registry's. The store takes the
campaign's kind and profile data from the offered epoch, through `engine.content.resolve`, and
an offer naming a version the archive does not hold fails creation `unknown_campaign`, as
`createGame` does — creation is not covered by "adoption never fails a command", and a silent
fallback would start the player on content the host did not choose (`90-decisions.md`,
2026-10-09, S133).

### 5.3 The adoption points

| Point | When | In the same write as |
|---|---|---|
| `submitAction` | After the action commits, before the scene is projected | The accepted action |
| `resumeSession` | Before the scene is returned | Its own write, revision + 1 |
| `loadGame` | After the save resolves, before the scene is returned | The new session's first write |
| `branchSession` | After the retained prefix replays, before the scene is returned | The branch's first write |

At each, under the session lock: ask the channel; if it names a version other than the
state's, call `engine.adoptContent(state, version)`; persist the result with whatever else that
command writes; project the scene from the adopted state. At `submitAction`, what the action
produced stays on the epoch it resolved on: the profile fold receives that epoch's campaign and
the messages come from it, because the changes being folded were made against it
(`90-decisions.md`, 2026-10-09, S133).

**Queries never adopt and a rejected action never adopts.** A query writes nothing, and making
one write would break 04 §7's line between look and change. A rejected action leaves the state
unchanged by contract (04 §4 step 5); adopting on rejection would make the refusal a write.

**Adoption never fails a command.** A refusal leaves the session pinned and the command
completes on the old epoch. So does a channel that throws — it is read as no offer, the
reading `validateState` gives a throw (04 §3) — because a host defect in a policy hook must not
stop a player mid-turn. The engine never sees the channel, so it cannot report one failing; the
host observes its own. The engine emits `core.content.pinned` for every refusal it judges.

> **Why after the action and not before.** Adopting before dispatch would resolve the
> player's chosen action against content they had not seen: the scene offered choice `c` under
> the old epoch, and the new epoch might have moved it. After commit, the player always
> resolves what they were shown, and the next scene is the first one drawn from the new
> content.

### 5.4 `adoptContent`, step by step

```text
adoptContent(state, to):
  0. to == state.campaignVersion → return adopted, same state           // idempotent: no entry, no event
  1. state.status != "active"    → pinned session_ended
  2. from = archive.resolve(campaignId, state.campaignVersion)          // always resolves: deserialize checked
     target = archive.resolve(campaignId, to); missing → pinned unknown_campaign
  3. target campaign's kindId != state.kindId → pinned content_kind_changed
  4. kind.adoptContent absent → pinned content_not_adoptable
  5. kindState' = target.migrateState?(kindState, from.version)         // failure or throw → pinned migration_failed
  6. decision = kind.adoptContent(kindState', fromCampaign, targetCampaign)  // throw → pinned content_incompatible
     refused → pinned decision.reason
  7. kind.validateState(decision.state, targetCampaign) false → pinned invalid_state
  8. return adopted: { ...state, formatVersion: 2, campaignVersion: to, kindState: decision.state,
       actionLog: [...log, { seq: log.length, system: "content", from: state.campaignVersion, to }] }
```

Every pinned outcome returns the reason and no state, emits `core.content.pinned`, and leaves
the input untouched. An adoption emits `core.content.adopted`; step 0's no-op emits nothing,
so a channel that offers the current version on every command floods no event stream
(`90-decisions.md`, 2026-10-09, S130). Neither produces a `StateChange`
or an `OutcomeMessage`: adoption is not play, so nothing reaches the profile fold (04 §7.1) and
nothing claims a turn happened. Telling the player that new content arrived is a client's
choice, made from the scene it already re-renders.

`Campaign.migrateState` runs on adoption under the same rule 04 §10.2 states for loads: it may
re-address published ids and drop or default references that no longer resolve, and it may
never invent play. It runs on the *target* campaign because the target is the content that
knows what it renamed. Adoption does not run `Kind.migrateState`: a kind-shape change is a
kind-version change, which is a save-load concern, and a running engine has one kind version.

Because it runs from the session's own version, a campaign migration must accept a predecessor
it has nothing to re-address, returning the state with no id moved (04 §10.2). An extension
that keeps its predecessor's migration is called with exactly that version. A migration that
refused it would pin every live session on the extension's first adoption
(`90-decisions.md`, 2026-10-15).

### 5.5 The story-graph rule

The story-graph kind adopts additive change and refuses anything that could strand the
player. After any campaign migration, it adopts iff:

- `currentNodeId` names a node the target has, **that node is a `ChoiceNode`, and at least
  one of its choices is available** — `showWhen` true and requirements met — against the
  adopted state, after the insertion below;
- every `visitedCounts` key and every `unlockedAchievements` id exists in the target;
- every variable the state carries that the target declares holds a value the target's
  declaration admits: its `VarType`, and for an `enum` one of its `values`, for an `int` within
  its `min`/`max`;
- no variable the source declared and the state carries is missing from the target.

Variables the target declares and the state lacks are inserted at their declared initial value.
Everything else passes through unchanged — including a variable neither campaign declares, which
load already tolerates as unread. A refusal reasons `content_incompatible`.

The variable condition judges the carried value, not only its type. A target that narrows an
`enum` or an `int` range past a value the session holds is refused: an `enum` holding a dropped
member would read normally but fail a later `copy` into another `enum`, so the adoption would
look additive and still break a move. The narrowed `int` is refused with it so that one rule
covers both (`90-decisions.md`, 2026-10-15, replacing the type-only rule of 2026-10-09, S132).
An author who narrows a declaration writes a `migrateState` that moves the excluded values.

**The node the player stands on must still be a place to act.** An active story-graph session
always rests on a choice node, because `submitChoice` and `createGame` both settle until they
reach one (`20-contract.md`, story-graph §8.2). Adoption runs no settle — settling would draw
randomness and walk nodes, which is play, and C24 forbids it — so a target that turned the
current node into an ending, an auto or a random node, or gated away every choice it offers,
would leave an active scene with nothing to submit: every choice rejects `not_a_choice_node` or
its gate, and an ending the target means is never recorded (red-team F2). Such a target is
refused and the session stays pinned on content where it can still play. An author who means to
end a session in place does so through content the player reaches, not by rewriting the node
under them.

That last condition settles what `validateState` deferred (`20-contract.md`, story-graph §8.1):
a save whose campaign later dropped a variable is still tolerated *at load*, because the save is
the record and refusing it strands the player; *adoption* refuses the same silent drop, because
there the old epoch is still playable and staying pinned costs nothing. An author who means to
drop a variable writes a `migrateState` that drops it.

### 5.6 Replay and branching

Replay re-runs a log from its starting version. For each entry: an action goes through
`submitAction`; a content entry goes through `adoptContent(state, entry.to)` and must adopt; a
migration entry is never reached, because no replayable log carries one (§3.5). A
content entry that now refuses is a divergence — the kind's compatibility rule changed, which is
precisely what a cross-version oracle exists to catch (07 §6). The C1 harness (04 §14) treats
both entry types the same way: byte-identical serialization after every entry. `adoptContent`
takes only the target, so the harness first checks a content entry's `from` against the
replay's current `campaignVersion` and fails the fixture, naming both, when they differ
(`90-decisions.md`, 2026-10-09, S130).

`branchSession` replays the retained prefix the same way, then reaches its own adoption point.
`atActionCount` counts log entries of every type, so a fork may fall either side of an adoption;
a branch taken before one starts on the old epoch and is offered the new one on return.

### 5.7 Strings across an adoption

A client renders keys from one call with a table from another: `getScene`, then `getStrings`.
Between the two, another client's `resumeSession` may adopt, and if the new epoch renamed a key
the scene carries, a table drawn from the new epoch alone cannot resolve it. Reading the table
first permits the inverse. Every call respects the session lock; the race is between completed
calls, so the lock cannot close it (red-team F3).

**So a session's string table spans every epoch the session has run on, and only grows.**
`getStrings(sessionId)` returns the union of the string tables of the session's live epochs —
its starting version, or the last migration entry's `to` when the log carries one (§3.5), and
every content entry's `to` after it — each key resolved from the most recent of those epochs
that defines it. The current epoch therefore wins every key it has, and a key it dropped still
resolves through the epoch that last had it. A session that never adopted gets exactly the table
it always did.

That makes one property hold, and gives a client one rule:

- **Any key in any result the store returned for a session resolves in every later
  `getStrings` of that session.** Every such key came from an epoch the log named when the
  result was built, and within one session id the log only grows (C27).
- **A client that meets a key its cached table lacks fetches the table again**, and the key is
  then present. The mismatch the red team found is therefore detectable, and recoverable with
  the surface a client already has.

It also covers the case the race only illustrates: a `submitAction` that adopts after commit
returns messages built on the old epoch beside a scene projected from the new one (§5.3), and
one table resolves both.

**What it does not promise** is the wording a key had when the result was built. A key both
epochs define resolves to the newer text, so an older scene can show newer wording for a key the
new epoch reworded. That is accepted rather than designed away: the new wording is the content
the host published, and a client that needs the exact old text is asking for the old epoch,
which `getStrings` is not the API for.

The union adds nothing to retention (§6): every epoch it spans is already named by the session's
log, so retention already keeps it. A host archive that drops one anyway costs only that
epoch's contribution: `getStrings` is a query, so an epoch that no longer resolves is skipped
and the union of the rest returned (`90-decisions.md`, 2026-10-09, S133).

**The union carries only authored strings; engine keys come from the running engine.** Since an
epoch's identity excludes engine messages (§3.4), the table resolves every engine-owned key —
`core.reason.*`, a kind's `reasonMessages` — from the running catalog. Historical engine wording
is not promised, for the same reason a newer epoch's wording wins above.

**Response aliases keep a colliding key's two meanings apart.** A restored epoch may author a key
the running engine now owns (§5.1a). Without help, one table entry would have to answer for two
texts. So an engine-owned reference to such a key travels under an alias, `~k`, or `~n~k` with
the smallest free `n` when an authored key already takes `~k` — and only the alias's table entry
carries the engine text, while `k` keeps the authored one. 04 §7 contracts the full rule; the
design choices behind it are these:

- **Aliases are applied where the reference is produced, never by matching text.** A kind's
  projection calls `ProjectionContext.engineRef` (04 §3.1) on each engine-owned key it emits; the
  store aliases `errors`, `warnings` and `messages` after the profile fold and logging have
  consumed them unaliased. A value whose owner varies — a story-graph `reasonKey` that is
  `requirementFailKey` when the choice sets one — carries its owner on an internal carrier to the
  point that aliases it. Matching text could not tell an authored `k` from an engine `k`, which is
  the whole problem.
- **Only colliding keys are aliased in production**, so today's responses are byte-identical and
  goldens and replay fixtures do not change. A test context (`aliasEngineKeys: "all"`, 06 §4)
  aliases every engine-owned reference, so the path is exercised continuously rather than first
  on a legacy restore.
- **The scope is the archive's authored keys, not the session's.** One map then serves every
  session and every surface — scenes, views, actions, previews, errors, messages, `getStrings`,
  `listCampaigns`, offline bundles — and it changes only when `restore` adds an epoch or a host
  archive retires one (§6), never on `publish`, which refuses the collision outright (04 §12).
- **An alias is presentation.** It never reaches `GameState`, the log or `serialize()` (04 C29),
  and a client must not persist one apart from the table it came with: the same key may alias
  differently after the host restores or retires an epoch, which is why 04 C27 excludes aliases.

---

## 6. Distribution

The engine is an in-process library; moving content between machines is the host's. What the
engine requires of a multi-instance host is narrow:

- **Every instance resolves every epoch any session names.** A session written on instance A
  after adopting epoch `e2` and resumed on instance B fails `unknown_campaign` if B has not
  received `e2`. Content-addressing makes the obligation safe to meet lazily: an epoch fetched
  late is the same epoch.
- **Channel answers may disagree across instances for a while.** Instance A may offer `e2`
  while B still offers `e1`. That is harmless: adoption is recorded in the session's own log,
  the store's revision check (04 §7.2) refuses a stale concurrent write, and a session offered
  `e1` while on `e2` is offered a rollback the kind judges like any other move.
- **The durable form is the stored epoch, not the inputs that built it.** A host persists each
  `StoredEpoch` (04 §4) and restores it at boot (§5.1a) without recomposing. Storing ordered
  pack references instead would be smaller, but a rebuild re-runs composition and attachment
  against whatever modules the host holds *now*, so an epoch's content would depend on code
  and packs published after it. The stored form is what the digest covers, and the digest is
  what proves the restore.

**Retention.** An epoch may be dropped only when no live session, no save and no retained
fixture names it — as a starting version or as any content entry's `from` or `to`, counting, in a
log that carries a migration entry, only from the last one's `to` (§3.5). Dropping one
earlier turns those into `unknown_campaign` at the next load and `campaign_version_missing` at
the next replay. The engine cannot see saves or fixtures, so it cannot enforce this; the
in-memory archive sidesteps it by never evicting.

**Retirement is how a host archive drops one.** A retired key answers `undefined` from
`ResolutionArchive.resolve` forever (04 §4), and the host's `publish` refuses it from then on, so
the key can never name different content later. The engine caches no resolution, so retirement
takes effect on the next call. A session cached in memory on a retired epoch is dropped with
`SessionLayer.forget` (06 §5.2). Replay engines are built over the same host archive, so a
fixture naming a retired epoch is `unrunnable: campaign_version_missing`, not a silent pass
against something else.

---

## 7. Failure Modes

| Where | Condition | Result |
|---|---|---|
| `publish` | A campaign fails `validateCampaign` | Refused with its validation errors; nothing stored, `latest` unchanged |
| `publish` | A key is held with a different digest | Refused `content_version_conflict`; nothing stored |
| `publish` | The registry has no `provenance` | Refused `content_provenance_missing`; nothing stored |
| `publish` | An authored key is engine-reserved or contains `~` | Refused `protected_string_key` (`details.reason`: `engine_reserved` or `response_alias_namespace`); nothing stored |
| `publish` (host archive) | The key was retired | Refused `content_version_conflict`, even with an identical digest |
| `restore` | The stored form's digest ≠ the stored digest; an authored key was reserved at publication; or the key is held with a different digest | `integrity_failure` — the host's boot fails |
| `restore` | The running kind rejects the stored form | `unsupported`: not entered, never offered; `epoch_unsupported` warning, recomputed each boot, `potentialRegression` when the kind versions are equal |
| `restore` | An authored key the running engine now reserves, or a legacy `~` key | Restored with `historical_string_collision`; responses alias the engine key (§5.7) |
| Host request | Names a version whose restore was `unsupported` | `campaign_version_unsupported` (409) — distinct from the host's `campaign_version_unavailable` |
| `createEngine` | `archive` lacks a registry campaign at its registered version | Throws — a construction error |
| `createGame` | The requested version does not resolve | `unknown_campaign` |
| `deserialize` / `migrate` | `(campaignId, campaignVersion)` does not resolve | `unknown_campaign`, emitting `core.deserialize.rejected` — closes the retained gap |
| `deserialize` | Last epoch entry's `to` ≠ `campaignVersion`, an epoch entry in a version-`1` state, or a version-`2` state with no epoch entry | `invalid_state` |
| Adoption | Target missing; kind changed; seam absent; migration failed; kind refused; result invalid; session ended | Pinned, with the §5.4 reason; the command completes |
| Adoption point | Channel throws | No offer; the command completes |
| Adoption point | The adoption-only write at `resumeSession` fails (`storage_failure`, `concurrent_modification`) | The store restores the cached record — and evicts it on a conflict; `resumeSession` returns the unadopted scene, and the next adoption point retries. `core.content.adopted` was already emitted, so the event stream can show an adoption that did not persist |
| `createSession` | The channel offers a version the archive does not hold | `unknown_campaign`; nothing created |
| `loadGame` | The save's wrapper `campaignVersion` ≠ its state's | `invalid_state`, like the wrapper's other identity fields (`90-decisions.md`, 2026-10-09, S134) |
| `loadGame` | The save's epoch is archived and its `kindVersion` matches | Loads on that epoch with no migration — `replayCompatible` kept — then adopts |
| `loadGame` | Otherwise | 04 §10.2's migration path; one that changes `campaignVersion` on a log carrying an epoch entry appends a migration entry (§3.5) |
| `branchSession` | A version the retained prefix names does not resolve | `unknown_campaign` (the existing row, widened) — every version checked through `engine.content.resolve`, exact version match, before anything is created (`90-decisions.md`, 2026-10-09, S134) |
| `branchSession` | A recorded content entry now refuses | `invalid_state`; nothing written |
| `branchSession` | The log carries a migration entry | `invalid_state` — the existing `replayCompatible: false` refusal, readable from the log where the entry exists |
| Adoption, story-graph | The target's node at `currentNodeId` is not a choice node, or offers no available choice | Pinned `content_incompatible` (§5.5) |
| `getStrings` | A key an earlier result carried is absent from the current epoch | Resolved through the most recent live epoch that defines it (§5.7) |
| `getStrings` | A live epoch no longer resolves | Skipped; the union of the rest is returned (§5.7) |
| Replay | The campaign id is gone from the runner's registry | `unrunnable: campaign_withdrawn` |
| Replay | The starting or any recorded version does not resolve through the archive | `unrunnable: campaign_version_missing` |
| Replay | An adoption submission names the version the game is already on | The runner throws — a malformed fixture, not a divergence (`90-decisions.md`, 2026-10-09, S135) |
| Replay | A recorded adoption now refuses | `diverged` at that index |

> **The load-path refinement is the quiet win.** Before epochs, a save made under any older
> version migrated — and a migrated save is `replayCompatible: false` forever. With an archive
> holding the save's epoch, the save loads exactly as it was made and moves forward by logged
> adoption instead. Migration remains the path for content the archive no longer holds and for
> kind-shape changes, which is the job it was designed for.

---

## 8. Concurrency and Ordering

- **Adoption is ordered with the session's own commands by the session lock** (04 §7, lock
  domains). It is part of a command, never a separate operation racing one.
- **Publication is not ordered with sessions at all.** A session sees a new epoch at its next
  adoption point, never before, and never because something was pushed to it. There is no
  broadcast.
- **The archive serializes publications.** `latest` is the last publication that succeeded;
  a refused one changes nothing. An identical republish of an older registry succeeds, adds no
  epochs and becomes `latest` — that is how a host rolls the channel back. Nothing already
  adopted is undone: a session on a newer epoch is offered the older one at its next adoption
  point, and the kind judges that move like any other (`90-decisions.md`, 2026-10-09, S131).
  The channel answers per campaign (§4.3), so the rollback moves only the campaigns that
  registry holds; `restore` moves neither `latest` nor the channel.
- **Versions carry no order.** The channel may name an older epoch — a rollback — and the kind
  judges that move like any other. Requiring monotonic versions would need a total order over
  `ResolutionId`s, which are digests and have none.
- **`revision` rises on an adoption write** (04 §7.2). An adoption at `submitAction` rides the
  action's increment; one at `resumeSession` is its own.

---

## 9. Alternatives Considered

| Rejected | Why |
|---|---|
| **Adopt before the command runs** | The player's action would resolve against content they were not shown (§5.3). |
| **A version field on `NewGameConfig`** | Config is what a player chose; 07 §2's reasoning that a version is not one of those still holds. The caller's second argument carries it instead. |
| **An `Engine.withContent(registry)` decorator** | A per-command engine over one registry cannot replay a log that crosses an epoch boundary: replay needs every epoch the log names, which is an archive by definition. |
| **A chain of log segments, one per epoch** | Splits the replay spine into pieces whose boundaries live outside the log. One log with content entries keeps `{ seed, actionLog }` the whole input. |
| **Adopt by default when the kind has no seam** | The core cannot tell additive from breaking without reading `kindState`. Defaulting to adopt is defaulting to stranding; pinned costs nothing. |
| **Host-wide publication only, no per-session channel** | The settled scope is both. A host-wide archive with no per-scope answer would make overlays a second design later, against a contract that had already assumed one answer per host. |
| **Route adoption through save migration** | Migration costs `replayCompatible`, which is the opposite of the first settled direction. |
| **Reject a version mismatch on `deserialize`** | Turned down in plan 53 (D3): it ends exactly the sessions injection exists for. Resolving the version through the archive replaces the gap rather than closing it by refusal. |
| **Bump `formatVersion` unconditionally** | §3.3. |
| **Rename `campaign_version_missing` to a new verdict** | The type is public and three suites switch on it; widening what triggers it costs nothing. |
| **Exempt migrated states from C26** (F1) | `replayCompatible` lives on the save and the session record, not on `GameState`, so `deserialize` cannot see an exemption; and an unchecked last `to` is the integrity check removed rather than satisfied. |
| **Log every migration that changes `campaignVersion`** (F1) | One unconditional rule, and the log would name every epoch a game ran on — but every migrated save of a host that never adopts would become `formatVersion: 2`, breaking the byte-identical promise of §3.3 and stranding those saves on an engine rollback. What it buys is a truthful starting version on logs that are never replayed. |
| **Reuse `LoggedContent` for a migration** (F1) | Replay would read it as an adoption and try to repeat it; a migration's source epoch is one the host could not resolve, so the attempt fails as a divergence that is really a category error. |
| **Settle the story-graph state at adoption** (F2) | Settle walks nodes and may draw randomness — play, which C24 forbids adoption to invent. |
| **Require only that the node's type is unchanged** (F2) | Misses a choice node whose every choice the target gated away — the same stranding by a different edit. |
| **Stamp each `Scene` with its epoch and let `getStrings` take one** (F3) | Exact, but a new field on `Scene`, a new parameter on a store operation and its MCP tool, and still two epochs in one `SessionActionResult` when `submitAction` adopts after commit. The union answers both with no surface change. |
| **Digest the registry's full string table** (plan 54) | What §3.4 used to say. An engine release that rewords one error changes every held epoch's digest, so every republish after an upgrade is a `content_version_conflict` and every durable restore an integrity failure. |
| **Decide ownership by key prefix** (plan 54) | `core.reason.*` covers the core but not a kind's `reasonMessages`, and an authored key may legitimately equal an engine key a later release added. Only the builder knows who wrote a key, so it records it (`provenance`). |
| **Fail the boot on an epoch the running kind rejects** (plan 54) | One stale campaign would take the whole host down after a kind upgrade. Integrity failures still fail it; a validation failure is `unsupported`. |
| **Skip validation on restore** (plan 54) | The epoch was valid under the kind that published it, not necessarily the one running. Entering it unvalidated would let the first command find out. |
| **Rename the authored key instead of aliasing the engine one** (plan 54) | Authored keys are inside saves, logs and fixtures; renaming them changes state. An engine key on a response is presentation, so the alias costs nothing outside it. |
| **A structured `LocRef { key, owner }` on every response** (plan 54) | Exact without aliases, but a type change on every surface that carries a key, for a collision no current campaign has. Left in the open register. |
| **`forget` on `SessionStore`** (plan 54) | `SessionStore` is the client surface, one-to-one with the MCP tools (09 §4). Eviction belongs to the host that owns persistence, so it is on `SessionLayer` (06 §4). |

---

## 10. Story Extension Is Subsumed

The 2026-10-03 review asked for a story-extension contract: Adventures merges extension JSON
into a base campaign by reading the portable story shape directly, which breaks silently on a
submodule bump (`90-decisions.md`). Epochs answer it in two halves, and neither is a new merge
framework:

- **Delivery is an epoch.** A published extension is a new resolution, validated at publish,
  reaching live sessions through adoption.
- **Authoring is an attachment.** 11 §3a and 04 §10.4 already contract how one pack adds to
  another campaign, validated after the fold. That is the stable, engine-owned extension shape
  the review asked for.

What Adventures' merge does that attachments do not — adding achievements, adding more than one
choice to a host node — is recorded as gaps in the attachment model rather than as a reason
for a second extension contract. The downstream merge retires when attachments cover what it
uses. Until then, an engine change to the portable story shape is still a breaking change for
it, as recorded.

**An extended campaign publishes under a derived version, and that is the host's convention.**
Content-addressing refuses a base campaign whose content changed under its authored version, and
an applied extension does exactly that. Adventures therefore publishes an extended campaign as
`<authored>+ext.<12 hex>` — appended to existing build metadata rather than a second `+` — over
a digest of its extensions in application order, and refuses an authored version that already
uses the `ext` identifier (plan 54, D2). The engine owns none of this; it compares versions
exactly and only exports `canonicalDigest` (04 §4) so the host's digest is the engine's.

---

## 11. Open Questions

- **Catalog refresh.** `listCampaigns` reads the session layer's construction-time registry,
  so a campaign that first appears in a publication is playable through the channel but not
  listed. Adventures answers it host-side with no engine change: it serves its own catalog from
  its current publication and admits every session creation through its own channel (plan 54,
  D4). The engine signature waits for a second host.
- **Simulation and world-graph adoption.** Neither declares `adoptContent`, so every session of
  theirs stays pinned. Each kind's rule is its own design, and neither has a host asking yet.
- **The durable archive.** What it stores and restores is now contracted (§5.1a, 04 §4), and so
  is retirement (§6). How it proves an epoch is unreferenced before retiring it is host-owned
  and unspecified, since it needs saves and fixtures the engine cannot see.
- **Overlay privacy beyond capture.** 08 §4 treats an overlay's resolution as personal data in
  a fixture. Whether an overlay's existence leaks through anything else a host exposes is not
  designed.
- **A shared `packVersion` helper.** Already in the register; epochs make the convention more
  load-bearing, since a pack that changed without moving its version now publishes a conflict.
