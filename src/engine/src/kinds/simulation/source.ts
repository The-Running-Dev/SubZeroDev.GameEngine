/**
 * Simulation kind — the authoring source form and its extraction builder (10 §7; W52.1).
 *
 * Contract: `10-simulation-kind.md` §7. Mirrors `kinds/story-graph/source.ts`'s own pattern:
 * every source type is the runtime type with its top-level `LocKey` field(s) replaced by
 * `AuthoredText` via `Omit`, and `buildSimulationCampaign` is the mechanical lift only — it
 * performs no validation (`validate.ts`, W52's own Tier 1/2, still owns that).
 *
 * **Scoped to each definition's own identity/label fields, not every `LocKey` this kind's
 * content can carry.** A handful of deeply-nested fields — `Requirement.messageKey`,
 * `TerminationRule.messageKey`, `EventChoice.labelKey`, `EventOutcome.messages[].key` — stay
 * plain `LocKey` in source form here rather than gaining their own `AuthoredText` source
 * type. `validate.ts`'s Tier 1 check still resolves all of them against `strings`: this is a
 * narrower *authoring-ergonomics* surface, not a narrower *validation* one, the same
 * distinction `content.ts`'s own header draws between "campaign data" and "the resolver that
 * gives it behaviour" — extending every nested field to `AuthoredText` is authoring-ergonomics
 * work for a real content author this repository doesn't have yet, not part of proving the
 * Tier 1/2 surface this unit's `Done when` actually asks for.
 */

import type { LocKey } from "../../core/localization/types.js";
import type { AuthoredText } from "../../core/registry/types.js";
import type { StatusEffect } from "./state.js";
import type {
  JobDefinition,
  CourseDefinition,
  HousingDefinition,
  ItemDefinition,
  EventDefinition,
  NPCDefinition,
  GoalDefinition,
  ScenarioDefinition,
  DifficultyDefinition,
  OpportunityDefinition,
  AchievementDefinition,
  HeadlineDefinition,
  EmployerDefinition,
  LocationDefinition,
  BackgroundDefinition,
  TraitDefinition,
  SkillDefinition,
} from "./content.js";
import type { SimulationCampaign, SimulationActionLabelKeys } from "./campaign.js";

export type JobDefinitionSource = Omit<JobDefinition, "titleKey" | "descriptionKey"> & {
  title: AuthoredText;
  description: AuthoredText;
};
export type CourseDefinitionSource = Omit<CourseDefinition, "nameKey" | "descriptionKey"> & {
  name: AuthoredText;
  description: AuthoredText;
};
export type HousingDefinitionSource = Omit<HousingDefinition, "nameKey" | "descriptionKey"> & {
  name: AuthoredText;
  description: AuthoredText;
};
export type ItemDefinitionSource = Omit<ItemDefinition, "nameKey" | "descriptionKey"> & {
  name: AuthoredText;
  description: AuthoredText;
};
export type EventDefinitionSource = Omit<EventDefinition, "titleKey" | "descriptionKey"> & {
  title: AuthoredText;
  description: AuthoredText;
};
export type NPCDefinitionSource = Omit<NPCDefinition, "nameKey" | "descriptionKey"> & {
  name: AuthoredText;
  description: AuthoredText;
};
export type GoalDefinitionSource = Omit<GoalDefinition, "labelKey" | "descriptionKey"> & {
  label: AuthoredText;
  description: AuthoredText;
};
export type ScenarioDefinitionSource = Omit<ScenarioDefinition, "nameKey" | "descriptionKey"> & {
  name: AuthoredText;
  description: AuthoredText;
};
export type DifficultyDefinitionSource = Omit<DifficultyDefinition, "labelKey"> & { label: AuthoredText };
export type OpportunityDefinitionSource = Omit<OpportunityDefinition, "nameKey" | "descriptionKey"> & {
  name: AuthoredText;
  description: AuthoredText;
};
export type AchievementDefinitionSource = Omit<AchievementDefinition, "nameKey" | "descriptionKey"> & {
  name: AuthoredText;
  description: AuthoredText;
};
export type HeadlineDefinitionSource = Omit<HeadlineDefinition, "textKey"> & { text: AuthoredText };
export type EmployerDefinitionSource = Omit<EmployerDefinition, "nameKey"> & { name: AuthoredText };
export type LocationDefinitionSource = Omit<LocationDefinition, "nameKey" | "descriptionKey"> & {
  name: AuthoredText;
  description: AuthoredText;
};
export type BackgroundDefinitionSource = Omit<BackgroundDefinition, "nameKey" | "descriptionKey"> & {
  name: AuthoredText;
  description: AuthoredText;
};
export type TraitDefinitionSource = Omit<TraitDefinition, "nameKey" | "descriptionKey"> & {
  name: AuthoredText;
  description: AuthoredText;
};
export type SkillDefinitionSource = Omit<SkillDefinition, "nameKey"> & { name: AuthoredText };

export type SimulationActionLabelKeysSource = {
  planAdd: AuthoredText;
  planRemove: AuthoredText;
  planClear: AuthoredText;
  endWeek: AuthoredText;
};

export interface SimulationCampaignSource {
  description: AuthoredText;

  jobs: readonly JobDefinitionSource[];
  courses: readonly CourseDefinitionSource[];
  housing: readonly HousingDefinitionSource[];
  items: readonly ItemDefinitionSource[];
  events: readonly EventDefinitionSource[];
  npcs: readonly NPCDefinitionSource[];
  goals: readonly GoalDefinitionSource[];
  scenarios: readonly ScenarioDefinitionSource[];
  difficulties: readonly DifficultyDefinitionSource[];
  opportunities: readonly OpportunityDefinitionSource[];
  achievements: readonly AchievementDefinitionSource[];
  headlines: readonly HeadlineDefinitionSource[];
  employers: readonly EmployerDefinitionSource[];
  locations: readonly LocationDefinitionSource[];
  backgrounds: readonly BackgroundDefinitionSource[];
  traits: readonly TraitDefinitionSource[];
  skills: readonly SkillDefinitionSource[];

  scenarioId: string;
  goalFailurePrecedence: SimulationCampaign["goalFailurePrecedence"];
  startingEffects?: readonly StatusEffect[];

  sceneTemplate: AuthoredText;
  actionLabels: SimulationActionLabelKeysSource;
}

type Take = (text: AuthoredText) => LocKey;

function buildJob(source: JobDefinitionSource, take: Take): JobDefinition {
  const { title, description, ...rest } = source;
  return { ...rest, titleKey: take(title), descriptionKey: take(description) };
}

function buildCourse(source: CourseDefinitionSource, take: Take): CourseDefinition {
  const { name, description, ...rest } = source;
  return { ...rest, nameKey: take(name), descriptionKey: take(description) };
}

function buildHousing(source: HousingDefinitionSource, take: Take): HousingDefinition {
  const { name, description, ...rest } = source;
  return { ...rest, nameKey: take(name), descriptionKey: take(description) };
}

function buildItem(source: ItemDefinitionSource, take: Take): ItemDefinition {
  const { name, description, ...rest } = source;
  return { ...rest, nameKey: take(name), descriptionKey: take(description) };
}

function buildEvent(source: EventDefinitionSource, take: Take): EventDefinition {
  const { title, description, ...rest } = source;
  return { ...rest, titleKey: take(title), descriptionKey: take(description) };
}

function buildNPC(source: NPCDefinitionSource, take: Take): NPCDefinition {
  const { name, description, ...rest } = source;
  return { ...rest, nameKey: take(name), descriptionKey: take(description) };
}

function buildGoal(source: GoalDefinitionSource, take: Take): GoalDefinition {
  const { label, description, ...rest } = source;
  return { ...rest, labelKey: take(label), descriptionKey: take(description) };
}

function buildScenario(source: ScenarioDefinitionSource, take: Take): ScenarioDefinition {
  const { name, description, ...rest } = source;
  return { ...rest, nameKey: take(name), descriptionKey: take(description) };
}

function buildDifficulty(source: DifficultyDefinitionSource, take: Take): DifficultyDefinition {
  const { label, ...rest } = source;
  return { ...rest, labelKey: take(label) };
}

function buildOpportunity(source: OpportunityDefinitionSource, take: Take): OpportunityDefinition {
  const { name, description, ...rest } = source;
  return { ...rest, nameKey: take(name), descriptionKey: take(description) };
}

function buildAchievement(source: AchievementDefinitionSource, take: Take): AchievementDefinition {
  const { name, description, ...rest } = source;
  return { ...rest, nameKey: take(name), descriptionKey: take(description) };
}

function buildHeadline(source: HeadlineDefinitionSource, take: Take): HeadlineDefinition {
  const { text, ...rest } = source;
  return { ...rest, textKey: take(text) };
}

function buildEmployer(source: EmployerDefinitionSource, take: Take): EmployerDefinition {
  const { name, ...rest } = source;
  return { ...rest, nameKey: take(name) };
}

function buildLocation(source: LocationDefinitionSource, take: Take): LocationDefinition {
  const { name, description, ...rest } = source;
  return { ...rest, nameKey: take(name), descriptionKey: take(description) };
}

function buildBackground(source: BackgroundDefinitionSource, take: Take): BackgroundDefinition {
  const { name, description, ...rest } = source;
  return { ...rest, nameKey: take(name), descriptionKey: take(description) };
}

function buildTrait(source: TraitDefinitionSource, take: Take): TraitDefinition {
  const { name, description, ...rest } = source;
  return { ...rest, nameKey: take(name), descriptionKey: take(description) };
}

function buildSkill(source: SkillDefinitionSource, take: Take): SkillDefinition {
  const { name, ...rest } = source;
  return { ...rest, nameKey: take(name) };
}

function buildActionLabels(source: SimulationActionLabelKeysSource, take: Take): SimulationActionLabelKeys {
  return {
    planAdd: take(source.planAdd),
    planRemove: take(source.planRemove),
    planClear: take(source.planClear),
    endWeek: take(source.endWeek),
  };
}

/**
 * Walks `source` once, collecting every top-level `AuthoredText` it carries into a flat
 * array while replacing each with its own `key` in the returned runtime `content` — the
 * mechanical half of §7's authoring pipeline, mirroring `kinds/story-graph/source.ts`'s
 * `buildStoryGraphCampaign` exactly. `content` feeds `Campaign.content`; `authoredText`
 * feeds `buildCampaign` (`registry/build.ts`).
 */
export function buildSimulationCampaign(source: SimulationCampaignSource): {
  content: SimulationCampaign;
  authoredText: AuthoredText[];
} {
  const authoredText: AuthoredText[] = [];
  const take: Take = (text) => {
    authoredText.push(text);
    return text.key;
  };

  const content: SimulationCampaign = {
    descriptionKey: take(source.description),

    jobs: source.jobs.map((s) => buildJob(s, take)),
    courses: source.courses.map((s) => buildCourse(s, take)),
    housing: source.housing.map((s) => buildHousing(s, take)),
    items: source.items.map((s) => buildItem(s, take)),
    events: source.events.map((s) => buildEvent(s, take)),
    npcs: source.npcs.map((s) => buildNPC(s, take)),
    goals: source.goals.map((s) => buildGoal(s, take)),
    scenarios: source.scenarios.map((s) => buildScenario(s, take)),
    difficulties: source.difficulties.map((s) => buildDifficulty(s, take)),
    opportunities: source.opportunities.map((s) => buildOpportunity(s, take)),
    achievements: source.achievements.map((s) => buildAchievement(s, take)),
    headlines: source.headlines.map((s) => buildHeadline(s, take)),
    employers: source.employers.map((s) => buildEmployer(s, take)),
    locations: source.locations.map((s) => buildLocation(s, take)),
    backgrounds: source.backgrounds.map((s) => buildBackground(s, take)),
    traits: source.traits.map((s) => buildTrait(s, take)),
    skills: source.skills.map((s) => buildSkill(s, take)),

    scenarioId: source.scenarioId,
    goalFailurePrecedence: source.goalFailurePrecedence,
    ...(source.startingEffects !== undefined ? { startingEffects: source.startingEffects } : {}),

    sceneTemplateKey: take(source.sceneTemplate),
    actionLabelKeys: buildActionLabels(source.actionLabels, take),
  };

  return { content, authoredText };
}
