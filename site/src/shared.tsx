import type { ReactNode } from "react";

const roadmap = "/roadmap/";
const repository = "https://github.com/The-Running-Dev/SubZeroDev.GameEngine";

export function DocsLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return <a href={href}>{children}</a>;
}

export function ExternalLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <a href={href} target="_blank" rel="noreferrer">
      {children}
      <span className="visually-hidden"> (opens in a new tab)</span>
    </a>
  );
}

export function SiteHeader({
  current,
}: {
  current?: "home" | "roadmap" | "play";
}) {
  return (
    <header className="site-header">
      <a className="wordmark" href="/" aria-label="SubZeroDev Game Engine home">
        <span>SUBZERODEV</span>
        <strong>GAME ENGINE</strong>
      </a>
      <nav aria-label="Explore the project">
        {current !== "home" && <a href="/">Home</a>}
        <a
          href={roadmap}
          aria-current={current === "roadmap" ? "page" : undefined}
        >
          Roadmap
        </a>
        <a href="/play/" aria-current={current === "play" ? "page" : undefined}>
          Play
        </a>
        <a href="/docs/">Documentation</a>
        <ExternalLink href={repository}>GitHub</ExternalLink>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer>
      <p>Started because someone asked an LLM the wrong question.</p>
      <p>Built because nobody stopped asking better ones.</p>
      <strong>Well... why not?</strong>
      <small>
        No inventory systems were harmed during the making of this engine.
        Probably.
      </small>
    </footer>
  );
}
