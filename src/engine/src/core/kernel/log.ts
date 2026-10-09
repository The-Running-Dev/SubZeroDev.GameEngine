/**
 * Reading the replay spine — `GameState.actionLog` (04 §2; 16 §3.1).
 *
 * The log holds player actions and, once a game has adopted content, epoch entries: a
 * `LoggedContent` per adoption and a `LoggedMigration` per migrated load over such a log.
 * These are the two questions every reader of it asks — which entries are actions, and
 * which epoch the log started on — answered once rather than re-derived per caller.
 */

import type { LoggedAction, LoggedContent, LoggedEntry, LoggedMigration } from "./types.js";

export function isLoggedAction(entry: LoggedEntry): entry is LoggedAction {
  return "actionId" in entry;
}

export function isEpochEntry(entry: LoggedEntry): entry is LoggedContent | LoggedMigration {
  return "system" in entry;
}

/**
 * The epoch a log started on: the first epoch entry's `from`, else `campaignVersion` (04 §2).
 * Derived, never stored — a stored starting version would duplicate what the log says.
 * `campaignVersion` is optional for a caller that holds a log but no state, such as a
 * determinism fixture, which then starts on the engine's default epoch.
 */
export function startingCampaignVersion(actionLog: readonly LoggedEntry[], campaignVersion?: string): string | undefined {
  return actionLog.find(isEpochEntry)?.from ?? campaignVersion;
}
