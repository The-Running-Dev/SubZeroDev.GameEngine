import "./landing.css";

const docs = "https://game-engine.subzerodev.com/docs/";
const repository = "https://github.com/The-Running-Dev/SubZeroDev.GameEngine";

const routes = {
  architecture: "https://game-engine.subzerodev.com/docs/engine/architecture",
  core: "https://game-engine.subzerodev.com/docs/engine/core",
  storyGraph: "https://game-engine.subzerodev.com/docs/engine/story-graph-kind",
  simulation: "https://game-engine.subzerodev.com/docs/engine/simulation-kind",
  worldGraph: "https://game-engine.subzerodev.com/docs/engine/world-graph-kind",
  vision: "https://game-engine.subzerodev.com/docs/engine/vision",
  clients: "https://game-engine.subzerodev.com/docs/engine/clients",
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

function ExternalLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  );
}

function App() {
  return (
    <main>
      <header className="site-header" aria-label="Primary navigation">
        <a
          className="wordmark"
          href="#top"
          aria-label="SubZeroDev Game Engine home"
        >
          <span>SUBZERODEV</span>
          <strong>GAME ENGINE</strong>
        </a>
        <nav aria-label="Explore the project">
          <ExternalLink href={routes.architecture}>Architecture</ExternalLink>
          <ExternalLink href={docs}>Documentation</ExternalLink>
          <ExternalLink href={repository}>GitHub</ExternalLink>
        </nav>
      </header>

      <section id="top" className="hero" aria-labelledby="hero-title">
        <p className="eyebrow">SUBZERODEV GAME ENGINE</p>
        <h1 id="hero-title">
          Build mechanics once.
          <br /> Create infinite games.
        </h1>
        <p className="hero-pause" aria-hidden="true">
          ...
        </p>
        <p className="signature">Well... why not?</p>
        <a className="scroll-invitation" href="#origin">
          Scroll. It escalates. <span aria-hidden="true">↓</span>
        </a>
      </section>

      <section
        id="origin"
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
      </section>

      <section className="problem section-wide" aria-labelledby="problem-title">
        <p className="section-index">02 / THE RECURRING PROBLEM</p>
        <h2 id="problem-title">The problem was not rendering.</h2>
        <div className="split-prose">
          <p>
            Game engines solved rendering. Physics. Input. Audio. Networking.
          </p>
          <p>
            And we kept rewriting inventory systems. Then schedules. Economies.
            Progression. Relationships. Consequences.
          </p>
        </div>
        <p className="aside">That seemed... inefficient.</p>
      </section>

      <section
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
      </section>

      <section
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

        <div
          className="architecture-diagram"
          aria-label="Core, Kinds, Campaigns, and Clients; Kinds fan out to story-graph, simulation, and world-graph campaigns."
        >
          <div className="architecture-spine">
            <ExternalLink href={routes.core}>Core</ExternalLink>
            <span>inherited by</span>
            <ExternalLink href={routes.architecture}>Kinds</ExternalLink>
            <span>plus content</span>
            <ExternalLink href={routes.vision}>Campaigns</ExternalLink>
            <span>presented by</span>
            <ExternalLink href={routes.clients}>Clients</ExternalLink>
          </div>
          <div
            className="kind-branches"
            aria-label="The three engine-owned kinds and their flagship campaigns"
          >
            {branches.map((branch) => (
              <article key={branch.kind} className="kind-branch">
                <ExternalLink href={branch.href}>{branch.kind}</ExternalLink>
                <p>flagship campaign</p>
                <strong>{branch.campaign}</strong>
              </article>
            ))}
          </div>
        </div>
        <p className="architecture-note">
          Mechanics live inside Kinds — there is no separate mechanics layer.
          Kinds define mechanics. Campaigns define worlds. Clients simply
          present them.
        </p>
      </section>

      <section
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
          State. Commands. Rules. Time. Relationships. Resources. Consequences.
        </p>
        <p>Everything else is remarkably specific data.</p>
      </section>

      <section
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
        </div>
      </section>

      <section className="ledgers section-wide" aria-label="Engine principles">
        <article aria-labelledby="refusals-title">
          <p className="section-index">07 / REFUSALS</p>
          <h2 id="refusals-title">Things this engine refuses to do</h2>
          <ol>
            {refusals.map((item, index) => (
              <li key={item}>
                <span>0{index + 1}</span>
                {item}
              </li>
            ))}
          </ol>
        </article>
        <article aria-labelledby="capabilities-title">
          <p className="section-index">08 / CAPABILITIES</p>
          <h2 id="capabilities-title">Things it happily does</h2>
          <ol>
            {capabilities.map((item, index) => (
              <li key={item}>
                <span>0{index + 1}</span>
                {item}
              </li>
            ))}
          </ol>
        </article>
      </section>

      <section
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
      </section>

      <section className="cta section-wide" aria-labelledby="cta-title">
        <p className="section-index">10 / CONTINUE READING</p>
        <h2 id="cta-title">Still here?</h2>
        <p>Good. Now it becomes considerably less philosophical.</p>
        <div className="cta-actions">
          <ExternalLink href={routes.architecture}>
            Read the architecture <span aria-hidden="true">→</span>
          </ExternalLink>
          <ExternalLink href={docs}>View the documentation</ExternalLink>
          <ExternalLink href={repository}>Browse the repository</ExternalLink>
        </div>
      </section>

      <footer>
        <p>Started because someone asked an LLM the wrong question.</p>
        <p>Built because nobody stopped asking better ones.</p>
        <strong>Well... why not?</strong>
        <small>
          No inventory systems were harmed during the making of this engine.
          Probably.
        </small>
      </footer>
    </main>
  );
}

export default App;
