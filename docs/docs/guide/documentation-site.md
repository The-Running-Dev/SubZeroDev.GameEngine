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

> **`docs.ps1` is installed, not committed.** It comes from the documentation template
> along with `build/` and `.config/`, and is written by `Invoke-SetupDocs` — which rewrites
> it for this project's paths and image tag, so it is a *generated* file rather than a
> vendored one. If it is not present in your checkout, run the installer.
>
> It was previously committed here in a hand-written form that predated the template and
> had drifted from it; the installed version additionally regenerates the README-derived
> site root on every run, which is why the local copy was dropped rather than reconciled.

## What is canonical, authored, and generated

The engine specifications are canonical under `design/`, not under the site tree. Marked blocks
in the five agent-kit files generate the detailed pages under `docs/docs/engine/`:

```powershell
./build/ConvertTo-HumanDocumentation.ps1
```

The generated [Developer Guide](/docs/guide) is a sequential synthesis produced by
`/make-human-docs`. After regeneration, stamp it against the canonical design digest:

```powershell
./build/ConvertTo-HumanDocumentation.ps1 -StampGuide
```

`build/Test-Documentation.ps1` runs the generator's `-Check` mode. A direct edit to a generated
engine page fails byte-for-byte; a canonical design edit makes the guide fail as stale until it
is regenerated and stamped.

Two other page classes remain:

- **The site root**, `docs/src/pages/index.md`, is generated from the repository's
  `README.md`. **Do not edit it** — edit the README. Absolute
  `https://game-engine.subzerodev.com/…` links in the README are rewritten to site-relative
  ones as it is generated, which is what lets one file read correctly both on the code host
  and here. It remains the entry in `.config/DocumentationRules.psd1`'s `GeneratedFiles`, and
  the gate fails the build if the committed copy and the generator disagree.
- **The `/docs/` landing page and the two focused working guides** are authored human pages.
  They link generated material but do not restate engine contracts.

Never edit `docs/docs/engine/*.md` or `docs/docs/guide.md` directly. Edit the owning canonical
design block and regenerate them.

The root being a real page rather than a redirect is what allows the strict link checking
below: a redirect file serves a request but never satisfies a route checker.

## Two link checks, overlapping in the middle

Both run on every pull request, and both must pass. They are complementary rather than
disjoint: each covers ground the other cannot reach, and they agree in between.

| Check | Only it covers | Both cover |
|---|---|---|
| `build/Test-Documentation.ps1` | Markdown outside the site — `README.md`, `CLAUDE.md`, `agent.md`, `design/`, `plans/` — plus terminology and generated-file drift | Relative links and their `#anchors` inside `docs/docs/` |
| The Docusaurus production build | Site routes, and **site-absolute** targets like `/docs/engine/core`, which the gate skips by design | |

`onBrokenLinks`, `onBrokenMarkdownLinks`, and `onBrokenAnchors` are all `throw`, so a renamed
heading or a moved page fails the build rather than rotting quietly.

The overlap is not waste — it is why a relative link is caught whichever tool runs first. The
gaps are what matter: relax the gate and the files outside the site stop being checked; relax
the build and site-absolute links stop being checked, because nothing else looks at them.

## Naming engine code from a spec

`docs/` is the **entire Docker build context** — the Dockerfile does `COPY . .`, so
`src/engine/` is not in the image. That single fact fixes the convention:

| Do | Don't |
|---|---|
| Name the file by its **repository-root path, in prose**: `` `src/engine/eslint.config.js` `` | Write a **relative traversal** — `../../../src/engine/…` resolves to nothing in the image and fails the build under `onBrokenLinks: 'throw'` |
| Link **[Engine Package](/docs/guide/engine-package)** when the reader needs the code itself | Make the path a **markdown link**. There is no route for it — the page lives at a URL, not a directory |

A relative path in prose is no better than a relative link: it is clickable nowhere,
meaningless on the published page, and correct only while reading raw markdown in a
checkout.

**Every spec that names engine code links the guide page once**, at its most load-bearing
mention. That is what makes a bare path navigable without inventing a route that does not
exist.

## Template tooling and the project-owned generator

The base documentation tooling and `.config/` are installed from
[the documentation template](https://github.com/The-Running-Dev/Docusaurus-Template). The
agent-kit migration adds one project-owned extension:
`build/ConvertTo-HumanDocumentation.ps1`, invoked by the local documentation gate. Keep that
extension when refreshing the template tooling; generic template fixes still go upstream first.
