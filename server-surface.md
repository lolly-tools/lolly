# Server Surface

The complete inventory of Lolly's server-side components. This page exists so
that one statement can be made precisely: **the core product - rendering,
exporting and verifying - runs entirely on your device**, and everything that
does *not* run on your device is listed below, with what it does, what it
holds and what happens if you turn it off.

If a Lolly deployment exposes a network endpoint that is not on this page, it
is not part of Lolly.

## What a deployment looks like

A Lolly deployment is a **static web application** (the PWA the browser loads
and then runs locally, offline-capable) plus **three optional server components**.
Neither is in the path of normal use: opening a tool, editing, previewing,
exporting and verifying a file all complete with no request to either. A
deployment that omits both is a fully working Lolly.

| Component | Route | Purpose | Optional? |
|---|---|---|---|
| Web shell | `/` (static files) | The app itself, served once, runs on-device | The app *is* this |
| MCP endpoint | `/api/mcp` (and the hosted `mcp.lolly.tools`) | Lets AI agents discover and render tools over [MCP](https://modelcontextprotocol.io) | Yes - remove it and the app is unaffected |
| Hot-link render | `GET /tool/<id>.<ext>` (part of the MCP function) | Renders a public catalogue tool from a plain URL - **public, unauthenticated by design** (public tool + catalogue data only, no Content Credentials) | Yes - **currently disabled on lolly.tools** (`LOLLY_DISABLE_RENDER_GET=1`, returns 404); an instance that leaves the flag unset serves it |
| MCP OAuth | Discovery at `/.well-known/oauth-authorization-server` and `/.well-known/oauth-protected-resource`, plus the flow itself: `POST …/register`, `…/authorize`, `…/token` and a `GET …/authorize` consent page (all part of the MCP function) | Standard OAuth 2.1 registration, authorization and token exchange for MCP connectors | Removed with the MCP endpoint |
| CA service | `/api/ca` - `GET /health`, `GET /root.pem`, `GET /auth/:provider`, `GET /callback/:provider`, `POST /email/start`, `POST /enroll` | Issues short-lived signing certificates so exports can carry a **verified identity** in their Content Credentials. `health` reports which OIDC providers a deployment has actually configured, so the app offers only buttons that work; `root.pem` serves the public root anyone can pin | Yes - without it, exports still sign, anonymously |
| Penpot pass-through | `POST /api/penpot/rpc/get-all-projects` and `POST /api/penpot/rpc/import-binfile` | Forwards two Penpot RPC calls to `design.penpot.app` on the user's behalf, because Penpot's API refuses cross-origin browser calls. Carries the user's own Penpot personal access token and the `.penpot` archive being sent, stores nothing | Yes - without it, "Send to Penpot" fails closed; the desktop apps do not use it |

## MCP endpoint (`services/mcp`, `api/mcp`)

**What it does.** Exposes the catalogue and render path as MCP tools
(`lolly_list_tools`, `lolly_describe_tool`, `lolly_build_url`, `lolly_render`,
`lolly_transform`, `lolly_redact`, `lolly_verify`, `lolly_validate`,
`lolly_compile`, `lolly_diff`, `lolly_inspect`, `lolly_measure`,
`lolly_package`) so an AI agent can produce finished, rule-bound assets. The serverless tier renders browser-free formats.
The full endpoint at `mcp.lolly.tools` drives a headless browser for
raster/PDF/animation/video.

**Authentication.** MCP tool calls require OAuth 2.1 (as an MCP connector) or
a bearer access token held by the operator. Two deliberate exceptions: the
hot-link render route `GET /tool/<id>.<ext>` is public and unauthenticated
(it serves only public tool + catalogue data, never signs output and can be
disabled with `LOLLY_DISABLE_RENDER_GET=1`), and an operator can opt the whole
endpoint into anonymous mode with `LOLLY_MCP_ALLOW_ANONYMOUS=1` (off by
default).

**What it stores.** Nothing persistent. The endpoint processes each request and
returns the rendered bytes. There is no user database and no stored render
history. Operational logging is the platform's function logging, covered by
the [Privacy Policy](/info/privacy.html).

**Three tools take a file.** `lolly_transform` (run an on-device utility on the
caller's behalf), `lolly_redact` (destroy regions of an image, SVG or PDF) and
`lolly_verify` (check a file's Content Credentials) each operate on bytes
supplied in the call, in memory, for that call only. Nothing is written
server-side. Every other tool works from parameters alone.

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

## A deployment with a control plane

A deployment may add an **optional control plane** - a separate server
product an organisation runs so its instance can govern sign-in, policy,
shared projects and its own catalogue. The app carries one seam for it
(`src/org/` in the web shell), and that seam is **dormant by default**: on a
plain deployment it makes one tolerant, time-boxed probe (`GET
/api/auth/config`), remembers the absence, and the app behaves exactly as a
build without the seam. Everything the seam can do when a control plane
answers is additive and documented in the shell source: sign-in gating,
org-config policy, an instance manifest (`GET /api/v1/instance`, read before
anyone signs in), and device-code sign-in for the installed apps.

What the app sends a managed instance is the version tag described in the
[Privacy Policy](/info/privacy.html) - and, **while you are signed in**, a
per-device install id inside that tag, so the operator's device list can tell
installs apart. It rides only requests your own use already makes; there is no
timer and nothing phones home. Leaving the instance (Profile → Lolly instance → Leave) removes the
organisation's brand, tools and catalogue from the device, deletes the
install id (a device that reconnects presents a fresh one), and your own
work stays. The control plane's own endpoints, storage
and data handling are that product's documentation, not this page's - this
page keeps its promise for what *Lolly* ships.

That is the whole of what the app does about enrolment, and it is deliberate.
Three arrangements follow from it. Plain Lolly has no instance and nothing to
leave. The community app connected to a governed instance honours that
instance's policy while you are signed in, and Leave is one tap: the
organisation's brand, tools and catalogue go, your own work stays. An
organisation that needs more than that - a client that cannot leave, or one
that removes the organisation's content after a set time offline - builds and
ships its own client from this open-source code. Nothing in the app prevents
that, and nothing in the app does it, because this app is the individual's.

## What is deliberately *not* here

- **No render server for the app.** The app never uploads your inputs or
  assets to produce an export.
- **No verification server.** Dropping a file on Verify parses and checks it
  locally. The file is never uploaded.
- **No telemetry or analytics backend.** No endpoint receives usage
  data. An automated test (`tests/no-trackers.test.ts`) enforces that no
  analytics or tracking SDK appears anywhere in the shipped source.
- **No user accounts** in the app. Identity enrolment (above) is the only
  sign-in anywhere, it is opt-in and it produces a certificate on your
  device, not an account on a server.

The complete list of every network request the *app* itself can make (fonts,
catalog sync, the optional endpoints above) is maintained in the
[Privacy Policy](/info/privacy.html#when-the-app-talks-to-a-network-in-full).

## For self-hosters

All three components are ordinary processes you can run, omit or replace. See
[Deployment](/info/deployment.html). If you operate them, you are the operator
of record for their logging and data handling. The
[Privacy Policy](/info/privacy.html) explains the split between what the
software does (true everywhere) and what an operator chooses.

Security reports for any of the above: see
[SECURITY.md](https://github.com/lolly-tools/lolly/blob/main/SECURITY.md) /
`/.well-known/security.txt`.
