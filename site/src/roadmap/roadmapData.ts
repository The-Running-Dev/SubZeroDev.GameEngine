import todo from "../../../docs/docs/engine/TODO.md?raw";

export type RoadmapStatus = "done" | "now" | "next" | "later";
export type RoadmapChapter = {
  id: string;
  workUnits: string;
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

// TODO owns W0–W40 (including W3a). W41–W48 merged after its ledger format stopped
// carrying completed headings; keep that exceptional evidence explicit rather than pretending
// the prose is a uniform machine-readable database.
const completedBeyondTodo = [
  "W41",
  "W42",
  "W43",
  "W44",
  "W45",
  "W46",
  "W47",
  "W48",
] as const;
export const completedWorkUnitCount =
  (todo.match(/^### \[x\] W[\w]+/gm) ?? []).length + completedBeyondTodo.length;

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
];

export const nextActs: readonly RoadmapChapter[] = [
  {
    id: "prove",
    workUnits: "W49",
    status: "now",
    title: "Finish proving the resort can succeed or collapse",
    summary:
      "The canonical scenario, validation, and win/loss replay guard are in. Session-parity evidence and a clean consumer rerun remain before a release can be cut.",
    links: [
      {
        label: "W49 ledger",
        href: "/docs/engine/todo#w49",
        kind: "site",
      },
      {
        label: "W49 replay evidence",
        href: commit("904d601"),
        kind: "repository",
      },
      {
        label: "Sun Trap",
        href: "https://github.com/The-Running-Dev/SubZeroDev.SunTrap",
        kind: "repository",
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
