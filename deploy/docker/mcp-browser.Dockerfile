# syntax=docker/dockerfile:1
# Optional public browser image. Build from the repository root with the same
# neutral profile as mcp.Dockerfile. The original image remains browser-free.
# Chromium is installed explicitly from the lockfile's playwright-core version;
# its OS dependencies are present in the final Debian runtime as well.
# Supply LOLLY_WEB_BASE at runtime and qualify Chromium's sandbox on the target.
# No anonymous access or sandbox bypass is enabled by this image.

FROM node:26-bookworm-slim@sha256:662933cf47f013bc8e4beb31a6116448427a82057ba7c42c97e4c5ba766504c2 AS build
WORKDIR /src
RUN apt-get update && apt-get install --no-install-recommends -y ca-certificates \
    && rm -rf /var/lib/apt/lists/*
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
COPY shells/web/public/fonts ./shells/web/public/fonts
COPY shells/tui/package.json ./shells/tui/package.json
COPY services/ca/package.json ./services/ca/package.json
COPY services/mcp ./services/mcp
COPY scripts ./scripts
COPY community ./community
COPY brands ./brands

# Runtime deps only (omit dev). The server reads content from the packs through
# the resolver, with LOLLY_PROFILE above picking the brand - there is no view to
# materialise. Dependency installation does not acquire Chromium; the explicit
# lockfile-scoped browser step below owns that download.
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV ONNXRUNTIME_NODE_INSTALL_CUDA=skip
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/lolly-browsers
RUN npm install --global pnpm@11.26.0
RUN pnpm install --frozen-lockfile --prod
# Hosted MCP deliberately omits model APIs. These native inference packages and
# their archive installer are not needed by its supported headless render paths.
RUN rm -rf node_modules/onnxruntime-node node_modules/@huggingface/transformers \
    node_modules/phonemizer node_modules/adm-zip

# Materialise the selected profile through the same resolver as the web build.
# The runtime needs no source brand pack or web model cache.
RUN node --input-type=module -e "import { materializeInto } from './packages/node-shell/src/content-roots.ts'; materializeInto('/runtime-content');"
# Explicit browser acquisition also verifies the downloaded executable.
RUN env -u PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD node services/mcp/scripts/install-browser.ts --force \
    && node --input-type=module -e "import { createRequire } from 'node:module'; import { existsSync } from 'node:fs'; const { chromium } = createRequire('/src/services/mcp/scripts/install-browser.ts')('playwright-core'); if (!existsSync(chromium.executablePath())) throw new Error('Chromium executable is missing');"
# Retain each runtime package's workspace links as well as its source. Remove
# the service's deployment recipes and tests before copying the package.
RUN rm -rf services/mcp/deploy services/mcp/test

# ── runtime stage ───────────────────────────────────────────────────────────
FROM node:26-bookworm-slim@sha256:662933cf47f013bc8e4beb31a6116448427a82057ba7c42c97e4c5ba766504c2 AS runtime
WORKDIR /app
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/lolly-browsers
ENV NODE_ENV=production
# Default transport port; the chart sets PORT explicitly too.
ENV PORT=8790
ENV LOLLY_MCP_BIND_HOST=0.0.0.0

# Preserve the source layout and workspace links used by the headless host,
# without shipping the entire web app, model weights or unrelated brand sources.
COPY --from=build /opt/lolly-browsers /opt/lolly-browsers
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
# Install the exact browser's runtime OS dependencies without another download.
RUN PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 node services/mcp/scripts/install-browser.ts --with-deps \
    && rm -rf /var/lib/apt/lists/* /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

# The Node base ships a non-root `node` user (uid 1000).
USER node
EXPOSE 8790
# TCP health is liveness; actual sandbox, export and authentication need acceptance.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD ["node", "-e", "const s=require('node:net').connect(Number(process.env.PORT||8790),'127.0.0.1');s.setTimeout(3000);s.on('connect',()=>{s.destroy();process.exit(0)});s.on('error',()=>process.exit(1));s.on('timeout',()=>{s.destroy();process.exit(1)})"]

# `pnpm run mcp:http` → node services/mcp/src/http.ts (startHttpServer()).
CMD ["node", "services/mcp/src/http.ts"]
