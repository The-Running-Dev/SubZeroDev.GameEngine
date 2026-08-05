import { useEffect, useMemo, useRef, useState } from "react";
import { SiteFooter, SiteHeader } from "../shared";
import { BrowserClient, type PlayState } from "./browser-client";
import { createBrowserDemo } from "./composition";

const cabinetThemes: Readonly<
  Record<string, { accent: string; eyebrow: string }>
> = {
  "lucifer-chronicles": { accent: "ember", eyebrow: "CELESTIAL CASE FILE" },
  "bulgaria-bureaucracy": { accent: "red", eyebrow: "MUNICIPAL ARCHIVE" },
  "bulgaria-return": { accent: "teal", eyebrow: "RETURN DEPARTMENT" },
  "bulgaria-driving": { accent: "yellow", eyebrow: "ROAD SAFETY OFFICE" },
  "bulgaria-inheritance": { accent: "green", eyebrow: "ESTATE RECORDS" },
  "bulgaria-enterprise": { accent: "violet", eyebrow: "ENTERPRISE DESK" },
};

function viewOf(state: PlayState) {
  const view = state.view.kindView as {
    stats?: {
      var: string;
      labelKey: string;
      value: string | number | boolean;
    }[];
    unlockedAchievements?: string[];
  };
  return {
    stats: view.stats ?? [],
    achievements: view.unlockedAchievements ?? [],
  };
}

interface JourneyEntry {
  readonly excerpt: string;
  readonly choice?: string;
}

function excerpt(text: string): string {
  return text.length <= 150 ? text : `${text.slice(0, 147).trimEnd()}…`;
}

export default function PlayApp() {
  const demo = useMemo(createBrowserDemo, []);
  const client = useMemo(() => new BrowserClient(demo.store), [demo.store]);
  const [state, setState] = useState<PlayState>();
  const [campaignId, setCampaignId] = useState<string>();
  const [selectedId, setSelectedId] = useState(demo.catalog[0]?.campaignId);
  const [notice, setNotice] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [arrivalChoice, setArrivalChoice] = useState<string>();
  const [journey, setJourney] = useState<readonly JourneyEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const sceneHeading = useRef<HTMLHeadingElement>(null);
  const briefingTrigger = useRef<HTMLButtonElement>(null);

  const selected = demo.catalog.find(
    (campaign) => campaign.campaignId === (state ? campaignId : selectedId),
  );
  const theme = cabinetThemes[selected?.campaignId ?? ""];
  const ended = state?.scene.status === "ended";
  const sceneText = state?.scene.body.text;

  useEffect(() => {
    if (sceneText) sceneHeading.current?.focus();
  }, [sceneText]);

  useEffect(() => {
    if (!notice) briefingTrigger.current?.focus();
  }, [notice]);

  async function start(id: string) {
    setBusy(true);
    setMessage(undefined);
    try {
      const next = await client.start(id);
      setState(next);
      setCampaignId(id);
      setArrivalChoice(undefined);
      setJourney([{ excerpt: excerpt(next.scene.body.text) }]);
      try {
        await client.save(next.sessionId);
      } catch {
        setMessage(
          "Progress could not be saved locally; this run remains available in this tab.",
        );
      }
    } catch {
      setMessage("This story could not start.");
    } finally {
      setBusy(false);
    }
  }

  async function choose(id: string) {
    if (!state) return;
    const resolvedLabel = state.actions.find(
      (action) => action.id === id,
    )?.label;
    setBusy(true);
    setMessage(undefined);
    try {
      const next = await client.submit(state, id);
      setState(next.state);
      if (!next.result.ok)
        setMessage("That action was rejected. The scene has not changed.");
      else {
        if (resolvedLabel) {
          setArrivalChoice(resolvedLabel);
          setJourney((current) => [
            ...current,
            {
              choice: resolvedLabel,
              excerpt: excerpt(next.state.scene.body.text),
            },
          ]);
        }
        try {
          await client.save(next.state.sessionId);
        } catch {
          setMessage(
            "Progress could not be saved locally; this run remains available in this tab.",
          );
        }
      }
    } catch {
      setMessage("That action could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  function returnToShelf() {
    if (campaignId) setSelectedId(campaignId);
    setState(undefined);
    setCampaignId(undefined);
    setMessage(undefined);
    setArrivalChoice(undefined);
    setJourney([]);
  }

  return (
    <>
      <SiteHeader current="play" />
      <main className="play-main">
        {!state ? (
          <section className="archive" aria-labelledby="shelf-title">
            <div className="archive-heading">
              <p className="eyebrow">PUBLIC RECORDS / PLAYABLE STORIES</p>
              <h1 id="shelf-title">The story shelf</h1>
              <p>
                Choose a dossier. Every improbable consequence runs entirely in
                this browser.
              </p>
            </div>
            <div className="dossier-grid" aria-label="Story dossiers">
              {demo.catalog.map((campaign, index) => (
                <button
                  className={`dossier ${campaign.featured ? "dossier-featured" : ""} ${selectedId === campaign.campaignId ? "is-selected" : ""}`}
                  key={campaign.campaignId}
                  onClick={() => setSelectedId(campaign.campaignId)}
                  aria-pressed={selectedId === campaign.campaignId}
                >
                  <span className="dossier-number">
                    FILE {String(index + 1).padStart(2, "0")}
                  </span>
                  <strong>{campaign.title}</strong>
                  <span>{campaign.duration}</span>
                </button>
              ))}
            </div>
            {selected && (
              <section className="briefing" aria-labelledby="briefing-title">
                <div
                  className={`briefing-emblem accent-${cabinetThemes[selected.campaignId]?.accent ?? "default"}`}
                  aria-hidden="true"
                >
                  ⌘
                </div>
                <div>
                  <p className="eyebrow">
                    {cabinetThemes[selected.campaignId]?.eyebrow ??
                      "UNCLASSIFIED STORY"}
                  </p>
                  <h2 id="briefing-title">{selected.title}</h2>
                  <p>{selected.description}</p>
                  <p className="briefing-meta">
                    Estimated duration: {selected.duration}
                  </p>
                  <button
                    ref={briefingTrigger}
                    className="cabinet-button primary"
                    disabled={busy}
                    onClick={() => setNotice(selected.campaignId)}
                  >
                    Open dossier and start
                  </button>
                </div>
              </section>
            )}
          </section>
        ) : (
          <section
            className={`cabinet accent-${theme?.accent ?? "default"}`}
            aria-label={`${selected?.title ?? "Story"} game cabinet`}
          >
            <header className="cabinet-marquee">
              <div>
                <p className="eyebrow">
                  {theme?.eyebrow ?? "STORY IN PROGRESS"}
                </p>
                <h1>{selected?.title}</h1>
              </div>
              <div className="marquee-controls">
                <span
                  className={
                    message?.startsWith("Progress could not")
                      ? "save-lamp warning"
                      : "save-lamp"
                  }
                >
                  <span aria-hidden="true" />{" "}
                  {message?.startsWith("Progress could not")
                    ? "SAVE WARNING"
                    : "LOCAL CHECKPOINT"}
                </span>
                <button
                  className="cabinet-button quiet"
                  onClick={returnToShelf}
                >
                  Story shelf
                </button>
              </div>
            </header>
            <div className="cabinet-layout">
              <article className="scene-viewport" aria-live="polite">
                <p className="scene-kicker">
                  {ended ? "CASE CLOSED" : "CURRENT SCENE"}
                </p>
                <h2 ref={sceneHeading} tabIndex={-1}>
                  {state.scene.body.text}
                </h2>
                <div className="arrival-receipt" role="status">
                  {arrivalChoice ? (
                    <>
                      <span>You chose</span>
                      <strong>{arrivalChoice}</strong>
                      <span className="arrival-link">
                        which brought you here.
                      </span>
                    </>
                  ) : (
                    <strong>Your story begins here.</strong>
                  )}
                </div>
                {ended ? (
                  <div className="ending-controls">
                    <p className="ending-placard">
                      This matter has been concluded with excessive ceremony.
                    </p>
                    <button
                      className="cabinet-button primary"
                      onClick={() => start(campaignId!)}
                    >
                      Start another run
                    </button>
                    {campaignId === demo.catalog[0]?.campaignId && (
                      <button
                        className="cabinet-button"
                        onClick={() => start(campaignId!)}
                      >
                        Play the other role
                      </button>
                    )}
                    <button
                      className="cabinet-button quiet"
                      onClick={returnToShelf}
                    >
                      Return to stories
                    </button>
                  </div>
                ) : (
                  <div
                    className="action-deck"
                    aria-label="Available actions"
                    aria-busy={busy}
                  >
                    <p className="deck-label">
                      Select an official course of action
                    </p>
                    {state.actions.map((action, index) => (
                      <div
                        className={`action-card ${!action.available ? "unavailable" : ""}`}
                        key={action.id}
                      >
                        <button
                          disabled={busy || !action.available}
                          onClick={() => choose(action.id)}
                        >
                          <span className="action-number" aria-hidden="true">
                            {index + 1}
                          </span>
                          {action.label}
                        </button>
                        {!action.available && (
                          <p className="play-reason">
                            Unavailable: {action.reason}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {message && (
                  <p className="play-message" role="status">
                    {message}
                  </p>
                )}
              </article>
              <aside className="status-console" aria-labelledby="console-title">
                <div className="console-heading">
                  <p className="eyebrow">LIVE PROJECTION</p>
                  <h2 id="console-title">Status console</h2>
                </div>
                {viewOf(state).stats.length ? (
                  <dl className="stat-readouts">
                    {viewOf(state).stats.map((stat) => (
                      <div key={stat.var}>
                        <dt>{state.strings[stat.labelKey]}</dt>
                        <dd>{String(stat.value)}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="console-empty">
                    No visible statistics have been authorized for this case.
                  </p>
                )}
                {viewOf(state).achievements.length > 0 && (
                  <p className="achievement-note">
                    <span aria-hidden="true">◆ </span>
                    Achievement stamps: {viewOf(state).achievements.length}
                  </p>
                )}
                <details className="journey-log">
                  <summary>Journey so far</summary>
                  <ol>
                    {journey.map((entry, index) => (
                      <li
                        key={`${index}-${entry.excerpt}`}
                        aria-current={
                          index === journey.length - 1 ? "step" : undefined
                        }
                      >
                        {entry.choice && (
                          <strong>You chose {entry.choice}. </strong>
                        )}
                        <span>{entry.excerpt}</span>
                        {index === journey.length - 1 && <em> Current page</em>}
                      </li>
                    ))}
                  </ol>
                  {journey.length > 1 && (
                    <p className="journey-origin">
                      Where I came from: {journey[journey.length - 2]?.excerpt}
                    </p>
                  )}
                </details>
                <p className="console-footnote">
                  This console shows only the player-facing record.
                </p>
                {selected?.sources && (
                  <div className="source-links">
                    <h3>Sources / credits</h3>
                    {selected.sources.map((source) => (
                      <a key={source.href} href={source.href}>
                        {source.label}
                      </a>
                    ))}
                  </div>
                )}
              </aside>
            </div>
          </section>
        )}
        {notice && (
          <div className="notice-backdrop">
            <section
              className="play-notice"
              role="dialog"
              aria-modal="true"
              aria-labelledby="notice-title"
            >
              <p className="eyebrow">CONTENT NOTICE</p>
              <h2 id="notice-title">Before opening this file</h2>
              <p>
                {
                  demo.catalog.find(
                    (campaign) => campaign.campaignId === notice,
                  )?.contentNotice
                }
              </p>
              <div>
                <button
                  className="cabinet-button primary"
                  autoFocus
                  onClick={() => {
                    const id = notice;
                    setNotice(undefined);
                    void start(id);
                  }}
                >
                  I understand — start
                </button>
                <button
                  className="cabinet-button quiet"
                  onClick={() => setNotice(undefined)}
                >
                  Back
                </button>
              </div>
            </section>
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
