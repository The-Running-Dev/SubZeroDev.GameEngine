/**
 * Session — the store above the pure engine, and the profile store beside it.
 *
 * Contract: `04-core.md` §7, §7.1.
 *
 * The core is a pure function; sessions are a *store concern*. The client holds a
 * `sessionId`, never authoritative state, which is what preserves "the engine owns the
 * truth" while still allowing resume on another device.
 *
 * This surface is also the client contract's whole vocabulary (09 §4): ten operations,
 * ten MCP tools, one-to-one — so "no AI-specific path" is checkable by counting.
 */

import type { LocKey, StringTable } from "../localization/types.js";
import type {
  ActionParams,
  KindId,
  NewGameConfig,
  Scene,
} from "../kernel/types.js";
import type {
  OutcomeMessage,
  StateChange,
} from "../kernel/reasons.js";
import type { PlayerView } from "../projection/types.js";
import type { ValidationError, ValidationWarning } from "../validation/types.js";
import type { ProjectionAudience } from "../projection/types.js";

export interface CampaignSummary {
  campaignId: string;
  kindId: KindId;
  titleKey: LocKey;
}

/** Identity lives here and never on `NewGameConfig` or in the serialized envelope. */
export interface CreateSessionConfig extends NewGameConfig {
  /** Omitted → anonymous session: no profile read, no profile write. */
  profileId?: string;
}

export interface SessionHandle {
  sessionId: string;
  scene: Scene;
}

export interface SaveHandle {
  saveId: string;
  savedAtSeq: number;
}

/** Host-owned records. They deliberately live outside GameState and are never replayed. */
export interface StoredSessionRecord {
  sessionId: string;
  blob: string;
  audience: ProjectionAudience;
  attemptCounter: number;
  replayCompatible: boolean;
  createdAt: string;
  updatedAt: string;
  profileId?: string;
}

export interface StoredSaveRecord {
  saveId: string;
  campaignId: string;
  blob: string;
  savedAtSeq: number;
  audience: ProjectionAudience;
  profileId?: string;
}

export interface SessionRecordStore {
  get(sessionId: string): Promise<StoredSessionRecord | undefined>;
  put(record: StoredSessionRecord): Promise<void>;
}

export interface SaveRecordStore {
  get(saveId: string): Promise<StoredSaveRecord | undefined>;
  put(record: StoredSaveRecord): Promise<void>;
  delete(saveId: string): Promise<void>;
}

export interface SessionPersistence {
  sessions: SessionRecordStore;
  saves: SaveRecordStore;
}

/** Every member is a registered `ReasonCode` with a shipped `core.reason.*` message
 *  (`kernel/reasons.ts`, 04 §12) — that is what makes `code` renderable through the string
 *  table and `message` never worth reading (09 §3). */
export type SessionStoreErrorCode =
  | "unknown_session"
  | "unknown_save"
  | "storage_failure"
  | "unknown_campaign"
  | "invalid_state"
  | "unknown_kind"
  | "save_requires_migration"
  | "migration_failed";

/**
 * Expected host/session failures. They retain exception semantics because none of
 * `SessionStore`'s signatures has an error channel (04 §7, §7.2), but `code` is a real
 * `ReasonCode`, so a client renders it rather than parsing `message`.
 */
export class SessionStoreError extends Error {
  readonly operation: string;
  readonly code: SessionStoreErrorCode;

  constructor(operation: string, code: SessionStoreErrorCode, message?: string) {
    super(message ?? `session store: ${operation} — ${code}`);
    this.name = "SessionStoreError";
    this.operation = operation;
    this.code = code;
  }
}

/**
 * Deliberately **not** `ActionResult` — that carries a raw `GameState`, and a client
 * never receives one. This returns the new `Scene`, which is a projection.
 */
export interface SessionActionResult {
  ok: boolean;
  /** The new scene, on success. */
  scene?: Scene;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  /** Audit records, `visible`-gated. */
  changes: StateChange[];
  messages: OutcomeMessage[];
}

export interface SessionStore {
  // Queries
  listCampaigns(): CampaignSummary[];
  getScene(sessionId: string): Promise<Scene>;
  getView(sessionId: string): Promise<PlayerView>;
  /** Resolves `LocKey`s. Without this a compliant client cannot render a single label. */
  getStrings(sessionId: string): Promise<StringTable>;

  // Prospective query (resolves, projects, and discards)
  /** Runs an action against the current session without persisting its prospective state. */
  previewAction(
    sessionId: string,
    actionId: string,
    params?: ActionParams,
  ): Promise<SessionActionResult>;

  // Commands
  createSession(config: CreateSessionConfig): Promise<SessionHandle>;
  resumeSession(sessionId: string): Promise<Scene>;
  submitAction(
    sessionId: string,
    actionId: string,
    params?: ActionParams,
  ): Promise<SessionActionResult>;
  saveGame(sessionId: string): Promise<SaveHandle>;
  loadGame(saveId: string): Promise<SessionHandle>;
}

// ---------------------------------------------------------------------------
// Profiles (§7.1)
// ---------------------------------------------------------------------------

export interface AchievementRecord {
  /** Achievement ids are only unique within a campaign. */
  campaignId: string;
  achievementId: string;
}

export interface PlayerProfile {
  formatVersion: 1;
  profileId: string;
  achievements: readonly AchievementRecord[];
}

export type ProfileWarningCode =
  | "profile_missing"
  | "profile_corrupt"
  | "profile_write_failed";

export interface ProfileWarning {
  code: ProfileWarningCode;
  profileId: string;
}

export interface ProfileLoadResult {
  profile: PlayerProfile;
  warnings: readonly ProfileWarning[];
}

export interface ProfileSaveResult {
  ok: boolean;
  warnings: readonly ProfileWarning[];
}

/**
 * A missing or corrupt profile degrades to "no achievements" with a warning — never a
 * broken game. A failed write never rolls back the game action; profile contents and
 * write outcomes never feed back into `advance`.
 */
export interface ProfileStore {
  load(profileId: string): Promise<ProfileLoadResult>;
  save(profile: PlayerProfile): Promise<ProfileSaveResult>;
}
