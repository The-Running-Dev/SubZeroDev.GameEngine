# W49 — World-Graph Validation, Scenario and Replay Guard

**Scope:** finish the engine-owned world-graph hardening boundary after W45–W48. This is
not Sun Trap content authoring or a hosted release; it establishes the canonical engine
fixture and the evidence a companion can consume.

## Acceptance inventory

| Contract concern | Evidence to add or verify |
|---|---|
| Tier 1 source validation | malformed content, unknown references, unsafe ranges/caps and impossible starts reject without throwing |
| Tier 2 semantics | disconnected/inert scenarios warn without blocking valid loading |
| Canonical fixture | one engine-owned `world-graph-mvp` campaign with a deterministic win and loss path |
| Replay guard | committed fixture/outcome JSON pairs, run by the cross-version replay corpus |
| Session parity | batch partition, save/load and preview leave canonical state/replay inputs unchanged |
| Consumer boundary | packed-tarball smoke imports the world-graph public entry points |

## Non-goals

- Sun Trap’s authored production maps, balance, or client UI.
- A package tag or publication: release version selection and package publication are an
  external release action after this PR is accepted.
- Updating the companion Platform MCP contract; that separately tracked mirror remains in
  `OPEN-QUESTIONS.md`.
