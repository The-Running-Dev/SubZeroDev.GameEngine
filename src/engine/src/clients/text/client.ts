/**
 * Text client — the proving instrument (09-clients.md, `TODO.md` W16).
 *
 * Contract: `09-clients.md` §2 — the nine-operation surface, and nothing else. `TextClient`
 * mirrors it 1:1, in the same order the table lists them, calling `SessionStore` and
 * handing the result to `render.ts`. It never imports the pure engine, a kind, or the
 * registry (04 §1.1's dependency arrow; enforced by `eslint.config.js`'s client-boundary
 * rule), and never sees a raw `GameState` — only `sessionId`/`saveId` strings and whatever
 * the store's own projected return types already are.
 */

import type { ActionParams, Scene } from "../../core/kernel/types.js";
import type { PlayerView } from "../../core/projection/types.js";
import type { StringTable } from "../../core/localization/types.js";
import type {
  CampaignSummary,
  CreateSessionConfig,
  SaveHandle,
  SessionActionResult,
  SessionHandle,
  SessionStore,
} from "../../core/session/types.js";
import { renderActionResult, renderCampaignList, renderScene, renderSaveHandle, renderView } from "./render.js";

/** What every operation but `getStrings` returns: the store's own value, for a test to
 *  assert on real data, plus the text a human would see for it — never a third shape.
 *  `getStrings` is the one exception (see its own doc comment below): a whole string
 *  table has no natural rendered form the way a scene, an error, or a save handle does. */
export interface Rendered<T> {
  value: T;
  text: string;
}

export class TextClient {
  constructor(private readonly store: SessionStore) {}

  // ── Queries ──

  listCampaigns(): Rendered<CampaignSummary[]> {
    const value = this.store.listCampaigns();
    return { value, text: renderCampaignList(value) };
  }

  async getScene(sessionId: string): Promise<Rendered<Scene>> {
    const value = await this.store.getScene(sessionId);
    const strings = await this.store.getStrings(sessionId);
    return { value, text: renderScene(value, strings) };
  }

  async getView(sessionId: string): Promise<Rendered<PlayerView>> {
    const value = await this.store.getView(sessionId);
    return { value, text: renderView(value) };
  }

  /** Returns the table itself, not `Rendered<StringTable>` — every other operation's
   *  `text` is what a human reads on a screen; a raw key→string map isn't a screen, it's
   *  the resource every other render call resolves against (including this client's own,
   *  internally, for the other eight). */
  getStrings(sessionId: string): Promise<StringTable> {
    return this.store.getStrings(sessionId);
  }

  // ── Commands ──

  async createSession(config: CreateSessionConfig): Promise<Rendered<SessionHandle>> {
    const value = await this.store.createSession(config);
    const strings = await this.store.getStrings(value.sessionId);
    return { value, text: renderScene(value.scene, strings) };
  }

  async resumeSession(sessionId: string): Promise<Rendered<Scene>> {
    const value = await this.store.resumeSession(sessionId);
    const strings = await this.store.getStrings(sessionId);
    return { value, text: renderScene(value, strings) };
  }

  async submitAction(sessionId: string, actionId: string, params?: ActionParams): Promise<Rendered<SessionActionResult>> {
    const value = await this.store.submitAction(sessionId, actionId, params);
    const strings = await this.store.getStrings(sessionId);
    return { value, text: renderActionResult(value, strings) };
  }

  async saveGame(sessionId: string): Promise<Rendered<SaveHandle>> {
    const value = await this.store.saveGame(sessionId);
    return { value, text: renderSaveHandle(value) };
  }

  async loadGame(saveId: string): Promise<Rendered<SessionHandle>> {
    const value = await this.store.loadGame(saveId);
    const strings = await this.store.getStrings(value.sessionId);
    return { value, text: renderScene(value.scene, strings) };
  }
}
