# Lolly MCP server on Google Cloud Run (Tier-B / Chromium)

The Vercel function at `lolly.tools/api/mcp` is **Tier-A only** - a serverless
function can't run headless Chromium, so it renders SVG/data formats and
`resvg` PNG for SVG-native tools, but **not** jpeg/webp, HTML-layout PNG, pdf, or
video. This container is the **Tier-B** deploy: it ships Chromium + drives a web
shell, so it renders **every** format for **all** tools.

Everything here stays under `services/mcp/deploy/` - no Google config leaks into
the repo root - so it travels when `services/mcp` splits into its own repo.

| Format | Vercel (`/api/mcp`) | This container |
|---|:--:|:--:|
| svg, emf, eps, data/text | ✅ | ✅ |
| png (SVG-native tools, e.g. qr-code) | ✅ | ✅ |
| **jpeg / webp** | ❌ | ✅ |
| **png for HTML-layout tools** (color-block, quotes, …) | ❌ | ✅ |
| **pdf / pdf-cmyk / video** | ❌ | ✅ |

## What it deploys

- A Cloud Run service `lolly-mcp` running `node services/mcp/src/http.ts` (the
  same gateway as Vercel - OAuth discovery + `/mcp` JSON-RPC), with Chromium.
- Image built by **Cloud Build** (native amd64) and stored in Artifact Registry.
- `LOLLY_MCP_TOKEN`, `LOLLY_MCP_SIGNING_SECRET`, and the durable rate-limit
  store token from **Secret Manager**;
  `LOLLY_MCP_PUBLIC_ORIGIN` (the canonical HTTPS issuer/resource origin) and
  `LOLLY_WEB_BASE=https://lolly.tools` as plain env vars.
- Public Cloud Run IAM (`--allow-unauthenticated`) **on purpose** - the MCP
  server's own bearer/OAuth is the gate, exactly like the Vercel endpoint.

## Prerequisites

- `gcloud` CLI, authenticated (`gcloud auth login`), with a **project that has
  billing enabled**. (No local Docker needed - Cloud Build does the build.)
- The three secret values retrieved from the team's managed secret store, plus
  a Redis-compatible HTTPS REST endpoint for cross-instance admission control.

## Deploy

```bash
mkdir -p ../lolly-private/lolly
chmod 700 ../lolly-private ../lolly-private/lolly
cp services/mcp/deploy/deploy.env.example ../lolly-private/lolly/mcp-deploy.env
chmod 600 ../lolly-private/lolly/mcp-deploy.env
# Fill PROJECT_ID, origin, limiter + secrets, then:
services/mcp/deploy/deploy.sh
```

The paths above assume the parent `lolly` and `lolly-private` directories are siblings.
Set `LOLLY_PRIVATE_DIR` or `LOLLY_MCP_DEPLOY_ENV_FILE` to select a different private
location. The deploy script refuses a symlinked environment file. Do not copy the filled
file into this public checkout.

`deploy.sh` is idempotent - it enables the APIs, creates the Artifact Registry
repo + Secret Manager secrets, grants the runtime service account secret access,
builds, deploys, and smoke-tests (`401` unauthenticated, then a live
`color-block → jpeg` that Vercel can't do). It prints the service URL; the MCP
endpoint is `<url>/mcp`.

## Point a client at it

Same flow as Vercel, just a new host:

```bash
# Claude Code
claude mcp add --transport http lolly-full https://<cloud-run-url>/mcp \
  --header "Authorization: Bearer <LOLLY_MCP_TOKEN>"

# claude.ai / Desktop: Add custom connector → https://<cloud-run-url>/mcp
# (auto-discovers OAuth, paste the token on the consent page)
```

OAuth discovery always describes `LOLLY_MCP_PUBLIC_ORIGIN`; request `Host` and
forwarding headers are ignored. Set it to the raw `*.run.app` URL or the mapped
domain before deployment, then use that same origin in clients.

### Optional: brand it as `mcp.lolly.tools`

```bash
gcloud beta run domain-mappings create \
  --service lolly-mcp --domain mcp.lolly.tools --region us-central1
```

Add the CNAME it prints to the `lolly.tools` DNS zone. Then use
`https://mcp.lolly.tools/mcp` - discovery URLs follow the host automatically.

## Notes & tuning

- **Web shell for Tier B:** the container drives the live `LOLLY_WEB_BASE`
  (`https://lolly.tools`) to capture exports - lightest image, but depends on the
  site being up. For a fully self-contained/air-gapped image, build
  `shells/web/dist`, `COPY` it in, and set `LOLLY_WEB_DIST` instead of
  `LOLLY_WEB_BASE` (see `webshell.ts`).
- **Cost / cold starts:** defaults scale to zero (`--min-instances 0`) - cheap,
  but the first request after idle pays a cold start (image pull + Chromium
  launch, a few seconds). For snappy demos set `--min-instances 1`.
- **Resources:** `--cpu 2 --memory 2Gi`, `--concurrency 4`, `--timeout 600`.
  The process admits at most two active browser contexts and eight queued jobs by
  default; a queue wait over 30 seconds is refused. Tune
  `LOLLY_BROWSER_MAX_CONCURRENCY`, `LOLLY_BROWSER_MAX_QUEUE`, and
  `LOLLY_BROWSER_QUEUE_TIMEOUT_MS` with the container memory. Video is CPU/RAM
  heavy - bump memory (e.g. `4Gi`) and lower concurrency if you see OOM, or raise
  `--timeout` (Cloud Run allows up to 3600s).
- **Distributed admission:** production refuses to start without
  `LOLLY_RATE_LIMIT_REST_URL` and `LOLLY_RATE_LIMIT_REST_TOKEN`. The service
  sends only SHA-256-derived bucket keys to that store, never raw IPs, bearer
  credentials, or OAuth subjects. Limiter outages return 503; exceeded budgets
  return 429 with `Retry-After`. `LOLLY_MCP_RPM` and `LOLLY_OAUTH_RPM` tune the
  per-minute defaults. `LOLLY_ALLOW_IN_MEMORY_RATE_LIMIT=1` is a deliberate
  single-instance development escape hatch and must not be set here.
- **Browser egress:** Chromium may contact only the exact `LOLLY_WEB_BASE`
  origin plus any explicit origins in `LOLLY_BROWSER_ALLOWED_ORIGINS`. Each
  remote hostname is resolved before navigation and the request is aborted if
  any answer is loopback, link-local, private, metadata, reserved, or otherwise
  non-public. Keep the allowlist empty unless a reviewed instance requires an
  extra origin. This is application-layer enforcement; production projects
  should additionally route all Cloud Run traffic through a VPC/firewall or
  egress proxy which blocks cloud metadata and RFC 1918/link-local ranges. The
  deploy is not considered hardened until that infrastructure policy has been
  verified outside this repository.
- **Browser sandbox:** the image runs as the unprivileged `node` user. Cloud Run
  is deployed with the explicit `LOLLY_BROWSER_NO_SANDBOX=1` compatibility flag;
  without that flag Chromium sandboxing is the default. Keep Cloud Run's
  container isolation, no host mounts, resource limits, and ephemeral filesystem
  if the compatibility flag is used.
- **Two endpoints, one credential:** keep the Vercel endpoint for light/vector
  work and add this for full raster/pdf/video, or make this the single canonical
  endpoint. The `LOLLY_MCP_TOKEN` is shared, so either works with the same token.
- **Redeploy:** just re-run `./deploy.sh` (new timestamped image tag each time).
