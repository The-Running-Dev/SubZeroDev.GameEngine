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
 */
export default function Home(): ReactNode {
  return <Redirect to={useBaseUrl('/docs/')} />;
}
