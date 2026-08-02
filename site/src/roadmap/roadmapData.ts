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

// TODO owns W0–W40 (including W3a). W41 and W42 merged after its ledger format stopped
// carrying completed headings; keep that exceptional evidence explicit rather than pretending
// the prose is a uniform machine-readable database.
const completedBeyondTodo = ["W41", "W42"] as const;
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
      "Versions and recorded playthroughs can expose when a future release changes an old outcome.",
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
];

export const nextActs: readonly RoadmapChapter[] = [
  {
    id: "describe",
    workUnits: "W43–W44",
    status: "now",
    title: "Describe the resort",
    summary:
      "Settle the world’s content and the order in which it changes. W43 is the current unmerged contract unit.",
    links: [
      {
        label: "World-graph programme",
        href: `${repo}/blob/main/plans/39-world-graph-kind-programme.md`,
        kind: "repository",
      },
    ],
  },
  {
    id: "move",
    workUnits: "W45–W48",
    status: "next",
    title: "Make the resort move",
    summary:
      "Build actions, ticks, guests, queues, service, litter, cleaning, and previews.",
    links: [
      {
        label: "World-graph contract",
        href: "/docs/engine/world-graph-kind",
        kind: "site",
      },
    ],
  },
  {
    id: "prove",
    workUnits: "W49",
    status: "next",
    title: "Prove the resort can succeed or collapse",
    summary:
      "Validate it, record a win and loss, add replay protection, and publish a version Sun Trap can install.",
    links: [
      {
        label: "Sun Trap",
        href: "https://github.com/The-Running-Dev/SubZeroDev.SunTrap",
        kind: "repository",
      },
    ],
  },
];
