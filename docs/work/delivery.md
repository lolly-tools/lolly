# Organisation delivery destinations

Your team finishes a poster, and it has to reach the campaign archive exactly as approved. This
page is for the admin who sets up those fixed organisation destinations in Lolly Work, and for
the people and automations that send to them. Delivery sends one finished Lolly export to a
destination your organisation owns: S3-compatible storage (such as AWS S3, MinIO, Ceph RGW or
Garage), WebDAV (including Nextcloud and ownCloud), an HMAC-signed HTTPS receiver, Brandfolder
or Cloudinary.

## How delivery differs from a source

A catalog provider brings remote assets **into** Lolly, normally read-only. Delivery sends a
generated output **out**. Reusing one credential for both would silently turn read authority
into write authority, so the two keep separate contracts, registries and secrets.

- **Personal targets stay personal.** A person's own send targets stay on their device. Work
  cannot see, disable, redirect, credential or choose them, and they never appear in Work
  configuration, grants, history or credentials.
- **Organisation credentials stay on the server.** A shell receives only
  `{id, kind, label, formats, maxBytes, visibility, projectFiles?}`, after group and permission
  filtering.
- **Side by side, never instead.** The connected shell shows organisation destinations beside
  personal ones. An organisation S3 destination cannot replace a person's S3 connection or
  become their automatic export home, and a person's preference cannot withdraw an organisation
  destination.
- **Nothing by default.** No destination is configured until you add one, and no destination
  means no outbound delivery.
- **Explicit sends.** A manual send is a person's choice. Automation may publish only its own
  completed, unchangeable render output by reference; it cannot choose a personal file, another
  principal's job or an arbitrary storage key.
- **Signed exports only.** An export send needs a Content Credential on the exact bytes sent. DAM
  destinations may also accept a verified shared-project original with `projectFiles: true`;
  local and federated catalog assets never gain that authority.
- **No lock-in.** S3 is an open protocol adapter, not a privileged hosted service. You bring your
  own endpoint, bucket and key, and can leave without migrating a Lolly-specific format.

## Pick an adapter

| Adapter | Credential | After writing, Work checks | Revoke |
|---|---|---|---|
| `s3` | `<accessKeyId>:<secretAccessKey>` | a signed `HEAD` confirms the size | no |
| `webdav` | `<username>:<app-password>`, or `bearer:<token>` | authenticated `HEAD` and a bounded `GET` confirm size and SHA-256 | no |
| `https` | a dedicated random HMAC secret | the receiver's returned digest, when it sends one | no; the protocol has no safe universal delete |
| `brandfolder` | an API token used only for writing | reads the original back and compares SHA-256 | no; it never updates, replaces, moves or deletes an asset |
| `cloudinary` | JSON `{ "apiKey", "apiSecret" }` | reads the original back and compares SHA-256 | no; an id collision is never replaced |

S3, WebDAV and signed HTTPS refuse redirects, and Brandfolder refuses API and upload redirects.
S3 and WebDAV receipts record
`transformation: "none"` and the delivered digest. Signed HTTPS derives that status from the
receiver's digest rather than assuming every publisher keeps bytes unchanged.

## Configure a destination

Destinations live in the instance configuration under `delivery`. Every destination has an
`id`, a `kind`, a `label`, a `credentialRef` (the environment variable that holds its secret),
`enabled`, the `groups` that may see it, the `formats` it accepts and an optional `maxBytes`
below the instance-wide `delivery.maxBytes`.

::: warning Use a credential made for this destination
Use a write credential dedicated to one destination and restricted to its bucket, folder or
section. Do not reuse a catalog-provider credential, the instance BlobStore credential or an
operator's broad release key.
:::

### Configure a fixed S3 destination

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

`publicBaseUrl` is optional and means exactly what it says: when present, Work marks the
destination public and returns the matching object URL in the receipt. An unguessable public URL
is not access control.

### Configure a fixed WebDAV destination

The collection, and any `prefix` subdirectory, must already exist. Delivery neither browses the
account nor creates folders; it writes only beneath the fixed collection URL.

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

Set `LW_DESTINATION_TEAM_FILES='<username>:<app-password>'`, or `bearer:<token>` for a
token-fronted DAV server. For Nextcloud, use a revocable app password, not the account password.
A predictable flat filename makes a retry overwrite the same resource. A successful `PUT` is
followed by authenticated `HEAD` and bounded `GET` checks of size and SHA-256 before the receipt
claims the bytes arrived unchanged. `publicBaseUrl` is optional and separate from the
credentialed collection URL.

### Configure a signed-HTTPS destination

This adapter connects an organisation-owned publishing service without tying Work to its vendor
or API. The target is one exact HTTPS endpoint, not a webhook a person types in:

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
`x-lolly-content-sha256`, `x-lolly-timestamp` and `x-lolly-signature: v1=<hex-hmac-sha256>`.
The signed canonical string is:

```text
lolly-delivery-v1\n<timestamp>\n<delivery-id>\n<format>\n<base64url-name>\n<content-type>\n<size>\n<sha256>
```

The receiver should reject stale timestamps and duplicate delivery ids. It may return no body, or
JSON `{ "id": "…", "url": "https://…", "sha256": "…" }` (at most 64 KiB). A matching digest
records `transformation: "none"`, a different digest records `"provider-managed"`, and no digest
records `"unknown"`.

### Configure Brandfolder writes

Use a separate write credential, even when Brandfolder is already a catalog source: the read-only
source does not grant delivery permission. Configure one existing Brandfolder and file section
per destination:

```json
{
  "id": "brandfolder-campaigns",
  "kind": "brandfolder",
  "label": "Brandfolder campaigns",
  "credentialRef": "LW_DESTINATION_BRANDFOLDER",
  "enabled": true,
  "groups": ["brand"],
  "formats": ["png", "jpg", "pdf"],
  "projectFiles": true,
  "options": {
    "brandfolderId": "your-brandfolder-id",
    "sectionId": "your-section-id",
    "visibility": "private",
    "uploadOrigins": ["https://your-qualified-upload-origin.example"],
    "downloadOrigins": ["https://your-qualified-original-origin.example"]
  }
}
```

- The referenced variable holds the Brandfolder API token. Bearer credentials go only to
  `https://brandfolder.com/api/v4`, never to storage.
- Supply the exact HTTPS storage origins you observed and checked for your tenant; the example
  origins are placeholders. API and upload redirects are refused. Reading the original back
  follows at most three redirects, checking the exact download origin at every hop, without API
  credentials.
- `visibility` declares the existing Brandfolder's access policy; it does not change that policy.
  Check the setting again when administrators change remote access.

The adapter follows [Brandfolder Binary
Upload](https://developers.smartsheet.com/api/brandfolder/openapi/binary_upload): it requests a
temporary upload ticket, uploads the original, then creates one asset in the chosen section.
Brandfolder's temporary object URL is reachable by its importer and managed by the vendor. As of
October 2026, Brandfolder's documentation says upload URLs expire after 24 hours and temporary
objects after seven days. Work never publishes its own source blob or returns those temporary URLs
to the shell.

A private progress record is saved before creation and again with the created asset ID, so a
processing or verification failure retries that known asset without uploading or creating it
again. If the create response is lost, Brandfolder documents no idempotency key, so the delivery
stops with an uncertain-outcome message. An operator must reconcile the asset before another
create is attempted; do not create a fresh delivery just to get past the message. The adapter does
not assign collection membership.

### Configure Cloudinary writes

This adapter stores authenticated **raw** originals in a product environment that uses dynamic
folders. It does not generate image or video renditions or publish a public CDN URL.

```json
{
  "id": "cloudinary-originals",
  "kind": "cloudinary",
  "label": "Cloudinary originals",
  "credentialRef": "LW_DESTINATION_CLOUDINARY",
  "enabled": true,
  "groups": ["brand"],
  "formats": ["png", "jpg", "svg", "pdf", "mp4"],
  "maxBytes": 67108864,
  "projectFiles": true,
  "options": {
    "cloudName": "your-cloud",
    "region": "eu",
    "folderMode": "dynamic",
    "assetFolder": "campaigns",
    "publicIdPrefix": "lolly-deliveries"
  }
}
```

- The secret is JSON `{ "apiKey": "...", "apiSecret": "..." }`, used only on the server. Regions
  are `us` (default), `eu` and `ap`.
- The folder and the public-ID prefix are set separately: `asset_folder` does not imply a
  public-ID path in dynamic-folder mode. Fixed-folder tenants are not supported.
- Keep the delivery limit at or below 64 MiB; chunked uploads are outside this adapter.
- Uploads use an operation-specific public ID, `type=authenticated` and `overwrite=false`. A
  retry first looks up that ID through the Admin API, and accepts existing bytes only when the
  destination, operation markers and original download digest all match.
- Only the delivery ID and SHA-256 are added as reconciliation context. No source tags, approval,
  private notes, prompts or other organisation fields are copied, and the adapter sends no upload
  preset, eager or incoming transformation, moderation, AI or add-on, or URL-import parameters.
  Check tenant-wide processing settings separately. See the [Upload
  API](https://cloudinary.com/documentation/image_upload_api_reference) and [folder
  modes](https://cloudinary.com/documentation/folder_modes).

::: note Test a DAM destination before you enable it
Both DAM adapters are fixture-tested. Before enabling one, use a dedicated test section or folder
to check credentials, tenant settings, readback, access, processing time and timeout recovery on
your own tenant.
:::

### Send a shared original

With `projectFiles: true` on a DAM destination, the Assets view offers that destination when the
selected asset is a shared-project original. The shell posts an empty body to
`/api/v1/destinations/:id/deliveries?projectId=...&fileId=...&checksum=...`; no `name` or
`format` override is accepted. The server reads the ready file, verifies every stored part and
the whole digest, and works out the format from the bytes, with the stored filename as a
fallback. The destination's format list and size limit apply, and no browser download and upload
round trip is needed.

- The original stays in its project. Work stages an unchangeable private copy for retry, and
  keeps the source reference only on the server.
- The configured submit scan hook runs before the file leaves, with the same reject and error
  policy as catalog admission. No hook means no scan was performed.
- The source person's current project access, account status, destination grants and
  configuration are checked again before sending, after scanning, on retry and after any human
  approval. Service tokens cannot choose project originals.
- The destination's own access rules apply. Sending an original does not copy its project
  permissions or approval state.

Raw-body and automation-output sends still need genuine signed Lolly exports; this capability
does not make arbitrary catalog or device files eligible.

## What happens when you send

A raw body is accepted only when it carries Lolly's C2PA export assertion. Before anything leaves,
Work records its SHA-256 and stages the exact bytes in the configured BlobStore.

::: figure work-delivery-lifecycle
A delivery waits for approval when its destination has a chain, then is queued, delivered or failed. A retry sends the same staged bytes again; a reject or a withdrawal ends the delivery.
:::

- **The record does not change.** It binds the destination version, name, format, MIME type,
  size and SHA-256, in both the memory and PostgreSQL stores.
- **One attempt at a time.** Attempts are claimed atomically across replicas, so two retries
  cannot both run. A process interrupted while `delivering` stays held for an operator to
  reconcile; another worker does not take it over automatically.
- **Retries send the same bytes.** For S3, a retry uses the staged bytes and the same key:
  `<prefix>/<delivery-id>/<sha256-prefix>-<safe-filename>.<format>`.
- **A changed destination needs a new delivery.** If the destination's endpoint, bucket, prefix,
  formats, exposure or other meaning changes, its version changes and a retry returns
  `409 DESTINATION_CHANGED`. Credential rotation does not change the version.
- **History.** Delivery history is scoped to the principal that sent the delivery. Stored records and audit
  events contain destination ids and output facts, never credentials. Creation is audited once as
  `delivery.created`, and each attempt records `delivery.delivered` or `delivery.failed`.
- **Rate limits.** Creating and retrying share the automation rate-limit bucket, because each may
  spend an organisation credential; discovery and receipt history do not.
- **Removing a destination** stops new sends and retries. It does not delete remote objects or
  erase receipts.

### Delivering an automation output

`POST /api/v1/jobs/:id/deliveries` sends a completed `render` job owned by the same member or
service principal. The JSON body is `{ "destinationId": "campaign-archive", "name": "Launch
poster" }`; an optional `format` must equal the job's recorded format and cannot override that format.

When the job completes, Work records a SHA-256 over the actual output bytes, independently of the
storage provider (an S3 ETag is not a portable content digest). Delivery reads the stored result,
checks it against that digest, verifies its Lolly Content Credential again, then points the
delivery's private `sourceRef` at the existing blob. There is no download and upload round trip
and no second stored copy. Jobs completed before digests were stored must be rendered again
before this route can deliver them.

The receipt shows `sourceJobId` for correlation, never the private storage reference. The source
job cannot be deleted while any delivery keeps its output (`409 JOB_OUTPUT_IN_USE`), even after a
successful send, so retry and audit cannot be undermined by deleting their evidence. Durable render
jobs from `/api/v1/renders` cannot be delivered this way yet ([Render jobs and
batches](renders.md#hosting-and-recovery)).

### Optional human approval

Set `approvalChain` on a destination to an existing chain id. Creation then returns `202` with
`state: "awaiting-approval"` and an `approvalId`, and nothing has been sent. The approval subject
is the delivery id, whose record already binds the destination version, name, format, size and
digest, and a final approval sends that exact staged record.

- A rejection becomes the final delivery state `rejected`, and a withdrawal becomes `cancelled`.
  Neither can be relabelled as a transport failure or bypassed through the retry route.
- A configured chain that does not exist fails closed, before the request body is accepted.
- Service tokens cannot create a human-review request, for raw bodies and job outputs alike.
  Future workflow automation must enter through its own explicit approval step.

How chains work is on [Approvals](approvals.md).

## Who may send

`delivery.create` is the right to send to a fixed organisation destination. Members carry it by
default, because the operator has already chosen, credentialed and enabled each destination. The
destination's `groups` and resource grants narrow it further:

```bash
lw grants add group:contractors delivery.create 'destination:campaign-archive' --effect deny
```

- A matching deny removes that destination from the caller's `org-config`, and is checked again
  when the delivery is written. The same deny-wins decision applies to discovery, creation and
  retry.
- An explicit per-destination allow can extend a destination beyond its configured groups, for
  example to give a `viewer` service token exactly one delivery right without raising its role.
- When a destination has an `approvalChain`, `delivery.create` allows staging and requesting
  review, not the send itself; the approval chain and its separation-of-duties rules decide that.
- For an automation output, the same action adds no general storage authority: the caller must
  own the job, it must be a finished `render`, its recorded format cannot change and its stored
  bytes pass integrity and C2PA checks again.
- Losing the permission stops new sends and retries, but does not erase the caller's own
  receipts. `delivery.create` has no authority over personal send targets.

Grants in general are on [Roles and grants](permissions.md).

## API example

```bash
curl -X POST \
  -H 'Cookie: lw_session=…' \
  -H 'Content-Type: image/png' \
  -H 'Idempotency-Key: campaign-42-poster-v1' \
  --data-binary @poster.png \
  'https://work.example.com/api/v1/destinations/campaign-archive/deliveries?name=Launch%20poster&format=png'
```

Discovery and history routes are in the [API reference](api.md#outbound-delivery).

## Check a destination against a live system

The S3 adapter has been checked against a live S3-compatible host. WebDAV and signed HTTPS have
injected-wire tests, and opt-in checks in the Work repository that have not yet run against a real
tenant or receiver, so neither is called live-verified.

::: details The opt-in interoperability checks
Three gated tests in the Work repository check each adapter against a real endpoint. Each is
skipped unless its switch is set to `1`. It writes inert text under a random `canary-<uuid>`
delivery id and removes that exact object afterwards, or fails and lists each id whose removal it
could not confirm. None of them lists or browses the remote side or prints a credential.

| Test | Switch | Settings (each prefixed with the switch name) |
|---|---|---|
| `tests/s3-upcloud-canary.test.ts` | `LW_S3_CANARY` | `_ENDPOINT`, `_REGION`, `_BUCKET`, `_ACCESS_KEY`, `_SECRET_KEY` |
| `tests/webdav-delivery-canary.test.ts` | `LW_WEBDAV_CANARY` | `_URL`, `_CREDENTIAL`, optional `_PREFIX` |
| `tests/https-delivery-canary.test.ts` | `LW_HTTPS_CANARY` | `_URL`, `_SECRET`, `_CLEANUP_URL`, optional `_CLEANUP_CREDENTIAL` |

The S3 test accepts any S3-compatible endpoint. Point the WebDAV test at an existing collection
set aside for the test: it delivers twice to confirm that a retry overwrites the same resource,
then reads the bytes back with its own request.

The signed-HTTPS protocol has no delete contract, so that test deletes through the receiver's own
management API. `LW_HTTPS_CANARY_CLEANUP_URL` is an HTTPS URL with one `{id}` placeholder, filled
with the `id` from each receipt, and a `GET` of the same URL must then answer 404 or 410. When a
receipt is missing, unusable or has no `id`, the test uses the delivery id instead and counts the
item as removed only when the `DELETE` succeeds. If the management API cannot resolve delivery
ids, the test reports the cleanup as unconfirmed, and the operator must check the receiver by
hand. When the receipt carries a digest, it must match the bytes sent. A second HTTPS test sends
three requests the receiver must refuse with a 4xx status: a signature from another secret, a
timestamp a day old, and a body that does not match its signed digest.
:::

## Not built yet

- A versioned small-workflow document and runner above the job-output send.
- A replica-safe background claimant for queued or stalled deliveries.
- Retention for staged retry bytes, and for job outputs a delivery keeps.
- Destination setup in the console or CLI; destinations are configuration only.
- A passing run of the WebDAV and signed-HTTPS checks against a real tenant and receiver.

Any further DAM destination must declare how it writes (create, new version or replace) and its
conflict policy before it writes anything. Transfer acceptance, processing, original readiness,
review and public activation need separate observations, and an uncertain completion must be
reconciled against the remote asset and its committed effects before another write. Approval of
a source cannot stand in for approval of the staged final digest. These are requirements for a
new destination, not capabilities of the current adapters.
