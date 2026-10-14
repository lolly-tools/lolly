# syntax=docker/dockerfile:1
# ============================================================================
# Lolly CA - OIDC-verified short-lived X.509 leaf issuance for C2PA signing.
# ============================================================================
# Runs `node services/ca/server.mjs`. Listens on $PORT (default 8787), serving
# under /api/ca (GET /api/ca/health, GET /api/ca/root.pem, the OAuth auth/callback
# routes and device enrollment/revocation). Managed issuance delegates to Vault;
# shared admission stores short-lived keyed token identifiers and digests.
#
# BUILD CONTEXT MUST BE THE REPO ROOT - the handler imports engine/src/x509.ts
# by relative path (../../../engine/src/x509.ts):
#
#   docker build -f deploy/docker/ca.Dockerfile -t <registry>/lolly-ca:0.1.0 .
#
# REQUIRED runtime env (see services/ca/.env.example): CA_SERVICE_SECRET,
# CA_ISSUER_MODE, CA_ALLOWED_ORIGINS and either managed issuer configuration or
# legacy CA_ROOT_KEY_PEM + CA_ROOT_CERT_PEM, plus at least one OIDC
# provider pair (GITHUB_*, GOOGLE_*, SUSE_*). Generate the root once with
# `node services/ca/scripts/gen-root.mjs`. Without the root + secret, /enroll and
# auth fail. With neither configured, all routes (including health) return 404;
# do not deploy this optional service without its approved configuration.
# The Helm chart wires these from a Secret. Health is liveness, not OIDC readiness.
# ============================================================================

FROM node:26-alpine@sha256:143494b1da2945f061539253adc65e4f1569ddf07da2d384c022c791a9d90a4a AS dependencies
WORKDIR /src
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY engine/package.json ./engine/package.json
COPY packages/core/package.json ./packages/core/package.json
COPY packages/node-shell/package.json ./packages/node-shell/package.json
COPY packages/docs-render/package.json ./packages/docs-render/package.json
COPY packages/audio-dock/package.json ./packages/audio-dock/package.json
COPY packages/rondo/package.json ./packages/rondo/package.json
COPY shells/web/package.json ./shells/web/package.json
COPY shells/cli/package.json ./shells/cli/package.json
COPY shells/tui/package.json ./shells/tui/package.json
COPY services/ca/package.json ./services/ca/package.json
COPY services/mcp/package.json ./services/mcp/package.json
RUN npm install --global pnpm@11.26.0
RUN pnpm --filter @lolly/ca-service install --prod --frozen-lockfile --ignore-scripts

FROM node:26-alpine@sha256:143494b1da2945f061539253adc65e4f1569ddf07da2d384c022c791a9d90a4a AS runtime
WORKDIR /app
RUN apk add --no-cache libcrypto3=3.5.8-r0 libssl3=3.5.8-r0
ENV NODE_ENV=production
ENV PORT=8787

# Copy only the CA verifier dependency from the frozen workspace install.
# Preserve relative engine imports without tool packs, models or package managers.
COPY --from=dependencies /src/node_modules/jose ./node_modules/jose
COPY services/ca ./services/ca
COPY services/shared ./services/shared
COPY engine/src/x509.ts engine/src/x509-read.ts engine/src/enrollment.ts engine/src/bytes.ts engine/src/der-read.ts ./engine/src/
COPY LICENSE ./LICENSE
RUN node --input-type=module -e "await import('./services/ca/lib/oidc.mjs'); await import('./services/ca/handler.mjs');"
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

USER node
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/api/ca/health',{signal:AbortSignal.timeout(3000)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]

CMD ["node", "services/ca/server.mjs"]
