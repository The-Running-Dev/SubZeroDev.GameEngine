/**
 * Story-graph kind — text interpolation (03 §3.1).
 *
 * Contract: `03-story-graph-kind.md` §3.1.
 *
 * `visibleVariables` (`variables.ts`) is what filters the map this resolves against —
 * only visible variables ever reach here, so a template can never leak a hidden one.
 */

import type { Node } from "./nodes.js";
import type { VarValue } from "./variables.js";

/**
 * The alias scope a node's text interpolates in (03 §1.1): `{x}` in node `a::n` reads
 * `a::x`. A composed id's scope is everything through its last `::`; an include's entry
 * node — an `auto` node whose `goto` enters `<its id>::` — renders the module's entry
 * text, so its scope is its own id. An authored node's scope is empty.
 */
export function interpolationScope(node: Node): string {
  if (node.kind === "auto" && node.goto.startsWith(`${node.id}::`)) return `${node.id}::`;
  const at = node.id.lastIndexOf("::");
  return at === -1 ? "" : node.id.slice(0, at + 2);
}

/**
 * A fresh `RegExp` per call (never a shared module-level instance) — both
 * `interpolateText` and `placeholderNames` use the `g` flag, and a stateful shared
 * regex's `lastIndex` can leak between interleaved calls in a way a fresh instance
 * per call structurally cannot.
 */
function placeholderPattern(): RegExp {
  return /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;
}

/**
 * Substitutes `{name}` in an already-resolved template string with the current value of
 * a visible variable, looked up within `scope` (`interpolationScope`). A `{name}` for anything else — undeclared, or declared but not
 * visible — throws: 03 §3.1 calls this a load-time error, which Tier 1 (W14,
 * `validate.ts`'s `nonVisibleVariableInText` check, built against `placeholderNames`
 * below) is meant to make unreachable in valid content; this is the runtime backstop
 * until then, the same `Object.hasOwn`-guarded pattern every other content-controlled
 * lookup in this kind uses.
 */
export function interpolateText(
  template: string,
  visibleVariables: Readonly<Record<string, VarValue>>,
  scope = "",
): string {
  return template.replace(placeholderPattern(), (_match, name: string) => {
    const scoped = scope + name;
    if (!Object.hasOwn(visibleVariables, scoped)) {
      throw new Error(`story-graph text: "{${name}}" is not a visible declared variable`);
    }
    return String(visibleVariables[scoped]);
  });
}

/** Every `{name}` referenced in a template string, in order of appearance. */
export function placeholderNames(template: string): string[] {
  const names: string[] = [];
  const pattern = placeholderPattern();
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(template)) !== null) {
    names.push(match[1]!);
  }
  return names;
}
