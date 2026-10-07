# Public Lolly on an UpCloud or Evroc VM

This recipe serves the public `lolly-start` site from one HTTPS origin. It uses
four bounded containers: the signed web shell, the combined MCP gateway and live
agent relay, the certificate authority, and the Penpot adapter. Caddy runs on the
host. Model files are a verified read-only release mounted into the web container.
The same recipe works on a Linux VM from UpCloud, Evroc or another provider with
Docker Compose and Caddy. It is separate from the private Lolly Work deployment.

This configuration has route and security fixture tests. A running candidate
still needs the real signed images, public catalog checks, CA identity checks,
agent editing acceptance, resource measurements and HTTPS acceptance before DNS
moves. This document does not declare an untested candidate ready.

## Public route contract

| Route | Service and behavior |
| --- | --- |
| `/`, client routes, `/t/<id>`, `/design`, view aliases | Signed web shell and real generated pages |
| `/docs`, translated and door-based `/docs/...`, `/info/...` | Generated documentation; missing files return 404 |
| `/agents.md`, `/llms.txt`, `/llms-full.txt`, `/openapi.json`, `/.well-known/lolly.json` | Published discovery files with their proper MIME types |
| `/robots.txt`, `/sitemap.xml`, `/t/layout-studio` | Robots file and permanent redirects preserving query strings |
| `/tool/<id>.<format>` | Existing public render handler, limits and format refusals |
| `/api/mcp`, `/api/mcp/*`, OAuth discovery | Existing authenticated MCP handler and its canonical-origin metadata |
| `/api/fetch-image` | Existing SSRF-guarded image proxy, byte caps and durable admission |
| `/api/ca/*` | Existing CA handler, root identity, OAuth state cookie and approved providers |
| `/api/penpot/rpc/get-all-projects`, `/api/penpot/rpc/import-binfile` | Penpot adapter, opaque caller token and streamed progress |
| `/live/invitations`, `/live/rpc`, `/live/mcp`, `/live/editor` | One relay owner, document capabilities and websocket upgrades |
| `/models/*` | Verified local files, native GET/HEAD/Range, conditional requests and public CORS |
| Other API, relay, discovery or missing reserved asset paths | 404; no app-shell fallback |

Static cache policies match the public route contract: hashed app and `ort-hf`
files are immutable, model/runtime/font files have bounded cache lifetimes, and
catalog indexes, the service worker and manifest revalidate. C2PA files are
`application/c2pa`. Operator model metadata and dotfiles are not served.
The existing web CSP, isolation and permission headers remain. Same-origin
websocket connections are included in the public-only CSP. The optional
`/any-site` view keeps its broader frame policy.

The proxy accepts browser API requests only from the exact configured HTTPS
origin. Agent clients may omit `Origin`; that does not bypass bearer or document
capability checks. MCP, relay and Penpot receive explicit Authorization without
ambient cookies or proxy credentials. CA retains its own HttpOnly state cookie
and callback response cookies. Forwarded client addresses are overwritten at
Caddy and honored by the handlers only for the measured direct proxy IP.

## Prepare one qualified release

Use a clean source checkout and approved release runner. Build public images with
`LOLLY_PROFILE=lolly-start`. Do not initialize or mount the private SUSE pack for
this public release. Record the source commit, test receipts, image digests,
published catalog verification key and model release inventory together.

The [signed image instructions](README.md) describe BuildKit signing secrets.
The public web build also needs the relay origin compiled into the shell:

```sh
public_host=lolly.tools
docker buildx build --no-cache-filter build \
  -f deploy/docker/web.Dockerfile \
  --build-arg LOLLY_PROFILE=lolly-start \
  --build-arg "VITE_LIVE_RELAY=https://${public_host}/live" \
  --secret id=LOLLY_CATALOG_SIGNING_KEY,env=LOLLY_CATALOG_SIGNING_KEY \
  --secret id=VITE_CATALOG_PUBLIC_KEY_JWK,env=VITE_CATALOG_PUBLIC_KEY_JWK \
  -t <approved-registry>/lolly-web:<release> .
```

The relay setting defaults to empty for other deployments. Setting it on running
nginx cannot change an already compiled shell. Leave `VITE_MODELS_BASE` unset for
this recipe: model requests remain on the same origin. Prepare the model tree
using the [model-host release instructions](../models-host/README.md), with its
pathname children directly in the selected release directory. The read-only
mount covers `/usr/share/nginx/html/models`; no second model HTTP service is used.
Any model files copied into the web image are hidden by that mount.

Build the MCP, CA and Penpot images from the same qualified public source using
their Dockerfiles. These recipes use pinned base images. Promote final images
by `@sha256:<64 hex characters>`, never by a moving tag. Validate the extracted
signed catalog with `scripts/verify-release-catalog.ts` before promotion.

MCP's current image supports headless SVG/data and resvg PNG. It contains no
Chromium; browser-only export formats need a separately qualified browser-enabled
image and configuration. `LOLLY_WEB_BASE` is deliberately not enabled here.
HTTP/TCP liveness establishes none of those format or identity checks.

## Runtime configuration

Install Docker Compose 2.24 or newer and the qualified Caddy binary on the host.
Copy [public.env.example](public.env.example) into an operator-owned directory,
for example `/etc/lolly-public/public.env`, and replace every placeholder.
Keep this file and secret files out of the checkout. Lock secret file permissions
to the deployment operator. Use Compose single-quoted literal values, including
single-quoted multiline PEM values, to preserve secrets without interpolation.

Use the existing approved public MCP token/signing secret, durable HTTPS Redis
REST endpoint/token, daily budget and rate settings in `mcp.env`. Use the existing
CA root key/certificate, service secret, limiter credentials and configured OIDC
and email provider values in `ca.env`. Preserve root identity and provider callback
registrations. No Work credentials, database credentials or private asset mounts
belong in these files. Inspect the rendered configuration in a protected terminal;
`docker compose config` includes secrets and must not be pasted into logs.

The recipe overrides anonymous access, private MCP files, fake CA providers and
per-instance limiter fallback to disabled. Missing or unavailable durable
admission fails closed. The HTTPS Redis REST store and configured CA email
provider remain external dependencies during this cutover. A raw Redis TCP
container is not a compatible replacement for the existing REST protocol.
Replacing those adapters requires separate code and qualification.

Caddy talks to loopback-published container ports 8880, 8890, 8887 and 8891. These must be free on the host. The public
relay port is separate from Work's existing 8790 relay owner. Docker
may translate that connection's socket peer to a bridge address. Measure the
actual peer received by MCP and CA on the stage host and set
`LOLLY_PUBLIC_PROXY_PEER` to that exact IP literal. Verify both handlers reject
spoofed forwarded addresses from an untrusted peer. Do not guess an address,
trust arbitrary subnets or expose those ports publicly. If the Docker network
changes, repeat this measurement before reusing the allowlist.

Set `LOLLY_PUBLIC_REDIRECT_HOSTS` to the exact owned aliases being migrated.
The example lists Lolly's public aliases; a different deployment must replace
that list. DNS and certificates must be ready for every retained hostname.
The canonical origin must be a bare hostname, optionally with its HTTPS port;
do not supply a scheme, path, query or unowned aliases.

With the operator's interpolation values exported into the host service's
environment, Caddy uses [public.caddy](public.caddy). Do not shell-source an
unreviewed dotenv file. Render the Compose configuration and adapt/validate the
Caddy configuration before starting a candidate. Run Compose from the repository
root with an explicit environment file:

```sh
docker compose --env-file /etc/lolly-public/public.env \
  -f deploy/docker/public.compose.yml config --quiet
docker compose --env-file /etc/lolly-public/public.env \
  -f deploy/docker/public.compose.yml up -d
caddy adapt --config deploy/docker/public.caddy --adapter caddyfile
caddy validate --config deploy/docker/public.caddy --adapter caddyfile
```

The public nginx file is mounted read-only over the web image's default config.
The verified model directory must already exist; Compose refuses to create an
empty host directory that would hide a valid release. CA configuration is
required for this complete recipe. If CA is intentionally absent, remove that
service and its Caddy route and document the reduced deployment contract.

## Bounds and ownership

| Container | Memory cap | Node heap cap | CPU cap | Temporary filesystem | PID cap |
| --- | --- | --- | --- | --- | --- |
| Web/models | 128 MiB | n/a | 0.50 | 16 MiB | 64 |
| MCP and relay | 768 MiB | 384 MiB | 1.00 | 64 MiB | 128 |
| CA | 192 MiB | 64 MiB | 0.25 | 8 MiB | 64 |
| Penpot adapter | 256 MiB | 64 MiB | 0.50 | 8 MiB | 64 |

These are starting limits, not measured capacity or reservations. Include Caddy,
the operating system, model page cache, logs and deployment overlap when sizing
the VM. Logs rotate at three 10 MiB files per container. Containers have read-only
root filesystems, dropped capabilities and no privilege escalation. Read-only
model releases use disk, not a memory-backed volume.

One process owns MCP and all public relay invitations. Relay grants are in memory,
expire, bind one editor and carry read/edit permission. A restart ends existing
invitations; users can create new ones. The current implementation caps 1,000
grants and 64 queued requests per document. Do not scale this service to several
owners behind round-robin routing or claim high availability. Shared state or
qualified affinity and failover would require another deployment design.

## Accept HTTPS before DNS changes

First use an owned stage hostname with a valid public certificate and matching
compiled relay URL, canonical MCP origin and CA allowlist/callback registrations.
Do not test with ignored TLS errors. Before the production DNS move, repeat
acceptance using the final hostname and certificate through a host override,
such as `curl --resolve`, or a private browser DNS mapping. Provision its valid
certificate through an approved DNS challenge or existing certificate custody;
do not redirect production traffic just to obtain the first acceptance result.
For certificate-file custody, replace each candidate site's `tls` directive with
`tls /secure/fullchain.pem /secure/key.pem` and record the adapted configuration
hash. The certificate must cover every hostname in that site block.
The final host's image/configuration must receive its own recorded checks.

The focused fixture tests run without building the app:

```sh
node --test tests/deployment-public-vm.test.ts
node --test tests/deployment-public-vm.integration.ts
```

The integration command requires Caddy and a working Docker API and pulls only
the digest-pinned nginx runtime. It tests real nginx and Caddy against generated
public fixtures and bounded dummy API upstreams. It checks routing, 404s, MIME,
cache/security headers, model HEAD/Range/ETag, proxy credential custody, exact
origin refusal, CA state cookies, Penpot event streaming and websocket upgrades.
It uses HTTP loopback fixtures; it does not qualify production TLS or the real
service handlers. The dedicated deployment CI lane runs both commands and fails
when required tools are absent.

Candidate acceptance must additionally prove:

1. Image/source/model receipts and published catalog signature match the candidate.
2. All document aliases and discovery files work over trusted HTTPS, with no
   private tools, Work APIs, pack indexes or asset URLs exposed anonymously.
3. MCP discovery/challenges use the exact canonical origin. Missing authentication
   is refused; configured limits and daily ceilings work; limiter outage refuses
   admission. Public renders and image proxy SSRF refusals retain their policy.
4. CA root bytes and provider identities remain unchanged. Complete an approved
   provider or email enrollment, including the HttpOnly cookie/callback round trip.
5. Penpot lists projects and imports a real public test document with progress,
   without retaining tokens or gaining additional RPC commands.
6. Two browser clients and an agent connect to the same document. Confirm read
   invitations refuse edits, edit invitations change that document only, expiry
   and revocation refuse reuse, and proxy origin/address spoofing is refused.
7. Large model GET/HEAD/Range requests and representative renders remain within
   memory, CPU, temporary storage, response-size and timeout bounds. Record idle
   and peak RSS, CPU, relay connections, failure behavior and restart recovery.

Retain the old qualified release, exact image/configuration/model identities and
certificate state for rollback. Move DNS only after the final-host acceptance
passes, then repeat external checks and watch errors/resources. Keep the old
deployment through the agreed cache and session transition window. Roll back
the public route/DNS independently from the private Work deployment if needed.
