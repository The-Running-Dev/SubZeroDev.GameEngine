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
 * The cost is real and bounded. build/Test-Documentation.ps1 still hard-fails on
 * relative links and heading anchors, but it deliberately skips site-absolute
 * targets (its line 391) because Docusaurus used to own them. Those are now
 * warned about, not gated -- today that is the twelve /docs/engine/... links in
 * the generated homepage.
 *
 * `onBrokenMarkdownLinks` stays 'throw': it never saw the navbar link, so
 * relaxing it would give up coverage for nothing.
 */
const config: Config = {
  title: 'Game Engine',
  tagline: 'A deterministic, game-agnostic narrative game platform',
  url: 'https://game-engine.subzerodev.com',
  baseUrl: '/',

  onBrokenLinks: 'warn',

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
