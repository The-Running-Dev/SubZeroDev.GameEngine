---
title: 'The Documentation Site'
sidebar_label: Documentation Site
---

# The Documentation Site

This site is the repository's `docs/` folder, built with Docusaurus from a published base
image. This page covers building and checking it.

## Previewing locally

`docs.ps1` at the repository root drives the whole thing. It needs Docker running.

| Command | Does |
|---|---|
| `./docs.ps1` | Build the image, run it, serve the site |
| `./docs.ps1 -Live` | Same, but bind-mounts `docs/` so edits hot-reload |
| `./docs.ps1 -BuildOnly` | Build the image only |

## What is authored, and what is generated

Everything under `docs/docs/` is authored directly. **Exactly one page on the site is
generated:**

- **The site root**, `docs/src/pages/index.md`, is generated from the repository's
  `README.md`. **Do not edit it** — edit the README. Absolute
  `https://game-engine.subzerodev.com/…` links in the README are rewritten to site-relative
  ones as it is generated, which is what lets one file read correctly both on the code host
  and here. It is the only entry in `.config/DocumentationRules.psd1`'s `GeneratedFiles`, and
  the gate fails the build if the committed copy and the generator disagree.

The `/docs/` landing page is *not* generated, despite sitting next to it in the tree — it is
ordinary authored content listing the specs in reading order. Edit it freely.

The root being a real page rather than a redirect is what allows the strict link checking
below: a redirect file serves a request but never satisfies a route checker.

## Two link checks, overlapping in the middle

Both run on every pull request, and both must pass. They are complementary rather than
disjoint: each covers ground the other cannot reach, and they agree in between.

| Check | Only it covers | Both cover |
|---|---|---|
| `build/Test-Documentation.ps1` | Markdown outside the site — `README.md`, `CLAUDE.md`, `agent.md`, `plans/` — plus terminology and generated-file drift | Relative links and their `#anchors` inside `docs/docs/` |
| The Docusaurus production build | Site routes, and **site-absolute** targets like `/docs/engine/core`, which the gate skips by design | |

`onBrokenLinks`, `onBrokenMarkdownLinks`, and `onBrokenAnchors` are all `throw`, so a renamed
heading or a moved page fails the build rather than rotting quietly.

The overlap is not waste — it is why a relative link is caught whichever tool runs first. The
gaps are what matter: relax the gate and the files outside the site stop being checked; relax
the build and site-absolute links stop being checked, because nothing else looks at them.

## The tooling is vendored, not forked

`build/` and `.config/` are installed from
[the documentation template](https://github.com/The-Running-Dev/Docusaurus-Template) and kept
**byte-identical** to it. Fixes go upstream first and arrive here on the next sync; nothing in
`build/` is edited locally. That is what keeps re-running the installer safe — it has nothing
to reconcile.
