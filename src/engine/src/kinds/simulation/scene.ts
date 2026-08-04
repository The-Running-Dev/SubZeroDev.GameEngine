/**
 * Simulation kind — `scene` (10-simulation-kind.md §9; 04 §6).
 *
 * Contract: `10-simulation-kind.md` §9; `04-core.md` §6.
 *
 * A literal `Kind<SimulationKindState>` method. There is no authored "node text" the way
 * story-graph has — this kind's `scene` is a status summary instead, the same role
 * `world-graph`'s own `scene` plays (12 §7: "tick, cash, guest count, objective progress").
 * Renders from `campaign.sceneTemplateKey` (`campaign.ts`) against the registry's string
 * table only (§9) — a template the registry cannot resolve fails registry construction
 * (Tier 1, `validate.ts`), never a raw key at play; this function's own `throw` is a runtime
 * backstop for the same reason `kinds/story-graph/scene.ts`'s is.
 */

import type { KindContext, SceneBody } from "../../core/kernel/types.js";
import { resolveLocKey } from "../../core/localization/resolve.js";
import type { SimulationCampaign } from "./campaign.js";
import type { SimulationKindState } from "./state.js";

const PLACEHOLDER_PATTERN = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;

function interpolate(template: string, values: Readonly<Record<string, string | number>>): string {
  return template.replace(PLACEHOLDER_PATTERN, (match, name: string) =>
    Object.hasOwn(values, name) ? String(values[name]) : match,
  );
}

export function scene(state: SimulationKindState, ctx: KindContext): SceneBody {
  const content = ctx.campaign.content as SimulationCampaign;

  const template = resolveLocKey(ctx.registry.strings, content.sceneTemplateKey);
  if (template === undefined) {
    throw new Error(`simulation scene: no string registered for "${content.sceneTemplateKey}"`);
  }

  const cents = state.player.finances.cashCents;
  const text = interpolate(template, {
    week: state.calendar.currentWeek,
    year: state.calendar.currentYear,
    cash: (cents / 100).toFixed(2),
    health: state.player.needs.health,
    energy: state.player.needs.energy,
    happiness: state.player.needs.happiness,
    stress: state.player.needs.stress,
    satiety: state.player.needs.satiety,
  });

  return { textKey: content.sceneTemplateKey, text };
}
