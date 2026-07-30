import type { ReactNode } from "react";
import "./landing.css";
import "./css/motion.css";
import { useRevealOnScroll } from "./hooks/useRevealOnScroll";

const docs = "/docs/";
const repository = "https://github.com/The-Running-Dev/SubZeroDev.GameEngine";

/**
 * Root-relative, not absolute. The landing page is packaged to be served at
 * `/`, with the documentation site at `/docs` on the same origin — so a path
 * is enough; there is no cross-origin gap to bridge with a full URL anymore.
 *
 * The route *paths* below are still verified against
 * plans/06-landing-page/00-repository-reality.md §3, and that inventory is
 * still the only check on them: nothing here validates that /docs/engine/core
 * exists, since the docs site's own link checker only sees its own routes and
 * build/Test-Documentation.ps1 skips site-absolute targets by design. Re-read
 * the inventory whenever docs/docs/engine/ is restructured.
 *
 * Hosting is GitHub Pages, at game-engine.subzerodev.com — the docs site's
 * existing deployment, now serving both projects. What still does NOT exist is
 * the build-assembly step: how this project's `dist/` and the docs site's
 * build get merged into the one artifact tree docs-deploy.yml uploads. See
 * 00-repository-reality.md §6.
 */
const routes = {
  architecture: "/docs/engine/architecture",
  core: "/docs/engine/core",
  storyGraph: "/docs/engine/story-graph-kind",
  simulation: "/docs/engine/simulation-kind",
  worldGraph: "/docs/engine/world-graph-kind",
  contentPacks: "/docs/engine/content-packs",
  clients: "/docs/engine/clients",
} as const;

const branches = [
  {
    campaign: "Bulgaria: Make-Your-Own-Adventure",
    href: routes.storyGraph,
    kind: "story-graph",
  },
  {
    campaign: "Life in the Fast Lane",
    href: routes.simulation,
    kind: "simulation",
  },
  {
    campaign: "Sun Trap",
    href: routes.worldGraph,
    kind: "world-graph",
  },
];

const refusals = [
  "Hide randomness where nobody can reproduce it.",
  "Embed gameplay rules inside rendering code.",
  "Allow arbitrary state mutation.",
  "Trust generated content because it sounded confident.",
];

const capabilities = [
  "Produce randomness you can reproduce from a seed.",
  "Serialize a world to bytes, identically, every time.",
  "Separate mechanics from fiction.",
  "Become considerably larger than the original idea.",
];

type LinkProps = { href: string; children: ReactNode };

/**
 * Documentation links navigate in place. The docs are where the reader is meant
 * to continue, so opening a tab per link — thirteen of them — is friction, not
 * courtesy. Anyone wanting a tab can still middle-click.
 */
function DocsLink({ href, children }: LinkProps) {
  return <a href={href}>{children}</a>;
}

/**
 * The repository is a genuinely different property, so it opens in a new tab —
 * and says so, since a new window with no warning is disorienting for anyone
 * not watching the viewport.
 */
function RepositoryLink({ href, children }: LinkProps) {
  return (
    <a href={href} target="_blank" rel="noreferrer">
      {children}
      <span className="visually-hidden"> (opens in a new tab)</span>
    </a>
  );
}

/**
 * The only anchor on the page used to be the hero's "Scroll. It escalates.",
 * reaching exactly one section further. This is the same device, reused at the
 * end of every section, so the chain reaches all the way to the end and every
 * section has a real, deep-linkable id rather than existing only as scroll
 * position.
 */
function ContinueLink({ to }: { to: string }) {
  return (
    <a className="continue" href={to}>
      Continue <span aria-hidden="true">↓</span>
    </a>
  );
}

function App() {
  useRevealOnScroll();

  return (
    <>
      <header className="site-header">
        <a
          className="wordmark"
          href="#top"
          aria-label="SubZeroDev Game Engine home"
        >
          <span>SUBZERODEV</span>
          <strong>GAME ENGINE</strong>
        </a>
        <nav aria-label="Explore the project">
          <DocsLink href={routes.architecture}>Architecture</DocsLink>
          <DocsLink href={docs}>Documentation</DocsLink>
          <RepositoryLink href={repository}>GitHub</RepositoryLink>
        </nav>
      </header>

      <main>
        <section id="top" className="hero" aria-labelledby="hero-title">
          <p className="eyebrow">SUBZERODEV GAME ENGINE</p>
          <h1 id="hero-title">
            Build mechanics once.
            <br /> Create infinite games.
          </h1>
          <p className="hero-pause" aria-hidden="true">
            ...
          </p>
          {/*
            Desktop-only easter egg, and that limitation is deliberate. Touch
            has no hover, and making a decorative line focusable would add a tab
            stop that announces nothing useful. The alternate is hidden from
            assistive technology so the line reads once, not twice.
          */}
          <p className="signature">
            <span className="signature-default">Well... why not?</span>
            <span className="signature-alt" aria-hidden="true">
              Seriously. Why not?
            </span>
          </p>
          <a className="scroll-invitation" href="#origin">
            Scroll. It escalates. <span aria-hidden="true">↓</span>
          </a>
        </section>

        <section
          id="origin"
          data-reveal=""
          className="origin section-narrow"
          aria-labelledby="origin-title"
        >
          <p className="section-index">01 / THE ACCIDENT</p>
          <h2 id="origin-title">
            I missed <em>Jones in the Fast Lane</em>.
          </h2>
          <div className="prose-stack">
            <p>So I asked an LLM how it worked.</p>
            <p>That was a mistake.</p>
            <p className="inventory">
              Jobs. Education. Money. Needs. Schedules. Relationships. Random
              events.
            </p>
            <p>Then it started suggesting implementation details.</p>
            <p>That was unfortunate.</p>
          </div>
          <ContinueLink to="#problem" />
        </section>

        <section
          id="problem"
          className="problem section-wide"
          aria-labelledby="problem-title"
        >
          <p className="section-index">02 / THE RECURRING PROBLEM</p>
          <h2 id="problem-title">The problem was not rendering.</h2>
          <div className="split-prose">
            <p>
              Game engines solved rendering. Physics. Input. Audio. Networking.
            </p>
            <p>
              And we kept rewriting inventory systems. Then schedules.
              Economies. Progression.
            </p>
          </div>
          <p className="aside">That seemed... inefficient.</p>
          <ContinueLink to="#realization" />
        </section>

        <section
          id="realization"
          data-reveal=""
          className="realization section-narrow"
          aria-labelledby="realization-title"
        >
          <p className="section-index">03 / THE QUESTION</p>
          <h2 id="realization-title">Wait.</h2>
          <p className="display-copy">Why would I write this for one game?</p>
          <div className="prose-stack compact">
            <p>A job system is not a game.</p>
            <p>An inventory is not a game.</p>
            <p>A relationship model is not a game.</p>
            <p>They are mechanics. And mechanics should be reusable.</p>
          </div>
          <ContinueLink to="#architecture" />
        </section>

        <section
          id="architecture"
          className="architecture section-wide"
          aria-labelledby="architecture-title"
        >
          <div className="architecture-intro">
            <p className="section-index">04 / THE MODEL</p>
            <h2 id="architecture-title">Reuse the rules. Replace the world.</h2>
            <p>
              One deterministic core. Reviewed kinds. Campaigns with their own
              content. Clients that present rather than participate.
            </p>
          </div>

          {/*
          role="group" is load-bearing: aria-label is ignored on a bare div,
          whose implicit role is generic. Without a role, this description --
          the diagram's text alternative -- is announced by nothing.
        */}
          <div
            data-reveal=""
            className="architecture-diagram"
            role="group"
            aria-label="Architecture: Core is inherited by Kinds, which plus content become Campaigns, presented by Clients. Kinds fan out to three engine-owned kinds — story-graph, simulation and world-graph — each with a flagship campaign."
          >
            <div className="architecture-spine">
              <DocsLink href={routes.core}>Core</DocsLink>
              <span aria-hidden="true">inherited by</span>
              <DocsLink href={routes.architecture}>Kinds</DocsLink>
              <span aria-hidden="true">plus content</span>
              <DocsLink href={routes.contentPacks}>Campaigns</DocsLink>
              <span aria-hidden="true">presented by</span>
              <DocsLink href={routes.clients}>Clients</DocsLink>
            </div>
            <ul className="kind-branches">
              {branches.map((branch) => (
                <li key={branch.kind} className="kind-branch">
                  <DocsLink href={branch.href}>{branch.kind}</DocsLink>
                  <p>flagship campaign</p>
                  <strong>{branch.campaign}</strong>
                </li>
              ))}
            </ul>
          </div>
          <p className="architecture-note">
            Mechanics live inside Kinds — there is no separate mechanics layer.
            Kinds define mechanics. Campaigns define worlds. Clients simply
            present them.
          </p>
          <ContinueLink to="#abstraction" />
        </section>

        <section
          id="abstraction"
          className="abstraction section-narrow"
          aria-labelledby="abstraction-title"
        >
          <p className="section-index">05 / THE LIMIT</p>
          <h2 id="abstraction-title">
            The engine doesn&apos;t know what a dragon is.
          </h2>
          <p className="list-sentence">
            Or a detective. Or a hotel. Or a spaceship. Or Bulgaria.
          </p>
          <p>It understands:</p>
          <p className="inventory">
            State. Commands. Rules. Time. Relationships. Resources.
            Consequences.
          </p>
          <p>Everything else is remarkably specific data.</p>
          <ContinueLink to="#contract" />
        </section>

        <section
          id="contract"
          className="contract section-wide"
          aria-labelledby="contract-title"
        >
          <div>
            <p className="section-index">06 / THE BOUNDARY</p>
            <h2 id="contract-title">Commands are the boundary.</h2>
          </div>
          <div className="contract-copy">
            <p>
              In the engine&apos;s design, humans submit commands. AI submits
              commands. The engine validates both. Neither gets permission to
              reach into the world and rearrange state directly.
            </p>
            <p>
              Equality is important. Especially when both are about to violate
              validation rules.
            </p>
            <ContinueLink to="#principles" />
          </div>
        </section>

        {/*
        Refusals and capabilities are deliberately NOT rendered alike. Matched
        ledgers read as one long block and cancel the contrast the pairing
        exists to create — so refusals keep the numbered ledger, and
        capabilities are a tighter unnumbered run.
      */}
        <section
          id="principles"
          className="ledgers section-wide"
          aria-label="Engine principles"
        >
          <article className="ledger-refusals" aria-labelledby="refusals-title">
            <p className="section-index">07 / REFUSALS</p>
            <h2 id="refusals-title">Things this engine refuses to do</h2>
            <ol>
              {refusals.map((item, index) => (
                <li key={item}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  {item}
                </li>
              ))}
            </ol>
          </article>
          <article
            className="ledger-capabilities"
            aria-labelledby="capabilities-title"
          >
            <p className="section-index">08 / CAPABILITIES</p>
            <h2 id="capabilities-title">Things it happily does</h2>
            <ul>
              {capabilities.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <ContinueLink to="#resolution" />
          </article>
        </section>

        <section
          id="resolution"
          data-reveal=""
          className="resolution section-narrow"
          aria-labelledby="resolution-title"
        >
          <p className="section-index">09 / THE ESCALATION</p>
          <h2 id="resolution-title">
            This project did not begin with a grand vision.
          </h2>
          <div className="prose-stack">
            <p>
              It began because I missed <em>Jones in the Fast Lane</em>.
            </p>
            <p>
              The reasonable response would have been to enjoy the explanation,
              close the conversation, and go to bed.
            </p>
            <p>Instead, one question led to another.</p>
            <p className="time-passage">A week later...</p>
            <p>I had apparently started writing a game engine.</p>
            <p>
              I still maintain this is entirely the LLM&apos;s fault. It should
              have given a shorter answer.
            </p>
          </div>
          <ContinueLink to="#continue" />
        </section>

        <section
          id="continue"
          data-reveal=""
          className="cta section-wide"
          aria-labelledby="cta-title"
        >
          <p className="section-index">10 / CONTINUE READING</p>
          <h2 id="cta-title">Still here?</h2>
          <p>Good. Now it becomes considerably less philosophical.</p>
          <div className="cta-actions">
            <DocsLink href={routes.architecture}>
              Read the architecture <span aria-hidden="true">→</span>
            </DocsLink>
            <DocsLink href={docs}>View the documentation</DocsLink>
            <RepositoryLink href={repository}>
              Browse the repository
            </RepositoryLink>
          </div>
        </section>
      </main>

      <footer>
        <p>Started because someone asked an LLM the wrong question.</p>
        <p>Built because nobody stopped asking better ones.</p>
        <strong>Well... why not?</strong>
        <small>
          No inventory systems were harmed during the making of this engine.
          Probably.
        </small>
      </footer>
    </>
  );
}

export default App;
