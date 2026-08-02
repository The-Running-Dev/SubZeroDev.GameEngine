import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

/**
 * Local Docusaurus config — overrides the base image's default when this
 * directory is copied over /template (see ./Dockerfile). Content lives in
 * ./docs (engine/); the sidebar is ./sidebar.ts.
 *
 * Published at the custom domain configured in GitHub Pages
 * (game-engine.subzerodev.com).
 *
 * Both broken-link checks are 'throw'. They were relaxed to 'warn' only because
 * the site root was a static file, and Docusaurus resolves links against routes
 * only -- so the navbar brand's link to / could never satisfy the checker no
 * matter that the file served. The root is now a real route, generated from the
 * README into src/pages/index.md, so that reason is gone and strict gating is
 * back. This also re-gates the site-absolute /docs/... links that
 * build/Test-Documentation.ps1 skips by design (its line 391), which nothing
 * else was checking while this was 'warn'.
 *
 * `onBrokenAnchors` is 'throw' too, which is what makes it safe to deep-link
 * README entries at headings rather than at whole pages: neither checker
 * validated fragments before -- onBrokenLinks resolves routes, and the gate
 * skips site-absolute targets -- so an anchor was the one link class nothing
 * covered. A renamed heading now fails the build.
 */
// Hoisted so the raw-HTML navbar brand below can reference the same value
// Docusaurus uses everywhere else, rather than a second hardcoded '/' that
// would silently stop matching if this site ever moved to a subpath.
const baseUrl = '/';

const config: Config = {
  title: 'Game Engine',
  tagline: 'A deterministic, game-agnostic narrative game platform',
  url: 'https://game-engine.subzerodev.com',
  baseUrl,

  onBrokenLinks: 'throw',

  onBrokenAnchors: 'throw',

  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'throw',
    },
  },

  i18n: {defaultLocale: 'en', locales: ['en']},

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebar.ts',
          // Renaming this also means re-running the docs installer: the site
          // root is generated from the README into src/pages/index.md, and the
          // '[View the documentation]' link it appends is built from this value.
          routeBasePath: 'docs',
        },
        blog: false,
        // Local override of the base image's CSS, same pattern as this whole
        // file overriding /template's default config -- see the file's own
        // comment for why (prose links are underlined for visibility).
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    navbar: {
      // No `title` here -- that renders Docusaurus's own brand link, which is
      // a client-side <Link to={baseUrl}> ("/"). This app's own router still
      // has a route for "/" (compiled from src/pages/index.md, the
      // generated-from-README page), even though the merged deploy overwrites
      // that route's *output* index.html with the standalone landing page.
      // Clicking the default brand therefore client-navigates to the stale
      // bundled README page instead of reloading the real one -- confirmed
      // locally: the URL updates to "/" but the rendered content is the old
      // README page, broken further because it renders inside the docs
      // layout it was never meant to mount into. A hard refresh "fixes" it
      // only because that bypasses the stale route and re-requests "/" from
      // the server, which serves the real (merged) file.
      //
      // A raw `type: 'html'` item, styled to match Docusaurus's own brand
      // markup exactly, sidesteps this: it is a plain <a>, not a Link, so the
      // browser does a normal navigation and always gets the current file.
      items: [
        {
          type: 'html',
          position: 'left',
          value: `<a class="navbar__brand" href="${baseUrl}"><b class="navbar__title text--truncate">Game Engine</b></a>`,
        },
        {type: 'docSidebar', sidebarId: 'docs', position: 'left', label: 'Docs'},
        {type: 'html', position: 'left', value: '<a class="navbar__item navbar__link" href="/roadmap/">Roadmap</a>'},
      ],
    },
    footer: {style: 'dark', links: []},
  } satisfies Preset.ThemeConfig,
};

export default config;
