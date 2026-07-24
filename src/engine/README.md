# narrative-engine (implementation)

The code for the deterministic narrative game engine. The design lives in
[`../../docs/docs/engine/`](../../docs/docs/engine/02-architecture.md); this is the build.

**Status:** Phase 1 in progress — the deterministic core. No game is playable yet.

## Layout

```
src/
  core/            the shared, game-agnostic layer, used by every kind
    rng/                seeded PRNG (PCG32), serializable state, named substreams
    serialize/          canonical (byte-stable) serialization
    ...                 (session store, projection, registry, validation — pending)
  kinds/                game-logic modules (story-graph, simulation — pending)
  clients/              text client (pending)
  mcp/                  MCP server (pending)
```

Structure mirrors the architecture's dependency layering
([`../../docs/docs/engine/02-architecture.md`](../../docs/docs/engine/02-architecture.md) §1):
clients → kinds → core. The core never imports a kind or client.

## Determinism is enforced, not hoped for

The whole engine must replay byte-for-byte from a seed and inputs
([`MVP.md`](../../docs/docs/engine/MVP.md)). Two mechanisms hold the line:

- **Seeded RNG only.** `src/core/rng/pcg32.ts` is the sole source of randomness.
  It is verified bit-identical to the reference PCG32 (seed 42, 54 →
  `a15c02b7 7b47f409 ba1d3330 83d2f293 bfa4784b cbed606e`).
- **Canonical serialization.** `src/core/serialize/canonical.ts` sorts object keys
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

> The core logic was verified by running it directly in Node during development
> (all invariants pass, RNG matches reference vectors). The committed `*.test.ts` files
> are the vitest versions; run `npm install && npm test` to execute them in CI.
