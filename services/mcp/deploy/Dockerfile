# syntax=docker/dockerfile:1
# ─────────────────────────────────────────────────────────────────────────────
# Lolly MCP server - Tier-B (headless Chromium) container image for Cloud Run.
#
# The Vercel function (api/mcp) is Tier-A only (no browser). This image adds the
# full Tier-B pipeline - png/jpeg/webp for ALL tools, pdf (incl. CMYK + print
# marks), and video - by shipping Chromium (via playwright-core) + driving a web
# shell.
#
# BUILD CONTEXT = REPO ROOT (the server reads engine/ + catalog/ + tools/ at
# runtime). This file and every other Cloud Run artefact live under
# services/mcp/deploy/ so the MCP package stays self-contained for the repo split.
# Build it with services/mcp/deploy/cloudbuild.yaml (or `docker build -f`).
# ─────────────────────────────────────────────────────────────────────────────

# glibc base (Debian) is REQUIRED - @resvg/resvg-js prebuilt binaries and Chromium
# do not run on alpine/musl. Node 24 runs the repo's .ts sources natively.
FROM node:26-bookworm-slim@sha256:cd9f682fa2885cd1056e830424764158570061c59736a1da836bc3d73df095ae

ENV NODE_ENV=production \
    # Chromium lands here at build time; render.ts + install-browser.ts both point
    # PLAYWRIGHT_BROWSERS_PATH at services/mcp/.browsers - keep them in agreement.
    PLAYWRIGHT_BROWSERS_PATH=/app/services/mcp/.browsers \
    # Drive the live web shell for Tier B (no need to bundle shells/web/dist).
    # Override to a prebuilt dist via LOLLY_WEB_DIST for a fully air-gapped image.
    LOLLY_WEB_BASE=https://lolly.tools

WORKDIR /app

# 1) Manifests for every workspace (root package.json lists them all, so pnpm install --frozen-lockfile
#    needs each package.json present) + the source the server actually loads.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY engine               engine
COPY services/mcp         services/mcp
# The two workspace packages the server imports - by RELATIVE path
# (services/mcp/src/paths.ts → packages/node-shell/src/repo-root.ts, the CLI
# bridge → node-shell pptx/net/text/audio) and as @lolly-tools/core. Before
# pnpm install --frozen-lockfile, so the workspace links resolve to real packages. Deliberately NOT
# the whole packages/ dir: a workspace dir that is present but missing from
# pnpm-lock.yaml pnpm-workspace.yaml (audio-dock was) fails `pnpm install --frozen-lockfile` outright, while an absent
# dir simply doesn't activate the workspaces glob.
COPY packages/core        packages/core
COPY packages/node-shell  packages/node-shell
COPY shells/web/package.json  shells/web/package.json
COPY shells/cli/package.json  shells/cli/package.json
COPY shells/tui/package.json  shells/tui/package.json
COPY services/ca/package.json services/ca/package.json

# 2) Install prod deps only. --ignore-scripts is safe here: resvg-js resolves a
#    prebuilt optional dep (no gyp), and playwright-core deliberately does NOT
#    fetch a browser on install (we do that explicitly in step 4).
RUN npm install --global pnpm@11.1.2
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

# 3) The brand data + source the render path reads/imports at runtime.
#    - schemas/: engine/src/validate.ts imports the 3 JSON schemas at load time.
#    - shells/cli: services/mcp/src/host.ts reuses the CLI bridge (createCliBridge).
#      It no longer imports anything from shells/web - plans/202 WP1.1 moved pdf.ts
#      and svg-ir.ts into packages/node-shell, copied above. shells/web/src stays
#      only for src/webshell.ts's in-container `pnpm --filter ./shells/web run build`
#      fallback; drop it the day that fallback goes.
#    (engine/ + services/mcp/ were copied above; npm deps incl. pdf-lib are installed.)
COPY catalog       catalog
COPY tools         tools
COPY schemas       schemas
COPY shells/cli    shells/cli
COPY shells/web/src shells/web/src

# 4) Chromium for Tier B, in two explicit steps (root, at build time):
#      a) `--with-deps` installs the OS libraries (apt) Chromium needs.
#      b) a plain `--force` install pulls the browser BINARY itself - a bare
#         `install chromium --with-deps` was installing deps but skipping the
#         download, leaving no executable at runtime.
#    Then hard-verify the executable exists so a bad install fails the BUILD
#    (loud) instead of the first Tier-B render (silent "Chromium is not installed").
RUN node services/mcp/scripts/install-browser.ts --with-deps \
 && node services/mcp/scripts/install-browser.ts --force \
 && node -e "const fs=require('fs');const p=require('playwright-core').chromium.executablePath();if(!fs.existsSync(p)){console.error('CHROMIUM MISSING at '+p);process.exit(1);}console.error('CHROMIUM OK at '+p)"

# The browser and server do not need root. Cloud Run currently requires the
# explicit no-sandbox switch set by deploy.sh, so the non-root UID is the hard
# process boundary beneath Chromium rather than an accidental root fallback.
USER node

# Cloud Run injects $PORT (8080); http.ts reads process.env.PORT. The MCP server
# does its OWN bearer/OAuth auth, so Cloud Run IAM stays public
# (--allow-unauthenticated in deploy.sh) - the token is the gate.
CMD ["node", "services/mcp/src/http.ts"]
