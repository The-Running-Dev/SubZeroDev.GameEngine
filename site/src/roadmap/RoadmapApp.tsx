import { ExternalLink, SiteFooter, SiteHeader } from "../shared";
import {
  completedWorkUnitCount,
  nextActs,
  shippedChapters,
  type RoadmapChapter,
} from "./roadmapData";
import { useRevealOnScroll } from "../hooks/useRevealOnScroll";

function Links({ chapter }: { chapter: RoadmapChapter }) {
  return (
    <p className="roadmap-links">
      {chapter.links.map((link) =>
        link.kind === "repository" ? (
          <ExternalLink key={link.href} href={link.href}>
            {link.label}
          </ExternalLink>
        ) : (
          <a key={link.href} href={link.href}>
            {link.label}
          </a>
        ),
      )}
    </p>
  );
}
function Milestone({ chapter }: { chapter: RoadmapChapter }) {
  return (
    <li data-reveal="" className={`milestone milestone-${chapter.status}`}>
      <div className="milestone-rail">
        <span>{chapter.workUnits}</span>
        <b>{chapter.status.toUpperCase()}</b>
      </div>
      <div>
        <h2>{chapter.title}</h2>
        <p>{chapter.summary}</p>
        {chapter.aside && <p className="commentary">{chapter.aside}</p>}
        <Links chapter={chapter} />
      </div>
    </li>
  );
}

export default function RoadmapApp() {
  useRevealOnScroll();
  return (
    <>
      <SiteHeader current="roadmap" />
      <main className="roadmap-main">
        <section className="roadmap-hero" aria-labelledby="roadmap-title">
          <p className="eyebrow">THE ROADMAP</p>
          <h1 id="roadmap-title">
            How a Quick Question Became {completedWorkUnitCount} Work Units.
          </h1>
          <p className="roadmap-deck">
            The engine now tells stories, simulates a week, remembers what
            happened, and can be packed for other projects. This was not the
            original plan. There was not an original plan.
          </p>
          <dl className="fact-strip">
            <div>
              <dt>{completedWorkUnitCount}</dt>
              <dd>merged work units</dd>
            </div>
            <div>
              <dt>2</dt>
              <dd>implemented kinds</dd>
            </div>
            <div>
              <dt>5</dt>
              <dd>Bulgaria story arcs</dd>
            </div>
            <div>
              <dt>1</dt>
              <dd>third kind in the queue</dd>
            </div>
          </dl>
          <p className="commentary">The queue is deterministic.</p>
          <p className="jump-links">
            <a href="#built">Built</a>
            <a href="#now">Now</a>
            <a href="#next">Next</a>
            <a href="#later">Later</a>
          </p>
        </section>
        <section id="built" className="roadmap-section">
          <p className="section-index">01 / PREVIOUSLY, ON THE GAME ENGINE</p>
          <h2 className="section-heading">
            Built, one sensible escalation at a time.
          </h2>
          <ol className="milestones">
            {shippedChapters.map((chapter) => (
              <Milestone key={chapter.id} chapter={chapter} />
            ))}
          </ol>
        </section>
        <section id="now" className="roadmap-section checkpoint">
          <p className="section-index">02 / NOW</p>
          <h2>The Door Is Open. Somebody Has to Describe the Resort.</h2>
          <p>
            W41 is complete: the package boundary is merged, the clean-consumer
            gate passes, and <code>@the-running-dev/game-engine@0.4.0</code> is
            published. W42's runtime-state contract and W43–W44's world-graph
            content and systems contracts are also shipped. W45's kind
            foundation is reconciled; W46 is next to make its tick pipeline
            real. A contract is a description, not a program.
          </p>
          <p className="roadmap-links">
            <ExternalLink href="https://github.com/The-Running-Dev/SubZeroDev.GameEngine/pull/108">
              W41 merged PR
            </ExternalLink>
            <ExternalLink href="https://github.com/The-Running-Dev/SubZeroDev.GameEngine/blob/main/plans/39-world-graph-kind-programme.md">
              World-graph programme
            </ExternalLink>
            <a href="/docs/engine/todo">Canonical task ledger</a>
          </p>
        </section>
        <section id="next" className="roadmap-section">
          <p className="section-index">03 / NEXT</p>
          <h2 className="section-heading">
            Next: Open the Resort. Regret the Resort.
          </h2>
          <ol className="milestones">
            {nextActs.map((chapter) => (
              <Milestone key={chapter.id} chapter={chapter} />
            ))}
          </ol>
        </section>
        <section id="later" className="roadmap-section later">
          <p className="section-index">04 / LATER</p>
          <h2>Horizons, not promises.</h2>
          <ul>
            <li>
              <b>LATER</b> Session capture after hosting exists.
            </li>
            <li>
              <b>LATER</b> Content packs when there is a second real content
              source.
            </li>
            <li>
              <b>LATER</b> More locales, experiments, and longer-term platform
              work.
            </li>
          </ul>
          <p className="commentary">
            Future Us has been notified. Future Us has not replied.
          </p>
        </section>
        <section className="roadmap-close">
          <p className="section-index">CONTINUE READING</p>
          <h2>Pick your preferred depth.</h2>
          <p>
            <a href="/docs/engine/todo">Read the living roadmap</a>
            <a href="/docs/engine/changelog">Inspect every merged change</a>
            <ExternalLink href="https://github.com/The-Running-Dev/SubZeroDev.GameEngine">
              Browse the repository
            </ExternalLink>
          </p>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
