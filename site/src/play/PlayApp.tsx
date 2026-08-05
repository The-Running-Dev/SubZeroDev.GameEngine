import { useMemo, useState } from "react";
import { SiteFooter, SiteHeader } from "../shared";
import { BrowserClient, type PlayState } from "./browser-client";
import { createBrowserDemo } from "./composition";

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

export default function PlayApp() {
  const demo = useMemo(createBrowserDemo, []);
  const client = useMemo(() => new BrowserClient(demo.store), [demo.store]);
  const [state, setState] = useState<PlayState>();
  const [campaignId, setCampaignId] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [busy, setBusy] = useState(false);
  async function start(id: string) {
    setBusy(true);
    setMessage(undefined);
    try {
      const next = await client.start(id);
      setState(next);
      try {
        await client.save(next.sessionId);
      } catch {
        setMessage("Progress could not be saved locally.");
      }
      setCampaignId(id);
    } catch {
      setMessage("This story could not start.");
    } finally {
      setBusy(false);
    }
  }
  async function choose(id: string) {
    if (!state) return;
    setBusy(true);
    try {
      const next = await client.submit(state, id);
      setState(next.state);
      if (next.result.ok) {
        try {
          await client.save(next.state.sessionId);
        } catch {
          setMessage("Progress could not be saved locally.");
        }
      } else setMessage("That action was rejected.");
    } catch {
      setMessage("That action could not be completed.");
    } finally {
      setBusy(false);
    }
  }
  const selected = demo.catalog.find(
    (campaign) => campaign.campaignId === campaignId,
  );
  const ended = state?.scene.status === "ended";
  return (
    <>
      <SiteHeader current="play" />
      <main className="play-main">
        <section className="play-hero">
          <p className="eyebrow">PLAYABLE STORIES</p>
          <h1>{state ? selected?.title : "Story shelf"}</h1>
          <p>
            {state
              ? "A deterministic story running entirely in this browser."
              : "Local, choice-driven experiments from the SubZeroDev universe."}
          </p>
        </section>
        {!state && (
          <section className="play-shelf" aria-label="Stories">
            {demo.catalog.map((campaign) => (
              <article
                className={
                  campaign.featured ? "play-card featured" : "play-card"
                }
                key={campaign.campaignId}
              >
                <p className="section-index">
                  {campaign.featured ? "FEATURED" : "STANDALONE EPISODE"}
                </p>
                <h2>{campaign.title}</h2>
                <p>{campaign.description}</p>
                <small>{campaign.duration}</small>
                <button
                  className="play-primary"
                  disabled={busy}
                  onClick={() =>
                    campaign.featured
                      ? setNotice(campaign.campaignId)
                      : start(campaign.campaignId)
                  }
                >
                  Start
                </button>
              </article>
            ))}
          </section>
        )}
        {notice && (
          <section className="play-notice" role="dialog" aria-modal="true">
            <h2>Content notice</h2>
            <p>
              This story contains strong language, religious satire,
              dangerous-driving anecdotes, and recognizable parody.
            </p>
            <button
              className="play-primary"
              onClick={() => {
                setNotice(undefined);
                start(notice);
              }}
            >
              I understand — start
            </button>
            <button onClick={() => setNotice(undefined)}>Back</button>
          </section>
        )}
        {state && (
          <section className="play-board" aria-live="polite">
            <article className="play-scene">
              <p className="section-index">
                {ended ? "THE END" : "CURRENT SCENE"}
              </p>
              <h2 tabIndex={-1}>{state.scene.body.text}</h2>
              {ended ? (
                <div>
                  <button
                    className="play-primary"
                    onClick={() => start(campaignId!)}
                  >
                    Start another run
                  </button>
                  {campaignId === demo.catalog[0]?.campaignId && (
                    <button onClick={() => start(campaignId!)}>
                      Play the other role
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setState(undefined);
                      setCampaignId(undefined);
                    }}
                  >
                    Return to stories
                  </button>
                </div>
              ) : (
                <div className="play-actions">
                  {state.actions.map((action) => (
                    <div key={action.id}>
                      <button
                        disabled={busy || !action.available}
                        onClick={() => choose(action.id)}
                      >
                        {action.label}
                      </button>
                      {!action.available && (
                        <p className="play-reason">{action.reason}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {message && <p role="status">{message}</p>}
            </article>
            <aside className="play-state">
              <h2>State</h2>
              <dl>
                {viewOf(state).stats.map((stat) => (
                  <div key={stat.var}>
                    <dt>{state.strings[stat.labelKey]}</dt>
                    <dd>{String(stat.value)}</dd>
                  </div>
                ))}
              </dl>
              <p>
                Progress is saved locally in this browser when possible.
              </p>
              {selected?.sources && (
                <>
                  <h3>Sources / credits</h3>
                  {selected.sources.map((source) => (
                    <a key={source.href} href={source.href}>
                      {source.label}
                    </a>
                  ))}
                </>
              )}
            </aside>
          </section>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
