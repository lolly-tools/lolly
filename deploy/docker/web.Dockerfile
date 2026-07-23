# syntax=docker/dockerfile:1
# ============================================================================
# Lolly Web PWA — the primary self-hosted product.
# ============================================================================
# Multi-stage: a Node build stage runs the real `npm run build:web` and a tiny
# nginx-unprivileged stage serves the resulting static `shells/web/dist`.
#
# BUILD CONTEXT MUST BE THE REPO ROOT (not deploy/docker):
#
#   docker build -f deploy/docker/web.Dockerfile -t <registry>/lolly-web:0.1.0 .
#
# The build bakes ONE brand/profile into the static output (theme-color, PWA
# chrome, and the copied tools/ + catalog/ content are resolved at build time by
# scripts/use-profile.ts + the vite brandChrome plugin — see shells/web/vite.config.js).
# Choose it with --build-arg LOLLY_PROFILE=suse|lolly-start (default: suse). The
# resulting image is fully self-contained — nothing is read at serve time, so the
# Helm chart needs NO runtime pack/brand mount for the web app.
#
# REQUIREMENT: the repo's content submodules (community/, brands/*) must be
# checked out in the build context — `npm run build:web` dereferences the
# tools/ + catalog/ profile views into dist. A bare checkout without submodules
# will build a shell with an empty catalog.
# ============================================================================

# ── build stage ─────────────────────────────────────────────────────────────
FROM node:24-bookworm AS build
WORKDIR /src

# Which brand/profile to bake into the static build (see header).
ARG LOLLY_PROFILE=suse
ENV LOLLY_PROFILE=${LOLLY_PROFILE}
ENV NODE_ENV=production
# Native optional deps (sharp/onnxruntime/resvg/playwright) need dev tooling
# absent from the slim variant; bookworm carries what node-gyp/prebuilt need.

# Copy the whole monorepo — build:web spans root scripts, engine, docs, the
# web shell, and the profile content packs. A narrower copy breaks the workspace
# graph, so we copy everything (respecting .dockerignore).
COPY . .

# Full install (build:web needs devDeps: vite, esbuild, sharp, onnxruntime-node,
# svgo, resvg). `postinstall` runs scripts/use-profile.ts --auto to materialise
# the tools/ + catalog/ views for LOLLY_PROFILE. Use --no-audit --no-fund for a
# quiet, reproducible install.
RUN npm ci --no-audit --no-fund

# Produce shells/web/dist (build:ort → build:info → OG images → vite build).
RUN npm run build:web

# ── runtime stage ───────────────────────────────────────────────────────────
# nginx-unprivileged runs as uid 101 (non-root) and listens on 8080 by default.
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime

# Our server config replaces the stock default.conf.
COPY deploy/docker/nginx.conf /etc/nginx/conf.d/default.conf

# Static site. nginx-unprivileged serves from /usr/share/nginx/html.
COPY --from=build /src/shells/web/dist /usr/share/nginx/html

# nginx-unprivileged already sets USER 101 and a RuntimeDefault-friendly layout.
EXPOSE 8080
# The base image's entrypoint launches nginx in the foreground.
