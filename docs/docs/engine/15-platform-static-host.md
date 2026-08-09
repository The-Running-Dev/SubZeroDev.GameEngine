---
sidebar_label: Platform Static Host
---

<!-- Generated from design/10-design.md by build/ConvertTo-HumanDocumentation.ps1. Do not edit directly. -->

# Platform Static Host — Container Delivery without a Hosted Engine

**Document status:** Revision 1 — agreed W62 build target

**Reading order:** after [`14-game-interface.md`](14-game-interface.md). That document owns
the presentation layer over the browser client; this one owns an additional container delivery
surround for the same combined static artifact.

> **Scope of this document**
>
> Package the completed public site, roadmap, playable demo, and documentation behind a
> product-owned ASP.NET Core host composed with `SubZeroDev.Platform.Hosting`. Build and smoke
> the image in pull requests, publish a new immutable GHCR image from `main` when its inputs
> change, and leave it undeployed. GitHub Pages remains the public host.

---

## 1. Outcome and Boundary

W62 proves that SubZeroDev.Platform can host this product without pretending the browser demo
has become a hosted game engine:

> The same verified static artifact served by GitHub Pages is baked into a container, served
> through Platform's supported web-host composition, health-checked in CI, and published as an
> immutable image. Opening `/play/` still downloads the application and runs the engine in the
> browser with no engine API or runtime content request.

The host is a **delivery surround**, not another client and not a game service. It must not
receive actions, own sessions, calculate results, persist saves, or expose the engine package
over HTTP. W61's browser-client boundary and byte-level engine evidence remain unchanged.

## 2. Ownership and Dependency Direction

The composition root belongs in this repository because it is product policy: which routes to
serve, which artifact to embed, and which Platform capabilities to enable. Platform remains a
reusable hosting framework and must not reference GameEngine.

```mermaid
flowchart LR
    Browser["Browser"] --> Host["GameEngine ASP.NET static host"]
    Host --> Files["Verified combined static artifact"]
    Browser --> Local["Engine + Bureaucracy session in browser"]
    Host -. "composed with" .-> Platform["SubZeroDev.Platform.Hosting"]
    Host -. "never calls" .-> Node["Node engine workload (later slice)"]
```

The product host lives under `src/host/`. It calls `AddPlatformWebHost()` and maps Platform's
probe endpoints, but does not add the Platform worker host, persistence, migrations, outbox, or
account facilities. The dependency direction is always:

> GameEngine host → released Platform package; Platform → no GameEngine dependency.

## 3. Platform Package Gate

Implementation may begin against a temporary sibling project reference to
`../SubZeroDev.Platform/src/SubZeroDev.Platform.Hosting/SubZeroDev.Platform.Hosting.csproj`.
That is a local-development scaffold only. It must not be the merged or published dependency:

- W62 cannot merge until Platform's S9 package publication is complete;
- the final project pins one exact `SubZeroDev.Platform.Hosting` NuGet version, with no floating
  range and no sibling checkout required by CI;
- a clean clone restores the package from GitHub Packages using the workflow's short-lived
  credential;
- no registry token is committed, copied into an image, passed as a Docker build argument, or
  retained in a build layer. Container restore uses a secret mount or an equivalently
  non-persistent mechanism.

This gate makes the first real Platform consumer evidence about the package that will ship,
not evidence about source-tree adjacency.

## 4. Artifact Assembly and Routes

One multi-stage image build owns the production assembly from a single GameEngine commit:

1. install pinned JavaScript dependencies and build the standalone site;
2. build the Docusaurus documentation through the repository's supported template path;
3. run the protected merge and prove the documentation subtree byte-identical before and
   after the overlay;
4. publish the ASP.NET product host;
5. copy only the verified combined artifact into the runtime image's `wwwroot`.

The container serves real files at `/`, `/roadmap/`, `/play/`, and `/docs/`. There is no SPA
fallback: an unknown route returns `404`, and a direct request to every supported route works
without first requesting `/`. Static bytes are not rewritten by the host.

Platform's liveness and readiness endpoints are also mapped. They are operational endpoints,
not part of the static artifact and not routed through a catch-all. Successful startup means
the baked artifact and required configuration were already validated; the host must fail the
build or startup rather than serve a partial site.

## 5. Runtime Contract

- The runtime image contains the published host and combined static artifact, not Node.js,
  npm caches, source trees, registry credentials, or build tooling.
- It runs as a non-root user, supports a read-only root filesystem, writes no product data, and
  listens on the ASP.NET port supplied by its environment.
- Normal static serving performs no outbound network request. Once the page and assets load,
  losing the network cannot change a game outcome.
- `SIGTERM` follows Platform's graceful-shutdown behavior. Liveness and readiness remain
  suitable for a future container orchestrator even though W62 does not deploy one.
- Logs and error envelopes inherit Platform's correlation and redaction boundary. Static-route
  failures must not add request bodies, cookies, tokens, or player data to logs.

The image is intentionally stateless. Restarting the container loses nothing because the only
game session is W61's in-browser memory, and refreshing the page already starts a new demo.

## 6. CI, Publication, and Deployment Boundary

Pull requests build the image, start it, and smoke-test:

- `200` responses for `/`, `/roadmap/`, `/play/`, `/docs/`, liveness, and readiness;
- `404` for a named unknown route, proving there is no fallback;
- the expected route metadata and protected documentation-subtree digest;
- an orderly container stop; and
- a browser production smoke showing `/play/` makes no engine API request, and no request at
  all outside the same-origin `campaigns/` files it is served from
  ([`13-playable-web-demo.md`](13-playable-web-demo.md) §6).

The workflow must contain a negative fixture or test mode that deliberately omits or corrupts a
required artifact and proves the build or startup goes red. A smoke test that has never been
seen fail is not evidence of the boundary.

After merge, a path-filtered workflow publishes to GHCR only when the host, site, documentation
build, protected merge, container definition, or their locked dependencies change. Each
publication receives an immutable full-commit tag and digest; W62 creates no `latest` tag and
no deployment. Unrelated engine-only changes do not republish identical hosting inputs unless
they alter the browser bundle included by the site build.

GitHub Pages and its exact-merge deployment workflow remain active and authoritative for the
public URL. Publishing the image is an artifact event, not a production cutover. DNS, TLS,
runtime environment, rollback policy, and digest-pinned deployment require a later slice.

## 7. Failure Behaviour

- A missing site route, missing docs artifact, failed protected merge, stale generated page,
  or unavailable exact Platform package fails CI before an image is published.
- A malformed runtime configuration or missing baked artifact prevents readiness and exits
  rather than serving whichever files happen to exist.
- Unknown routes return `404`; they never return the landing page with `200`.
- A Platform operational concern may affect health or request delivery but cannot change an
  engine state, replay input, save envelope, or rendered action result.
- A GHCR publication failure leaves the existing GitHub Pages site and previously published
  immutable images unchanged.

## 8. Explicit Non-Goals

- Public deployment, DNS, TLS, a custom domain, traffic cutover, or removal of GitHub Pages.
- A Node.js engine process, JSON/HTTP engine API, MCP transport, remote session, or server-side
  action execution. Those form a later hosted-engine-edge slice's `.NET Platform edge → Node
  engine workload` boundary.
- Durable sessions, browser persistence, accounts, authentication, profiles, cloud sync,
  databases, migrations, outbox processing, or a worker process.
- A generic static-site feature added to Platform. This is a product-owned consumer of the
  existing Platform web-host contract.
- Changes to campaign content, gameplay, browser UI, engine serialization, or W61's client
  contract.

## 9. Decision Summary

| Decision | Choice |
|---|---|
| First Platform use | Static product host; hosted engine follows separately |
| Composition owner | GameEngine repository under `src/host/` |
| Platform capability | Web host and probes only |
| Engine execution | Still local in the browser |
| Artifact | Same protected combined site/docs output built from one commit |
| Development dependency | Temporary sibling project reference permitted |
| Merge dependency | Exact released NuGet package required after Platform S9 |
| PR behavior | Build, run, positive/negative smoke; no publish |
| Main behavior | Path-filtered immutable GHCR publish when hosting inputs change |
| Public hosting | GitHub Pages remains authoritative; image is undeployed |
