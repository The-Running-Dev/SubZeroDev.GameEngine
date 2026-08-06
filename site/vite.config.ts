import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = fileURLToPath(new URL(".", import.meta.url));

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    __GAME_ENGINE_PRODUCTION__: JSON.stringify(mode === "production"),
  },
  plugins: [react()],
  server: { fs: { allow: [siteRoot, resolve(siteRoot, "..")] } },
  build: {
    rollupOptions: {
      input: {
        main: resolve(siteRoot, "index.html"),
        roadmap: resolve(siteRoot, "roadmap/index.html"),
        play: resolve(siteRoot, "play/index.html"),
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    // Real-browser specs (W65) live alongside these under src/**/*.browser.test.*
    // and run only via vitest.browser.config.ts's `npm run test:browser` --
    // jsdom performs no layout, so they'd fail here for the wrong reason.
    exclude: ["**/node_modules/**", "**/.git/**", "**/*.browser.test.{ts,tsx}"],
  },
}));
