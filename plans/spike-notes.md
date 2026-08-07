# Spike: campaign authoring + deploy

Branch `spike/authoring-and-play`, worktree `../SubZeroDev.GameEngine-spike`, off `main` @ `a86c59c`.

**Throwaway.** No `/slice`, no `design/` edits, no docs regen, no PR. Gates are not run, not
removed. Nothing under `design/` or `docs/` is touched, so the reconcile diff stays readable.

Goal: make a campaign **easy to author** (TS, better builders) and **easy to deploy**
(runtime-loaded from `site/public/`, no engine rebuild).

---

## The baseline cost

Adding a campaign on `main` touches five places:

1. `src/engine/src/campaigns/<id>.ts` — the campaign itself
2. `src/engine/src/index.ts` — an export line
3. rebuild the engine package (`site` depends on it via `file:../src/engine`)
4. `site/src/play/composition.ts` — an import, an entry in `built[]`, **and** an entry at the
   matching index of a parallel `descriptions[]` array
5. rebuild the site

(4) is the sharp one. `descriptions` is positional and index-coupled to `built` — catalog
metadata is matched to a campaign by array position, so an insertion in one array and not the
other silently mislabels every campaign after it. Same failure shape as the envelope-duplication
ledger in `CLAUDE.md`: one concept, two places, no compiler help.

Target: adding a campaign touches **one file**, and deploying it copies **one file**.

## Why nothing needs to be deleted

Checked before starting. Campaign content is pure data:

- `Campaign.content` is `unknown` — opaque to the core by design (04 §2).
- `Condition` is a data tree (`core/condition/types.ts`), not closures.
- Every function in the story-graph kind lives on the `Kind` (`kinds/story-graph/kind.ts`),
  which ships in the engine package and is *not* per-campaign.
- `BuiltCampaign` is `{ campaign, strings: ReadonlyMap }`.

So a built story-graph campaign is JSON-serializable, and the TS-authoring / JSON-deploy split
is one pipeline rather than two competing answers:

```
TS source  →  buildStoryGraphCampaign()  →  JSON  →  fetch at runtime  →  register
                    existing seam
```

`core/registry/build.ts` already says parsing and file I/O belong in "an outer adapter that
doesn't exist yet". The loader goes in `site/`, not the engine. The spike targets the existing
authoring → registry boundary rather than replacing it — which is why the contracts stay.

## Known gap, not solved here

`Campaign.migrateState?` is a **function** and cannot survive JSON. No current campaign sets it.
A runtime-loaded campaign therefore cannot carry a content migration. Reconcile-time question,
deliberately left open.

---

## Log

### Setup

Worktree created off merged `main` (`a86c59c`, includes PR #221). `npm install` + engine
`npm run build` clean in both `src/engine` and `site`.

### The portable format — `src/engine/src/spike/portable.ts`

New module, outside `core/` (it imports the story-graph kind, which `core/` may not).
`PortableCampaign` = `{ formatVersion, catalog, campaign: {id, kindId, version, titleKey,
content}, migration?, strings }`. `toPortable` runs at author time; `fromPortable` runs in
the browser.

Two things this had to solve that weren't obvious going in:

- **Null-prototype maps don't survive JSON.** The story-graph kind builds `variables` and
  `nodes` with `Object.create(null)` deliberately (`variables.ts`'s own comment: a
  content-controlled key like `__proto__` must not resolve through the prototype chain).
  `JSON.parse` hands back ordinary objects. `fromPortable` rebuilds both maps
  null-prototype on the way back in — same hardening, just re-applied after the round-trip.
- **`migrateState` is a function, not data — except it wasn't really.**
  `migrateV1AdventureState` (`adventure-builder.ts`) turned out to already be generic code
  parameterized by two id-remap tables (`nodeMap`, `endingMap`). Those tables are the only
  per-campaign part, and the walk itself reads from the *built* `content`, not the
  authoring `source` — so it doesn't even need the source back. `PortableMigration` carries
  just the two tables; `fromPortable` reattaches the same generic walk
  (`migrateFromContent`, a straight port). `bulgaria-bureaucracy` sets this in production,
  so it wasn't a hypothetical — the very first campaign run through the pipeline needed it.

### Catalog metadata moves to the campaign

Added `bulgariaBureaucracyCatalog` / `sakiQuestCatalog` (`PortableCatalog`) directly to
each campaign file, replacing their entries in `composition.ts`'s old positional
`descriptions[]` array. This is what actually kills the index-coupling bug described above
— the card can no longer point at the wrong campaign, because it isn't a separate array
anymore.

### Export script — `scripts/spike-export-campaigns.ts`

`npm run spike:export` (added to `package.json`). Builds each campaign, calls
`toPortable`, writes `site/public/campaigns/<id>.json` + a `manifest.json` listing them in
order. Lives in `scripts/`, same as `demo-cli.ts` — outside `src/`, so the determinism
guard and dependency-arrow lint rule don't apply (it's an authoring-time tool, not shipped
engine code).

First run: `bulgaria-bureaucracy.json` (111 strings, 44 KB), `saki-quest-for-redemption.json`
(214 strings, 96 KB). No errors, no manual fixups.

### Loader — `composition.ts` rewritten

`createBrowserDemo` is now `async`: fetches `manifest.json`, fetches each listed campaign,
`fromPortable`s each into a `BuiltCampaign`, then calls the *same*
`buildValidatedContentRegistry` every compiled-in campaign already went through — no
separate validation path for runtime-loaded content. Catalog cards now come from each
file's own `catalog` block instead of a positional array.

`PlayApp` needed a loading gate (`useState` + `useEffect`, a `PlayAppReady` split
underneath) since building the demo is no longer synchronous — otherwise unchanged.

### Tests

`browser-client.test.ts` and `PlayApp.test.tsx` both assumed a synchronous
`createBrowserDemo()`. Fixed by: stubbing `global.fetch` in `beforeAll` to serve the exact
files `spike:export` wrote (statically imported, not hand-built fixtures — so a test
failure means the real exported file broke, not a fixture drifting from it), and awaiting
the loading gate before each test's first synchronous query. **27 passed, 1 skipped**
(`PlayApp.test.tsx`'s Enterprise-campaign test — that campaign isn't in the two the spike
exports; not a pipeline defect, just export-script scope).

### Manual play-through — proof of the vertical slice

`.claude/launch.json`'s `preview_start` launches from the **main checkout's** working
directory, not the spike worktree, so it showed the old hardcoded 6-campaign catalog —
a real gotcha, not a pipeline bug. Started Vite manually inside the worktree instead
(`npx vite --port 5174`) and pointed the browser pane at that.

Network trace confirmed the loader fetches exactly `manifest.json`,
`bulgaria-bureaucracy.json`, `saki-quest-for-redemption.json` — nothing else. Played
Bureaucracy's registry route start to finish: variables tracked (`Clerk Goodwill`,
`Documents`, `Administrative Pressure`), two achievements unlocked mid-run, a third on
the ending, save fired every turn, reached "Document Obtained" and a real
`SESSION COMPLETE` state. No console errors. Then loaded Saki via
`?campaign=saki-quest-for-redemption` — hidden from the grid, reachable by direct link,
validated clean.

### Result

Adding a campaign now touches **one file** (the campaign + its `PortableCatalog`); shipping
it copies **one file** into `site/public/campaigns/` and adds one manifest line. No engine
rebuild, no `composition.ts` edit, no positional array to keep in sync. `design/` was never
touched — the spike landed on the existing `core/registry/build.ts` authoring → registry
boundary exactly where that doc said an outer adapter belonged.

### Open questions for the reconcile

- Does `PortableMigration`'s two-table shape generalize past the adventure-builder's v1→v2
  case, or is it specific to that one migration?
- Where does `toPortable`/`fromPortable` actually live if this graduates — still
  `site`-side, or does the registry boundary gain an official JSON adapter?
- `spike:export` is unwired from any build step; a real version needs to run before
  `site` build, or be checked in like the compiled campaigns are today.
- The `preview_start`/`launch.json` worktree gotcha above is worth a note somewhere for
  next time — not a reconcile item, just a workflow trap.
