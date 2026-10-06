# Public Penpot on an UpCloud or Evroc VM

This increment supplies the missing standalone Penpot transport. Use the same
application contract on either provider: a prepared Linux VM with Docker Compose,
host Caddy, loopback service ports and qualified immutable image digests. The
existing `web.Dockerfile`, `ca.Dockerfile` and `mcp.Dockerfile` remain the web, CA
and MCP images. Public web and MCP releases must select the neutral `lolly-start`
profile and pass their signed catalog checks. No private Work database, session,
provider keys or brand packs belong in these public services.

This recipe adds Penpot to that deployment; a complete public route cutover still
needs the qualification below. It does not provision a VM, change DNS or replace
an existing Vercel release. The cloud foundation and provider prerequisites live
in Lolly Work's `docs/cloud-deployment.md`.

## Build and stage

Build from a clean reviewed source on the release runner, scan the image and
record the exact commit and resulting digest:

```sh
docker build -f deploy/docker/penpot.Dockerfile -t <registry>/lolly-penpot:<release> .
```

The image contains only the dependency-free Penpot handler and listener. It runs
as an unprivileged user. No catalog, CA key, Work environment or persistent volume
is required. Set `LOLLY_PENPOT_IMAGE` to the qualified `<registry>/lolly-penpot@sha256:<digest>`
in the deployment's private configuration, and validate before starting:

```sh
docker compose -f deploy/docker/penpot.compose.yml config --quiet
docker compose -f deploy/docker/penpot.compose.yml pull
docker compose -f deploy/docker/penpot.compose.yml up -d
curl --fail http://127.0.0.1:8791/healthz
```

Import `penpot.caddy` inside the candidate public hostname's Caddy site block.
Use `handle`, which preserves `/api/penpot/rpc/<command>`; stripping the prefix
would break the exact listener routes. Validate the complete Caddyfile before
reloading. The mount leaves the explicit Authorization value unchanged, removes
ambient Cookie and Proxy-Authorization headers and discards Set-Cookie. Configure
any access logging to omit authorization and cookie values. CA configuration and
private keys remain only in the CA service's approved secret store.

Only `get-all-projects` and `import-binfile` POST requests reach the fixed
`https://design.penpot.app/api/rpc/command/` upstream. OPTIONS is answered locally.
The raw multipart body is capped at 32 MiB in both Caddy and the handler. The
listener bounds request/header reads to 30 seconds, inactive responses to 120
seconds and total responses to five minutes. The upstream connection/header
phase retains its 25-second limit. SSE progress flows immediately; no body parse
or response buffering is introduced. The standalone listener admits one proxied
POST at a time, returning 503 with `Retry-After: 2` when busy; health, preflight and
refused commands remain available. The slot releases once on response finish or
disconnect. A disconnect aborts the upstream header request or body stream, so
abandoned imports cannot keep fetching after their slot is released. Up to
32 MiB of chunks and the combined 32 MiB Buffer may coexist;
fetch receives a view over that Buffer rather than another payload copy. The
256 MiB container cap needs measured staging evidence at the body ceiling.
These are single-container resource bounds,
not a distributed admission control or an assurance that every import completes.
Keep CA and MCP's approved durable rate limiter; this recipe changes no limiter
policy or anonymous render/agent permissions.

## Candidate qualification and remaining public routes

Run `node --test tests/penpot-fn.test.ts tests/penpot-http.test.ts`, then all normal
repository gates. On a disposable staging VM validate the actual Compose/Caddy
configuration, image health, restart behavior and memory bound. At the candidate
HTTPS origin check project listing with a dedicated test PAT, a streamed import
into a disposable project, token-free logs, denied commands, refused over-limit
bodies, CORS preflight and upstream failures. Do not use a production document or
print the PAT. Health is listener liveness, not successful Penpot authentication.

Before moving the complete public host, compare the real `vercel.json` route and
header table with the candidate's complete Caddy/static configuration:

| Public surface | Required candidate evidence |
| --- | --- |
| Signed static shell, catalog and tools | Exact signature, tool bytes, view aliases, CSP, cache and HEAD/Range parity |
| `/models/*` | Existing `lolli.li` proxy behavior, immutable bytes, CORS, Range, HEAD and cache parity |
| `/.well-known/lolly.json` and other static discovery | Exact generated document and redirects |
| `/api/ca/*` | Health, public root, OIDC callbacks, enrollment, origins and independent issuance evidence |
| `/api/mcp`, subpaths, `/tool/*` and OAuth discovery | Existing gateway methods, canonical origin, anonymous/private policy and durable limiter |
| `/api/fetch-image` | Existing DNS/IP/redirect SSRF refusal, content/byte budget, CORS and caller admission |
| `/api/penpot/rpc/*` | Exact methods and two-command scope, opaque PAT, byte cap and streamed import progress |
| `/live` and WebSockets | Existing relay path, upgrade handling, grants, presence, reconnection and affinity |

Preserve these routes and their query strings without inventing rewrites or
forwarding Work cookies into the public gateway. Browser rendering remains a
separately qualified worker. Run the unchanged browser and mobile performance
gates against the exact signed candidate. Keep the existing Vercel deployment and
previous image digest as rollback choices until the full route matrix, live
collaboration and operator-controlled rollback have passed. Public DNS and the
Vercel retirement require a separate cutover decision and soak evidence.

Reference behavior: [Caddy request body limit](https://caddyserver.com/docs/caddyfile/directives/request_body),
[Caddy reverse proxy and streaming](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy),
[Compose service settings](https://docs.docker.com/reference/compose-file/services/).
