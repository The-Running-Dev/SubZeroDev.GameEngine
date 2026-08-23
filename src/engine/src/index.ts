// Public surface defined for W41: `plans/40-w41-engine-consumer-boundary.md`.

export {
  createEngine,
  isValidGameStateShape,
} from "./core/kernel/engine.js";

export {
  buildCampaign,
  buildContentRegistry,
} from "./core/registry/build.js";

export { buildValidatedContentRegistry, buildValidatedPackRegistry } from "./core/validation/tiered.js";
// Content packs (11 §3, §5a, §6). Exported because the composition these serve is
// host-side: `10-design.md` §5.5 puts resolving one registry per distinct assignment
// combination — `applyExperimentGates` then `resolvePacks` — *above* the session seam,
// so a host that cannot name them cannot do the job the design assigns it.
export {
  applyExperimentGates,
  computeResolutionId,
  resolveBucketKey,
  resolveExperimentAssignments,
  resolvePacks,
} from "./core/registry/packs.js";
export { createInMemorySessionStore, createSessionLayer, upsertAchievements } from "./core/session/store.js";
export { createInMemoryProfileStore } from "./core/session/profile-store.js";
export { TextClient } from "./clients/text/client.js";
export { defaultIdSource, defaultClock, defaultRecordIdSource } from "./core/composition/defaults.js";
export { createCountingIds } from "./core/determinism/counting-ids.js";
export { nullEmitter, createRecordingEmitter, jsonlEmitter } from "./core/observability/emitter.js";
export { resolveLocKey } from "./core/localization/resolve.js";
export { storyGraphKind } from "./kinds/story-graph/kind.js";
export { simulationKind } from "./kinds/simulation/kind.js";
export { worldGraphKind } from "./kinds/world-graph/kind.js";
export { buildWorldGraphCampaign } from "./kinds/world-graph/source.js";
export { buildWorldGraphMvpCampaign, WORLD_GRAPH_MVP_CAMPAIGN_ID } from "./campaigns/world-graph-mvp.js";
// No narrative campaign is exported here. Adventures.Content owns the source and publication
// of published campaigns; a runtime host fetches portable JSON from that feed and hydrates it
// with `fromPortable` below (W74c; contract §19). `bulgaria-bureaucracy` stays in
// `campaigns/` as frozen regression evidence (W74a) and is deliberately reachable from
// nowhere on this surface — `authoring.test.ts` fails if either claim stops holding.
export { ENGINE_VERSION } from "./version.js";

// Portable campaign format (graduated from the spike — plans/spike-notes.md). A real
// contract export: `SubZeroDev.ServiceContract`'s content contract projects its schema
// straight from `PortableCampaign`/`PortableManifest` below. `toPortable` and
// `digestManifestResolution` stay unexported here — they are author-time-only, reachable
// through the `./authoring` subpath, which is what Adventures.Content's own
// `scripts/export-content.ts` publishes from. `digestPortableCampaign` is exported here too,
// so a runtime host can re-verify a fetched file against the digest its manifest entry
// recorded.
export { fromPortable } from "./portable/format.js";
export { digestPortableCampaign } from "./portable/digest.js";
export type {
  PortableCampaign,
  PortableCampaignBody,
  PortableCatalog,
  PortableManifest,
  PortableManifestEntry,
  PortableMigration,
} from "./portable/format.js";

export type { Engine } from "./core/kernel/types.js";
export type { EngineHost, SessionHost } from "./core/composition/types.js";
export type { IdSource, RecordIdSource, Clock, ExperimentSource } from "./core/composition/types.js";
export type { GameState, GameStatus } from "./core/kernel/types.js";
export type { Kind, KindContext, KindRegistry } from "./core/kernel/types.js";
export type { ActionParams, ActionResult, AvailableAction, Scene, SceneBody } from "./core/kernel/types.js";
export type { PlayerView } from "./core/projection/types.js";
export type { Campaign, BuiltCampaign, ContentRegistry, AuthoredText } from "./core/registry/types.js";
export type { ResolutionId } from "./core/registry/types.js";
export type { ContentPack, ExperimentGate, PackRef } from "./core/registry/packs.js";
export { SESSION_PERSISTENCE_CONFLICT, SessionStoreError } from "./core/session/types.js";
export type { AchievementRecord, PlayerProfile, ProfileLoadResult, ProfileSaveResult, CampaignSummary, SessionStore, ProfileStore, SaveHandle, SessionHandle, SessionActionResult, CreateSessionConfig, SessionPersistence, SessionPersistenceConflict, SessionRecordStore, SaveRecordStore, StoredSessionRecord, StoredSaveRecord, SessionStoreErrorCode } from "./core/session/types.js";
export type { ValidationResult, ValidationError, ValidationWarning } from "./core/validation/types.js";
export type { CommandResult, StateChange, ReasonCode } from "./core/kernel/reasons.js";
export type { LocKey } from "./core/localization/types.js";
export type { StringTable } from "./core/localization/types.js";
export type { Condition } from "./core/condition/types.js";
export type { Emitter, EngineEvent } from "./core/observability/types.js";
export type { WorldGraphCampaign, WorldGraphCampaignSource } from "./kinds/world-graph/content.js";
export type { WorldGraphKindState, WorldGraphView } from "./kinds/world-graph/state.js";
export type { WorldGraphOutcome } from "./kinds/world-graph/outcome.js";
export type { SimulationCampaign } from "./kinds/simulation/campaign.js";
export type { SimulationKindState } from "./kinds/simulation/state.js";
export type { SimulationView, PublicWorldState } from "./kinds/simulation/view.js";
export type { SimulationOutcome } from "./kinds/simulation/outcome.js";
export type { ActionType, GameAction, WeeklyActionPlan } from "./kinds/simulation/plan.js";
