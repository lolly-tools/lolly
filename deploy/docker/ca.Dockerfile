# syntax=docker/dockerfile:1
# ============================================================================
# Lolly CA — OIDC-verified short-lived X.509 leaf issuance for C2PA signing.
# ============================================================================
# Runs `node services/ca/server.mjs`. Listens on $PORT (default 8787), serving
# under /api/ca (GET /api/ca/health, GET /api/ca/root.pem, the OAuth auth/callback
# routes, POST /api/ca/enroll). Stateless — the only state is the root key/cert
# supplied via env; issuance logs are POSTed to an optional webhook.
#
# BUILD CONTEXT MUST BE THE REPO ROOT — the handler imports engine/src/x509.ts
# by relative path (../../../engine/src/x509.ts):
#
#   docker build -f deploy/docker/ca.Dockerfile -t <registry>/lolly-ca:0.1.0 .
#
# REQUIRED runtime env (see services/ca/.env.example): CA_SERVICE_SECRET,
# CA_ROOT_KEY_PEM, CA_ROOT_CERT_PEM, CA_ALLOWED_ORIGINS, plus at least one OIDC
# provider pair (GITHUB_*, GOOGLE_*, SUSE_*). Generate the root once with
# `node services/ca/scripts/gen-root.mjs`. Without the root + secret, /enroll and
# auth fail (health still answers). The Helm chart wires these from a Secret.
# ============================================================================

FROM node:24-bookworm-slim AS build
WORKDIR /src
ENV NODE_ENV=production

COPY . .

# CA itself is zero-dependency, but it lives in the workspace and imports the
# engine sibling, so install the workspace graph (runtime deps only).
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN npm ci --omit=dev --no-audit --no-fund

# ── runtime stage ───────────────────────────────────────────────────────────
FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8787

COPY --from=build /src /app

USER node
EXPOSE 8787

CMD ["node", "services/ca/server.mjs"]
