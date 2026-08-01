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
import { canonicalStringify } from "../persistence/canonical.js";
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
 * The pre-check 07 §6 names first: resolve the fixture's `campaignVersion` in the registry
 * before ever calling `createGame`, so the two `unrunnable` reasons stay distinct — a
 * campaign that no longer exists at all versus one that exists at a version this fixture
 * was not captured against. Both are legitimate content decisions, never a failure (07 §6).
 */
function resolveCampaign(
  registry: ContentRegistry,
  fixture: ReplayFixture,
): { readonly reason: "campaign_withdrawn" | "campaign_version_missing" } | undefined {
  const campaign = registry.campaigns.get(fixture.config.campaignId);
  if (!campaign) return { reason: "campaign_withdrawn" };
  if (campaign.version !== fixture.campaignVersion) return { reason: "campaign_version_missing" };
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

  const unrunnable = resolveCampaign(ctx.registry, fixture);
  if (unrunnable) return { kind: "unrunnable", reason: unrunnable.reason };

  const created = ctx.engine.createGame(fixture.config);
  if (!created.ok || !created.value) {
    // A fixture that passed the campaign/version check but still fails to start is a
    // broken fixture or a broken engine, not a divergence this oracle exists to report —
    // the same distinction `core/determinism/harness.ts`'s `runFixture` draws.
    throw new Error(`buildReplayOutcome "${fixture.name}": createGame rejected — ${created.errors[0]?.code ?? "unknown"}`);
  }

  let state: GameState = created.value;
  const decisions: Decision[] = [];

  for (const [index, submission] of fixture.submissions.entries()) {
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
    acceptedActions: decisions.filter((d) => d.accepted).length,
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
    if (!e || !a || e.index !== a.index || e.seq !== a.seq || e.actionId !== a.actionId || e.accepted !== a.accepted || e.reason !== a.reason) {
      return i;
    }
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
