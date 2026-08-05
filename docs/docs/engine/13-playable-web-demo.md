---
sidebar_label: Playable Web Demo
---

<!-- Generated from design/10-design.md by build/ConvertTo-HumanDocumentation.ps1. Do not edit directly. -->

# Playable Web Demo — Browser Client and Static Delivery

**Document status:** Revision 1 — agreed W61 build target

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
A `showWhen`-hidden choice is absent and the page never tries to discover it. All campaign,
scene, action, reason, achievement, and outcome text resolves through the session's string
table. A raw `LocKey` is a visible defect, not a fallback presentation.

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
  host defaults, and session store. It imports supported engine entry-point symbols rather
  than private modules.
- **The browser client adapter and React components** receive only `SessionStore`. They do
  not import the engine, a kind, a campaign, validation, projection, or persistence helpers.
- **Components render adapter DTOs.** They do not grow a parallel interpretation of
  `ReasonCode`, `Condition`, or action parameters.

The committed Bureaucracy campaign builder becomes a supported package export because the
composition root needs content to construct the demo without a deep import. That exposes
existing content; it does not move content into the client.

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
- Save-envelope checksums remain SHA-256 over the exact canonical bytes §10.2 specifies.
  Browser support may make checksum calculation asynchronous inside `saveGame`/`loadGame` —
  both store operations are already promises — but it must not change the envelope, hex
  digest, `Engine.serialize`, or pure `advance` path.
- Use platform standards available in both Node.js 24 and supported browsers. Do not add a
  second checksum algorithm or a browser-only save format.

Support is capability-based: ES2022 modules, `crypto.randomUUID`, `TextEncoder`, and Web
Crypto SHA-256. The static page detects a missing required capability before composition and
renders an actionable unsupported-browser message instead of failing during play.

A browser production-bundle smoke test is the gate. Merely typechecking DOM declarations in
Node.js does not prove that no Node-only module reached the bundle.

## 5. Checkpoints and Lifetime

W61 exposes the existing `saveGame` and `loadGame` operations as **same-page checkpoints**.
They demonstrate the save envelope and let a visitor explore a branch and return without
restarting.

They are deliberately not durable across a page reload. The current session store is
in-memory, the client contract forbids a client from persisting authoritative game state,
and no browser storage port exists. React must not write a raw state or save envelope into
`localStorage` to make the demo appear more complete than the architecture is.

The page states this plainly near the checkpoint controls: refreshing starts a new demo.
Durable local saves require a host-owned persistence adapter or a new store port and therefore
their own contract and slice. Accounts, cloud sync, and cross-device resume remain in the
deferred hosting layer.

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

The browser column added to `09-clients.md` §4 is complete only when all ten operations are
driven through the real browser adapter in automated tests. `previewAction` is exposed as an
optional engine-demonstration control; `saveGame`/`loadGame` power the same-page checkpoint.

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
| Saves | Same-page checkpoints; refresh intentionally resets |
| Demonstration feature | Explicit non-committing action preview |
| Styling | Existing site system, responsive and keyboard-first |
| Delivery | Existing GitHub Pages artifact beside `/`, `/roadmap/`, and `/docs/` |
| Expansion | More campaigns and durable persistence require later slices |
