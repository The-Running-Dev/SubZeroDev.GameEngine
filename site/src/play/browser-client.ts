import type {
  PlayerView,
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

  async start(campaignId: string): Promise<PlayState> {
    const handle = await this.store.createSession({ campaignId });
    return this.read(handle);
  }

  async submit(
    state: PlayState,
    actionId: string,
  ): Promise<{ state: PlayState; result: SessionActionResult }> {
    const result = await this.store.submitAction(state.sessionId, actionId);
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
    return (await this.store.previewAction(state.sessionId, actionId)).scene;
  }

  save(sessionId: string) {
    return this.store.saveGame(sessionId);
  }

  async load(saveId: string): Promise<PlayState> {
    return this.read(await this.store.loadGame(saveId));
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
