# Server Surface

Does Lolly upload my work? Not to make something: the apps edit, render, export and verify on your device. A deployment can add optional services for AI agents, verified signing identities, a few integrations and organisation work. This page lists each one: what it receives, what it keeps and what stops working when the service is off.

::: figure server-surface-map
What leaves your device in ordinary use, when you call an optional service and when you work in your organisation's Lolly Work instance.
:::

In ordinary use nothing you make leaves the device. The app's own **Verify** view checks a dropped file where it is; calling the separate MCP `lolly_verify` tool sends the file to that MCP server. Standalone use needs no account and no usage-reporting backend, and `tests/no-trackers.test.ts` checks that no third-party tracking SDK is present. That test does not cover a Lolly Work instance, which can record usage telemetry. Personal [Sync](/info/sync.html) goes to storage you choose and is separate from Lolly Work.

This page owns what each server receives and keeps. [Privacy Policy](/info/privacy.html) says what that means for you, and [Threat Model & Trust Boundaries](/info/threat-model.html) gives the checks each service enforces.

## What a deployment looks like

The web app is a static PWA. A deployment can serve those files alone, add any of the services below, or run the app with Lolly Work for organisation sign-in and shared work. Local editing, rendering, downloads and verification work without any of them once the tools and assets a person uses are on the device.

| Component | Route | Purpose | Optional? |
|---|---|---|---|
| Web shell | `/` (static files) | The app itself, served once, runs on the device | The app *is* this |
| MCP endpoint | `/api/mcp` (the hosted endpoints are listed on [MCP Server](/info/mcp.html)) | Lets AI agents discover and render tools over [MCP](https://modelcontextprotocol.io) | Yes. Without it, the app is unaffected |
| Hot-link render | `GET /tool/<id>.<ext>` (part of the MCP function) | Renders a public catalogue tool from a plain URL. **Public and needs no sign-in**: public tool and catalogue data only, no Content Credentials | Yes. On by default; `LOLLY_DISABLE_RENDER_GET=1` makes it return 404 |
| MCP OAuth | Discovery at `/.well-known/oauth-authorization-server` and `/.well-known/oauth-protected-resource`, plus `POST …/register`, `…/authorize`, `…/token` and a `GET …/authorize` consent page (all part of the MCP function) | Standard OAuth 2.1 registration, authorization and token exchange for MCP connectors | Goes with the MCP endpoint |
| MCP private files | `GET /api/mcp/files/<id>` and the `files_*` tools (part of the MCP function) | Holds a caller's imported and converted files, and any tool result over 1 MiB, in a private temporary directory bound to that caller's bearer token | Yes. Off by default; `LOLLY_MCP_PRIVATE_FILES=1` turns it on |
| Agent invitation relay | `POST /api/mcp/agents` (part of the MCP function), plus `/live/invitations`, `/live/rpc`, `/live/mcp` and the `/live/editor` WebSocket on a long-lived relay process | Lets an AI agent the person invites from **Share > Invite an agent** read one open document, and change it when the invitation allows | Yes. `LOLLY_DISABLE_AGENT_CONNECTOR=1` turns off `/api/mcp/agents` |
| CA service | `/api/ca`: `GET /health`, `GET /root.pem`, `GET /auth/:provider`, `GET /callback/:provider`, `POST /email/start`, `POST /enroll`; in managed issuer mode also `GET /issuer/:id/crl`, `POST /revoke/challenge` and `POST /revoke` | Issues short-lived signing certificates so exports can carry a **verified identity** in their Content Credentials | Yes. Without it, exports still sign, anonymously |
| Penpot pass-through | `POST /api/penpot/rpc/get-all-projects` and `POST /api/penpot/rpc/import-binfile` | Forwards two Penpot calls to `design.penpot.app` for the web app's **Send to Penpot** | Yes. Without it, Send to Penpot fails closed in the web app |
| Image pass-through | `GET /api/fetch-image` | Fetches a public image URL for the web app's **Add from URL** | Yes. `LOLLY_DISABLE_IMAGE_PROXY=1` turns it off |
| Model files | `/models/<dir>/<file>` (static files), or the model host set at build time with `VITE_MODELS_BASE`; the desktop and mobile apps use `lolli.li` | On-device AI model files, downloaded when a feature first needs one | Yes. Without them, only the features that need a model stop |
| Lolly Work | A separate instance: `/api/auth/*`, `/api/v1/*`, its collaboration WebSocket and admin console | Organisation identity, policy, shared catalog and projects, work collabs, approvals, render jobs, delivery, telemetry and audit | Yes. Leave it out for standalone Lolly |

## MCP endpoint

**What it does.** Exposes the catalogue and the render path as more than twenty MCP tools, so an AI agent can produce finished assets that follow the tool's rules. [MCP Server](/info/mcp.html) lists every tool, the hosted endpoints and what each produces. Without a browser it renders the formats that need none; a deployment that adds the optional browser image drives a headless browser for raster, PDF, animation and video.

**Authentication.** By default, tool calls need OAuth 2.1 (as an MCP connector) or a bearer access token the operator holds. There are two exceptions. The hot-link render route `GET /tool/<id>.<ext>` is public: it serves only public tool and catalogue data, never signs output and can be turned off with `LOLLY_DISABLE_RENDER_GET=1`. And an operator can open the whole endpoint with `LOLLY_MCP_ALLOW_ANONYMOUS=1`, which is off by default. An open endpoint serves no OAuth routes, limits calls by the caller's address and stops for the rest of the UTC day once its daily CPU and data-transfer budget is spent. [MCP Server](/info/mcp.html) says which hosted endpoints are open.

**What it stores.** No content, no user database and no render history. The endpoint returns the rendered bytes and keeps nothing of the request. When the operator configures a Redis-compatible store, rate limits and the daily budget keep counters there: a SHA-256 digest of each caller's address or token per time window, and the day's CPU and byte totals. Other logging is the host's own process logging, covered by the [Privacy Policy](/info/privacy.html#infrastructure-logs).

**Files a caller sends.** The tools that take a file (transform, redact, verify, rebrand, read, check, package, compose and the three looking tools when given a picture) hold it in memory for that call only. `lolly_inspect` also takes a file, and its video and print-production checks write a temporary working copy that is deleted when the call returns. `lolly_rebrand`'s `capabilities` stage states where a deck goes before any is sent: a self-hosted local server keeps it on that machine, and a hosted server receives it for the call, up to that stage's size and slide limits. Every other tool works from parameters alone.

**Private files.** No file outlives its call unless the operator turns on private files. On a self-hosted, single-process gateway with an access token, `LOLLY_MCP_PRIVATE_FILES=1` makes the server write to a private temporary directory: files a caller imports with the `files_*` tools, kept for up to one hour, and tool results over 1 MiB, which the same bearer token downloads from `GET /api/mcp/files/<id>` within five minutes. A restart discards both, and an anonymous endpoint never offers them. See [Private download links for large results](/info/mcp.html#private-download-links-for-large-results).

## Agent invitation relay

**What it does.** When a person chooses **Share > Invite an agent**, the relay connects the agent they invite to the document open in their editor tab. Reads, previews and edits pass between the agent and that tab. A read invitation cannot change anything.

**What it stores.** Invitations and pending calls, in memory only. An unused invitation ends after ten minutes and a joined one after thirty minutes without activity; a relay restart ends every invitation. The MCP gateway's `/api/mcp/agents` connector keeps no invitation or document between calls. The `/live/*` routes run only on a long-lived process, never in a serverless function.

**If it is off**, the agent cannot join or continue, and the person keeps editing locally.

## CA service

**What it does.** Content Credentials **identity enrolment**. You prove an identity through Google or an organisation's OpenID Connect provider, GitHub sign-in with a verified address, or an emailed magic link. Your browser then generates a **non-extractable** key pair on the device, and the service issues a time-limited X.509 certificate that binds the public key to your verified identity. The private key never leaves your device. `GET /health` reports which providers a deployment has configured, so the app offers only buttons that work, and `GET /root.pem` serves the public root anyone can pin.

**What it stores.** No account database and **no issuance log** (a privacy choice explained in the [Privacy Policy](/info/privacy.html#verified-identity-a-sign-in-you-start-yourself)). The service holds its signing material or issuer credentials and its OIDC client secrets as deployment secrets. Lifetimes and recall depend on the issuer mode the operator sets with `CA_ISSUER_MODE`:

- **`legacy-root`**, the default when no `CA_VAULT_*` setting is present: the service signs with its own root. You pick a lifetime of 7, 30, 90 or 365 days; the default is 30, and the deployment caps it with `CA_CERT_MAX_DAYS`. This mode has no revocation, so the lifetime you pick bounds the misuse of a lost device.
- **`vault-pki`** (managed): a separate PKI issuer the operator runs signs each certificate, and the service holds no root private key. The default lifetime is at most 24 hours and the maximum at most 7 days. Each enrolment sign-in works once; a shared store keeps a keyed identifier and request digest for at most ten minutes to enforce that. A device can revoke its own certificate through `POST /api/ca/revoke/challenge` and `POST /api/ca/revoke`, and `GET /api/ca/issuer/<id>/crl` serves the issuer's revocation list. What the PKI issuer itself keeps depends on its configuration; the [CA service README](https://github.com/lolly-tools/lolly/blob/main/services/ca/README.md#lifetime-revocation-and-retained-data) lists what to review.

**If it is off**, exports still carry a full, verifiable Content Credential, signed anonymously, which is the default anyway. See [Content Credentials](/info/content-credentials-identity.html) and the [engineering detail](/info/content-credentials-engineering.html).

## Penpot pass-through

**What it does.** The Design tool's **Send to Penpot** makes two calls to Penpot's API: list your projects, then import the exported `.penpot` archive into one of them. Penpot's API answers a browser's cross-origin preflight with a 401 and no CORS headers, so the web app cannot call it directly. This function, built from `services/penpot/`, forwards exactly those two commands to `https://design.penpot.app/api/rpc/command/` and returns the answer. It refuses any other path. The desktop apps call Penpot directly.

**What passes through.** Your own Penpot personal access token, entered in the app and sent as `Authorization: Token …`, and for an import, the archive. Both are forwarded as they are and discarded with the request; the function keeps no store and no credential. Beyond the host's own logging, it logs one line for each call Penpot answers: the command name and Penpot's response status.

**If it is off**, Send to Penpot fails with a clear message and nothing else changes. Export the `.penpot` file and import it in Penpot yourself. Do the same for a self-hosted Penpot server, because the function forwards only to `design.penpot.app`, an address fixed in its code.

## Image pass-through

**What it does.** The web app's **Add from URL** asks this function to fetch a public image, because the app's own policy stops the browser from fetching another site's image directly. It refuses private and internal addresses and returns image bytes only. The desktop apps fetch the address themselves.

**What it stores.** Nothing. It hands back the bytes and forgets the address.

**If it is off**, only Lolly links, `data:` images and same-origin images can be added in the web app. The desktop apps are unaffected.

## Organisation services with Lolly Work

**What it does.** Lolly Work is the optional organisation service for the same Lolly apps and engine, maintained in a [separate repository](https://github.com/lolly-tools/lolly-work) and deployed separately. It adds organisation sign-in, provisioning, group permissions, managed profile fields and tool policies. Shared projects and sessions, catalog uploads and federation, work collabs, approvals, delivery and server render jobs use its APIs. The app's side lives in `shells/web/src/org/`: on a standalone deployment it probes `/api/auth/config` and carries on without organisation features when nothing answers. [Use Lolly at your organisation](/info/organisation.html) covers the steps for members.

**What it stores.** Unlike the MCP endpoint, a Lolly Work instance is meant to keep data: accounts and memberships, shared sessions, uploaded assets and their versions, approval and delivery records, render requests and retained outputs, audit records and any enabled usage telemetry. Server renders (`/api/v1/renders` and `/api/v1/render-batches`) run on the instance and keep their outputs, and formats that need a browser need its render worker. Delivery sends approved files to the destinations the operator configured, and federation contacts the asset providers the operator configured. All of these send content to the instance by design. The operator configures its database, file storage, retention and backups. Usage telemetry has three levels (`off`, `aggregate` and `standard`) and records allowlisted labels, never tool input values. The hash-chained audit log is a separate record that telemetry settings do not turn off. [Work storage and data lifecycle](/info/work-data-lifecycle.html) lists every store, and [Privacy Policy](/info/privacy.html#organisation-services-with-lolly-work) covers telemetry, audit and what to ask your operator.

**If it is unavailable**, new sign-ins, shared saves, work collabs, server jobs and delivery cannot complete, and prepared local work carries on, subject to the instance's access policy. A policy change does not necessarily recall content already cached on a device. **Settings → Lolly instance → Leave** removes the instance connection and its managed content from the device and keeps personal work; it does not erase server records. An operator who needs a client that cannot leave must distribute their own.

The public [lolly.work](https://lolly.work) demo keeps its state in memory only; a persistent instance needs its own storage. See the Work [security overview](/info/work-security-platform.html), [API](/info/work-api.html) and [current status](/info/work-status.html).

## For self-hosters

Each service is a component you can run, leave out or replace, and Lolly Work has its own deployment and storage configuration. See [Deployment](/info/deployment.html). If you run any of them, you are the operator of record for their logging and data handling; the [Privacy Policy](/info/privacy.html) separates what the software does everywhere from what an operator chooses.

Report a security problem with any of these through [SECURITY.md](https://github.com/lolly-tools/lolly/blob/main/SECURITY.md) or `/.well-known/security.txt`.
