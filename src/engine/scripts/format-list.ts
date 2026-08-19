/**
 * Shared "join or say none" formatter for the `scripts/` CLIs — `loc-coverage.ts` and
 * `diff-resolution.ts` each printed this same idiom independently; kept in one place so a
 * fix to the formatting itself doesn't need applying twice.
 */
export function joinOrNone(items: readonly string[]): string {
  return items.length ? items.join(", ") : "none";
}
