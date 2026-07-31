/**
 * Text client — pure rendering (09-clients.md §3, §5).
 *
 * Contract: `09-clients.md` §3 ("Resolve a `LocKey` against the string table for display"
 * is the whole job; string-matching English is not), §5 (reason codes render, never crash).
 *
 * No I/O, no store access — every function here is `(data, strings) → string`. This is
 * where the client's one real obligation lives: every player-facing string resolves
 * through `resolveOrFallback`, never a literal English fallback baked into this module.
 */

import type { LocKey, StringTable } from "../../core/localization/types.js";
import type { AvailableAction, Scene } from "../../core/kernel/types.js";
import type { OutcomeMessage, StateChange } from "../../core/kernel/reasons.js";
import type { PlayerView } from "../../core/projection/types.js";
import type { ValidationError, ValidationWarning } from "../../core/validation/types.js";
import type { CampaignSummary, SaveHandle, SessionActionResult } from "../../core/session/types.js";

/**
 * Resolves `key` against `strings`, falling back to the raw key itself when absent —
 * never throws. Reason codes are additive (04 §12), so a client will eventually meet one
 * it wasn't built against; this is what makes that render instead of crash (09 §5).
 */
export function resolveOrFallback(strings: StringTable, key: LocKey): string {
  return Object.hasOwn(strings, key) ? strings[key]! : key;
}

/** `{name}` substitution against `OutcomeMessage.params` — presentation formatting (09
 *  §3's "format for the player's locale"), not game logic. An unmatched placeholder is
 *  left as-is rather than throwing, the same never-crash discipline as `resolveOrFallback`. */
function interpolate(template: string, params: Readonly<Record<string, string | number>> | undefined): string {
  if (!params) return template;
  return template.replace(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g, (match, name: string) =>
    Object.hasOwn(params, name) ? String(params[name]) : match,
  );
}

function renderAction(action: AvailableAction, strings: StringTable): string {
  const label = resolveOrFallback(strings, action.labelKey);
  if (action.available) return `  [${action.id}] ${label}`;
  const reason = action.reasonKey !== undefined ? resolveOrFallback(strings, action.reasonKey) : "unavailable";
  return `  [${action.id}] ${label} (${reason})`;
}

/**
 * `scene.body.text` arrives already rendered — `SceneBody.text` is the kind's own
 * `interpolateText` output (`kinds/story-graph/scene.ts`), substituted server-side before
 * the client ever sees it. Only the action list's bare `LocKey`s (`labelKey`,
 * `reasonKey`) still need client-side resolution, which is why `strings` is used below
 * and not against `scene.body` at all.
 */
export function renderScene(scene: Scene, strings: StringTable): string {
  const lines = [scene.body.text, ""];
  if (scene.actions.length === 0) {
    lines.push("(no actions available)");
  } else {
    for (const action of scene.actions) lines.push(renderAction(action, strings));
  }
  return lines.join("\n");
}

/**
 * `kindView` is `unknown` to the core by design (04 §9) — a client that has never seen the
 * kind that produced it cannot destructure it without importing `kinds/*`, which this
 * client must not. Rendered verbatim as JSON: boring on purpose (the ancestor spec's own
 * words) rather than reaching past the projection boundary.
 */
export function renderView(view: PlayerView): string {
  return [`Game ${view.gameId} — ${view.status}`, JSON.stringify(view.kindView, null, 2)].join("\n");
}

/**
 * `titleKey` renders unresolved — `getStrings` takes a `sessionId` (09 §2), and no session
 * exists yet at `listCampaigns` time. Not a workaround: a client "never works around a
 * missing operation" (09 §4) by inventing client-side resolution for one that doesn't
 * exist.
 */
export function renderCampaignList(campaigns: readonly CampaignSummary[]): string {
  if (campaigns.length === 0) return "(no campaigns available)";
  return campaigns.map((c) => `  [${c.campaignId}] ${c.titleKey} (${c.kindId})`).join("\n");
}

export function renderMessages(messages: readonly OutcomeMessage[], strings: StringTable): string {
  return messages
    .filter((m) => m.visible)
    .map((m) => interpolate(resolveOrFallback(strings, m.key), m.params))
    .join("\n");
}

/** Mechanical deltas print plainly from `visible` `StateChange`s — the narration is
 *  `renderMessages`' job, the numbers are this one's; never merged (09 §3, §6). */
export function renderChanges(changes: readonly StateChange[]): string {
  return changes
    .filter((c) => c.visible)
    .map((c) => `  ${c.path} ${c.op} (${c.previous !== undefined ? `${c.previous} -> ${c.value}` : `${c.value}`})`)
    .join("\n");
}

export function renderErrors(errors: readonly ValidationError[], strings: StringTable): string {
  return errors.map((e) => resolveOrFallback(strings, e.messageKey)).join("\n");
}

export function renderWarnings(warnings: readonly ValidationWarning[], strings: StringTable): string {
  return warnings.map((w) => `Warning: ${resolveOrFallback(strings, w.messageKey)}`).join("\n");
}

export function renderActionResult(result: SessionActionResult, strings: StringTable): string {
  const parts: string[] = [];

  if (result.ok && result.scene) {
    const messages = renderMessages(result.messages, strings);
    if (messages) parts.push(messages);
    const changes = renderChanges(result.changes);
    if (changes) parts.push(changes);
    parts.push(renderScene(result.scene, strings));
  } else {
    parts.push(renderErrors(result.errors, strings));
  }

  const warnings = renderWarnings(result.warnings, strings);
  if (warnings) parts.push(warnings);

  return parts.join("\n\n");
}

export function renderSaveHandle(handle: SaveHandle): string {
  return `Saved as "${handle.saveId}" at action ${handle.savedAtSeq}.`;
}
