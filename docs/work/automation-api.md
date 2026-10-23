# Automate with the Work API

Your Work server can render on-brand files for a script, a pipeline or an agent, with the same
tools, design system and policy the Lolly apps use. This page takes you from a token to a
finished file, then covers the rest of the automation surface: schemas, the document verbs,
background jobs, batches and provider assets.

Every other route the console, the `lw` CLI and the apps call is in the
[Lolly Work API reference](api.md).

## Render your first file

::: timeline
- <!--i:lock--> **Get a token.** An owner mints one for the script: `lw tokens create --label ci --role admin`. The secret, `lwt_…`, is shown once.
- <!--i:search--> **Ask what the token may do.** `GET /api/v1/discovery/me` answers with the formats this server renders and whether the token may render at all.
- <!--i:document--> **Read the tool's inputs.** `GET /api/v1/schema/qr-code` returns the inputs this caller may set, after policy and design-system rules.
- <!--i:download--> **Render.** `POST /api/v1/render` with the tool, the format and the inputs returns the file.
:::

```bash
export LW_TOKEN=lwt_...
curl -H "Authorization: Bearer $LW_TOKEN" https://work.example.com/api/v1/discovery/me
curl -H "Authorization: Bearer $LW_TOKEN" -H 'content-type: application/json' \
  -d '{"toolId":"qr-code","format":"svg","inputs":{"url":"https://example.com"}}' \
  https://work.example.com/api/v1/render > qr.svg
```

The answer is the file itself, with its media type, an `x-lolly-cache-key` header and an
`x-lolly-brand-check` header (see [design-system rules](#design-system-rules)). Add `?async=1`
to get a job instead, which you can poll or have the server call you back about. Every error
reads `{ "error": { "code", "message" } }`.

::: figure work-automation-api-journey
The path a script takes: a token, a check of what the token may do and which inputs it may set,
then a render that answers with the file or with a job.
:::

## Before you start: a token and a permission

**The token.** Service tokens are minted by owners (`token.manage`), from the console or
`lw tokens create --label <name> --role <role> [--days <n>]`. The label says which automation
holds the token, up to 80 characters. The role is any role but `guest`. A token lasts 90 days
unless you choose 1 to 365. Send it as `Authorization: Bearer lwt_…`; the `lw` CLI reads it from
`LW_TOKEN` or `--token`. The routes are in [service tokens](api.md#service-tokens).

**The permission.** Rendering on the server needs `tool.use` for the tool and `export.server`.
Admins hold `export.server` by default and a grant can give it to anyone else, so a token with
the `member` role cannot render until someone grants that permission. The other verbs need
`tool.use` for any tool they name.

**What a token is.** A token acts as its own account, with its role and no groups. Its jobs and
[file references](api.md#file-references) belong to the token, not to the owner who minted the
token. A token is refused wherever a person has to decide or act, such as approvals, deliveries
to a destination that needs approval and live collaboration.
[Who can call what](api.md#who-can-call-what) lists every credential.

On an `open` instance, a caller with no credential may also use and render any tool that no
visibility rule hides. On a `gated` instance, every route on this page except the public
`GET /api/v1/discovery` answers `401` without a credential; a job's result token counts as one
for that job's result.

## Find out what you can do

| Route | Who | What it answers |
|---|---|---|
| `GET /api/v1/discovery` | public | What this deployment can do, the same for everyone: document API and engine versions, server render formats, hooked tools, Content Credentials, automation verbs and batch limits, live collaboration, document agents, whether [file references](api.md#file-references) are on (`files.references`), and `unavailable` entries for what it lacks. Shared caches may hold it; it carries an ETag |
| `GET /api/v1/discovery/me` | member or service token; anyone on an instance that is not `gated` | What the caller can do: `principal` (`member`, `service` or `guest`), `can` bits for `tool.use`, `export.server`, `export.request`, `delivery.create` and `catalog.read`, provider reference schemes that resolve for the caller, limits, the render worker's live readiness when one is configured, and `unavailable` entries. Private, never cached |
| `GET /api/v1/discovery/tools?limit=&cursor=` | as above | The tools the caller can use, sorted by id, 25 a page by default and at most 100. Each entry has `name`, `version`, `renderer`, the server `formats` the caller may request, `can.render`, its schema URL and `unavailable` entries. `next` is an opaque cursor, or `null` on the last page |
| `GET /api/v1/schema/:toolId?view=&format=` | `tool.use` | The caller's effective input schema (below). `view=raw` returns the tool's own schema and needs `policy.edit`. `format` selects the output format whose design-system rules apply. Without it, the schema carries only the rules that apply to every format |

Discovery lives under `/api/v1` rather than `/.well-known/`, because on a shared origin
`/.well-known/` belongs to the web shell, whose static `/.well-known/lolly.json` describes the
shell.

## Read a tool's effective schema

`GET /api/v1/schema/:toolId` answers with `apiVersion` and `schema`. The schema is the
effective one for this caller, built from the tool, the tool policy that applies to the caller,
the design-system choice rules for the format and the deployment's render probe:

- An input the policy hides is absent from `properties` and `required`, and the response omits
  that input.
- A locked input has `readOnly: true` and, when the rule carries a value, that value as `const`
  and `default`. The server applies it, so leave it out of requests: sending it is refused with
  `INPUT_LOCKED`.
- A choice input gains an `enum` of the values the policy allows, narrowed to the tool's own
  options when it declares some. A reviewed design-system choice rule does the same, with
  `reason` naming the rule.

The `ETag` header moves with any change to the effective contract, so `If-None-Match` answers
`304` while the contract holds. A script can cache the schema and re-check it for the price of
one header.

::: details The rest of the schema response
The response adds `view`, `toolId`, `tool` (`name`, `version`), `versions` (`engine`, `tool`,
`policy`, `design`, `catalog`, and `rules` when design-system rules apply), `policy`, `render`
(`renderer`, `formats`, and `format` when one was requested), `unavailable` and `etag`.

Each `policy` entry is one change the policy made: an `effect` of `locked`, `choice` or
`format-excluded` with the `input` or `format`, plus the overlay's name as `by` and the rule's
`reason` when they exist. Entries never show groups or values from rules that do not apply to
the caller.
:::

Each `unavailable` entry, here and in discovery, identifies one `format`, `action` or `feature`
with a stable `code` and a `reason`:

| Code | Meaning |
|---|---|
| `WORKER_NOT_CONFIGURED` | the format needs the Chromium render worker, and this deployment does not run one |
| `UNSUPPORTED_FORMAT` | the deployment does not produce this format on the server; the web app can still export that format |
| `HOOKED_TOOL_NEEDS_CHROMIUM` | the tool runs scripts, and no worker is configured |
| `TOOL_REQUIRES_UNMET` | the tool needs host APIs the in-process render host does not provide |
| `SVG_TEMPLATE_REQUIRED` | server rendering needs an SVG template |
| `FORMAT_NOT_ALLOWED` | tool policy does not allow the format |
| `FORBIDDEN` | the caller lacks the permission, such as `export.server` for `render` |
| `RENDER_BUSY` / `WORKER_UNREACHABLE` | the configured worker is at capacity or did not answer its readiness check |
| `TOOL_UNAVAILABLE` | the deployment cannot load the tool |

## Render and the other document verbs

The automation surface mirrors the open-source engine's document verbs:

| Route | What it does |
|---|---|
| `POST /api/v1/render` | renders a file: `{ toolId, format, inputs }`. `format` is required (`400 INVALID_INPUT` without one). Needs `export.server` |
| `POST /api/v1/compile` | turns `{ toolId, inputs }` into a document, with locked values applied |
| `POST /api/v1/validate` | checks inputs and reports problems as errors, without rendering |
| `POST /api/v1/inspect` | describes a file (sent as below) or a document |
| `POST /api/v1/measure` | measures a document, sent as `document` or as `{ toolId, inputs }` |
| `POST /api/v1/optimize` | shrinks a file (sent as below), or optimizes a document |
| `POST /api/v1/diff` | compares two documents, `a` and `b` |
| `POST /api/v1/package` | packs a compiled `document`, or `{ toolId, inputs }`, into a `.lolly` file |

Inputs travel as JSON in `inputs`, not as URL merge fields. Schema, compile, package and render
all enforce the caller's `tool.use` decision and the tool-visibility overlay, so a document verb
cannot be used to discover a tool hidden from that caller.

**Policy.** Compile, validate, package and the rows of a batch check inputs against the same
policy the schema shows:

- compile and package refuse a locked, hidden or not-allowed input with `422` and the code the
  render route uses (`INPUT_LOCKED`, `INPUT_HIDDEN` or `INPUT_NOT_ALLOWED`), with the `input`,
  `by` and `reason`;
- validate reports the same codes as errors, and does not count a missing locked or hidden input
  against the caller;
- a batch row that breaks the policy fails `ROW_VALIDATION_FAILED` before the job is queued;
- durable renders and render batches check the current policy at each attempt, so one admitted
  before a policy change records that attempt's failure with the same codes.

### Design-system rules

Design-system rules can apply to some output formats only. Compile, validate and package take an
optional `format`, one the tool declares, and then apply that format's rules, as the schema read
with the same `format` shows. Without one they apply only the rules every format shares. A batch
row is checked against the rules for the batch's `format`, and a render against the rules for
its own format.

Rules that are not choices, such as a text length, are not in the schema. The render checks them
and refuses a value that breaks one with `BRAND_RULE_VIOLATION`. A render's
`x-lolly-brand-check` header reports the check, and durable output metadata carries `brandRules`
with its disposition, scope and revision. A passing check is not a review of how the output
looks. Policy editors publish the rules through
[managed rule mappings](api.md#managed-rule-mappings).

### Files in, files out

`/inspect` and `/optimize` take the file in one of four ways:

- `bytesBase64`, the bytes in the request;
- a provider `source` (see [provider assets](#assets-from-providers));
- `upload: { id, checksum }`, the caller's own finished `automation-input`
  [upload](api.md#uploads), for a file too large for one request;
- `file: { id, checksum }`, one of the caller's [file references](api.md#file-references).

`/optimize` with `output: "file"` keeps its output as a new file reference of the caller and
answers `{ file, bytes, savedBytes, stages }` instead of `bytesBase64`.

## Render from a URL

`GET /render/<toolId>.<format>?<inputs>` renders with the inputs in the query, the way a Lolly
share link carries them. It suits an image tag or a script with no JSON body.

Who may call it: a member who may use the tool and holds `export.server`; a guest whose link
opens that tool; or, on an `open` instance, anyone without signing in, for a tool visible to
everyone. A service token cannot call this route, because it reads only a session or a guest
link; a script with a token uses `POST /api/v1/render`. A query that is not in canonical order
is answered `308` to the canonical one.

For worker-backed renders, asset inputs use the same URL encoding as the Lolly shell. A
`user/team/<fileId>` reference is resolved to that project's file endpoint only when the
submitter can read the project and the file belongs to the render's scoped read ticket. The
worker receives no general session credentials. Private files outside that scope stay out of
reach; inline baked assets keep their original bytes.

## Run work in the background

Any document verb, render or package takes `?async=1`, or `Prefer: respond-async`, and answers
`202 { jobId, statusUrl }` with a `Location` header.

| Route | What it does |
|---|---|
| `GET /api/v1/jobs` | the caller's jobs |
| `GET /api/v1/jobs/:id` | one job: its state, progress, `resultSha256` (computed from the output bytes, `null` until a result exists), `resultToken` and `callback` |
| `GET /api/v1/jobs/:id/result` | the finished result |
| `DELETE /api/v1/jobs/:id` | removes queued work or retained output; `409 JOB_OUTPUT_IN_USE` while a delivery retains that output |
| `POST /api/v1/jobs/:id/deliveries` | sends a completed render to an [outbound destination](api.md#outbound-delivery) without a download and upload round trip; the delivery shares the immutable result and records the job id |

Jobs belong to the member or service token that created them. Repeating a request with the same
`Idempotency-Key` returns its existing job; reusing that key for different request bytes returns
`409 IDEMPOTENCY_KEY_REUSED`.

### Callbacks

A job can call you back when it settles. `callbackUrl` is used only when it exactly matches the
instance's own webhook endpoint, `notify.webhook.url` ([configuration](configuration.md#notify)).
Each callback carries `x-lolly-timestamp` and an `x-lolly-signature` header signed with
`LW_WEBHOOK_SECRET`, and its body is `{ jobId, state, resultUrl, resultToken, deliveryId }`.

`resultToken` is a 24-hour token for that one job's result. Send it as the `x-lw-job-token`
header on `GET /api/v1/jobs/:id/result`, and the receiver needs no session of its own. A
completed job resource carries the same `resultToken`, and `null` before then.

::: note The token in the result URL is deprecated
The token used to travel in the URL, as `resultUrl?token=…`, and a URL ends up in access, proxy
and CDN logs. In Work 1.1.2 `resultUrl` still carries `?token=` and the result route still
accepts the query token, answering with a `Deprecation` header
([RFC 9745](https://www.rfc-editor.org/rfc/rfc9745)). A later release drops the query from
`resultUrl` and refuses a query token, so move receivers to the header now.
:::

Callbacks go through a durable outbox. The write that settles a job also stores its callback,
and any Work process sends callbacks that are due, so a callback left unanswered by a restart is
sent again afterwards.

Every attempt for one job carries the same id, in `x-lolly-delivery-id` and as `deliveryId` in
the signed body. Act on each id once: that is the idempotency contract of a signed-HTTPS
delivery. Each attempt has a fresh timestamp, signature, result URL and result token. A refusal,
a timeout or a dropped connection is retried after 5 s, 30 s, 2 min, 10 min and 30 min, six
attempts in all.

The job reports `callback: { id, state, attempts, lastOutcome, lastStatus, nextAttemptAt }`:

- `state` is `pending`, `acknowledged` (the receiver answered 2xx) or `failed`. Work never
  reports a callback as delivered, because a 2xx answer does not show what the receiver did next.
- `lastOutcome` is `acknowledged`, `refused`, `uncertain` (the request may have reached the
  receiver) or `not-sent` (the URL is not approved, or no signing secret is configured).
- `callbackFailed` stays `true` until the receiver acknowledges.

## Make many files at once

`POST /api/v1/batch { toolId, format, rows, keepGoing?, retries?, concurrency?, priority? }`
always creates a job and produces one ZIP. Requested concurrency is capped at four in this
process, priority at 0 to 9 and retries at three. Progress is exposed as `{ done, total }`, and
the ZIP's `manifest.json` records every row outcome.

In place of `rows`, `bind: { source, query?, as? }` reads JSON or CSV from a governed provider:

- `as` may be the JSON Schema the schema route returns, and every row is also checked against
  the actual tool before it is queued;
- `query` is a typed, nested equality selector, forwarded to the provider and enforced again over
  the returned objects;
- CSV follows RFC 4180, including quoted commas, escaped quotes and embedded newlines, and its
  cell values are strings.

For batches whose rows each need their own durable record, use
[render batches](#durable-renders) instead.

## Assets from providers

Provider references are resolved during compile, before the render cache identity is worked out:

- `image://brand`, `catalog://` and `library://` stay local and work offline.
- `cms://<provider-id>/<remote-id>` uses that enabled catalog provider's stored credential,
  exposure and lifecycle.
- `net://<operator-allowed-origin>/<path>` reaches only origins present in provider
  configuration.

Both remote kinds are bounded in time and bytes, content-addressed, and pass through immutable
resize, format-conversion and metadata-strip stages.

## Durable renders

`POST /api/v1/renders` submits a persistent single-tool request that survives a restart. List or
get its state, retrieve its verified output, cancel it, or create a retry through the same API.
The standalone server recovers expired leases; function-only hosts refuse new submissions.
[Recoverable renders](renders.md) has the request contract, routes, limits and deployment
requirements.

- **Evidence.** New durable outputs expose a partial execution receipt at
  `GET /api/v1/renders/:id/evidence`: loaded source hashes, prepared context, observed asset byte
  digests and the output digest under the same lease. The receipt lists its own coverage gaps; it
  is not a complete dependency lock. The download includes the output's
  [render identity](renders.md#render-identity), which binds the typed request to the resolved
  tool source, engine version, sources and effective policy.
- **Verification.** Render and batch requests accept `verification: "output-v1"`, or
  `verification: { profile: "output-v1", widthPx: 1200, heightPx: 630 }`. These assertions read
  the final file back before publication. Failed required checks keep `error.inspection` and
  publish no output. The [verification profile](renders.md#verify-the-produced-file) lists
  formats and measurement limits; a passing check is not design approval.
- **Production checks.** Durable render and batch requests accept
  `production: { contract, referenceBase64?, repair? }` for the engine's
  `lolly/production-still-v1` profile; `lolly/production-motion-v1` is not accepted. The
  contract and repair choices are part of request identity and retries. A contract can protect a
  runtime input with `kind: "input"`, a declared input id in `location` and a canonical JSON
  SHA-256 in `expected`; such a check needs observed runtime values, which file-only inspection
  cannot reconstruct. Failed required checks return no artifact and keep
  `PRODUCTION_VERIFICATION_FAILED` diagnostics on the render record. See
  [production still checks](renders.md#production-still-checks-and-permitted-repairs).
- **Render batches.** `POST /api/v1/render-batches` creates a parent and up to 200 independent
  child renders in one atomic step. Read its ordered rows and output receipts, download a JSON manifest,
  cancel unfinished rows, or retry a terminal batch while keeping its successful children. The
  [batch API](renders.md#batches-with-durable-rows) is separate from the `/api/v1/batch` job and
  ZIP contract.

## Limits and errors

The automation routes share the `rateLimit.automation` bucket, per client IP: discovery, schemas,
the document verbs, renders, batches and jobs, `GET /render/…`, agent connections and the
outbound delivery `POST`s. That includes the public `GET /api/v1/discovery`, so reading it never
costs a sign-in attempt. The bucket is admission control, not pricing: Work keeps no
per-principal quota or usage account for these routes. Sizes are in
[configuration](configuration.md#ratelimit).

Errors keep the `{ "error": { "code", "message" } }` shape. These are the codes an automation
script meets most; the [common codes](api.md#common-error-codes) cover sign-in, permissions and
links.

| Code | Status | Meaning |
|---|---|---|
| `INVALID_INPUT` | 400 | a required field is missing or malformed |
| `DOCUMENT_API_ERROR` | 400 | the compile, inspect, diff, measure, optimize or package operation could not be performed |
| `DATA_BINDING_ERROR` | 400 | a live JSON or CSV provider binding could not resolve, parse, query or validate |
| `UNSUPPORTED_FORMAT` | 400 | a format this deployment cannot produce (org-config's `render.formats` lists what it can) |
| `FORMAT_NOT_ALLOWED` | 403 | the format exists here, but this tool's overlay policy excludes that format |
| `INPUT_LOCKED` | 422 | a locked input was supplied by the caller |
| `INPUT_HIDDEN` | 422 | the caller supplied an input that policy hides from them |
| `INPUT_NOT_ALLOWED` | 422 | the value is not one of those a choice rule allows |
| `BRAND_RULE_VIOLATION` | 422 | a render input breaks a reviewed design-system rule for that format |
| `ROW_VALIDATION_FAILED` | 422 | a batch row does not satisfy the selected tool contract |
| `IDEMPOTENCY_KEY_REUSED` | 409 | the caller reused an idempotency key for different request bytes |
| `HOOKED_TOOL_NEEDS_CHROMIUM` | 501 | the tool runs scripts and no worker is configured (org-config's `render.hookedTools` is `false`) |
| `TOOL_REQUIRES_UNMET` | 501 | the manifest's `requires` lists a `host.*` API the in-process render host lacks (`text`, `compose`, `audio`, the device APIs); route the tool through the Chromium worker |
| `RENDER_BUSY` | 503 | the render worker is at capacity; retry after `Retry-After` seconds |

## Related

- Every other route, grouped by job: [Lolly Work API reference](api.md)
- Persistent renders and their evidence: [recoverable renders](renders.md)
- Sending large files in parts: [resumable uploads](resumable-uploads.md)
- The same surface from a terminal: [lw CLI](cli.md)
- Agents that work inside one document: [document agents](document-agents.md)
