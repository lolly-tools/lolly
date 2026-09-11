#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Deploy the Lolly MCP server (Tier-B / Chromium) to Google Cloud Run.
#
#   1. Copy deploy.env.example to the device-private mcp-deploy.env (see README)
#   2. ./deploy.sh
#
# Idempotent: enables APIs, creates the Artifact Registry repo + the two Secret
# Manager secrets if missing, builds via Cloud Build (native amd64 - no local
# Docker), deploys, and smoke-tests. Run from anywhere; paths are resolved
# relative to this script. Non-secret Google config stays in services/mcp/deploy/.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$HERE/../../.." && pwd)"

# ── config ───────────────────────────────────────────────────────────────────
PRIVATE_DIR="${LOLLY_PRIVATE_DIR:-$REPO_ROOT/../lolly-private/lolly}"
DEPLOY_ENV="${LOLLY_MCP_DEPLOY_ENV_FILE:-$PRIVATE_DIR/mcp-deploy.env}"
if [ -e "$DEPLOY_ENV" ]; then
  [ -f "$DEPLOY_ENV" ] && [ ! -L "$DEPLOY_ENV" ] || {
    echo "refusing non-regular or symlinked MCP deployment environment" >&2
    exit 1
  }
  node - "$DEPLOY_ENV" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
for (const [kind, target] of [['directory', path.dirname(process.argv[2])], ['file', process.argv[2]]]) {
  const stat = fs.lstatSync(target);
  const expected = kind === 'directory' ? stat.isDirectory() : stat.isFile();
  if (stat.isSymbolicLink() || !expected) throw new Error(`private credential ${kind} is not regular`);
  if (typeof process.getuid === 'function' && stat.uid !== process.getuid()) {
    throw new Error(`private credential ${kind} is not owned by the current user`);
  }
  if ((stat.mode & 0o077) !== 0) throw new Error(`private credential ${kind} permits group or other access`);
}
NODE
  set -a
  . "$DEPLOY_ENV"
  set +a
fi

: "${PROJECT_ID:?set PROJECT_ID (in the private deployment environment or process environment)}"
REGION="${REGION:-us-central1}"
SERVICE="${SERVICE:-lolly-mcp}"
AR_REPO="${AR_REPO:-lolly}"
LOLLY_WEB_BASE="${LOLLY_WEB_BASE:-https://lolly.tools}"
LOLLY_BROWSER_MAX_CONCURRENCY="${LOLLY_BROWSER_MAX_CONCURRENCY:-2}"
LOLLY_BROWSER_MAX_QUEUE="${LOLLY_BROWSER_MAX_QUEUE:-8}"
LOLLY_BROWSER_QUEUE_TIMEOUT_MS="${LOLLY_BROWSER_QUEUE_TIMEOUT_MS:-30000}"
LOLLY_BROWSER_ALLOWED_ORIGINS="${LOLLY_BROWSER_ALLOWED_ORIGINS:-}"
LOLLY_MCP_RPM="${LOLLY_MCP_RPM:-120}"
LOLLY_OAUTH_RPM="${LOLLY_OAUTH_RPM:-30}"
: "${LOLLY_MCP_TOKEN:?set LOLLY_MCP_TOKEN (the bearer + OAuth passphrase)}"
: "${LOLLY_MCP_SIGNING_SECRET:?set LOLLY_MCP_SIGNING_SECRET (openssl rand -base64 32)}"
: "${LOLLY_MCP_PUBLIC_ORIGIN:?set LOLLY_MCP_PUBLIC_ORIGIN (canonical https origin, no path)}"
: "${LOLLY_RATE_LIMIT_REST_URL:?set LOLLY_RATE_LIMIT_REST_URL (Redis-compatible HTTPS REST endpoint)}"
: "${LOLLY_RATE_LIMIT_REST_TOKEN:?set LOLLY_RATE_LIMIT_REST_TOKEN (durable rate-limit store token)}"

IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${AR_REPO}/${SERVICE}:$(date +%Y%m%d-%H%M%S 2>/dev/null || echo latest)"
gcloud config set project "$PROJECT_ID" >/dev/null

echo "▶ enabling APIs…"
gcloud services enable \
  run.googleapis.com cloudbuild.googleapis.com \
  artifactregistry.googleapis.com secretmanager.googleapis.com >/dev/null

echo "▶ ensuring Artifact Registry repo '${AR_REPO}' (${REGION})…"
gcloud artifacts repositories describe "$AR_REPO" --location "$REGION" >/dev/null 2>&1 || \
  gcloud artifacts repositories create "$AR_REPO" --location "$REGION" \
    --repository-format docker --description "Lolly containers"

# ── secrets (create-or-add-version) ──────────────────────────────────────────
put_secret () {  # name value
  local name="$1" value="$2"
  gcloud secrets describe "$name" >/dev/null 2>&1 || \
    gcloud secrets create "$name" --replication-policy automatic >/dev/null
  printf '%s' "$value" | gcloud secrets versions add "$name" --data-file=- >/dev/null
  echo "  ✓ $name"
}
echo "▶ syncing secrets to Secret Manager…"
put_secret lolly-mcp-token          "$LOLLY_MCP_TOKEN"
put_secret lolly-mcp-signing-secret "$LOLLY_MCP_SIGNING_SECRET"
put_secret lolly-rate-limit-rest-token "$LOLLY_RATE_LIMIT_REST_TOKEN"

# grant the Cloud Run runtime service account read access to the secrets
PNUM="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
RUNTIME_SA="${PNUM}-compute@developer.gserviceaccount.com"
for s in lolly-mcp-token lolly-mcp-signing-secret lolly-rate-limit-rest-token; do
  gcloud secrets add-iam-policy-binding "$s" \
    --member "serviceAccount:${RUNTIME_SA}" \
    --role roles/secretmanager.secretAccessor >/dev/null 2>&1 || true
done

# ── build (Cloud Build, native amd64) ────────────────────────────────────────
echo "▶ building image via Cloud Build: $IMAGE"
gcloud builds submit "$REPO_ROOT" \
  --config "$HERE/cloudbuild.yaml" \
  --substitutions "_IMAGE=${IMAGE}"

# ── deploy ───────────────────────────────────────────────────────────────────
echo "▶ deploying to Cloud Run…"
gcloud run deploy "$SERVICE" \
  --image "$IMAGE" \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --cpu 2 --memory 2Gi \
  --timeout 600 \
  --concurrency 4 \
  --min-instances 0 --max-instances 4 \
  --set-env-vars "^@^LOLLY_WEB_BASE=${LOLLY_WEB_BASE}@LOLLY_MCP_PUBLIC_ORIGIN=${LOLLY_MCP_PUBLIC_ORIGIN}@LOLLY_RATE_LIMIT_REST_URL=${LOLLY_RATE_LIMIT_REST_URL}@LOLLY_BROWSER_ALLOWED_ORIGINS=${LOLLY_BROWSER_ALLOWED_ORIGINS}@LOLLY_BROWSER_NO_SANDBOX=1@LOLLY_BROWSER_MAX_CONCURRENCY=${LOLLY_BROWSER_MAX_CONCURRENCY}@LOLLY_BROWSER_MAX_QUEUE=${LOLLY_BROWSER_MAX_QUEUE}@LOLLY_BROWSER_QUEUE_TIMEOUT_MS=${LOLLY_BROWSER_QUEUE_TIMEOUT_MS}@LOLLY_MCP_RPM=${LOLLY_MCP_RPM}@LOLLY_OAUTH_RPM=${LOLLY_OAUTH_RPM}" \
  --set-secrets "LOLLY_MCP_TOKEN=lolly-mcp-token:latest,LOLLY_MCP_SIGNING_SECRET=lolly-mcp-signing-secret:latest,LOLLY_RATE_LIMIT_REST_TOKEN=lolly-rate-limit-rest-token:latest"

URL="$(gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)')"
echo
echo "✅ deployed: ${URL}"
echo "   MCP endpoint: ${URL}/mcp"

# ── smoke test ───────────────────────────────────────────────────────────────
echo "▶ smoke test (expect 401 no-token, then a Tier-B jpeg render)…"
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "${URL}/mcp" \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}')
echo "   no-token POST -> HTTP ${code} (expect 401)"

echo "   color-block -> jpeg (Tier B, was failing on Vercel):"
curl -s -X POST "${URL}/mcp" \
  -H "authorization: Bearer ${LOLLY_MCP_TOKEN}" -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"lolly_render","arguments":{"toolId":"color-block","inputs":{},"format":"jpeg"}}}' \
  | head -c 300
echo
echo "Done. Point clients at ${URL}/mcp (see README for the mcp.lolly.tools domain map + claude.ai)."
