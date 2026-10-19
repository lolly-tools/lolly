# Outbound delivery

Outbound delivery sends one finished Lolly export to a fixed destination owned by the
organization. Three open adapters cover object storage, sovereign file servers and a small
receiver protocol: generic S3-compatible storage (AWS S3, MinIO, Ceph RGW, Garage, UpCloud),
WebDAV (including Nextcloud/ownCloud), and HMAC-signed HTTPS.

This is not a writable catalog provider. Catalog providers federate remote assets **into**
Lolly, normally read-only; delivery sends a generated output **out**. Reusing the same
credential would silently upgrade read authority to write authority, so the two contracts,
registries and secrets stay separate.

## Freedom boundary

- Personal send targets stay on the person's device. Work cannot inspect, disable, redirect,
  credential, or select them.
- Organization destinations contain organization credentials on the server. A shell receives
  only `{id, kind, label, formats, maxBytes, visibility}` after group and RBAC filtering.
- Organization destinations cannot become a person's automatic export home.
- No destination is configured by default; absence means zero outbound delivery.
- A manual send is explicit. Automation may publish only its own completed, immutable render
  output by reference; it cannot nominate a personal file, another principal's job, or an
  arbitrary BlobStore key.
- The connected shell presents organization targets beside personal ones. An organization S3
  target cannot replace a person's S3 connection, and a person's connector preference cannot
  withdraw an organization target. Organization targets accept fresh exports only, never an
  arbitrary catalog asset, and the shell requests a Content Credential on the exact sent bytes.
- S3 is an open protocol adapter, not a privileged hosted service. A deploy brings its own
  endpoint, bucket and key and can leave without migrating a Lolly-specific representation.

`lolli.li` is the Lolly open-source project's release/model file host, **not a user-upload
service and not a built-in destination**. Its UpCloud bucket is used only by an explicitly
gated developer canary to verify S3 interoperability; the canary writes inert bytes under a
random technical key and deletes that exact key in `finally`.

## Configure a fixed S3 destination

```json
{
  "delivery": {
    "maxBytes": 67108864,
    "destinations": [
      {
        "id": "campaign-archive",
        "kind": "s3",
        "label": "Campaign archive",
        "credentialRef": "LW_DESTINATION_CAMPAIGN_ARCHIVE",
        "enabled": true,
        "groups": ["marketing", "brand"],
        "formats": ["svg", "png", "jpg", "pdf"],
        "maxBytes": 33554432,
        "options": {
          "bucket": "approved-output",
          "endpoint": "https://minio.example.org",
          "region": "us-east-1",
          "prefix": "campaigns"
        }
      }
    ]
  }
}
```

Set the referenced secret in the deployment environment:

```bash
LW_DESTINATION_CAMPAIGN_ARCHIVE='<accessKeyId>:<secretAccessKey>'
```

Use a write key dedicated to this destination and restricted to the configured bucket/prefix.
Do not reuse the catalog-provider credential, the instance BlobStore credential, or an
operator's broad release key. `publicBaseUrl` is optional and means exactly what it says: when
present, Work marks the descriptor public and returns the corresponding object URL in the
receipt. An unguessable public URL is not access control.

## Configure a fixed WebDAV destination

The collection and any `prefix` subdirectory must already exist. Delivery neither browses the
account nor creates a folder tree; it can write only beneath the fixed collection URL.

```json
{
  "id": "team-files",
  "kind": "webdav",
  "label": "Approved team files",
  "credentialRef": "LW_DESTINATION_TEAM_FILES",
  "enabled": true,
  "groups": ["brand"],
  "formats": ["svg", "png", "pdf"],
  "options": {
    "url": "https://cloud.example/remote.php/dav/files/team/outgoing",
    "prefix": "approved"
  }
}
```

Set `LW_DESTINATION_TEAM_FILES='<username>:<app-password>'`, or use
`bearer:<token>` for a token-fronted DAV server. For Nextcloud, use a revocable app password,
not the account password. A deterministic flat filename makes a retry overwrite the same
resource; a successful `PUT` is followed by authenticated `HEAD` and bounded `GET` verification
of size and SHA-256 before the receipt claims byte preservation. `publicBaseUrl` is optional and
separate from the credentialed collection URL.

## Configure a signed-HTTPS destination

This is the adapter for an organization-owned publishing service without coupling Work to its
vendor or API. The target is one exact HTTPS endpoint, not a user-entered webhook:

```json
{
  "id": "press-publisher",
  "kind": "https",
  "label": "Press publisher",
  "credentialRef": "LW_DESTINATION_PRESS_PUBLISHER",
  "enabled": true,
  "groups": ["communications"],
  "formats": ["png", "jpg", "pdf"],
  "options": { "url": "https://publisher.example/lolly-delivery" }
}
```

Set the referenced variable to a dedicated random HMAC secret. Work sends the raw export body
with `x-lolly-delivery-id`, `x-lolly-format`, a base64url `x-lolly-name`,
`x-lolly-content-sha256`, `x-lolly-timestamp`, and
`x-lolly-signature: v1=<hex-hmac-sha256>`. The signed canonical string is:

```text
lolly-delivery-v1\n<timestamp>\n<delivery-id>\n<format>\n<base64url-name>\n<content-type>\n<size>\n<sha256>
```

The receiver should reject stale timestamps and duplicate delivery ids. It may return no body,
or JSON `{ "id": "…", "url": "https://…", "sha256": "…" }` (maximum 64 KiB). A matching
digest yields `transformation: "none"`; a different digest is recorded as
`"provider-managed"`; no digest stays honestly `"unknown"`. Work does not offer a revoke for
this protocol because it has no safe universal delete contract.

## Delivery lifecycle

The raw body is accepted only when it carries Lolly's C2PA export assertion. Before provider
egress, Work records its SHA-256 and stages the exact bytes in the configured BlobStore:

```text
awaiting-approval --approve--> queued -> delivering -> delivered
        |                               \-> failed -> retry -> delivering
        \--reject/withdraw--> rejected/cancelled
```

The record binds the destination version, name, format, MIME, size and SHA-256. Those facts are
immutable in both memory and Postgres stores. A retry uses the staged bytes and the same S3 key:

```text
<prefix>/<delivery-id>/<sha256-prefix>-<safe-filename>.<format>
```

If the destination's endpoint, bucket, prefix, formats, exposure or other semantics change,
the version changes and retry returns `409 DESTINATION_CHANGED`; the caller creates a new
delivery deliberately. Credential rotation does not move the version.

### Delivering an automation output

`POST /api/v1/jobs/:id/deliveries` consumes a completed `render` job owned by the same member or
service principal. The JSON body is `{ "destinationId": "campaign-archive", "name": "Launch
poster" }`; an optional `format` must equal the immutable render request rather than overriding
the render request. When the job completes, Work records SHA-256 over the actual output bytes independently of
the blob provider (an S3 ETag is not a portable content digest). Delivery reads the retained
result, verifies it against that digest, re-verifies its Lolly Content Credential, then points
the delivery's private `sourceRef` at that existing blob. There is no download/upload round trip
and no second stored copy. Jobs completed before digest storage was introduced must be rendered
again before this route can deliver them.

The delivery receipt exposes `sourceJobId` for correlation, never the private blob reference.
The source job cannot be deleted while any delivery retains its output (`409
JOB_OUTPUT_IN_USE`), including after successful egress, so retry and audit cannot be made false
by deleting their evidence. A later retention policy will release both deliberately. A service
token still cannot enter a destination's human approval chain; that boundary is identical for
raw-body and job-output creation.

### Optional human approval

Set `approvalChain` on a destination to an existing chain id. Creation then returns `202` with
`state: "awaiting-approval"` and an `approvalId`; no provider request has happened. The approval
subject is the delivery id, whose immutable record already binds destination version, name,
format, size and digest. A terminal approval runs that exact staged record. Rejection becomes
the terminal delivery state `rejected`, withdrawal becomes `cancelled`, and neither can be
relabelled as a transport failure or bypassed through the retry route. A configured chain that
does not exist fails closed before the request body is accepted. Service tokens cannot create
a human-review request; later workflow automation must enter through its own explicit approval
step rather than laundering a token as a person.

S3 `PUT` is followed by a signed `HEAD` size check; WebDAV performs authenticated
`PUT`/`HEAD`/bounded-`GET` digest verification. Their receipts record `transformation: "none"`
and the delivered digest. Signed
HTTPS derives that status from the receiver's digest instead of pretending every publisher is
byte-preserving. Redirects are refused by all three adapters.
Delivery creation and retry share the existing automation rate-limit bucket because each may
spend an organization-owned credential; read-only discovery and receipt history do not.

Delivery history is principal-scoped. Stored records and audit events contain destination ids
and output facts, never credentials. Removing a destination stops new sends and retries but
does not delete remote objects or erase historical receipts.

## API example

```bash
curl -X POST \
  -H 'Cookie: lw_session=…' \
  -H 'Content-Type: image/png' \
  -H 'Idempotency-Key: campaign-42-poster-v1' \
  --data-binary @poster.png \
  'https://work.example/api/v1/destinations/campaign-archive/deliveries?name=Launch%20poster&format=png'
```

Discovery and history routes are listed in the [API reference](api.md#outbound-delivery).

## Interoperability canaries

Three gated tests check each adapter against a real endpoint. Each one is skipped unless its
switch is set to `1`, writes inert text under a random `canary-<uuid>` delivery id, and removes
that exact object afterwards, or fails and lists each id whose removal it could not confirm.
None of them lists or browses the remote side or prints a credential.

| Test | Switch | Settings (each prefixed with the switch name) |
|---|---|---|
| `tests/s3-upcloud-canary.test.ts` | `LW_S3_CANARY` | `_ENDPOINT`, `_REGION`, `_BUCKET`, `_ACCESS_KEY`, `_SECRET_KEY` |
| `tests/webdav-delivery-canary.test.ts` | `LW_WEBDAV_CANARY` | `_URL`, `_CREDENTIAL`, optional `_PREFIX` |
| `tests/https-delivery-canary.test.ts` | `LW_HTTPS_CANARY` | `_URL`, `_SECRET`, `_CLEANUP_URL`, optional `_CLEANUP_CREDENTIAL` |

Point the WebDAV canary at an existing collection set aside for the test. It delivers twice to
confirm that a retry overwrites the same resource, then reads the bytes back with its own
request. The signed-HTTPS protocol has no delete contract, so that canary deletes through the
receiver's own management API: `LW_HTTPS_CANARY_CLEANUP_URL` is an HTTPS URL with one `{id}`
placeholder, filled with the `id` from each receipt, and a `GET` of the same URL must then answer
404 or 410. When a receipt is missing, unusable or has no `id`, the canary uses the delivery id
instead and counts the item as removed only when the `DELETE` succeeds. The management API
should resolve delivery ids; if it cannot, the canary reports the cleanup as unconfirmed and the
operator must check the receiver by hand. When the receipt carries a digest, it must match the
bytes sent. A second HTTPS test sends three requests the receiver must refuse with a 4xx status:
a signature from another secret, a timestamp a day old, and a body that does not match its
signed digest.

## Current edge of the first slice

Built now: shell presentation separated from personal connections; optional approval-chain
binding over immutable staged bytes; completed automation-render output consumed by immutable
reference with principal isolation and delete protection; fixed config-managed S3,
WebDAV and signed-HTTPS targets; group/RBAC projection; C2PA and byte caps; durable records in
both stores; idempotency; exact-byte retry; provider receipts; and audit events. The S3 wire is
live-validated against the project's UpCloud host. WebDAV and HTTPS have injected-wire tests and
the gated canaries above, which have not yet run against a real tenant or receiver, so neither
adapter is called live-verified.

Future asset-system destinations must also declare create/new-version/replace and conflict
policy before writing. Transfer acceptance, processing, original readiness, review and public
activation need separate observations. Reconcile uncertain completion using the remote
asset/version identity and committed effects before another write. Source approval must retain
its purpose, activation target and human/automated origin; it cannot stand in for approval of
the staged final digest. These are qualification requirements, not capabilities added to the
current S3, WebDAV or HTTPS adapters.

Still deliberately pending:

- the versioned small-workflow document/runner above the shipped job-output publish command;
- a replica-safe background claimant for queued/stalled deliveries;
- retention for staged retry bytes;
- administrator UI/CLI for destination configuration;
- a passing run of the WebDAV and signed-HTTPS canaries against an operator-supplied tenant and
  receiver.

Those additions extend this record and adapter seam; they do not widen catalog providers or
the personal connected-services contract.
