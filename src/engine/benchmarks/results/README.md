# Recorded local measurement

[Raw JSON](node24-linux.json), measured from clean commit `9b8bd9a46094ddd4bcc92df39fdb648915dcbf39`
on Node.js `v24.19.0`, Linux x64, AMD EPYC 9V74 80-Core Processor, in a shared
container environment. The commit contains the harness and #603's optimization; the
following evidence commit adds only these measurement files.

All ten rows completed 21 measured batches after three warm-up batches each: 210 measured
batches and 420 measured ticks. All output-repeatability,
instrumentation-parity and split-batch checks passed. Each row also ran an excluded
reference batch, diagnostic batch and split batch. The raw JSON records their separate
counts, provenance, seed, validation warnings, deterministic hashes and raw samples.

Latency below is **whole-call batch latency** in milliseconds, including change aggregation
and in-memory event recording. All rows include two cleaners and two litter tasks.
Fixture construction and validation are excluded. The p95 uses nearest rank over 21 samples.

| Scenario | Map | Initial seeking guests | Service buildings | Products/building | Ticks/batch | Median ms | p95 ms |
|---|---|---|---|---|---|---|---|
| baseline | 16×16 | 8 | 2 | 1 | 1 | 7.57 | 8.22 |
| map-8 | 8×8 | 8 | 2 | 1 | 1 | 2.16 | 3.52 |
| map-32 | 32×32 | 8 | 2 | 1 | 1 | 30.56 | 32.99 |
| map-64 | 64×64 | 8 | 2 | 1 | 1 | 105.16 | 117.69 |
| guests-4 | 16×16 | 4 | 2 | 1 | 1 | 3.79 | 4.35 |
| guests-16 | 16×16 | 16 | 2 | 1 | 1 | 13.67 | 15.75 |
| buildings-4 | 16×16 | 8 | 4 | 1 | 1 | 10.90 | 13.07 |
| products-3 | 16×16 | 8 | 2 | 3 | 1 | 14.47 | 15.41 |
| batch-8 | 16×16 | 8 | 2 | 1 | 8 | 46.62 | 50.19 |
| combined | 32×32 | 16 | 4 | 3 | 4 | 873.62 | 948.85 |

Reproduce from the repository root on Node.js >=24, using the measured source commit for
an exact code comparison:

```bash
npm --prefix src/engine ci
npm --prefix src/engine run bench:world-graph -- --samples 21 --warmups 3 --out ../../artifacts/world-graph-bench.json
```

The default seed is recorded in the JSON. Its `arguments` field preserves the original
output filename; changing that filename does not change the workload. Timings vary between
runs; hashes should match at this source/runtime/seed. See the [method and bounds](../README.md)
for what is included. In particular, consecutive ticks let guests move into queues and
service; they are not repeated fresh all-seeking ticks. These local measurements establish
neither supported map/guest limits nor a speedup against #603's single-route timings.
