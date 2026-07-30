import { readFile } from "node:fs/promises";

const html = await readFile(
  new URL("../dist/index.html", import.meta.url),
  "utf8",
);

const requiredTags = [
  /<meta\s+name="description"\s+content="A deterministic, game-agnostic platform for building reusable narrative-game mechanics\."\s*\/>/,
  /<meta\s+property="og:title"\s+content="SubZeroDev Game Engine"\s*\/>/,
  /<meta\s+property="og:description"\s+content="Build mechanics once\. Create infinite games\."\s*\/>/,
  /<meta\s+property="og:type"\s+content="website"\s*\/>/,
  /<meta\s+name="twitter:card"\s+content="summary"\s*\/>/,
];

for (const tag of requiredTags) {
  if (!tag.test(html)) {
    throw new Error(
      `Built HTML is missing required static metadata: ${tag.source}`,
    );
  }
}

console.log("Built HTML contains the required static social metadata.");
