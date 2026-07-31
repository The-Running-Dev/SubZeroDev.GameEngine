/**
 * MCP server — the same operations as tools (`TODO.md` W17).
 *
 * Contract: [SubZeroDev.Platform's `mcp-tool-contract.md`](https://github.com/The-Running-Dev/SubZeroDev.Platform/blob/main/docs/docs/mcp-tool-contract.md)
 * — the nine-tool table, verbatim, plus "the MCP server is a client like the text
 * client — a thin adapter over the same store, holding no game logic." Moved there from
 * `04-core.md` §13 / `09-clients.md` §7 (both still stubs pointing at it): a hosting-facing
 * contract, not core engine material, even though this file is what implements it.
 * `09-clients.md` still applies unchanged otherwise: an agent calling these tools is a
 * player, sees the identical projection, and gets the same `unknown_action` for a hidden
 * choice a human client would.
 *
 * No transport, no `@modelcontextprotocol/sdk` — see `plans/24-w17-mcp-server.md`,
 * "What This Unit Actually Builds." `src/engine/` has no runtime dependencies, and
 * nothing in W17's own done-when needs a running stdio/HTTP process.
 *
 * `McpTools`' keys are the literal wire-level tool identifiers the contract assigns
 * (snake_case by contract, not a TypeScript style choice) — the object's own shape is
 * the "nine tools, nine operations, one-to-one" checklist made structural.
 */

import type { ActionParams, Scene } from "../core/kernel/types.js";
import type { PlayerView } from "../core/projection/types.js";
import type { StringTable } from "../core/localization/types.js";
import type { CampaignSummary, SessionActionResult, SessionStore } from "../core/session/types.js";

/** The contract's own documented args — deliberately narrower than `CreateSessionConfig`,
 *  which also carries `audience`. An MCP caller choosing `audience: "ai"` would widen its
 *  own projection through every later `get_state`, breaking "an agent sees no more than a
 *  human client does" — the table has no `audience` field for exactly that reason. */
export interface StartGameArgs {
  campaignId: string;
  seed?: string;
  profileId?: string;
}

export interface McpTools {
  list_campaigns(args: Record<string, never>): CampaignSummary[];
  start_game(args: StartGameArgs): Promise<{ sessionId: string; scene: Scene }>;
  continue_game(args: { sessionId: string }): Promise<Scene>;
  get_scene(args: { sessionId: string }): Promise<Scene>;
  get_state(args: { sessionId: string }): Promise<PlayerView>;
  get_strings(args: { sessionId: string }): Promise<StringTable>;
  choose(args: { sessionId: string; actionId: string; params?: ActionParams }): Promise<SessionActionResult>;
  save_game(args: { sessionId: string }): Promise<{ saveId: string }>;
  load_game(args: { saveId: string }): Promise<{ sessionId: string; scene: Scene }>;
}

/** Builds the nine tools over `store`. Every handler is a direct delegation — the
 *  adapter contributes nothing but the tool's documented name and shape. */
export function createMcpTools(store: SessionStore): McpTools {
  return {
    list_campaigns: () => store.listCampaigns(),
    // Rebuilt field-by-field from StartGameArgs, not a forwarded caller object — an MCP
    // caller can only ever supply what the table names, and `audience` is never one of
    // them. `store.createSession` defaults a missing `audience` to "player" itself.
    start_game: (args) => {
      const config: StartGameArgs = { campaignId: args.campaignId, ...(args.seed !== undefined ? { seed: args.seed } : {}), ...(args.profileId !== undefined ? { profileId: args.profileId } : {}) };
      return store.createSession(config);
    },
    continue_game: (args) => store.resumeSession(args.sessionId),
    get_scene: (args) => store.getScene(args.sessionId),
    get_state: (args) => store.getView(args.sessionId),
    get_strings: (args) => store.getStrings(args.sessionId),
    choose: (args) => store.submitAction(args.sessionId, args.actionId, args.params),
    // Narrowed to { saveId } — the contract names this as the tool's own documented
    // return shape, dropping SaveHandle's savedAtSeq rather than passing it through.
    save_game: async (args) => {
      const { saveId } = await store.saveGame(args.sessionId);
      return { saveId };
    },
    load_game: (args) => store.loadGame(args.saveId),
  };
}
