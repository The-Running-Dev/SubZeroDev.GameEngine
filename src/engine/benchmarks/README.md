# World-graph full-tick benchmark

This suite measures the real `advanceTicks` entry point, including the complete twenty-system
pipeline, change aggregation and an in-memory event recorder. It builds on the pathfinder
in PR #603; it neither replaces the search nor caches around it. No production code or
package exports change.

From the repository root, with **Node >=24** (the engine's supported runtime):

```bash
npm --prefix src/engine ci
npm --prefix src/engine run bench:world-graph -- --samples 21 --warmups 3 --out ../../artifacts/world-graph-bench.json
```

The output path is relative to `src/engine`, because npm runs scripts in the package directory.
Without `--out`, invoke the script directly for JSON-only stdout (progress goes to stderr):

```bash
cd src/engine
node --import tsx scripts/bench-world-graph.ts --samples 21 --warmups 3
```

A quick check uses `--scenario baseline --samples 2 --warmups 1`. Run `npm --prefix src/engine
test -- scripts/world-graph-bench.test.ts` for correctness checks; they have no elapsed-time
thresholds. Benchmarks are opt-in and are not a performance gate in ordinary CI.

## Scenarios and bounds

`scripts/world-graph-bench-fixture.ts` owns the fixed matrix: map sizes 8, 16, 32 and 64;
seeking-guest counts 4, 8 and 16; two or four service buildings; one or three products per
building; and batches of one, four or eight ticks. Most rows vary one factor around the
16×16 baseline; `combined` varies several. This is a bounded sweep, not a Cartesian product.
Select one row with `--scenario <id>`; the exact parameters are always in the JSON.

The CLI accepts `--samples` (2–31; default 7), `--warmups` (1–5; default 2), `--seed`
(1–128 characters; default `world-graph-bench-v1`), `--scenario` and `--out`. It rejects unknown,
duplicate, missing and invalid arguments before constructing any fixture. Internal fixture
bounds also reject maps above 64, more than 32 guests, eight buildings, four products per
building, four cleaners or sixteen ticks. These are **harness work bounds, not engine support
limits**. They bound work, not wall time on arbitrary machines. There is no adaptive search
for a maximum map size or population.

Fixtures extend the engine-owned reference campaign through its existing source builder.
Every scenario passes the real campaign validator, initial building placement checks,
state-shape validation and referential-integrity checks before timing. Validation warnings
are retained in the result. Seeded PCG streams choose building slots, guest positions and
litter positions; the real production stream factory handles pipeline draws. The typed
runtime guests are explicitly initialized as seeking, with affordable products and long
stays/patience. Two cleaners have reachable litter tasks, exercising staff assignment paths.
Buildings occupy alternating columns in the bottom two rows of slots, leaving entrances
reachable. Terrain is uniformly walkable and products have identical economics. Spawning is
capped at the initial population; objectives, failures, scheduled bankruptcy, ambient random
incidents and product litter are disabled to prevent a batch silently ending or growing.

This isolates guest/building/product scoring and staff path assignment while running every
system. Construction, large incident catalogs, explicit topologies, heterogeneous terrain,
and session-store/network/persistence overhead are not represented. It is not an exhaustive
production-content workload.

## Timing and repeatability

Each sample starts from a fresh clone of the **same seeded initial workload**. Campaign
building/validation, map materialization, cloning and context setup happen before the timer.
One synchronous `advanceTicks` call is timed; output hashing, invariant checks and JSON/file
I/O happen afterward. RNG handles and event buffers are fresh per sample. No forced GC or
heap tuning is applied; runtime pauses remain part of latency. Warm-ups use the same input
and are discarded. A reference execution is also excluded from latency statistics.

The primary `latency` distribution is **whole-call batch latency**, with raw per-sample
processed tick counts. `amortizedMsPerTick` divides batch latency by processed ticks; it is
not the distribution of individual tick latencies. Every measured and warm-up batch must
process exactly the requested ticks, stay unresolved, and match the reference SHA-256 of
canonical state/result/changes/events. An early terminal state is an error, not a shorter
successful sample. Fixture mutation is also checked.

A separate diagnostic pass wraps every existing `WORLD_GRAPH_SYSTEMS` entry through
`runWorldGraphTick`'s injection seam in the existing order. It reports individual tick and
system latencies plus seeking/queued guest and assigned staff counts as the batch evolves.
Those timings include instrumentation overhead and are **not** the primary batch samples.
Its final canonical state, aggregated changes and pipeline events must match the ordinary
batch. Another untimed run splits the batch into single-tick production actions and checks
canonical final-state parity; batch event boundaries and change aggregation intentionally
vary with that split.

Guests can stop seeking when queued or served. Consequently an eight-tick batch does not
mean eight fresh all-seeking ticks. Use the one-tick rows for that initial pressure and the
diagnostic counts to interpret longer batches; the harness never resets guest lifecycles
inside a batch.

## Reading the JSON

The versioned result includes workload/seed and fixture digest; measured/warm-up/verification
tick counts; raw samples; median, nearest-rank p95, minimum and maximum; deterministic output
digests; and diagnostic data. Median averages the central pair for even sample counts. p95
is `sorted[ceil(0.95 * n) - 1]`; with the default seven samples it is the maximum, so use the
21-sample command above for a less coarse tail statistic. Even 21 samples are a small local
run, not a stable tail guarantee.

Provenance includes the git commit, dirty status, harness and lockfile digests, exact script
arguments, Node/V8 versions and flags, OS, architecture, CPU and available parallelism. A dirty
run is explicitly marked and cannot be reproduced from its commit alone. `processedTicks`
counts measured work only; warm-up ticks and `verification.extraTicks` (reference, diagnostic,
and split runs) are separate. `verification.identicalOutputBatches` includes the reference,
warm-ups and measured batches. Diagnostic execution is one extra batch, not repeated samples
from the primary latency distribution.

Repeat runs on the same idle machine and compare identical seeds, arguments, digests and
runtime conditions. Timing values are expected to differ; deterministic hashes are not.
No result establishes a supported map/guest limit, and #603's single-route measurements
cannot be extrapolated to tick capacity. Any checked-in result is a recorded local run with
its own provenance, not a performance promise or a before/after comparison.
