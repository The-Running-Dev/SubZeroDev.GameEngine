import { access, readFile } from "node:fs/promises";

const html = await readFile(
  new URL("../dist/index.html", import.meta.url),
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
  /<meta\s+name="description"\s+content="A deterministic, game-agnostic platform for building reusable narrative-game mechanics\."\s*\/>/,
  /<meta\s+property="og:title"\s+content="SubZeroDev Game Engine"\s*\/>/,
  /<meta\s+property="og:description"\s+content="Build mechanics once\. Create infinite games\."\s*\/>/,
  /<meta\s+property="og:type"\s+content="website"\s*\/>/,
  /<meta\s+property="og:url"\s+content="https:\/\/game-engine\.subzerodev\.com\/"\s*\/>/,
  /<meta\s+property="og:image"\s+content="https:\/\/game-engine\.subzerodev\.com\/og-image\.png"\s*\/>/,
  /<link\s+rel="canonical"\s+href="https:\/\/game-engine\.subzerodev\.com\/"\s*\/>/,
  /<meta\s+name="twitter:card"\s+content="summary_large_image"\s*\/>/,
  /<meta\s+name="twitter:image"\s+content="https:\/\/game-engine\.subzerodev\.com\/og-image\.png"\s*\/>/,
  /<link\s+rel="icon"\s+type="image\/svg\+xml"\s+href="\/favicon\.svg"\s*\/>/,
];

for (const tag of requiredTags) {
  if (!tag.test(html)) {
    throw new Error(
      `Built HTML is missing required static metadata: ${tag.source}`,
    );
  }
}

console.log("Built HTML contains the required static social metadata.");
