# Server Surface

Lolly's engine and apps can render, export and verify on-device. Optional services add agent rendering, verified signing identities, network integrations and organisation workflows. This page identifies those services, what they hold and which features depend on them.

**lolly.work is part of the Lolly project**, maintained in a [separate repository](https://github.com/lolly-tools/lolly-work) and deployed separately. Its shared storage and authenticated APIs are part of the combined solution, not requirements for standalone use.

## What a deployment looks like

The web app is a static PWA. A deployment can serve those files alone, add selected services below, or run the app with lolly.work for organisation sign-in and shared work. Ordinary local editing, rendering, downloading and verification work without these services once the required tools and assets are available.

| Component | Route | Purpose | Optional? |
|---|---|---|---|
| Web shell | `/` (static files) | The app itself, served once, runs on-device | The app *is* this |
| MCP endpoint | `/api/mcp` (and the hosted `mcp.lolly.tools`) | Lets AI agents discover and render tools over [MCP](https://modelcontextprotocol.io) | Yes - remove it and the app is unaffected |
| Hot-link render | `GET /tool/<id>.<ext>` (part of the MCP function) | Renders a public catalogue tool from a plain URL - **public, unauthenticated by design** (public tool + catalogue data only, no Content Credentials) | Yes - **live on lolly.tools**; an operator switches it off with `LOLLY_DISABLE_RENDER_GET=1` (returns 404) |
| MCP OAuth | Discovery at `/.well-known/oauth-authorization-server` and `/.well-known/oauth-protected-resource`, plus the flow itself: `POST …/register`, `…/authorize`, `…/token` and a `GET …/authorize` consent page (all part of the MCP function) | Standard OAuth 2.1 registration, authorization and token exchange for MCP connectors | Removed with the MCP endpoint |
| CA service | `/api/ca` - `GET /health`, `GET /root.pem`, `GET /auth/:provider`, `GET /callback/:provider`, `POST /email/start`, `POST /enroll` | Issues short-lived signing certificates so exports can carry a **verified identity** in their Content Credentials. `health` reports which OIDC providers a deployment has actually configured, so the app offers only buttons that work; `root.pem` serves the public root anyone can pin | Yes - without it, exports still sign, anonymously |
| Penpot pass-through | `POST /api/penpot/rpc/get-all-projects` and `POST /api/penpot/rpc/import-binfile` | Forwards two Penpot RPC calls to `design.penpot.app` on the user's behalf, because Penpot's API refuses cross-origin browser calls. Carries the user's own Penpot personal access token and the `.penpot` archive being sent, stores nothing | Yes - without it, "Send to Penpot" fails closed; the desktop apps do not use it |
| Image pass-through | `GET /api/fetch-image` | Fetches a public image URL for the web app's Add from URL action; returns image bytes without persistent storage | Yes - disable with `LOLLY_DISABLE_IMAGE_PROXY=1`; desktop apps fetch directly |
| lolly.work | Separate instance: `/api/auth/*`, `/api/v1/*`, plus its collaboration WebSocket and admin console | Organisation identity, policy, shared catalog and projects, work collabs, approvals, render jobs, delivery, telemetry and audit | Yes - omit it for standalone Lolly; organisation services need a reachable instance |

## MCP endpoint (`services/mcp`, `api/mcp`)

**What it does.** Exposes the catalogue and render path as MCP tools
(`lolly_list_tools`, `lolly_describe_tool`, `lolly_build_url`, `lolly_render`,
`lolly_transform`, `lolly_redact`, `lolly_verify`, `lolly_rebrand`,
`lolly_read`, `lolly_check`, `lolly_measure_text`, `lolly_validate`,
`lolly_compile`, `lolly_diff`, `lolly_inspect`, `lolly_measure`,
`lolly_package`, `lolly_compose`, `lolly_look`, `lolly_sample_color`,
`lolly_trace_edges`) so an
AI agent can produce finished, rule-bound assets. The serverless tier renders
browser-free formats.
The full endpoint at `mcp.lolly.tools` drives a headless browser for
raster/PDF/animation/video.

**Authentication.** By default, MCP tool calls require OAuth 2.1 (as an MCP
connector) or a bearer access token held by the operator. Two deliberate
exceptions: the hot-link render route `GET /tool/<id>.<ext>` is public and
unauthenticated (it serves only public tool + catalogue data, never signs
output and can be disabled with `LOLLY_DISABLE_RENDER_GET=1`), and an operator
can open the whole endpoint with `LOLLY_MCP_ALLOW_ANONYMOUS=1` (off by
default). lolly.tools opens `lolly.tools/api/mcp` this way; `mcp.lolly.tools`
keeps the token. An open endpoint serves no OAuth routes, limits calls by the
caller's address and stops for the rest of the UTC day once its daily CPU and
data-transfer budget is spent.

**What it stores.** Nothing persistent. The endpoint processes each request and
returns the rendered bytes. There is no user database and no stored render
history. Operational logging is the platform's function logging, covered by
the [Privacy Policy](/info/privacy.html).

**Some tools take a file.** `lolly_transform` (run an on-device utility on the
caller's behalf), `lolly_redact` (destroy regions of an image, SVG or PDF),
`lolly_verify` (check a file's Content Credentials), `lolly_rebrand`
(renovate a slide deck onto a design system, across its `plan`, `compile` and
`inspect` stages), `lolly_read` (read what a deck says), `lolly_check` (check a
Design document, a `.lolly` or an export, optionally against its source deck),
`lolly_package` (package a Design document as a `.lolly`, with the pictures and
source deck the caller supplies), `lolly_compose` (lay slides out from a slide
master, given a source deck's bytes for its text and its suggested layouts) and
the three looking tools (`lolly_look`, `lolly_sample_color`,
`lolly_trace_edges`, when given a picture) each operate on bytes supplied in the
call, in memory, for that call only. Nothing is written server-side. `lolly_rebrand`'s
`capabilities` stage states where the deck goes before any is sent: it never
leaves a self-hosted local server, and a hosted server necessarily receives it
for the call, up to that stage's stated size and slide limits. Every other
tool works from parameters alone.

Full reference: [MCP Server](/info/mcp.html).

## CA service (`services/ca`, `api/ca`)

**What it does.** Content Credentials **identity enrolment**. You verify an
identity: OpenID Connect (Google, SUSE IdP), GitHub OAuth with a verified
address or an emailed magic link (inbox control). Your browser then generates a
**non-extractable** keypair on-device. The service issues a time-limited
X.509 certificate that binds that public key to your verified identity. Your
private key never leaves your device and never transits the service.

**What it stores.** No account database, and deliberately **no issuance log**
(a privacy decision, documented in the [Privacy Policy](/info/privacy.html)).
Certificate lifetime is user-selectable: 7, 30, 90 or 365 days. The default is
30, and the deployment caps it (`CA_CERT_MAX_DAYS`). Expiry is the recall
mechanism: there is no revocation infrastructure, so the lifetime you pick
bounds misuse of a lost device. The service holds its own signing material and
OIDC client secrets as deployment secrets.

**If it is off**, exports still carry a full, verifiable Content Credential,
signed anonymously. That is the default anyway.

Full reference: [Content Credentials Identity](/info/content-credentials-identity.html)
and the [engineering detail](/info/content-credentials-engineering.html).

## Penpot pass-through (`api/penpot`)

**What it does.** The Design tool's "Send to Penpot" needs two calls to
Penpot's RPC API: list the user's projects, then import the exported `.penpot`
archive into one of them. Penpot's API answers a browser's cross-origin
preflight with a 401 and no CORS headers, so the web app cannot call it
directly. This function forwards exactly those two commands to
`https://design.penpot.app/api/rpc/command/` and returns the answer. The
desktop apps call Penpot directly and never touch it.

**What passes through it.** The user's own Penpot personal access token
(entered in the app, sent as `Authorization: Token …`) and, for an import, the
archive being sent. Both are forwarded verbatim and discarded with the
request; the function keeps no store, no log of its own beyond the platform's
function logging, and no credential. Only those two command names are
accepted; any other path is refused.

**If it is off**, "Send to Penpot" fails with a clear message and nothing
else changes. Export the `.penpot` file and import it in Penpot yourself.
Self-hosters who run their own Penpot point the function at it with
`PENPOT_UPSTREAM_BASE`.

## Organisation services with lolly.work

**What it does.** lolly.work is the optional organisation service for the same Lolly apps and engine. It provides OIDC SSO, SCIM provisioning, group-based permissions, managed profile fields and tool policies. Shared projects and sessions, catalog uploads and federation, work collabs, approvals, governed delivery and server render jobs use its authenticated APIs.

The app's integration lives in `shells/web/src/org/`. On a standalone deployment it probes `/api/auth/config` and continues without organisation features when no service answers. On a managed instance it signs in, fetches policy and shared content, and maintains the connections needed for enabled features. [Use Lolly at your organisation](/info/organisation.html) covers the user-facing steps.

**What it stores.** Unlike the stateless MCP endpoint, a persistent lolly.work deployment holds organisation accounts and memberships, shared sessions, uploaded assets and their versions, approval and delivery records, render requests and retained outputs, plus audit records and any enabled usage telemetry. The operator configures its database, blob storage, retention and backups. Federation also contacts the asset providers that operator configured.

**Rendering and delivery.** Local app exports still use the on-device engine. Requests to `/api/v1/renders` and `/api/v1/render-batches` run on the organisation's server, retain outputs and support status, retry and cancellation. Formats needing a browser require the render worker. Governed delivery sends approved staged bytes to configured destinations. These operations deliberately send content to the service.

**Telemetry and audit.** The service supports `off`, `aggregate` and `standard` usage reporting. Event attributes are allowlisted labels, not tool input values. At `standard`, attribution defaults to requiring consent; an operator can configure attributed reporting instead. The hash-chained audit log is a separate record of governed actions and is not disabled by telemetry opt-out. See [Privacy](/info/privacy.html#organisation-services-with-lolly-work).

**If it is unavailable**, new sign-ins, shared saves, work collabs, server jobs and delivery cannot complete. Prepared local workflows remain on-device, subject to the instance's access policy. Do not assume that cached content is recalled immediately when a policy changes. The community app's **Settings → Lolly instance → Leave** removes its instance connection and managed content, while personal work stays; it does not erase server records. An operator needing a client that cannot leave must distribute its own client.

Full references: lolly.work's [API](https://github.com/lolly-tools/lolly-work/blob/main/docs/api.md), [security boundaries](https://github.com/lolly-tools/lolly-work/blob/main/docs/security-platform.md), [data lifecycle](https://github.com/lolly-tools/lolly-work/blob/main/docs/data-lifecycle.md) and [current status](https://github.com/lolly-tools/lolly-work/blob/main/docs/status.md). The public lolly.work sandbox uses memory-only demo state; persistent organisation deployments need their own storage.

## What stays local

- **Ordinary app rendering and downloads** need no render server. Shared-session saves, approval submissions, delivery and explicitly requested server renders have the data flows described above.
- **The app's Verify view** parses and checks a dropped file locally. Calling the separate MCP `lolly_verify` tool sends the file to that MCP server.
- **Standalone use** needs no account or usage-reporting backend. lolly.work adds those organisation features when deployed. `tests/no-trackers.test.ts` checks for third-party tracking SDKs; it is not proof that organisation telemetry does not exist.
- **Personal Sync** uses storage the user chooses and is separate from lolly.work's shared projects.

The app's network flows are described in the [Privacy Policy](/info/privacy.html#every-network-request-the-app-can-make).

## For self-hosters

The services are optional components you can run, omit or replace. lolly.work has its own deployment and storage configuration. See
[Deployment](/info/deployment.html). If you operate them, you are the operator
of record for their logging and data handling. The
[Privacy Policy](/info/privacy.html) explains the split between what the
software does (true everywhere) and what an operator chooses.

Security reports for any of the above: see
[SECURITY.md](https://github.com/lolly-tools/lolly/blob/main/SECURITY.md) /
`/.well-known/security.txt`.
