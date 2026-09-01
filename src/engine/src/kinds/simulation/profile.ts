/**
 * Simulation kind — `Kind.profileData` (04-core.md §7.1, §3; 10-simulation-kind.md §2.2, W102).
 *
 * The kind-owned cross-game slice: `"profile"`-scoped event chains (`EventChainState`,
 * `state.ts` §2.2) that must outlive the game they advanced in. The core stores, sizes and
 * versions this slice and never reads inside it — only this file interprets it.
 */

import type { Campaign } from "../../core/registry/types.js";
import type { KindProfileData } from "../../core/kernel/types.js";
import type { StateChange } from "../../core/kernel/reasons.js";

/** `Kind.profileData.version` 1. Sorted by `(campaignId, chainId)` ascending, so one
 *  profile has exactly one canonical serialization (04 §7.1's P5). */
export interface SimulationProfileData {
  chains: readonly SimulationProfileChainRecord[];
}

export interface SimulationProfileChainRecord {
  /** A `chainId` is only unique within a campaign — as `AchievementRecord`'s own
   *  `campaignId`/`achievementId` pair already is. */
  campaignId: string;
  chainId: string;
  /** The highest `EventChainState.currentStep` any game reached — a maximum, not a sum,
   *  which is what makes `fold` idempotent (§2.2). */
  furthestStep: number;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isValidChainRecord(v: unknown): v is SimulationProfileChainRecord {
  return isPlainObject(v)
    && typeof v["campaignId"] === "string"
    && typeof v["chainId"] === "string"
    && typeof v["furthestStep"] === "number";
}

function isValidProfileData(v: unknown): v is SimulationProfileData {
  return isPlainObject(v) && Array.isArray(v["chains"]) && v["chains"].every(isValidChainRecord);
}

function sortChains(chains: readonly SimulationProfileChainRecord[]): SimulationProfileChainRecord[] {
  return [...chains].sort((a, b) => {
    if (a.campaignId !== b.campaignId) return a.campaignId < b.campaignId ? -1 : 1;
    return a.chainId < b.chainId ? -1 : a.chainId > b.chainId ? 1 : 0;
  });
}

/**
 * Reads the `profile_chain_advanced` audit records this action's `changes` carry — the
 * record `endOfWeek.ts`'s `advanceChainState` emits whenever a `"profile"`-scoped chain's
 * `currentStep` moves — and folds each into `max(existing, value)` per `(campaignId,
 * chainId)`. Pure and total: no I/O, never throws, and idempotent — reapplying the same
 * `changes` against its own output changes nothing, since `max` of an already-recorded
 * value against itself is that same value (04 §7.1's P7/P8).
 *
 * `path` is always `chain.<chainId>` (§10) — the `campaignId` a record needs comes from
 * `campaign.id`, the second argument every `fold` receives, not from the audit record
 * itself (chains are only unique within one campaign, same as achievements).
 */
function fold(current: unknown, campaign: Campaign, changes: readonly StateChange[]): unknown {
  const existing = isValidProfileData(current) ? current.chains : [];
  const byKey = new Map<string, SimulationProfileChainRecord>();
  for (const r of existing) byKey.set(`${r.campaignId} ${r.chainId}`, r);

  for (const change of changes) {
    if (change.reason !== "profile_chain_advanced") continue;
    if (!change.path.startsWith("chain.")) continue;
    const chainId = change.path.slice("chain.".length);
    const value = typeof change.value === "number" ? change.value : undefined;
    if (value === undefined) continue;

    const key = `${campaign.id} ${chainId}`;
    const previous = byKey.get(key);
    if (previous === undefined || value > previous.furthestStep) {
      byKey.set(key, { campaignId: campaign.id, chainId, furthestStep: value });
    }
  }

  const chains = sortChains([...byKey.values()]);
  return { chains } satisfies SimulationProfileData;
}

/** No prior version exists yet — `migrate` is intentionally absent (04 §3's `KindProfileData.
 *  migrate` is optional); a future shape change adds it against a real `fromVersion: 1`. */
export const simulationProfileData: KindProfileData = {
  version: 1,
  fold,
};

/** Resolves the migrated `NewGameConfig.kindProfileData` argument `initialState` receives
 *  back into a typed slice, or `undefined` for "no cross-game history" — an absent argument,
 *  a value some other kind's session wrote, or one this build cannot read. */
export function resolveProfileData(profileData: unknown): SimulationProfileData | undefined {
  return isValidProfileData(profileData) ? profileData : undefined;
}

/** Every `furthestStep` this profile recorded for `campaignId`, by `chainId` — what
 *  `initial.ts` seeds a `"profile"`-scoped `EventChainState.currentStep` from. */
export function furthestStepsFor(profileData: SimulationProfileData | undefined, campaignId: string): ReadonlyMap<string, number> {
  const map = new Map<string, number>();
  for (const record of profileData?.chains ?? []) {
    if (record.campaignId === campaignId) map.set(record.chainId, record.furthestStep);
  }
  return map;
}
