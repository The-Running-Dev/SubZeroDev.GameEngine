import {type ReactNode} from 'react';
import {Redirect} from '@docusaurus/router';
import useBaseUrl from '@docusaurus/useBaseUrl';

/**
 * Site root. The specs live under `routeBasePath: 'docs'`, so nothing else
 * claims `/` -- and the navbar brand links there from every page, including
 * 404. Without a route here `onBrokenLinks: 'throw'` fails the build.
 *
 * Owning this file also decouples the site root from the base image: it
 * previously resolved only because the image happened to ship demo pages
 * under `src/pages`, which the classic preset picked up and which a later
 * image revision removed.
 *
 * The target repeats `routeBasePath` from docusaurus.config.ts, which carries
 * the reciprocal warning. Kept as a literal deliberately -- that value is
 * frozen by plans/02 decision 2, so a shared constant would add indirection
 * for a rename that is not expected to happen.
 */
export default function Home(): ReactNode {
  return <Redirect to={useBaseUrl('/docs/')} />;
}
