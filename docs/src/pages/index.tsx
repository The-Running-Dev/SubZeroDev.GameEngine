import {type ReactNode} from 'react';
import Head from '@docusaurus/Head';

/**
 * Site root. The docs render under /docs (routeBasePath: 'docs'), and the base
 * image no longer ships a root page, so without this the bare domain 404s --
 * and the bare domain is the URL the README advertises.
 *
 * SubZeroDev.WinGet solved the same problem with docs/static/index.html, and
 * the redirect below is deliberately the same mechanism: a meta refresh plus a
 * canonical link, which forwards without JavaScript and keeps the root from
 * competing with /docs/ in search results.
 *
 * It has to be a route here rather than a static file, because this repository
 * sets onBrokenLinks: 'throw' where WinGet keeps the template default of
 * 'warn'. The navbar brand links to / from every page, including 404, and
 * Docusaurus resolves those links against routes only -- a static file does not
 * satisfy the checker. Verified: static/index.html left all nine broken links
 * intact and failed the build.
 *
 * Renaming routeBasePath means updating the target below; docusaurus.config.ts
 * carries the reciprocal warning.
 *
 * Delete this if the site ever moves to routeBasePath: '/', which would make
 * the docs homepage the root on its own.
 */
export default function Home(): ReactNode {
  return (
    <>
      <Head>
        <meta httpEquiv="refresh" content="0; url=/docs/" />
        <link rel="canonical" href="https://game-engine.subzerodev.com/docs/" />
      </Head>
      <p>
        Redirecting to <a href="/docs/">the documentation</a>…
      </p>
    </>
  );
}
