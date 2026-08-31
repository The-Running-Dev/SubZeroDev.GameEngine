/**
 * The in-memory `ProfileStore` — a durable mirror beside the session store.
 *
 * Contract: `04-core.md` §7.1. Design decisions: `plans/15-w8-profile-store.md`.
 *
 * Stores raw, unvalidated entries (`Map<string, unknown>`) rather than typed
 * `PlayerProfile`s directly — mirroring what a real backend (file, KV store) would hand
 * back, and validating shape on every `load()`. That's what makes "corrupt" a reachable
 * outcome to test, the same defensive-parsing discipline `kernel/engine.ts`'s
 * `isValidGameStateShape` already uses for `GameState`.
 */

import type { AchievementRecord, PlayerProfile, ProfileLoadResult, ProfileSaveResult, ProfileStore, TerminalRecord } from "./types.js";

export interface InMemoryProfileStoreOptions {
  /** Seeds the backing store — including, deliberately, a malformed entry (plan 15
   *  Decision 4). Copied at construction; later external mutation of the map passed in
   *  has no effect. */
  raw?: ReadonlyMap<string, unknown>;
  /** Runs before every write. `false` simulates a write failure (plan 15 Decision 5); the
   *  default (omitted, or returning `true`) writes normally. */
  onSave?: (profile: PlayerProfile) => boolean;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isValidAchievementRecord(v: unknown): v is AchievementRecord {
  return isPlainObject(v) && typeof v["campaignId"] === "string" && typeof v["achievementId"] === "string";
}

function isValidTerminalRecord(v: unknown): v is TerminalRecord {
  return isPlainObject(v) && typeof v["campaignId"] === "string" && typeof v["terminalId"] === "string";
}

/**
 * Requires `raw.profileId === profileId`, not just `typeof ... === "string"` — a stored
 * entry whose internal `profileId` doesn't match the key it's filed under is corruption
 * too. Without this check, `load("p1")` could return a profile whose own `profileId` is
 * `"p2"`, and a subsequent `save()` (which always writes under `profile.profileId`) would
 * then silently redirect the write to `"p2"` — the requested profile never accumulates
 * anything.
 */
function isValidPlayerProfile(v: unknown, profileId: string): v is PlayerProfile {
  if (!isPlainObject(v)) return false;
  if (v["formatVersion"] !== 2) return false;
  if (v["profileId"] !== profileId) return false;
  if (!Array.isArray(v["achievements"]) || !v["achievements"].every(isValidAchievementRecord)) return false;
  if (!Array.isArray(v["terminals"])) return false;
  return v["terminals"].every(isValidTerminalRecord);
}

interface PlayerProfileV1 {
  formatVersion: 1;
  profileId: string;
  achievements: readonly AchievementRecord[];
}

function isValidPlayerProfileV1(v: unknown, profileId: string): v is PlayerProfileV1 {
  if (!isPlainObject(v)) return false;
  if (v["formatVersion"] !== 1) return false;
  if (v["profileId"] !== profileId) return false;
  if (!Array.isArray(v["achievements"])) return false;
  return v["achievements"].every(isValidAchievementRecord);
}

/** `formatVersion` moves 1 → 2; the migration is total (04 §7.1): no field is renamed,
 *  removed or re-typed, so this cannot fail. */
function migrateProfileV1(v: PlayerProfileV1): PlayerProfile {
  return { formatVersion: 2, profileId: v.profileId, achievements: v.achievements, terminals: [] };
}

function emptyProfile(profileId: string): PlayerProfile {
  return { formatVersion: 2, profileId, achievements: [], terminals: [] };
}

export function createInMemoryProfileStore(options?: InMemoryProfileStoreOptions): ProfileStore {
  const store = new Map<string, unknown>(options?.raw);
  const onSave = options?.onSave;

  return {
    async load(profileId: string): Promise<ProfileLoadResult> {
      if (!store.has(profileId)) {
        return { profile: emptyProfile(profileId), warnings: [{ code: "profile_missing", profileId }] };
      }
      const raw = store.get(profileId);
      // Cloned, not returned by reference — a caller mutating the returned profile (or
      // its achievements array) must not silently mutate persisted state without going
      // through save().
      if (isValidPlayerProfile(raw, profileId)) {
        return { profile: structuredClone(raw), warnings: [] };
      }
      if (isValidPlayerProfileV1(raw, profileId)) {
        return { profile: migrateProfileV1(structuredClone(raw)), warnings: [] };
      }
      return { profile: emptyProfile(profileId), warnings: [{ code: "profile_corrupt", profileId }] };
    },

    async save(profile: PlayerProfile): Promise<ProfileSaveResult> {
      if (onSave && !onSave(profile)) {
        return { ok: false, warnings: [{ code: "profile_write_failed", profileId: profile.profileId }] };
      }
      // Cloned for the same reason load() clones on the way out — the caller's object
      // must not be able to mutate what's persisted after this call returns.
      store.set(profile.profileId, structuredClone(profile));
      return { ok: true, warnings: [] };
    },
  };
}
