# syntax=docker/dockerfile:1
# ============================================================================
# Lolly Web PWA - the primary self-hosted product.
# ============================================================================
# Multi-stage: a Node build stage runs the real `pnpm run build:web` and a tiny
# nginx-unprivileged stage serves the resulting static `shells/web/dist`.
#
# BUILD CONTEXT MUST BE THE REPO ROOT (not deploy/docker):
#
#   docker build -f deploy/docker/web.Dockerfile -t <registry>/lolly-web:0.1.0 .
#
# The build bakes ONE brand/profile into the static output (theme-color, PWA
# chrome, and the copied tools/ + catalog/ content are resolved at build time by
# scripts/use-profile.ts + the vite brandChrome plugin - see shells/web/vite.config.js).
# Choose it with --build-arg LOLLY_PROFILE=lolly-start|suse. The default is the
# neutral lolly-start brand, so a public image ships NO private (SUSE) tools or
# assets; pass --build-arg LOLLY_PROFILE=suse to build the SUSE-branded image
# (that needs the private brands/suse submodule checked out in the context). The
# resulting image is fully self-contained - nothing is read at serve time, so the
# Helm chart needs NO runtime pack/brand mount for the web app.
#
# REQUIREMENT: the repo's content submodules (community/, brands/*) must be
# checked out in the build context - `pnpm run build:web` dereferences the
# tools/ + catalog/ profile views into dist. A bare checkout without submodules
# will build a shell with an empty catalog.
# ============================================================================

# ── build stage ─────────────────────────────────────────────────────────────
FROM node:26-bookworm@sha256:9f94d34c787165dca03b74e5bf9c3bf90e8de79b19aa3d87fe1fa1694bf75c89 AS build
WORKDIR /src

# Which brand/profile to bake into the static build (see header). Neutral by
# default; a public image must not ship the private SUSE pack.
ARG LOLLY_PROFILE=lolly-start
ENV LOLLY_PROFILE=${LOLLY_PROFILE}
ENV NODE_ENV=production
# Native optional deps (sharp/onnxruntime/resvg/playwright) need dev tooling
# absent from the slim variant; bookworm carries what node-gyp/prebuilt need.

# Copy the whole monorepo - build:web spans root scripts, engine, docs, the
# web shell, and the profile content packs. A narrower copy breaks the workspace
# graph, so we copy everything (respecting .dockerignore).
COPY . .

# Full install (--prod=false): build:web needs devDeps (vite, esbuild, sharp,
# onnxruntime-node, svgo, resvg) that the runtime-only ca/mcp images omit.
# pnpm-workspace.yaml's enablePrePostScripts runs the root postinstall
# (scripts/use-profile.ts --auto), which materialises the tools/ + catalog/ views
# for LOLLY_PROFILE; its allowBuilds list approves the native build scripts
# (esbuild, onnxruntime-node, fsevents).
RUN npm install --global pnpm@11.1.2
RUN pnpm install --frozen-lockfile --prod=false

# Produce shells/web/dist (build:ort → build:info → OG images → vite build).
RUN pnpm run build:web

# ── runtime stage ───────────────────────────────────────────────────────────
# nginx-unprivileged runs as uid 101 (non-root) and listens on 8080 by default.
FROM nginxinc/nginx-unprivileged:1.31-alpine@sha256:2ddec616f1cb58bcac057aa388f28cb81e35137641ef4226d321714499329bd1 AS runtime

# Our server config replaces the stock default.conf.
COPY deploy/docker/nginx.conf /etc/nginx/conf.d/default.conf
# The security headers every location includes (nginx drops inherited
# add_header in any location that sets one of its own).
COPY deploy/docker/security-headers.conf /etc/nginx/security-headers.conf

# Static site. nginx-unprivileged serves from /usr/share/nginx/html.
COPY --from=build /src/shells/web/dist /usr/share/nginx/html

# nginx-unprivileged already sets USER 101 and a RuntimeDefault-friendly layout.
EXPOSE 8080
# The base image's entrypoint launches nginx in the foreground.
