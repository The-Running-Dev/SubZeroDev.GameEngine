# syntax=docker/dockerfile:1.7
#
# The platform static host image (design/15-platform-static-host.md, W62). One build,
# from one GameEngine commit, produces:
#   1. the standalone landing page (site/dist);
#   2. the Docusaurus documentation, through the repository's supported template path;
#   3. the protected merge of the two (§4 step 3 -- the package-backed `merge` command
#      site/package.json runs, the same command docs-ci.yml's verify job proves on every PR);
#   4. the ASP.NET product host, composed with the one pinned, released
#      SubZeroDev.Platform.Hosting package (§3 -- no sibling checkout, no floating range);
#   5. a runtime stage carrying only the published host and the verified combined
#      artifact -- no Node, no npm cache, no source tree, no build tooling, no
#      registry credential (§5, §6).
#
# CHANGELOG.md is not regenerated inside this build (docs-deploy.yml's own job does that
# from full git history, which this build intentionally does not clone for). The
# committed docs/docs/engine/CHANGELOG.md -- already documented as a static fallback for
# anyone reading the repository directly -- ships instead. That is the one place this
# image's docs subtree can differ from a fresh GitHub Pages deploy; every route the site
# actually serves is otherwise the same combined artifact docs-deploy.yml produces.

########################################################################################
# site -- the engine package build the landing page needs, then the landing page itself.
########################################################################################
FROM node:24-alpine AS site
WORKDIR /workspace

COPY src/engine/package.json src/engine/package-lock.json src/engine/
RUN npm --prefix src/engine ci
COPY src/engine/ src/engine/
RUN npm --prefix src/engine run build

COPY site/package.json site/package-lock.json site/
RUN npm --prefix site ci
COPY site/ site/

# The roadmap page reads this one file directly at build time
# (site/src/roadmap/roadmapData.ts imports it `?raw`), so it must exist relative to
# site/ exactly as it does in the full checkout, even though the docs/ tree otherwise
# belongs to the docs stage below.
COPY docs/docs/engine/TODO.md docs/docs/engine/TODO.md

RUN npm --prefix site run build

########################################################################################
# docs -- the Docusaurus build, through the same supported template path docs-ci.yml and
# docs-deploy.yml both use. The base image already carries /template with node_modules
# and pwsh installed; docs-build.ps1 overlays ./docs over it and runs the real build.
########################################################################################
FROM ghcr.io/the-running-dev/docs-template:latest AS docs
WORKDIR /workspace

COPY docs/ docs/
RUN pwsh /template/scripts/docs-build.ps1 -SourceDocs ./docs -OutputPath artifacts/docs

########################################################################################
# merged -- the protected merge (design/15 §4 step 3), via the same package-backed
# `merge` command site/package.json's own script runs (W69). The package proves the
# docs/ subtree is byte-for-byte the same before and after the overlay and refuses to
# proceed otherwise -- see subzerodev-platform-ui-landing-page for why that is
# sufficient: the two builds are proven to never write the same paths under docs/.
# node_modules is copied from the site stage rather than reinstalled here so the CLI
# (a site devDependency) doesn't need a second npm ci against the docs-template image.
########################################################################################
FROM docs AS merged
WORKDIR /workspace

COPY --from=site /workspace/site/package.json site/package.json
COPY --from=site /workspace/site/node_modules site/node_modules
COPY --from=site /workspace/site/dist site/dist
RUN npm --prefix site run merge

########################################################################################
# host-build -- publishes the product composition root against the one pinned,
# released SubZeroDev.Platform.Hosting package. Restore needs a short-lived GitHub
# Packages credential, supplied as build secrets and never written to an image layer or
# a build argument (§3, §5).
########################################################################################
FROM mcr.microsoft.com/dotnet/sdk:10.0-alpine AS host-build
WORKDIR /src

COPY src/host/nuget.config src/host/nuget.config
COPY src/host/SubZeroDev.GameEngine.Host/SubZeroDev.GameEngine.Host.csproj \
     src/host/SubZeroDev.GameEngine.Host/SubZeroDev.GameEngine.Host.csproj
RUN --mount=type=secret,id=nuget_github_actor \
    --mount=type=secret,id=nuget_github_token \
    export NUGET_GITHUB_ACTOR="$(cat /run/secrets/nuget_github_actor)" && \
    export NUGET_GITHUB_TOKEN="$(cat /run/secrets/nuget_github_token)" && \
    dotnet restore src/host/SubZeroDev.GameEngine.Host/SubZeroDev.GameEngine.Host.csproj

COPY src/host/SubZeroDev.GameEngine.Host/ src/host/SubZeroDev.GameEngine.Host/
RUN dotnet publish src/host/SubZeroDev.GameEngine.Host/SubZeroDev.GameEngine.Host.csproj \
    -c Release --no-restore -o /app/publish

########################################################################################
# runtime -- the delivery surround. Only the published host and the verified combined
# artifact; non-root by default (the base image's built-in "app" user); no outbound
# request on normal static serving.
########################################################################################
FROM mcr.microsoft.com/dotnet/aspnet:10.0-alpine AS runtime
WORKDIR /app

ENV ASPNETCORE_URLS=http://+:8080 \
    ASPNETCORE_ENVIRONMENT=Production \
    Platform__Telemetry__LogDirectory=/tmp/logs
EXPOSE 8080

COPY --from=host-build /app/publish .
COPY --from=merged /workspace/artifacts/docs ./wwwroot

USER app
ENTRYPOINT ["dotnet", "SubZeroDev.GameEngine.Host.dll"]
