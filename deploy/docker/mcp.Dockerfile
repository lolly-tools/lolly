# syntax=docker/dockerfile:1
# ============================================================================
# Lolly MCP server - the one hosted service (opt-in).
# ============================================================================
# Streamable-HTTP MCP transport + OAuth discovery. Runs `node services/mcp/src/http.ts`
# (Node 24 executes TypeScript natively - no compile step). Listens on $PORT
# (default 8790), serving JSON-RPC at POST /mcp plus the .well-known OAuth routes
# and a public GET render path (/tool/<id>.<ext>). Stateless (SSE/session mgmt is
# roadmap), so it scales horizontally.
#
# BUILD CONTEXT MUST BE THE REPO ROOT - the server imports its sibling workspace
# (@lolly/engine at ../../../engine) and, at runtime, loads tools from the
# repo-root tools/ + catalog/ profile views:
#
#   docker build -f deploy/docker/mcp.Dockerfile -t <registry>/lolly-mcp:0.1.0 .
#
# The tools/ + catalog/ content is baked at build time from LOLLY_PROFILE (as with
# the web image), so the running container needs no pack mount. The default is the
# neutral lolly-start brand, so a public image ships NO private (SUSE) tools or
# assets; pass --build-arg LOLLY_PROFILE=suse for the SUSE-branded image (that
# needs the private brands/suse submodule checked out). Requires the content
# submodules (community/, brands/*) checked out in the build context.
#
# Tier-B (browser/Chromium) render formats are DISABLED unless LOLLY_WEB_BASE is
# set at runtime; svg/data + resvg-png work without a browser. We deliberately do
# NOT install Chromium here. LOLLY_WEB_BASE alone does not supply a browser;
# browser formats need a separately reviewed browser-enabled MCP deployment.
# Keep Tier B disabled for this image's initial hosted scope.
# ============================================================================

FROM node:26-alpine@sha256:ef24c5053d50fdc3e4e56eb4e7ddb7861874ab0fdc797046ba897581deb8e868 AS build
WORKDIR /src
RUN apk add --no-cache libcrypto3=3.5.8-r0 libssl3=3.5.8-r0
# Neutral by default; a public image must not ship the private SUSE pack.
ARG LOLLY_PROFILE=lolly-start
ENV LOLLY_PROFILE=${LOLLY_PROFILE}
ENV NODE_ENV=production

# Keep model weights and web/docs outputs out of the build context snapshot.
# Runtime workspace manifests are still present for the frozen-lockfile install.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml profiles.json ./
COPY engine ./engine
COPY schemas ./schemas
COPY packages ./packages
COPY shells/cli ./shells/cli
COPY shells/web/package.json ./shells/web/package.json
COPY shells/web/build/materialize-directory.ts ./shells/web/build/materialize-directory.ts
COPY shells/web/public/fonts ./shells/web/public/fonts
COPY shells/tui/package.json ./shells/tui/package.json
COPY services/ca/package.json ./services/ca/package.json
COPY services/mcp ./services/mcp
COPY scripts ./scripts
COPY community ./community
COPY brands ./brands

# Runtime deps only (omit dev). The server reads content from the packs through
# the resolver, with LOLLY_PROFILE above picking the brand - there is no view to
# materialise. PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD keeps the optional playwright-core
# from fetching a browser we don't ship.
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN npm install --global pnpm@11.26.0
RUN pnpm install --frozen-lockfile --prod
# Hosted MCP deliberately omits model APIs. These native inference packages and
# their archive installer are not needed by its supported headless render paths.
RUN rm -rf node_modules/onnxruntime-node node_modules/@huggingface/transformers \
    node_modules/phonemizer node_modules/adm-zip

# Profile views may contain absolute build-directory symlinks. Materialise the
# selected content before moving it to /app, using the same verified copy helper
# as the web build. The runtime needs no source brand pack or web model cache.
RUN node --input-type=module -e "import { materializeDirectory } from './shells/web/build/materialize-directory.ts'; for (const dir of ['tools', 'catalog']) materializeDirectory(dir, '/runtime-content/' + dir);"
# Retain each runtime package's workspace links as well as its source. Remove
# the service's deployment recipes and tests before copying the package.
RUN rm -rf services/mcp/deploy services/mcp/test

# ── runtime stage ───────────────────────────────────────────────────────────
FROM node:26-alpine@sha256:ef24c5053d50fdc3e4e56eb4e7ddb7861874ab0fdc797046ba897581deb8e868 AS runtime
WORKDIR /app
RUN apk add --no-cache libcrypto3=3.5.8-r0 libssl3=3.5.8-r0
ENV NODE_ENV=production
# Default transport port; the chart sets PORT explicitly too.
ENV PORT=8790

# Preserve the source layout and workspace links used by the headless host,
# without shipping the entire web app, model weights or unrelated brand sources.
COPY --from=build /src/node_modules ./node_modules
COPY --from=build /src/engine ./engine
COPY --from=build /src/schemas ./schemas
COPY --from=build /src/packages/core ./packages/core
COPY --from=build /src/packages/node-shell ./packages/node-shell
COPY --from=build /src/shells/cli ./shells/cli
COPY --from=build /src/services/mcp ./services/mcp
COPY --from=build /src/shells/web/public/fonts ./shells/web/public/fonts
COPY --from=build /runtime-content/tools ./tools
COPY --from=build /runtime-content/catalog ./catalog
COPY LICENSE THIRD-PARTY-NOTICES.md ./
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

# The Node base ships a non-root `node` user (uid 1000).
USER node
EXPOSE 8790
# Match the chart's TCP liveness probe; this is not an OAuth/readiness test.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD ["node", "-e", "const s=require('node:net').connect(Number(process.env.PORT||8790),'127.0.0.1');s.setTimeout(3000);s.on('connect',()=>{s.destroy();process.exit(0)});s.on('error',()=>process.exit(1));s.on('timeout',()=>{s.destroy();process.exit(1)})"]

# `pnpm run mcp:http` → node services/mcp/src/http.ts (startHttpServer()).
CMD ["node", "services/mcp/src/http.ts"]
