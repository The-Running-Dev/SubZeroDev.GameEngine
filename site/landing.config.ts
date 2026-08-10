import { defineLandingPage } from "subzerodev-platform-ui-landing-page";

/**
 * Custom-adapter seam (subzerodev-platform-ui-landing-page@0.2.0): declares this
 * site's two existing routes without handing the package a Vite config of its
 * own. The package's adapter build generates each route's HTML shell from the
 * metadata below and bundles `entry` with its own internal Vite; component
 * markup, styles, and public assets stay entirely Engine-owned.
 *
 * `allow: [".."]` mirrors the former vite.config.ts dev-server fs.allow: the
 * engine package dependency resolves to `../src/engine` (a `file:` link),
 * outside this package's root.
 */
export default defineLandingPage({
  allow: [".."],
  routes: [
    {
      path: "/",
      entry: "src/main.tsx",
      metadata: {
        title: "SubZeroDev Game Engine — Build mechanics once.",
        description:
          "A deterministic, game-agnostic platform for building reusable narrative-game mechanics.",
        canonicalUrl: "https://game-engine.subzerodev.com/",
        openGraph: {
          title: "SubZeroDev Game Engine",
          description: "Build mechanics once. Create infinite games.",
          type: "website",
          url: "https://game-engine.subzerodev.com/",
          imageUrl: "https://game-engine.subzerodev.com/og-image.png",
          imageWidth: 1200,
          imageHeight: 630,
        },
        twitter: {
          card: "summary_large_image",
          imageUrl: "https://game-engine.subzerodev.com/og-image.png",
        },
        icons: [
          { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
          {
            rel: "icon",
            href: "/favicon-32x32.png",
            type: "image/png",
            sizes: "32x32",
          },
          {
            rel: "icon",
            href: "/favicon-16x16.png",
            type: "image/png",
            sizes: "16x16",
          },
          { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
        ],
        themeColor: "#090a0d",
        noScript: "This site needs JavaScript to render the landing page.",
      },
    },
    {
      path: "/roadmap/",
      entry: "src/roadmap/main.tsx",
      metadata: {
        title: "Roadmap — SubZeroDev Game Engine",
        description:
          "What SubZeroDev Game Engine has built, what comes next, and why it became 44 work units.",
        canonicalUrl: "https://game-engine.subzerodev.com/roadmap/",
        openGraph: {
          title: "SubZeroDev Game Engine Roadmap",
          description:
            "What is built, what is next, and why the queue is deterministic.",
          type: "website",
          url: "https://game-engine.subzerodev.com/roadmap/",
          imageUrl: "https://game-engine.subzerodev.com/og-image.png",
        },
        twitter: {
          card: "summary_large_image",
          imageUrl: "https://game-engine.subzerodev.com/og-image.png",
        },
        icons: [
          { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
          {
            rel: "icon",
            href: "/favicon-32x32.png",
            type: "image/png",
            sizes: "32x32",
          },
          {
            rel: "icon",
            href: "/favicon-16x16.png",
            type: "image/png",
            sizes: "16x16",
          },
          { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
        ],
        themeColor: "#090a0d",
        noScript: "This site needs JavaScript to render the roadmap.",
      },
    },
  ],
});
