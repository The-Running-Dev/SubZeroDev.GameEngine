// @ts-check
import tseslint from "typescript-eslint";

/**
 * Determinism guard (engine spec §2.1). The engine must be bit-reproducible across
 * JavaScript runtimes, so non-deterministic and non-bit-stable APIs are banned in
 * source. Tests may use them.
 */
export default tseslint.config(
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.ts"],
    ignores: ["src/**/*.test.ts"],
    rules: {
      "no-restricted-properties": [
        "error",
        { object: "Math", property: "random", message: "Determinism: use the seeded RNG (core/rng)." },
        { object: "Math", property: "pow", message: "Determinism: not bit-stable across engines; use integer math." },
        { object: "Math", property: "exp", message: "Determinism: not bit-stable across engines." },
        { object: "Math", property: "log", message: "Determinism: not bit-stable across engines." },
        { object: "Math", property: "sin", message: "Determinism: not bit-stable across engines." },
        { object: "Math", property: "cos", message: "Determinism: not bit-stable across engines." },
        { object: "Math", property: "tan", message: "Determinism: not bit-stable across engines." },
        { object: "Date", property: "now", message: "Determinism: no wall-clock in engine state." }
      ],
      "no-restricted-globals": [
        "error",
        { name: "Date", message: "Determinism: no wall-clock in engine logic; pass time in as data." }
      ]
    }
  }
);
