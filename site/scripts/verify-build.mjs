import { access, readdir, readFile } from "node:fs/promises";

const landingHtml = await readFile(
  new URL("../dist/index.html", import.meta.url),
  "utf8",
);
const roadmapHtml = await readFile(
  new URL("../dist/roadmap/index.html", import.meta.url),
  "utf8",
);

const requiredAssets = [
  "og-image.png",
  "favicon.svg",
  "favicon-16x16.png",
  "favicon-32x32.png",
  "apple-touch-icon.png",
];

for (const asset of requiredAssets) {
  await access(new URL(`../dist/${asset}`, import.meta.url)).catch(() => {
    throw new Error(`Built output is missing referenced asset: ${asset}`);
  });
}

const requiredTags = [
  /<meta\s+name="description"\s+content="A deterministic, game-agnostic platform for building reusable narrative-game mechanics\."\s*\/?>/,
  /<meta\s+property="og:title"\s+content="SubZeroDev Game Engine"\s*\/?>/,
  /<meta\s+property="og:description"\s+content="Build mechanics once\. Create infinite games\."\s*\/?>/,
  /<meta\s+property="og:type"\s+content="website"\s*\/?>/,
  /<meta\s+property="og:url"\s+content="https:\/\/game-engine\.subzerodev\.com\/"\s*\/?>/,
  /<meta\s+property="og:image"\s+content="https:\/\/game-engine\.subzerodev\.com\/og-image\.png"\s*\/?>/,
  /<link\s+rel="canonical"\s+href="https:\/\/game-engine\.subzerodev\.com\/"\s*\/?>/,
  /<meta\s+name="twitter:card"\s+content="summary_large_image"\s*\/?>/,
  /<meta\s+name="twitter:image"\s+content="https:\/\/game-engine\.subzerodev\.com\/og-image\.png"\s*\/?>/,
  /<link\s+rel="icon"\s+href="\/favicon\.svg"\s+type="image\/svg\+xml"\s*\/?>/,
];

for (const tag of requiredTags) {
  if (!tag.test(landingHtml)) {
    throw new Error(
      `Built HTML is missing required static metadata: ${tag.source}`,
    );
  }
}

const roadmapTags = [
  /<meta\s+name="description"\s+content="What SubZeroDev Game Engine has built, what comes next, and why it became 44 work units\."\s*\/?>/,
  /<meta\s+property="og:url"\s+content="https:\/\/game-engine\.subzerodev\.com\/roadmap\/"\s*\/?>/,
  /<link\s+rel="canonical"\s+href="https:\/\/game-engine\.subzerodev\.com\/roadmap\/"\s*\/?>/,
  /<script type="module" crossorigin src="\/assets\//,
];

for (const tag of roadmapTags) {
  if (!tag.test(roadmapHtml))
    throw new Error(
      `Built roadmap HTML is missing required metadata: ${tag.source}`,
    );
}

if (/\/src\//.test(landingHtml) || /\/src\//.test(roadmapHtml)) {
  throw new Error("Built HTML references a development-only source path.");
}

// 13-playable-web-demo.md §4: browser portability is an engine property, and the gate for it
// is an assertion over the emitted bundle — not the build having succeeded. `site/` depends on
// `src/engine/` by path, so an engine change can reintroduce a Node-only import; "the bundler
// would have complained" is the same class of claim §4 already rejects for typechecking.
const assetsDir = new URL("../dist/assets/", import.meta.url);
const bundles = (await readdir(assetsDir)).filter((name) =>
  name.endsWith(".js"),
);

if (bundles.length === 0)
  throw new Error("Built output contains no JavaScript bundle to verify.");

// `node:`-prefixed specifiers in any form a bundler could leave behind, plus the Node globals
// that reach the same runtime without an import.
const nodeOnlyPatterns = [
  /\bfrom\s*["']node:/,
  /\brequire\(\s*["']node:/,
  /\bimport\(\s*["']node:/,
  /\b__dirname\b/,
  /\b__filename\b/,
];

for (const bundle of bundles) {
  const code = await readFile(new URL(bundle, assetsDir), "utf8");
  for (const pattern of nodeOnlyPatterns) {
    if (pattern.test(code))
      throw new Error(
        `Built bundle assets/${bundle} reaches a Node-only runtime (${pattern.source}). ` +
          "The browser entry point must contain no node: import and no unguarded Node global.",
      );
  }
}

console.log(
  `Both built HTML entry points contain their required static metadata, and ${bundles.length} bundle(s) are free of Node-only runtime references.`,
);
