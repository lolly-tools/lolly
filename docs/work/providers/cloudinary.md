# Cloudinary (kind: `cloudinary`)

Connect one Cloudinary product environment and its media appears in the Lolly Work catalog,
with original downloads by stable asset ID and access decided by Work groups. Cloudinary stays
the source. Members' browsers only ever see Work URLs, never a Cloudinary link or secret.

| You get | Not included |
|---|---|
| Read-only access to one environment, or one folder in it | Uploads, transformations or AI indexing |
| Original files fetched by immutable asset ID | Public CDN links or outbound delivery |
| Thumbnails from small raster originals | Generated thumbnails for other files |
| Approval and dates from tags and metadata you choose | Territory, talent or channel clearance |

## What you need

- Your **cloud name**, the **API region** (`us`, `eu` or `ap`) and an **API key and secret** that
  your organisation owns.
- Access to the Search and Admin APIs, and to downloads by asset ID for the delivery types you
  need.
- An agreed subset and the Work groups that should see the files. `assetFolder` selects one exact
  dynamic folder, without its subfolders. Leave it out only when you mean to expose everything
  the credential can see. Legacy fixed-folder restrictions are not supported.

Use the advanced **Providers > Cloudinary** form or `lw`. Work exposure decides who sees what,
because a shared service credential does not carry each member's own folder permissions.

## Credential shape

JSON with `apiKey` and `apiSecret`, stored through the write-only credential control or
`lw providers credential cloud-media`. Never put either value in options, on the command line or
in a URL. A config-managed source gives, in `credentialRef`, the name of an environment variable holding
that JSON. The secret signs short-lived downloads on the server; no secret or signed link
enters the catalog.

```json
{ "apiKey": "…", "apiSecret": "…" }
```

## instance.json

```json
{
  "id": "cloud-media",
  "kind": "cloudinary",
  "label": "Approved media",
  "options": {
    "cloudName": "your-cloud",
    "region": "us",
    "assetFolder": "Brand/Approved",
    "pageSize": 100,
    "minGapMs": 7500,
    "approvedTag": "approved-for-lolly"
  },
  "credentialRef": "CLOUDINARY_READ_CREDENTIAL",
  "exposure": { "groups": ["design"], "requireApproved": true },
  "mapping": { "availabilityFields": { "from": "context.release", "until": "context.expiry" } },
  "sync": { "ttlSeconds": 300, "maxAssets": 100000 }
}
```

::: details Options
| Option | Default | What it does |
|---|---|---|
| `cloudName` (required) | | Your Cloudinary cloud name. |
| `region` | `us` | Picks a fixed API host: `us`, `eu` or `ap`. |
| `assetFolder` | none | One exact, case-sensitive dynamic folder. |
| `pageSize` | 100 | 1 to 500 per page. |
| `minGapMs` | 2000 | 0 to 60,000 ms between requests within one driver instance. Not a global rate limit. |
| `includeMetadata` | `false` | Read structured metadata as well as contextual metadata. |
| `approvedTag` | none | The tag that marks a file approved. |
:::

**Approval.** `approvedTag` is a convention your administrators define, not a moderation result
or a licence. Without it, approval stays unknown and `requireApproved` exposes nothing.

**Dates.** Availability field names read contextual metadata by default; the `context.` prefix
is optional. `metadata.` reads structured metadata and needs `includeMetadata: true` plus the
matching Search entitlement. Use ISO 8601 dates: an invalid date fails the mapping rather than
removing the gate.

## Verify

```bash
lw providers preview --kind cloudinary --options '{"cloudName":"your-cloud","assetFolder":"Brand/Approved","minGapMs":7500}' --shape
lw providers add cloud-media --kind cloudinary --label "Approved media" --options '{"cloudName":"your-cloud","assetFolder":"Brand/Approved","minGapMs":7500}'
lw providers credential cloud-media
lw providers health cloud-media
lw providers sync cloud-media
lw providers enable cloud-media
```

The credential prompt is hidden. Shape reports hold field names and types, never values. Check
the mapped sample, groups and source scope before enabling, then run the
[Cloudinary check](tenant-check.md#cloudinary), including original checksums and private files.
Contributors changing the driver follow its [maintainer runbook](cloudinary-live-verify.md) in
the Lolly Work repository.

## Notes / limits

- **Not yet confirmed against a live environment.** No authenticated Cloudinary account has been
  tested. The driver accepts uploaded `image`, `video` and `raw` resources with `upload`,
  `private` or `authenticated` delivery; external delivery types are skipped with a count and a
  note.
- **References follow the observed version.** Each file reference records the version Work saw,
  and opening it checks identity, folder, version, approval and dates again. A changed file
  needs a refresh. For a fixed local snapshot, materialize the source; this is not a backup of
  past versions.
- **Thumbnails.** An existing raster original of at most 2 MiB is reused as the thumbnail, and no
  thumbnail transformation is requested. Larger images, documents, SVG, audio and video have no
  generated thumbnail. Previews still use bandwidth.
- **Freshness.** Cloudinary sends no change notifications, so agree how stale a synced listing or
  cached file may be. A fresh read checks the mapped policy again, and Work's membership and
  lifecycle gates protect every served URL.
- **Costs.** API calls and downloads can be charged. Budget for search, health, detail, sync and
  file reads together. A `429` is passed back without retries. The 7,500 ms gap in the example
  suits one caller on the Free plan; several callers need a shared budget you manage.
  Structured metadata and facets can need a paid entitlement.
- **Claims are not checked.** The connector does not verify metadata, proof decisions or Content
  Credentials in the files. Check the bytes themselves.

## Off-boarding

After the [Cloudinary check](tenant-check.md#cloudinary) proves original fidelity, leave through
Work's usual materialize and drift steps ([Leave a DAM](../offboarding.md)). Keep the source
metadata, and export any review, rights or history records separately: this driver does not
migrate the DAM's configuration, and a version check in Work is not a vendor backup.

Vendor references: [Search](https://cloudinary.com/documentation/search_method),
[Admin API](https://cloudinary.com/documentation/admin_api),
[download by asset ID](https://cloudinary.com/documentation/image_upload_api_reference#download_by_asset_id),
[billing](https://cloudinary.com/documentation/billing_and_plans).
