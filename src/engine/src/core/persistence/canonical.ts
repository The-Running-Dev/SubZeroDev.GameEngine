/**
 * Canonical serialization (engine spec §2.1, §18.4).
 *
 * Determinism's acceptance test is *byte-identical* `serialize()` output from the same
 * seed and inputs. That is only achievable if serialization is canonical: object keys
 * sorted, no non-finite numbers, no float ambiguity. JSON.stringify alone is not
 * canonical — its key order follows insertion order, which follows code paths.
 *
 * State that must round-trip stores 64-bit values (like the RNG) as hex strings, never
 * as BigInt or float — so `bigint` is rejected here on purpose.
 */

import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";

export function canonicalStringify(value: unknown): string {
  return write(value);
}

/** sha-256 of a UTF-8 string, hex-encoded — the shared hash primitive behind
 *  `computeResolutionId`, `computeChecksum`, and the portable campaign format's digests. */
export function sha256Hex(text: string): string {
  return bytesToHex(sha256(new TextEncoder().encode(text)));
}

function write(v: unknown): string {
  if (v === null) return "null";

  switch (typeof v) {
    case "number":
      if (!Number.isFinite(v)) throw new Error("canonical: non-finite number (NaN/Infinity) is not serializable");
      return JSON.stringify(v);
    case "boolean":
    case "string":
      return JSON.stringify(v);
    case "bigint":
      throw new Error("canonical: bigint is not allowed in state — encode 64-bit values as hex strings");
    case "undefined":
      throw new Error("canonical: undefined has no representation — omit the key");
    case "object": {
      if (Array.isArray(v)) return `[${v.map(write).join(",")}]`;
      const obj = v as Record<string, unknown>;
      const keys = Object.keys(obj)
        .filter((k) => obj[k] !== undefined) // JSON drops undefined-valued keys; match that
        .sort();
      const parts = keys.map((k) => `${JSON.stringify(k)}:${write(obj[k])}`);
      return `{${parts.join(",")}}`;
    }
    default:
      throw new Error(`canonical: unsupported type ${typeof v}`);
  }
}

/** Serialize state to its canonical string form. */
export function serialize(state: unknown): string {
  return canonicalStringify(state);
}

/** Parse a serialized state string back to a value. */
export function deserialize<T>(data: string): T {
  return JSON.parse(data) as T;
}
