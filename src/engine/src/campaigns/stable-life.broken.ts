/**
 * Content — five deliberately broken copies of the "Stable Life" source (10 §14, W52.5),
 * each a single-field mutation of `stableLifeSource` — proving `validateCampaign` (`kinds/
 * simulation/validate.ts`) against real, `buildSimulationCampaign`-shaped content rather
 * than only the synthetic fixtures its own unit tests already use. Mirrors
 * `campaigns/bulgaria-bureaucracy.broken.ts`'s own pattern exactly (`plans/
 * 22-w15-bureaucracy-campaign-and-broken-fixtures.md`, Decision 4).
 *
 * Two fixtures (`missingStringKeyFixture`, `readOnlyFieldFixture`) add one `startingEffects`
 * entry rather than mutate an existing field — `stableLifeSource` itself declares none, the
 * same reason `unreachableNodeFixture` (bulgaria) adds a node instead of mutating one: there
 * is nothing existing to break for that specific Tier 1 family.
 *
 * Unpublished regression fixture, not a publication source: `SubZeroDev.Adventures.Content`
 * owns canonical narrative source and publication (`20-contract.md` §19).
 */

import type { Modifier, StatusEffect } from "../kinds/simulation/state.js";
import type { GoalDefinitionSource, NPCDefinitionSource } from "../kinds/simulation/source.js";
import { stableLifeSource } from "./stable-life.js";

function clone(): typeof stableLifeSource {
  return structuredClone(stableLifeSource);
}

/** Tier 1, `duplicate_id` — the one declared goal is duplicated. */
export const duplicateIdFixture = ((): typeof stableLifeSource => {
  const source = clone();
  const goal = source.goals[0]! as GoalDefinitionSource;
  return { ...source, goals: [goal, structuredClone(goal)] };
})();

/** Tier 1, `dangling_reference` — the scenario's `startingHousingId` points nowhere. */
export const danglingReferenceFixture = ((): typeof stableLifeSource => {
  const source = clone();
  source.scenarios[0]!.startingHousingId = "housing-nonexistent";
  return source;
})();

/** Tier 1, `numeric_natural_key` — an NPC id that is all-digits, rejected because
 *  `world.npcs.<id>` addresses a collection member by natural key (§7.1). */
export const numericNaturalKeyFixture = ((): typeof stableLifeSource => {
  const source = clone();
  const npc: NPCDefinitionSource = {
    name: { key: "stable-life-broken.npc.name", text: "Numbered NPC" },
    description: { key: "stable-life-broken.npc.description", text: "An NPC with a bad id." },
    id: "123",
    defaultRole: "neighbor",
    initialRelationship: { affinity: 0, trust: 0, respect: 0, resentment: 0 },
    availability: [],
    tags: [],
  };
  return { ...source, npcs: [npc] };
})();

/** Tier 1, `missing_string_key` — a `startingEffects` entry whose `descriptionKey` was never
 *  registered into `strings` (`startingEffects` is not walked by `buildSimulationCampaign`'s
 *  own `take()`, so its `LocKey`s must be registered by the outer `buildCampaign` call — this
 *  fixture's own test deliberately omits that). */
export const missingStringKeyFixture = ((): typeof stableLifeSource => {
  const source = clone();
  const effect: StatusEffect = {
    id: "effect-broken",
    sourceId: "fixture-broken",
    sourceKind: "system",
    modifiers: [{ target: "player.needs.energy", operation: "add", value: 1, sourceId: "fixture-broken" }],
    appliedWeek: 1,
    stacking: "refresh",
    descriptionKey: "stable-life-broken.effect.missing",
    visible: true,
  };
  return { ...source, startingEffects: [effect] };
})();

/** Tier 1, `read_only_field` — a `startingEffects` modifier targets a formula-only derived
 *  path (§6.1's four, `world.strangeness` among them). */
export const readOnlyFieldFixture = ((): typeof stableLifeSource => {
  const source = clone();
  const modifier: Modifier = { target: "world.strangeness", operation: "add", value: 1, sourceId: "fixture-broken" };
  const effect: StatusEffect = {
    id: "effect-broken",
    sourceId: "fixture-broken",
    sourceKind: "system",
    modifiers: [modifier],
    appliedWeek: 1,
    stacking: "refresh",
    descriptionKey: "stable-life.campaign.description",
    visible: true,
  };
  return { ...source, startingEffects: [effect] };
})();
