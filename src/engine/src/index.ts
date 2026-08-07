// Public surface defined for W41: `plans/40-w41-engine-consumer-boundary.md`.

export {
  createEngine,
  isValidGameStateShape,
} from "./core/kernel/engine.js";

export {
  buildCampaign,
  buildContentRegistry,
} from "./core/registry/build.js";

export { buildValidatedContentRegistry } from "./core/validation/tiered.js";
export { createInMemorySessionStore, createSessionLayer, upsertAchievements } from "./core/session/store.js";
export { createInMemoryProfileStore } from "./core/session/profile-store.js";
export { TextClient } from "./clients/text/client.js";
export { defaultIdSource, defaultClock } from "./core/composition/defaults.js";
export { createCountingIds } from "./core/determinism/counting-ids.js";
export { nullEmitter, createRecordingEmitter, jsonlEmitter } from "./core/observability/emitter.js";
export { resolveLocKey } from "./core/localization/resolve.js";
export { storyGraphKind } from "./kinds/story-graph/kind.js";
export { simulationKind } from "./kinds/simulation/kind.js";
export { worldGraphKind } from "./kinds/world-graph/kind.js";
export { buildWorldGraphCampaign } from "./kinds/world-graph/source.js";
export { buildWorldGraphMvpCampaign, WORLD_GRAPH_MVP_CAMPAIGN_ID } from "./campaigns/world-graph-mvp.js";
export {
  buildBulgariaBureaucracyCampaign,
  BULGARIA_BUREAUCRACY_CAMPAIGN_ID,
} from "./campaigns/bulgaria-bureaucracy.js";
export { buildBulgariaDrivingCampaign, BULGARIA_DRIVING_CAMPAIGN_ID } from "./campaigns/bulgaria-driving.js";
export { buildBulgariaReturnCampaign, BULGARIA_RETURN_CAMPAIGN_ID } from "./campaigns/bulgaria-return.js";
export { buildBulgariaInheritanceCampaign, BULGARIA_INHERITANCE_CAMPAIGN_ID } from "./campaigns/bulgaria-inheritance.js";
export { buildBulgariaEnterpriseCampaign, BULGARIA_ENTERPRISE_CAMPAIGN_ID } from "./campaigns/bulgaria-enterprise.js";
export { buildLuciferChroniclesCampaign, LUCIFER_CHRONICLES_CAMPAIGN_ID } from "./campaigns/lucifer-chronicles.js";
// Private campaign: playable via `/play/` but marked `hidden` in
// `site/src/play/composition.ts`, so it never appears in the public dossier grid.
export { buildSakiQuestCampaign, SAKI_QUEST_CAMPAIGN_ID } from "./campaigns/saki-quest-for-redemption.js";
export {
  buildWhatWouldLuciferDoCampaign,
  WHAT_WOULD_LUCIFER_DO_CAMPAIGN_ID,
} from "./campaigns/what-would-lucifer-do.js";
export { ENGINE_VERSION } from "./version.js";

export type { Engine } from "./core/kernel/types.js";
export type { EngineHost, SessionHost } from "./core/composition/types.js";
export type { IdSource, Clock } from "./core/composition/types.js";
export type { GameState, GameStatus } from "./core/kernel/types.js";
export type { Kind, KindContext, KindRegistry } from "./core/kernel/types.js";
export type { ActionParams, ActionResult, AvailableAction, Scene, SceneBody } from "./core/kernel/types.js";
export type { PlayerView } from "./core/projection/types.js";
export type { Campaign, BuiltCampaign, ContentRegistry, AuthoredText } from "./core/registry/types.js";
export { SessionStoreError } from "./core/session/types.js";
export type { AchievementRecord, PlayerProfile, ProfileLoadResult, ProfileSaveResult, CampaignSummary, SessionStore, ProfileStore, SaveHandle, SessionHandle, SessionActionResult, CreateSessionConfig, SessionPersistence, SessionRecordStore, SaveRecordStore, StoredSessionRecord, StoredSaveRecord, SessionStoreErrorCode } from "./core/session/types.js";
export type { ValidationResult, ValidationError, ValidationWarning } from "./core/validation/types.js";
export type { CommandResult, StateChange, ReasonCode } from "./core/kernel/reasons.js";
export type { LocKey } from "./core/localization/types.js";
export type { StringTable } from "./core/localization/types.js";
export type { Condition } from "./core/condition/types.js";
export type { Emitter, EngineEvent } from "./core/observability/types.js";
export type { WorldGraphCampaign, WorldGraphCampaignSource } from "./kinds/world-graph/content.js";
export type { WorldGraphKindState, WorldGraphView } from "./kinds/world-graph/state.js";
export type { WorldGraphOutcome } from "./kinds/world-graph/outcome.js";
