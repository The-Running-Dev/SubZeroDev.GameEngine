---
sidebar_label: Clients
---

<!-- Generated from design/10-design.md by build/ConvertTo-HumanDocumentation.ps1. Do not edit directly. -->

# Clients — The Contract

**Document status:** Revision 2 — browser-demo obligations added after the MVP

**Reading order:** after [`04-core.md`](04-core.md) §7 (the session store, which is the only
surface a client touches) and §13 (the MCP tools). This makes operational a rule the other
documents assert four times and never define.

> **Scope of this document**
>
> What a client may do, what it must not, and how that is *verified* rather than asserted.
> Defines the **API coverage checklist** that `MVP.md` §5 and `TODO.md` W16 both require and
> neither specifies.
>
> It covers the text client and the MCP server, which are the MVP's two, and the public
> browser demo specified in [`13-playable-web-demo.md`](13-playable-web-demo.md). Mobile and
> Discord remain deferred and inherit this contract unchanged when they arrive.

---

## 1. The Rule, Made Testable

*"Clients present state and submit choices. No game logic, ever"* (architecture §1) is
repeated in `01-vision`, `04-core` §1 and §13 — and nowhere is it said what counts as game
logic. Stated as a testable invariant:

> **Two different clients, given the same campaign, seed, `IdSource` and action sequence,
> must produce byte-identical `serialize()` output.** A client contributes nothing to the
> game but the order of the actions it submits.

> **The `IdSource` belongs in that list, and leaving it out made the test impossible.**
> `gameId` is a serialized envelope field (04 §2) drawn from the `IdSource` port, whose
> default is deliberately random (06 §5.1) — so two independently created sessions differ in
> their first field no matter how identically they play. The test fixes a **counting
> `IdSource`** for both runs, the same way the replay oracle does (07 §5). Normalizing
> `gameId` out afterwards would work too and is worse: it weakens the assertion to hide a
> setup detail.

That is not a new test. `MVP.md` §5 already requires the identical arc to complete through
the text client and through MCP; this states *why* that box is the load-bearing one — it is
the client contract's proof, not a convenience check.

The corollary is the useful working rule: **a client is a projection of the session store,
never a participant.** If removing the client and driving the store directly would change
the game, the client is doing something it should not.

---

## 2. The Only Surface

A client calls `SessionStore` ([`04-core.md`](04-core.md) §7) and nothing else. It does not
import the pure engine, a kind, the registry, or the projection machinery — the dependency
arrow in 04 §1.1 points downward and clients are above everything.

| Operation | Kind | Returns |
|---|---|---|
| `listCampaigns()` | Query | `CampaignSummary[]` |
| `getScene(sessionId)` | Query | `Scene` |
| `getView(sessionId)` | Query | `PlayerView` |
| `getStrings(sessionId)` | Query | `StringTable` |
| `createSession(config)` | Command | `SessionHandle` |
| `resumeSession(sessionId)` | Command | `Scene` |
| `submitAction(sessionId, actionId, params?)` | Command | `SessionActionResult` |
| `previewAction(sessionId, actionId, params?)` | Query | `SessionActionResult` |
| `saveGame(sessionId)` | Command | `SaveHandle` |
| `loadGame(saveId)` | Command | `SessionHandle` |

Three of those are recent corrections that this contract forced, and each was a hole a
client would have fallen into:

- **`getStrings` exists because every client-facing type carries `LocKey`s.** A client
  restricted to this surface had no way to resolve `labelKey`, `titleKey` or an
  `OutcomeMessage` — the contract as first written could not be implemented (04 §7).
- **`submitAction` returns `SessionActionResult`, not `ActionResult`.** The latter's success
  value is the *envelope* — seed, action log, opaque `kindState` — so returning it would put
  raw state past the projection boundary and make §6 a convention rather than a guarantee.
- **`createSession` takes `CreateSessionConfig`.** It previously took `NewGameConfig`, which
  has no `profileId`, so no client could start the profiled session MVP §5 requires.

---

## 3. What a Client May and May Not Do

| May | May not |
|---|---|
| Render `Scene` text and the action list the engine returned | **Decide which actions are available** — `availableActions` already did |
| Show a disabled action with the reason the engine supplied | **Evaluate a `Condition`**, or any requirement, itself |
| Resolve a `LocKey` against the string table for display | **String-match English** to infer meaning (04 §12) |
| Format numbers and dates for the player's locale | **Compute a consequence**, clamp a variable, or advance a turn |
| Keep the latest `Scene`/`PlayerView` to render | **Reason over accumulated state** to predict or pre-empt the engine |
| Show an error's localized message | **Retry a rejected action automatically**, or reinterpret a `ReasonCode` |
| Offer save/load through the store | **Persist game state itself**, in any form |

> **The sharpest line is the second row.** A client that hides an action because it believes
> the requirement is unmet has reimplemented the requirement — and will disagree with the
> engine the moment either changes. `availableActions` returns what is available *and* what
> is shown-but-disabled with its `requirementFailKey` (03 §4, §9); rendering that faithfully
> is the whole job.
>
> Note this also means a client never sees a `showWhen`-hidden choice at all, and must not
> try to discover one: submitting an unknown id returns `unknown_action`, deliberately
> indistinguishable from a hidden one (03 §8.3).

**On caching.** Holding the last `Scene` to redraw is presentation. Accumulating state to
decide anything is logic. The test is §1's: if the cache changed what got submitted, it was
logic.

---

## 4. The API Coverage Checklist

`MVP.md` §5 requires *"No game logic lives in either client — verified by the API coverage
checklist."* This is that checklist.

**Every public `SessionStore` operation must be exercised by an automated test driving the
real client**, not by inspection and not by a unit test of the store. One row per operation,
one column per MVP client:

| # | Operation | Text client (W16) | MCP tool (W17) | Simulation kind (W50) | Browser demo (W61) | Hosted transport (Platform G1/S5) |
|---|---|---|---|---|---|---|
| 1 | `listCampaigns` | ☑ | `list_campaigns` ☑ | ☑ | ☑ | ☑ |
| 2 | `createSession` | ☑ | `start_game` ☑ | ☑ | ☑ | ☑ |
| 3 | `resumeSession` | ☑ | `continue_game` ☑ | ☑ | ☑ | ☑ |
| 4 | `getScene` | ☑ | `get_scene` ☑ | ☑ | ☑ | ☑ |
| 5 | `getView` | ☑ | `get_state` ☑ | ☑ | ☑ | ☑ |
| 6 | `getStrings` | ☑ | `get_strings` ☑ | ☑ | ☑ | ☑ |
| 7 | `submitAction` | ☑ | `choose` ☑ | ☑ | ☑ | ☑ |
| 8 | `previewAction` | ☑ | `preview_action` ☑ | ☑ | ☑ | ☑ |
| 9 | `saveGame` | ☑ | `save_game` ☑ | ☑ | ☑ | ☑ |
| 10 | `loadGame` | ☑ | `load_game` ☑ | ☑ | ☑ | ☑ |

**The "Hosted transport" column is `SubZeroDev.Platform`'s G1**, the fifth column S5 adds — every
row driven over the network through the hosted JSON wire and compared byte for byte against the
same operation played in-process (`SubZeroDev.Platform`'s `design/20-contract.md` and
`design/30-slices.md` S5). Evidence lives in that repository — `workloads/game-service/tests/`,
`runInProcess`/`runHosted` and the committed golden transcript — not in this one; the column here
records only the fact that every operation this engine exports was exercised through it.

**The "Simulation kind" column is not a third client** — it is the same two clients
(text, MCP), driven a second time against a kind whose actions carry declared `params`
(`plan.add`'s `actionType`), the first kind for which that distinction is real
(`story-graph` rejects any `params` — 03 §8.2). It exists to prove the checklist generalizes
past the one kind (`story-graph`) every other row above was proven against, not to add an
eleventh operation.

**Evidence**, one test per box, both driving the real client rather than the store directly:

| # | Text client (`clients/text/client.test.ts`) | MCP tool (`mcp/server.test.ts`) |
|---|---|---|
| 1 | `"1. listCampaigns — returns the real campaign, unresolved titleKey (no session yet)"` | `"list_campaigns — returns the real campaign summary"` |
| 2 | `"2. createSession — starts the Bureaucracy arc; text renders the real Municipality scene"` | `"start_game — args { campaignId, seed?, profileId? }, returns { sessionId, scene }"` |
| 3 | `"3. resumeSession — returns the current scene unchanged, no side effect"` | `"continue_game — returns the current scene unchanged, no side effect"` |
| 4 | `"4. getScene — matches what createSession returned for the same session"` | `"get_scene — matches what start_game returned for the same session"` |
| 5 | `"5. getView — value carries the real StoryGraphView; text is the opaque JSON rendering"` | `"get_state — returns the real StoryGraphView through PlayerView"` |
| 6 | `"6. getStrings — resolves the same table the store returns; a known key is present"` | `"get_strings — resolves LocKeys through the registry"` |
| 7 | `"7. submitAction — success renders the new scene; a gated choice renders unavailable with its real reason"` | `"choose — submitAction under the MCP name; carries the new Scene, never the envelope"` |
| 8 | `"8. previewAction — renders the prospective scene without changing the session"` | `"preview_action — returns the prospective scene without committing it"` |
| 9 | `"9. saveGame — produces a save id; text confirms it"` | `"save_game — narrows the store's SaveHandle to { saveId } only"` |
| 10 | `"10. loadGame — a fresh session from the save renders the same scene the save point was at"` | `"load_game — a fresh session from the save renders the same scene the save point was at"` |

The text-client suite numbers its `it` blocks 1–10 to match this table's rows directly; the MCP
suite's own top-level `describe` names itself after this section (`"McpTools — the API coverage
checklist (09-clients.md §4)"`). Neither test drives `SessionStore` directly — both go through
the real client, which is what this checklist requires.

**Simulation-kind evidence** (W50), same ten rows, `"sim.N."`-numbered `it` blocks in the same
two files, under `describe("… simulation kind (09-clients.md §4, W50)")`:

| # | Text client | MCP tool |
|---|---|---|
| 1 | `"sim.1. listCampaigns — includes the Stable Life campaign"` | `"sim.1. list_campaigns — includes the Stable Life campaign summary"` |
| 2 | `"sim.2. createSession — starts Stable Life; text renders the real status scene"` | `"sim.2. start_game — returns { sessionId, scene } for Stable Life"` |
| 3 | `"sim.3. resumeSession — returns the current scene unchanged, no side effect"` | `"sim.3. continue_game — returns the current scene unchanged, no side effect"` |
| 4 | `"sim.4. getScene — matches what createSession returned"` | `"sim.4. get_scene — matches what start_game returned for the same session"` |
| 5 | `"sim.5. getView — carries the real SimulationView; a declared field renders in the opaque JSON"` | `"sim.5. get_state — returns the real SimulationView through PlayerView"` |
| 6 | `"sim.6. getStrings — resolves the same table the store returns; the scene template key is present"` | `"sim.6. get_strings — resolves LocKeys through the registry"` |
| 7 | `"sim.7. submitAction — plan.add carries its declared actionType param through to the new scene"` | `"sim.7. choose — plan.add's declared actionType param reaches the kind through the MCP name"` |
| 8 | `"sim.8. previewAction — renders the prospective result without changing the session"` | `"sim.8. preview_action — returns the prospective result without committing it"` |
| 9 | `"sim.9. saveGame — produces a save id"` | `"sim.9. save_game — narrows the store's SaveHandle to { saveId } only"` |
| 10 | `"sim.10. loadGame — a fresh session from the save renders the same scene the save point was at"` | `"sim.10. load_game — a fresh session from the save renders the same scene the save point was at"` |

`campaigns/stable-life.client-parity.test.ts` additionally exercises 09 §1's own invariant —
same seed, same counting `IdSource`, played to the committed win through the text client and
through MCP independently — asserting identical `Scene`/`PlayerView` at every step, plus a
client-free replay of the identical action log reaching the identical, golden-filed
`serialize()` output on repeat.

**Browser-demo evidence** lives in `site/src/play/browser-client.test.ts`. Its ten numbered
`it` blocks drive the real browser adapter against Bureaucracy, one per operation; they do not
call the store directly from a component test. The same file then drives the full committed
path through that adapter and the text client with the same seed and counting `IdSource`,
asserting identical `Scene`/`PlayerView` steps and byte-identical final `serialize()` output.
How the demo presents save/load — a same-page checkpoint, or the locally durable one
`13-playable-web-demo.md` §5 now specifies — does not weaken the adapter proof either way.

**The mapping is one-to-one, and that is the point.** Every store operation has exactly one
MCP tool, and there is no tool that is not an operation. That is what *"no AI-specific path"*
(04 §13) means concretely — checkable by counting, not by reading intent.

> **An earlier draft of this section said "eight operations, and there is no ninth", and
> called a ninth row a defect. That was wrong**, and the localization hole proved it: a
> client had no way to resolve a `LocKey`, and the only correct fix was a ninth operation.
>
> The rule it was reaching for survives, restated properly: **a client never works around a
> missing operation.** If a client needs something the store does not offer, the answer is a
> new operation in 04 §7 *and* a new row here — never client-side logic. A row added here
> without one there is the signal that logic has leaked upward. It is the asymmetry that is
> the defect, not the count.

The checklist is satisfied when every box is ticked **and** §1's invariant test passes: the
same arc, same seed, same choices, through both clients, serializing identically.

---

## 5. Reason Codes and Messages

Clients never interpret a `ReasonCode`; they look up its string. The core ships default
English for every base code under the reserved `core.reason.*` namespace, and registry
construction rejects any attempt to override it (04 §12), so a client can rely on a message
existing for every code it may receive.

- **Display** the resolved `OutcomeMessage`/`ValidationError` message, looked up in the
  `StringTable` from `getStrings` (§2).
- **Do not branch** on a code to change game behaviour. Branching on it to choose an *icon*
  or a *colour* is presentation and is fine; branching on it to decide whether to resubmit is
  logic and is not.
- **An unknown code must render, not crash.** Codes are additive (04 §12), so a client will
  eventually meet one it was not built against. Fall back to the raw code — visibly ugly,
  never fatal.

---

## 6. Projection Is Not Optional

A client receives `PlayerView` (04 §9) and never `GameState`. It has no route to hidden
variables, `visitedCounts`, or the action log — the projection exists precisely so that
"the client cannot leak what the player should not see" is structural rather than a matter
of client discipline.

This is why §2's surface has no operation returning raw state — deliberately, and why
`submitAction` returns `SessionActionResult` rather than the engine's `ActionResult`, whose
success value *is* the envelope. A client that finds it needs raw state is asking the wrong
question.

---

## 7. MCP Is a Sibling, Not a Special Case

The full statement of this — the tool table and the "agent is a player" guarantee —
moved to
[`SubZeroDev.ServiceContract`](https://github.com/The-Running-Dev/SubZeroDev.ServiceContract)'s
[`mcp-tool-contract.md`](https://github.com/The-Running-Dev/SubZeroDev.ServiceContract/blob/main/mcp-tool-contract.md),
alongside `04-core.md` §13. Everything else in this document applies to the MCP server
unchanged: it is a client like the text client, a thin adapter over the same store,
holding no game logic (architecture §10).

---

## 8. The Text Client's Additional Job

The text client is the MVP's **proving instrument** (MVP §3), which gives it one obligation
no other client has: it must drive **every** operation in §4, because it is the thing that
demonstrates the API is complete.

A web client may reasonably use eight of the ten — one that autosaves on every action need
never call `saveGame` or `loadGame` explicitly. The text client using eight would mean two
operations ship unproven.

---

## 9. Deferred

- **Mobile and Discord clients** (MVP §4). They inherit this contract unchanged; the
  checklist gains a column each. The first web client is no longer deferred: its deliberately
  narrow public-demo shape is [`13-playable-web-demo.md`](13-playable-web-demo.md).
- **Client-side localization beyond string lookup.** The MVP ships English only (04 §10.1);
  pluralization and locale-aware formatting are a client concern to specify when a second
  locale exists.
- **Streaming or partial scene delivery.** The store returns whole `Scene`s. Worth revisiting
  only if a client proves a whole scene is too much, which no MVP client does.
