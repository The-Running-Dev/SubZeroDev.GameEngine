# W17 — MCP Server

**Unit:** [`docs/docs/engine/TODO.md`](../docs/docs/engine/TODO.md) — W17

**Scope:** The same operations as tools — a sibling adapter, no AI-specific path.

**Depends on:** W7 (session store), W12 (scene/actions/projection) — both done. Sibling to
W16 (text client) — same store, same scope reasoning, no code shared between them beyond
the store itself.

## What This Unit Actually Builds

04 §13 fixes the tool table exactly: nine tools, one per `SessionStore` operation, typed
args/results, no AI-specific path. `09-clients.md` §7 restates it: "the MCP server is a
client like the text client — a thin adapter over the same store, holding no game logic."

### Not adopting `SubZeroDev.Blog`'s `tools/blog-mcp`

Asked to look at it for reference. It's a real, production stdio/HTTP MCP server —
`@modelcontextprotocol/sdk`'s `McpServer`, `zod` input schemas, Express/Hono transports,
its own `package.json`, its own `node_modules`. Useful as a *pattern* (tools grouped by
capability, registered against a real `McpServer`), but not adoptable here as-is: this
repo's `src/engine/` package has an explicit, stated **zero-runtime-dependencies** rule
(`TODO.md`'s dev-dependency-advisories note: "the package has no runtime dependencies, so
nothing ships with them"; `engine.ts`'s own comment cites it as the reason it hand-rolls a
structural check rather than pulling in a schema library). Adding the real SDK would
break that invariant for the whole engine package over one unit.

**W17 stays adapter-only** — the same scoping call W16 already made for the interactive
CLI it didn't build, for the identical reason: nothing in 04 §13, 09 §7, or W17's own
done-when *requires* a running stdio/HTTP server. "Every tool matches its documented args
and results," "an agent completes the arc," and "an agent sees no more than a human client
does" are all provable by an automated test calling the tool functions directly — exactly
how `client.test.ts` proved `TextClient` without an interactive terminal.

A real transport-level MCP server (mirroring `blog-mcp`'s shape: `@modelcontextprotocol/sdk`,
its own `package.json`, a real stdio/HTTP transport) is the natural post-MVP follow-up once
an MVP needs a literal running agent-facing process — not this unit's job. Its home is
[SubZeroDev.Platform](https://github.com/The-Running-Dev/SubZeroDev.Platform), the deferred
hosting layer (MVP §4), not a new repo — a live network-facing server is a hosting concern,
the same way `05-observability.md` §13 already places the OpenTelemetry exporter there.
`McpTools` is designed to be that future server's entire tool-layer implementation; Platform
would wrap it in a transport, not reimplement it. Recorded as a deferred item in
[`OPEN-QUESTIONS.md`](../docs/docs/engine/OPEN-QUESTIONS.md) §2 rather than left implicit.

## Decisions

### 1. `McpTools` is a plain object of nine handlers, not a class

Unlike `TextClient` (W16), there's no rendering step: an MCP tool's whole job is to
return the platform's own typed data for an agent to consume directly, not a human-legible
string. 04 §13's table names each tool's `Returns` column as a bare platform type —
`CampaignSummary[]`, `Scene`, `PlayerView`, `StringTable`, `SessionActionResult` — so
`mcp/server.ts` is a thin `Record<string, handler>`-shaped set of functions, each named
for its literal tool identifier (`list_campaigns`, `start_game`, …), delegating straight
to `SessionStore` with no intermediate render module. The snake_case names are the actual
wire-level tool identifiers 04 §13 assigns, not a TypeScript style choice — reshaping them
to camelCase in the object literal would leave the object's own keys disagreeing with the
tool table they're supposed to mirror one-to-one.

### 2. Two tools reshape their store result; the other seven pass through verbatim

`start_game` and `load_game` return `{ sessionId, scene }`, which is exactly
`SessionHandle`'s own shape — pure passthrough. `save_game` is the one real reshape: the
table's `Returns` column is `{ saveId }`, narrower than the store's own `SaveHandle`
(`{ saveId, savedAtSeq }`). Read literally rather than assumed to be documentation
shorthand, since "every tool matches its documented args and results" is the done
criterion, not "every tool matches its documented args and results, approximately."

### 3. The byte-identical proof compares client-observable output, the same way `store.test.ts` already does

09 §1's assertion is "byte-identical `serialize()` output," but `SessionStore` never
exposes `serialize()` to a caller (09 §6 — projection is not optional) — neither client
*can* ask for it, on purpose. `session/store.test.ts`'s own "a loaded profile's content
never affects resolution" test already resolved this exact tension by comparing
`JSON.stringify(scene)` across two independently driven runs sharing a fixed `IdSource`
and seed, rather than reaching past the store for a raw blob. W17's proof follows the same
precedent, widened to every step of the arc (not just the final one): drive the identical
action sequence through `TextClient` and through `McpTools`, each backed by its own
`createInMemorySessionStore` over an engine built with the same fixed (non-random)
`IdSource` and the same explicit seed, and assert the full sequence of `scene`/`view`
snapshots is deep-equal between the two runs at every turn. `scene`/`view` are pure
projections of `GameState` (04 §9), so an identical sequence of them is exactly the
evidence "the same seed and choices produce the same envelope" — the same fixed-`IdSource`
methodology 06 §5.1 and `engine.test.ts`'s own observability tests already establish, just
aimed at two clients instead of two emitters.

### 4. The client-boundary eslint rule extends to `src/mcp/**` too

The rule W16 added (`src/clients/**/*.ts` may not import `kinds/**`) is really "a client
may not import a kind" — the MCP server is a client (09 §7's whole point). Extended to
`src/mcp/**/*.ts` with the identical shape and the same test exemption.

## Design

### New files

| File | Contents |
|---|---|
| `mcp/server.ts` **(new)** | `McpTools` interface + `createMcpTools(store)` — nine handlers, 04 §13's table verbatim. |
| `mcp/server.test.ts` **(new)** | Coverage checklist (one group per tool), the full-arc playthrough, the hidden-choice parity proof, and the cross-client byte-identical-output proof against `TextClient`. |

### Test Plan

Against 04 §13, 09 §4/§7, and TODO's W17 done-when, directly:

- [ ] Every tool's args/return shape matches the table, driven against the real
      Bureaucracy campaign (not a synthetic fixture) — `list_campaigns`, `start_game`,
      `continue_game`, `get_scene`, `get_state`, `get_strings`, `choose`, `save_game`
      (narrowed to `{ saveId }`), `load_game`.
- [ ] The MCP column of the coverage checklist is complete — nine tools, one-to-one onto
      the nine store operations, no tool that is not one.
- [ ] An agent completes the arc end to end through `choose` alone: `wait`,
      `continue_cycle` ×2, `go_home`, reaching `ultimate_reward` and unlocking
      `it_builds_character`.
- [ ] `choose` against a `showWhen`-hidden action id returns `unknown_action` —
      indistinguishable from a nonexistent id, the same as `TextClient`'s own proof; an
      agent sees no more than a human client does.
- [ ] The same seed, campaign, and action sequence, driven once through `TextClient` and
      once through `McpTools` under matching fixed `IdSource`s, produce a deep-equal
      sequence of `scene`/`view` snapshots at every turn — the client contract's proof
      (09 §1), widened from W16's single-client coverage to both.

### Explicit Non-Goals

- No real MCP transport (stdio/HTTP), no `@modelcontextprotocol/sdk` dependency — see
  "What This Unit Actually Builds" above.
- No changes to `SessionStore`, the engine, or any kind.
- No changes to `TextClient` beyond what's needed to reuse it as the other half of the
  cross-client proof (expected: none).
