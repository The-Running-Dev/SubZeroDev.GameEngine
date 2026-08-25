import "./landing.css";
import "./site.css";
import "./css/motion.css";
import { useRevealOnScroll } from "./hooks/useRevealOnScroll";
import {
  adventures,
  DocsLink,
  ExternalLink,
  ExternalLink as RepositoryLink,
  SiteFooter,
  SiteHeader,
} from "./shared";

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
 * Hosting is GitHub Pages, at game-engine.subzerodev.com. The published landing-page
 * package performs the protected merge of this site's output and the docs artifact.
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
      <SiteHeader current="home" />

      <main>
        <section id="top" className="hero" aria-labelledby="hero-title">
          <p className="eyebrow">SUBZERODEV GAME ENGINE</p>
          <h1 id="hero-title">
            Build Mechanics Once.
            <br /> Create Infinite Games.
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
              Fine. Why not?
            </span>
          </p>
          <div className="commentary">
            <p>
              <span className="commentary-marker" aria-hidden="true">
                *
              </span>
              Results may include:
            </p>
            <ul>
              <li>an accidental game engine</li>
              <li>this page, explaining the accidental game engine</li>
              <li>continued uncertainty about how any of this happened</li>
            </ul>
          </div>
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
            I Missed <em>Jones in the Fast Lane</em>.
          </h2>
          <div className="prose-stack">
            <p>So I asked an LLM how it worked.</p>
            <p>That was a mistake.</p>
            <p className="inventory">
              Jobs. Education. Money. Needs. Schedules. Relationships. Random
              events.
            </p>
            <p>Then it started suggesting implementation details.</p>
            <p>That escalated quickly.</p>
          </div>
          <ContinueLink to="#problem" />
        </section>

        <section
          id="problem"
          className="problem section-wide"
          aria-labelledby="problem-title"
        >
          <p className="section-index">02 / THE PATTERN</p>
          <h2 id="problem-title">The Problem Was Not Rendering.</h2>
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
            <p className="section-index">04 / THE ARCHITECTURE</p>
            <h2 id="architecture-title">Reuse the Rules. Replace the World.</h2>
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
            The Engine Doesn&apos;t Know What a Dragon Is.
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
          <ContinueLink to="#trace" />
        </section>

        <section
          id="trace"
          data-reveal=""
          className="trace section-narrow"
          aria-labelledby="trace-title"
        >
          <p className="section-index">06 / THE EXAMPLE</p>
          <h2 id="trace-title">Here&apos;s What It Does Know.</h2>
          <p className="trace-lead">
            The MVP&apos;s worked example, from the story-graph kind spec: a
            requirement-gated retry, a loop with visit counts, and one seeded
            coin flip.
          </p>
          <ol className="trace-flow">
            <li>
              <strong>municipality</strong>
              <span>
                Wait it out, or meet the mayor&apos;s cousin over coffee.
              </span>
            </li>
            <li>
              <strong>clerk_review</strong>
              <span>Seeded random: she smiles, or she doesn&apos;t.</span>
            </li>
            <li>
              <strong>expired</strong>
              <span>
                Certificate&apos;s three months stale. Start over — or, patience
                run out, cut the line.
              </span>
            </li>
            <li>
              <strong>room_14</strong>
              <span>
                Sent to Room 6. Everything happens in Room 14. Three visits,
                then out.
              </span>
            </li>
            <li>
              <strong>reward</strong>
              <span>
                €300, 28 years of legal responsibility, and the achievement{" "}
                <em>It Builds Character</em>.
              </span>
            </li>
          </ol>
          <p className="commentary">
            <span className="commentary-marker" aria-hidden="true">
              *
            </span>
            This is the spec, not a screenshot. The engine now runs it — the
            shape was real long before this page was.
          </p>
          <DocsLink href={routes.storyGraph}>
            Read the full worked example
          </DocsLink>
          <ContinueLink to="#contract" />
        </section>

        <section
          id="contract"
          className="contract section-wide"
          aria-labelledby="contract-title"
        >
          <div>
            <p className="section-index">07 / THE BOUNDARY</p>
            <h2 id="contract-title">Commands Are the Boundary.</h2>
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
            <p className="section-index">08 / REFUSALS</p>
            <h2 id="refusals-title">Things This Engine Refuses to Do</h2>
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
            <p className="section-index">09 / CAPABILITIES</p>
            <h2 id="capabilities-title">Things It Happily Does</h2>
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
          <p className="section-index">10 / THE ESCALATION</p>
          <h2 id="resolution-title">
            This Project Did Not Begin With a Grand Vision.
          </h2>
          <p className="commentary">
            <span className="commentary-marker" aria-hidden="true">
              *
            </span>
            This was supposed to be a quick question. It wasn&apos;t.
          </p>
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
          <ContinueLink to="#worlds" />
        </section>

        <section
          id="worlds"
          data-reveal=""
          className="worlds section-wide"
          aria-labelledby="worlds-title"
        >
          <p className="section-index">11 / THE ENGINE</p>
          <h2 id="worlds-title">It Exists.</h2>
          <p className="worlds-lead">So do the worlds it will run.</p>
          <ul className="worlds-list">
            {branches.map((branch) => (
              <li key={branch.kind} className="worlds-item">
                <strong>{branch.campaign}</strong>
                <DocsLink href={branch.href}>{branch.kind}</DocsLink>
              </li>
            ))}
          </ul>
          <p className="commentary">
            <span className="commentary-marker" aria-hidden="true">
              *
            </span>
            Story-graph lives on in Adventures. Simulation now has game-length replay
            proof; simulation and world-graph are still engine proofs, not polished games.
            The distinction matters.
          </p>
          <ContinueLink to="#continue" />
        </section>

        <section
          id="continue"
          data-reveal=""
          className="cta section-wide"
          aria-labelledby="cta-title"
        >
          <p className="section-index">12 / CONTINUE READING</p>
          <h2 id="cta-title">Still Here?</h2>
          <p>Good. Now it becomes considerably less philosophical.</p>
          <div className="cta-actions">
            <ExternalLink className="cta-play" href={adventures}>
              Play the adventures
            </ExternalLink>
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

      <SiteFooter />
    </>
  );
}

export default App;
