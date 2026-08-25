import todo from "../../../docs/docs/engine/TODO.md?raw";

export type RoadmapStatus = "done" | "now" | "next" | "later";
export type RoadmapChapter = {
  id: string;
  workUnits: string;
  ledgerAnchor?: string;
  status: RoadmapStatus;
  title: string;
  summary: string;
  aside?: string;
  links: readonly {
    label: string;
    href: string;
    kind: "site" | "repository";
  }[];
};

const repo = "https://github.com/The-Running-Dev/SubZeroDev.GameEngine";
const commit = (hash: string) => `${repo}/commit/${hash}`;

// TODO.md's `### [x] W…` headings are now the complete machine-readable record — W41–W49
// caught back up once the ledger format resumed carrying completed headings, so the exception
// list that used to patch this count by hand (`completedBeyondTodo`, W41–W49) is redundant and
// has been retired. If a future gap reopens, reintroduce the same pattern rather than silently
// undercounting.
export const completedWorkUnitCount = (todo.match(/^### \[x\] W[\w]+/gm) ?? [])
  .length;

export const shippedChapters: readonly RoadmapChapter[] = [
  {
    id: "rules",
    workUnits: "W0–W8",
    status: "done",
    title: "The engine learns the rules",
    summary:
      "Reproducible randomness, saves, validation, sessions, and the boundary that keeps clients honest.",
    links: [
      {
        label: "W0–W8 evidence",
        href: commit("d9af5d8dbd0bc88829c8d43571aee92b874b2536"),
        kind: "repository",
      },
    ],
  },
  {
    id: "story",
    workUnits: "W9–W19",
    status: "done",
    title: "The first story survives contact with bureaucracy",
    summary:
      "Choices, consequences, endings, achievements, a text client, MCP tools, and the completed MVP.",
    aside:
      "At this point, calling it an accident became administratively difficult.",
    links: [
      {
        label: "MVP evidence",
        href: commit("dcb78038cbe8bb8e002f0651c9551b47ff874bb5"),
        kind: "repository",
      },
    ],
  },
  {
    id: "replay",
    workUnits: "W20–W26",
    status: "done",
    title: "The past becomes testable",
    summary:
      "Versions and recorded games can expose when a future release changes an old outcome.",
    links: [
      {
        label: "Replay evidence",
        href: commit("e26fa9dbc9e1a2814443bfff952a15562b608dc8"),
        kind: "repository",
      },
    ],
  },
  {
    id: "bulgaria",
    workUnits: "W27–W31",
    status: "done",
    title: "Bulgaria expands beyond one municipal office",
    summary:
      "All five story arcs exist, and old saves can migrate when the engine changes.",
    links: [
      {
        label: "Arc evidence",
        href: commit("588567d2d4ff84f7b38a904b62c586b315122f07"),
        kind: "repository",
      },
    ],
  },
  {
    id: "life",
    workUnits: "W32–W40",
    status: "done",
    title: "A week of life becomes a machine",
    summary:
      "The engine can run and replay a Stable Life win and loss. A polished player-facing game is still later work.",
    links: [
      {
        label: "Stable Life evidence",
        href: commit("9fdf77c63773ea0bc0ffc288fbba0995ee04c3ff"),
        kind: "repository",
      },
    ],
  },
  {
    id: "door",
    workUnits: "W41–W42",
    status: "done",
    title: "The engine gets a front door, then a world state",
    summary:
      "A supported package boundary, a clean-consumer test, a published v0.4.0 package, and the third kind's runtime-state contract.",
    aside: "The door exists. The resort still needs a description.",
    links: [
      {
        label: "W41 evidence",
        href: commit("db9c62aec509ed083179a73ae2ec49b1b53d3d26"),
        kind: "repository",
      },
      {
        label: "W42 evidence",
        href: commit("5f5f8f542f619e70b2a15d8952998e48d12766d1"),
        kind: "repository",
      },
    ],
  },
  {
    id: "world-contract",
    workUnits: "W43–W44",
    status: "done",
    title: "The resort gets its world-graph contract",
    summary:
      "The third kind now has its content definitions, runtime contract, deterministic resolution rules, and systems boundary.",
    links: [
      {
        label: "W43 evidence",
        href: commit("e3000745deb08fe687c11c79e31046337fe4354e"),
        kind: "repository",
      },
      {
        label: "W44 evidence",
        href: commit("5eca57b9dc50b939fe55d7ef7a06edac9f38c346"),
        kind: "repository",
      },
    ],
  },
  {
    id: "world-ticks",
    workUnits: "W45–W46",
    status: "done",
    title: "The resort gets a deterministic clock",
    summary:
      "The kind foundation and 20-system tick pipeline are merged: time advances in bounded, reproducible batches before the playable loop arrives.",
    links: [
      {
        label: "W45 evidence",
        href: commit("c6662bb6b638e70348a133f8c028b2e18f26963c"),
        kind: "repository",
      },
      {
        label: "W46 evidence",
        href: commit("6301a497cc956c4e47df584c7b0b9d3c0455b71c"),
        kind: "repository",
      },
    ],
  },
  {
    id: "world-play",
    workUnits: "W47",
    status: "done",
    title: "The resort gets a playable loop",
    summary:
      "One guest can now spawn, walk, queue, buy, litter, clean, and carry the resort to a win or loss through the real deterministic pipeline.",
    links: [
      {
        label: "W47 evidence",
        href: commit("23907505b64042b9dbc744ba4edac0c53122c673"),
        kind: "repository",
      },
    ],
  },
  {
    id: "preview",
    workUnits: "W48",
    status: "done",
    title: "Let every client preview an action",
    summary:
      "Every client can preview the authoritative action path without changing saved state or duplicating kind rules.",
    links: [
      {
        label: "W48 evidence",
        href: commit("c8bf587271f915f2022e77b06bd866ed0d9c2fc6"),
        kind: "repository",
      },
    ],
  },
  {
    id: "world-guard",
    workUnits: "W49",
    status: "done",
    title: "The resort can prove a win or collapse",
    summary:
      "The canonical scenario validates, wins and loses deterministically, survives session and preview parity checks, and is protected by the replay corpus.",
    links: [
      {
        label: "W49 evidence",
        href: commit("6e3d38e77d0e34686dc4e0956b2ff01da9b8af3d"),
        kind: "repository",
      },
    ],
  },
  {
    id: "life-economy",
    workUnits: "W50–W60",
    status: "done",
    title: "Life in the Fast Lane becomes a whole, playable economy",
    summary:
      "Employment, education, housing, debt, possessions, relationships, events, and achievements are all wired in; content packs resolve identity, features gate behind experiments, and the campaign plays end to end in a second locale.",
    links: [
      {
        label: "W50–W60 evidence",
        href: `${repo}/pull/166`,
        kind: "repository",
      },
    ],
  },
  {
    id: "public-demo",
    workUnits: "W61–W62",
    status: "done",
    title: "The demo leaves the repository",
    summary:
      "A static, public /play/ route and an immutable container image put the running engine somewhere a stranger can actually click it.",
    links: [
      {
        label: "W61 evidence (part 1)",
        href: `${repo}/pull/183`,
        kind: "repository",
      },
      {
        label: "W61 evidence (part 2)",
        href: `${repo}/pull/184`,
        kind: "repository",
      },
      {
        label: "W62 evidence",
        href: `${repo}/pull/264`,
        kind: "repository",
      },
    ],
  },
  {
    id: "casebook",
    workUnits: "W63–W64",
    ledgerAnchor: "w64",
    status: "done",
    title: "The story shelf becomes a casebook you can actually play",
    summary:
      "The public story-graph surface is rebuilt as an original adventure cabinet, and all six campaigns gain material routes, delayed consequences, seeded events, and authored endings instead of one linear pass.",
    links: [
      {
        label: "W63 — Absurd Game Interface",
        href: `${repo}/pull/188`,
        kind: "repository",
      },
      {
        label: "W64 — Replayable Story Campaign Expansion",
        href: `${repo}/pull/191`,
        kind: "repository",
      },
      {
        label: "Play the adventures",
        href: "/play/",
        kind: "site",
      },
    ],
  },
  {
    id: "phone-witness",
    workUnits: "W65–W66",
    status: "done",
    title: "The play surface gets a witness, then a phone",
    summary:
      "A real-browser test harness captures the shipped cabinet as a baseline, then the whole surface is recomposed for a thumb instead of a mouse — same retro look, different reading order.",
    links: [
      {
        label: "W65 evidence",
        href: `${repo}/pull/201`,
        kind: "repository",
      },
      {
        label: "W66 evidence",
        href: `${repo}/pull/205`,
        kind: "repository",
      },
    ],
  },
  {
    id: "regression-evidence",
    workUnits: "W67",
    status: "done",
    title: "A gap in the story-graph evidence gets closed",
    summary:
      "Regression coverage lost during earlier reconciliation work is restored and re-verified.",
    links: [
      {
        label: "W67 evidence",
        href: `${repo}/pull/261`,
        kind: "repository",
      },
    ],
  },
  {
    id: "landing-package",
    workUnits: "W69",
    status: "done",
    title: "The landing page stops maintaining its own copy",
    summary:
      "site/ adopts the shared, versioned landing-page package instead of a hand-rolled one, so a platform-wide layout fix arrives here without a duplicate patch.",
    links: [
      {
        label: "W69 evidence",
        href: `${repo}/pull/272`,
        kind: "repository",
      },
    ],
  },
  {
    id: "bulgaria-pack",
    workUnits: "W71–W72",
    status: "done",
    title: "Bulgaria becomes a content pack, not a hard-coded setting",
    summary:
      "A second campaign resolution proves no engine or kind code has to change to reskin a game, then the full Bulgarian setting is written to prove the mechanism at volume.",
    links: [
      {
        label: "W71 evidence",
        href: `${repo}/pull/314`,
        kind: "repository",
      },
      {
        label: "W72 evidence",
        href: `${repo}/pull/317`,
        kind: "repository",
      },
    ],
  },
  {
    id: "author-checks",
    workUnits: "W73",
    status: "done",
    title: "Author-facing checks catch unreachable endings before players do",
    summary:
      "A Tier 3 validator reports unreachable endings and unsatisfiable choices per campaign — run by hand, not wired into the registry gate.",
    links: [
      {
        label: "W73 evidence",
        href: `${repo}/pull/319`,
        kind: "repository",
      },
    ],
  },
  {
    id: "content-ownership",
    workUnits: "W74–W76",
    status: "done",
    title: "Campaign ownership leaves the engine",
    summary:
      "Authoring moves to the content owner while this repository keeps frozen, deterministic regression fixtures and a stable package boundary.",
    links: [
      { label: "W74 evidence", href: `${repo}/pull/332`, kind: "repository" },
      { label: "W76 evidence", href: `${repo}/pull/337`, kind: "repository" },
    ],
  },
  {
    id: "authoring-toolchain",
    workUnits: "W77–W80",
    status: "done",
    title: "Content authors get real tools",
    summary:
      "Validation, localization coverage, resolution diffs, and story-graph visualization turn the authoring boundary into a usable toolchain.",
    links: [
      { label: "W77 evidence", href: `${repo}/pull/338`, kind: "repository" },
      { label: "W80 evidence", href: `${repo}/pull/343`, kind: "repository" },
    ],
  },
  {
    id: "world-correctness",
    workUnits: "W81–W85",
    status: "done",
    title: "The world graph learns to finish its work",
    summary:
      "Construction, refills, wear, incidents, and attention signals complete the resort's deterministic operational loop.",
    links: [
      { label: "W81 evidence", href: `${repo}/pull/345`, kind: "repository" },
      { label: "W85 evidence", href: `${repo}/pull/361`, kind: "repository" },
    ],
  },
  {
    id: "event-explanations",
    workUnits: "W86–W87",
    status: "done",
    title: "Kinds explain what happened",
    summary:
      "Story-graph reasons and world-graph tick events give clients a contract-level explanation rather than forcing them to infer outcomes.",
    links: [
      { label: "W86 evidence", href: `${repo}/pull/362`, kind: "repository" },
      { label: "W87 evidence", href: `${repo}/pull/363`, kind: "repository" },
    ],
  },
  {
    id: "simulation-public-proof",
    workUnits: "W88–W89",
    status: "done",
    title: "Simulation becomes public and game-length",
    summary:
      "The package now exposes the simulation authoring/runtime split, and paired 150+ week replays prove deterministic life-simulation terminal paths.",
    links: [
      { label: "W88 evidence", href: `${repo}/pull/367`, kind: "repository" },
      { label: "W89 evidence", href: `${repo}/pull/376`, kind: "repository" },
    ],
  },
];

export const nextActs: readonly RoadmapChapter[] = [
  {
    id: "release-010",
    workUnits: "W90–W92",
    ledgerAnchor: "w90",
    status: "now",
    title: "Make 0.10.0 reproducible and public",
    summary:
      "Reconcile the public story, harden the package and documentation gates, then publish the simulation authoring and game-length proof already merged on main.",
    links: [
      {
        label: "Stabilization ledger",
        href: "/docs/engine/todo#w90",
        kind: "site",
      },
      {
        label: "W89 evidence",
        href: `${repo}/pull/376`,
        kind: "repository",
      },
    ],
  },
  {
    id: "stabilize-011",
    workUnits: "W93–W108",
    ledgerAnchor: "w93",
    status: "next",
    title: "Close the additive 0.11 stabilization programme",
    summary:
      "Correctness, session boundaries, complete simulation mechanics, companion contracts, and release-candidate verification follow without removing the 0.10 surface.",
    links: [
      {
        label: "Stabilization ledger",
        href: "/docs/engine/todo#w93",
        kind: "site",
      },
    ],
  },
];

const currentActCandidate = nextActs.find(
  (chapter) => chapter.status === "now",
);

if (currentActCandidate === undefined) {
  throw new Error("The roadmap must define one current act.");
}

export const currentAct: RoadmapChapter = currentActCandidate;

export const futureActs = nextActs.filter(
  (chapter) => chapter.status === "next",
);
