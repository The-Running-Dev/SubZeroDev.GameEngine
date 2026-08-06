import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
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

const saveWarning =
  "Progress could not be saved locally; this run remains available in this tab.";

const focusableInDialog =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

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
  const [saveFailed, setSaveFailed] = useState(false);
  const [arrivalChoice, setArrivalChoice] = useState<string>();
  const [journey, setJourney] = useState<readonly JourneyEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const sceneHeading = useRef<HTMLHeadingElement>(null);
  const noticeDialog = useRef<HTMLElement>(null);
  const noticeTrigger = useRef<HTMLElement | null>(null);
  const restoreNoticeFocus = useRef(false);
  /** Invalidates in-flight submissions when the player leaves or restarts a run. */
  const runToken = useRef(0);

  const selected = demo.catalog.find(
    (campaign) => campaign.campaignId === (state ? campaignId : selectedId),
  );
  const theme = cabinetThemes[selected?.campaignId ?? ""];
  const ended = state?.scene.status === "ended";
  const sceneText = state?.scene.body.text;

  useEffect(() => {
    if (sceneText) sceneHeading.current?.focus();
  }, [sceneText]);

  /**
   * Restores focus to the control that opened the notice, and only then: a
   * dismissal is the one transition that owes the player their place back.
   */
  useEffect(() => {
    if (notice || !restoreNoticeFocus.current) return;
    restoreNoticeFocus.current = false;
    const trigger = noticeTrigger.current;
    noticeTrigger.current = null;
    if (trigger?.isConnected) trigger.focus();
  }, [notice]);

  function openNotice(id: string, trigger: HTMLElement) {
    noticeTrigger.current = trigger;
    restoreNoticeFocus.current = false;
    setNotice(id);
  }

  function dismissNotice() {
    restoreNoticeFocus.current = true;
    setNotice(undefined);
  }

  function confirmNotice(id: string) {
    restoreNoticeFocus.current = false;
    noticeTrigger.current = null;
    setNotice(undefined);
    void start(id);
  }

  function onNoticeKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      dismissNotice();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable =
      noticeDialog.current?.querySelectorAll<HTMLElement>(focusableInDialog);
    if (!focusable?.length) return;
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  async function start(id: string) {
    const token = ++runToken.current;
    setBusy(true);
    setMessage(undefined);
    setSaveFailed(false);
    try {
      const next = await client.start(id);
      if (runToken.current !== token) return;
      setState(next);
      setCampaignId(id);
      setArrivalChoice(undefined);
      setJourney([{ excerpt: excerpt(next.scene.body.text) }]);
      try {
        await client.save(next.sessionId);
      } catch {
        if (runToken.current !== token) return;
        setSaveFailed(true);
        setMessage(saveWarning);
      }
    } catch {
      if (runToken.current === token) setMessage("This story could not start.");
    } finally {
      if (runToken.current === token) setBusy(false);
    }
  }

  async function choose(id: string) {
    if (!state) return;
    const token = runToken.current;
    const resolvedLabel = state.actions.find(
      (action) => action.id === id,
    )?.label;
    setBusy(true);
    setMessage(undefined);
    setSaveFailed(false);
    try {
      const next = await client.submit(state, id);
      if (runToken.current !== token) return;
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
          if (runToken.current !== token) return;
          setSaveFailed(true);
          setMessage(saveWarning);
        }
      }
    } catch {
      if (runToken.current === token)
        setMessage("That action could not be completed.");
    } finally {
      if (runToken.current === token) setBusy(false);
    }
  }

  function returnToShelf() {
    runToken.current += 1;
    if (campaignId) setSelectedId(campaignId);
    setState(undefined);
    setCampaignId(undefined);
    setMessage(undefined);
    setSaveFailed(false);
    setArrivalChoice(undefined);
    setJourney([]);
    setBusy(false);
  }

  return (
    <>
      <SiteHeader current="play" />
      <main className="play-main">
        {!state ? (
          <section
            className="archive"
            aria-labelledby="shelf-title"
            inert={notice !== undefined}
          >
            <div className="archive-heading">
              <p className="eyebrow">SUBZERO STORY SYSTEM // INSERT DISK</p>
              <h1 id="shelf-title">Adventure disk library</h1>
              <p>
                Select a program. Your choices, bad luck, and improbable
                consequences run entirely on this machine.
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
                    DISK {String(index + 1).padStart(2, "0")} //{" "}
                    {campaign.featured ? "FEATURED" : "READY"}
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
                    className="cabinet-button primary"
                    disabled={busy}
                    onClick={(event) =>
                      openNotice(selected.campaignId, event.currentTarget)
                    }
                  >
                    Load selected adventure
                  </button>
                </div>
              </section>
            )}
          </section>
        ) : (
          <section
            className={`cabinet accent-${theme?.accent ?? "default"}`}
            aria-label={`${selected?.title ?? "Story"} adventure terminal`}
            inert={notice !== undefined}
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
                  className={saveFailed ? "save-lamp warning" : "save-lamp"}
                >
                  <span aria-hidden="true" />{" "}
                  {saveFailed ? "DISK WRITE ERROR" : "GAME SAVED"}
                </span>
                <button
                  className="cabinet-button quiet"
                  onClick={returnToShelf}
                >
                  Quit to library
                </button>
              </div>
            </header>
            <div className="cabinet-layout">
              <article className="scene-viewport" aria-live="polite">
                <p className="scene-kicker">
                  {ended ? "SESSION COMPLETE" : "ROOM DESCRIPTION"}
                </p>
                <h2 ref={sceneHeading} tabIndex={-1}>
                  {state.scene.body.text}
                </h2>
                <div className="arrival-receipt" role="status">
                  {arrivalChoice ? (
                    <>
                      <span>Last command</span>
                      <strong>{arrivalChoice}</strong>
                      <span className="arrival-link">// accepted</span>
                    </>
                  ) : (
                    <strong>PROGRAM LOADED. YOUR STORY BEGINS HERE.</strong>
                  )}
                </div>
                {ended ? (
                  <div className="ending-controls">
                    <p className="ending-placard">
                      This matter has been concluded with excessive ceremony.
                    </p>
                    <button
                      className="cabinet-button primary"
                      disabled={busy}
                      onClick={(event) =>
                        openNotice(campaignId!, event.currentTarget)
                      }
                    >
                      Start another run
                    </button>
                    {campaignId === demo.catalog[0]?.campaignId && (
                      <button
                        className="cabinet-button"
                        disabled={busy}
                        onClick={(event) =>
                          openNotice(campaignId!, event.currentTarget)
                        }
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
                    <p className="deck-label">What will you do?</p>
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
                  <p className="eyebrow">SIDE PANEL // MEMORY</p>
                  <h2 id="console-title">Player status</h2>
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
                  <summary>Travel log</summary>
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
                  Player-visible memory only. No engine internals displayed.
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
          <div className="notice-backdrop" onKeyDown={onNoticeKeyDown}>
            <section
              ref={noticeDialog}
              className="play-notice"
              role="dialog"
              aria-modal="true"
              aria-labelledby="notice-title"
            >
              <p className="eyebrow">SYSTEM MESSAGE // CONTENT NOTICE</p>
              <h2 id="notice-title">Before loading this program</h2>
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
                  onClick={() => confirmNotice(notice)}
                >
                  Continue loading
                </button>
                <button
                  className="cabinet-button quiet"
                  onClick={dismissNotice}
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
