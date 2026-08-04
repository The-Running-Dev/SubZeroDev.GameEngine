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

  // Commands
  createSession(config: CreateSessionConfig): Promise<SessionHandle>;
  resumeSession(sessionId: string): Promise<Scene>;
  submitAction(
    sessionId: string,
    actionId: string,
    params?: ActionParams,
  ): Promise<SessionActionResult>;
  /** Runs an action against the current session without persisting its prospective state. */
  previewAction(
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
