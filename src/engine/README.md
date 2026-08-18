# Game Engine (Implementation)

The code for the deterministic narrative game engine. The design lives in
[`../../docs/docs/engine/`](../../docs/docs/engine/02-architecture.md); this is the build.

**Status:** Three kinds implemented and tested — `story-graph`, `simulation`, and
`world-graph` — with a published package, a playable public casebook at `/play/`, and a
Bulgarian content pack proving a campaign can reskin without an engine change. Full,
unit-by-unit state: [`docs/docs/engine/TODO.md`](../../docs/docs/engine/TODO.md).

## Layout

```
src/
  core/            the shared, game-agnostic layer, used by every kind
    determinism/        seeded PRNG (PCG32), serializable state, named substreams
    persistence/         canonical (byte-stable) serialization
    session/, registry/, validation/, projection/, replay/, observability/,
    composition/, condition/, localization/    session store, registry, validation,
                                                projection, replay oracle, event sinks,
                                                composition roots, condition tree, i18n
  kinds/                game-logic modules: story-graph, simulation, world-graph
  clients/              text client
  mcp/                  MCP server
  campaigns/            Bulgaria: Make-Your-Own-Adventure content, built against story-graph
  portable/             the portable save/campaign format (non-contract spike exports)
  authoring.ts           the public authoring seam consumers build campaigns against
```

Structure mirrors the architecture's dependency layering
([`../../docs/docs/engine/02-architecture.md`](../../docs/docs/engine/02-architecture.md) §1):
clients → kinds → core. The core never imports a kind or client.

## Determinism Is Enforced, Not Hoped For

The whole engine must replay byte-for-byte from a seed and inputs
([`MVP.md`](../../docs/docs/engine/MVP.md)). Two mechanisms hold the line:

- **Seeded RNG only.** `src/core/determinism/pcg32.ts` is the sole source of randomness.
  It is verified bit-identical to the reference PCG32 (seed 42, 54 →
  `a15c02b7 7b47f409 ba1d3330 83d2f293 bfa4784b cbed606e`).
- **Canonical serialization.** `src/core/persistence/canonical.ts` sorts object keys
  and rejects non-finite numbers, so the same state always serializes to the same bytes.
- **A lint guard.** `eslint.config.js` bans `Math.random`, `Math.pow/exp/log/sin/cos/tan`,
  and `Date.now` in `src/` — the APIs that are non-deterministic or not bit-stable across
  JS runtimes.

## Running

```bash
npm install
npm test        # vitest
npm run lint    # determinism guard + typescript-eslint
npm run typecheck
```

All three run in CI on every push and pull request (the `engine` job).
