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

`npm run check` verifies formatting, linting, TypeScript, component tests, the production build,
and the static social metadata in the built HTML.

## Boundaries

- Keep all landing-page work inside `site/`.
- Documentation destinations are absolute `game-engine.subzerodev.com` URLs.
- Do not add a host, canonical URL, or Open Graph image until hosting is decided.
