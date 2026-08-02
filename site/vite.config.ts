import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = fileURLToPath(new URL(".", import.meta.url));

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: { fs: { allow: [siteRoot, resolve(siteRoot, "..")] } },
  build: {
    rollupOptions: {
      input: {
        main: resolve(siteRoot, "index.html"),
        roadmap: resolve(siteRoot, "roadmap/index.html"),
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
  },
});
