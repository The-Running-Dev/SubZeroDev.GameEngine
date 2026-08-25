# SubZeroDev Game Engine Landing Page

The standalone React landing page. It is intentionally separate from the Docusaurus
documentation site and does not configure hosting.

Route builds and the protected documentation merge are owned by the published
[`subzerodev-platform-ui-landing-page`](https://www.npmjs.com/package/subzerodev-platform-ui-landing-page)
package (pinned at `0.2.0`), consumed through its custom-adapter seam: `landing.config.ts`
declares this site's two routes (`/`, `/roadmap/`) — each an existing Engine-owned entry
module and its own static metadata — and the package's CLI builds, serves, and merges them.
No Vite config lives in this package any more; the site owns pages, styles, and tests only.

The site contains only the landing page and roadmap. The player-facing client is
`https://adventures.subzerodev.com/`; this package does not import the engine at runtime.

## Development

```powershell
npm install
npm run dev
npm run check
```

`npm run check` verifies formatting, linting, TypeScript, component tests, the real-browser
suite, the production build, and the static social metadata in the built HTML.

## Real-browser testing (W65)

`src/**/*.browser.test.{ts,tsx}` specs run in an actual Chromium tab (Playwright, via
`vitest.browser.config.ts`), not jsdom — jsdom performs no layout, so it cannot back a
computed-style, hit-area, or visual-snapshot assertion. Everything else keeps running under
`vitest.config.ts`'s jsdom project.

```powershell
npm run test:browser
```

Visual snapshots (`toMatchScreenshot()`) live under each spec's `__screenshots__/` and are
committed. A run against a missing or changed reference fails on purpose, so a human reviews
the rendering before it becomes the new baseline:

```powershell
npm run test:browser:update
```

Review the written/changed `.png` files (a diff viewer or `git diff --stat` on the
`__screenshots__/` directories is enough) before committing them.

## Boundaries

- Keep all landing-page work inside `site/`.
- Documentation destinations are root-relative paths served by the merged public artifact.
- Hosting and canonical metadata are declared by `landing.config.ts` and verified in the build.
