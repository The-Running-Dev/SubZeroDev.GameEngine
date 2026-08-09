// design/15-platform-static-host.md §6: "a browser production smoke showing /play/ makes
// no engine API request, and no request at all outside the same-origin campaigns/ files
// it is served from" (13-playable-web-demo.md §6). Runs against a real running container,
// not the dev server, so it proves the property the shipped image actually has.
//
// Usage: node browser-smoke.mjs http://127.0.0.1:8080

import { chromium } from "playwright";

const baseUrl = process.argv[2];
if (!baseUrl) {
  console.error("Usage: node browser-smoke.mjs <base-url>");
  process.exit(2);
}

const origin = new URL(baseUrl).origin;
const requests = [];

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  page.on("request", (request) => requests.push(request.url()));

  const response = await page.goto(`${baseUrl}/play/`, { waitUntil: "networkidle" });
  if (!response || !response.ok()) {
    throw new Error(`GET /play/ did not return a successful response (status ${response?.status()}).`);
  }

  const crossOrigin = requests.filter((url) => new URL(url).origin !== origin);
  if (crossOrigin.length > 0) {
    throw new Error(`Cross-origin request(s) observed, which /play/ must never make:\n${crossOrigin.join("\n")}`);
  }

  // Every same-origin request is either a static asset the page itself references
  // (html/js/css/images/fonts) or a campaigns/ JSON file the browser client fetches at
  // runtime (site/src/play/composition.ts). Anything else -- an /api/, /action/, /mcp/,
  // or /session/-shaped path -- would be the engine API this host must never expose.
  const engineApiShaped = requests.filter((url) => {
    const path = new URL(url).pathname;
    return /\/(api|action|mcp|session)(\/|$)/i.test(path);
  });
  if (engineApiShaped.length > 0) {
    throw new Error(`Engine-API-shaped request(s) observed:\n${engineApiShaped.join("\n")}`);
  }

  console.log(`OK: ${requests.length} same-origin request(s) for /play/, none engine-API-shaped.`);
} finally {
  await browser.close();
}
