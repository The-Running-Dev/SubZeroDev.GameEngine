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
 * `onBrokenLinks` is 'warn', matching the template default and SubZeroDev.WinGet.
 * That is what lets static/index.html claim the site root: the navbar brand links
 * to / from every page, Docusaurus resolves links against routes only, and a
 * static file is not a route -- so under 'throw' that link fails the build even
 * though the file serves correctly.
 *
 * `onBrokenMarkdownLinks` is 'warn' too, matching the template default exactly on
 * both settings. Both Docusaurus checks are advisory by design here; the hard
 * gate is build/Test-Documentation.ps1, which fails the build on every relative
 * link and heading anchor in the docs tree -- the exact class onBrokenMarkdownLinks
 * would otherwise cover, so nothing is given up by relaxing it. That gate does
 * deliberately skip site-absolute targets (its line 391), on the assumption
 * Docusaurus owned them; those are warned about only -- today that is the twelve
 * /docs/engine/... links in the generated homepage. A link syntax the gate's regex
 * fails to parse is the one residual gap neither check covers.
 */
const config: Config = {
  title: 'Game Engine',
  tagline: 'A deterministic, game-agnostic narrative game platform',
  url: 'https://game-engine.subzerodev.com',
  baseUrl: '/',

  onBrokenLinks: 'warn',

  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

  i18n: {defaultLocale: 'en', locales: ['en']},

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebar.ts',
          // Renaming this also requires updating static/index.html, whose
          // meta refresh forwards the site root here. That target is a plain
          // string in a file Docusaurus copies verbatim, so nothing checks it.
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
