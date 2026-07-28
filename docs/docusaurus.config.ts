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
 */
const config: Config = {
  title: 'Game Engine',
  tagline: 'A deterministic, game-agnostic narrative game platform',
  url: 'https://game-engine.subzerodev.com',
  baseUrl: '/',

  onBrokenLinks: 'throw',

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
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    navbar: {
      title: 'Game Engine',
      items: [
        {type: 'docSidebar', sidebarId: 'docs', position: 'left', label: 'Docs'},
      ],
    },
    footer: {style: 'dark', links: []},
  } satisfies Preset.ThemeConfig,
};

export default config;
