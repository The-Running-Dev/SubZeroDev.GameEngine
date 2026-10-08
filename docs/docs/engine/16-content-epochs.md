---
sidebar_label: Content Epochs
---

# Content Epochs — Live Content Without a Reload

<!-- Generated from design/10-design.md by build/ConvertTo-HumanDocumentation.ps1. Do not edit directly. -->

**Document status:** Revision 1 — new contract, post-MVP

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

---

## 3. Data Model

### 3.1 The log carries content entries

The envelope gains no field. The element type of `actionLog` widens from `LoggedAction` to a
union, and the new member records an adoption:

```typescript
type LoggedEntry = LoggedAction | LoggedContent;

interface LoggedContent {
  seq: number;          // consumes a seq, exactly like an action
  system: "content";
  from: string;         // the campaignVersion before adoption
  to: string;           // the campaignVersion after; equals GameState.campaignVersion until the next one
}
```

`GameState.campaignVersion` remains the one place a state's current epoch lives. A content
entry records the transition, not the state, so the two never disagree: the last entry's `to`
*is* `campaignVersion`, and an engine check enforces it on `deserialize`.

**The replay input becomes `{ seed, starting version, actionLog }`, and the starting version
is derived, not stored.** It is the first content entry's `from`, or `campaignVersion` when the
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

`GameState.formatVersion` moves from `1` to `2` **only on a state whose log carries a content
entry.** `adoptContent` writes `2` when it appends one; a game that never adopts keeps `1` and
serializes byte-identically to today. The reader accepts both. An engine predating this design
rejects a version-`2` state with `invalid_state`, which is the correct answer — it would read
a content entry as an action with no `actionId` — and still reads every state that never
adopted, which contains nothing it cannot understand.

> **Why not bump unconditionally.** Every golden file and every stored session would change
> for a feature none of them use, and an older engine would refuse states it reads perfectly
> well. A version stamp names the shape the bytes actually use; a state with no content entry
> uses the old one.

### 3.4 The archive

An archive maps `(campaignId, campaignVersion)` to the `ContentRegistry` that epoch was
published in. It is **content-addressed**: one key names one content, permanently. The
in-memory archive (§4.3) refuses a second publication of the same key with different content,
and accepts an identical one as a no-op.

What "the same content" means is fixed so two archives agree on it: the canonical digest 11 §6
already uses for a pack's version — over the campaign's `id`, `kindId`, `version`, `titleKey`,
`content`, and `includes` when present — plus the registry's full `strings` table, sorted by key.
Strings are part of an epoch because a session renders through the string table it resolved;
a publication that changes a string without changing a version is the silent drift
content-addressing exists to refuse.

---

## 4. Module Boundaries

| Who | Owns | Never |
|---|---|---|
| **Pure engine** | Resolving a state's content by `(state.campaignId, state.campaignVersion)`; `adoptContent`; the content entry | Deciding *when* to adopt or *to what*; publishing |
| **Kind** | `adoptContent?` — whether this state can move from one campaign to another, and what it becomes | Reading the archive, the channel, or the log |
| **Campaign** | `migrateState?` — re-addressing ids the new content renamed, run before the kind judges | Deciding adoptability |
| **Session store** | The four adoption points, consulting the channel, persisting the adopted state in the same write | Validating content; choosing a version itself |
| **Host** | Publishing; the channel's policy (one version for everyone, per-profile overlays, staged rollout); durable storage and retention | Writing a content entry by hand |

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
channel answers the latest successful publication for every scope.

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
  for each campaign: kind.validateCampaign(campaign, registry.strings) — any error → refuse
  for each campaign: key = (id, version); if held with a different digest → content_version_conflict
  store frozen copies; latest = this registry
  → the epochs newly added (an identical republish adds none)
```

No session is touched. Publication only changes what the channel will answer at the next
adoption point.

### 5.2 Creating a session

`createSession` asks the channel for the campaign's version and calls `createGame(config,
version)`. No channel, or a channel with no answer, starts on the registry's version.
Creation is not an adoption: the game starts on that epoch, with no content entry, exactly as
if it had been the registry's.

### 5.3 The adoption points

| Point | When | In the same write as |
|---|---|---|
| `submitAction` | After the action commits, before the scene is projected | The accepted action |
| `resumeSession` | Before the scene is returned | Its own write, revision + 1 |
| `loadGame` | After the save resolves, before the scene is returned | The new session's first write |
| `branchSession` | After the retained prefix replays, before the scene is returned | The branch's first write |

At each, under the session lock: ask the channel; if it names a version other than the
state's, call `engine.adoptContent(state, version)`; persist the result with whatever else that
command writes; project the scene from the adopted state.

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
  0. to == state.campaignVersion → return adopted, state unchanged      // idempotent
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
the input untouched. An adoption emits `core.content.adopted`. Neither produces a `StateChange`
or an `OutcomeMessage`: adoption is not play, so nothing reaches the profile fold (04 §7.1) and
nothing claims a turn happened. Telling the player that new content arrived is a client's
choice, made from the scene it already re-renders.

`Campaign.migrateState` runs on adoption under the same rule 04 §10.2 states for loads: it may
re-address published ids and drop or default references that no longer resolve, and it may
never invent play. It runs on the *target* campaign because the target is the content that
knows what it renamed. Adoption does not run `Kind.migrateState`: a kind-shape change is a
kind-version change, which is a save-load concern, and a running engine has one kind version.

### 5.5 The story-graph rule

The story-graph kind adopts additive change and refuses anything that could strand the
player. After any campaign migration, it adopts iff:

- `currentNodeId` names a node the target has;
- every `visitedCounts` key and every `unlockedAchievements` id exists in the target;
- every variable the state carries that the target declares has the target's `VarType`;
- no variable the source declared and the state carries is missing from the target.

Variables the target declares and the state lacks are inserted at their declared initial value.
Everything else passes through unchanged. A refusal reasons `content_incompatible`.

That last condition settles what `validateState` deferred (`20-contract.md`, story-graph §8.1):
a save whose campaign later dropped a variable is still tolerated *at load*, because the save is
the record and refusing it strands the player; *adoption* refuses the same silent drop, because
there the old epoch is still playable and staying pinned costs nothing. An author who means to
drop a variable writes a `migrateState` that drops it.

### 5.6 Replay and branching

Replay re-runs a log from its starting version. For each entry: an action goes through
`submitAction`; a content entry goes through `adoptContent(state, entry.to)` and must adopt. A
content entry that now refuses is a divergence — the kind's compatibility rule changed, which is
precisely what a cross-version oracle exists to catch (07 §6). The C1 harness (04 §14) treats
both entry types the same way: byte-identical serialization after every entry.

`branchSession` replays the retained prefix the same way, then reaches its own adoption point.
`atActionCount` counts log entries of both types, so a fork may fall either side of an adoption;
a branch taken before one starts on the old epoch and is offered the new one on return.

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
- **The natural durable form is ordered pack references, not registries.** A resolution
  rebuilds deterministically from its `{id, version}` list through `resolvePacks`, and its
  `ResolutionId` verifies the rebuild — so a durable archive can store a few hundred bytes per
  epoch and the packs once. How it does so is host-owned.

**Retention.** An epoch may be dropped only when no live session, no save and no retained
fixture names it — as a starting version or as any content entry's `from` or `to`. Dropping one
earlier turns those into `unknown_campaign` at the next load and `campaign_version_missing` at
the next replay. The engine cannot see saves or fixtures, so it cannot enforce this; the
in-memory archive sidesteps it by never evicting.

---

## 7. Failure Modes

| Where | Condition | Result |
|---|---|---|
| `publish` | A campaign fails `validateCampaign` | Refused with its validation errors; nothing stored, `latest` unchanged |
| `publish` | A key is held with a different digest | Refused `content_version_conflict`; nothing stored |
| `createEngine` | `archive` lacks a registry campaign at its registered version | Throws — a construction error |
| `createGame` | The requested version does not resolve | `unknown_campaign` |
| `deserialize` / `migrate` | `(campaignId, campaignVersion)` does not resolve | `unknown_campaign`, emitting `core.deserialize.rejected` — closes the retained gap |
| `deserialize` | Last content entry's `to` ≠ `campaignVersion`, or a content entry in a version-`1` state | `invalid_state` |
| Adoption | Target missing; kind changed; seam absent; migration failed; kind refused; result invalid; session ended | Pinned, with the §5.4 reason; the command completes |
| Adoption point | Channel throws | No offer; the command completes |
| Adoption point | The adoption-only write at `resumeSession` fails (`storage_failure`, `concurrent_modification`) | The store restores; `resumeSession` returns the unadopted scene, and the next adoption point retries |
| `loadGame` | The save's epoch is archived and its `kindVersion` matches | Loads on that epoch with no migration — `replayCompatible` kept — then adopts |
| `loadGame` | Otherwise | 04 §10.2's migration path, unchanged |
| `branchSession` | A version the retained prefix names does not resolve | `unknown_campaign` (the existing row, widened) |
| `branchSession` | A recorded content entry now refuses | `invalid_state`; nothing written |
| Replay | The starting or any recorded version does not resolve | `unrunnable: campaign_version_missing` |
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
  a refused one changes nothing.
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

---

## 11. Open Questions

- **Catalog refresh.** `listCampaigns` reads the session layer's construction-time registry,
  so a campaign that first appears in a publication is playable through the channel but not
  listed. Whether listing reads the channel is a client-surface question.
- **Simulation and world-graph adoption.** Neither declares `adoptContent`, so every session of
  theirs stays pinned. Each kind's rule is its own design, and neither has a host asking yet.
- **The durable archive.** Its shape, its eviction policy, and how it proves an epoch is
  unreferenced before dropping it are host-owned and unspecified.
- **Overlay privacy beyond capture.** 08 §4 treats an overlay's resolution as personal data in
  a fixture. Whether an overlay's existence leaks through anything else a host exposes is not
  designed.
- **A shared `packVersion` helper.** Already in the register; epochs make the convention more
  load-bearing, since a pack that changed without moving its version now publishes a conflict.
