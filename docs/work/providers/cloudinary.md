# Cloudinary (kind: `cloudinary`)

Read-only federation of one Cloudinary product environment. Assets use immutable asset IDs;
the browser receives Work URLs. Upload, transformation, AI agents and outbound delivery are
separate services and are not enabled by connecting this source.

## What you need

- Your cloud name, API region (`us`, `eu` or `ap`) and an organisation-owned API key/secret.
- Access to the Search and Admin APIs and asset-ID downloads for the required delivery types.
- An agreed subset and Work groups. `assetFolder` selects one exact dynamic folder, with no
  subfolders. Omit that option only when exposing the credential's whole library is intended.
  It does not support a legacy fixed-folder restriction.

The advanced **Providers > Cloudinary** form accepts the options below. The CLI offers the
same source. A shared service identity does not automatically carry individual users' upstream
folder permissions; configure Work exposure explicitly.

## Credential shape

Store JSON containing `apiKey` and `apiSecret` in the write-only credential control or through
`lw providers credential cloud-media`. Do not put either value in options, argv or a URL.
For config-managed sources, `credentialRef` identifies an environment variable containing that JSON.
The API secret signs short-lived server-side downloads. No secret or signed URL enters the feed.

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

`approvedTag` is an administrator-defined convention, not a moderation result or a licence.
Without that option approval remains unknown, so `requireApproved` exposes nothing.
Availability names read contextual metadata by default; `context.` is an optional prefix.
`metadata.` reads structured metadata and requires `includeMetadata: true` plus the applicable
Search entitlement. Set dates in ISO 8601; invalid dates fail mapping rather than remove a gate.
No contextual territory, talent or channel clearance is inferred from these fields.

## Verify

```bash
lw providers preview --kind cloudinary --options '{"cloudName":"your-cloud","assetFolder":"Brand/Approved","minGapMs":7500}' --shape
lw providers add cloud-media --kind cloudinary --label "Approved media" --options '{"cloudName":"your-cloud","assetFolder":"Brand/Approved","minGapMs":7500}'
lw providers credential cloud-media
lw providers health cloud-media
lw providers sync cloud-media
lw providers enable cloud-media
```

The credential prompt is hidden. Review the mapped sample, groups and source scope before
enabling. Complete the [tenant verification](cloudinary-live-verify.md), including original
checksums and private assets. Shape reports contain field names/types, not source values.

## Options

`cloudName` is required. `region` defaults to `us` and selects a fixed API host. `assetFolder`
is exact and case-sensitive. `pageSize` is 1-500, default 100. `minGapMs` is 0-60000, default
2000, and spaces requests within one driver instance; it is not a global rate limiter.
`includeMetadata` defaults false. `approvedTag` has no default.

## Notes / limits

- This driver is fixture-verified. No authenticated Cloudinary tenant has been tested here.
  It accepts uploaded `image`, `video` and `raw` resources with `upload`, `private` or
  `authenticated` delivery. External delivery types are skipped with a count and note.
- A file reference contains the observed version. Resolution rechecks identity, folder,
  version, source approval and dates. A changed file needs a refresh; this is not a historical
  backup resolver. Materialise a source when an immutable local snapshot is required.
- Thumbnails reuse an existing raster original only when its declared size is at most 2 MiB.
  No thumbnail transformation is requested. Larger images, documents, SVG, audio and video
  retain ordinary file access without a generated thumbnail. Preview reads still use bandwidth.
- Existing Work byte caches, pinned copies and browser caching retain their normal semantics.
  Upstream changes are not webhooks; agree a sync/cache freshness bound. Fresh upstream reads
  recheck the mapped policy, while current Work membership/lifecycle gates protect served URLs.
- API calls and downloads can incur charges. Budget Search, health, detail, sync and byte
  resolution together. A 429 is returned without an internal retry loop. The recommended
  7500 ms gap is conservative for a single Free-plan caller; concurrent callers need an
  operator-managed aggregate budget. Structured metadata/facets can require paid entitlement.
- Metadata, proof decisions and Content Credentials are not independently verified by this
  connector. It neither starts AI indexing nor creates public CDN links. Check actual bytes.

## Off-boarding

Use Work's normal materialise/drift process after the tenant pass proves original fidelity.
Preserve source metadata and explicitly export any additional review/rights/history records;
this driver does not migrate the full DAM configuration. A Lolly version check is not a vendor
backup guarantee. See [offboarding](../offboarding.md).

Contracts: [Search](https://cloudinary.com/documentation/search_method),
[Admin API](https://cloudinary.com/documentation/admin_api),
[download by asset ID](https://cloudinary.com/documentation/image_upload_api_reference#download_by_asset_id),
[billing](https://cloudinary.com/documentation/billing_and_plans).
