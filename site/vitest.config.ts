import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = fileURLToPath(new URL(".", import.meta.url));

// jsdom project for component/unit specs. Split from vite.config.ts (removed
// with W69's move to the reusable landing-page package's adapter build,
// which owns route bundling now) so this file's only job is describing the
// test run, not a build. Real-browser specs (vitest.browser.config.ts, W65)
// stay a separate config for the same reason it always was: jsdom performs
// no layout, so it cannot back a computed-style, hit-area, or visual-snapshot
// assertion.
export default defineConfig({
  plugins: [react()],
  server: { fs: { allow: [siteRoot, resolve(siteRoot, "..")] } },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    exclude: ["**/node_modules/**", "**/.git/**", "**/*.browser.test.{ts,tsx}"],
  },
});
