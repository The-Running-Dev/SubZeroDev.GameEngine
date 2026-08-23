/**
 * Public author-time API.
 *
 * Runtime hosts consume the package root.  Repositories that own campaign source use this
 * explicit subpath so authored narrative content does not become part of the runtime API.
 * Contract: design/20-contract.md, W74.
 */

export { buildCampaign } from "./core/registry/build.js";
export { buildStoryGraphCampaign } from "./kinds/story-graph/source.js";
export { buildSimulationCampaign } from "./kinds/simulation/source.js";
export {
  buildAdventureCampaign,
  createAdventureSource,
  migrateV1AdventureState,
} from "./campaigns/adventure-builder.js";
export { toPortable } from "./portable/format.js";
export { digestPortableCampaign, digestManifestResolution } from "./portable/digest.js";
export { buildReplayOutcome, findDivergence, runReplayFixture } from "./core/replay/runner.js";

export type {
  AdventureConfig,
  AdventureEnding,
  AdventureRoute,
} from "./campaigns/adventure-builder.js";
export type {
  AchievementDefinitionSource,
  AutoNodeSource,
  ChoiceNodeSource,
  ChoiceSource,
  EndingNodeSource,
  NodeSource,
  RandomNodeSource,
  StoryGraphCampaignSource,
  VariableDeclSource,
  VariableSchemaSource,
} from "./kinds/story-graph/source.js";
export type { StoryGraphCampaign } from "./kinds/story-graph/campaign.js";
export type { StoryGraphKindState } from "./kinds/story-graph/state.js";
export type {
  AchievementDefinitionSource as SimulationAchievementDefinitionSource,
  BackgroundDefinitionSource,
  CourseDefinitionSource,
  DifficultyDefinitionSource,
  EmployerDefinitionSource,
  EventDefinitionSource,
  GoalDefinitionSource,
  HeadlineDefinitionSource,
  HousingDefinitionSource,
  ItemDefinitionSource,
  JobDefinitionSource,
  LocationDefinitionSource,
  NPCDefinitionSource,
  OpportunityDefinitionSource,
  ScenarioDefinitionSource,
  SimulationActionLabelKeysSource,
  SimulationCampaignSource,
  SkillDefinitionSource,
  TraitDefinitionSource,
} from "./kinds/simulation/source.js";
export type { Consequence, VarValue } from "./kinds/story-graph/variables.js";
export type { RandomTransition } from "./kinds/story-graph/nodes.js";
export type {
  Condition,
  CommandResult,
  AuthoredText,
  BuiltCampaign,
  Campaign,
  PortableCampaign,
  PortableCampaignBody,
  PortableCatalog,
  PortableManifest,
  PortableManifestEntry,
  PortableMigration,
} from "./index.js";
export type {
  Outcome,
  ReplayFixture,
  ReplayVerdict,
  Submission,
} from "./core/replay/types.js";
export type { ReplayResult, ReplayRunnerContext } from "./core/replay/runner.js";
