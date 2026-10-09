/**
 * The replay regression oracle's runner — builds an `Outcome` from a `ReplayFixture` and
 * compares it against a previously-recorded one.
 *
 * Contract: `07-replay.md` §3.2, §5, §6.
 *
 * Composed directly against `Engine` and `ProfileStore`, not `SessionStore`
 * (`createInMemorySessionStore`): a client's `SessionStore` surface returns a `Scene`/
 * `PlayerView` projection and never the raw `GameState`, but `Outcome.finalStatus` and
 * `Outcome.terminal` (`Kind.outcome`) both need the state itself. Achievements still go
 * through `session/store.ts`'s own `upsertAchievements` — the exact tested path
 * `createInMemorySessionStore` uses internally — rather than a second reimplementation.
 */

import type { ActionResult, Engine, GameState, KindRegistry } from "../kernel/types.js";
import type { ContentRegistry } from "../registry/types.js";
import type { ProfileStore } from "../session/types.js";
import { upsertAchievements } from "../session/store.js";
import { canonicalize as canonicalStringify } from "subzerodev-data-json";
import type { Decision, Outcome, ReplayFixture, ReplayVerdict } from "./types.js";

export interface ReplayRunnerContext {
  readonly engine: Engine;
  readonly kinds: KindRegistry;
  readonly registry: ContentRegistry;
  readonly profiles: ProfileStore;
  readonly profileId: string;
}

export type ReplayResult =
  | { readonly kind: "outcome"; readonly outcome: Outcome }
  | { readonly kind: "unrunnable"; readonly reason: "campaign_withdrawn" | "campaign_version_missing" };

/**
 * The pre-check 07 §6 names first, before ever calling `createGame`, so the two `unrunnable`
 * reasons stay distinct — a campaign that no longer exists at all versus one that exists but
 * not at every version this fixture was captured against. Both are legitimate content
 * decisions, never a failure (07 §6).
 *
 * Withdrawal is read from the registry: a `ResolutionArchive` cannot enumerate, so it cannot
 * say an id is gone. Every *named* version — the starting `campaignVersion` and each
 * adoption's — resolves through `engine.content`, requiring the resolved campaign to carry
 * that exact version, as the kernel's own epoch resolution does (16 §5.6).
 */
function resolveCampaign(
  ctx: ReplayRunnerContext,
  fixture: ReplayFixture,
): { readonly reason: "campaign_withdrawn" | "campaign_version_missing" } | undefined {
  const campaignId = fixture.config.campaignId;
  if (!ctx.registry.campaigns.has(campaignId)) return { reason: "campaign_withdrawn" };
  const named = [fixture.campaignVersion, ...fixture.submissions.flatMap((s) => ("adopt" in s ? [s.adopt] : []))];
  const held = (version: string): boolean =>
    ctx.engine.content.resolve(campaignId, version)?.campaigns.get(campaignId)?.version === version;
  if (!named.every(held)) return { reason: "campaign_version_missing" };
  return undefined;
}

/**
 * Runs every submission in order, regardless of acceptance — 07 §6 is explicit that a
 * rejected action does not stop the replay, since a later submission recovering is itself
 * the interesting signal. Achievements are upserted after each *accepted* submission
 * (mirroring `createInMemorySessionStore`'s own production behaviour exactly), and read
 * back once at the end (07 §3.2).
 */
export async function buildReplayOutcome(ctx: ReplayRunnerContext, fixture: ReplayFixture): Promise<ReplayResult> {
  // Runtime backstop, not just the type: a fixture built from untyped data (JSON, an `as`
  // cast) could still smuggle a missing seed past the compiler, same as
  // `core/determinism/harness.ts`'s `runFixture` — `typeof !== "string"` rather than an
  // `undefined` check alone, since `createGame`'s `config.seed ?? ids.newSeed()` treats
  // `null` as missing exactly the same way, and a narrower check would let a null seed
  // through to a non-reproducible random fallback silently.
  if (typeof fixture.config.seed !== "string") {
    throw new Error(`buildReplayOutcome "${fixture.name}": config.seed is required for a reproducible replay`);
  }

  const unrunnable = resolveCampaign(ctx, fixture);
  if (unrunnable) return { kind: "unrunnable", reason: unrunnable.reason };

  // The fixture's `campaignVersion` is the *starting* epoch (07 §2), not necessarily the
  // registry's current one.
  const created = ctx.engine.createGame(fixture.config, fixture.campaignVersion);
  if (!created.ok || !created.value) {
    // A fixture that passed the campaign/version check but still fails to start is a
    // broken fixture or a broken engine, not a divergence this oracle exists to report —
    // the same distinction `core/determinism/harness.ts`'s `runFixture` draws.
    throw new Error(`buildReplayOutcome "${fixture.name}": createGame rejected — ${created.errors[0]?.code ?? "unknown"}`);
  }

  let state: GameState = created.value;
  const decisions: Decision[] = [];

  for (const [index, submission] of fixture.submissions.entries()) {
    if ("adopt" in submission) {
      // Capture records only adoptions that happened (16 §5.6). One naming the version the
      // game is already on would append no content entry — `adoptContent`'s step 0 — so it
      // has no `seq` to record: a malformed fixture, like a missing seed, not a divergence.
      if (submission.adopt === state.campaignVersion) {
        throw new Error(
          `buildReplayOutcome "${fixture.name}": submission ${index} adopts "${submission.adopt}", the version the game is already on`,
        );
      }
      const adoption = ctx.engine.adoptContent(state, submission.adopt);
      if (adoption.adopted) {
        decisions.push({ index, seq: adoption.state.actionLog.length - 1, adopt: submission.adopt, accepted: true });
        state = adoption.state;
      } else {
        decisions.push({ index, seq: null, adopt: submission.adopt, accepted: false, reason: adoption.reason });
      }
      continue;
    }

    const result: ActionResult = ctx.engine.submitAction(state, submission.actionId, submission.params);

    if (result.ok && result.value) {
      const seq = result.value.actionLog.length - 1;
      decisions.push({ index, seq, actionId: submission.actionId, accepted: true });

      await upsertAchievements(ctx.profiles, ctx.profileId, state.campaignId, result.changes);
      state = result.value;
    } else {
      decisions.push({
        index,
        seq: null,
        actionId: submission.actionId,
        accepted: false,
        ...(result.errors[0]?.code !== undefined ? { reason: result.errors[0].code } : {}),
      });
    }
  }

  const { profile } = await ctx.profiles.load(ctx.profileId);
  const achievements = profile.achievements
    .filter((a) => a.campaignId === state.campaignId)
    .map((a) => a.achievementId)
    .sort();

  const kind = ctx.kinds[state.kindId];
  const terminal = kind.outcome(state.kindState);

  const outcome: Outcome = {
    finalStatus: state.status,
    // Actions only: an adoption is a log entry but not an action (07 §3).
    acceptedActions: decisions.filter((d) => "actionId" in d && d.accepted).length,
    decisions,
    achievements,
    terminal,
  };
  return { kind: "outcome", outcome };
}

/**
 * `at` is the `index` of the first differing `Decision` (07 §3.1, §6) — never a `seq`,
 * which is not unique across rejections. When every `Decision` matches but `finalStatus`,
 * `achievements`, or `terminal` still differ, the divergence is real but does not belong to
 * any one submission — reported at `submissions.length`, one past the last index, since
 * that is where the game's fate diverged even though no single action can be blamed.
 */
export function findDivergence(expected: Outcome, actual: Outcome): number | undefined {
  const length = Math.max(expected.decisions.length, actual.decisions.length);
  for (let i = 0; i < length; i++) {
    const e = expected.decisions[i];
    const a = actual.decisions[i];
    if (!e || !a || e.index !== a.index || e.seq !== a.seq || e.accepted !== a.accepted || e.reason !== a.reason) {
      return i;
    }
    // An adoption where an action was recorded, or the other way round, diverges as surely
    // as a different action id does.
    const expectedId = "adopt" in e ? `adopt:${e.adopt}` : `action:${e.actionId}`;
    const actualId = "adopt" in a ? `adopt:${a.adopt}` : `action:${a.actionId}`;
    if (expectedId !== actualId) return i;
  }

  const tail = {
    finalStatus: expected.finalStatus,
    acceptedActions: expected.acceptedActions,
    achievements: expected.achievements,
    terminal: expected.terminal,
  };
  const actualTail = {
    finalStatus: actual.finalStatus,
    acceptedActions: actual.acceptedActions,
    achievements: actual.achievements,
    terminal: actual.terminal,
  };
  if (canonicalStringify(tail) !== canonicalStringify(actualTail)) {
    return expected.decisions.length;
  }

  return undefined;
}

/** Builds the `Outcome` and compares it to `expected` in one call — the shape 07 §6
 *  describes end to end. `buildReplayOutcome`/`findDivergence` stay separately exported and
 *  separately testable underneath it. */
export async function runReplayFixture(
  ctx: ReplayRunnerContext,
  fixture: ReplayFixture,
  expected: Outcome,
): Promise<ReplayVerdict> {
  const result = await buildReplayOutcome(ctx, fixture);
  if (result.kind === "unrunnable") return { kind: "unrunnable", reason: result.reason };

  const at = findDivergence(expected, result.outcome);
  if (at === undefined) return { kind: "match" };

  return { kind: "diverged", at, capturedUnder: fixture.capturedUnder, expected, actual: result.outcome };
}
