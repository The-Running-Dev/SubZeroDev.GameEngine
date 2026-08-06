# SubZeroDev Game Engine Landing Page

The standalone React landing page. It is intentionally separate from the Docusaurus
documentation site and does not configure hosting.

The playable demo imports the engine's published public entry point as a local package. Build
the engine before installing or checking this site from a clean checkout:

```powershell
npm --prefix ../src/engine ci
npm --prefix ../src/engine run build
npm ci
npm run check
```

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
`vite.config.ts`'s jsdom project.

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
- Documentation destinations are absolute `game-engine.subzerodev.com` URLs.
- Do not add a host, canonical URL, or Open Graph image until hosting is decided.
