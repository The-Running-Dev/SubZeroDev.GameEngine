# W16 — Text Client

**Unit:** [`docs/docs/engine/TODO.md`](../docs/docs/engine/TODO.md) — W16

**Scope:** The plain proving instrument, over `SessionStore` only.

**Depends on:** W7 (session store), W12 (scene/actions/projection) — both done.

## What This Unit Actually Builds

`09-clients.md` §2 fixes the surface: nine `SessionStore` operations, and nothing else.
§4's coverage checklist is the done-criterion, verified by an automated test driving the
real client, one row per operation, not by inspection.

The ancestor spec (`games/05-text-client.md`, companion `SubZeroDev.GameOfLife` repo)
describes a full interactive stdin/stdout REPL with a command grammar, because Life in the
Fast Lane's engine has ~17 methods across action-planning, event response, and weekly
resolution. Story-graph's client surface is the fixed nine-operation `SessionStore`
table — there is no action-planning, no event queue, no weekly loop to parse a grammar
for. **This unit scopes to what W16's own done-criteria actually ask for: a `TextClient`
that mirrors the nine operations 1:1 and renders each result as text, proven by automated
tests.** An interactive terminal binary is not named anywhere in W16's done-when, 09
§§1–7, or `MVP.md` §5's Definition of Done — every one of those is satisfied by a client
object driven programmatically. Building a stdin/stdout loop on top would be scope not
asked for: untestable I/O plumbing wrapped around logic that's already fully proven.

## Decisions

### 1. Split rendering (pure) from the client (store-calling)

`clients/text/render.ts` — pure functions, `(data, strings) → string`, no I/O, no store
access. This is where every contract rule in 09 §3/§5 actually lives:

- **`resolveOrFallback(strings, key)`** returns the raw key when it's not in the table,
  never throws. This *is* "an unknown reason code renders rather than crashing" (09 §5) —
  every other render function routes every `LocKey` through it, so the guarantee holds in
  one place rather than being re-proven per call site.
- Every player-facing string — scene text, action labels, gated-action reasons, error
  messages, outcome messages — resolves through `resolveOrFallback` against the registry's
  own string table. None is ever a literal English fallback baked into the client, which is
  what makes "requirement failures render from reason codes, never matched English" (TODO's
  own words) a structural property of `render.ts` rather than a claim about it.

`clients/text/client.ts` — `TextClient`, one method per `SessionStore` operation (09 §2's
table, in the same order), each calling the store then handing the result to `render.ts`.
Returns `{ value, text }`: `value` is the operation's own return type (so a test can assert
on real data — an achievement id, an `office_visits` count), `text` is what a human would
see. Never both, never a third shape — the ancestor's `stdin → Parser → Engine → Renderer →
stdout` split, minus the parser this engine's action model doesn't need.

### 2. `getView`'s `kindView` renders opaque, on purpose

`PlayerView.kindView` is `unknown` to the core by design (04 §9) — a kind-narrowed
projection the core never inspects. A generic client that has never seen `StoryGraphView`
(03 §9) cannot destructure it without importing `kinds/story-graph`, which the done-criterion
explicitly forbids ("it imports nothing from `kinds/`"). `renderView` therefore
`JSON.stringify`s `kindView` verbatim — boring, exactly as the ancestor spec asks for
("the client should be boring; interesting clients hide engine problems") — rather than
reaching past the projection boundary to render it nicely. A kind-specific client is
free to do better; the proving instrument is not that client.

### 3. `listCampaigns`'s `titleKey` renders unresolved — an honest API gap, not papered over

`getStrings` takes a `sessionId` (09 §2) — there is no operation that resolves a `LocKey`
before a session exists. `listCampaigns()` is the one query callable pre-session, so its
`CampaignSummary.titleKey` genuinely cannot be resolved by a compliant client at that point.
`renderCampaignList` reflects that truthfully: it prints the raw `titleKey`, the same
fallback `resolveOrFallback` would produce against an empty table, rather than fabricating a
lookup that doesn't exist. Not a defect this unit introduces or fixes — a client "never
works around a missing operation" (09 §4) by inventing client-side resolution.

### 4. No interactive binary — see "What This Unit Actually Builds," Decision made there.

### 5. Tests build a real store against the real W15 campaign, not synthetic fixtures

`client.test.ts` drives `TextClient` over `createInMemorySessionStore` (W7) wired to the
real Bureaucracy campaign (`campaigns/bulgaria-bureaucracy.ts`, W15) and a real
`Kind<StoryGraphKindState>` — the same integration-test shape every prior kind/campaign
test in this repo already uses, rather than a second synthetic campaign invented for this
unit alone. The fixed seed `"bureaucracy-seed-3"` (W15's own scan) reproduces the
`room_14`/`room_6` loop, letting one test both drive `submitAction` for real and prove the
gated `go_home` choice renders unavailable-with-reason before `office_visits >= 3`.

## Design

### New files

| File | Contents |
|---|---|
| `clients/text/render.ts` **(new)** | Pure rendering: `resolveOrFallback`, `renderScene`, `renderView`, `renderCampaignList`, `renderActionResult`, `renderMessages`, `renderChanges`, `renderErrors`, `renderWarnings`, `renderSaveHandle`. |
| `clients/text/client.ts` **(new)** | `TextClient` — nine methods, one per `SessionStore` operation. |
| `clients/text/client.test.ts` **(new)** | The API coverage checklist, one test group per operation, plus the gated-choice and unknown-code fallback proofs. |

### Enforcing the import boundary structurally

`eslint.config.js` already anticipated `src/clients/*` and `src/mcp/*` in its core-boundary
rule (`core` must not import either) but never closed the other direction — nothing stopped
a client from importing a kind. Adding a symmetric rule (`src/clients/**/*.ts`, non-test,
may not import `**/kinds/**`) turns "imports nothing from `kinds/`" from a done-criterion
someone has to remember to check into something CI enforces on every commit, the same
"lint rule instead of a one-time scan" reasoning the existing core-boundary rule's own
comment states. Fixed the existing patterns from `**/clients/*`/`**/mcp/*` to
`**/clients/**`/`**/mcp/**` while touching this file — the single-`*` glob doesn't match a
nested import path like `../clients/text/client.js`, which is exactly the shape this unit
introduces.

### Test Plan

Against 09 §4's checklist and TODO's W16 done-when, directly:

- [ ] `listCampaigns` — returns the real campaign summary; text shows the raw `titleKey`
      (Decision 3), not a crash and not a fabricated resolution.
- [ ] `createSession` — starts the Bureaucracy arc; text renders the Municipality scene's
      real text and all four choices.
- [ ] `getScene` — matches what `createSession` returned for the same session.
- [ ] `getView` — text contains the JSON-rendered (opaque) `kindView` (Decision 2); `value`
      still carries the real `StoryGraphView` shape for the test's own assertions.
- [ ] `getStrings` — resolves the same table the store returns; a known key is present.
- [ ] `submitAction` — success path renders the new scene; the `go_home` choice renders
      `unavailable` with its authored `requirementFailKey` text before `office_visits >= 3`
      (requirement failures render from reason codes, never matched English); an unknown
      action id renders `core.reason.unknown_action`'s real resolved text, not a client
      literal.
- [ ] `resolveOrFallback`/`renderErrors`, tested directly against a synthetic unregistered
      key — an unknown code renders the raw code, never throws (09 §5).
- [ ] `saveGame` — produces a save id; text confirms it.
- [ ] `loadGame` — a fresh session from the save renders the same scene the save point was
      at.
- [ ] `resumeSession` — returns/renders the current scene unchanged, no side effect.

### Explicit Non-Goals

- No interactive stdin/stdout binary (Decision 4 / "What This Unit Actually Builds").
- No MCP server — that's W17, a sibling adapter over the identical `SessionStore`, not
  built from this unit's code.
- No changes to `SessionStore`, the engine, or any kind — this unit is a new consumer of
  an already-complete surface.
