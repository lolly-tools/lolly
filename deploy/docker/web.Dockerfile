# syntax=docker/dockerfile:1
# ============================================================================
# Lolly Web PWA - the primary self-hosted product.
# ============================================================================
# Multi-stage: a Node build stage runs `pnpm run build:web:release` and a tiny
# nginx-unprivileged stage serves the resulting static `shells/web/dist`.
#
# BUILD CONTEXT MUST BE THE REPO ROOT (not deploy/docker):
#
#   docker buildx build --load --no-cache-filter build \
#     -f deploy/docker/web.Dockerfile \
#     --secret id=LOLLY_CATALOG_SIGNING_KEY,env=LOLLY_CATALOG_SIGNING_KEY \
#     --secret id=VITE_CATALOG_PUBLIC_KEY_JWK,env=VITE_CATALOG_PUBLIC_KEY_JWK \
#     -t <registry>/lolly-web:0.1.0 .
#
# Supply the signing key (PKCS8 PEM or private JWK) and matching PUBLIC P-256
# JWK through the build environment or --secret id=...,src=/secure/path.
# BuildKit exposes them only to the release step, never as image ARG/ENV or a
# copied key file. The public pin is intentionally embedded in the client.
# --no-cache-filter build re-runs signing even when only key material changes;
# BuildKit secret values do not invalidate cached build steps. See README.md.
#
# The build bakes ONE brand/profile into the static output (theme-color, PWA
# chrome, and the tools/ + catalog/ content written into dist are resolved at
# build time by the content resolver plus the vite brandChrome plugin - see
# shells/web/vite.config.js).
# Choose it with --build-arg LOLLY_PROFILE=lolly-start|suse. The default is the
# neutral lolly-start brand, so a public image ships NO private (SUSE) tools or
# assets; pass --build-arg LOLLY_PROFILE=suse to build the SUSE-branded image
# (that needs the private brands/suse submodule checked out in the context). The
# resulting image is fully self-contained - nothing is read at serve time, so the
# Helm chart needs NO runtime pack/brand mount for the web app.
#
# REQUIREMENT: the content packs (community/, brands/*) must be present in the
# build context - `pnpm run build:web:release` writes a real tools/ + catalog/
# tree into dist from the resolved profile. community/ and brands/lolly-start/ are
# in this repository; brands/suse is the one remaining submodule and has to be
# checked out for LOLLY_PROFILE=suse.
# ============================================================================

# ── build stage ─────────────────────────────────────────────────────────────
FROM node:26-bookworm@sha256:e7bc1a4cd2419953c91f9a6f7bb6efb3737773093fb4ded0b1c77a0a5831fac4 AS build
WORKDIR /src

# Which brand/profile to bake into the static build (see header). Neutral by
# default; a public image must not ship the private SUSE pack.
ARG LOLLY_PROFILE=lolly-start
ARG VITE_REQUIRE_AI_POLICY=false
ENV VITE_REQUIRE_AI_POLICY=${VITE_REQUIRE_AI_POLICY}
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
# There is no root postinstall to run: content is read from the packs where it
# lives, and LOLLY_PROFILE above picks which. pnpm-workspace.yaml's allowBuilds
# list approves the native build scripts (esbuild, onnxruntime-node, fsevents).
RUN npm install --global pnpm@11.26.0
RUN pnpm install --frozen-lockfile --prod=false

# Sign the active catalog, validate the public pin, and build verified-only
# shells/web/dist. Missing keys fail the build; there is no unsigned fallback.
# Secret env mounts require Dockerfile frontend >= 1.10 (syntax=1 above).
RUN --mount=type=secret,id=LOLLY_CATALOG_SIGNING_KEY,env=LOLLY_CATALOG_SIGNING_KEY,required=true \
    --mount=type=secret,id=VITE_CATALOG_PUBLIC_KEY_JWK,env=VITE_CATALOG_PUBLIC_KEY_JWK,required=true \
    pnpm run build:web:release

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
USER 101
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:8080/healthz || exit 1
# The base image's entrypoint launches nginx in the foreground.
