---
sidebar_label: Playable Web Demo
---

<!-- Generated from design/10-design.md by build/ConvertTo-HumanDocumentation.ps1. Do not edit directly. -->

# Playable Web Demo — Browser Client and Static Delivery

**Document status:** Revision 2 — W61 shipped as Revision 1. §4's checksum mechanism and
bundle gate and §5's checkpoint lifetime are restated against what was built; §§1–3 and §§6–11
are unchanged except where they cited §5's same-page limit.

**Reading order:** after [`09-clients.md`](09-clients.md). That document owns what every
client may do; this one owns the first public browser client's product boundary, composition,
and delivery.

> **Scope of this document**
>
> A publicly shareable, browser-playable proof at `/play/`. It turns the already-complete
> Bureaucracy MVP into something a visitor can play without cloning the repository, while
> preserving the rule that clients present state and never calculate game results.
>
> This is an **engine demo**, not the claim that Life in the Fast Lane or Sun Trap is a
> finished game. The distinction remains visible in the page copy.

---

## 1. Outcome and Boundary

The first public demo is one complete vertical path:

> A visitor opens `/play/`, starts the Bulgaria Bureaucracy campaign, sees the current scene
> and every shown choice, reaches an ending, sees the achievement and final state, and can
> start again — with no install, account, backend, or game logic in React.

The Bureaucracy arc is the deliberate first campaign. It is the MVP fixture, already proves
gated choices, a loop, seeded randomness, an achievement, save/load, and an ending, and has
the strongest replay and client-parity evidence in the repository. Shipping five campaign
pickers or a world-graph inspector before this one path is usable would widen presentation
without proving another engine boundary.

The page demonstrates the engine's existing capabilities. It does not add mechanics, change
campaign outcomes, rewrite authored strings, or introduce a web-specific game path.

## 2. Player Flow

The route has five visible states:

1. **Ready** — campaign title, a short accurate explanation, and one `Start` action.
2. **Playing** — scene body, actions, visible state, achievements, and checkpoint controls.
3. **Previewing** — an explicitly labelled prospective result from `previewAction`; nothing
   is committed until the visitor chooses the original action.
4. **Ended** — ending text, outcome messages, achievements, and `Play again`.
5. **Failed** — a recoverable message and retry/restart where possible; an unsupported-browser
   failure is named before a session starts.

Shown-but-unavailable choices remain visible and disabled with their engine-supplied reason.
A `showWhen`-hidden choice is absent and the page never tries to discover it. Once a session
exists, all campaign, scene, action, reason, achievement, and outcome text resolves through its
string table. Before `Start`, the site composition root resolves the one configured campaign's
title from its validated registry into the demo's frozen startup configuration; it passes a
plain string, never a `LocKey`, to the page. `Start` remains the only operation that creates a
session. A raw `LocKey` is a visible defect, not a fallback presentation.

The state panel is a projection, not a debug dump. It may render fields already present in
`PlayerView` with human labels, but it never requests or displays `GameState`, the seed,
action log, hidden variables, or opaque kind state.

## 3. Composition and Dependency Direction

The browser demo has two layers with different permissions:

```mermaid
flowchart TD
    Page["React page at /play/"] --> Adapter["Browser client adapter"]
    Adapter --> Store["SessionStore interface"]
    Root["Site composition root"] --> Store
    Root --> Registry["Validated Bureaucracy registry"]
    Root --> Engine["Engine + story-graph kind"]
    Store --> Engine
    Engine --> Registry
```

- **The site composition root** may assemble the engine, kind, validated campaign registry,
  host defaults, and session store. It also creates one frozen `BrowserDemoConfig` containing
  the selected public `campaignId` and its already-resolved ready title. It imports supported
  engine entry-point symbols rather than private modules.
- **The browser client adapter and React components** receive `SessionStore` as their only
  game-facing dependency, plus that declarative startup configuration. They do not import the
  engine, a kind, a campaign, validation, projection, or persistence helpers. The adapter uses
  the configured id only to form `CreateSessionConfig` when the visitor selects `Start`; it
  never reads or resolves registry content itself.
- **Components render adapter DTOs.** They do not grow a parallel interpretation of
  `ReasonCode`, `Condition`, or action parameters.

The committed campaign builders become supported package exports because the composition root
needs content to construct the demo without a deep import. That exposes existing content; it
does not move content into the client. As the shelf grew past Bureaucracy the export set grew
with it, and the rule that keeps it principled is **a builder, never its internals**: the
package root exports `build<Campaign>Campaign` and its id constant, and nothing that would let
a caller assemble or mutate a campaign's nodes.

`TextClient` is exported for the same composition reason and one further one: 09 §1 makes the
client rule testable as *two clients, same inputs, byte-identical `serialize()`*, and the
browser parity test cannot instantiate the other client without it. A client in the engine's
public surface is a mild oddity — it is presentation, and 02 §1 puts presentation above
everything — but the alternative is a parity proof that reaches into `src/clients/` by path,
which is the deep import this section exists to forbid.

## 4. Browser Portability Is an Engine Property

The package describes itself as platform-independent, but its current public runtime graph
contains Node-only boundaries: package-version discovery reads `node:fs`, save checksums use
`node:crypto`, and the observability guard reads an unprotected `process.env`. The CLI hides
that mismatch because it runs in Node.js; a real browser bundle exposes it.

W61 closes the mismatch at the shared implementation rather than creating a reduced browser
fork:

- The **same public entry point** used by Node.js is bundleable for a standards-based browser.
- Its production runtime graph contains no `node:` import and no unguarded Node.js global.
- `ENGINE_VERSION` remains owned by package metadata and is made available without runtime
  filesystem I/O; it is not duplicated by hand in site code.
- Save-envelope checksums remain SHA-256 over the exact canonical bytes §10.2 specifies. The
  envelope, hex digest, `Engine.serialize`, and pure `advance` path are unchanged.
- Do not add a second checksum algorithm or a browser-only save format.

**`computeChecksum` stays synchronous, over a portable SHA-256 dependency.** Web Crypto was
the obvious candidate and was not taken: `crypto.subtle.digest` is async, and making it reach
`saveGame`/`loadGame` means async-ifying `computeChecksum`, `buildSaveEnvelope`, and every
caller and test between them — a refactor of the envelope path to obtain a hash the engine can
already compute. A small, audited, dependency-free SHA-256 library (`@noble/hashes`) produces
the identical digest over the identical bytes and runs unchanged in both runtimes.

The cost is real and is the reason this is recorded rather than assumed: **the engine package
now has a runtime dependency**, where it previously had none, and it hashes with library code
rather than the platform primitive. Both are reversible — the digest is the contract, not how
it is produced — and the trigger for reversing them is a synchronous checksum becoming
unnecessary, not a preference for the standard.

Support is capability-based: ES2022 modules, `crypto.randomUUID`, and `TextEncoder`. The
static page detects a missing required capability before composition and renders an actionable
unsupported-browser message instead of failing during play.

A browser production-bundle smoke test is the gate, and it is an **assertion over the emitted
bundle**, not the build succeeding. The site's build verification scans the produced assets for
`node:` specifiers and Node-only globals and fails on a hit. "The bundler would have
complained" is the same class of claim as "typechecking DOM declarations proves portability" —
it may be true today, and it is not a gate. The site now depends on the engine by path, so a
future engine change can reintroduce a Node-only import with nothing else watching.

## 5. Checkpoints and Lifetime

W61 exposes the existing `saveGame` and `loadGame` operations as **checkpoints**. They
demonstrate the save envelope and let a visitor explore a branch and return without restarting.

**Revision 2.** Revision 1 made them same-page only, and gave three reasons: the session store
was in-memory, the client contract forbids a client persisting authoritative state, and no
browser storage port existed. The third is no longer true — 06 §5.2 draws the seam at
`SessionPersistence` (04 §7.2) — and the first two never argued against durability, only
against React reaching for `localStorage` behind the store's back.

So the line moves, and it moves without weakening either rule that produced it:

- **The client still persists nothing.** React holds a `SessionStore` and calls
  `saveGame`/`loadGame`. It does not see a blob, a save envelope, or a storage key.
- **The site composition root supplies a `SessionPersistence` adapter over `localStorage`.**
  That is host composition, above the client boundary and squarely inside 06 §2's rule: an
  adapter that stores and returns the exact bytes the store gave it cannot change
  `serialize()` output.
- **A save is addressed by its `saveId`** (04 §7.2). An adapter keyed on anything else — the
  campaign id, say — writes successfully and reads nothing back.
- **Storage is best-effort and the page says so honestly.** A quota error, a disabled store, or
  a private-browsing restriction surfaces as `storage_failure` (04 §7.2), rendered through the
  string table, and the run continues in memory. "Saved" is claimed only after a write the
  adapter confirmed.
- **What durability means here is one local checkpoint per campaign, in one browser.** Reopening
  `/play/` offers to resume it. Nothing syncs, nothing is shared between devices, and clearing
  site data clears it.

Accounts, cloud sync, cross-device resume, and server-held sessions remain in the deferred
hosting layer, unchanged.

## 6. Route, Visual System, and Delivery

`/play/` is a real static route with its own `play/index.html`, entry module, title,
description, canonical URL, and social metadata. GitHub Pages has no SPA fallback; a route
that works only after visiting `/` is not shipped.

The page joins the existing standalone site rather than Docusaurus:

- reuse the shared `SiteHeader`, `SiteFooter`, colors, type, focus treatment, and content
  measure;
- add `Play` to the public-site header and a clear landing-page call to action;
- keep the game surface quieter than the narrative landing page — one scene, one action list,
  one optional state panel;
- use CSS decoration only. Campaign art, animation, audio, and a new design system are not
  prerequisites for proving play;
- extend the existing multi-page build and protected merge so `/`, `/roadmap/`, `/play/`,
  and `/docs/` coexist in one artifact.

The static deployment performs no runtime network request. Engine code and Bureaucracy content
are bundled at build time. A network outage after the page loads cannot change an outcome.

## 7. Client Proof and Tests

The browser column added to `09-clients.md` §4 is complete only when all ten operations,
including `previewAction`, are driven through the real browser adapter in automated tests. The
visible `previewAction` control is optional engine-demonstration UI; its adapter coverage is
not optional. `saveGame`/`loadGame` power the checkpoint §5 specifies, and their adapter
coverage is asserted against the store, not against whether a given browser's storage is
writable — a run with `SessionPersistence` omitted must satisfy the same ten rows.

The load-bearing parity test uses the Bureaucracy campaign, the same seed, the same counting
`IdSource`, and the same committed choices through the browser adapter and text client. At
each step their `Scene` and `PlayerView` agree, and the final `serialize()` output is
byte-identical. Normalizing away `gameId` or hidden fields is not permitted.

Additional acceptance:

- a production browser bundle contains no Node.js built-in or unresolved Node global;
- a direct static request to `/play/` succeeds and the combined deployment artifact retains
  `/docs/` unchanged;
- the full Bureaucracy loop, gated choice, random transition, ending, achievement, preview,
  checkpoint and restore each have a named test;
- no player-facing raw localization key renders in ready, playing, rejected, or ended states;
- the existing text client, MCP, replay corpus, save-envelope fixtures, and canonical
  serialization remain byte-identical.

## 8. Accessibility and Responsive Behaviour

- One H1; scene titles and panels follow a coherent heading hierarchy.
- Every action is a native button. Disabled choices remain keyboard-discoverable through
  adjacent reason text rather than relying on a tooltip.
- Submission results and scene changes are announced through a restrained live region;
  focus moves to the new scene heading after a committed action and nowhere after a preview.
- Status, availability, success, and failure never rely on colour alone.
- The action list and state panel have no horizontal overflow at 320 px, 390 px, 768 px, and
  1280 px. Long authored text and localization keys wrap safely.
- Loading and submission prevent duplicate input without automatically retrying an action.
- Reduced motion is complete and immediate; no animation is required to understand a state
  change.

## 9. Failure Behaviour

- Registry or campaign build failure prevents the demo from starting and renders one
  non-player-data error boundary. It does not silently remove invalid content.
- A rejected action displays the localized engine message and leaves the current scene
  authoritative.
- A sink failure remains invisible to play, exactly as the engine contract requires.
- An unexpected adapter exception preserves a restart path and may log technical detail to
  the browser console; it never renders raw save data or hidden state.
- Deployment failure leaves the existing landing page, roadmap, and documentation artifact
  unchanged; the protected merge remains the release boundary.

## 10. Explicit Non-Goals

- The other four Bulgaria arcs, Stable Life, or the world-graph MVP in the first public route.
- Durable browser storage, accounts, profiles across reloads, cloud sync, or a backend.
- New mechanics, campaign rewrites, balance changes, or a connected five-arc metagame.
- Visual-novel art, bespoke illustration, audio, animation, or controller support.
- Analytics, telemetry, session capture, cookies, or user identity.
- Offline installation, a service worker, or a progressive web app.
- A generic embeddable web-client package. W61 builds one honest client against the existing
  contract; reuse is earned only after a second consumer exists.

## 11. Decision Summary

| Decision | Choice |
|---|---|
| First public campaign | Bulgaria Bureaucracy only |
| Route | Real static `/play/` entry in the existing React site |
| Authority | `SessionStore`; React receives projections only |
| Runtime | Engine executes locally in the browser; no backend |
| Browser compatibility | One shared public engine surface, no Node.js fork |
| Saves | One local checkpoint per campaign, via a host `SessionPersistence` adapter (Rev. 2) |
| Storage failure | Best-effort: `storage_failure` surfaces, the run continues in memory |
| Checksums | Synchronous SHA-256 over a portable library, not async Web Crypto |
| Demonstration feature | Explicit non-committing action preview |
| Styling | Existing site system, responsive and keyboard-first |
| Delivery | Existing GitHub Pages artifact beside `/`, `/roadmap/`, and `/docs/` |
| Expansion | Cloud sync, accounts, and cross-device resume require later slices |
