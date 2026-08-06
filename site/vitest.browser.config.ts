import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = fileURLToPath(new URL(".", import.meta.url));

// The docs-template container (Alpine) has no glibc, so Playwright's own
// bundled Chromium download cannot run there and `playwright install
// --with-deps` fails outright (apk, not apt-get). CI installs Alpine's
// system `chromium` package instead and points here at it; everywhere else
// (local dev, the ubuntu-latest `engine` job) leaves this unset and gets
// Playwright's normal managed browser.
const systemChromiumPath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;

// Real-browser counterpart to vite.config.ts's jsdom project (W65). jsdom
// performs no layout, so it cannot back a computed-style, hit-area, or
// horizontal-overflow assertion -- these specs run inside an actual Chromium
// tab instead. Kept as a separate config, not a `test.projects` entry,
// because jsdom and browser-mode specs never need to run in the same
// invocation: `npm test` stays fast and unchanged, `npm run test:browser` is
// the real-browser gate `npm run check` also runs.
export default defineConfig({
  plugins: [react()],
  server: { fs: { allow: [siteRoot, resolve(siteRoot, "..")] } },
  // Pre-bundling the engine package (and its @noble/hashes dependency) mid-run
  // triggers a Vite dependency-optimizer reload that can flake a test run
  // (W65.6) -- listing it here forces the pre-bundle before any test starts.
  optimizeDeps: {
    include: ["@the-running-dev/game-engine"],
  },
  test: {
    include: ["src/**/*.browser.test.{ts,tsx}"],
    setupFiles: ["./src/test/browser-setup.ts"],
    // The unavailable-choice fixture (`fixtures.tsx`) retries a real,
    // randomly-forking route up to 60 times in the worst case.
    testTimeout: 30000,
    // One reporter run per file keeps snapshot/reference state (and the
    // per-file CDP session emulation in viewport.browser.test.tsx) isolated.
    browser: {
      enabled: true,
      // launchOptions is a provider-level option (applies to every
      // instance), not a per-instance one -- @vitest/browser-playwright
      // reads only `this.options.launchOptions` when it opens the browser.
      provider: playwright(
        systemChromiumPath
          ? {
              launchOptions: {
                executablePath: systemChromiumPath,
                // Running as root in the container (no unprivileged user is
                // set up in the docs-template image) trips Chromium's
                // sandbox; only added when we've already switched to the
                // system browser, i.e. only in that container.
                args: ["--no-sandbox"],
              },
            }
          : undefined,
      ),
      headless: true,
      screenshotFailures: false,
      instances: [{ browser: "chromium" }],
      viewport: { width: 1280, height: 800 },
    },
  },
});
