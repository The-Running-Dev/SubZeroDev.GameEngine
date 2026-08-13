/**
 * W71's first real content-pack pair.
 *
 * `stableLifeBasePack` wraps the existing synthetic Stable Life campaign as a distributable
 * base. `bulgariaCulturePack` deliberately replaces that campaign wholesale under the same
 * id, then changes only the voice-facing strings needed to prove the pack fold. W72 owns
 * the volume work: Bulgarian jobs, places, events, housing, possessions, and prices.
 */

import type { ContentPack } from "../core/registry/packs.js";
import { buildStableLifeCampaign } from "./stable-life.js";

function builtStableLife() {
  const result = buildStableLifeCampaign();
  if (!result.ok || !result.value) throw new Error("expected the Stable Life campaign to build");
  return result.value;
}

const baseCampaign = builtStableLife();
const bulgarianCampaign = builtStableLife();

export const stableLifeBasePack: ContentPack = {
  id: "stable-life-base",
  version: "1.0.0",
  kindId: "simulation",
  dependsOn: [],
  campaigns: [baseCampaign],
  strings: baseCampaign.strings,
};

/**
 * A deliberate small voice layer, rather than partial setting data. This is enough to prove
 * replacement, string override, client rendering, resolution identity, and replay honesty;
 * W72 expands it into a complete Bulgarian setting.
 */
export const bulgariaCulturePack: ContentPack = {
  id: "stable-life-bulgaria",
  version: "1.0.0",
  kindId: "simulation",
  dependsOn: [{ id: stableLifeBasePack.id, version: stableLifeBasePack.version }],
  campaigns: [bulgarianCampaign],
  strings: new Map([
    ["stable-life.campaign.title", "Стабилен живот"],
    ["stable-life.scene.status", "Седмица {week}, година {year}. Пари: {cash} лв. Енергия: {energy}."],
    ["stable-life.action.plan-add.label", "Добави към плана"],
    ["stable-life.action.plan-remove.label", "Премахни от плана"],
    ["stable-life.action.plan-clear.label", "Изчисти плана"],
    ["stable-life.action.end-week.label", "Приключи седмицата"],
  ]),
};
