import { useMemo, useState } from "react";
import { SiteFooter, SiteHeader } from "../shared";
import { BrowserClient, type PlayState } from "./browser-client";
import { createBrowserDemo } from "./composition";

type Phase = "ready" | "playing" | "ended" | "failed";

function storyView(value: PlayState) {
  const kindView = value.view.kindView as {
    stats?: {
      var: string;
      labelKey: string;
      value: string | number | boolean;
    }[];
    unlockedAchievements?: string[];
  };
  return {
    stats: kindView.stats ?? [],
    achievements: kindView.unlockedAchievements ?? [],
  };
}

export default function PlayApp() {
  const demo = useMemo(() => createBrowserDemo(), []);
  const client = useMemo(() => new BrowserClient(demo.store), [demo.store]);
  const [phase, setPhase] = useState<Phase>("ready");
  const [state, setState] = useState<PlayState>();
  const [preview, setPreview] = useState<string>();
  const [saveId, setSaveId] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    setMessage(undefined);
    setPreview(undefined);
    try {
      const next = await client.start(demo.config.campaignId);
      setState(next);
      setPhase(next.scene.status === "ended" ? "ended" : "playing");
    } catch {
      setPhase("failed");
      setMessage("The demo could not start. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  async function choose(actionId: string) {
    if (!state) return;
    setBusy(true);
    setPreview(undefined);
    setMessage(undefined);
    try {
      const next = await client.submit(state, actionId);
      setState(next.state);
      setPhase(next.state.scene.status === "ended" ? "ended" : "playing");
      if (!next.result.ok)
        setMessage(
          next.result.errors
            .map(
              (error) =>
                next.state.strings[error.messageKey] ??
                "That action was rejected.",
            )
            .join(" "),
        );
    } catch {
      setMessage("That action could not be completed. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  async function previewAction(actionId: string) {
    if (!state) return;
    setBusy(true);
    try {
      setPreview(
        (await client.preview(state, actionId))?.body.text ??
          "No prospective scene is available.",
      );
    } catch {
      setMessage("The preview could not be produced.");
    } finally {
      setBusy(false);
    }
  }
  async function checkpoint() {
    if (!state) return;
    setBusy(true);
    try {
      const saved = await client.save(state.sessionId);
      setSaveId(saved.saveId);
      setMessage("Checkpoint saved for this page only.");
    } catch {
      setMessage("The checkpoint could not be saved.");
    } finally {
      setBusy(false);
    }
  }
  async function restore() {
    if (!saveId) return;
    setBusy(true);
    try {
      const next = await client.load(saveId);
      setState(next);
      setPhase(next.scene.status === "ended" ? "ended" : "playing");
      setPreview(undefined);
      setMessage("Checkpoint restored.");
    } catch {
      setMessage("The checkpoint could not be restored.");
    } finally {
      setBusy(false);
    }
  }

  const view = state ? storyView(state) : undefined;
  return (
    <>
      <SiteHeader current="play" />
      <main className="play-main">
        <section className="play-hero">
          <p className="eyebrow">BROWSER DEMO</p>
          <h1>{demo.config.title}</h1>
          <p>
            A complete deterministic story, running locally in your browser.
            This is an engine demo, not a finished game.
          </p>
          {phase === "ready" && (
            <button className="play-primary" onClick={start} disabled={busy}>
              Start
            </button>
          )}
          {phase === "failed" && (
            <>
              <p role="alert">{message}</p>
              <button className="play-primary" onClick={start}>
                Try again
              </button>
            </>
          )}
        </section>
        {state && (
          <section className="play-board" aria-live="polite">
            <article className="play-scene">
              <p className="section-index">
                {phase === "ended" ? "THE END" : "CURRENT SCENE"}
              </p>
              <h2 tabIndex={-1}>{state.scene.body.text}</h2>
              {phase === "ended" ? (
                <button className="play-primary" onClick={start}>
                  Play again
                </button>
              ) : (
                <div className="play-actions">
                  {state.actions.map((action) => (
                    <div key={action.id}>
                      <button
                        onClick={() => choose(action.id)}
                        disabled={!action.available || busy}
                      >
                        {action.label}
                      </button>
                      {!action.available && (
                        <p className="play-reason">{action.reason}</p>
                      )}
                      {action.available && (
                        <button
                          className="play-preview"
                          onClick={() => previewAction(action.id)}
                          disabled={busy}
                        >
                          Preview
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {preview && (
                <aside className="play-preview-box">
                  <b>Preview — not committed</b>
                  <p>{preview}</p>
                </aside>
              )}
              {message && (
                <p className="play-message" role="status">
                  {message}
                </p>
              )}
            </article>
            <aside className="play-state">
              <h2>State</h2>
              <dl>
                {view?.stats.map((stat) => (
                  <div key={stat.var}>
                    <dt>{state.strings[stat.labelKey] ?? "State"}</dt>
                    <dd>{String(stat.value)}</dd>
                  </div>
                ))}
              </dl>
              {view && view.achievements.length > 0 && (
                <>
                  <h3>Achievements</h3>
                  <ul>
                    {view.achievements.map((achievement) => (
                      <li key={achievement}>
                        {state.strings[`bureaucracy.ach.${achievement}.name`] ??
                          "Achievement unlocked"}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <hr />
              <button onClick={checkpoint} disabled={busy}>
                Save checkpoint
              </button>
              <button onClick={restore} disabled={!saveId || busy}>
                Restore checkpoint
              </button>
              <p>
                Checkpoints last only while this page stays open. Refreshing
                starts a new demo.
              </p>
            </aside>
          </section>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
