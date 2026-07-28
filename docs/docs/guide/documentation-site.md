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

Most of `docs/docs/` is authored directly. Two pages are not:

- **The site root** is generated from the repository's `README.md` into
  `docs/src/pages/index.md`. **Do not edit it** — edit the README. Absolute
  `https://game-engine.subzerodev.com/…` links in the README are rewritten to site-relative
  ones as it is generated, which is what lets one file read correctly both on the code host
  and here.
- **The `/docs/` landing page** is ordinary authored content, listing the specs in reading
  order.

The root being a real page rather than a redirect is what allows the strict link checking
below: a redirect file serves a request but never satisfies a route checker.

## Two link checks, and they do not overlap

Both run on every pull request, and both must pass.

| Check | Covers |
|---|---|
| `build/Test-Documentation.ps1` | Relative links, heading anchors, terminology, and drift between a generated file and its source |
| The Docusaurus production build | Site routes and anchors, including links the gate deliberately skips |

`onBrokenLinks`, `onBrokenMarkdownLinks`, and `onBrokenAnchors` are all `throw`, so a renamed
heading or a moved page fails the build rather than rotting quietly. The gate skips
site-absolute targets by design, on the understanding that the build owns them — which is why
relaxing either one leaves a gap.

## The tooling is vendored, not forked

`build/` and `.config/` are installed from
[the documentation template](https://github.com/The-Running-Dev/Docusaurus-Template) and kept
**byte-identical** to it. Fixes go upstream first and arrive here on the next sync; nothing in
`build/` is edited locally. That is what keeps re-running the installer safe — it has nothing
to reconcile.
