import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

/**
 * Local Docusaurus config — overrides the base image's default when this
 * directory is copied over /template (see ./Dockerfile). Content lives in
 * ./docs (engine/); the sidebar is ./sidebar.ts.
 *
 * Published at the custom domain configured in GitHub Pages
 * (game-engine.subzerodev.com). Broken links fail the build so documentation
 * regressions cannot pass peer review unnoticed.
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
          // Renaming this also requires updating src/pages/index.tsx, whose
          // meta refresh forwards the site root here. That target is a plain
          // string, so onBrokenLinks cannot catch the drift.
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
