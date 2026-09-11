# syntax=docker/dockerfile:1
# ============================================================================
# Lolly CA - OIDC-verified short-lived X.509 leaf issuance for C2PA signing.
# ============================================================================
# Runs `node services/ca/server.mjs`. Listens on $PORT (default 8787), serving
# under /api/ca (GET /api/ca/health, GET /api/ca/root.pem, the OAuth auth/callback
# routes, POST /api/ca/enroll). Stateless - the only state is the root key/cert
# supplied via env; issuance logs are POSTed to an optional webhook.
#
# BUILD CONTEXT MUST BE THE REPO ROOT - the handler imports engine/src/x509.ts
# by relative path (../../../engine/src/x509.ts):
#
#   docker build -f deploy/docker/ca.Dockerfile -t <registry>/lolly-ca:0.1.0 .
#
# REQUIRED runtime env (see services/ca/.env.example): CA_SERVICE_SECRET,
# CA_ROOT_KEY_PEM, CA_ROOT_CERT_PEM, CA_ALLOWED_ORIGINS, plus at least one OIDC
# provider pair (GITHUB_*, GOOGLE_*, SUSE_*). Generate the root once with
# `node services/ca/scripts/gen-root.mjs`. Without the root + secret, /enroll and
# auth fail. With neither configured, all routes (including health) return 404;
# do not deploy this optional service without its approved configuration.
# The Helm chart wires these from a Secret. Health is liveness, not OIDC readiness.
# ============================================================================

FROM node:26-alpine@sha256:ef24c5053d50fdc3e4e56eb4e7ddb7861874ab0fdc797046ba897581deb8e868 AS runtime
WORKDIR /app
RUN apk add --no-cache libcrypto3=3.5.8-r0 libssl3=3.5.8-r0
ENV NODE_ENV=production
ENV PORT=8787

# The CA has no third-party runtime dependencies. Preserve its relative engine
# imports without carrying private tool packs, web models or package managers.
COPY services/ca ./services/ca
COPY engine/src/x509.ts engine/src/bytes.ts engine/src/der-read.ts ./engine/src/
COPY LICENSE ./LICENSE
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

USER node
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/api/ca/health',{signal:AbortSignal.timeout(3000)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]

CMD ["node", "services/ca/server.mjs"]
