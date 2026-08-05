import type {
  CampaignSummary,
  CreateSessionConfig,
  PlayerView,
  SaveHandle,
  Scene,
  SessionActionResult,
  SessionHandle,
  SessionStore,
  StringTable,
} from "@the-running-dev/game-engine";

export interface PlayAction {
  readonly id: string;
  readonly label: string;
  readonly available: boolean;
  readonly reason?: string;
}

export interface PlayState {
  readonly sessionId: string;
  readonly scene: Scene;
  readonly strings: StringTable;
  readonly view: PlayerView;
  readonly actions: readonly PlayAction[];
}

export class BrowserClient {
  private readonly store: SessionStore;

  constructor(store: SessionStore) {
    this.store = store;
  }

  listCampaigns(): CampaignSummary[] {
    return this.store.listCampaigns();
  }

  async createSession(config: CreateSessionConfig): Promise<PlayState> {
    return this.read(await this.store.createSession(config));
  }

  async start(campaignId: string): Promise<PlayState> {
    return this.createSession({ campaignId });
  }

  async resumeSession(sessionId: string): Promise<PlayState> {
    const scene = await this.store.resumeSession(sessionId);
    return this.read({ sessionId, scene });
  }

  getScene(sessionId: string): Promise<Scene> {
    return this.store.getScene(sessionId);
  }

  getView(sessionId: string): Promise<PlayerView> {
    return this.store.getView(sessionId);
  }

  getStrings(sessionId: string): Promise<StringTable> {
    return this.store.getStrings(sessionId);
  }

  previewAction(
    sessionId: string,
    actionId: string,
  ): Promise<SessionActionResult> {
    return this.store.previewAction(sessionId, actionId);
  }

  submitAction(
    sessionId: string,
    actionId: string,
  ): Promise<SessionActionResult> {
    return this.store.submitAction(sessionId, actionId);
  }

  async submit(
    state: PlayState,
    actionId: string,
  ): Promise<{ state: PlayState; result: SessionActionResult }> {
    const result = await this.submitAction(state.sessionId, actionId);
    return {
      state: await this.read({
        sessionId: state.sessionId,
        scene: result.scene ?? state.scene,
      }),
      result,
    };
  }

  async preview(
    state: PlayState,
    actionId: string,
  ): Promise<Scene | undefined> {
    return (await this.previewAction(state.sessionId, actionId)).scene;
  }

  saveGame(sessionId: string): Promise<SaveHandle> {
    return this.store.saveGame(sessionId);
  }

  save(sessionId: string): Promise<SaveHandle> {
    return this.saveGame(sessionId);
  }

  async loadGame(saveId: string): Promise<PlayState> {
    return this.read(await this.store.loadGame(saveId));
  }

  load(saveId: string): Promise<PlayState> {
    return this.loadGame(saveId);
  }

  private async read(handle: SessionHandle): Promise<PlayState> {
    const [scene, view, strings] = await Promise.all([
      this.store.getScene(handle.sessionId),
      this.store.getView(handle.sessionId),
      this.store.getStrings(handle.sessionId),
    ]);
    return {
      sessionId: handle.sessionId,
      scene,
      view,
      strings,
      actions: scene.actions.map((action) => ({
        id: action.id,
        label: strings[action.labelKey] ?? "Unavailable action",
        available: action.available,
        ...(action.reasonKey === undefined
          ? {}
          : {
              reason:
                strings[action.reasonKey] ?? "This action is not available.",
            }),
      })),
    };
  }
}
