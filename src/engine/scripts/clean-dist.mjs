import { rm } from "node:fs/promises";
import { resolve } from "node:path";

const dist = resolve(import.meta.dirname, "..", "dist");
await rm(dist, { recursive: true, force: true });
