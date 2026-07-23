# syntax=docker/dockerfile:1
# ============================================================================
# Lolly MCP server — the one hosted service (opt-in).
# ============================================================================
# Streamable-HTTP MCP transport + OAuth discovery. Runs `node services/mcp/src/http.ts`
# (Node 24 executes TypeScript natively — no compile step). Listens on $PORT
# (default 8790), serving JSON-RPC at POST /mcp plus the .well-known OAuth routes
# and a public GET render path (/tool/<id>.<ext>). Stateless (SSE/session mgmt is
# roadmap), so it scales horizontally.
#
# BUILD CONTEXT MUST BE THE REPO ROOT — the server imports its sibling workspace
# (@lolly/engine at ../../../engine) and, at runtime, loads tools from the
# repo-root tools/ + catalog/ profile views:
#
#   docker build -f deploy/docker/mcp.Dockerfile -t <registry>/lolly-mcp:0.1.0 .
#
# The tools/ + catalog/ content is baked at build time from LOLLY_PROFILE (as with
# the web image), so the running container needs no pack mount. Requires the
# content submodules (community/, brands/*) checked out in the build context.
#
# Tier-B (browser/Chromium) render formats are DISABLED unless LOLLY_WEB_BASE is
# set at runtime; svg/data + resvg-png work without a browser. We deliberately do
# NOT install Playwright's Chromium here to keep the image slim — set env
# LOLLY_WEB_BASE=https://<your-web-host> to point at your web deployment's
# renderer instead.
# ============================================================================

FROM node:24-bookworm-slim AS build
WORKDIR /src
ARG LOLLY_PROFILE=suse
ENV LOLLY_PROFILE=${LOLLY_PROFILE}
ENV NODE_ENV=production

COPY . .

# Runtime deps only (omit dev). postinstall materialises the tools/ + catalog/
# views for LOLLY_PROFILE. PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD keeps the optional
# playwright-core from fetching a browser we don't ship.
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN npm ci --omit=dev --no-audit --no-fund

# ── runtime stage ───────────────────────────────────────────────────────────
FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Default transport port; the chart sets PORT explicitly too.
ENV PORT=8790

# Bring the installed monorepo across whole — the .ts entrypoint resolves engine
# and tool/catalog paths by relative position, so the layout must be preserved.
COPY --from=build /src /app

# node:*-slim ships a non-root `node` user (uid 1000).
USER node
EXPOSE 8790

# `npm run mcp:http` → node services/mcp/src/http.ts (startHttpServer()).
CMD ["node", "services/mcp/src/http.ts"]
